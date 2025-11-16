import { renderHook, act } from '@testing-library/react';
import { useAuth } from '../hooks/useAuth';
import { AuthProvider } from '../contexts/AuthProvider';
import { rateLimitClient } from '../lib/rateLimitClient';
import { redisClient } from '../lib/redis/redisClient';
import React from 'react';

// Mock do Supabase
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signInWithOAuth: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } }
      }))
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      insert: jest.fn(),
      update: jest.fn(() => ({
        eq: jest.fn()
      }))
    }))
  }
}));

// Mock do Redis
jest.mock('../lib/redis/redisClient', () => ({
  redisClient: {
    isConnected: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
    ttl: jest.fn()
  }
}));

// Mock do toast
jest.mock('react-hot-toast', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn()
  }
}));

// Wrapper para testes com AuthProvider
const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );
};

describe('Integração Rate Limiting com Autenticação', () => {
  const testEmail = 'test@example.com';
  const testPassword = 'password123';

  beforeEach(() => {
    jest.clearAllMocks();
    // Configurar Redis como desconectado para usar fallback
    (redisClient.isConnected as jest.Mock).mockReturnValue(false);
    // Limpar fallback storage
    (rateLimitClient as any).fallbackStorage.clear();
  });

  describe('Login com Rate Limiting', () => {
    it('deve permitir login normal quando dentro do limite', async () => {
      const { supabase } = require('../lib/supabase');
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: '123', email: testEmail } },
        error: null
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signInWithPassword(testEmail, testPassword);
      });

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: testEmail,
        password: testPassword
      });
    });

    it('deve bloquear login após múltiplas tentativas falhadas', async () => {
      const { supabase } = require('../lib/supabase');
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid credentials' }
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Fazer 5 tentativas falhadas
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          await result.current.signInWithPassword(testEmail, testPassword);
        });
      }

      // 6ª tentativa deve ser bloqueada antes mesmo de chamar Supabase
      const initialCallCount = supabase.auth.signInWithPassword.mock.calls.length;
      
      await act(async () => {
        await result.current.signInWithPassword(testEmail, testPassword);
      });

      // Não deve ter feito nova chamada para Supabase
      expect(supabase.auth.signInWithPassword.mock.calls.length).toBe(initialCallCount);
    });

    it('deve resetar contador após login bem-sucedido', async () => {
      const { supabase } = require('../lib/supabase');
      
      // Primeiro: 4 tentativas falhadas
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid credentials' }
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      for (let i = 0; i < 4; i++) {
        await act(async () => {
          await result.current.signInWithPassword(testEmail, testPassword);
        });
      }

      // Depois: login bem-sucedido
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: '123', email: testEmail } },
        error: null
      });

      await act(async () => {
        await result.current.signInWithPassword(testEmail, testPassword);
      });

      // Próxima tentativa deve ser permitida (contador resetado)
      await act(async () => {
        await result.current.signInWithPassword(testEmail, testPassword);
      });

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledTimes(6);
    });
  });

  describe('Signup com Rate Limiting', () => {
    it('deve aplicar rate limiting no signup', async () => {
      const { supabase } = require('../lib/supabase');
      supabase.auth.signUp.mockResolvedValue({
        data: { user: null },
        error: { message: 'Email already registered' }
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Fazer múltiplas tentativas falhadas
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          await result.current.signUp(testEmail, testPassword, 'Test User');
        });
      }

      // Próxima tentativa deve ser bloqueada
      const initialCallCount = supabase.auth.signUp.mock.calls.length;
      
      await act(async () => {
        await result.current.signUp(testEmail, testPassword, 'Test User');
      });

      expect(supabase.auth.signUp.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('Reset Password com Rate Limiting', () => {
    it('deve aplicar rate limiting no reset de senha', async () => {
      const { supabase } = require('../lib/supabase');
      supabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: null,
        error: { message: 'Email not found' }
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Fazer múltiplas tentativas falhadas
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          await result.current.resetPassword(testEmail);
        });
      }

      // Próxima tentativa deve ser bloqueada
      const initialCallCount = supabase.auth.resetPasswordForEmail.mock.calls.length;
      
      await act(async () => {
        await result.current.resetPassword(testEmail);
      });

      expect(supabase.auth.resetPasswordForEmail.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('Validação de Usuário com Rate Limiting', () => {
    it('deve aplicar rate limiting na validação', async () => {
      const { supabase } = require('../lib/supabase');
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'User not found' }
            })
          })
        })
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Fazer múltiplas tentativas de validação falhadas
      for (let i = 0; i < 3; i++) { // Limite menor para validação
        await act(async () => {
          await result.current.validateUserData(testEmail);
        });
      }

      // Próxima tentativa deve ser bloqueada
      const stats = await rateLimitClient.getStats(testEmail, 'validation');
      expect(stats.isBlocked).toBe(true);
    });
  });

  describe('Google OAuth com Rate Limiting', () => {
    it('deve aplicar rate limiting no Google OAuth', async () => {
      const { supabase } = require('../lib/supabase');
      supabase.auth.signInWithOAuth.mockResolvedValue({
        data: { url: null },
        error: { message: 'OAuth error' }
      });

      // Mock do navigator.userAgent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Test Browser)',
        configurable: true
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Fazer múltiplas tentativas falhadas
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          await result.current.signInWithGoogle();
        });
      }

      // Próxima tentativa deve ser bloqueada
      const initialCallCount = supabase.auth.signInWithOAuth.mock.calls.length;
      
      await act(async () => {
        await result.current.signInWithGoogle();
      });

      expect(supabase.auth.signInWithOAuth.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('Isolamento entre Operações', () => {
    it('deve isolar rate limiting entre diferentes operações', async () => {
      const { supabase } = require('../lib/supabase');
      
      // Configurar falhas para login
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid credentials' }
      });

      // Configurar sucesso para reset password
      supabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Bloquear login
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          await result.current.signInWithPassword(testEmail, testPassword);
        });
      }

      // Reset password deve ainda funcionar
      await act(async () => {
        await result.current.resetPassword(testEmail);
      });

      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalled();
    });
  });

  describe('Isolamento entre Usuários', () => {
    it('deve isolar rate limiting entre diferentes usuários', async () => {
      const { supabase } = require('../lib/supabase');
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid credentials' }
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      const user1Email = 'user1@test.com';
      const user2Email = 'user2@test.com';

      // Bloquear user1
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          await result.current.signInWithPassword(user1Email, testPassword);
        });
      }

      // user2 deve ainda poder tentar
      const initialCallCount = supabase.auth.signInWithPassword.mock.calls.length;
      
      await act(async () => {
        await result.current.signInWithPassword(user2Email, testPassword);
      });

      expect(supabase.auth.signInWithPassword.mock.calls.length).toBe(initialCallCount + 1);
    });
  });

  describe('Recuperação após Bloqueio', () => {
    it('deve permitir tentativas após expiração do bloqueio', async () => {
      const { supabase } = require('../lib/supabase');
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid credentials' }
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Bloquear usuário
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          await result.current.signInWithPassword(testEmail, testPassword);
        });
      }

      // Simular expiração do bloqueio
      const storage = (rateLimitClient as any).fallbackStorage;
      const blockKey = `${testEmail}:login:blocked`;
      const entry = storage.get(blockKey);
      if (entry) {
        entry.blockedUntil = Date.now() - 1000; // Expirado
        storage.set(blockKey, entry);
      }

      // Deve permitir nova tentativa
      const initialCallCount = supabase.auth.signInWithPassword.mock.calls.length;
      
      await act(async () => {
        await result.current.signInWithPassword(testEmail, testPassword);
      });

      expect(supabase.auth.signInWithPassword.mock.calls.length).toBe(initialCallCount + 1);
    });
  });
});