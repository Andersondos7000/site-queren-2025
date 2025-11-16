import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import CustomerInformation from '@/components/checkout/CustomerInformation';
import OrderSummary from '@/components/checkout/OrderSummary';
import TermsSection from '@/components/checkout/TermsSection';
import AdditionalNotes from '@/components/checkout/AdditionalNotes';
import PixPaymentModal from '@/components/payment/PixPaymentModal';
import { PaymentSuccessModal } from '@/components/payment/PaymentSuccessModal';
import { isCartProduct, isCartTicket } from '@/lib/cart-utils';
import { validarCpf, limparCpf } from '@/utils/cpfValidator';
import { validarCnpj, limparCnpj } from '@/utils/cnpjValidator';
import type { PixPaymentModalProps } from '@/types/unified-types';

// Schema de validação do formulário
const checkoutFormSchema = z.object({
  firstName: z.string().min(2, { message: "Nome deve ter pelo menos 2 caracteres" }),
  lastName: z.string().min(2, { message: "Sobrenome deve ter pelo menos 2 caracteres" }),
  email: z.string().email({ message: "Email inválido" }),
  personType: z.enum(["fisica", "juridica"]),
  cpf: z.string().min(1, { message: "CPF/CNPJ é obrigatório" }),
  country: z.string().min(2, { message: "País é obrigatório" }),
  zipCode: z.string().min(8, { message: "CEP deve ter pelo menos 8 caracteres" }),
  address: z.string().min(5, { message: "Endereço deve ter pelo menos 5 caracteres" }),
  number: z.string().min(1, { message: "Número é obrigatório" }),
  neighborhood: z.string().optional(),
  city: z.string().min(2, { message: "Cidade é obrigatória" }),
  state: z.string().min(2, { message: "Estado é obrigatório" }),
  phone: z.string().min(10, { message: "Telefone é obrigatório (mínimo 10 dígitos)" }),
  additionalNotes: z.string().optional(),
  terms: z.boolean().refine((val) => val === true, {
    message: "Você deve concordar com os termos de serviço",
  }),
}).superRefine((data, ctx) => {
  if (data.personType === 'fisica') {
    const cpfLimpo = limparCpf(data.cpf);
    if (cpfLimpo.length !== 11) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cpf'], message: 'CPF deve ter 11 dígitos' });
      return;
    }
    if (!validarCpf(data.cpf)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cpf'], message: 'CPF inválido' });
    }
  } else {
    const cnpjLimpo = limparCnpj(data.cpf);
    if (cnpjLimpo.length !== 14) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cpf'], message: 'CNPJ deve ter 14 dígitos' });
      return;
    }
    if (!validarCnpj(data.cpf)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cpf'], message: 'CNPJ inválido' });
    }
  }
});

type CheckoutFormData = z.infer<typeof checkoutFormSchema>;

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { items, subtotal, total, isLoading, clearCart } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [orderData, setOrderData] = useState<PixPaymentModalProps['orderData'] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: user?.email || '',
      personType: 'fisica',
      cpf: '',
      country: 'Brasil',
      zipCode: '',
      address: '',
      number: '',
      neighborhood: '',
      city: '',
      state: '',
      phone: '',
      additionalNotes: '',
      terms: false,
    },
  });

  // ✅ CORREÇÃO: Não redirecionar automaticamente - mostrar mensagem apenas quando realmente estiver vazio
  // O componente já tem uma tela de "Carrinho vazio" que será exibida quando items.length === 0
  // Removendo o redirecionamento automático para evitar redirecionar antes dos itens serem carregados

  // Preencher dados do usuário se estiver logado
  useEffect(() => {
    if (user?.email) {
      form.setValue('email', user.email);
    }
  }, [user, form]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const onSubmit = async (data: CheckoutFormData) => {
    if (items.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione itens ao carrinho antes de finalizar a compra.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Separar produtos e ingressos
      const products = items.filter(isCartProduct);
      const tickets = items.filter(isCartTicket);

      // Preparar items para o pedido no formato esperado pelo modal/hook
      const orderItems = items.map(item => {
        if (isCartProduct(item)) {
          return {
            title: item.name,
            quantity: item.quantity,
            unit_price: Math.round(item.price * 100), // ✅ CORREÇÃO: converter para centavos
            product_id: item.product_id,
            size: item.size,
          };
        } else if (isCartTicket(item)) {
          return {
            title: `${item.event_title || 'Evento'} - ${item.ticket_type || 'Ingresso'}`,
            quantity: item.quantity,
            unit_price: Math.round(item.price * 100), // ✅ CORREÇÃO: converter para centavos
            event_id: item.event_id,
            ticket_type: item.ticket_type || 'individual',
          };
        }
        return null;
      }).filter(Boolean) as Array<{
        title: string;
        quantity: number;
        unit_price: number;
        product_id?: string;
        size?: string;
        event_id?: string;
        ticket_type?: string;
      }>;

      // Preparar dados do pedido para o modal de pagamento
      const paymentOrderData: PixPaymentModalProps['orderData'] = {
        customer: {
          name: `${data.firstName} ${data.lastName}`.trim() || 'Cliente',
          email: data.email || '',
          phone: data.phone || '',
          document: (data.personType === 'juridica' ? limparCnpj(data.cpf) : limparCpf(data.cpf)) || '',
        },
        amount: Math.round(total * 100), // em centavos (doc AbacatePay)
        description: `Pedido com ${items.length} item(ns)`,
        items: orderItems,
      };

      setOrderData(paymentOrderData);
      setIsPaymentModalOpen(true);
    } catch (error) {
      console.error('Erro ao processar pedido:', error);
      toast({
        title: "Erro",
        description: "Não foi possível processar o pedido. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentSuccess = async (paymentData: any) => {
    console.log('✅ Pagamento confirmado! Iniciando processo de sucesso...');
    console.log('✅ Estado atual - isPaymentModalOpen:', isPaymentModalOpen, 'isSuccessModalOpen:', isSuccessModalOpen);
    
    // ✅ CORREÇÃO: Fechar modal de pagamento PRIMEIRO
    setIsPaymentModalOpen(false);
    setOrderData(null);
    console.log('✅ Modal de pagamento fechado');
    
    // Limpar carrinho após pagamento confirmado
    if (clearCart) {
      try {
        await clearCart();
        console.log('✅ Carrinho limpo com sucesso');
      } catch (error) {
        console.error('Erro ao limpar carrinho:', error);
      }
    }
    
    // ✅ CORREÇÃO: Usar uma função de callback para garantir que o estado seja atualizado corretamente
    // Aguardar um pouco mais para garantir que o modal de pagamento foi completamente desmontado
    setTimeout(() => {
      console.log('✅ Abrindo modal de sucesso...');
      // ✅ CORREÇÃO: Usar função de atualização de estado para garantir que o valor seja atualizado
      setIsSuccessModalOpen((prev) => {
        console.log('✅ setIsSuccessModalOpen chamado - prev:', prev, 'novo valor: true');
        return true;
      });
      
      // Verificar se o estado foi atualizado após um pequeno delay
      setTimeout(() => {
        // ✅ CORREÇÃO: Não podemos ler o estado diretamente aqui, mas podemos verificar no próximo render
        console.log('✅ Verificação: modal de sucesso deve estar aberto agora');
      }, 100);
    }, 800); // Aumentado para 800ms para garantir fechamento completo do modal de pagamento
  };

  const handleSuccessModalClose = () => {
    setIsSuccessModalOpen(false);
    
    // Redirecionar para a home
    navigate('/', { replace: true });
    
    // Rolar para o topo após um delay para garantir que a navegação foi concluída
    // Usar requestAnimationFrame para garantir que a página foi renderizada
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Fallback: também tentar scroll após mais tempo caso o smooth não funcione
        setTimeout(() => {
          window.scrollTo(0, 0);
        }, 300);
      }, 50);
    });
  };

  const handlePaymentError = (error: any) => {
    console.error('Erro no pagamento:', error);
    toast({
      title: "Erro no pagamento",
      description: error?.message || "Não foi possível processar o pagamento.",
      variant: "destructive",
    });
  };

  const handlePaymentPending = (paymentData: any) => {
    console.log('Pagamento pendente:', paymentData);
    toast({
      title: "Aguardando pagamento",
      description: "Aguarde a confirmação do pagamento PIX.",
    });
  };

  const handleCloseModal = () => {
    setIsPaymentModalOpen(false);
    setOrderData(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-butterfly-orange mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando checkout...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Carrinho vazio</h2>
            <p className="text-gray-600 mb-6">
              Adicione itens ao carrinho antes de finalizar a compra.
            </p>
            <button
              onClick={() => navigate('/carrinho')}
              className="bg-butterfly-orange hover:bg-butterfly-orange/90 text-white px-6 py-2 rounded-lg"
            >
              Voltar ao Carrinho
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="flex-1 bg-gray-50">
        <div className="container mx-auto px-4 py-12">
          <h1 className="font-display text-3xl font-bold mb-8">Checkout</h1>
          
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Coluna esquerda - Formulário */}
                <div className="lg:col-span-2 space-y-6">
                  <CustomerInformation form={form} />
                  <AdditionalNotes form={form} />
                  <TermsSection 
                    form={form}
                    total={total}
                    isProcessing={isProcessing}
                    onSubmit={onSubmit}
                  />
                </div>
                <OrderSummary cartItems={items as any} subtotal={subtotal} total={total} />
              </div>
            </form>
          </FormProvider>
          <PixPaymentModal
            isOpen={isPaymentModalOpen}
            onClose={handleCloseModal}
            orderData={orderData}
            clearCart={clearCart}
            onPaymentSuccess={handlePaymentSuccess}
            onPaymentError={handlePaymentError}
            onPaymentPending={handlePaymentPending}
          />
          <PaymentSuccessModal
            isOpen={isSuccessModalOpen}
            onClose={handleSuccessModalClose}
            duration={4000}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default Checkout;
