import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { QrCode, Calendar, MapPin, Clock, User, Ticket as TicketIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRCode } from '@/components/ui/qr-code';
import QRCodeGenerator from 'qrcode';

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: any;
  formatDate?: (date: string) => string;
  formatCurrency?: (amount: number) => string;
  mapStatus?: (status: string) => string;
  getStatusBadgeClass?: (status: string) => string;
}

const TicketModal: React.FC<TicketModalProps> = ({
  isOpen,
  onClose,
  ticket,
  formatDate = (date) => new Date(date).toLocaleDateString('pt-BR'),
  formatCurrency = (amount) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount / 100),
  mapStatus = (status: string) => status,
  getStatusBadgeClass = (status: string) => 'bg-gray-100 text-gray-800'
}) => {
  if (!ticket) return null;

  const rawEventName = ticket.events?.name || 'Evento não encontrado';
  const eventName = rawEventName === 'Queren Hapuque VII Conferência de Mulheres' ? 'Queren Hapuque VIII Conferência de Mulheres' : rawEventName;
  const eventDate = ticket.events?.date ? formatDate(ticket.events.date) : 'Data não informada';
  const eventTime = ticket.events?.date ? 
    new Date(ticket.events.date).toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    }) : 'Horário não informado';
  const venue = ticket.events?.location || 'Local não informado';
  const attendeeName = ticket.orders?.customer_data?.name || ticket.orders?.customer_name || ticket.customers?.full_name || 'Cliente não encontrado';
  const purchaseDate = ticket.orders?.created_at ? formatDate(ticket.orders.created_at) : 
                      (ticket.created_at ? formatDate(ticket.created_at) : 'Data de compra não informada');
  const ticketType = ticket.ticket_type || 'Tipo não especificado';
  const ticketTypeLabel = (() => {
    const map: Record<string, string> = { batch: 'Lote' };
    const key = String(ticketType).toLowerCase();
    return map[key] ?? ticketType;
  })();
  const ticketNumber = ticket.id || 'N/A';
  // ⭐ NOVO: Exibir número do assento sequencial em vez de "Assento livre"
  const seatInfo = ticket.seat_number || 'Assento pendente';
  const unitPrice = formatCurrency(ticket.price || ticket.total_price || 0);
  
  // ✅ Calcular valor total do pedido (se houver order_id e for diferente do preço unitário)
  const orderTotalAmount = ticket.orders?.total_amount;
  const unitPriceRaw = ticket.price || ticket.total_price || 0;
  const orderTotalRaw = typeof orderTotalAmount === 'string' ? parseFloat(orderTotalAmount) : orderTotalAmount;
  
  // Só mostrar "Valor Total do Pedido" se for diferente do preço unitário (pedido com múltiplos tickets)
  const hasOrder = !!ticket.order_id && orderTotalAmount && orderTotalRaw !== unitPriceRaw;
  const orderTotal = hasOrder ? formatCurrency(orderTotalRaw) : null;
  
  const qrCode = ticket.qr_code;
  
  // Determinar se o QR code é uma URL ou dados para gerar localmente
  const isQrCodeUrl = qrCode && (qrCode.startsWith('http://') || qrCode.startsWith('https://'));
  const qrCodeData = !isQrCodeUrl && qrCode ? qrCode : JSON.stringify({ ticket_id: ticket.id });

  const downloadTicketPDF = async () => {
    const qrDataUrl = isQrCodeUrl
      ? qrCode
      : await QRCodeGenerator.toDataURL(qrCodeData, { width: 200, margin: 1 });

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Ticket ${ticket.id}</title>
          <link rel="stylesheet" href="/src/index.css" />
          <style>
            @page { size: A4; margin: 16mm; }
            body { background: #fff; }
          </style>
        </head>
        <body>
          <div class="max-w-4xl w-[95vw] p-6">
            <div class="border-2 border-border shadow-2xl rounded-lg bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
              <div class="p-6 pb-4 flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <div class="p-3 bg-primary/10 rounded-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8 text-primary"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>
                  </div>
                  <div>
                    <h1 class="text-2xl font-bold text-foreground">${eventName}</h1>
                    <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-primary text-white mt-1">${ticketTypeLabel}</span>
                  </div>
                </div>
                <div class="text-right">
                  <p class="text-sm text-muted-foreground">${hasOrder ? 'Preço Unitário' : 'Preço'}</p>
                  <p class="text-2xl font-bold text-primary">${unitPrice}</p>
                  ${hasOrder && orderTotal ? `
                    <div class="mt-2 pt-2 border-t border-primary/20">
                      <p class="text-xs text-muted-foreground">Valor Total do Pedido</p>
                      <p class="text-lg font-bold text-green-600">${orderTotal}</p>
                    </div>
                  ` : ''}
                </div>
              </div>

              <div class="relative h-8 flex items-center justify-center">
                <div class="absolute left-0 w-8 h-8 bg-background rounded-full -translate-x-4 border-2 border-border"></div>
                <div class="absolute right-0 w-8 h-8 bg-background rounded-full translate-x-4 border-2 border-border"></div>
                <div class="w-full border-t-2 border-dashed border-border"></div>
              </div>

              <div class="p-6 pt-4 grid lg:grid-cols-3 md:grid-cols-1 gap-6">
                <div class="lg:col-span-2 space-y-4">
                  <div class="space-y-3">
                    <div class="flex items-start gap-3">
                      <span class="w-5 h-5 text-primary mt-0.5">📅</span>
                      <div>
                        <p class="text-sm text-muted-foreground">Data do Evento</p>
                        <p class="font-semibold text-foreground">${eventDate}</p>
                      </div>
                    </div>
                    <div class="flex items-start gap-3">
                      <span class="w-5 h-5 text-primary mt-0.5">⏰</span>
                      <div>
                        <p class="text-sm text-muted-foreground">Horário</p>
                        <p class="font-semibold text-foreground">${eventTime}</p>
                      </div>
                    </div>
                    <div class="flex items-start gap-3">
                      <span class="w-5 h-5 text-primary mt-0.5">📍</span>
                      <div>
                        <p class="text-sm text-muted-foreground">Local</p>
                        <p class="font-semibold text-foreground">${venue}</p>
                      </div>
                    </div>
                    <div class="flex items-start gap-3">
                      <span class="w-5 h-5 text-primary mt-0.5">👤</span>
                      <div>
                        <p class="text-sm text-muted-foreground">Participante</p>
                        <p class="font-semibold text-foreground">${attendeeName}</p>
                      </div>
                    </div>
                    <div class="flex items-start gap-3">
                      <span class="w-5 h-5 text-primary mt-0.5">🛒</span>
                      <div>
                        <p class="text-sm text-muted-foreground">Data de Compra</p>
                        <p class="font-semibold text-foreground">${purchaseDate}</p>
                      </div>
                    </div>
                  </div>

                  <hr class="my-4 border-border" />

                  <div class="space-y-2">
                    <div class="flex justify-between items-center">
                      <span class="text-sm text-muted-foreground">Número do Assento</span>
                      <span class="font-mono text-lg font-bold text-primary">${seatInfo}</span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-sm text-muted-foreground">ID do ingresso</span>
                      <span class="font-mono text-xs text-foreground opacity-60">${ticketNumber}</span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-sm text-muted-foreground">Status</span>
                      <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium border ${getStatusBadgeClass(ticket.status)}">${mapStatus(ticket.status)}</span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-sm text-muted-foreground">Quantidade</span>
                      <span class="font-semibold text-foreground">${ticket.quantity || 1}</span>
                    </div>
                    ${ticket.orders?.customer_data?.email || ticket.orders?.customer_email || ticket.customers?.email ? `
                      <div class="flex justify-between items-center">
                        <span class="text-sm text-muted-foreground">Email</span>
                        <span class="font-semibold text-foreground text-sm">${ticket.orders?.customer_data?.email || ticket.orders?.customer_email || ticket.customers?.email}</span>
                      </div>
                    ` : ''}
                    ${ticket.orders?.customer_data?.phone || ticket.orders?.customer_phone || ticket.customers?.phone ? `
                      <div class="flex justify-between items-center">
                        <span class="text-sm text-muted-foreground">Telefone</span>
                        <span class="font-semibold text-foreground">${ticket.orders?.customer_data?.phone || ticket.orders?.customer_phone || ticket.customers?.phone}</span>
                      </div>
                    ` : ''}
                  </div>
                </div>

                <div class="flex flex-col items-center justify-center p-6">
                  <div class="p-4 bg-white rounded-xl shadow-lg border-2 border-gray-100">
                    <img src="${qrDataUrl}" alt="QR Code do Ticket" class="w-[200px] h-[200px]" />
                  </div>
                </div>
              </div>

              <div class="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
                <p class="text-xs text-muted-foreground text-center">
                  Apresente este ingresso (digital ou impresso) junto com um documento válido na entrada do local. 
                  Este ingresso é intransferível e válido apenas para uma entrada.
                </p>
              </div>
            </div>
          </div>
          <script>
            window.onload = () => setTimeout(() => window.print(), 300);
          </script>
        </body>
      </html>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
  };



  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] overflow-y-auto p-6">
        <DialogHeader className="space-y-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg">Detalhes do Ticket</DialogTitle>
              <DialogDescription className="mt-0.5 truncate">
                {eventName}
              </DialogDescription>
            </div>
            <Button
              onClick={downloadTicketPDF}
              className="bg-butterfly-orange text-white hover:bg-butterfly-orange/90 w-full sm:w-auto"
            >
              Baixar PDF
            </Button>
          </div>
        </DialogHeader>
        <Card className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 border-2 border-border shadow-2xl">
            {/* Elementos decorativos nos cantos */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 rounded-br-full -translate-x-16 -translate-y-16" />
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/10 rounded-tl-full translate-x-16 translate-y-16" />
            
            <div className="relative">
              {/* Seção do cabeçalho */}
              <div className="p-6 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-xl">
                      <TicketIcon className="w-8 h-8 text-primary" />
                    </div>
                    <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground break-words">{eventName}</h1>
                      <Badge variant="default" className="mt-1">{ticketTypeLabel}</Badge>
                    </div>
                  </div>
                  <div className="sm:text-right text-left">
                  <p className="text-sm text-muted-foreground">
                    {hasOrder ? 'Preço Unitário' : 'Preço'}
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-primary">{unitPrice}</p>
                  {hasOrder && orderTotal && (
                    <div className="mt-2 pt-2 border-t border-primary/20">
                      <p className="text-xs text-muted-foreground">Valor Total do Pedido</p>
                      <p className="text-lg font-bold text-green-600">{orderTotal}</p>
                    </div>
                  )}
                </div>
              </div>
              </div>

              {/* Linha perfurada */}
              <div className="relative h-8 flex items-center justify-center">
                <div className="absolute left-0 w-8 h-8 bg-background rounded-full -translate-x-4 border-2 border-border" />
                <div className="absolute right-0 w-8 h-8 bg-background rounded-full translate-x-4 border-2 border-border" />
                <div className="w-full border-t-2 border-dashed border-border" />
              </div>

              {/* Conteúdo principal */}
                <div className="p-6 pt-4">
                  <div className="grid lg:grid-cols-3 md:grid-cols-1 gap-6">
                  {/* Seção esquerda - Detalhes do evento */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-muted-foreground">Data do Evento</p>
                          <p className="font-semibold text-foreground">{eventDate}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-muted-foreground">Horário</p>
                          <p className="font-semibold text-foreground">{eventTime}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-muted-foreground">Local</p>
                          <p className="font-semibold text-foreground">{venue}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <User className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-muted-foreground">Participante</p>
                          <p className="font-semibold text-foreground">{attendeeName}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-muted-foreground">Data de Compra</p>
                          <p className="font-semibold text-foreground">{purchaseDate}</p>
                        </div>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Número do Assento</span>
                        <span className="font-mono text-lg font-bold text-primary">{seatInfo}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">ID do ingresso</span>
                        <span className="font-mono text-xs text-foreground opacity-60">{ticketNumber}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge className={getStatusBadgeClass(ticket.status)}>
                          {mapStatus(ticket.status)}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Quantidade</span>
                        <span className="font-semibold text-foreground">{ticket.quantity || 1}</span>
                      </div>
                      {(ticket.orders?.customer_data?.email || ticket.orders?.customer_email || ticket.customers?.email) && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Email</span>
                          <span className="font-semibold text-foreground text-sm">{ticket.orders?.customer_data?.email || ticket.orders?.customer_email || ticket.customers?.email}</span>
                        </div>
                      )}
                      {(ticket.orders?.customer_data?.phone || ticket.orders?.customer_phone || ticket.customers?.phone) && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Telefone</span>
                          <span className="font-semibold text-foreground">{ticket.orders?.customer_data?.phone || ticket.orders?.customer_phone || ticket.customers?.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Seção direita - QR Code */}
                  <div className="flex flex-col items-center justify-center p-6">
                    {isQrCodeUrl ? (
                      // Se for URL, renderizar como imagem
                      <div className="p-4 bg-white rounded-xl shadow-lg border-2 border-gray-100">
                        <img 
                          src={qrCode} 
                          alt="QR Code do Ticket" 
                          className="w-[200px] h-[200px]"
                        />
                      </div>
                    ) : (
                      // Se for dados ou null, gerar QR code localmente com fallback
                      <div className="p-4 bg-white rounded-xl shadow-lg border-2 border-gray-100">
                        <QRCode
                          value={qrCodeData}
                          size={200}
                          level="H"
                          includeMargin={true}
                          fgColor="#000000"
                          bgColor="#ffffff"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Aviso do rodapé */}
                <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground text-center">
                    Apresente este ingresso (digital ou impresso) junto com um documento válido na entrada do local. 
                    Este ingresso é intransferível e válido apenas para uma entrada.
                  </p>
                </div>
              </div>
            </div>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default TicketModal;
