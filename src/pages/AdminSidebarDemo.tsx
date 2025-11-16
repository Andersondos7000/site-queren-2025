import React from 'react';
import AdminSidebar from '@/components/AdminSidebar';

const AdminSidebarDemo: React.FC = () => {
  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <div className="flex-1 p-8 bg-gray-50">
        <h1 className="text-2xl font-bold mb-4">Demonstração do AdminSidebar</h1>
        <p className="text-gray-600">
          Esta página demonstra o layout do AdminSidebar com o botão "← Voltar ao site" 
          movido para o lado direito do cabeçalho.
        </p>
      </div>
    </div>
  );
};

export default AdminSidebarDemo;