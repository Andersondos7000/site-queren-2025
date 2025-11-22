import dotenv from 'dotenv'
dotenv.config({ path: '.env.backend' })
import { renderTicketPurchaseConfirmation } from './services/emailRenderer'
import { sendTransactionalEmail } from './services/emailService'

async function main() {
  const to = process.argv[2] || 'delivered@resend.dev'
  const payload = {
    eventName: 'Queren Hapuque VIII Conferência de Mulheres',
    eventDate: '12/03/2026',
    eventTime: '19:00',
    venue: 'Auditório Central',
    attendeeName: 'Ana Souza',
    email: 'ana@example.com',
    phone: '(11) 99999-8888',
    ticketTypeLabel: 'Lote 1',
    unitPrice: 'R$ 120,00',
    orderTotal: 'R$ 120,00',
    seatInfo: 'A-12',
    ticketNumber: 'TCK-001234',
    status: 'Confirmado',
    quantity: 1,
    qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TCK-001234',
    manageUrl: (process.env.FRONTEND_URL || 'http://localhost:5173') + '/tickets/TCK-001234'
  }
  const rendered = renderTicketPurchaseConfirmation(payload)
  const res = await sendTransactionalEmail(to, rendered.subject, rendered.html, rendered.text)
  console.log(JSON.stringify(res))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})