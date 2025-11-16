
// Auth.tsx - Versão com componentes completamente isolados
// Solução para problema de interferência entre formulários

import React, { useState } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEmailConfirmation } from "@/hooks/useEmailConfirmation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import emailLogoUrl from "/borboleta-modal-email.svg";
import { Eye, EyeOff, Chrome } from "lucide-react";
import ForgotPasswordModal from "@/components/ForgotPasswordModal";
import RoleSelectionModal from "@/components/RoleSelectionModal";
import EmailConfirmationModalNew from "@/components/EmailConfirmationModalNew";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { enableScrollOnNextNavigation } from "@/hooks/useScrollToTop";



// ============================================
// COMPONENTE DE LOGIN (ISOLADO)
// ============================================
const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const { signIn, signInWithGoogle } = useAuth(); // Adicionado signInWithGoogle
  const navigate = useNavigate();
  const location = useLocation();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      // O redirecionamento será tratado pelo Supabase e pelo onAuthStateChange
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer login com Google';
      setError(errorMessage);
      console.error('Google Sign-In error:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn(email, password);
      if (result && result.data) {
        const from = (location.state as any)?.from || '/';
        navigate(from);
      } else {
        const message = (result && result.error && result.error.message) || 'Credenciais inválidas';
        setError(message);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer login';
      setError(errorMessage);
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="seu@email.com"
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>
        
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
            Senha
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="Sua senha"
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>

        {error && (
          <div 
            id="login-error"
            className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-md p-3"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}

        <div className="flex flex-col space-y-4">
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            aria-describedby="login-status"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <Chrome className="mr-2 h-4 w-4" />
            Entrar com Google
          </Button>

          <Button
            variant="ghost"
            className="w-full text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50"
            onClick={() => setShowForgotPasswordModal(true)}
            disabled={loading}
          >
            Esqueci minha Senha
          </Button>
        </div>
        
        <div id="login-status" className="sr-only" aria-live="polite">
          {loading ? 'Processando login...' : 'Pronto para fazer login'}
        </div>
      </form>
      
      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
      />
    </div>
  );
};

// ============================================
// COMPONENTE DE CADASTRO (ISOLADO)
// ============================================
const SignupForm: React.FC<{ onGoogleAuth: () => void; onSuccess: (email?: string) => void }> = ({ onGoogleAuth, onSuccess }) => {
  // Estados exclusivos do Cadastro
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin' | 'organizer'>('user');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const { signUp } = useAuth();
  const navigate = useNavigate();

  // Validação em tempo real
  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Email inválido';
    }
    if (!username || username.length < 3) {
      errors.username = 'Nome deve ter pelo menos 3 caracteres';
    }
    if (!password || password.length < 6) {
      errors.password = 'Senha deve ter pelo menos 6 caracteres';
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = 'As senhas não coincidem';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      console.log('Signup attempt:', { email, username, role });
      
      // Chama a função de cadastro do contexto
      await signUp(email, password, { username, role });
      
      // Reset form
      setEmail('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setRole('user');
      setValidationErrors({});
      
      // Chamar callback de sucesso com o email
      onSuccess(email);
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar conta';
      setError(errorMessage);
      console.error('Signup error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold mb-2">Criar nova conta</h3>
        <p className="text-sm text-gray-600">
          Preencha os dados abaixo para criar sua conta
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signup-email-field">Email</Label>
          <Input
            id="signup-email-field"
            data-testid="signup-email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="email"
          />
          {validationErrors.email && (
            <p className="text-sm text-red-600">{validationErrors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-username-field">Nome de usuário</Label>
          <Input
            id="signup-username-field"
            data-testid="signup-username"
            type="text"
            placeholder="Seu nome"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="username"
          />
          {validationErrors.username && (
            <p className="text-sm text-red-600">{validationErrors.username}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-role-field">Tipo de usuário</Label>
          <select
            id="signup-role-field"
            data-testid="signup-role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'user' | 'admin' | 'organizer')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            disabled={isLoading}
          >
            <option value="user">Usuário</option>
            <option value="organizer">Organizador</option>
            <option value="admin">Administrador</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-password-field">Senha</Label>
          <div className="relative">
            <Input
              id="signup-password-field"
              data-testid="signup-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="new-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {validationErrors.password && (
            <p className="text-sm text-red-600">{validationErrors.password}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-confirm-password-field">Confirmar senha</Label>
          <div className="relative">
            <Input
              id="signup-confirm-password-field"
              data-testid="signup-confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="new-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {validationErrors.confirmPassword && (
            <p className="text-sm text-red-600">{validationErrors.confirmPassword}</p>
          )}
        </div>

        <Button
          type="submit"
          data-testid="signup-submit"
          disabled={isLoading}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white"
        >
          {isLoading ? 'Criando conta...' : 'Criar conta'}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-500">ou</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onGoogleAuth}
        disabled={isLoading}
        data-testid="signup-google"
        className="w-full"
      >
        <Chrome className="mr-2" size={20} />
        Cadastrar com Google
      </Button>

      {/* Debug info - remover em produção */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-400 mt-2">
          Debug Signup: {email || '(vazio)'} | Isolado: ✅
        </div>
      )}
    </div>
  );
};

// ============================================
// COMPONENTE PRINCIPAL AUTH
// ============================================
const Auth = () => {
  const { user, signInWithGoogle, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("login");
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [showRoleSelectionModal, setShowRoleSelectionModal] = useState(false);
  const [showEmailConfirmationModal, setShowEmailConfirmationModal] = useState(false);
  const [pendingGoogleAuth, setPendingGoogleAuth] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [registeredEmail, setRegisteredEmail] = useState<string>("");
  const { isResending, resendConfirmationEmail } = useEmailConfirmation();

  // Handle signup success
  const handleSignupSuccess = (email?: string) => {
    if (email) {
      setRegisteredEmail(email);
      setShowEmailConfirmationModal(true);
    } else {
      setSuccessMessage("Conta criada com sucesso! Faça login para continuar.");
      setActiveTab("login");
      setTimeout(() => setSuccessMessage(""), 5000);
    }
  };

  // Handle Google login
  const handleGoogleLogin = async () => {
    try {
      // Para novos usuários, mostrar modal de seleção de role
      if (activeTab === 'signup') {
        setShowRoleSelectionModal(true);
        setPendingGoogleAuth(true);
      } else {
        // Para login, usar Google OAuth diretamente
        await signInWithGoogle();
      }
    } catch (error) {
      console.error('Erro no login com Google:', error);
    }
  };

  const handleRoleSelection = async (role: string) => {
    try {
      await signInWithGoogle();
      setShowRoleSelectionModal(false);
      setPendingGoogleAuth(false);
    } catch (error) {
      console.error('Erro no cadastro com Google:', error);
      setShowRoleSelectionModal(false);
      setPendingGoogleAuth(false);
    }
  };

  // If user is already logged in, redirect to profile
  if (user && !loading) {
    return <Navigate to="/perfil" />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <div className="flex-1 container max-w-md py-12">
        <div className="text-center mb-8">
          <img src={emailLogoUrl} alt="Borboleta" className="w-16 h-16 mx-auto" />
          <h1 className="text-2xl font-bold mt-4 text-butterfly-orange">Queren Hapuque</h1>
          <p className="text-gray-600 mt-2">Entre ou crie uma conta para continuar</p>
        </div>
        


        <Card>
          <CardHeader>
            <Tabs 
              value={activeTab} 
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Cadastro</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="mt-4">
              </TabsContent>
              
              <TabsContent value="signup" className="mt-4">
              </TabsContent>
            </Tabs>
          </CardHeader>

          <CardContent>
            {successMessage && (
              <Alert className="mb-4">
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}
            
            {activeTab === "login" ? (
              <LoginForm />
            ) : (
              <SignupForm onGoogleAuth={handleGoogleLogin} onSuccess={handleSignupSuccess} />
            )}
          </CardContent>

          <CardFooter className="flex flex-col">
            <Separator className="my-4" />
            <p className="text-xs text-gray-500 text-center">
              Ao entrar ou se cadastrar, você concorda com nossos{" "}
              <a href="/termos" className="text-butterfly-orange hover:underline">
                Termos de Uso
              </a>{" "}
              e{" "}
              <a href="/privacidade" className="text-butterfly-orange hover:underline">
                Política de Privacidade
              </a>
              .
            </p>
          </CardFooter>
        </Card>
      </div>
      <Footer />
      
      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
      />
      
      <RoleSelectionModal
        isOpen={showRoleSelectionModal}
        onClose={() => {
          setShowRoleSelectionModal(false);
          setPendingGoogleAuth(false);
        }}
        onRoleSelect={handleRoleSelection}
      />
      
      <EmailConfirmationModalNew
        isOpen={showEmailConfirmationModal}
        onClose={() => {
          setShowEmailConfirmationModal(false);
          setActiveTab("login");
        }}
        email={registeredEmail}
        onResendEmail={async () => {
          try {
            await resendConfirmationEmail(registeredEmail);
            setSuccessMessage('Email de confirmação reenviado com sucesso!');
            setTimeout(() => setSuccessMessage(''), 3000);
          } catch (error) {
            console.error('Erro ao reenviar email:', error);
          }
        }}
        isResending={isResending}
      />
    </div>
  );
};

export default Auth;

