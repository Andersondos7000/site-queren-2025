import { useState, useCallback } from 'react';

export interface CEPData {
  cep: string;
  logradouro: string;
  complemento?: string;
  bairro: string;
  localidade: string; // cidade
  uf: string; // estado
  ibge?: string;
  gia?: string;
  ddd?: string;
  siafi?: string;
}

export interface AddressData {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export interface UseCEPReturn {
  loading: boolean;
  error: string | null;
  addressData: AddressData | null;
  searchCEP: (cep: string) => Promise<AddressData | null>;
  clearError: () => void;
  formatCEP: (value: string) => string;
  isValidCEP: (cep: string) => boolean;
}

/**
 * Hook personalizado para busca automática de endereço via CEP
 * Utiliza a API ViaCEP para obter dados de endereço
 */
export const useCEP = (): UseCEPReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressData, setAddressData] = useState<AddressData | null>(null);

  /**
   * Formata o CEP adicionando hífen se necessário
   */
  const formatCEP = useCallback((value: string): string => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 5) {
      return numbers;
    }
    return numbers.replace(/(\d{5})(\d{3})/, '$1-$2');
  }, []);

  /**
   * Valida se o CEP tem o formato correto (8 dígitos)
   */
  const isValidCEP = useCallback((cep: string): boolean => {
    const cleanCEP = cep.replace(/\D/g, '');
    return cleanCEP.length === 8;
  }, []);

  /**
   * Limpa o erro atual
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Busca dados de endereço via CEP na API ViaCEP
   */
  const searchCEP = useCallback(async (cep: string): Promise<AddressData | null> => {
    const cleanCEP = cep.replace(/\D/g, '');
    
    // Validação básica
    if (!isValidCEP(cleanCEP)) {
      setError('CEP deve conter 8 dígitos');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      const data: CEPData = await response.json();

      // Verifica se o CEP foi encontrado
      if ('erro' in data) {
        setError('CEP não encontrado');
        setAddressData(null);
        return null;
      }

      // Mapeia os dados da API para o formato esperado
      const addressResult: AddressData = {
        cep: formatCEP(data.cep),
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        estado: data.uf || '',
      };

      setAddressData(addressResult);
      return addressResult;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar CEP';
      setError(errorMessage);
      setAddressData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [formatCEP, isValidCEP]);

  return {
    loading,
    error,
    addressData,
    searchCEP,
    clearError,
    formatCEP,
    isValidCEP,
  };
};