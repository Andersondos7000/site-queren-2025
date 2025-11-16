
import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const Terms = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto bg-white p-6 md:p-8 rounded-lg shadow-sm">
          <h1 className="text-3xl font-bold mb-6 text-butterfly-orange">Termos de Serviço</h1>
          
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. Aceitação dos Termos</h2>
            <p className="text-gray-700 mb-4">
              Ao acessar ou usar o site Borboleta Eventos, você concorda em cumprir e estar sujeito a estes Termos de Serviço. Se você não concordar com qualquer parte destes termos, não poderá acessar ou usar nossos serviços.
            </p>
          </section>
          
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Descrição do Serviço</h2>
            <p className="text-gray-700 mb-4">
              Borboleta Eventos é uma plataforma de venda de ingressos para eventos e produtos relacionados. Nosso serviço permite aos usuários:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Comprar ingressos para eventos</li>
              <li>Adquirir produtos oficiais relacionados aos eventos</li>
              <li>Gerenciar ingressos e pedidos</li>
              <li>Receber informações sobre eventos futuros</li>
            </ul>
          </section>
          
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. Cadastro e Contas</h2>
            <p className="text-gray-700 mb-4">
              Para utilizar determinados serviços, pode ser necessário criar uma conta. Você é responsável por manter a confidencialidade de suas credenciais e por todas as atividades que ocorrem em sua conta. Você deve:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Fornecer informações precisas e completas</li>
              <li>Manter suas informações atualizadas</li>
              <li>Proteger sua senha e acesso à conta</li>
              <li>Notificar imediatamente qualquer uso não autorizado</li>
            </ul>
          </section>
          
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. Política de Compra e Reembolso</h2>
            <p className="text-gray-700 mb-4">
              Ao realizar uma compra em nossa plataforma, você concorda com as seguintes condições:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Todos os ingressos estão sujeitos à disponibilidade</li>
              <li>Os preços estão sujeitos a alterações sem aviso prévio</li>
              <li>Reembolsos são permitidos somente em circunstâncias específicas, como cancelamento do evento</li>
              <li>Alterações de nome nos ingressos podem estar sujeitas a taxas adicionais</li>
            </ul>
          </section>
          
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. Conduta do Usuário</h2>
            <p className="text-gray-700 mb-4">
              Ao usar nossos serviços, você concorda em não:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Violar leis ou regulamentos aplicáveis</li>
              <li>Revender ingressos sem autorização</li>
              <li>Usar a plataforma para qualquer atividade fraudulenta</li>
              <li>Interferir no funcionamento do site ou servidores</li>
              <li>Tentar acessar áreas restritas da plataforma</li>
            </ul>
          </section>
          
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">6. Propriedade Intelectual</h2>
            <p className="text-gray-700 mb-4">
              Todo o conteúdo presente no site, incluindo textos, gráficos, logotipos, ícones, imagens, clipes de áudio, downloads digitais e compilações de dados, é propriedade da Borboleta Eventos ou de seus fornecedores de conteúdo e está protegido por leis de propriedade intelectual.
            </p>
          </section>
          
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">7. Limitação de Responsabilidade</h2>
            <p className="text-gray-700 mb-4">
              A Borboleta Eventos não será responsável por quaisquer danos indiretos, incidentais, especiais, consequenciais ou punitivos, ou por qualquer perda de lucros ou receitas, seja direta ou indiretamente, ou qualquer perda de dados, uso, boa vontade ou outras perdas intangíveis.
            </p>
          </section>
          
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">8. Modificações nos Termos</h2>
            <p className="text-gray-700 mb-4">
              Reservamos o direito de modificar estes Termos de Serviço a qualquer momento. Alterações significativas serão notificadas através do site ou por e-mail. O uso continuado do serviço após tais alterações constitui sua aceitação dos novos termos.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-4">9. Lei Aplicável</h2>
            <p className="text-gray-700 mb-4">
              Estes Termos serão regidos e interpretados de acordo com as leis do Brasil. Qualquer disputa relacionada aos serviços será submetida à jurisdição exclusiva dos tribunais do Brasil.
            </p>
            <p className="text-gray-700">
              Última atualização: 1 de maio de 2025
            </p>
          </section>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Terms;
