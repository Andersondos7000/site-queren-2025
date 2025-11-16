import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface Customer {
  name: string;
  email: string;
  phone?: string;
  document: string; // CPF
}

interface OrderItem {
  title: string;
  quantity: number;
  unit_price: number;
}

interface CreateChargeData {
  customer: Customer;
  amount: number;
  description: string;
  items: OrderItem[];
}

interface PixData {
  qr_code: string;
  qr_code_base64?: string;
  expires_at?: string;
  id?: string;
}

interface Charge {
  id: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  amount: number;
  description: string;
  pix?: PixData;
  created_at: string;
  expires_at?: string;
}

export const useAbacatePay = () => {
  const [charge, setCharge] = useState<Charge | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const { toast } = useToast();

  // Timer para contagem regressiva
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (charge?.status === 'pending' && charge?.expires_at) {
      interval = setInterval(() => {
        const expiresAt = new Date(charge.expires_at!).getTime();
        const now = new Date().getTime();
        const difference = expiresAt - now;
        
        if (difference > 0) {
          setTimeLeft(Math.floor(difference / 1000));
        } else {
          setTimeLeft(0);
          setCharge(prev => prev ? { ...prev, status: 'expired' } : null);
        }
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [charge?.status, charge?.expires_at]);

  const createCharge = useCallback(async (data: CreateChargeData) => {
    setIsLoading(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const baseKey = `${data.customer.email}:${data.amount}:${data.items.map(i=>`${i.title}:${i.quantity}:${i.unit_price}`).join('|')}`;
      const idempotencyKey = btoa(unescape(encodeURIComponent(baseKey))).slice(0,32);
      const response = await fetch(`${supabaseUrl}/functions/v1/criar-pix-qrcode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'x-idempotency-key': idempotencyKey
        },
        body: JSON.stringify({
          amount: data.amount,
          expiresIn: 1800,
          description: data.description,
          customer: {
            name: data.customer.name,
            email: data.customer.email,
            cellphone: data.customer.phone || '',
            taxId: data.customer.document
          },
          // ✅ CORREÇÃO: Enviar items para a Edge Function poder criar o pedido
          items: data.items
        }),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          errorData = {};
        }
        
        // Processar estrutura de erro da Edge Function
        let errorMessage = '';
        if (errorData.error && errorData.details && Array.isArray(errorData.details)) {
          // Estrutura: { error: "Dados inválidos", details: ["CPF do cliente é inválido"] }
          errorMessage = `${errorData.error}: ${errorData.details.join(', ')}`;
        } else if (errorData.message) {
          // Estrutura padrão: { message: "..." }
          errorMessage = errorData.message;
        } else if (errorData.error) {
          // Apenas campo error: { error: "..." }
          errorMessage = errorData.error;
        } else {
          // Fallback para erro HTTP genérico
          errorMessage = 'Erro ao criar cobrança';
        }
        
        throw new Error(errorMessage);
      }

      const raw = await response.json();
      let dataNode = raw?.data ?? raw;
      let brCode = dataNode?.brCode || '';
      let brCodeBase64 = dataNode?.brCodeBase64;
      const expiresAt = dataNode?.expiresAt;
      const statusRaw = (dataNode?.status || 'PENDING').toString().toLowerCase();

      // Fallback: se não há brCode, consultar status para obter QR
      if (!brCode && dataNode?.id) {
        const checkUrl = `${supabaseUrl}/functions/v1/consultar-cobranca?id=${encodeURIComponent(dataNode.id)}`;
        const checkRes = await fetch(checkUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Accept': 'application/json'
          }
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          const d = checkData?.data ?? checkData;
          dataNode = d || dataNode;
          brCode = d?.brCode || d?.pix?.qr_code || brCode;
          brCodeBase64 = d?.brCodeBase64 || d?.pix?.qr_code_base64 || brCodeBase64;
        }
      }

      const newCharge: Charge = {
        id: dataNode?.id || 'pix_char_mock',
        status: statusRaw === 'paid' ? 'paid' : statusRaw === 'expired' ? 'expired' : statusRaw === 'cancelled' ? 'cancelled' : 'pending',
        amount: data.amount,
        description: data.description,
        pix: {
          qr_code: brCode,
          qr_code_base64: brCodeBase64,
          expires_at: expiresAt,
          id: dataNode?.id
        },
        created_at: new Date().toISOString(),
        expires_at: expiresAt || new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };

      setCharge(newCharge);
      
      toast({
        title: "PIX gerado com sucesso!",
        description: "Escaneie o QR Code ou copie o código PIX para pagar.",
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      
      toast({
        title: "Erro ao gerar PIX",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const checkPaymentStatus = useCallback(async (chargeId: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/consultar-cobranca?id=${encodeURIComponent(chargeId)}`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Accept': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Erro ao consultar status do pagamento');
      }
      const result = await response.json();
      const status = (result?.data?.status || result?.status || '').toLowerCase();
      if (status && charge) {
        setCharge(prev => prev ? { ...prev, status } : null);
      }
      return result;
    } catch (err) {
      console.error('Erro ao verificar status:', err);
      return null;
    }
  }, [charge]);

  const simulatePayment = useCallback(async (paymentId: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/simular-pagamento-pix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ id: paymentId }),
      });

      if (!response.ok) {
        throw new Error('Erro ao simular pagamento');
      }

      toast({
        title: 'Pagamento simulado',
        description: 'O status será atualizado automaticamente pelo webhook',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro na simulação', description: errorMessage, variant: 'destructive' });
    }
  }, [toast]);

  const copyPixCode = useCallback(async () => {
    if (charge?.pix?.qr_code) {
      try {
        await navigator.clipboard.writeText(charge.pix.qr_code);
        toast({
          title: "Código PIX copiado!",
          description: "Cole no seu app do banco para pagar.",
        });
      } catch (err) {
        toast({
          title: "Erro ao copiar",
          description: "Não foi possível copiar o código PIX.",
          variant: "destructive",
        });
      }
    }
  }, [charge?.pix?.qr_code, toast]);

  const reset = useCallback(() => {
    setCharge(null);
    setError(null);
    setTimeLeft(0);
  }, []);

  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }, []);

  return {
    charge,
    isLoading,
    error,
    timeLeft,
    createCharge,
    checkPaymentStatus,
    copyPixCode,
    simulatePayment,
    reset,
    formatTime,
    formatCurrency
  };
};
