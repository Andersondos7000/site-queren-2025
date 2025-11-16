
import React, { useState, useRef } from 'react';
import { FormField, FormItem, FormControl, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from 'react-router-dom';
import { UseFormReturn } from 'react-hook-form';
import { Button } from "@/components/ui/button";
import { ArrowRight } from 'lucide-react';
import { validarCpf, limparCpf } from "@/utils/cpfValidator";
import { validarCnpj, limparCnpj } from "@/utils/cnpjValidator";



interface TermsSectionProps {
  form: UseFormReturn<any>;
  total: number;
  isProcessing?: boolean;
  onSubmit?: (data: any) => void;
  clearCart?: () => Promise<void>; // Nova prop para limpar carrinho
  orderData?: {
    customer: {
      name: string;
      email: string;
      phone: string;
      document: string;
    };
    amount: number;
    description: string;
    items: Array<{
      title: string;
      quantity: number;
      unit_price: number;
    }>;
  };
}

const TermsSection: React.FC<TermsSectionProps> = ({ form, total, isProcessing = false, onSubmit, clearCart, orderData }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);
  const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Monitorar valores de CPF e CEP
  const cpf = form.watch('cpf');
  const zipCode = form.watch('zipCode');
  const personType = form.watch('personType');

  // Função para verificar se CPF/CNPJ está válido
  const isCpfValid = () => {
    if (!cpf || cpf.trim() === '') {
      return false;
    }
    
    if (personType === 'juridica') {
      const cnpjLimpo = limparCnpj(cpf);
      return cnpjLimpo.length === 14 && validarCnpj(cpf);
    } else {
      const cpfLimpo = limparCpf(cpf);
      return cpfLimpo.length === 11 && validarCpf(cpf);
    }
  };

  // Função para verificar se CEP está válido (pelo menos 8 dígitos)
  const isZipCodeValid = () => {
    if (!zipCode || zipCode.trim() === '') {
      return false;
    }
    // Remove caracteres não numéricos e verifica se tem pelo menos 8 dígitos
    const zipCodeLimpo = zipCode.replace(/[^\d]/g, '');
    return zipCodeLimpo.length >= 8;
  };

  const handleMakeOrder = async () => {
    const now = Date.now();
    
    // Proteção contra duplo clique - debounce de 2 segundos
    if (now - lastSubmitTime < 2000) {
      console.log('🚫 Tentativa de duplo clique bloqueada');
      return;
    }

    // Proteção contra múltiplas submissões
    if (isSubmitting || isProcessing || orderData) {
      console.log('🚫 Submissão já em andamento');
      return;
    }

    // Limpar timeout anterior se existir
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
    }

    setIsSubmitting(true);
    setLastSubmitTime(now);
    
    console.log('🚀 Iniciando submissão do pedido...');
    
    try {
      // Para AbacatePay, apenas submete o formulário se ainda não foi submetido
      if (!orderData && onSubmit) {
        await form.handleSubmit(onSubmit)();
      }
    } catch (error) {
      console.error('❌ Erro na submissão:', error);
      // Em caso de erro, permitir nova tentativa após 1 segundo
      setLastSubmitTime(now - 1000);
    } finally {
      // Reset após 5 segundos para permitir nova tentativa em caso de erro
      submitTimeoutRef.current = setTimeout(() => {
        setIsSubmitting(false);
        console.log('✅ Estado de submissão resetado');
      }, 5000);
    }
  };

  // Cleanup do timeout quando componente desmonta
  React.useEffect(() => {
    return () => {
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Card>
      <CardContent className="pt-6">
        <FormField
          control={form.control}
          name="terms"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-describedby="terms-description"
                  aria-required="true"
                  id="terms-checkbox"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel htmlFor="terms-checkbox" id="terms-description">
                  Eu li e concordo com os <Link to="/termos" className="text-butterfly-orange hover:underline" aria-label="Abrir termos de serviço em nova página">Termos de Serviço</Link> e <Link to="/privacidade" className="text-butterfly-orange hover:underline" aria-label="Abrir política de privacidade em nova página">Política de Privacidade</Link>
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />


        
        <div className="mt-6">
          <Button
            type="button"
            onClick={handleMakeOrder}
            disabled={isProcessing || isSubmitting || !form.watch('terms') || orderData || !isCpfValid() || !isZipCodeValid()}
            className="w-full bg-butterfly-orange hover:bg-butterfly-orange/90 text-white py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            aria-describedby="order-button-description"
          >
            {(isProcessing || isSubmitting) ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {isSubmitting ? 'Enviando pedido...' : 'Processando...'}
              </div>
            ) : orderData ? (
              <div className="flex items-center gap-2">
                <span>Pedido criado - Aguardando pagamento</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>Finalizar Pedido - R$ {total.toFixed(2)}</span>
                <ArrowRight className="h-5 w-5" />
              </div>
            )}
          </Button>
          
          {/* Indicador visual adicional */}
          {(isProcessing || isSubmitting) && (
            <p className="text-sm text-gray-500 text-center mt-2">
              ⚠️ Não feche esta página durante o processamento
            </p>
          )}
          
          <p className="text-xs text-gray-400 text-center mt-2" id="order-button-description">
            Ao finalizar, você será redirecionado para o pagamento PIX
          </p>
        </div>



      </CardContent>
    </Card>
  );
};

export default TermsSection;
