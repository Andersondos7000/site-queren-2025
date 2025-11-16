# 🧪 Sistema de Testes Realtime

Este diretório contém todos os testes para o sistema realtime, incluindo testes unitários, de integração e end-to-end.

## 📁 Estrutura de Testes

```
src/__tests__/
├── __mocks__/              # Mocks globais
│   ├── fileMock.js         # Mock para assets estáticos
│   └── supabase.ts         # Mock do cliente Supabase
├── hooks/                  # Testes dos hooks
│   ├── useOfflineFirst.test.ts
│   ├── useOfflineQueue.test.ts
│   ├── useNetworkStatus.test.ts
│   └── useRealtimeSync.test.ts
├── integration/            # Testes de integração
│   ├── multiTab.test.ts
│   ├── performance.test.ts
│   ├── conflictResolution.test.ts
│   ├── realtime-e2e.test.ts
│   └── supabase-integration.test.ts
├── setup.ts               # Configuração global dos testes
├── globalSetup.ts         # Setup antes de todos os testes
├── globalTeardown.ts      # Cleanup após todos os testes
└── README.md              # Este arquivo
```

## 🚀 Executando os Testes

### Comandos Básicos

```bash
# Executar todos os testes
npm test

# Executar com coverage
npm run test:coverage

# Executar em modo watch
npm run test:watch

# Executar testes específicos
npm test -- useOfflineFirst.test.ts

# Executar com padrão de nome
npm test -- --testNamePattern="offline"
```

### Script Personalizado

```bash
# Usar o script personalizado
node scripts/test.js

# Com opções
node scripts/test.js --coverage --verbose
node scripts/test.js --watch
node scripts/test.js useOfflineFirst.test.ts
```

## 📊 Cobertura de Testes

### Metas de Cobertura

- **Hooks Realtime**: 90% (crítico)
- **Componentes UI**: 85% (importante)
- **Geral**: 80% (mínimo)

### Relatórios

- **Console**: Resumo após execução
- **HTML**: `./coverage/lcov-report/index.html`
- **LCOV**: `./coverage/lcov.info`
- **JSON**: `./coverage/coverage-final.json`

## 🧪 Tipos de Testes

### 1. Testes Unitários (80%)

**Hooks Realtime**:
- `useOfflineFirst.test.ts` - Cache offline e sincronização
- `useOfflineQueue.test.ts` - Fila de ações offline
- `useNetworkStatus.test.ts` - Detecção de conectividade
- `useRealtimeSync.test.ts` - Sincronização em tempo real

**Características**:
- Isolados e rápidos
- Mocks para dependências externas
- Foco na lógica de negócio

### 2. Testes de Integração (15%)

**Cenários Complexos**:
- `multiTab.test.ts` - Sincronização entre abas
- `performance.test.ts` - Performance sob carga
- `conflictResolution.test.ts` - Resolução de conflitos
- `supabase-integration.test.ts` - Integração com Supabase

**Características**:
- Múltiplos componentes trabalhando juntos
- Simulação de cenários reais
- Validação de fluxos completos

### 3. Testes End-to-End (5%)

**Fluxos Críticos**:
- `realtime-e2e.test.ts` - Jornadas completas do usuário

**Características**:
- Simulação de ambiente real
- Validação de UX completa
- Testes de regressão

## 🛠️ Utilitários de Teste

### Mocks Disponíveis

```typescript
// Supabase Client Mock
import { mockSupabaseClient, supabaseTestUtils } from './__mocks__/supabase';

// Simular resposta de sucesso
supabaseTestUtils.mockSuccess({ id: 1, name: 'Test' });

// Simular erro
supabaseTestUtils.mockError('Network error');

// Simular eventos realtime
supabaseTestUtils.mockRealtimeSubscription([
  { eventType: 'INSERT', payload: { id: 1, name: 'New Item' } }
]);
```

### Utilitários Globais

```typescript
// Aguardar operações assíncronas
await testUtils.waitFor(100);

// Simular condições de rede
testUtils.simulateNetworkCondition('offline');
testUtils.simulateNetworkCondition('slow');
testUtils.simulateNetworkCondition('online');

// Criar mocks
const mockFn = testUtils.createMockFn('return value');
const asyncMockFn = testUtils.createAsyncMockFn('async return');
```

## 🔧 Configuração

### Jest Config (`jest.config.js`)

- **Environment**: jsdom para testes de React
- **Setup**: Configuração automática de mocks
- **Coverage**: Thresholds específicos por diretório
- **Transforms**: TypeScript e JSX
- **Module Mapping**: Aliases de path

### Setup Files

- **`setup.ts`**: Mocks globais e utilitários
- **`globalSetup.ts`**: Configuração antes de todos os testes
- **`globalTeardown.ts`**: Limpeza após todos os testes

## 📝 Escrevendo Testes

### Estrutura Padrão

```typescript
import { renderHook, act } from '@testing-library/react';
import { useOfflineFirst } from '@/hooks/realtime/useOfflineFirst';
import { supabaseTestUtils } from '../__mocks__/supabase';

describe('useOfflineFirst', () => {
  beforeEach(() => {
    supabaseTestUtils.resetMocks();
    testUtils.simulateNetworkCondition('online');
  });

  it('should handle offline operations', async () => {
    // Arrange
    testUtils.simulateNetworkCondition('offline');
    const { result } = renderHook(() => useOfflineFirst('cart'));

    // Act
    await act(async () => {
      await result.current.create({ id: 1, item: 'test' });
    });

    // Assert
    expect(result.current.pendingActions).toHaveLength(1);
  });
});
```

### Boas Práticas

1. **AAA Pattern**: Arrange, Act, Assert
2. **Descriptive Names**: Nomes que explicam o cenário
3. **Isolated Tests**: Cada teste independente
4. **Mock External Dependencies**: Isolar unidade testada
5. **Test Edge Cases**: Cenários de erro e limite

## 🐛 Debugging

### Logs de Debug

```typescript
// Habilitar logs detalhados
process.env.DEBUG = 'realtime:*';

// Logs específicos no teste
console.log('[TEST]', 'Estado atual:', result.current);
```

### Ferramentas

- **Jest Debug**: `node --inspect-brk node_modules/.bin/jest`
- **VS Code**: Configuração de debug incluída
- **Chrome DevTools**: Para debugging de hooks

## 📈 Métricas e Monitoramento

### Performance

- **Latência**: < 100ms para operações críticas
- **Throughput**: > 1000 ops/segundo
- **Memory**: Sem vazamentos em testes longos

### Qualidade

- **Coverage**: Mínimo 80%, crítico 90%
- **Flakiness**: < 1% de testes instáveis
- **Execution Time**: < 30s para suite completa

## 🚨 Troubleshooting

### Problemas Comuns

1. **Testes Flaky**:
   - Verificar timers e async/await
   - Usar `waitFor` para operações assíncronas
   - Limpar estado entre testes

2. **Mocks Não Funcionam**:
   - Verificar ordem de imports
   - Resetar mocks no `beforeEach`
   - Usar `jest.clearAllMocks()`

3. **Coverage Baixo**:
   - Identificar código não testado
   - Adicionar testes para edge cases
   - Verificar exclusões no config

4. **Performance Lenta**:
   - Usar `--maxWorkers=50%`
   - Otimizar setup/teardown
   - Paralelizar testes independentes

### Comandos de Diagnóstico

```bash
# Verificar configuração
npx jest --showConfig

# Debug específico
npx jest --detectOpenHandles --forceExit

# Análise de coverage
npx jest --coverage --coverageReporters=text-lcov
```

## 📚 Recursos

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [React Hooks Testing](https://react-hooks-testing-library.com/)
- [Supabase Testing Guide](https://supabase.com/docs/guides/getting-started/local-development)

---

**Lembre-se**: Testes são documentação viva do seu código. Mantenha-os atualizados e legíveis! 🚀