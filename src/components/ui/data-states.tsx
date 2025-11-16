import React from 'react';
import { AlertTriangle, RefreshCw, Database, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface DataErrorFallbackProps {
  error: Error;
  retry: () => void;
  fallbackData?: any[];
  title?: string;
  description?: string;
}

export const DataErrorFallback: React.FC<DataErrorFallbackProps> = ({ 
  error, 
  retry, 
  fallbackData,
  title = 'Erro ao carregar dados',
  description = 'Não foi possível carregar os dados. Verifique sua conexão e tente novamente.'
}) => {
  const errorMessage = error?.message || error?.toString() || 'Erro desconhecido';
  
  const isNetworkError = errorMessage.includes('Failed to fetch') || 
                        errorMessage.includes('NetworkError') ||
                        errorMessage.includes('ECONNREFUSED');
  
  const isDatabaseError = errorMessage.includes('database') || 
                          errorMessage.includes('supabase') ||
                          errorMessage.includes('permission denied');

  const getErrorIcon = () => {
    if (isNetworkError) return <WifiOff className="w-6 h-6" />;
    if (isDatabaseError) return <Database className="w-6 h-6" />;
    return <AlertTriangle className="w-6 h-6" />;
  };

  const getErrorTitle = () => {
    if (isNetworkError) return 'Problema de Conexão';
    if (isDatabaseError) return 'Erro no Banco de Dados';
    return title;
  };

  const getErrorDescription = () => {
    if (isNetworkError) return 'Verifique sua conexão com a internet e tente novamente.';
    if (isDatabaseError) return 'Houve um problema ao acessar o banco de dados. Nossa equipe foi notificada.';
    return description;
  };

  return (
    <div className="w-full">
      <Alert variant="destructive" className="mb-4">
        <div className="flex items-start gap-3">
          {getErrorIcon()}
          <div className="flex-1">
            <AlertTitle>{getErrorTitle()}</AlertTitle>
            <AlertDescription>{getErrorDescription()}</AlertDescription>
          </div>
        </div>
      </Alert>

      {fallbackData && fallbackData.length > 0 && (
        <Card className="mb-4 border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              Dados de Exibição
            </CardTitle>
            <CardDescription className="text-xs">
              Mostrando dados de exemplo enquanto resolvemos o problema.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="flex gap-2">
        <Button onClick={retry} size="sm" className="flex-1">
          <RefreshCw className="w-4 h-4 mr-2" />
          Tentar Novamente
        </Button>
      </div>
    </div>
  );
};

interface LoadingFallbackProps {
  message?: string;
  submessage?: string;
}

export const LoadingFallback: React.FC<LoadingFallbackProps> = ({ 
  message = 'Carregando...',
  submessage = 'Aguarde um momento'
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
      <p className="text-lg font-medium">{message}</p>
      <p className="text-sm text-gray-500">{submessage}</p>
    </div>
  );
};

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Nenhum dado encontrado',
  description = 'Não há itens para exibir no momento.',
  icon = <AlertTriangle className="w-12 h-12 text-gray-400" />,
  action
}) => {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center p-8 text-center">
        <div className="mb-4">{icon}</div>
        <h3 className="text-lg font-medium mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-4 max-w-sm">{description}</p>
        {action && (
          <Button onClick={action.onClick} size="sm">
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};