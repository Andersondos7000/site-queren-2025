import { useState, useEffect, useCallback } from 'react';

/**
 * Hook para detectar qualidade e status da conexão
 */
export function useConnectivityDetection() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'offline'>('good');
  const [lastOnlineTime, setLastOnlineTime] = useState<Date | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Detectar mudanças de conectividade
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineTime(new Date());
      setReconnectAttempts(0);
      testConnectionQuality();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setConnectionQuality('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Teste inicial
    if (navigator.onLine) {
      testConnectionQuality();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Testar qualidade da conexão
  const testConnectionQuality = useCallback(async () => {
    if (!navigator.onLine) {
      setConnectionQuality('offline');
      return;
    }

    try {
      const start = Date.now();
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      const latency = Date.now() - start;

      if (response.ok && latency < 1000) {
        setConnectionQuality('good');
      } else {
        setConnectionQuality('poor');
      }
    } catch (error) {
      setConnectionQuality('poor');
    }
  }, []);

  // Tentar reconectar
  const attemptReconnect = useCallback(async () => {
    setReconnectAttempts(prev => prev + 1);
    await testConnectionQuality();
  }, [testConnectionQuality]);

  return {
    isOnline,
    connectionQuality,
    lastOnlineTime,
    reconnectAttempts,
    testConnectionQuality,
    attemptReconnect
  };
}