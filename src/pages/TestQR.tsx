import React from 'react';
import { QRCode } from '../components/ui/qr-code';

export default function TestQR() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Teste QR Code</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* QR Code pequeno */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4">QR Code Pequeno (100px)</h3>
            <QRCode 
              value="TICKET-123456" 
              size={100} 
              level="M"
            />
          </div>

          {/* QR Code médio */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4">QR Code Médio (150px)</h3>
            <QRCode 
              value="TICKET-789012" 
              size={150} 
              level="M"
            />
          </div>

          {/* QR Code grande */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4">QR Code Grande (200px)</h3>
            <QRCode 
              value="TICKET-345678" 
              size={200} 
              level="H"
            />
          </div>

          {/* QR Code com dados longos */}
          <div className="bg-white p-6 rounded-lg shadow-md col-span-full">
            <h3 className="text-lg font-semibold mb-4">QR Code com Dados Longos</h3>
            <QRCode 
              value="https://querenhapuque.com/ticket/verify?id=123456789&event=queren-hapuque-2026&date=2026-04-18" 
              size={180} 
              level="M"
            />
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-600">
            Se você consegue ver os QR codes acima, a implementação está funcionando corretamente!
          </p>
        </div>
      </div>
    </div>
  );
}