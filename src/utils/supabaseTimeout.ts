/**
 * Utilitário para adicionar timeout às consultas Supabase
 * Evita que consultas fiquem pendentes indefinidamente
 */

export const withTimeout = <T>(
  promise: Promise<T>, 
  timeoutMs: number = 10000, // 10 segundos por padrão
  errorMessage: string = 'Timeout na consulta Supabase'
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${errorMessage} (timeout: ${timeoutMs}ms)`));
      }, timeoutMs);
    })
  ]);
};

/**
 * Wrapper específico para consultas Supabase com retry automático
 */
export const supabaseQueryWithTimeout = async <T>(
  queryFn: () => Promise<T>,
  options: {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    errorMessage?: string;
  } = {}
): Promise<T> => {
  const {
    timeout = 10000,
    retries = 2,
    retryDelay = 1000,
    errorMessage = 'Consulta Supabase'
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`[supabaseQueryWithTimeout] Tentativa ${attempt + 1}/${retries + 1} para: ${errorMessage}`);
      
      const result = await withTimeout(
        queryFn(),
        timeout,
        errorMessage
      );
      
      console.log(`[supabaseQueryWithTimeout] Sucesso na tentativa ${attempt + 1} para: ${errorMessage}`);
      return result;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[supabaseQueryWithTimeout] Erro na tentativa ${attempt + 1}:`, lastError.message);
      
      // Se não é a última tentativa, aguardar antes de tentar novamente
      if (attempt < retries) {
        console.log(`[supabaseQueryWithTimeout] Aguardando ${retryDelay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  console.error(`[supabaseQueryWithTimeout] Todas as tentativas falharam para: ${errorMessage}`);
  throw lastError!;
};