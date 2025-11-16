import { createClient } from '@supabase/supabase-js'
import { sendTransactionalEmail } from '../services/emailService'
import fs from 'fs'
import path from 'path'

function getSupabaseService() {
  let url = process.env.SUPABASE_URL || ''
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) {
    try {
      const mcp = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.trae', 'mcp.json'), 'utf-8'))
      const env = mcp?.mcpServers?.ecommerce?.env || {}
      url = url || env.SUPABASE_URL || ''
      key = key || env.SUPABASE_SERVICE_ROLE_KEY || ''
    } catch {}
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

function paymentReceiptHtml(orderId: string) {
  return `<!doctype html><html><head><meta charset="utf-8"/></head><body style="font-family:Arial,sans-serif;padding:16px;background:#f7f7f7"><div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #eee;border-radius:8px"><div style="padding:16px;border-bottom:1px solid #eee"><h2 style="margin:0;color:#111">Pagamento Confirmado</h2></div><div style="padding:16px;color:#333"><p style="margin:0 0 12px">Recebemos seu pagamento. Seu pedido foi confirmado.</p><p style="margin:0 0 8px">Pedido: <strong>${orderId}</strong></p><p style="margin:0 0 12px">Você receberá os ingressos em seguida neste mesmo e-mail.</p><a href="${process.env.FRONTEND_URL || ''}/orders/${orderId}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:6px">Ver pedido</a></div><div style="padding:16px;border-top:1px solid #eee;color:#666;font-size:12px">Queren Hapuque</div></div></body></html>`
}

function ticketDeliveryHtml(orderId: string) {
  return `<!doctype html><html><head><meta charset="utf-8"/></head><body style="font-family:Arial,sans-serif;padding:16px;background:#f7f7f7"><div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #eee;border-radius:8px"><div style="padding:16px;border-bottom:1px solid #eee"><h2 style="margin:0;color:#111">Seus Ingressos</h2></div><div style="padding:16px;color:#333"><p style="margin:0 0 12px">Os ingressos do seu pedido estão disponíveis.</p><p style="margin:0 0 8px">Pedido: <strong>${orderId}</strong></p><a href="${process.env.FRONTEND_URL || ''}/tickets/${orderId}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:6px">Acessar ingressos</a></div><div style="padding:16px;border-top:1px solid #eee;color:#666;font-size:12px">Queren Hapuque</div></div></body></html>`
}

async function processPendingBatch() {
  const supabase = getSupabaseService()
  const { data } = await supabase
    .from('emails_outbox')
    .select('*')
    .eq('status', 'pending')
    .lte('attempts', 5)
    .order('created_at', { ascending: true })
    .limit(10)
  if (!data || data.length === 0) return
  for (const row of data) {
    const to = row.to_email as string
    const type = row.type as string
    const subject = (row.subject as string) || (type === 'payment_receipt' ? 'Pagamento Confirmado' : type === 'ticket_delivery' ? 'Seus Ingressos' : 'Mensagem')
    const payload = row.payload_json as any
    const orderId = payload?.order_id as string
    let html = ''
    if (type === 'payment_receipt') html = paymentReceiptHtml(orderId)
    else if (type === 'ticket_delivery') html = ticketDeliveryHtml(orderId)
    else html = `<html><body>${subject}</body></html>`
    try {
      await sendTransactionalEmail(to, subject, html)
      await supabase
        .from('emails_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), attempts: (row.attempts as number) + 1 })
        .eq('id', row.id)
    } catch (err: any) {
      await supabase
        .from('emails_outbox')
        .update({ status: 'error', last_error: err?.message || String(err), attempts: (row.attempts as number) + 1 })
        .eq('id', row.id)
    }
  }
}

export function startEmailOutboxWorker() {
  processPendingBatch()
  setInterval(processPendingBatch, 15000)
}