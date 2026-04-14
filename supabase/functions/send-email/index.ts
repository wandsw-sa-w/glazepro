import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const AZURE_TENANT_ID = Deno.env.get("AZURE_TENANT_ID")
const AZURE_CLIENT_ID = Deno.env.get("AZURE_CLIENT_ID")
const AZURE_CLIENT_SECRET = Deno.env.get("AZURE_CLIENT_SECRET")

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

serve(async (req) => {
  try {
    const { to, cc, subject, body, from_mailbox } = await req.json()

    const token = await getAccessToken()

    const message = {
      subject,
      body: {
        contentType: "Text",
        content: body,
      },
      toRecipients: [{ emailAddress: { address: to } }],
      ...(cc ? { ccRecipients: [{ emailAddress: { address: cc } }] } : {}),
    }

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${from_mailbox}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, saveToSentItems: true }),
      }
    )

    if (!res.ok) {
      const err = await res.json()
      throw new Error(JSON.stringify(err))
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})