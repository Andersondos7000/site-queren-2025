import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Copy, CreditCard } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface PaymentSectionProps {
  paymentData?: {
    qrCode?: string;
    pixCode?: string;
    paymentUrl?: string;
  } | null;
  isLoading?: boolean;
  isProcessing?: boolean;
}

const PaymentSection: React.FC<PaymentSectionProps> = ({
  paymentData,
  isLoading = false,
  isProcessing = false
}) => {
  const { toast } = useToast();

  const copyPixCode = () => {
    if (paymentData?.pixCode) {
      navigator.clipboard.writeText(paymentData.pixCode);
      toast({
        title: "Código PIX copiado!",
        description: "O código PIX foi copiado para a área de transferência.",
      });
    }
  };

  if (!paymentData && !isProcessing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">
            Complete o formulário acima para gerar o pagamento PIX
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isProcessing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Processando Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-butterfly-orange"></div>
            <span className="ml-3 text-gray-600">Gerando pagamento PIX...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Pagamento PIX
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {paymentData?.qrCode && (
          <div className="text-center">
            <div className="bg-white p-4 rounded-lg border inline-block">
              <img 
                src={paymentData.qrCode} 
                alt="QR Code PIX" 
                className="w-48 h-48 mx-auto"
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Escaneie o QR Code com o app do seu banco
            </p>
          </div>
        )}
        
        {paymentData?.pixCode && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Código PIX:</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyPixCode}
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Copiar
              </Button>
            </div>
            <div className="bg-gray-50 p-3 rounded border text-xs font-mono break-all">
              {paymentData.pixCode}
            </div>
          </div>
        )}
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Como pagar:</h4>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. Abra o app do seu banco</li>
            <li>2. Escolha a opção PIX</li>
            <li>3. Escaneie o QR Code ou cole o código</li>
            <li>4. Confirme o pagamento</li>
          </ol>
        </div>
        
        <div className="text-center text-sm text-gray-500">
          O pagamento será confirmado automaticamente após a aprovação.
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentSection;