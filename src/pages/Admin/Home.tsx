import React from 'react';
import AdminSidebar from '@/components/AdminSidebar';
import HomeProductsManager from '@/components/admin/HomeProductsManager';

const AdminHome: React.FC = () => {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-100">
      <AdminSidebar />
      
      <div className="flex-1 p-4 sm:p-6 lg:p-8 w-full lg:w-auto pt-20 lg:pt-4">
        <h1 className="text-3xl font-bold mb-6">Gerenciar Produtos da Home</h1>
        <HomeProductsManager />
      </div>
    </div>
  );
};

export default AdminHome;


















