import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { sendTransactionalEmail } from '../services/emailService'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env.backend' })

async function main() {
  const emailArg = process.argv[2] || ''
  const email = (emailArg || '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    throw new Error('Email inválido. Uso: tsx src/scripts/send-confirmation-resend.ts user@example.com')
  }

  const url = process.env.VITE_SUPABASE_URL || ''
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !service) {
    throw new Error('VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios em .env.local')
  }

  const redirectTo = (process.env.FRONTEND_URL || 'http://localhost:5173') + '/auth/callback'
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
  let { data, error } = await admin.auth.admin.generateLink({ type: 'signup', email, options: { redirectTo } })
  if (error && (error as any)?.code === 'email_exists') {
    const fallback = await admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })
    data = fallback.data
    error = fallback.error || null
  }
  if (error) throw error

  const link = data?.properties?.action_link || data?.properties?.email_otp_link || ''
  if (!link) throw new Error('Não foi possível gerar o link de confirmação')

  const subject = 'Confirme seu cadastro'
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;padding:24px;">
    <h2>Confirmar cadastro</h2>
    <p>Olá, clique no botão abaixo para confirmar seu cadastro:</p>
    <p><a href="${link}" style="background:#6b46c1;color:#fff;padding:12px 16px;border-radius:6px;text-decoration:none;">Confirmar email</a></p>
    <p>Se o botão não funcionar, copie e cole este link no navegador:</p>
    <p><code>${link}</code></p>
  </body></html>`
  const text = `Confirme seu cadastro: ${link}`

  const res = await sendTransactionalEmail(email, subject, html, text)
  console.log(JSON.stringify({ ok: true, email, id: (res as any)?.id || 'unknown' }))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
