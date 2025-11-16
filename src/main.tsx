import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// import { runDiagnostics } from './lib/diag_supabase.ts';

// Comentando diagnósticos para evitar possível loop infinito
// runDiagnostics();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
