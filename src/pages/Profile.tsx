
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AdminAccessModal from "@/components/AdminAccessModal";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Loader2, User, Package, Ticket, Shield, Trash2, RefreshCw, ChevronDown, ChevronRight, ChevronUp, Eye } from "lucide-react";
import { enableScrollOnNextNavigation } from "@/hooks/useScrollToTop";
import { Checkbox } from "@/components/ui/checkbox";
import { useIdempotency } from "@/lib/idempotency";
import { useRealtimeOrders } from "@/hooks/realtime/useRealtimeOrders";
import TicketModal from "@/components/ui/TicketModal";
import { TicketGroup } from "@/types/ticket";
import { useUserTickets, UserTicketFilters } from "@/hooks/useUserTickets";

// Profile form schema
const profileSchema = z.object({
  full_name: z.string().min(3, { message: "Nome completo deve ter pelo menos 3 caracteres" }),
  email: z.string().email({ message: "Email inválido" }).optional(),
  phone: z.string()
    .optional()
    .refine((phone) => {
      if (!phone || phone.trim() === '') return true;
      const cleanPhone = phone.replace(/\D/g, '');
      return cleanPhone.length >= 10 && cleanPhone.length <= 11;
    }, { message: "Telefone deve ter 10 ou 11 dígitos" }),
  cpf: z.string()
    .optional()
    .refine((cpf) => {
      if (!cpf || cpf.trim() === '') return true;
      const cleanCpf = cpf.replace(/\D/g, '');
      return cleanCpf.length === 11;
    }, { message: "CPF deve ter 11 dígitos" }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

type ProfileData = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
  updated_at: string;
  created_at: string;
  phone: string | null;
  cpf: string | null;
  first_name: string | null;
  last_name: string | null;
};

type Order = {
  id: string;
  total?: number;
  total_amount?: number;
  status: string;
  payment_status?: string;
  payment_id?: string | null;
  abacatepay_id?: string | null;
  external_id?: string | null;
  created_at: string;
  updated_at?: string;
  order_items?: any[];
  customer_data?: any;
  customer_name?: string;
  customer_email?: string;
  items?: any;
  [key: string]: any;
};

type Ticket = {
  id: string;
  events?: {
    name: string;
  };
  ticket_type?: string;
  item_number?: number;
  display_id?: string;
  parent_ticket_id?: string | null;
  seat_number?: string | null;
  status: string;
  price?: number;
  total_price?: number;
  [key: string]: any;
};

const Profile = () => {
  const { user, session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const { toast } = useToast();
  const { execute } = useIdempotency();
  const [activeTab, setActiveTab] = useState("info");
  const [customer, setCustomer] = useState<{ id: string; name: string | null; email: string | null; phone: string | null; cpf: string | null } | null>(null);
  
  // Estados para filtros de tickets
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Hook para gerenciar tickets do usuário
  const ticketFilters: UserTicketFilters = {
    status: statusFilter,
    search: searchQuery
  };
  
  const { 
    tickets, 
    ticketGroups, 
    stats: ticketStats, 
    loading: loadingTickets, 
    error: ticketsError,
    refetch: refetchTickets 
  } = useUserTickets(ticketFilters);
  
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [selectAllTickets, setSelectAllTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showAdminModal, setShowAdminModal] = useState(false);
  const { isAdminLoggedIn, logoutAdmin } = useAdminAuth();
  const [simulatingPayment, setSimulatingPayment] = useState<string | null>(null);

  // Hook de sincronização em tempo real para pedidos
  const { 
    orders, 
    loading: loadingOrders, 
    error: ordersError,
    isConnected: ordersConnected,
    refetch: refetchOrders 
  } = useRealtimeOrders();
  
  // Estados para seleção múltipla
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectAllOrders, setSelectAllOrders] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  
  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const mapStatus = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'active': 'Ativo',
      'pending': 'Pendente',
      'inactive': 'Inativo',
      'cancelled': 'Cancelado'
    };
    return statusMap[status] || status;
  };

  const getStatusBadgeClass = (status: string) => {
    const classMap: { [key: string]: string } = {
      'active': 'bg-green-100 text-green-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'inactive': 'bg-red-100 text-red-800',
      'cancelled': 'bg-gray-100 text-gray-800'
    };
    return classMap[status] || 'bg-gray-100 text-gray-800';
  };

  // Função para verificar status do pagamento (sem criar nova cobrança)
  const verifyPayment = async (orderId: string) => {
    console.log("=== INICIANDO VERIFICAÇÃO DE PAGAMENTO ===");
    console.log("Order ID:", orderId);
    
    try {
      setSimulatingPayment(orderId);
      
      // Buscar informações do pedido
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
        
      if (orderError) {
        console.error("Erro ao buscar pedido:", orderError);
        throw new Error("Erro ao buscar informações do pedido");
      }
      
      if (!orderData) {
        throw new Error("Pedido não encontrado");
      }
      
      // Verificar se existe um payment_id (billing_id) do AbacatePay
      // Pode estar em payment_id, abacatepay_id, ou external_id
      // IMPORTANTE: O payment_id deve ser o pix_id (pix_char_xxxxx) salvo quando o PIX foi criado
      const billingId = orderData.payment_id || orderData.abacatepay_id || orderData.external_id;
      
      console.log("🔍 Dados do pedido:", {
        orderId: orderData.id,
        payment_id: orderData.payment_id,
        abacatepay_id: orderData.abacatepay_id,
        external_id: orderData.external_id,
        billingIdSelecionado: billingId
      });
      
      if (!billingId) {
        console.error("❌ Nenhum ID de pagamento encontrado no pedido");
        toast({
          title: "Pagamento não encontrado",
          description: "Este pedido ainda não possui uma cobrança associada no AbacatePay. Aguarde o processamento do pagamento ou entre em contato com o suporte se o problema persistir.",
          variant: "destructive",
        });
        return;
      }
  
      console.log(`🔍 Verificando status do pagamento: ${billingId}`);
      
      // Verificar se as variáveis de ambiente estão disponíveis
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        console.error("❌ Variáveis de ambiente não configuradas");
        throw new Error("Configuração do Supabase não encontrada");
      }
  
      console.log("📤 Enviando requisição para Edge Function:", `${supabaseUrl}/functions/v1/consultar-cobranca`);
  
      // Consultar status da cobrança via Edge Function
      // A Edge Function aceita tanto 'id' quanto 'billingId' no body
      const checkResponse = await fetch(`${supabaseUrl}/functions/v1/consultar-cobranca`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ id: billingId, billingId: billingId })
      });
      
      console.log("📥 Status da resposta:", checkResponse.status, checkResponse.statusText);
      
      const responseText = await checkResponse.text();
      console.log("📥 Resposta bruta:", responseText);
      
      if (!checkResponse.ok) {
        console.error("❌ Erro na resposta HTTP:", checkResponse.status);
        let errorMessage = 'Erro ao consultar status da cobrança';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.erro || errorData.detalhes || errorData.message || errorMessage;
          console.error("❌ Erro detalhado:", errorData);
        } catch (e) {
          console.error("❌ Erro ao parsear resposta de erro:", e);
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      let checkResult: any;
      try {
        checkResult = JSON.parse(responseText);
        console.log("✅ Status da cobrança consultado:", JSON.stringify(checkResult, null, 2));
      } catch (parseError) {
        console.error("❌ Erro ao parsear resposta JSON:", parseError);
        throw new Error("Resposta inválida da API");
      }
      
      // Tratar possíveis erros na resposta
      if (checkResult.erro) {
        throw new Error(checkResult.erro || checkResult.detalhes || 'Erro ao consultar cobrança');
      }
      
      // Normalizar status - a Edge Function já retorna em lowercase
      const statusFromAPI = (checkResult.status || 'pending').toLowerCase();
      
      // Mapear status do AbacatePay para status local
      const statusMapping: { [key: string]: string } = {
        'pending': 'pending',
        'paid': 'paid',
        'confirmed': 'paid',
        'cancelled': 'cancelled',
        'expired': 'expired',
        'refunded': 'cancelled',
        'paid_out': 'paid'
      };
      
      const newStatus = statusMapping[statusFromAPI] || statusFromAPI;
      const paymentStatus = (statusFromAPI === 'paid' || statusFromAPI === 'confirmed' || statusFromAPI === 'paid_out') ? 'paid' : 
                           (statusFromAPI === 'cancelled' || statusFromAPI === 'expired' || statusFromAPI === 'refunded') ? 'cancelled' : 
                           'pending';
      
      console.log("Status mapeado:", { original: statusFromAPI, newStatus, paymentStatus });
      
      // Atualizar o status do pedido no banco
      const updateData: any = {
        payment_status: paymentStatus,
        updated_at: new Date().toISOString()
      };
      
      // Atualizar status principal apenas se mudou
      if (newStatus !== orderData.status) {
        updateData.status = newStatus;
      }
      
        const { error: updateError } = await supabase
          .from('orders')
        .update(updateData)
          .eq('id', orderId);
            
        if (updateError) {
          console.error("Erro ao atualizar status do pedido:", updateError);
        throw new Error("Erro ao atualizar status do pedido");
      }
      
          console.log("Status do pedido atualizado com sucesso");
      
      // Recarregar os pedidos para mostrar o status atual
      await refetchOrders();
      
      // Calcular valor para exibição
      // checkResult.amount vem da API do AbacatePay em centavos (ex: 9000 = R$ 90,00)
      // orderData.total_amount no banco também está em centavos (9000 = R$ 90,00)
      // Priorizar valor da API (mais confiável) e converter de centavos para reais
      let displayAmount = 0;
      if (checkResult.amount !== undefined && checkResult.amount !== null) {
        // API sempre retorna em centavos, converter para reais
        const amountInCents = Number(checkResult.amount);
        displayAmount = amountInCents / 100;
        console.log(`💰 Valor da API: ${amountInCents} centavos = R$ ${displayAmount.toFixed(2)}`);
      } else if (orderData.total_amount !== undefined && orderData.total_amount !== null) {
        // Valor do banco - usar a função de normalização que detecta se está em centavos ou reais
        displayAmount = normalizeTotalAmount(orderData.total_amount);
        console.log(`💰 Valor do banco normalizado: R$ ${displayAmount.toFixed(2)} (original: ${orderData.total_amount})`);
      } else {
        displayAmount = 0;
        console.warn('⚠️ Nenhum valor encontrado para exibição');
      }
      
      // Mostrar resultado da verificação
      const statusMessages: { [key: string]: { title: string; description: string; variant: 'default' | 'destructive' } } = {
        'pending': {
          title: "Pagamento Pendente",
          description: "O pagamento ainda está pendente. Aguarde a confirmação.",
          variant: 'default'
        },
        'paid': {
          title: "Pagamento Confirmado!",
          description: `Pagamento confirmado com sucesso! Valor: ${formatCurrency(Math.round(displayAmount * 100))}`,
          variant: 'default'
        },
        'confirmed': {
          title: "Pagamento Confirmado!",
          description: `Pagamento confirmado com sucesso! Valor: ${formatCurrency(Math.round(displayAmount * 100))}`,
          variant: 'default'
        },
        'cancelled': {
          title: "Pagamento Cancelado",
          description: "O pagamento foi cancelado.",
          variant: 'destructive'
        },
        'expired': {
          title: "Pagamento Expirado",
          description: "O pagamento expirou. Gere um novo código PIX se necessário.",
          variant: 'destructive'
        }
      };
      
      const message = statusMessages[statusFromAPI] || {
        title: "Status do Pagamento",
        description: `Status: ${statusFromAPI}`,
        variant: 'default' as const
      };
      
      toast({
        title: message.title,
        description: message.description,
        variant: message.variant,
      });
      
      console.log("=== VERIFICAÇÃO CONCLUÍDA COM SUCESSO ===");
    } catch (error: any) {
      console.error("=== ERRO NA VERIFICAÇÃO DE PAGAMENTO ===");
      console.error("Erro completo:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Não foi possível verificar o pagamento. Tente novamente.";
      
      toast({
        title: "Erro ao verificar pagamento",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSimulatingPayment(null);
      console.log("=== FIM DA VERIFICAÇÃO DE PAGAMENTO ===");
    }
  };

  // Função para simular pagamento de ingressos
  const simulateTicketPayment = async (ticketId: string) => {
    try {
      // Buscar informações do ingresso para a simulação
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select('*, events(*)')
        .eq('id', ticketId)
        .single();
        
      if (ticketError) throw new Error("Erro ao buscar informações do ingresso");
      
      console.log("Dados do ingresso encontrados:", ticketData);
      
      // Atualizar o status do ingresso para 'active'
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ status: 'active' })
        .eq('id', ticketId);
        
      if (updateError) {
        console.error("Erro ao atualizar:", updateError);
        throw new Error(`Erro ao atualizar status do ingresso: ${updateError.message}`);
      }
      
      // Atualizar a lista de ingressos
      await refetchTickets();
      
      toast({
        title: "Pagamento simulado com sucesso!",
        description: `O ingresso para "${ticketData.events?.name || 'Evento'}" foi ativado.`,
        variant: "default",
      });
    } catch (error) {
      console.error("Erro ao simular pagamento do ingresso:", error);
      toast({
        title: "Erro ao simular pagamento",
        description: "Não foi possível simular o pagamento do ingresso. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Função para deletar pedidos selecionados
  const handleDeleteSelectedOrders = async () => {
    if (selectedOrders.length === 0) {
      toast({
        title: "Nenhum pedido selecionado",
        description: "Selecione pelo menos um pedido para deletar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: deletedOrders, error } = await supabase
        .from('orders')
        .delete()
        .in('id', selectedOrders)
        .select('id');

      if (error) throw error;

      const deletedCount = Array.isArray(deletedOrders) ? deletedOrders.length : 0;
      
      // Atualizar a lista de pedidos
      refetchOrders();
      
      // Limpar seleção
      setSelectedOrders([]);
      setSelectAllOrders(false);
      
      if (deletedCount === 0) {
        toast({
          title: "Nenhum pedido removido",
          description: "Verifique permissões (RLS) ou se os pedidos ainda existem.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Pedidos deletados",
          description: `${deletedCount} pedido(s) deletado(s) com sucesso.`,
        });
      }
    } catch (error) {
      console.error("Erro ao deletar pedidos:", error);
      toast({
        title: "Erro ao deletar pedidos",
        description: "Não foi possível deletar os pedidos selecionados.",
        variant: "destructive",
      });
    }
  };

  // Função para deletar tickets selecionados
  const handleDeleteSelectedTickets = async () => {
    if (selectedTickets.length === 0) {
      toast({
        title: "Nenhum ticket selecionado",
        description: "Selecione pelo menos um ticket para deletar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('tickets')
        .delete()
        .in('id', selectedTickets);

      if (error) throw error;

      toast({
        title: "Tickets deletados",
        description: `${selectedTickets.length} ticket(s) deletado(s) com sucesso.`,
      });

      setSelectedTickets([]);
      setSelectAllTickets(false);
      await refetchTickets();
    } catch (error) {
      console.error("Erro ao deletar tickets:", error);
      toast({
        title: "Erro ao deletar tickets",
        description: "Não foi possível deletar os tickets selecionados.",
        variant: "destructive",
      });
    }
  };

  // Funções para obter cor e texto do status dos pedidos
  const getStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'paid': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800',
      'processing': 'bg-blue-100 text-blue-800',
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status: string) => {
    const textMap: { [key: string]: string } = {
      'pending': 'Pendente',
      'paid': 'Pago',
      'cancelled': 'Cancelado',
      'processing': 'Processando',
    };
    return textMap[status] || status;
  };

  // Funções para obter cor e texto do status dos tickets
  const getTicketStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      'active': 'bg-green-100 text-green-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'inactive': 'bg-red-100 text-red-800',
      'cancelled': 'bg-gray-100 text-gray-800',
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  const getTicketStatusText = (status: string) => {
    const textMap: { [key: string]: string } = {
      'active': 'Ativo',
      'pending': 'Pendente',
      'inactive': 'Inativo',
      'cancelled': 'Cancelado',
    };
    return textMap[status] || status;
  };

  // Função para simular pagamento (alias para verifyPayment)
  const simulatePayment = verifyPayment;

  // Profile form
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      cpf: "",
    },
  });

  // Load user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
  
      try {
        console.log('[DEBUG] Fetching profile for user:', user.id);
        
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        console.log('[DEBUG] Profile query result:', { data, error });

        if (error) {
          console.error('[DEBUG] Profile query error:', error);
          throw error;
        }

        if (data) {
          console.log('[DEBUG] Profile data found:', data);
          setProfile(data);
          // Buscar dados de cliente (telefone/CPF) vinculados ao usuário
          const { data: customerData, error: customerError } = await supabase
            .from('customers')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (customerError) {
            console.warn('[DEBUG] Customer query error:', customerError);
          }

          if (customerData) {
            setCustomer({
              id: customerData.id,
              name: customerData.name || null,
              email: customerData.email || null,
              phone: customerData.phone || null,
              cpf: customerData.cpf || null,
            });
          }

          profileForm.reset({
            full_name: data.full_name || (data.first_name && data.last_name ? `${data.first_name} ${data.last_name}` : ""),
            email: data.email || user.email || "",
            phone: customerData?.phone || "",
            cpf: customerData?.cpf || "",
          });
        } else {
          console.log('[DEBUG] No profile data found for user:', user.id);
          // Se não há dados de perfil, criar um registro básico
          const { data: newProfile, error: createError } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || "",
              role: "user"
            })
            .select()
            .single();

          if (createError) {
            console.error('[DEBUG] Error creating profile:', createError);
            throw createError;
          }

          if (newProfile) {
            console.log('[DEBUG] New profile created:', newProfile);
            setProfile(newProfile);
            // Carregar (se existir) o customer já vinculado
            const { data: customerData } = await supabase
              .from('customers')
              .select('*')
              .eq('user_id', user.id)
              .maybeSingle();

            if (customerData) {
              setCustomer({
                id: customerData.id,
                name: customerData.name || null,
                email: customerData.email || null,
                phone: customerData.phone || null,
                cpf: customerData.cpf || null,
              });
            }

            profileForm.reset({
              full_name: newProfile.full_name || (newProfile.first_name && newProfile.last_name ? `${newProfile.first_name} ${newProfile.last_name}` : ""),
              email: newProfile.email || user.email || "",
              phone: customerData?.phone || "",
              cpf: customerData?.cpf || "",
            });
          }
        }
      } catch (error: unknown) {
        console.error('[DEBUG] Profile fetch error:', error);
        const errorMessage = error instanceof Error ? error.message : "Tente novamente mais tarde";
        toast({
          title: "Erro ao carregar perfil",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setLoadingProfile(false);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user, toast, profileForm]);

  // Função para buscar pedidos do usuário - REMOVIDA
  // Agora usando useRealtimeOrders para sincronização automática
  
  // Carregar pedidos do usuário ao iniciar - REMOVIDO
  // useRealtimeOrders já carrega automaticamente quando o usuário está disponível

  // Delete ticket function (admin only)
  const deleteTicket = async (ticketId: string) => {
    if (!isAdminLoggedIn) {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem excluir ingressos.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Usar o token da sessão atual para evitar problemas de autenticação
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession) {
        toast({
          title: "Erro de autenticação",
          description: "Sua sessão expirou. Faça login novamente.",
          variant: "destructive",
        });
        return;
      }
      
      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', ticketId);

      if (error) throw error;

      // Recarregar ingressos do banco de dados
      await refetchTickets();
      
      toast({
        title: "Ingresso excluído",
        description: "O ingresso foi removido com sucesso.",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro ao excluir ingresso",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Delete order function (admin only)
  const deleteOrder = async (orderId: string) => {
    if (!isAdminLoggedIn) {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem excluir pedidos.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: deleted, error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId)
        .select('id');

      if (error) throw error;

      const deletedCount = Array.isArray(deleted) ? deleted.length : 0;
      if (deletedCount === 0) {
        toast({
          title: "Nenhum pedido removido",
          description: "Verifique permissões (RLS) ou se o pedido já foi removido.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Pedido excluído",
          description: "O pedido foi removido com sucesso.",
        });
      }

      // Refetch orders to update the list
      refetchOrders();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro ao excluir pedido",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Funções para seleção múltipla de ingressos
  const handleTicketSelection = (ticketId: string, checked: boolean) => {
    if (checked) {
      setSelectedTickets(prev => [...prev, ticketId]);
    } else {
      setSelectedTickets(prev => prev.filter(id => id !== ticketId));
    }
  };

  const handleSelectAllTickets = (checked: boolean) => {
    setSelectAllTickets(checked);
    if (checked) {
      setSelectedTickets(tickets.map(ticket => ticket.id));
    } else {
      setSelectedTickets([]);
    }
  };

  // Funções para seleção múltipla de pedidos
  const handleOrderSelection = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders(prev => [...prev, orderId]);
    } else {
      setSelectedOrders(prev => prev.filter(id => id !== orderId));
    }
  };

  const handleSelectAllOrders = (checked: boolean) => {
    setSelectAllOrders(checked);
    if (checked) {
      setSelectedOrders(orders.map(order => order.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const deleteSelectedOrders = async () => {
    if (!isAdminLoggedIn) {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem excluir pedidos.",
        variant: "destructive",
      });
      return;
    }

    if (selectedOrders.length === 0) {
      toast({
        title: "Nenhum pedido selecionado",
        description: "Selecione pelo menos um pedido para excluir.",
        variant: "destructive",
      });
      return;
    }

    const confirmMessage = `Tem certeza que deseja excluir ${selectedOrders.length} pedido(s) selecionado(s)?`;
    if (!window.confirm(confirmMessage)) return;

    try {
      const { data: deleted, error } = await supabase
        .from('orders')
        .delete()
        .in('id', selectedOrders)
        .select('id');

      if (error) throw error;

      const deletedCount = Array.isArray(deleted) ? deleted.length : 0;
      refetchOrders();
      setSelectedOrders([]);
      setSelectAllOrders(false);
      
      toast({
        title: deletedCount > 0 ? "Pedidos excluídos" : "Nenhum pedido removido",
        description: deletedCount > 0
          ? `${deletedCount} pedido(s) foram removidos com sucesso.`
          : "Verifique permissões (RLS) ou se os pedidos já foram removidos.",
        ...(deletedCount === 0 ? { variant: "destructive" } : {})
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro ao excluir pedidos",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Confirmation dialog for deletion
  const confirmDelete = (type: 'ticket' | 'order', id: string, name: string) => {
    const message = type === 'ticket' 
      ? `Tem certeza que deseja excluir o ingresso para "${name}"?`
      : `Tem certeza que deseja excluir o pedido #${id.substring(0, 8)}?`;
    
    if (window.confirm(message)) {
      if (type === 'ticket') {
        deleteTicket(id);
      } else {
        deleteOrder(id);
      }
    }
  };

  // Função para formatar valores em reais
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value / 100); // ✅ Dividir por 100 para converter centavos em reais
  };

  // Função para normalizar total_amount 
  // PROBLEMA IDENTIFICADO: Há inconsistência no armazenamento de total_amount:
  // - Checkout.tsx: Math.round(orderTotal * 100) - salva em CENTAVOS (ex: R$ 90,00 = 9000)
  // - Edge Functions: data.amount - API AbacatePay retorna em CENTAVOS
  // - Webhooks: billing.amount - AbacatePay retorna em CENTAVOS
  // - Alguns pedidos antigos podem estar em REAIS
  //
  // SOLUÇÃO: Verificar a magnitude do valor para determinar se está em centavos ou reais
  // Se o valor for >= 100, provavelmente está em centavos (ex: 9000 = R$ 90,00)
  // Se o valor for < 100, provavelmente já está em reais (ex: 90.00 = R$ 90,00)
  const normalizeTotalAmount = (amount: number | null | undefined): number => {
    if (!amount || amount === 0) return 0;
    const numAmount = Number(amount);
    
    // Se o valor for menor que 100, assumir que já está em reais
    // Exemplo: 90.00 = R$ 90,00 (já está em reais)
    if (numAmount < 100) {
      return numAmount;
    }
    
    // Se o valor for >= 100, provavelmente está em centavos
    // Exemplo: 9000 centavos = R$ 90,00
    //          90000 centavos = R$ 900,00
    const amountInReais = numAmount / 100;
    
    // Verificar se o resultado faz sentido (valores entre R$ 0,01 e R$ 1.000.000,00)
    // Se fizer sentido, usar a conversão. Caso contrário, usar o valor original
    if (amountInReais >= 0.01 && amountInReais <= 1000000) {
      return amountInReais;
    }
    
    // Se a conversão não fizer sentido, assumir que já está em reais
    return numAmount;
  };

  // Função para formatar telefone
  const formatPhone = (phone: string) => {
    if (!phone || phone === 'N/A') return phone;
    const numbers = phone.replace(/\D/g, '');
    if (numbers.length === 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (numbers.length === 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  };

  // Função para formatar CPF
  const formatDocument = (document: string) => {
    if (!document || document === 'N/A') return document;
    const numbers = document.replace(/\D/g, '');
    if (numbers.length === 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return document;
  };

  // Função para formatar CPF enquanto digita (para o campo de input)
  const formatCpfInput = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return numbers.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    if (numbers.length <= 9) return numbers.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  };

  // Função para formatar telefone enquanto digita (para o campo de input)
  const formatPhoneInput = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 6) {
      return numbers.replace(/(\d{2})(\d{1,4})/, '($1) $2');
    }
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{1,4})/, '($1) $2-$3');
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{1,4})/, '($1) $2-$3');
  };

  // Função para extrair dados do cliente
  const getCustomerData = (order: any) => {
    if (order.customer_data) {
      try {
        const customerData = typeof order.customer_data === 'string' 
          ? JSON.parse(order.customer_data) 
          : order.customer_data;
        
        return {
          name: customerData.name || customerData.full_name || order.customer_name || 'N/A',
          email: customerData.email || order.customer_email || 'N/A',
          phone: customerData.phone || customerData.phone_number || 'N/A',
          document: customerData.document || customerData.cpf || 'N/A'
        };
      } catch (e) {
        console.error('Erro ao parsear customer_data:', e);
        return {
          name: order.customer_name || 'N/A',
          email: order.customer_email || 'N/A',
          phone: 'N/A',
          document: 'N/A'
        };
      }
    }
    
    return {
      name: order.customer_name || 'N/A',
      email: order.customer_email || 'N/A',
      phone: 'N/A',
      document: 'N/A'
    };
  };

  // Handle profile update
  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      // Atualizar nome/email no perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: values.full_name,
          email: values.email || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Normalizar CPF (apenas dígitos)
      const cleanedCpf = (values.cpf || '').replace(/\D/g, '') || null;

      // Upsert de customer (telefone/CPF vinculados ao usuário)
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingCustomer) {
        const { error: updateCustomerError } = await supabase
          .from('customers')
          .update({
            name: values.full_name,
            email: values.email || user.email || null,
            phone: values.phone || null,
            cpf: cleanedCpf,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingCustomer.id);

        if (updateCustomerError) throw updateCustomerError;
      } else {
        const { error: insertCustomerError } = await supabase
          .from('customers')
          .insert({
            user_id: user.id,
            name: values.full_name,
            email: values.email || user.email || '',
            phone: values.phone || null,
            cpf: cleanedCpf,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (insertCustomerError) throw insertCustomerError;
      }

      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram atualizadas com sucesso.",
      });
      
      // Refresh profile data
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
        
      if (data) {
        setProfile(data);
        const { data: refreshedCustomer } = await supabase
          .from('customers')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (refreshedCustomer) setCustomer(refreshedCustomer);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Tente novamente mais tarde";
      toast({
        title: "Erro ao atualizar perfil",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-butterfly-orange" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-butterfly-orange">Meu Perfil</h1>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4 grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
              <TabsTrigger value="info" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>Informações</span>
              </TabsTrigger>
              <TabsTrigger value="orders" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span>Meus Pedidos</span>
              </TabsTrigger>
              <TabsTrigger value="tickets" className="flex items-center gap-2">
                <Ticket className="h-4 w-4" />
                <span>Meus Ingressos</span>
              </TabsTrigger>
              <TabsTrigger 
                value="admin" 
                className="flex items-center gap-2"
                onClick={() => {
                  if (!isAdminLoggedIn) {
                    setShowAdminModal(true);
                  }
                }}
              >
                <Shield className="h-4 w-4" />
                <span>
                  {isAdminLoggedIn ? 'Admin Logado' : 'Painel Admin'}
                </span>
                {isAdminLoggedIn && (
                  <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                    Ativo
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info">
              <Card>
                <CardHeader>
                  <CardTitle>Informações Pessoais</CardTitle>
                  <CardDescription>
                    Atualize suas informações de perfil aqui.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingProfile ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin text-butterfly-orange" />
                    </div>
                  ) : (
                    <Form {...profileForm}>
                      <form onSubmit={profileForm.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                          <FormField
                            control={profileForm.control}
                            name="full_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nome completo</FormLabel>
                                <FormControl>
                                  <Input placeholder="Seu nome completo" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={profileForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input placeholder="seu@email.com" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={profileForm.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Telefone</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="(11) 99999-9999" 
                                    {...field}
                                    onChange={(e) => {
                                      const formatted = formatPhoneInput(e.target.value);
                                      field.onChange(formatted);
                                    }}
                                    maxLength={15}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={profileForm.control}
                            name="cpf"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>CPF</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="000.000.000-00" 
                                    {...field}
                                    onChange={(e) => {
                                      const formatted = formatCpfInput(e.target.value);
                                      field.onChange(formatted);
                                    }}
                                    maxLength={14}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="sm:col-span-2">
                            <Button 
                              type="submit" 
                              className="bg-butterfly-orange hover:bg-butterfly-orange/90"
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Salvando...
                                </>
                              ) : (
                                "Salvar alterações"
                              )}
                            </Button>
                          </div>
                        </div>
                      </form>
                    </Form>
                  )}
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">Email: {user.email}</p>
                    {customer?.phone && (
                      <p className="text-sm text-gray-500">Telefone: {customer.phone}</p>
                    )}
                    {customer?.cpf && (
                      <p className="text-sm text-gray-500">CPF: {customer.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</p>
                    )}
                    <p className="text-sm text-gray-500">
                      Conta criada em: {profile?.created_at ? new Date(profile.created_at).toLocaleString('pt-BR') : "Carregando..."}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => signOut()}>
                    Sair
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="orders" className="space-y-4 sm:space-y-6">
              <Card className="w-full">
                <CardHeader className="pb-3 sm:pb-4">
                  <CardTitle className="text-lg sm:text-xl md:text-2xl">Meus Pedidos</CardTitle>
                  <CardDescription className="text-sm sm:text-base">
                    Acompanhe seus pedidos e histórico de compras
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingOrders ? (
                    <div className="flex justify-center items-center py-8 sm:py-12">
                      <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin" />
                    </div>
                  ) : (
                    <>
                      {isAdminLoggedIn && orders.length > 0 && (
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="select-all-orders"
                              checked={selectAllOrders}
                              onCheckedChange={handleSelectAllOrders}
                              className="h-4 w-4 sm:h-5 sm:w-5"
                            />
                            <label htmlFor="select-all-orders" className="text-xs sm:text-sm font-medium">
                              Selecionar todos
                            </label>
                          </div>
                          {selectedOrders.length > 0 && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={deleteSelectedOrders}
                              className="text-xs sm:text-sm px-2 sm:px-4 py-1 sm:py-2"
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                              Excluir Selecionados ({selectedOrders.length})
                            </Button>
                          )}
                        </div>
                      )}
                      
                      <div className="space-y-3 sm:space-y-4">
                        {orders.map((order) => (
                          <Card key={order.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                            <CardContent className="p-3 sm:p-4 md:p-6">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                                <div className="flex items-start gap-2 sm:gap-3 flex-1">
                                  {isAdminLoggedIn && (
                                    <Checkbox
                                      checked={selectedOrders.includes(order.id)}
                                      onCheckedChange={(checked) => handleOrderSelection(order.id, checked as boolean)}
                                      className="mt-1 h-4 w-4 sm:h-5 sm:w-5"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-2">
                                      <h3 className="font-semibold text-sm sm:text-base md:text-lg truncate">
                                        Pedido #{order.id.slice(0, 8)}
                                      </h3>
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                        {getStatusText(order.status)}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs sm:text-sm text-gray-600">
                                      <p>
                                        <span className="font-medium">Data:</span> {formatDate(order.created_at)}
                                      </p>
                                      <p>
                                        <span className="font-medium">Total:</span> {formatCurrency(order.total_amount || 0)}
                                      </p>
                                      <p>
                                        <span className="font-medium">Itens:</span> {order.order_items?.length || 0}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center">
                                    <Dialog open={isOrderModalOpen && selectedOrder?.id === order.id} onOpenChange={(open) => {
                                      setIsOrderModalOpen(open);
                                      if (!open) setSelectedOrder(null);
                                    }}>
                                      <DialogTrigger asChild>
                                      <Button
                                          variant="outline"
                                        size="sm"
                                          onClick={() => {
                                            setSelectedOrder(order);
                                            setIsOrderModalOpen(true);
                                          }}
                                        className="text-xs sm:text-sm px-3 sm:px-4 py-1 sm:py-2 w-full sm:w-auto"
                                        >
                                          <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                          Detalhes
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                        <DialogHeader className="pb-4">
                                          <DialogTitle className="text-xl font-bold text-gray-900">Detalhes do Pedido</DialogTitle>
                                          <DialogDescription className="text-sm text-gray-500 mt-1">
                                            {selectedOrder && (
                                              <>Informações completas do pedido {
                                                (selectedOrder.payment_id && selectedOrder.payment_id.startsWith('pix_char_')) 
                                                  ? selectedOrder.payment_id 
                                                  : (selectedOrder.external_id || selectedOrder.abacatepay_id || `pedido_${selectedOrder.id.slice(0, 13)}`)
                                              }</>
                                            )}
                                          </DialogDescription>
                                        </DialogHeader>
                                        
                                        {selectedOrder && (
                                          <div className="space-y-6">
                                            {/* Informações do Cliente */}
                                            <div>
                                              <h3 className="text-base font-semibold text-gray-900 mb-3">Informações do Cliente</h3>
                                              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-2.5">
                                                <p className="text-sm"><span className="font-bold text-gray-900">Nome:</span> <span className="text-gray-900">{getCustomerData(selectedOrder).name}</span></p>
                                                <p className="text-sm"><span className="font-bold text-gray-900">Email:</span> <span className="text-gray-900">{getCustomerData(selectedOrder).email}</span></p>
                                                <p className="text-sm"><span className="font-bold text-gray-900">Telefone:</span> <span className="text-gray-900">{formatPhone(getCustomerData(selectedOrder).phone)}</span></p>
                                                <p className="text-sm"><span className="font-bold text-gray-900">Documento:</span> <span className="text-gray-900">{formatDocument(getCustomerData(selectedOrder).document)}</span></p>
                                              </div>
                                            </div>

                                            {/* Informações do Pedido */}
                                            <div>
                                              <h3 className="text-base font-semibold text-gray-900 mb-3">Informações do Pedido</h3>
                                              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-2.5">
                                                <p className="text-sm"><span className="font-bold text-gray-900">ID:</span> <span className="text-gray-900 font-mono">{selectedOrder.id}</span></p>
                                                <p className="text-sm"><span className="font-bold text-gray-900">AbacatePay ID:</span> <span className="text-gray-900">{
                                                  selectedOrder.payment_id || selectedOrder.external_id || selectedOrder.abacatepay_id || 'N/A'
                                                }</span></p>
                                                <p className="text-sm"><span className="font-bold text-gray-900">Total:</span> <span className="text-gray-900">{formatCurrency(selectedOrder.total_amount || 0)}</span></p>
                                                <p className="text-sm"><span className="font-bold text-gray-900">Status:</span> <span className="text-gray-900">{getStatusText(selectedOrder.status || selectedOrder.payment_status || 'pending')}</span></p>
                                                <p className="text-sm"><span className="font-bold text-gray-900">Data e Hora:</span> <span className="text-gray-900">{formatDate(selectedOrder.created_at)}</span></p>
                                                {selectedOrder.updated_at && (
                                                  <p className="text-sm"><span className="font-bold text-gray-900">Atualizado em:</span> <span className="text-gray-900">{new Date(selectedOrder.updated_at).toLocaleString('pt-BR')}</span></p>
                                                )}
                                              </div>
                                            </div>

                                            {/* Itens do Pedido */}
                                            {(() => {
                                              // Tentar obter itens de order_items ou do campo items (JSON)
                                              let items: any[] = [];
                                              if (selectedOrder.order_items && selectedOrder.order_items.length > 0) {
                                                items = selectedOrder.order_items;
                                              } else if (selectedOrder.items) {
                                                // Se order_items não existe, tentar usar o campo items (JSON)
                                                try {
                                                  const itemsData = typeof selectedOrder.items === 'string' 
                                                    ? JSON.parse(selectedOrder.items) 
                                                    : selectedOrder.items;
                                                  items = Array.isArray(itemsData) ? itemsData : [];
                                                } catch (e) {
                                                  console.error('Erro ao parsear items:', e);
                                                  items = [];
                                                }
                                              }

                                              if (items.length > 0) {
                                                return (
                                                  <div>
                                                    <h3 className="text-base font-semibold text-gray-900 mb-3">Itens do Pedido</h3>
                                                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                                      <div className="space-y-0">
                                                        {items.map((item: any, index: number) => {
                                                          // Normalizar dados do item
                                                          const itemName = item.products?.name || item.product_name || item.nome || item.title || item.name || `Item ${index + 1}`;
                                                          const itemSize = item.size || item.tamanho;
                                                          const itemCategory = item.products?.category || item.category || item.categoria;
                                                          const itemQuantity = item.quantity || item.quantidade || 1;
                                                          const itemPrice = item.price || item.unit_price || item.preco || item.preco_unitario || 0;
                                                          const itemTotal = item.total_price || item.total || (itemPrice * itemQuantity);

                                                          return (
                                                            <div key={item.id || item.product_id || index} className={`flex justify-between items-start py-3 ${index < items.length - 1 ? 'border-b border-gray-200' : ''}`}>
                                                              <div className="flex-1">
                                                                <p className="font-bold text-gray-900 mb-1">
                                                                  {itemName}
                                                                </p>
                                                                {itemSize && (
                                                                  <p className="text-sm text-gray-600">Tamanho: {itemSize}</p>
                                                                )}
                                                                {itemCategory && (
                                                                  <p className="text-sm text-gray-600">Categoria: {itemCategory}</p>
                                                                )}
                                                              </div>
                                                              <div className="text-right ml-4">
                                                                <p className="text-sm text-gray-900 mb-1">Qtd: {itemQuantity}</p>
                                                                <p className="text-sm text-gray-900 mb-1">
                                                                  {formatCurrency(itemPrice)} cada
                                                                </p>
                                                                <p className="font-bold text-gray-900">
                                                                  Total: {formatCurrency(itemTotal)}
                                                                </p>
                                                              </div>
                                                            </div>
                                                          );
                                                        })}
                                                      </div>
                                                      <div className="mt-4 pt-3 border-t border-gray-300">
                                                        <div className="flex justify-between items-center text-sm text-gray-900">
                                                          <span>Total de Itens:</span>
                                                          <span>{items.reduce((sum: number, item: any) => sum + (item.quantity || item.quantidade || 0), 0)}</span>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              }
                                              return null;
                                            })()}
                                            
                                            {/* Botão Verificar Status no Modal */}
                                            {(selectedOrder.status === 'pending' || selectedOrder.payment_status === 'pending' || 
                                              selectedOrder.payment_id || selectedOrder.abacatepay_id || selectedOrder.external_id) && (
                                              <div className="flex justify-end pt-4">
                                                <Button
                                                  onClick={() => {
                                                    verifyPayment(selectedOrder.id);
                                                    setIsOrderModalOpen(false);
                                                  }}
                                                  disabled={simulatingPayment === selectedOrder.id}
                                                  className="bg-green-600 hover:bg-green-700 text-white font-medium flex items-center gap-2"
                                                >
                                                  {simulatingPayment === selectedOrder.id ? (
                                                    <>
                                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                                      Verificando...
                                                    </>
                                                  ) : (
                                                    <>
                                                      <RefreshCw className="h-4 w-4" />
                                                      Verificar Status
                                                    </>
                                                  )}
                                                </Button>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </DialogContent>
                                    </Dialog>
                                    
                                    {/* Botão Verificar Pagamento - aparece para todos os pedidos pendentes ou com payment_id */}
                                    {(order.status === 'pending' || order.payment_status === 'pending' || 
                                      (order as any).payment_id || (order as any).abacatepay_id || (order as any).external_id) && (
                                      <Button
                                        onClick={() => verifyPayment(order.id)}
                                        disabled={simulatingPayment === order.id}
                                        size="sm"
                                        variant={(order.status as string) === 'paid' || order.payment_status === 'paid' ? "outline" : "default"}
                                        className={`text-xs sm:text-sm px-3 sm:px-4 py-1 sm:py-2 w-full sm:w-auto ${
                                          (order.status as string) === 'paid' || order.payment_status === 'paid' 
                                            ? 'bg-green-50 text-green-700 hover:bg-green-100 border-green-300' 
                                            : 'bg-butterfly-orange hover:bg-butterfly-orange/90 text-white'
                                        }`}
                                      >
                                        {simulatingPayment === order.id ? (
                                          <>
                                            <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                                            Verificando...
                                          </>
                                        ) : (
                                          <>
                                            <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                            {(order.status as string) === 'paid' || order.payment_status === 'paid' 
                                              ? 'Verificar Status' 
                                              : 'Verificar Pagamento'}
                                          </>
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      
                      {orders.length === 0 && (
                        <div className="text-center py-8 sm:py-12">
                          <Package className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-gray-400 mb-3 sm:mb-4" />
                          <p className="text-sm sm:text-base text-gray-500">Nenhum pedido encontrado</p>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tickets" className="space-y-4 sm:space-y-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Meus Ingressos</h2>
                <p className="text-gray-600">Visualize e gerencie seus ingressos e pacotes</p>
              </div>

              {loadingTickets ? (
                <div className="flex justify-center items-center py-8 sm:py-12">
                  <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Estatísticas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Ingressos</CardTitle>
                        <Ticket className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{tickets.length}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ativos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                          {ticketStats.active}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Utilizados</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                          {ticketStats.used}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cancelados</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                          {ticketStats.cancelled}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatCurrency(ticketStats.totalValue)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Filtros */}
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle className="text-lg">Filtros</CardTitle>
                      <CardDescription>
                        Filtre seus ingressos por status ou busque por evento
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                          <div className="relative">
                            <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input
                              placeholder="Buscar por evento ou código..."
                              value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                        </div>
                        <select
                          value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md bg-white min-w-[150px]"
                        >
                          <option value="all">Todos os Status</option>
                          <option value="active">Ativos</option>
                          <option value="used">Utilizados</option>
                          <option value="cancelled">Cancelados</option>
                        </select>
                        <Button
                          onClick={refetchTickets}
                          disabled={loadingTickets}
                          variant="outline"
                          size="default"
                          className="flex items-center gap-2 min-w-[120px]"
                        >
                          <RefreshCw className={`h-4 w-4 ${loadingTickets ? 'animate-spin' : ''}`} />
                          {loadingTickets ? 'Carregando...' : 'Atualizar'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Seleção múltipla para administradores */}
                  {isAdminLoggedIn && tickets.length > 0 && (
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="select-all-tickets"
                          checked={selectAllTickets}
                          onCheckedChange={handleSelectAllTickets}
                        />
                        <label htmlFor="select-all-tickets" className="text-sm font-medium">
                          Selecionar todos ({tickets.length} tickets)
                        </label>
                      </div>
                      
                      {/* Botão de exclusão múltipla */}
                      {selectedTickets.length > 0 && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">
                            {selectedTickets.length} ticket(s) selecionado(s)
                          </span>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDeleteSelectedTickets}
                            className="flex items-center gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir Selecionados ({selectedTickets.length})
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lista de Ingressos */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Ingressos e Pacotes ({tickets.length})
                      </CardTitle>
                      <CardDescription>
                        Lista de ingressos individuais e pacotes agrupados por pedido
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {tickets.length === 0 ? (
                        <div className="text-center py-8">
                          <Ticket className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                          <p className="text-gray-500 mb-4">
                            {searchQuery || statusFilter !== 'all' 
                              ? 'Nenhum ingresso encontrado com os filtros aplicados'
                              : 'Nenhum ingresso encontrado'
                            }
                          </p>
                          {!searchQuery && statusFilter === 'all' && (
                            <Button
                              onClick={() => navigate('/ingressos')}
                              className="text-sm px-6 py-2"
                            >
                              Ver Ingressos Disponíveis
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {ticketGroups.map((group) => (
                            <div key={group.id} className="border rounded-lg p-4 hover:bg-gray-50">
                              {/* Linha principal do grupo */}
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-4">
                                <div className="flex items-center space-x-2 flex-1">
                                  {isAdminLoggedIn && (
                                    <Checkbox
                                      checked={group.type === 'single' 
                                        ? selectedTickets.includes(group.tickets[0]?.id)
                                        : group.tickets.every(ticket => selectedTickets.includes(ticket.id))
                                      }
                                      onCheckedChange={(checked) => {
                                        if (group.type === 'single') {
                                          handleTicketSelection(group.tickets[0]?.id, checked as boolean);
                                        } else {
                                          // Para pacotes, seleciona/deseleciona todos os tickets do grupo
                                          group.tickets.forEach(ticket => {
                                            handleTicketSelection(ticket.id, checked as boolean);
                                          });
                                        }
                                      }}
                                    />
                                  )}
                                  
                                  {group.type === 'package' && (
                                    <button
                                      onClick={() => toggleGroupExpansion(group.id)}
                                      className="p-1 hover:bg-gray-200 rounded"
                                    >
                                      {expandedGroups.has(group.id) ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </button>
                                  )}
                                  
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h3 className="font-semibold">{group.customer_name}</h3>
                                      <span className="text-sm text-gray-500">
                                        {group.type === 'package' ? `Pacote (${group.ticket_count} ingressos)` : 'Ingresso Individual'}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                      {group.customer_email} • {group.event_name}
                                      {group.tickets.length > 0 && (
                                        <>
                                          {' • '}
                                          {(() => {
                                            const ticketsWithSeats = group.tickets.filter(t => t.seat_number);
                                            if (ticketsWithSeats.length === 0) {
                                              // Não há assentos - itens virtuais ou tickets sem assento
                                              return <span className="text-gray-500 text-xs">Assentos pendentes</span>;
                                            } else if (ticketsWithSeats.length === 1) {
                                              return <>Assento: <span className="font-mono font-semibold text-primary">{ticketsWithSeats[0].seat_number}</span></>;
                                            } else {
                                              return (
                                                <>Assentos: <span className="font-mono font-semibold text-primary">
                                                  {ticketsWithSeats
                                                    .map(t => t.seat_number)
                                                    .sort()
                                                    .join(', ')}
                                                </span></>
                                              );
                                            }
                                          })()}
                                        </>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <div className="font-semibold">{formatCurrency(group.total_value)}</div>
                                    <div className="text-sm text-gray-500">
                                      {group.ticket_count} {group.ticket_count === 1 ? 'ingresso' : 'ingressos'}
                                    </div>
                                  </div>
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTicketStatusColor(group.status)}`}>
                                    {getTicketStatusText(group.status)}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedTicket(group.tickets[0])}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              
                              {/* Detalhes expandidos */}
                              {expandedGroups.has(group.id) && (
                                <div className="mt-4 pl-8 space-y-2 border-t pt-4">
                                  {group.tickets.map((ticket, ticketIndex) => {
                                    // Usar ticket.id como key principal, mas adicionar índice para garantir unicidade
                                    const ticketKey = ticket.id || `${group.id}-ticket-${ticketIndex}`;
                                    // Garantir que temos o seat_number correto - verificar todas as formas possíveis
                                    const seatNumber = ticket.seat_number || (ticket as any).seat_number || null;
                                    
                                    // Debug: log para verificar seat_number
                                    if (ticketIndex === 0) {
                                      console.log('[Profile] Primeiro ticket do grupo:', {
                                        ticketId: ticket.id,
                                        seatNumber: seatNumber,
                                        ticketNumber: ticket.ticket_number,
                                        allTickets: group.tickets.map(t => ({ id: t.id, seat: t.seat_number }))
                                      });
                                    }
                                    
                                    return (
                                    <div key={ticketKey} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                      <div className="flex items-center space-x-2">
                                        {isAdminLoggedIn && (
                                          <Checkbox
                                            checked={selectedTickets.includes(ticket.id)}
                                            onCheckedChange={(checked) => handleTicketSelection(ticket.id, checked as boolean)}
                                          />
                                        )}
                                        <div>
                                          <p className="font-medium text-sm">
                                            {ticket.ticket_type === 'batch' ? 'Ingressos' : ticket.ticket_type}
                                            {(ticket as any).item_number && ` - Item ${(ticket as any).item_number}`}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            {seatNumber ? (
                                              <>Assento: <span className="font-mono font-semibold text-primary">{seatNumber}</span></>
                                            ) : (
                                              <>ID: {(ticket as any).display_id ? 
                                                (ticket as any).display_id : 
                                                ((ticket as any).parent_ticket_id ? 
                                                  `${(ticket as any).parent_ticket_id.slice(0, 8)}-${(ticket as any).item_number}` : 
                                                  ticket.id.slice(0, 8))
                                              }</>
                                            )}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">
                                          {formatCurrency(ticket.total_price || ticket.price || 0)}
                                        </span>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTicketStatusColor(ticket.status)}`}>
                                          {getTicketStatusText(ticket.status)}
                                        </span>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setSelectedTicket(ticket)}
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* Conteúdo Admin - Mostrar quando admin está logado */}
            {isAdminLoggedIn && (
              <TabsContent value="admin" className="space-y-4 sm:space-y-6">
                <Card className="w-full">
                  <CardHeader className="pb-3 sm:pb-4">
                    <CardTitle className="text-lg sm:text-xl md:text-2xl flex items-center gap-2">
                      <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                      Painel Administrativo
                    </CardTitle>
                    <CardDescription className="text-sm sm:text-base">
                      Você está logado como administrador e tem acesso total a todos os registros
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-green-900 mb-1">Acesso Administrativo Ativo</h4>
                          <p className="text-sm text-green-700">
                            Você está visualizando <strong>TODOS</strong> os pedidos e ingressos do sistema.
                          </p>
                          <p className="text-sm text-green-700 mt-2">
                            Usuários normais veem apenas seus próprios registros.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="font-semibold text-blue-900 mb-2">Funcionalidades Admin</h4>
                        <ul className="text-sm text-blue-700 space-y-1">
                          <li>✅ Ver todos os pedidos e ingressos</li>
                          <li>✅ Excluir registros (múltipla seleção)</li>
                          <li>✅ Acesso completo ao sistema</li>
                        </ul>
                      </div>
                      
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h4 className="font-semibold text-yellow-900 mb-2">Atenção</h4>
                        <p className="text-sm text-yellow-700">
                          As ações realizadas aqui afetam todo o sistema. Use com cuidado.
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <Button
                        variant="outline"
                        onClick={async () => {
                          await logoutAdmin();
                          setActiveTab('info');
                        }}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50"
                      >
                        Sair do Modo Admin
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

          </Tabs>
        </div>
      </div>

      {/* Modal para visualizar detalhes do ticket */}
      {selectedTicket && (
        <TicketModal
          isOpen={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
          ticket={selectedTicket}
        />
      )}

      <AdminAccessModal 
      isOpen={showAdminModal} 
      onClose={() => setShowAdminModal(false)} 
    />
    
    <Footer />
  </div>
);
};

export default Profile;
