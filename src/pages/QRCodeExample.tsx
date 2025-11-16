import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import QRCodeModal from '@/components/ui/QRCodeModal';
import { Calendar, MapPin, User, Ticket as TicketIcon } from 'lucide-react';

const QRCodeExample: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [qrValue, setQrValue] = useState('https://querenhapuque.com/evento/show-rock-nacional');
  const [modalType, setModalType] = useState<'simple' | 'ticket' | 'custom'>('simple');

  const handleOpenModal = (type: 'simple' | 'ticket' | 'custom') => {
    setModalType(type);
    setIsModalOpen(true);
  };

  const getModalProps = () => {
    switch (modalType) {
      case 'simple':
        return {
          title: "QR Code Simples",
          subtitle: "Escaneie para acessar o link",
          qrValue: qrValue,
          additionalInfo: [],
          footerText: "Este é um exemplo de QR code simples."
        };
      
      case 'ticket':
        return {
          title: "Ingresso Digital",
          subtitle: "Show de Rock Nacional 2024",
          qrValue: JSON.stringify({
            ticket_id: "TICKET-2024-001",
            event_id: "show-rock-nacional",
            customer_id: "customer-123",
            timestamp: new Date().toISOString(),
            validation_url: "https://querenhapuque.com/validate-ticket/TICKET-2024-001"
          }),
          qrSize: 180,
          additionalInfo: [
            {
              label: "Data do Evento",
              value: "20 de Julho, 2024 - 20:00",
              icon: <Calendar className="w-5 h-5" />
            },
            {
              label: "Local",
              value: "Central Park Amphitheater",
              icon: <MapPin className="w-5 h-5" />
            },
            {
              label: "Participante",
              value: "João Silva",
              icon: <User className="w-5 h-5" />
            },
            {
              label: "Número do Ticket",
              value: "TICKET-2024-001",
              icon: <TicketIcon className="w-5 h-5" />
            }
          ],
          footerText: "Apresente este ingresso (digital ou impresso) junto com um documento válido na entrada do local. Este ingresso é intransferível e válido apenas para uma entrada."
        };
      
      case 'custom':
        return {
          title: "QR Code Personalizado",
          subtitle: "Configuração customizada",
          qrValue: qrValue,
          qrSize: 160,
          showDownload: true,
          showShare: true,
          additionalInfo: [
            {
              label: "Tipo",
              value: "Acesso VIP",
              icon: <TicketIcon className="w-5 h-5" />
            },
            {
              label: "Válido até",
              value: "31/12/2024",
              icon: <Calendar className="w-5 h-5" />
            }
          ],
          footerText: "QR Code personalizado com informações específicas."
        };
      
      default:
        return {
          title: "QR Code Padrão",
          subtitle: "Configuração padrão",
          qrValue: qrValue,
          additionalInfo: [],
          footerText: "QR Code com configuração padrão."
        };
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Exemplos de QR Code Modal</h1>
        <p className="text-muted-foreground">
          Demonstração do componente QRCodeModal com diferentes configurações
        </p>
      </div>

      {/* Configuração do QR Value */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração</CardTitle>
          <CardDescription>
            Personalize o valor do QR Code para os exemplos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qr-value">Valor do QR Code</Label>
            <Input
              id="qr-value"
              value={qrValue}
              onChange={(e) => setQrValue(e.target.value)}
              placeholder="Digite o valor para o QR Code"
            />
          </div>
        </CardContent>
      </Card>

      {/* Exemplos */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>QR Code Simples</CardTitle>
            <CardDescription>
              Modal básico com QR code e informações mínimas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => handleOpenModal('simple')}
              className="w-full"
            >
              Abrir Modal Simples
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingresso Digital</CardTitle>
            <CardDescription>
              Modal completo para ingressos de eventos com todas as informações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => handleOpenModal('ticket')}
              className="w-full"
              variant="secondary"
            >
              Abrir Ingresso Digital
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>QR Code Personalizado</CardTitle>
            <CardDescription>
              Modal com configurações personalizadas e informações adicionais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => handleOpenModal('custom')}
              className="w-full"
              variant="outline"
            >
              Abrir Personalizado
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Características do Componente */}
      <Card>
        <CardHeader>
          <CardTitle>Características do QRCodeModal</CardTitle>
          <CardDescription>
            Principais funcionalidades e recursos do componente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold">Design Elegante</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Gradiente de fundo sutil</li>
                <li>• Elementos decorativos nos cantos</li>
                <li>• Linha perfurada estilizada</li>
                <li>• Sombras e bordas suaves</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Funcionalidades</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• QR Code gerado localmente</li>
                <li>• Informações adicionais customizáveis</li>
                <li>• Botões de download e compartilhamento</li>
                <li>• Responsivo e acessível</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal */}
      <QRCodeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        {...getModalProps()}
      />
    </div>
  );
};

export default QRCodeExample;