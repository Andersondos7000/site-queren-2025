import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'

export const sendTransactionalEmail = async (to: string, subject: string, htmlContent: string) => {
  let apiKey = process.env.BREVO_API_KEY || ''
  if (!apiKey) {
    try {
      const mcp = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.trae', 'mcp.json'), 'utf-8'))
      const env = mcp?.mcpServers?.brevo_all?.env || {}
      apiKey = env.BREVO_API_KEY || ''
    } catch {}
  }
  const senderEmail = process.env.SENDER_EMAIL || 'sitequerenhapuque@gmail.com'
  const senderName = process.env.SENDER_NAME || 'Queren'
  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to }],
    subject,
    htmlContent
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Brevo error ${res.status}: ${text}`)
  }
  return await res.json()
}