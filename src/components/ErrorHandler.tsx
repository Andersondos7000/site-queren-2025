import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ErrorHandler: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const error = searchParams.get('error');
    const errorCode = searchParams.get('error_code');
    const errorDescription = searchParams.get('error_description');

    if (error || errorCode || errorDescription) {
      let message = 'Erro no servidor';

      if (errorDescription) {
        message = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
      } else if (errorCode) {
        switch (errorCode) {
          case 'unexpected_failure':
            message = 'Falha inesperada no servidor';
            break;
          case 'database_error':
            message = 'Erro no banco de dados';
            break;
          case 'server_error':
            message = 'Erro interno do servidor';
            break;
          default:
            message = `Erro: ${errorCode}`;
        }
      } else if (error) {
        switch (error) {
          case 'server_error':
            message = 'Erro interno do servidor';
            break;
          case 'auth_error':
            message = 'Erro de autenticação';
            break;
          case 'validation_error':
            message = 'Erro de validação';
            break;
          default:
            message = `Erro: ${error}`;
        }
      }

      setErrorMessage(message);
      setIsVisible(true);

      // Limpar parâmetros da URL após capturar o erro
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('error');
      newUrl.searchParams.delete('error_code');
      newUrl.searchParams.delete('error_description');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [searchParams]);

  const handleClose = () => {
    setIsVisible(false);
    setErrorMessage('');
  };

  if (!isVisible || !errorMessage) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
      <Alert className="bg-red-50 border-red-200 text-red-800">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span className="flex-1 pr-2">{errorMessage}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-6 w-6 p-0 text-red-600 hover:text-red-800 hover:bg-red-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default ErrorHandler;