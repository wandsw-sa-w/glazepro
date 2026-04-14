import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const AZURE_TENANT_ID = Deno.env.get("AZURE_TENANT_ID")
const AZURE_CLIENT_ID = Deno.env.get("AZURE_CLIENT_ID")
const AZURE_CLIENT_SECRET = Deno.env.get("AZURE_CLIENT_SECRET")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY")

async function getAccessToken() {
  const res = await fetch(`https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: AZURE_CLIENT_ID!,
      client_secret: AZURE_CLIENT_SECRET!,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  })
  const data = await res.json()
  console.log("Token response status:", res.status)
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`)
  return data.access_token
}

async function getEmails(token: string, mailbox: string) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${mailbox}/messages?$top=50&$orderby=receivedDateTime desc`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  console.log(`Got ${data.value?.length || 0} emails for ${mailbox}`)
  return data.value || []
}

async function markAsRead(token: string, mailbox: string, messageId: string) {
  await fetch(`https://graph.microsoft.com/v1.0/users/${mailbox}/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ isRead: true }),
  })
}

function extractLeadNumber(subject: string): string | null {
  const match = subject?.match(/L\d+/i)
  return match ? match[0].toUpperCase() : null
}

serve(async () => {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!)

  try {
    const token = await getAccessToken()

    const { data: users } = await supabase
      .from("users")
      .select("email, full_name")
      .eq("active", true)

    const mailboxes = users?.map((u: any) => u.email) || []
    console.log("Monitoring mailboxes:", mailboxes)

    let imported = 0
    let unmatched = 0

    for (const mailbox of mailboxes) {
      const emails = await getEmails(token, mailbox)

      for (const email of emails) {
        const leadNumber = extractLeadNumber(email.subject)

        // Check if already imported in lead_notes
        const { data: existingNote } = await supabase
          .from("lead_notes")
          .select("id")
          .eq("microsoft_message_id", email.id)
          .maybeSingle()

        // Check if already in unmatched
        const { data: existingUnmatched } = await supabase
          .from("unmatched_emails")
          .select("id")
          .eq("microsoft_message_id", email.id)
          .maybeSingle()

        if (existingNote || existingUnmatched) {
          console.log("Already imported, skipping:", email.subject)
          continue
        }

        if (leadNumber) {
          const { data: lead } = await supabase
            .from("leads")
            .select("id")
            .eq("lead_number", leadNumber)
            .maybeSingle()

          if (lead) {
            const { error: insertError } = await supabase.from("lead_notes").insert({
              lead_id: lead.id,
              subject: email.subject,
              type: "Email in",
              notes: email.body?.content || email.bodyPreview,
              author: email.from?.emailAddress?.address,
              microsoft_message_id: email.id,
              mailbox,
              created_at: email.receivedDateTime,
            })
            if (insertError) {
              console.log("lead_notes insert error:", JSON.stringify(insertError))
            } else {
              console.log("Imported to lead:", leadNumber, lead.id)
              await markAsRead(token, mailbox, email.id)
              imported++
            }
          } else {
            console.log("Lead number found but no matching lead:", leadNumber)
            await supabase.from("unmatched_emails").insert({
              subject: email.subject,
              from_address: email.from?.emailAddress?.address,
              from_name: email.from?.emailAddress?.name,
              body_preview: email.bodyPreview,
              microsoft_message_id: email.id,
              mailbox,
              received_at: email.receivedDateTime,
              created_at: new Date().toISOString(),
            })
            unmatched++
          }
        } else {
          await supabase.from("unmatched_emails").insert({
            subject: email.subject,
            from_address: email.from?.emailAddress?.address,
            from_name: email.from?.emailAddress?.name,
            body_preview: email.bodyPreview,
            microsoft_message_id: email.id,
            mailbox,
            received_at: email.receivedDateTime,
            created_at: new Date().toISOString(),
          })
          unmatched++
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, imported, unmatched }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.log("Error:", err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})