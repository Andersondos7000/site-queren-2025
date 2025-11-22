
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, Calendar, Shirt, User } from 'lucide-react';
import BrandLogo from './BrandLogo';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import MobileMenu from './MobileMenu';
import AdminAccessModal from '@/components/AdminAccessModal';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { cn } from '@/lib/utils';
import { enableScrollOnNextNavigation } from '@/hooks/useScrollToTop';


const Navbar: React.FC = () => {
  const { items } = useCart();
  const { user, session, loading, signOut, isAdmin } = useAuth();
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const { isAdminLoggedIn } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user && session && !loading) {
        try {
          const adminStatus = await isAdmin();
          // Considera tanto o papel do usuário quanto a sessão administrativa ativa
          setUserIsAdmin(adminStatus || isAdminLoggedIn);
        } catch (error) {
          console.error('Erro ao verificar status admin no Navbar:', error);
          setUserIsAdmin(isAdminLoggedIn);
        }
      } else {
        setUserIsAdmin(isAdminLoggedIn);
      }
    };

    checkAdminStatus();
  }, [user, session, loading, isAdmin, isAdminLoggedIn]);
  
  // Calculate total quantity by summing up all item quantities
  const cartItemsCount = items.reduce((total, item) => total + item.quantity, 0);
  
  return (
    <nav className="sticky top-0 z-50 w-full bg-white shadow-sm border-b border-butterfly-orange/10">
      <div className="container mx-auto px-4 py-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <MobileMenu />
            <div className="ml-12">
              <Link 
                to="/" 
                onClick={enableScrollOnNextNavigation}
                className="text-butterfly-orange"
              >
                <BrandLogo className="w-24 h-24" />
              </Link>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-1">
            <Link 
              to="/" 
              onClick={enableScrollOnNextNavigation}
              className={cn(
                "px-3 py-2 rounded-md text-base font-medium transition-colors",
                location.pathname === "/" 
                  ? "bg-butterfly-orange text-white" 
                  : "text-gray-700 hover:bg-butterfly-orange/20 hover:text-butterfly-orange"
              )}
            >
              Home
            </Link>
            <Link 
              to="/evento" 
              onClick={enableScrollOnNextNavigation}
              className={cn(
                "px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center",
                location.pathname === "/evento" 
                  ? "bg-butterfly-orange text-white" 
                  : "text-gray-700 hover:bg-butterfly-orange/20 hover:text-butterfly-orange"
              )}
            >
              <Calendar className="mr-1 h-4 w-4" /> Evento
            </Link>
            <Link 
              to="/loja" 
              onClick={enableScrollOnNextNavigation}
              className={cn(
                "px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center",
                location.pathname === "/loja" 
                  ? "bg-butterfly-orange text-white" 
                  : "text-gray-700 hover:bg-butterfly-orange/20 hover:text-butterfly-orange"
              )}
            >
              <Shirt className="mr-1 h-4 w-4" /> Loja
            </Link>
            <Link 
              to="/checkout" 
              onClick={enableScrollOnNextNavigation}
              className={cn(
                "px-3 py-2 rounded-md text-base font-medium transition-colors",
                location.pathname === "/checkout" 
                  ? "bg-butterfly-orange text-white" 
                  : "text-gray-700 hover:bg-butterfly-orange/20 hover:text-butterfly-orange"
              )}
            >
              Checkout
            </Link>
            <Link 
              to="/ingressos" 
              onClick={enableScrollOnNextNavigation}
              className={cn(
                "px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center",
                location.pathname === "/ingressos" 
                  ? "bg-butterfly-orange text-white" 
                  : "text-gray-700 hover:bg-butterfly-orange/20 hover:text-butterfly-orange"
              )}
            >
              <Calendar className="mr-1 h-4 w-4" /> Ingressos
            </Link>
          </div>

          <div className="flex items-center space-x-9">
            {/* Ícone de login para mobile */}
            {!user && (
              <Link 
                to="/auth" 
                className="md:hidden text-butterfly-orange hover:text-butterfly-orange/80 transition-colors"
                title="Entrar"
              >
                <User className="h-6 w-6" />
              </Link>
            )}

            <Link to="/carrinho" className="relative text-butterfly-orange hover:text-butterfly-orange/80 transition-colors" data-testid="cart-icon">
              <ShoppingCart className="h-6 w-6" />
              {cartItemsCount > 0 && (
                <div className="absolute -top-2 -right-2 bg-butterfly-orange text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {cartItemsCount}
                </div>
              )}
            </Link>
            
            {user ? (
              <div className="hidden md:flex items-center space-x-4">
                {userIsAdmin && (
                  <button 
                    onClick={() => {
                      if (user && isAdminLoggedIn) {
                    enableScrollOnNextNavigation();
                    navigate('/admin');
                      } else {
                        setShowAdminModal(true);
                      }
                    }}
                    className="flex items-center space-x-2 text-butterfly-orange hover:text-butterfly-orange/80 transition-colors"
                  >
                    <div className="font-medium">Admin</div>
                  </button>
                )}
                <Link 
                  to="/perfil"
                  className="flex items-center space-x-2 text-butterfly-orange hover:text-butterfly-orange/80 transition-colors"
                >
                  <User className="h-5 w-5" />
                  <div className="font-medium">Perfil</div>
                </Link>
              </div>
            ) : (
              <Button 
                variant="default" 
                className="hidden md:flex"
                onClick={() => { enableScrollOnNextNavigation(); navigate('/auth'); }}
              >
                Entrar
              </Button>
            )}
            

          </div>
        </div>
      </div>
      
      <AdminAccessModal 
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
      />
    </nav>
  );
};

export default Navbar;