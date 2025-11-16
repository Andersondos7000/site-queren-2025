import React from 'react';

export const DebugEnv: React.FC = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'white', 
      border: '1px solid #ccc', 
      padding: '10px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px',
      wordBreak: 'break-all'
    }}>
      <h4>Debug Environment Variables</h4>
      <p><strong>VITE_SUPABASE_URL:</strong> {supabaseUrl || 'NOT FOUND'}</p>
      <p><strong>VITE_SUPABASE_ANON_KEY:</strong> {supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'NOT FOUND'}</p>
      <p><strong>Environment:</strong> {import.meta.env.MODE}</p>
    </div>
  );
};