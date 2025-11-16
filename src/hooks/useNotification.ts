import { useCallback } from 'react';

export interface NotificationOptions {
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface UseNotificationReturn {
  showNotification: (message: string, options?: NotificationOptions) => void;
  hideNotification: (id?: string) => void;
  clearAllNotifications: () => void;
}

/**
 * Hook para exibir notificações toast
 * Integra com sistema de notificações do navegador quando disponível
 */
export function useNotification(): UseNotificationReturn {
  const showNotification = useCallback((message: string, options: NotificationOptions = {}) => {
    const {
      type = 'info',
      duration = 5000,
      persistent = false,
      action
    } = options;

    // Tentar usar notificações nativas do navegador
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(message, {
        icon: '/logo-topo.svg',
      badge: '/logo-topo.svg',
        tag: `notification-${Date.now()}`,
        requireInteraction: persistent
      });

      if (!persistent && duration > 0) {
        setTimeout(() => {
          notification.close();
        }, duration);
      }

      if (action) {
        notification.onclick = action.onClick;
      }
    } else {
      // Fallback para console.log em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${type.toUpperCase()}] ${message}`);
      }

      // Aqui você pode integrar com uma biblioteca de toast como react-hot-toast
      // ou implementar seu próprio sistema de notificações
    }
  }, []);

  const hideNotification = useCallback((id?: string) => {
    // Implementar lógica para esconder notificação específica
    if (process.env.NODE_ENV === 'development') {
      console.log(`Hiding notification: ${id || 'latest'}`);
    }
  }, []);

  const clearAllNotifications = useCallback(() => {
    // Implementar lógica para limpar todas as notificações
    if (process.env.NODE_ENV === 'development') {
      console.log('Clearing all notifications');
    }
  }, []);

  return {
    showNotification,
    hideNotification,
    clearAllNotifications
  };
}

/**
 * Hook para solicitar permissão de notificações
 */
export function useNotificationPermission() {
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      console.warn('Este navegador não suporta notificações');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      return 'denied';
    }

    // Solicitar permissão
    const permission = await Notification.requestPermission();
    return permission;
  }, []);

  return {
    permission: 'Notification' in window ? Notification.permission : 'denied',
    requestPermission
  };
}

/**
 * Tipos para notificações do sistema
 */
export interface SystemNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: Date;
  read: boolean;
  persistent: boolean;
  metadata?: Record<string, any>;
}

/**
 * Hook para gerenciar notificações do sistema (persistentes)
 */
export function useSystemNotifications() {
  // Este hook pode ser expandido para integrar com um sistema de notificações
  // persistentes usando Supabase ou localStorage
  
  const addSystemNotification = useCallback((notification: Omit<SystemNotification, 'id' | 'timestamp' | 'read'>) => {
    const systemNotification: SystemNotification = {
      ...notification,
      id: `sys-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date(),
      read: false
    };

    // Aqui você implementaria a lógica para salvar no Supabase ou localStorage
    console.log('System notification added:', systemNotification);
    
    return systemNotification;
  }, []);

  return {
    addSystemNotification
  };
}