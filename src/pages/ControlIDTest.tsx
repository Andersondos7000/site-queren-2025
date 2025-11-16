import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, QrCode, Key, Clock, Settings } from "lucide-react";
import { supabase } from '@/lib/supabase';

/**
 * Página de Teste para Integração com Control iD API
 * 
 * Esta página demonstra como integrar os ingressos com o sistema de controle de acesso
 * da Control iD usando QR Codes dinâmicos (TOTP) ou QR Codes estáticos.
 * 
 * Documentação: https://www.controlid.com.br/docs/access-api-pt/particularidade-dos-produtos/qr-code/
 */

interface ControlIDConfig {
  baseUrl: string;
  session: string;
  totpEnabled: boolean;
  totpWindowSize: number;
  totpWindowNum: number;
  totpSingleUse: boolean;
  totpTzOffset: number;
  qrcodeMode: 'numeric' | 'hex' | 'alphanumeric';
}

interface TicketQRData {
  ticketId: string;
  orderId: string;
  seatNumber: string;
  cardValue: number; // 40 bits (5 bytes) - número do cartão/ingresso
  secret: string; // Hash para TOTP
  qrCode: string; // QR Code gerado
  otpCode?: number; // Código OTP atual (24 bits)
}

const ControlIDTest: React.FC = () => {
  const [config, setConfig] = useState<ControlIDConfig>({
    baseUrl: 'http://192.168.1.100', // IP do equipamento Control iD
    session: '',
    totpEnabled: true,
    totpWindowSize: 30, // 30 segundos por janela
    totpWindowNum: 5, // 5 janelas (2 anteriores, atual, 2 seguintes)
    totpSingleUse: true,
    totpTzOffset: 0,
    qrcodeMode: 'numeric'
  });

  const [ticketData, setTicketData] = useState<TicketQRData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  // Função para fazer login na API Control iD
  const loginControlID = async () => {
    setLoading(true);
    setError(null);
    setConnectionStatus('connecting');

    try {
      // Exemplo de requisição de login
      const response = await fetch(`${config.baseUrl}/login.fcgi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login: 'admin', // Usuário admin do equipamento
          password: 'admin' // Senha admin do equipamento
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao conectar com o equipamento Control iD');
      }

      const data = await response.json();
      
      if (data.session) {
        setConfig(prev => ({ ...prev, session: data.session }));
        setConnectionStatus('connected');
        setSuccess('Conectado com sucesso ao equipamento Control iD');
      } else {
        throw new Error('Sessão não retornada');
      }
    } catch (err: any) {
      setError(`Erro ao conectar: ${err.message}`);
      setConnectionStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  // Função para configurar modo de QR Code no equipamento
  const configureQRCodeMode = async () => {
    if (!config.session) {
      setError('Faça login primeiro');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Determinar o módulo baseado no modo
      const module = config.qrcodeMode === 'alphanumeric' ? 'barras' : 'face_id';
      const legacyMode = config.qrcodeMode === 'numeric' ? '1' : config.qrcodeMode === 'hex' ? '2' : '0';

      const response = await fetch(`${config.baseUrl}/set_configuration.fcgi?session=${config.session}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          [module]: {
            qrcode_legacy_mode_enabled: legacyMode
          }
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao configurar modo de QR Code');
      }

      setSuccess(`Modo de QR Code configurado: ${config.qrcodeMode}`);
    } catch (err: any) {
      setError(`Erro ao configurar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Função para configurar TOTP no equipamento
  const configureTOTP = async () => {
    if (!config.session) {
      setError('Faça login primeiro');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.baseUrl}/set_configuration.fcgi?session=${config.session}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          face_id: {
            totp_enabled: config.totpEnabled ? '1' : '0',
            totp_window_size: config.totpWindowSize.toString(),
            totp_window_num: config.totpWindowNum.toString(),
            totp_single_use: config.totpSingleUse ? '1' : '0',
            totp_tz_offset: config.totpTzOffset.toString()
          }
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao configurar TOTP');
      }

      setSuccess('TOTP configurado com sucesso');
    } catch (err: any) {
      setError(`Erro ao configurar TOTP: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Função para buscar um ticket do banco de dados
  const fetchTicketFromDB = async (ticketId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: dbError } = await supabase
        .from('tickets')
        .select(`
          id,
          order_id,
          seat_number,
          qr_code,
          ticket_number,
          events (id, name)
        `)
        .eq('id', ticketId)
        .single();

      if (dbError) throw dbError;
      if (!data) throw new Error('Ticket não encontrado');

      // Gerar card_value a partir do seat_number (40 bits máximo)
      const seatNum = parseInt(data.seat_number || '0', 10);
      const cardValue = seatNum || parseInt(data.id.replace(/-/g, '').substring(0, 10), 16) % 1000000000000;

      // Gerar secret a partir do ticket_id (hash simples)
      const secret = data.id.substring(0, 6).replace(/-/g, '');

      setTicketData({
        ticketId: data.id,
        orderId: data.order_id || '',
        seatNumber: data.seat_number || '',
        cardValue,
        secret,
        qrCode: data.qr_code || ''
      });

      setSuccess('Ticket carregado com sucesso');
    } catch (err: any) {
      setError(`Erro ao buscar ticket: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Função para gerar código OTP usando TOTP (simulação)
  const generateOTP = (secret: string, windowSize: number = 30): number => {
    // Implementação simplificada de TOTP
    // Em produção, usar biblioteca como 'otplib' ou 'speakeasy'
    const time = Math.floor(Date.now() / 1000 / windowSize);
    const hash = secret.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const otp = ((hash * time) % 1000000);
    return otp;
  };

  // Função para gerar QR Code dinâmico (TOTP)
  const generateDynamicQRCode = () => {
    if (!ticketData) {
      setError('Carregue um ticket primeiro');
      return;
    }

    try {
      // Gerar código OTP (24 bits = 3 bytes)
      const otpCode = generateOTP(ticketData.secret, config.totpWindowSize);
      
      // QR Code = 64 bits = 24 bits (OTP) + 40 bits (card_value)
      // Converter para número de 64 bits
      const qrValue = (otpCode << 40) | ticketData.cardValue;
      
      setTicketData(prev => prev ? {
        ...prev,
        otpCode,
        qrCode: qrValue.toString()
      } : null);

      setSuccess('QR Code dinâmico gerado com sucesso');
    } catch (err: any) {
      setError(`Erro ao gerar QR Code: ${err.message}`);
    }
  };

  // Função para cadastrar ticket como card no equipamento Control iD
  const registerTicketAsCard = async () => {
    if (!config.session) {
      setError('Faça login primeiro');
      return;
    }

    if (!ticketData) {
      setError('Carregue um ticket primeiro');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Cadastrar como card no equipamento
      const response = await fetch(`${config.baseUrl}/create_objects.fcgi?session=${config.session}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          object: 'cards',
          values: [
            {
              value: ticketData.cardValue,
              user_id: 1, // ID do usuário no equipamento (pode ser dinâmico)
              secret: ticketData.secret
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao cadastrar ticket no equipamento');
      }

      setSuccess('Ticket cadastrado no equipamento Control iD com sucesso');
    } catch (err: any) {
      setError(`Erro ao cadastrar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Função para validar QR Code no equipamento (simulação)
  const validateQRCode = async () => {
    if (!config.session) {
      setError('Faça login primeiro');
      return;
    }

    if (!ticketData || !ticketData.qrCode) {
      setError('Gere um QR Code primeiro');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Simulação: Em produção, o equipamento validaria automaticamente ao ler o QR Code
      // Aqui apenas simulamos a validação
      await new Promise(resolve => setTimeout(resolve, 1000));

      setSuccess(`QR Code validado! Valor: ${ticketData.qrCode}`);
    } catch (err: any) {
      setError(`Erro ao validar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Teste de Integração Control iD API
          </h1>
          <p className="text-gray-600">
            Página de testes para integração com sistema de controle de acesso Control iD
            usando QR Codes dinâmicos (TOTP) para validação de ingressos.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Documentação: <a 
              href="https://www.controlid.com.br/docs/access-api-pt/particularidade-dos-produtos/qr-code/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Control iD QR Code API
            </a>
          </p>
        </div>

        {/* Status de Conexão */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Status de Conexão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {connectionStatus === 'connected' ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-green-600 font-medium">Conectado</span>
                  </>
                ) : connectionStatus === 'connecting' ? (
                  <>
                    <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />
                    <span className="text-yellow-600 font-medium">Conectando...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-600 font-medium">Desconectado</span>
                  </>
                )}
              </div>
              <Button onClick={loginControlID} disabled={loading || connectionStatus === 'connected'}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Conectar ao Equipamento
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Configurações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações do Equipamento
            </CardTitle>
            <CardDescription>
              Configure o modo de QR Code e parâmetros TOTP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="baseUrl">URL do Equipamento</Label>
                <Input
                  id="baseUrl"
                  value={config.baseUrl}
                  onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder="http://192.168.1.100"
                />
              </div>

              <div>
                <Label htmlFor="qrcodeMode">Modo de QR Code</Label>
                <select
                  id="qrcodeMode"
                  value={config.qrcodeMode}
                  onChange={(e) => setConfig(prev => ({ ...prev, qrcodeMode: e.target.value as any }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="numeric">Numérico (Padrão)</option>
                  <option value="hex">Hexadecimal</option>
                  <option value="alphanumeric">Alfanumérico</option>
                </select>
              </div>

              <div>
                <Label htmlFor="totpWindowSize">Janela TOTP (segundos)</Label>
                <Input
                  id="totpWindowSize"
                  type="number"
                  value={config.totpWindowSize}
                  onChange={(e) => setConfig(prev => ({ ...prev, totpWindowSize: parseInt(e.target.value) }))}
                />
              </div>

              <div>
                <Label htmlFor="totpWindowNum">Quantidade de Janelas</Label>
                <Input
                  id="totpWindowNum"
                  type="number"
                  value={config.totpWindowNum}
                  onChange={(e) => setConfig(prev => ({ ...prev, totpWindowNum: parseInt(e.target.value) }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="totpEnabled"
                checked={config.totpEnabled}
                onChange={(e) => setConfig(prev => ({ ...prev, totpEnabled: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="totpEnabled">Habilitar TOTP</Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="totpSingleUse"
                checked={config.totpSingleUse}
                onChange={(e) => setConfig(prev => ({ ...prev, totpSingleUse: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="totpSingleUse">Uso Único (Single Use)</Label>
            </div>

            <div className="flex gap-2">
              <Button onClick={configureQRCodeMode} disabled={!config.session || loading}>
                Configurar Modo QR Code
              </Button>
              <Button onClick={configureTOTP} disabled={!config.session || loading}>
                Configurar TOTP
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Gerenciamento de Tickets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Gerenciamento de Tickets
            </CardTitle>
            <CardDescription>
              Carregue um ticket do banco de dados e gere QR Codes para validação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="ticketId">ID do Ticket</Label>
              <div className="flex gap-2">
                <Input
                  id="ticketId"
                  placeholder="UUID do ticket"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value) {
                      fetchTicketFromDB(e.currentTarget.value);
                    }
                  }}
                />
                <Button onClick={() => {
                  const input = document.getElementById('ticketId') as HTMLInputElement;
                  if (input.value) fetchTicketFromDB(input.value);
                }}>
                  Carregar Ticket
                </Button>
              </div>
            </div>

            {ticketData && (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Ticket ID</Label>
                    <p className="text-sm font-mono">{ticketData.ticketId.substring(0, 20)}...</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Assento</Label>
                    <p className="text-sm font-medium">{ticketData.seatNumber}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Card Value (40 bits)</Label>
                    <p className="text-sm font-mono">{ticketData.cardValue}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Secret</Label>
                    <p className="text-sm font-mono">{ticketData.secret}</p>
                  </div>
                  {ticketData.otpCode && (
                    <div>
                      <Label className="text-xs text-gray-500">OTP Code (24 bits)</Label>
                      <p className="text-sm font-mono">{ticketData.otpCode}</p>
                    </div>
                  )}
                  {ticketData.qrCode && (
                    <div>
                      <Label className="text-xs text-gray-500">QR Code (64 bits)</Label>
                      <p className="text-sm font-mono break-all">{ticketData.qrCode}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={generateDynamicQRCode} variant="outline">
                    <Clock className="h-4 w-4 mr-2" />
                    Gerar QR Code Dinâmico
                  </Button>
                  <Button onClick={registerTicketAsCard} disabled={!config.session || loading}>
                    <Key className="h-4 w-4 mr-2" />
                    Cadastrar no Equipamento
                  </Button>
                  <Button onClick={validateQRCode} disabled={!config.session || loading} variant="outline">
                    Validar QR Code
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alertas */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* Informações Técnicas */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Técnicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-600">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Modos de QR Code:</h3>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Numérico:</strong> QR Code com conteúdo numérico de 64 bits, armazenado como objeto tipo "cards"</li>
                <li><strong>Hexadecimal:</strong> QR Code numérico hexadecimal de 64 bits, interpretado como decimal</li>
                <li><strong>Alfanumérico:</strong> Aceita caracteres alfanuméricos, armazenado como objeto tipo "qrcodes"</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">QR Code Dinâmico (TOTP):</h3>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Card Value:</strong> 40 bits (5 bytes) - Identificador único do ingresso</li>
                <li><strong>OTP Code:</strong> 24 bits (3 bytes) - Código temporário gerado via TOTP</li>
                <li><strong>QR Code Total:</strong> 64 bits = 24 bits (OTP) + 40 bits (Card Value)</li>
                <li>O código OTP renova a cada janela de tempo configurada (padrão: 30 segundos)</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Fluxo de Validação:</h3>
              <ol className="list-decimal list-inside space-y-1">
                <li>Usuário apresenta QR Code no leitor do equipamento</li>
                <li>Equipamento extrai OTP (24 bits) e Card Value (40 bits)</li>
                <li>Equipamento busca card cadastrado pelo Card Value</li>
                <li>Equipamento gera OTP equivalente usando o secret e janela atual</li>
                <li>Equipamento compara OTP recebido com OTP gerado</li>
                <li>Se válido, libera acesso e marca como usado (se single_use habilitado)</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ControlIDTest;






