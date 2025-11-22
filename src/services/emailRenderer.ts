import { renderToStaticMarkup } from 'react-dom/server'
import juice from 'juice'
import { convert } from 'html-to-text'
import WelcomeEmail, { WelcomeEmailProps } from '../emails/WelcomeEmail'
import PaymentReceiptEmail, { PaymentReceiptEmailProps } from '../emails/PaymentReceiptEmail'
import TicketDeliveryEmail, { TicketDeliveryEmailProps } from '../emails/TicketDeliveryEmail'
import TicketPurchaseConfirmationEmail, { TicketPurchaseConfirmationProps } from '../emails/TicketPurchaseConfirmationEmail'

function wrapDoctype(html: string) {
  return '<!doctype html>' + html
}

function inlineCss(html: string) {
  return juice(html)
}

function toText(html: string) {
  return convert(html, { selectors: [ { selector: 'a', format: 'inline' } ] })
}

export function renderWelcome(props: WelcomeEmailProps) {
  const markup = renderToStaticMarkup(WelcomeEmail(props))
  const html = inlineCss(wrapDoctype(markup))
  const text = toText(html)
  const subject = `Bem-vindo, ${props.name}`
  return { html, text, subject }
}

export function renderPaymentReceipt(props: PaymentReceiptEmailProps) {
  const markup = renderToStaticMarkup(PaymentReceiptEmail(props))
  const html = inlineCss(wrapDoctype(markup))
  const text = toText(html)
  const subject = 'Pagamento Confirmado'
  return { html, text, subject }
}

export function renderTicketDelivery(props: TicketDeliveryEmailProps) {
  const markup = renderToStaticMarkup(TicketDeliveryEmail(props))
  const html = inlineCss(wrapDoctype(markup))
  const text = toText(html)
  const subject = 'Seus Ingressos'
  return { html, text, subject }
}

export function renderTicketPurchaseConfirmation(props: TicketPurchaseConfirmationProps) {
  const markup = renderToStaticMarkup(TicketPurchaseConfirmationEmail(props))
  const html = inlineCss(wrapDoctype(markup))
  const text = toText(html)
  const subject = `Ingresso – ${props.eventName}`
  return { html, text, subject }
}