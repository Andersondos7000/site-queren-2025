import { renderWelcome } from './services/emailRenderer'

const out = renderWelcome({ name: 'Usuário', appUrl: 'http://localhost:5173' })
console.log(out.subject)
console.log(out.html.slice(0, 200))
console.log(out.text.slice(0, 200))