
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Ticket, Users } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import EventCountdown from '@/components/EventCountdown';
import OptimizedImage from '@/components/OptimizedImage';
import { Link } from 'react-router-dom';

const Evento = () => {
  // Data do evento: 18 de Abril de 2026
const eventDate = new Date('2026-04-18T09:00:00');
  
  const eventSchedule = [
    {
      day: 'Dia 1 - 15 de Dezembro',
      activities: [
        { time: '08:00 - 09:00', title: 'Credenciamento e Welcome Coffee' },
        { time: '09:00 - 10:30', title: 'Abertura Oficial e Palestra Principal' },
        { time: '10:30 - 11:00', title: 'Coffee Break' },
        { time: '11:00 - 12:30', title: 'Painel: Mulheres que Transformam' },
        { time: '12:30 - 14:00', title: 'Almoço' },
        { time: '14:00 - 15:30', title: 'Workshop: Desenvolvimento Pessoal' },
        { time: '15:30 - 16:00', title: 'Coffee Break' },
        { time: '16:00 - 17:30', title: 'Palestra Motivacional' },
        { time: '17:30 - 18:30', title: 'Momento de Adoração e Encerramento' }
      ]
    },
    {
      day: 'Dia 2 - 16 de Dezembro',
      activities: [
        { time: '08:30 - 09:00', title: 'Abertura do Segundo Dia' },
        { time: '09:00 - 10:30', title: 'Palestra: Superando Desafios' },
        { time: '10:30 - 11:00', title: 'Coffee Break' },
        { time: '11:00 - 12:30', title: 'Painel: Propósito e Vocação' },
        { time: '12:30 - 14:00', title: 'Almoço' },
        { time: '14:00 - 15:30', title: 'Workshop: Liderança Feminina' },
        { time: '15:30 - 16:00', title: 'Coffee Break' },
        { time: '16:00 - 17:30', title: 'Palestra de Encerramento' },
        { time: '17:30 - 18:30', title: 'Celebração Final e Despedida' }
      ]
    }
  ];
  




  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative bg-butterfly-black text-white py-24">
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute inset-0 bg-[url('/02.jpg')] bg-center bg-no-repeat bg-cover"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl">
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-6">
              VIII Conferência de Mulheres<br />
              <span className="text-butterfly-orange">Queren Hapuque</span>
            </h1>
            
            <p className="text-xl mb-6 max-w-2xl">
              Uma experiência transformadora para mulheres que buscam crescimento espiritual, 
              desenvolvimento pessoal e conexões significativas.
            </p>
            
            <div className="flex flex-wrap gap-6 mb-8">
              <div className="flex items-center">
                <Calendar className="text-butterfly-orange mr-2 h-5 w-5" />
                <span>18 e 19 de Abril de 2026</span>
              </div>
              
              <div className="flex items-center">
                <MapPin className="text-butterfly-orange mr-2 h-5 w-5" />
                <span>Centro de Convenções, Araguaína - TO</span>
              </div>
              
              <div className="flex items-center">
                <Ticket className="text-butterfly-orange mr-2 h-5 w-5" />
                <span>R$ 90,00</span>
              </div>
              
              <div className="flex items-center">
                <Users className="text-butterfly-orange mr-2 h-5 w-5" />
                <span>1300 vagas</span>
              </div>
            </div>
            
            <Button
              asChild
              size="lg"
              className="bg-butterfly-orange hover:bg-butterfly-orange/90"
            >
              <Link to="/ingressos">Comprar Ingressos</Link>
            </Button>
          </div>
        </div>
      </section>
      
      {/* Countdown Section */}
      <section className="bg-white py-12">
        <div className="container mx-auto px-4">
          <div className="text-center mb-6">
            <h2 className="font-display text-2xl font-bold">O Evento Começa Em</h2>
          </div>
          <EventCountdown targetDate={eventDate} />
        </div>
      </section>
      
      {/* About Section */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="font-display text-3xl font-bold mb-6">Sobre o Evento</h2>
              <p className="text-gray-700 mb-4">
                A VIII Conferência de Mulheres Queren Hapuque é um evento anual que reúne mulheres de todas as idades em busca de crescimento espiritual, desenvolvimento pessoal e networking.
              </p>
              
              <p className="text-gray-700 mb-4">
                Durante dois dias intensivos, as participantes terão acesso a palestras inspiradoras, workshops práticos e momentos de adoração conduzidos por líderes reconhecidas nacionalmente.
              </p>
              
              <p className="text-gray-700 mb-8">
                Mais que um evento, a conferência proporciona um ambiente de transformação, onde mulheres encontram inspiração, direcionamento e ferramentas para viverem com propósito e impacto em suas comunidades.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex-1 min-w-[180px]">
                  <h3 className="font-medium text-lg mb-2">12 Palestrantes</h3>
                  <p className="text-gray-600">Especialistas nacionais e internacionais</p>
                </div>
                
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex-1 min-w-[180px]">
                  <h3 className="font-medium text-lg mb-2">6 Workshops</h3>
                  <p className="text-gray-600">Experiências práticas e aplicáveis</p>
                </div>
                
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex-1 min-w-[180px]">
                  <h3 className="font-medium text-lg mb-2">2 Dias</h3>
                  <p className="text-gray-600">De conteúdo transformador</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 h-fit">
              <OptimizedImage 
                src="/01.jpg" 
                alt="Momento especial da VIII Conferência de Mulheres Queren Hapuque" 
                className="rounded-lg"
                square={true}
              />
              <OptimizedImage 
                src="/02.jpg" 
                alt="Participantes em momento de adoração e conexão" 
                className="rounded-lg"
                square={true}
              />
              <OptimizedImage 
                src="/03.jpg" 
                alt="Workshop interativo de desenvolvimento pessoal" 
                className="rounded-lg"
                square={true}
              />
              <OptimizedImage 
                src="/04.jpg" 
                alt="Palestrante inspiradora compartilhando conhecimento" 
                className="rounded-lg"
                square={true}
              />
            </div>
          </div>
        </div>
      </section>
      
      {/* Schedule Section */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-3xl font-bold mb-10 text-center">Programação do Evento</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {eventSchedule.map((day, index) => (
              <div key={`${day.day}-${index}`} className="bg-gray-50 rounded-lg p-6 shadow-sm">
                <h3 className="text-xl font-bold mb-6 pb-2 border-b-2 border-butterfly-orange">
                  {day.day}
                </h3>
                
                <div className="space-y-4">
                  {day.activities.map((activity, idx) => (
                    <div key={`${activity.title}-${idx}`} className="flex">
                      <div className="w-24 font-medium text-butterfly-orange shrink-0">
                        {activity.time}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{activity.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-10 text-center">
            <p className="text-gray-600 italic">
              * A programação está sujeita a alterações. Confira as atualizações em nosso site.
            </p>
          </div>
        </div>
      </section>
      

      
      {/* FAQ Section */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-3xl font-bold mb-10 text-center">Perguntas Frequentes</h2>
          
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-2">O que está incluso no ingresso?</h3>
              <p className="text-gray-600">
                O ingresso dá acesso aos dois dias completos de evento, incluindo todas as palestras, 
                workshops e materiais digitais. Coffee breaks estão inclusos, mas o almoço deve ser adquirido separadamente.
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-2">É possível transferir meu ingresso para outra pessoa?</h3>
              <p className="text-gray-600">
                Sim, é possível transferir seu ingresso até 7 dias antes do evento. Para isso, 
                entre em contato com nossa central de atendimento informando os dados da nova participante.
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-2">Qual a política de cancelamento?</h3>
              <p className="text-gray-600">
                Cancelamentos podem ser solicitados com até 30 dias de antecedência para reembolso de 70% do valor. 
                Entre 29 e 15 dias, o reembolso será de 50%. Após esse período, não haverá reembolso.
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-2">O local do evento tem acessibilidade?</h3>
              <p className="text-gray-600">
                Sim, o local é totalmente acessível, com rampas, elevadores e banheiros adaptados. 
                Se precisar de assistência especial, informe no momento da compra do ingresso.
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-2">Haverá estacionamento no local?</h3>
              <p className="text-gray-600">
                Sim, o local conta com estacionamento pago. Recomendamos também o uso de transporte por aplicativo 
                ou transporte público, pois o local é bem servido por linhas de ônibus e metrô.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Instagram Section */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-3xl font-bold mb-10 text-center">Momentos no Instagram</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <OptimizedImage 
              src="/doc/img/instagram/01.jpg" 
              alt="Momento da conferência no Instagram" 
              className="rounded-lg shadow-sm hover:shadow-md transition-shadow hover:scale-105 transition-transform duration-300"
              square={true}
            />
            <OptimizedImage 
              src="/doc/img/instagram/02.jpg" 
              alt="Participantes da conferência no Instagram" 
              className="rounded-lg shadow-sm hover:shadow-md transition-shadow hover:scale-105 transition-transform duration-300"
              square={true}
            />
            <OptimizedImage 
              src="/doc/img/instagram/03.jpg" 
              alt="Palestrante da conferência no Instagram" 
              className="rounded-lg shadow-sm hover:shadow-md transition-shadow hover:scale-105 transition-transform duration-300"
              square={true}
            />
            <OptimizedImage 
              src="/doc/img/instagram/04.jpg" 
              alt="Momento especial da conferência no Instagram" 
              className="rounded-lg shadow-sm hover:shadow-md transition-shadow hover:scale-105 transition-transform duration-300"
              square={true}
            />
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-gray-600 mb-4">
              Acompanhe mais momentos e novidades em nosso Instagram
            </p>
            <Button
              asChild
              variant="outline"
              className="border-butterfly-orange text-butterfly-orange hover:bg-butterfly-orange hover:text-white"
            >
              <a href="https://www.instagram.com/conferenciaquerenhapuque/" target="_blank" rel="noopener noreferrer">
                Seguir no Instagram
              </a>
            </Button>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="bg-butterfly-orange text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">
            Transforme sua vida na VIII Conferência de Mulheres
          </h2>
          <p className="text-xl max-w-2xl mx-auto mb-8">
            Junte-se a centenas de mulheres nesta experiência única de crescimento, 
            conexão e transformação. Garanta seu lugar hoje mesmo!
          </p>
          <Button
            asChild
            size="lg"
            className="bg-white hover:bg-butterfly-orange text-butterfly-orange border border-butterfly-orange hover:text-white transition-colors"
          >
            <Link to="/ingressos">Comprar Ingressos Agora</Link>
          </Button>
        </div>
      </section>
      
      <Footer />
    </div>
  );
};

export default Evento;
