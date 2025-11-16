import { useScrollToTop } from '@/hooks/useScrollToTop';

/**
 * Componente que faz scroll automático para o topo da página
 * sempre que a rota muda
 */
const ScrollToTop = () => {
  useScrollToTop();
  return null;
};

export default ScrollToTop;