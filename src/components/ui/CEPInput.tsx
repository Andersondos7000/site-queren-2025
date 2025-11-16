import React, { useEffect, useState } from 'react';
import { Loader2, MapPin, AlertCircle, CheckCircle } from 'lucide-react';
import { useCEP, AddressData } from '@/hooks/useCEP';

export interface CEPInputProps {
  value: string;
  onChange: (value: string) => void;
  onAddressFound?: (address: AddressData) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  error?: string;
}

/**
 * Componente de input para CEP com busca automática de endereço
 * Utiliza a API ViaCEP para preenchimento automático dos dados de endereço
 */
export const CEPInput: React.FC<CEPInputProps> = ({
  value,
  onChange,
  onAddressFound,
  placeholder = "00000-000",
  className = "",
  disabled = false,
  required = false,
  label = "CEP",
  error: externalError,
}) => {
  const { loading, error, searchCEP, clearError, formatCEP, isValidCEP } = useCEP();
  const [hasSearched, setHasSearched] = useState(false);

  // Estado para controlar quando fazer a busca automática
  useEffect(() => {
    const cleanCEP = value.replace(/\D/g, '');
    
    // Busca automática quando CEP atingir 8 dígitos
    if (cleanCEP.length === 8 && !hasSearched) {
      setHasSearched(true);
      searchCEP(cleanCEP).then((addressData) => {
        if (addressData && onAddressFound) {
          onAddressFound(addressData);
        }
      });
    }
    
    // Reset do estado quando CEP for alterado
    if (cleanCEP.length !== 8) {
      setHasSearched(false);
      clearError();
    }
  }, [value, hasSearched, searchCEP, onAddressFound, clearError]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatCEP(e.target.value);
    onChange(formattedValue);
  };

  const getInputStatus = () => {
    const cleanCEP = value.replace(/\D/g, '');
    
    if (loading) return 'loading';
    if (error || externalError) return 'error';
    if (cleanCEP.length === 8 && hasSearched && !error) return 'success';
    return 'default';
  };

  const getStatusIcon = () => {
    const status = getInputStatus();
    
    switch (status) {
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <MapPin className="h-4 w-4 text-gray-400" />;
    }
  };

  const getInputClasses = () => {
    const status = getInputStatus();
    const baseClasses = "w-full pl-10 pr-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors";
    
    switch (status) {
      case 'loading':
        return `${baseClasses} border-blue-300 focus:ring-blue-500 focus:border-blue-500`;
      case 'error':
        return `${baseClasses} border-red-300 focus:ring-red-500 focus:border-red-500`;
      case 'success':
        return `${baseClasses} border-green-300 focus:ring-green-500 focus:border-green-500`;
      default:
        return `${baseClasses} border-gray-300 focus:ring-blue-500 focus:border-blue-500`;
    }
  };

  const getStatusMessage = () => {
    if (loading) return "Buscando endereço...";
    if (error) {
      return error === 'CEP não encontrado'
        ? 'CEP não encontrado. Preencha o endereço manualmente.'
        : error;
    }
    if (externalError) return externalError;
    
    const cleanCEP = value.replace(/\D/g, '');
    if (cleanCEP.length === 8 && hasSearched && !error) {
      return "Endereço encontrado!";
    }
    
    return null;
  };

  const statusMessage = getStatusMessage();
  const status = getInputStatus();

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      {/* Input Container */}
      <div className="relative">
        {/* Icon */}
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {getStatusIcon()}
        </div>
        
        {/* Input */}
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled || loading}
          maxLength={9}
          className={`${getInputClasses()} ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`}
        />
      </div>
      
      {/* Status Message */}
      {statusMessage && (
        <div className={`text-sm flex items-center gap-1 ${
          status === 'error' ? 'text-red-600' : 
          status === 'success' ? 'text-green-600' : 
          status === 'loading' ? 'text-blue-600' : 
          'text-gray-600'
        }`}>
          {status === 'loading' && <Loader2 className="h-3 w-3 animate-spin" />}
          {statusMessage}
        </div>
      )}
      
      {/* Help Text */}
      {!statusMessage && (
        <p className="text-xs text-gray-500">
          Digite o CEP para buscar o endereço automaticamente
        </p>
      )}
    </div>
  );
};