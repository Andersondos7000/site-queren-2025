import { createClient } from '@supabase/supabase-js'
import { sendTransactionalEmail } from '../services/emailService'
import { renderPaymentReceipt, renderTicketDelivery, renderWelcome, renderTicketPurchaseConfirmation } from '../services/emailRenderer'
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

function buildEmail(type: string, payload: any) {
  if (type === 'payment_receipt') {
    const orderId = payload?.order_id as string
    const orderUrl = `${process.env.FRONTEND_URL || ''}/orders/${orderId}`
    return renderPaymentReceipt({ orderId, orderUrl })
  }
  if (type === 'ticket_delivery') {
    const orderId = payload?.order_id as string
    const ticketsUrl = `${process.env.FRONTEND_URL || ''}/tickets/${orderId}`
    return renderTicketDelivery({ orderId, ticketsUrl })
  }
  if (type === 'ticket_purchase_confirmation') {
    const t = payload?.ticket || {}
    const eventName = t.events?.name || 'Queren Hapuque VIII Conferência de Mulheres'
    const dateObj = t.events?.date ? new Date(t.events.date) : null
    const eventDate = dateObj ? dateObj.toLocaleDateString('pt-BR') : (t.events?.date || '')
    const eventTime = dateObj ? dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : undefined
    const venue = t.events?.location
    const attendeeName = (t.orders?.customer_data?.name) || t.orders?.customer_name || t.customers?.full_name || 'Participante'
    const email = (t.orders?.customer_data?.email) || t.orders?.customer_email || t.customers?.email
    const phone = (t.orders?.customer_data?.phone) || t.orders?.customer_phone || t.customers?.phone
    const ticketTypeLabel = t.ticket_type || t.batch || 'Ingresso'
    const unitPrice = t.price ? `R$ ${Number(t.price).toFixed(2)}` : (t.total_price ? `R$ ${Number(t.total_price).toFixed(2)}` : undefined)
    const orderTotal = t.orders?.total_amount ? `R$ ${Number(t.orders.total_amount).toFixed(2)}` : undefined
    const seatInfo = t.seat_number
    const ticketNumber = String(t.id || payload?.ticket_id || payload?.order_id || '')
    const status = t.status
    const quantity = t.quantity || 1
    const qrData = t.qr_code || JSON.stringify({ ticket_id: t.id })
    const qrCodeUrl = typeof qrData === 'string' && qrData.startsWith('http') 
      ? qrData 
      : `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`
    const manageUrl = `${process.env.FRONTEND_URL || ''}/tickets/${payload?.order_id || t.id || ''}`
    return renderTicketPurchaseConfirmation({
      eventName,
      eventDate,
      eventTime,
      venue,
      attendeeName,
      email,
      phone,
      ticketTypeLabel,
      unitPrice,
      orderTotal,
      seatInfo,
      ticketNumber,
      status,
      quantity,
      qrCodeUrl,
      manageUrl
    })
  }
  if (type === 'user_welcome') {
    const name = payload?.name as string
    const appUrl = process.env.FRONTEND_URL || ''
    return renderWelcome({ name, appUrl })
  }
  const subject = (payload?.subject as string) || 'Mensagem'
  const html = `<!doctype html><html><body>${subject}</body></html>`
  const text = subject
  return { subject, html, text }
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
    const payload = row.payload_json as any
    const rendered = buildEmail(type, payload)
    try {
      await sendTransactionalEmail(to, rendered.subject, rendered.html, rendered.text)
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