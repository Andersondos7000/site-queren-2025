import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calendar, Shirt, ArrowDown, ArrowRight, Package } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import EventCountdown from '@/components/EventCountdown';
import LocationMap from '@/components/LocationMap';
import OptimizedImage from '@/components/OptimizedImage';
import PackageCard from '@/components/PackageCard';
import { useHomeProducts } from '@/hooks/useHomeProducts';
import { usePackages } from '@/hooks/usePackages';
import { DataErrorFallback, LoadingFallback, EmptyState } from '@/components/ui/data-states';

const Index = () => {
  const { homeProducts, loading, error, isUsingFallback, retry } = useHomeProducts();
  const { packages, loading: isLoadingPackages, error: packagesError } = usePackages();
  
  // Data do evento: 18 de Abril de 2026
const eventDate = new Date('2026-04-18T09:00:00');

  // Data de início das vendas: 1 de Outubro de 2025
  const salesStartDate = new Date('2025-01-01T00:00:00');
  
  // Verifica se as vendas de ingressos já começaram
  const ticketSalesStarted = new Date() >= salesStartDate;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative text-white">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[url('/capa-home.webp')] bg-center bg-no-repeat bg-cover"></div>
        </div>
        
        <div className="container mx-auto px-4 py-24 md:py-32 relative z-10">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
            <div className="w-24 h-24 mb-6" aria-hidden="true"></div>
            
            <h1 className="font-display text-4xl md:text-6xl font-bold mb-4 drop-shadow-xl">
              <div className="text-black">Queren Hapuque</div>
              <div className="text-butterfly-orange">VIII Conferência de Mulheres</div>
            </h1>
            
            <p className="text-lg md:text-xl mb-8 text-black">
              Dias 18 e 19 de Abril de 2026 • Uma jornada de transformação e renovo
            </p>
            
            <div className="flex flex-col md:flex-row gap-4 mb-12">
              <Button asChild size="lg" className="bg-butterfly-orange hover:bg-butterfly-orange/90 shadow-none hover:shadow-2xl hover:shadow-butterfly-orange/30 transform hover:scale-105 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:rotate-1 hover:shadow-orange-500/50 hover:brightness-110 active:scale-95 active:bg-slate-800 active:text-white">
                <Link to="/evento">
                  <Calendar className="mr-2 h-5 w-5 transition-transform duration-300 hover:rotate-12 hover:scale-110" /> Sobre o Evento
                </Link>
              </Button>
              
              <Button size="lg" variant="outline" className="text-butterfly-orange border-butterfly-orange hover:bg-butterfly-orange hover:text-white hover:shadow-2xl hover:shadow-butterfly-orange/30 transform hover:scale-105 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:border-butterfly-orange/80 hover:rotate-1 hover:shadow-orange-500/50 hover:brightness-110 active:scale-95 active:bg-slate-800 active:text-white active:border-slate-800">
                <Link to="/loja" className="text-inherit flex items-center">
                  <Shirt className="mr-2 h-5 w-5 transition-transform duration-300 hover:rotate-12 hover:scale-110" /> Loja Oficial
                </Link>
              </Button>
            </div>
            
            <ArrowDown className="animate-bounce text-butterfly-orange h-8 w-8" />
          </div>
        </div>
      </section>
      
      {/* Countdown Section */}
      <section className="bg-white py-24 mt-8">
        <div className="container mx-auto px-4">
          <div className="text-center">
            {ticketSalesStarted ? (
              <div>
                <div className="mb-10">
                  <h2 className="font-display text-3xl font-bold mb-2">Contagem Regressiva</h2>
                  <p className="text-gray-600">O evento começa em:</p>
                </div>
                <EventCountdown targetDate={eventDate} className="mb-10" />
                <Button asChild size="lg" className="bg-butterfly-orange hover:bg-butterfly-orange/90 hover:shadow-2xl hover:shadow-butterfly-orange/30 transform hover:scale-105 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:rotate-1 hover:shadow-orange-500/50 hover:brightness-110 active:scale-95 active:bg-slate-800 active:text-white">
                  <Link to="/ingressos">Garanta seu Ingresso Agora!</Link>
                </Button>
              </div>
            ) : (
              <div>
                <div className="mb-10">
                  <h2 className="font-display text-3xl font-bold mb-2">Contagem Regressiva</h2>
                  <p className="text-xl font-medium mb-3">As vendas começam em:</p>
                </div>
                <EventCountdown targetDate={salesStartDate} />
              </div>
            )}
          </div>
        </div>
      </section>
      
      {/* Event Info Section */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* Mapa à esquerda */}
            <div>
              <LocationMap />
            </div>
            {/* Descrição do evento à direita */}
            <div>
              <h2 className="font-display text-3xl font-bold mb-4">Sobre o Evento</h2>
              <p className="text-gray-600 mb-6">
                A VIII Conferência de Mulheres Queren Hapuque é um encontro especial projetado para transformar, 
                inspirar e capacitar mulheres de todas as idades. Uma experiência única de dois dias repletos de 
                palestras motivacionais, momentos de adoração e oportunidades de networking.
              </p>
              <div className="space-y-4">
                <div className="flex items-start mb-4">
                  <div className="bg-butterfly-orange text-white p-2 rounded mr-3">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">Data e Horário</h3>
                    <p className="text-gray-600">18 e 19 de Abril de 2026, das 9h às 18h</p>
                  </div>
                </div>
                <div className="flex items-start mb-4">
                  <div className="bg-butterfly-orange text-white p-2 rounded mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium">Local</h3>
                    <p className="text-gray-600">Centro de Convenções, Araguaína - TO</p>
                  </div>
                </div>
                <div className="flex items-start mb-4">
                  <div className="bg-butterfly-orange text-white p-2 rounded mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium">Ingressos</h3>
                    <p className="text-gray-600">R$ 90,00 por pessoa • 1300 lugares disponíveis</p>
                  </div>
                </div>
              </div>
              <Button asChild className="mt-8 bg-butterfly-orange hover:bg-butterfly-orange/90">
                <Link to="/evento">Mais Informações</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
      
      {/* Products Preview Section */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold mb-2">Produtos Oficiais</h2>
            <p className="text-gray-600">Confira nossa coleção exclusiva para o evento</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loading ? (
              <LoadingFallback 
                message="Carregando produtos em destaque..."
                submessage="Aguarde um momento..."
              />
            ) : error ? (
              <DataErrorFallback
                error={new Error(error)}
                retry={retry}
              />
            ) : homeProducts.length === 0 ? (
              <EmptyState
                title="Nenhum produto encontrado"
                description="Não há produtos em destaque no momento. Tente novamente mais tarde."
                action={{
                  label: "Recarregar",
                  onClick: retry
                }}
              />
            ) : (
              // Dynamic products from database using HomeProductCard component
              homeProducts.map((product, index) => (
                <div 
                  key={product.id} 
                  className={`bg-white rounded-lg shadow-lg overflow-hidden ${
                    index === homeProducts.length - 1 ? 'md:col-span-2 lg:col-span-1' : ''
                  }`}
                >
                  <OptimizedImage
                    src={product.image_url}
                    alt={product.title}
                    className="w-full h-48 object-cover"
                    priority={index < 3} // Priorizar as primeiras 3 imagens
                  />
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-2">{product.title}</h3>
                    <p className="text-gray-600 mb-4">{product.description}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold text-orange-600">
                        R$ {product.price || '0.00'}
                      </span>
                      <Link 
                        to={product.button_link} 
                        className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
                      >
                        {product.button_text}
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
      
      
      
      
      {/* CTA Section */}
      <section className="bg-butterfly-orange text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">Pronta para fazer parte dessa história?</h2>
          <p className="text-xl max-w-2xl mx-auto mb-8">
            Não perca a oportunidade de participar da VIII Conferência de Mulheres Queren Hapuque. 
            Reserve seu lugar hoje mesmo!
          </p>
          <Button size="lg" variant="outline" className="border-white text-butterfly-orange hover:bg-white hover:text-butterfly-orange font-medium">
            <Link to="/ingressos" className="text-inherit">Garantir Meu Ingresso</Link>
          </Button>
        </div>
      </section>
      
      <Footer />
    </div>
  );
};

export default Index;
