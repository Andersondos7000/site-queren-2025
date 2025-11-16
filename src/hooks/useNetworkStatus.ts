import { useState, useEffect } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  isOffline: boolean;
  connectionType: string;
  effectiveType: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  lastOfflineAt?: Date | null;
  offlineDuration?: number;
  reconnectAttempts?: number;
}

export function useNetworkStatus(): NetworkStatus {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(() => {
    // Estado inicial baseado no navigator
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const connection = (navigator as any)?.connection || (navigator as any)?.mozConnection || (navigator as any)?.webkitConnection;
    
    return {
      isOnline,
      isOffline: !isOnline,
      connectionType: connection?.type || 'unknown',
      effectiveType: connection?.effectiveType || '4g',
      downlink: connection?.downlink,
      rtt: connection?.rtt,
      saveData: connection?.saveData,
      lastOfflineAt: null,
      offlineDuration: 0,
      reconnectAttempts: 0
    };
  });

  useEffect(() => {
    const updateNetworkStatus = () => {
      const isOnline = navigator.onLine;
      const connection = (navigator as any)?.connection || (navigator as any)?.mozConnection || (navigator as any)?.webkitConnection;
      
      setNetworkStatus(prev => {
        const now = new Date();
        let lastOfflineAt = prev.lastOfflineAt;
        let offlineDuration = prev.offlineDuration || 0;
        let reconnectAttempts = prev.reconnectAttempts || 0;
        
        // Se estava offline e agora está online
        if (!prev.isOnline && isOnline) {
          if (lastOfflineAt) {
            offlineDuration = now.getTime() - lastOfflineAt.getTime();
          }
          reconnectAttempts += 1;
        }
        
        // Se ficou offline agora
        if (prev.isOnline && !isOnline) {
          lastOfflineAt = now;
        }
        
        // Se voltou online, limpar lastOfflineAt após um tempo
        if (isOnline) {
          setTimeout(() => {
            setNetworkStatus(current => ({
              ...current,
              lastOfflineAt: null,
              offlineDuration: 0
            }));
          }, 5000); // Limpar após 5 segundos
        }
        
        return {
          isOnline,
          isOffline: !isOnline,
          connectionType: connection?.type || 'unknown',
          effectiveType: connection?.effectiveType || '4g',
          downlink: connection?.downlink,
          rtt: connection?.rtt,
          saveData: connection?.saveData,
          lastOfflineAt,
          offlineDuration,
          reconnectAttempts
        };
      });
    };

    const handleOnline = () => {
      updateNetworkStatus();
    };

    const handleOffline = () => {
      updateNetworkStatus();
    };

    const handleConnectionChange = () => {
      updateNetworkStatus();
    };

    // Event listeners para mudanças de conectividade
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Event listeners para mudanças na qualidade da conexão
    const connection = (navigator as any)?.connection || (navigator as any)?.mozConnection || (navigator as any)?.webkitConnection;
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, []);

  return networkStatus;
}

// Hook para detectar mudanças específicas na conectividade
export function useConnectivityChange(callback: (isOnline: boolean) => void) {
  const { isOnline } = useNetworkStatus();
  const [previousOnlineStatus, setPreviousOnlineStatus] = useState(isOnline);

  useEffect(() => {
    if (previousOnlineStatus !== isOnline) {
      callback(isOnline);
      setPreviousOnlineStatus(isOnline);
    }
  }, [isOnline, previousOnlineStatus, callback]);
}

// Hook para detectar conexões lentas
export function useSlowConnection(threshold: number = 1): boolean {
  const { effectiveType, downlink } = useNetworkStatus();
  
  return effectiveType === 'slow-2g' || 
         effectiveType === '2g' || 
         (downlink !== undefined && downlink < threshold);
}

// Hook para detectar modo de economia de dados
export function useDataSaver(): boolean {
  const { saveData } = useNetworkStatus();
  return saveData || false;
}