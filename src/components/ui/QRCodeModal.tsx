import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { QrCode, Calendar, MapPin, Clock, User, Ticket as TicketIcon, X, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRCode } from '@/components/ui/qr-code';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  qrValue: string;
  qrSize?: number;
  showDownload?: boolean;
  showShare?: boolean;
  additionalInfo?: {
    label: string;
    value: string;
    icon?: React.ReactNode;
  }[];
  footerText?: string;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  title = "QR Code",
  subtitle = "Escaneie o código abaixo",
  qrValue,
  qrSize = 200,
  showDownload = true,
  showShare = true,
  additionalInfo = [],
  footerText = "Mantenha este código seguro e não compartilhe com terceiros."
}) => {
  const handleDownload = () => {
    // Implementar download do QR code
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = 'qrcode.png';
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  const handleShare = async () => {
    // Implementar compartilhamento
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: subtitle,
          url: qrValue
        });
      } catch (error) {
        console.log('Erro ao compartilhar:', error);
      }
    } else {
      // Fallback: copiar para clipboard
      navigator.clipboard.writeText(qrValue);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[95vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <Card className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 border-2 border-border shadow-2xl">
          {/* Elementos decorativos nos cantos */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 rounded-br-full -translate-x-16 -translate-y-16" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/10 rounded-tl-full translate-x-16 translate-y-16" />
          
          <div className="relative">
            {/* Seção do cabeçalho */}
            <div className="p-6 pb-4">
              <div className="flex items-center justify-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <QrCode className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <h1 className="text-2xl font-bold text-foreground">{title}</h1>
                    <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
                  </div>
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
              <div className="flex flex-col items-center space-y-6">
                
                {/* Seção do QR Code - Centralizada e destacada */}
                <div className="flex flex-col items-center justify-center space-y-4 p-6 bg-background/50 rounded-xl border border-border w-full max-w-md">
                  {qrValue ? (
                    <>
                      <div className="p-4 bg-white rounded-xl shadow-lg border-2 border-gray-100">
                        <QRCode
                          value={qrValue}
                          size={qrSize}
                          level="M"
                          includeMargin={true}
                          className="rounded-lg"
                        />
                      </div>
                      <div className="text-center space-y-1">
                        <div className="flex items-center justify-center gap-2 text-primary">
                          <QrCode className="w-4 h-4" />
                          <span className="text-sm font-medium">Escaneie com seu dispositivo</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <QrCode className="w-16 h-16 mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium">QR Code não disponível</p>
                      <p className="text-xs">Verifique o valor fornecido</p>
                    </div>
                  )}
                </div>

                {/* Informações adicionais */}
                {additionalInfo.length > 0 && (
                  <>
                    <Separator className="w-full" />
                    <div className="w-full space-y-3">
                      {additionalInfo.map((info, index) => (
                        <div key={index} className="flex items-start gap-3">
                          {info.icon && (
                            <div className="w-5 h-5 text-primary mt-0.5 flex-shrink-0">
                              {info.icon}
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="text-sm text-muted-foreground">{info.label}</p>
                            <p className="font-semibold text-foreground">{info.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Botões de ação */}
                {(showDownload || showShare) && (
                  <>
                    <Separator className="w-full" />
                    <div className="flex gap-3 w-full justify-center">
                      {showDownload && (
                        <Button
                          variant="outline"
                          onClick={handleDownload}
                          className="flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Baixar
                        </Button>
                      )}
                      {showShare && (
                        <Button
                          variant="outline"
                          onClick={handleShare}
                          className="flex items-center gap-2"
                        >
                          <Share2 className="w-4 h-4" />
                          Compartilhar
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Aviso do rodapé */}
            {footerText && (
              <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border mx-6 mb-6">
                <p className="text-xs text-muted-foreground text-center">
                  {footerText}
                </p>
              </div>
            )}
          </div>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default QRCodeModal;