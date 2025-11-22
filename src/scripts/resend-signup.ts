import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env.backend' })

async function main() {
  const emailArg = process.argv[2] || ''
  const email = (emailArg || '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    throw new Error('Email inválido. Uso: tsx src/scripts/resend-signup.ts user@example.com')
  }

  const url = process.env.VITE_SUPABASE_URL || ''
  const anon = process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!url || !anon) {
    throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórios em .env.local')
  }

  const supabase = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await supabase.auth.resend({ type: 'signup', email })
  if (error) {
    throw error
  }
  console.log(JSON.stringify({ ok: true, email }))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
