import dotenv from 'dotenv'
dotenv.config({ path: '.env.backend' })
import { renderWelcome } from './services/emailRenderer'
import { sendTransactionalEmail } from './services/emailService'

async function main() {
  const to = process.argv[2] || 'delivered@resend.dev'
  const name = process.argv[3] || 'Usuário'
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const rendered = renderWelcome({ name, appUrl })
  const res = await sendTransactionalEmail(to, rendered.subject, rendered.html, rendered.text)
  console.log(JSON.stringify(res))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})