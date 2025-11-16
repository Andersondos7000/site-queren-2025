// 🔗 Gerador de QR Codes para Tickets
// Data: 31 de Janeiro de 2025

import { ConfiguracaoQRCode } from '../types/tickets';

/**
 * Gera dados estruturados para um QR code de ticket
 * @param ticketId ID único do ticket
 * @param eventId ID do evento
 * @param customerId ID do cliente (opcional)
 * @returns String JSON com dados estruturados do ticket
 */
export function gerarQRCodeTicket(
  ticketId: string,
  eventId: string,
  customerId?: string
): string {
  // Dados que serão codificados no QR code - apenas ticket_id
  const dadosTicket = {
    ticket_id: ticketId
  };

  // Retornar dados estruturados como JSON
  return JSON.stringify(dadosTicket);
}

/**
 * Gera URL de imagem QR code a partir dos dados estruturados
 * @param qrData Dados estruturados do QR code
 * @param size Tamanho da imagem (ex: '200x200')
 * @returns URL da imagem QR code
 */
export function gerarImagemQRCode(
  qrData: string,
  size: string = '200x200'
): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodeURIComponent(qrData)}`;
}

/**
 * Gera um código de validação simples para o ticket
 * @param ticketId ID do ticket
 * @param eventId ID do evento
 * @returns Código de validação de 8 caracteres
 */
export function gerarCodigoValidacao(ticketId: string, eventId: string): string {
  // Combinar IDs e gerar hash simples
  const combined = `${ticketId}-${eventId}`;
  let hash = 0;
  
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Converter para 32bit integer
  }
  
  // Converter para string alfanumérica de 8 caracteres
  const codigo = Math.abs(hash).toString(36).toUpperCase().padStart(8, '0').slice(0, 8);
  
  return codigo;
}

/**
 * Valida se um QR code contém dados válidos de ticket
 * @param qrData Dados decodificados do QR code
 * @returns true se válido, false caso contrário
 */
export function validarQRCodeTicket(qrData: string): boolean {
  try {
    const dados = JSON.parse(qrData);
    
    // Verificar se contém campos obrigatórios
    const camposObrigatorios = ['ticket_id', 'event_id', 'timestamp'];
    const temTodosCampos = camposObrigatorios.every(campo => dados[campo]);
    
    if (!temTodosCampos) {
      return false;
    }
    
    // Verificar se timestamp não é muito antigo (ex: mais de 1 ano)
    const timestampTicket = new Date(dados.timestamp);
    const agora = new Date();
    const umAnoAtras = new Date(agora.getFullYear() - 1, agora.getMonth(), agora.getDate());
    
    if (timestampTicket < umAnoAtras) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao validar QR code:', error);
    return false;
  }
}

/**
 * Extrai dados do ticket de um QR code
 * @param qrData Dados do QR code
 * @returns Dados do ticket ou null se inválido
 */
export function extrairDadosQRCode(qrData: string): {
  ticket_id: string;
} | null {
  try {
    if (!validarQRCodeTicket(qrData)) {
      return null;
    }
    
    return JSON.parse(qrData);
  } catch (error) {
    console.error('Erro ao extrair dados do QR code:', error);
    return null;
  }
}

/**
 * Gera ID único para ticket usando UUID
 * @returns ID único do ticket (UUID)
 */
export function gerarIdTicket(): string {
  return crypto.randomUUID();
}

/**
 * Gera QR Code em formato base64 (Data URL)
 * @param qrData Dados estruturados do QR code
 * @param size Tamanho da imagem (padrão: 200)
 * @returns Promise com QR Code em base64 ou null se houver erro
 */
export async function gerarQRCodeBase64(
  qrData: string,
  size: number = 200
): Promise<string | null> {
  try {
    // Importação dinâmica da biblioteca qrcode
    const QRCode = await import('qrcode');
    
    // Gerar QR Code como Data URL (base64)
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    return qrCodeDataURL;
  } catch (error) {
    console.error('Erro ao gerar QR Code em base64:', error);
    return null;
  }
}

/**
 * Gera QR Code completo para ticket em base64
 * @param ticketId ID único do ticket
 * @param eventId ID do evento
 * @param customerId ID do cliente (opcional)
 * @param size Tamanho da imagem (padrão: 200)
 * @returns Promise com QR Code em base64 ou null se houver erro
 */
export async function gerarQRCodeTicketBase64(
  ticketId: string,
  eventId: string,
  customerId?: string,
  size: number = 200
): Promise<string | null> {
  try {
    // Gerar dados estruturados do ticket
    const dadosTicket = gerarQRCodeTicket(ticketId, eventId, customerId);
    
    // Gerar QR Code em base64
    const qrCodeBase64 = await gerarQRCodeBase64(dadosTicket, size);
    
    return qrCodeBase64;
  } catch (error) {
    console.error('Erro ao gerar QR Code do ticket em base64:', error);
    return null;
  }
}