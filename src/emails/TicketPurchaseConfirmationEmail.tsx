import React from 'react'

export type TicketPurchaseConfirmationProps = {
  eventName: string
  eventDate: string
  eventTime?: string
  venue?: string
  attendeeName: string
  email?: string
  phone?: string
  ticketTypeLabel?: string
  unitPrice?: string
  orderTotal?: string
  purchaseDate?: string
  seatInfo?: string
  ticketNumber: string
  status?: string
  quantity?: number
  qrCodeUrl: string
  manageUrl?: string
  ticketBadge?: string
}

export default function TicketPurchaseConfirmationEmail(props: TicketPurchaseConfirmationProps) {
  const {
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
    purchaseDate,
    seatInfo,
    ticketNumber,
    status,
    quantity = 1,
    qrCodeUrl,
    manageUrl,
    ticketBadge
  } = props

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>Detalhes do Ticket</title>
        <style>{`
          .container{max-width:700px;margin:0 auto;background:#ffffff;border:1px solid #eee;border-radius:12px}
          .header{padding:16px 20px;border-bottom:1px solid #eee;background:#fff;border-top-left-radius:12px;border-top-right-radius:12px}
          .title{margin:0;color:#0f172a;font-size:20px}
          .badge{display:inline-block;font-size:12px;color:#fff;background:#f97316;border-radius:999px;padding:4px 8px;margin-left:8px}
          .pricebox{font-family:Arial,sans-serif;text-align:right}
          .pricelabel{color:#64748b;font-size:12px;margin:0}
          .price{color:#16a34a;font-weight:bold;font-size:16px;margin:4px 0 0}
          .section{padding:12px 20px;color:#334155;font-family:Arial,sans-serif}
          .label{color:#64748b;font-size:12px;margin:0}
          .value{margin:2px 0 12px;font-size:14px;color:#0f172a}
          .divider{border-top:1px solid #e2e8f0;margin:8px 0}
          .seat{color:#f97316;font-weight:bold}
          .status{display:inline-block;background:#22c55e;color:#fff;font-size:12px;padding:4px 8px;border-radius:999px}
          .qrwrap{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px}
          .qrimg{width:200px;height:200px}
          .footer{padding:12px 20px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;border-bottom-left-radius:12px;border-bottom-right-radius:12px}
          .btn{display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:6px}
        `}</style>
      </head>
      <body style={{ background: '#f1f5f9', padding: 16 }}>
        <div className="container">
          <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td className="header">
                  <table width="100%" style={{ borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ verticalAlign: 'middle' }}>
                          <span style={{ display: 'inline-block', width: 28, height: 28, background: '#fde68a', borderRadius: 8, marginRight: 8 }}></span>
                          <span className="title">{eventName}</span>
                          {ticketBadge && (<span className="badge">{ticketBadge}</span>)}
                        </td>
                        <td className="pricebox" style={{ width: 220 }}>
                          <p className="pricelabel">Preço Unitário</p>
                          <p className="price">{unitPrice || '-'}</p>
                          <p className="pricelabel" style={{ marginTop: 8 }}>Valor Total do Pedido</p>
                          <p className="price">{orderTotal || unitPrice || '-'}</p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              <tr>
                <td className="section">
                  <table width="100%" style={{ borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ width: '65%', verticalAlign: 'top' }}>
                          <p className="label">Data do Evento</p>
                          <p className="value">{eventDate}{eventTime ? `, ${eventTime}` : ''}</p>
                          <p className="label">Horário</p>
                          <p className="value">{eventTime || '-'}</p>
                          <p className="label">Local</p>
                          <p className="value">{venue || 'A definir'}</p>
                          <p className="label">Participante</p>
                          <p className="value">{attendeeName}</p>
                          {purchaseDate && (<>
                            <p className="label">Data de Compra</p>
                            <p className="value">{purchaseDate}</p>
                          </>)}
                          <div className="divider" />
                          <p className="label">Número do Assento</p>
                          <p className="value seat">{seatInfo || 'Pendente'}</p>
                          <p className="label">ID do ingresso</p>
                          <p className="value">{ticketNumber}</p>
                          <p className="label">Status</p>
                          <p className="value"><span className="status">{status || 'Ativo'}</span></p>
                          <p className="label">Quantidade</p>
                          <p className="value">{quantity}</p>
                          {email && (<>
                            <p className="label">Email</p>
                            <p className="value">{email}</p>
                          </>)}
                          {phone && (<>
                            <p className="label">Telefone</p>
                            <p className="value">{phone}</p>
                          </>)}
                        </td>
                        <td style={{ width: '35%', verticalAlign: 'top' }}>
                          <div className="qrwrap">
                            <img className="qrimg" src={qrCodeUrl} alt="QR Code do Ticket" />
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              {manageUrl && (
                <tr>
                  <td className="section" align="center">
                    <a href={manageUrl} className="btn">Acessar meus ingressos</a>
                  </td>
                </tr>
              )}

              <tr>
                <td className="footer">
                  Apresente este ingresso (digital ou impresso) junto com um documento válido na entrada do local. Este ingresso é intransferível e válido apenas para uma entrada.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  )
}