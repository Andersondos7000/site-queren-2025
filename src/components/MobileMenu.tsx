
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Calendar, Shirt, ShoppingCart, Settings, LogIn, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { enableScrollOnNextNavigation } from '@/hooks/useScrollToTop';

const MobileMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, session, loading, signOut, isAdmin } = useAuth();
  const [userIsAdmin, setUserIsAdmin] = useState(false);

  const closeMenu = () => setIsOpen(false);

  // Função para fechar menu e ativar scroll
  const closeMenuWithScroll = () => {
    enableScrollOnNextNavigation(); // Ativa o scroll para a próxima navegação
    closeMenu();
  };

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user && session && !loading) {
        try {
          const adminStatus = await isAdmin();
          setUserIsAdmin(adminStatus);
        } catch (error) {
          console.error('Erro ao verificar status admin no MobileMenu:', error);
          setUserIsAdmin(false);
        }
      } else {
        setUserIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user, session, loading, isAdmin]);

  const handleSignOut = async () => {
    await signOut();
    closeMenu();
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button 
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10 md:hidden"
          role="button"
          aria-label="Abrir menu de navegação"
          aria-expanded={isOpen}
          aria-controls="mobile-navigation-menu"
          aria-haspopup="menu"
        >
          <Menu className="h-8 w-8" />
          <span className="sr-only">Abrir menu</span>
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px]" role="dialog" aria-labelledby="mobile-menu-title" aria-describedby="mobile-menu-description">
        <SheetHeader>
          <SheetTitle id="mobile-menu-title">Menu</SheetTitle>
          <SheetDescription id="mobile-menu-description">
            Navegue pelas páginas do site e acesse sua conta
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col h-full">

          <Separator />
          
          <nav className="flex flex-col gap-1 py-4" role="navigation" aria-label="Menu principal" id="mobile-navigation-menu">
            <Link 
              to="/" 
              className="flex items-center px-4 py-3 hover:bg-butterfly-orange/10 rounded-md transition-colors"
              onClick={closeMenuWithScroll}
              role="menuitem"
              aria-label="Ir para página inicial"
            >
              <div>Home</div>
            </Link>
            <Link 
              to="/evento" 
              className="flex items-center px-4 py-3 hover:bg-butterfly-orange/10 rounded-md transition-colors"
              onClick={closeMenuWithScroll}
              role="menuitem"
              aria-label="Ir para página do evento"
            >
              <Calendar className="mr-2 h-5 w-5" aria-hidden="true" />
              <div>Evento</div>
            </Link>
            <Link 
              to="/loja" 
              className="flex items-center px-4 py-3 hover:bg-butterfly-orange/10 rounded-md transition-colors"
              onClick={closeMenuWithScroll}
              role="menuitem"
              aria-label="Ir para loja"
            >
              <Shirt className="mr-2 h-5 w-5" aria-hidden="true" />
              <div>Loja</div>
            </Link>
            <Link 
              to="/ingressos" 
              className="flex items-center px-4 py-3 hover:bg-butterfly-orange/10 rounded-md transition-colors"
              onClick={closeMenuWithScroll}
              role="menuitem"
              aria-label="Ir para página de ingressos"
            >
              <Calendar className="mr-2 h-5 w-5" aria-hidden="true" />
              <div>Ingressos</div>
            </Link>
            <Link 
              to="/carrinho" 
              className="flex items-center px-4 py-3 hover:bg-butterfly-orange/10 rounded-md transition-colors"
              onClick={closeMenuWithScroll}
              role="menuitem"
              aria-label="Ir para carrinho de compras"
            >
              <ShoppingCart className="mr-2 h-5 w-5" aria-hidden="true" />
              <div>Carrinho</div>
            </Link>
            <Link 
              to="/checkout" 
              className="flex items-center px-4 py-3 hover:bg-butterfly-orange/10 rounded-md transition-colors"
              onClick={closeMenuWithScroll}
              role="menuitem"
              aria-label="Ir para finalização da compra"
            >
              <div>Checkout</div>
            </Link>
            {userIsAdmin && (
              <Link 
                to="/admin" 
                className="flex items-center px-4 py-3 hover:bg-butterfly-orange/10 rounded-md transition-colors"
                onClick={closeMenuWithScroll}
                role="menuitem"
                aria-label="Ir para painel administrativo"
              >
                <Settings className="mr-2 h-5 w-5" />
                <div>Admin</div>
              </Link>
            )}

            <Separator className="my-2" />
            
            {user ? (
              <>
                <Link 
                  to="/perfil" 
                  className="flex items-center px-4 py-3 hover:bg-butterfly-orange/10 rounded-md transition-colors"
                  onClick={closeMenuWithScroll}
                >
                  <User className="mr-2 h-5 w-5" />
                  <div>Meu Perfil</div>
                </Link>
                <button 
                  className="flex items-center px-4 py-3 hover:bg-butterfly-orange/10 rounded-md transition-colors text-left w-full"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 h-5 w-5" />
                  <div>Sair</div>
                </button>
              </>
            ) : (
              <Link 
                to="/auth" 
                className="flex items-center px-4 py-3 hover:bg-butterfly-orange/10 rounded-md transition-colors"
                onClick={closeMenuWithScroll}
              >
                <LogIn className="mr-2 h-5 w-5" />
                <div>Entrar / Cadastrar</div>
              </Link>
            )}
          </nav>

          <div className="mt-auto mb-4">
            <Button 
              className="w-full bg-butterfly-orange hover:bg-butterfly-orange/90"
              onClick={() => {
                enableScrollOnNextNavigation(); // Ativa scroll para próxima navegação
                closeMenu();
                window.location.href = '/ingressos';
              }}
            >
              Comprar Ingresso
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileMenu;
