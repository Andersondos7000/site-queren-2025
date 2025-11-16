import { rateLimitClient } from '../lib/rateLimitClient';
import { redisClient } from '../lib/redis/redisClient';

// Mock do Redis para testes
jest.mock('../lib/redis/redisClient', () => ({
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
    ttl: jest.fn(),
    isConnected: jest.fn(),
    pipeline: jest.fn(() => ({
      incr: jest.fn(),
      expire: jest.fn(),
      exec: jest.fn()
    }))
  }
}));

// Mock do console para capturar logs
const consoleSpy = {
  error: jest.spyOn(console, 'error').mockImplementation(() => {}),
  warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
  log: jest.spyOn(console, 'log').mockImplementation(() => {})
};

describe('RateLimitClient - Cenários de Loop Infinito', () => {
  const testEmail = 'test@example.com';
  const testOperation = 'login';

  beforeEach(() => {
    jest.clearAllMocks();
    // Limpar fallback storage
    (rateLimitClient as any).fallbackStorage.clear();
  });

  afterAll(() => {
    consoleSpy.error.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.log.mockRestore();
  });

  describe('Cenário 1: Loop de tentativas de login', () => {
    it('deve bloquear após 5 tentativas falhadas consecutivas', async () => {
      // Mock Redis desconectado para usar fallback
      (redisClient.isConnected as jest.Mock).mockReturnValue(false);

      // Simular 5 tentativas falhadas
      for (let i = 0; i < 5; i++) {
        const result = await rateLimitClient.checkRateLimit(testEmail, testOperation);
        expect(result.allowed).toBe(true);
        
        await rateLimitClient.recordFailedAttempt(testEmail, testOperation);
      }

      // 6ª tentativa deve ser bloqueada
      const result = await rateLimitClient.checkRateLimit(testEmail, testOperation);
      expect(result.allowed).toBe(false);
      expect(result.resetTime).toBeGreaterThan(0);
    });

    it('deve resetar contador após sucesso', async () => {
      (redisClient.isConnected as jest.Mock).mockReturnValue(false);

      // 4 tentativas falhadas
      for (let i = 0; i < 4; i++) {
        await rateLimitClient.recordFailedAttempt(testEmail, testOperation);
      }

      // Sucesso - deve resetar contador
      await rateLimitClient.resetAttempts(testEmail, testOperation);

      // Próxima tentativa deve ser permitida
      const result = await rateLimitClient.checkRateLimit(testEmail, testOperation);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Cenário 2: Loop de validação de dados', () => {
    const validationOperation = 'validation';

    it('deve aplicar rate limiting mais restritivo para validação', async () => {
      (redisClient.isConnected as jest.Mock).mockReturnValue(false);

      // Simular 3 tentativas falhadas (limite menor para validação)
      for (let i = 0; i < 3; i++) {
        const result = await rateLimitClient.checkRateLimit(testEmail, validationOperation);
        expect(result.allowed).toBe(true);
        
        await rateLimitClient.recordFailedAttempt(testEmail, validationOperation);
      }

      // 4ª tentativa deve ser bloqueada
      const result = await rateLimitClient.checkRateLimit(testEmail, validationOperation);
      expect(result.allowed).toBe(false);
    });
  });

  describe('Cenário 3: Múltiplos usuários simultâneos', () => {
    it('deve isolar rate limiting por usuário', async () => {
      (redisClient.isConnected as jest.Mock).mockReturnValue(false);

      const user1 = 'user1@test.com';
      const user2 = 'user2@test.com';

      // Bloquear user1
      for (let i = 0; i < 5; i++) {
        await rateLimitClient.recordFailedAttempt(user1, testOperation);
      }

      // user1 deve estar bloqueado
      const result1 = await rateLimitClient.checkRateLimit(user1, testOperation);
      expect(result1.allowed).toBe(false);

      // user2 deve estar livre
      const result2 = await rateLimitClient.checkRateLimit(user2, testOperation);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('Cenário 4: Fallback quando Redis falha', () => {
    it('deve funcionar com storage em memória quando Redis está indisponível', async () => {
      (redisClient.isConnected as jest.Mock).mockReturnValue(false);

      // Simular tentativas falhadas
      for (let i = 0; i < 5; i++) {
        await rateLimitClient.recordFailedAttempt(testEmail, testOperation);
      }

      const result = await rateLimitClient.checkRateLimit(testEmail, testOperation);
      expect(result.allowed).toBe(false);

      // Verificar que não houve tentativas de usar Redis
      expect(redisClient.get).not.toHaveBeenCalled();
      expect(redisClient.incr).not.toHaveBeenCalled();
    });

    it('deve migrar para Redis quando reconectar', async () => {
      // Começar com Redis desconectado
      (redisClient.isConnected as jest.Mock).mockReturnValue(false);

      // Registrar tentativas no fallback
      for (let i = 0; i < 3; i++) {
        await rateLimitClient.recordFailedAttempt(testEmail, testOperation);
      }

      // Redis reconecta
      (redisClient.isConnected as jest.Mock).mockReturnValue(true);
      (redisClient.get as jest.Mock).mockResolvedValue('0');
      (redisClient.incr as jest.Mock).mockResolvedValue(1);

      // Próxima tentativa deve usar Redis
      await rateLimitClient.recordFailedAttempt(testEmail, testOperation);
      expect(redisClient.incr).toHaveBeenCalled();
    });
  });

  describe('Cenário 5: Limpeza automática de entradas expiradas', () => {
    it('deve limpar entradas expiradas do fallback storage', async () => {
      (redisClient.isConnected as jest.Mock).mockReturnValue(false);

      // Adicionar entrada que expira em 1ms
      const storage = (rateLimitClient as any).fallbackStorage;
      const key = `${testEmail}:${testOperation}`;
      storage.set(key, {
        count: 3,
        resetTime: Date.now() + 1,
        blockedUntil: null
      });

      // Aguardar expiração
      await new Promise(resolve => setTimeout(resolve, 10));

      // Executar limpeza
      await (rateLimitClient as any).cleanupExpiredEntries();

      // Entrada deve ter sido removida
      expect(storage.has(key)).toBe(false);
    });
  });

  describe('Cenário 6: Configurações dinâmicas por operação', () => {
    it('deve aplicar configurações específicas por tipo de operação', async () => {
      (redisClient.isConnected as jest.Mock).mockReturnValue(false);

      // Testar operação de signup (limite diferente)
      const signupOperation = 'signup';
      
      // Verificar que configuração é obtida corretamente
      const config = (rateLimitClient as any).getOperationConfig(signupOperation);
      expect(config).toBeDefined();
      expect(config.maxAttempts).toBeGreaterThan(0);
      expect(config.windowMs).toBeGreaterThan(0);
    });
  });

  describe('Cenário 7: Estatísticas e monitoramento', () => {
    it('deve fornecer estatísticas precisas do rate limiting', async () => {
      (redisClient.isConnected as jest.Mock).mockReturnValue(false);

      // Registrar algumas tentativas
      for (let i = 0; i < 3; i++) {
        await rateLimitClient.recordFailedAttempt(testEmail, testOperation);
      }

      const stats = await rateLimitClient.getStats(testEmail, testOperation);
      expect(stats.currentCount).toBe(3);
      expect(stats.isBlocked).toBe(false);
      expect(stats.resetTime).toBeGreaterThan(0);
    });
  });

  describe('Cenário 8: Health Check do sistema', () => {
    it('deve reportar saúde do sistema corretamente', async () => {
      (redisClient.isConnected as jest.Mock).mockReturnValue(true);

      const health = await rateLimitClient.healthCheck();
      expect(health.redis).toBe(true);
      expect(health.fallback).toBe(true);
      expect(health.timestamp).toBeGreaterThan(0);
    });

    it('deve detectar falha do Redis', async () => {
      (redisClient.isConnected as jest.Mock).mockReturnValue(false);

      const health = await rateLimitClient.healthCheck();
      expect(health.redis).toBe(false);
      expect(health.fallback).toBe(true);
    });
  });

  describe('Cenário 9: Stress Test - Múltiplas operações simultâneas', () => {
    it('deve manter consistência sob carga', async () => {
      (redisClient.isConnected as jest.Mock).mockReturnValue(false);

      const promises = [];
      const userCount = 10;
      const attemptsPerUser = 3;

      // Simular múltiplos usuários fazendo tentativas simultâneas
      for (let userId = 0; userId < userCount; userId++) {
        for (let attempt = 0; attempt < attemptsPerUser; attempt++) {
          promises.push(
            rateLimitClient.recordFailedAttempt(`user${userId}@test.com`, testOperation)
          );
        }
      }

      await Promise.all(promises);

      // Verificar que cada usuário tem o número correto de tentativas
      for (let userId = 0; userId < userCount; userId++) {
        const stats = await rateLimitClient.getStats(`user${userId}@test.com`, testOperation);
        expect(stats.currentCount).toBe(attemptsPerUser);
      }
    });
  });

  describe('Cenário 10: Recuperação após bloqueio', () => {
    it('deve permitir tentativas após expiração do bloqueio', async () => {
      (redisClient.isConnected as jest.Mock).mockReturnValue(false);

      // Bloquear usuário
      for (let i = 0; i < 5; i++) {
        await rateLimitClient.recordFailedAttempt(testEmail, testOperation);
      }

      // Confirmar bloqueio
      let result = await rateLimitClient.checkRateLimit(testEmail, testOperation);
      expect(result.allowed).toBe(false);

      // Simular expiração do bloqueio (manipular timestamp)
      const storage = (rateLimitClient as any).fallbackStorage;
      const blockKey = `${testEmail}:${testOperation}:blocked`;
      const entry = storage.get(blockKey);
      if (entry) {
        entry.blockedUntil = Date.now() - 1000; // Expirado há 1 segundo
        storage.set(blockKey, entry);
      }

      // Deve permitir tentativas novamente
      result = await rateLimitClient.checkRateLimit(testEmail, testOperation);
      expect(result.allowed).toBe(true);
    });
  });
});