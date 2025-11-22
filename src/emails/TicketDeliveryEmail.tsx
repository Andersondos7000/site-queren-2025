import React from 'react'

export type TicketDeliveryEmailProps = {
  orderId: string
  ticketsUrl: string
}

export default function TicketDeliveryEmail({ orderId, ticketsUrl }: TicketDeliveryEmailProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>Seus Ingressos</title>
        <style>{`
          .container{max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #eee;border-radius:8px}
          .header{padding:16px;border-bottom:1px solid #eee}
          .title{margin:0;color:#111}
          .body{padding:16px;color:#333;font-family:Arial,sans-serif}
          .btn{display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:6px}
          .footer{padding:16px;border-top:1px solid #eee;color:#666;font-size:12px}
        `}</style>
      </head>
      <body className="body">
        <div className="container">
          <div className="header">
            <h2 className="title">Seus Ingressos</h2>
          </div>
          <div className="body">
            <p>Os ingressos do seu pedido estão disponíveis.</p>
            <p>Pedido: <strong>{orderId}</strong></p>
            <p>
              <a href={ticketsUrl} className="btn">Acessar ingressos</a>
            </p>
          </div>
          <div className="footer">Queren Hapuque</div>
        </div>
      </body>
    </html>
  )
}