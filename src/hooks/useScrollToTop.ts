import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Estado global para controlar se o scroll deve ser ativado na próxima navegação
let shouldScrollOnNextNavigation = false;

/**
 * Hook que faz scroll para o topo da página quando a rota muda
 * Só executa o scroll se foi habilitado via enableScrollOnNextNavigation()
 */
export const useScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    if (shouldScrollOnNextNavigation) {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      shouldScrollOnNextNavigation = false; // Reset após usar
    }
  }, [location.pathname]);
};

/**
 * Função para habilitar o scroll para o topo na próxima navegação
 * Deve ser chamada antes de navegar para uma nova rota
 */
export const enableScrollOnNextNavigation = () => {
  shouldScrollOnNextNavigation = true;
};

/**
 * Hook alternativo que sempre faz scroll para o topo quando a rota muda
 * Use este se quiser scroll automático em todas as navegações
 */
export const useAlwaysScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
};

export default useScrollToTop;