
import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const Privacy = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto bg-white p-6 md:p-8 rounded-lg shadow-sm">
          <h1 className="text-3xl font-bold mb-6 text-butterfly-orange">Política de Privacidade</h1>
          
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. Introdução</h2>
            <p className="text-gray-700 mb-4">
              A Borboleta Eventos valoriza a privacidade de nossos usuários. Esta Política de Privacidade explica como coletamos, usamos, divulgamos e protegemos suas informações pessoais quando você usa nosso site e serviços.
            </p>
          </section>
          
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Informações que Coletamos</h2>
            <p className="text-gray-700 mb-4">
              Podemos coletar os seguintes tipos de informação:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li><strong>Informações Pessoais:</strong> nome, endereço de e-mail, número de telefone, endereço postal, CPF</li>
              <li><strong>Informações de Pagamento:</strong> dados do cartão de crédito, informações de faturamento</li>
              <li><strong>Informações de Uso:</strong> como você interage com nosso site, preferências de eventos</li>
              <li><strong>Informações do Dispositivo:</strong> endereço IP, tipo de navegador, provedor de serviços de Internet</li>
            </ul>
          </section>
          
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. Como Usamos suas Informações</h2>
            <p className="text-gray-700 mb-4">
              Utilizamos suas informações pessoais para os seguintes fins:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Processar transações e enviar ingressos</li>
              <li>Gerenciar sua conta e fornecer suporte ao cliente</li>
              <li>Enviar informações sobre eventos e promoções</li>
              <li>Melhorar nossos serviços e desenvolver novos recursos</li>
              <li>Cumprir obrigações legais</li>
            </ul>
          </section>
          
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. Compartilhamento de Informações</h2>
            <p className="text-gray-700 mb-4">
              Podemos compartilhar suas informações pessoais com:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li><strong>Organizadores de eventos:</strong> para facilitar o acesso ao evento</li>
              <li><strong>Provedores de serviços:</strong> que nos auxiliam com processamento de pagamentos, hospedagem do site, análise de dados</li>
              <li><strong>Autoridades legais:</strong> quando exigido por lei ou para proteger nossos direitos</li>
            </ul>
            <p className="text-gray-700">
              Não vendemos suas informações pessoais a terceiros para fins de marketing.
            </p>
          </section>
          
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. Cookies e Tecnologias Semelhantes</h2>
            <p className="text-gray-700 mb-4">
              Utilizamos cookies e tecnologias semelhantes para melhorar sua experiência em nosso site, analisar o uso e personalizar conteúdos. Você pode gerenciar as preferências de cookies através das configurações do seu navegador.
            </p>
          </section>
          
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">6. Segurança de Dados</h2>
            <p className="text-gray-700 mb-4">
              Implementamos medidas de segurança técnicas e organizacionais para proteger suas informações pessoais contra acesso não autorizado, perda ou alteração. No entanto, nenhum método de transmissão pela Internet ou método de armazenamento eletrônico é 100% seguro.
            </p>
          </section>
          
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">7. Seus Direitos</h2>
            <p className="text-gray-700 mb-4">
              Dependendo da sua localização, você pode ter os seguintes direitos em relação às suas informações pessoais:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Acessar e receber uma cópia das suas informações pessoais</li>
              <li>Corrigir informações imprecisas</li>
              <li>Solicitar a exclusão de suas informações</li>
              <li>Retirar consentimento para determinados processamentos</li>
              <li>Restringir ou opor-se ao processamento de suas informações</li>
            </ul>
            <p className="text-gray-700">
              Para exercer esses direitos, entre em contato conosco através dos meios fornecidos abaixo.
            </p>
          </section>
          
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">8. Retenção de Dados</h2>
            <p className="text-gray-700 mb-4">
              Mantemos suas informações pessoais pelo tempo necessário para cumprir os fins para os quais foram coletadas, incluindo requisitos legais, contábeis ou de relatórios.
            </p>
          </section>
          
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">9. Crianças</h2>
            <p className="text-gray-700 mb-4">
              Nossos serviços não são destinados a pessoas menores de 18 anos. Não coletamos intencionalmente informações pessoais de crianças. Se soubermos que coletamos informações de uma criança sem verificação de consentimento parental, tomaremos medidas para remover essas informações.
            </p>
          </section>
          
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">10. Alterações nesta Política</h2>
            <p className="text-gray-700 mb-4">
              Podemos atualizar esta política periodicamente para refletir mudanças em nossas práticas ou por outros motivos operacionais, legais ou regulatórios. Notificaremos você sobre quaisquer alterações significativas através do nosso site ou por outros meios.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-4">11. Contato</h2>
            <p className="text-gray-700 mb-4">
              Se você tiver dúvidas ou preocupações sobre esta Política de Privacidade ou nossas práticas de processamento de dados, entre em contato conosco em:
            </p>
            <div className="bg-gray-50 p-4 rounded-md text-gray-700">
              <p><strong>Borboleta Eventos</strong></p>
              <p>Email: privacidade@borboletaeventos.com.br</p>
              <p>Telefone: (11) 3456-7890</p>
              <p>Endereço: Avenida Filadélfia, Araguaína - TO</p>
            </div>
            <p className="text-gray-700 mt-4">
              Última atualização: 1 de maio de 2025
            </p>
          </section>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Privacy;
