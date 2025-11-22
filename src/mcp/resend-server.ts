import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import fetch from 'node-fetch'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.backend' })

const server = new McpServer({ name: 'resend-mcp', version: '1.0.0' })

const sendEmailSchemaShape = {
  to: z.string().min(3),
  subject: z.string().min(1),
  html: z.string().min(1).optional(),
  text: z.string().optional(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  replyTo: z.string().optional(),
  from: z.string().optional(),
  scheduledAt: z.string().optional()
}

server.registerTool(
  'send_email',
  {
    title: 'Enviar email via Resend',
    description: 'Enviar email via Resend com HTML/Texto, CC/BCC, reply-to e agendamento',
    inputSchema: sendEmailSchemaShape,
    outputSchema: { id: z.string(), status: z.string() }
  },
  async (input) => {
    const apiKey = process.env.RESEND_API_KEY || ''
    if (!apiKey) throw new Error('RESEND_API_KEY não configurada')
    const senderEmail = input.from || process.env.SENDER_EMAIL || 'onboarding@resend.dev'
    const senderName = process.env.SENDER_NAME || 'Queren'
    const payload: any = {
      from: `${senderName} <${senderEmail}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      cc: input.cc,
      bcc: input.bcc,
      reply_to: input.replyTo,
      scheduled_at: input.scheduledAt
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Resend error ${res.status}: ${text}`)
    }
    const data = await res.json()
    const output = { id: data?.id || 'unknown', status: data?.status || 'queued' }
    return {
      content: [{ type: 'text', text: JSON.stringify(output) }],
      structuredContent: output
    }
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
