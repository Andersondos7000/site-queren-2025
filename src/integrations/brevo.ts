import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const Brevo = require('sib-api-v3-sdk')

const apiClient = Brevo.ApiClient.instance
apiClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY || ''

const transactionalEmailsApi = new Brevo.TransactionalEmailsApi()

export { transactionalEmailsApi }