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
  return data.access_token
}

async function getEmails(token: string, mailbox: string) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${mailbox}/messages?$filter=isRead eq false&$top=50&$orderby=receivedDateTime desc`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
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
  const match = subject?.match(/L\d{6}/i)
  return match ? match[0].toUpperCase() : null
}

serve(async () => {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!)

  try {
    const token = await getAccessToken()

    // Get all active users with their email addresses
    const { data: users } = await supabase
      .from("users")
      .select("email, full_name")
      .eq("active", true)

    const mailboxes = users?.map((u: any) => u.email) || []

    let imported = 0
    let unmatched = 0

    for (const mailbox of mailboxes) {
      const emails = await getEmails(token, mailbox)

      for (const email of emails) {
        const leadNumber = extractLeadNumber(email.subject)

        // Check if already imported
        const { data: existing } = await supabase
          .from("lead_notes")
          .select("id")
          .eq("microsoft_message_id", email.id)
          .single()

        if (existing) continue

        if (leadNumber) {
          // Find the lead
          const { data: lead } = await supabase
            .from("leads")
            .select("id")
            .eq("lead_number", leadNumber)
            .single()

          if (lead) {
            // Import to lead correspondence
            await supabase.from("lead_notes").insert({
              lead_id: lead.id,
              subject: email.subject,
              type: "Email in",
              notes: email.body?.content || email.bodyPreview,
              author: email.from?.emailAddress?.address,
              microsoft_message_id: email.id,
              mailbox,
              created_at: email.receivedDateTime,
            })
            await markAsRead(token, mailbox, email.id)
            imported++
          } else {
            // Lead number found but lead doesn't exist
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
          // No lead number — add to unmatched
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
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})