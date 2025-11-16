
import React from 'react';

export const ButterflyLogo: React.FC<{className?: string}> = ({ className = "" }) => {
  return (
    <svg 
      className={className}
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Corpo da borboleta */}
      <ellipse cx="50" cy="50" rx="4" ry="15" fill="#FF6B35"/>
      
      {/* Asa esquerda superior */}
      <path 
        d="M 30 35 Q 20 25 25 20 Q 30 15 35 20 Q 40 25 35 35 Z" 
        fill="#FF6B35"
        opacity="0.9"
      />
      
      {/* Asa esquerda inferior */}
      <path 
        d="M 30 55 Q 15 60 15 70 Q 15 80 25 80 Q 35 80 35 70 Q 35 60 30 55 Z" 
        fill="#FF6B35"
        opacity="0.8"
      />
      
      {/* Asa direita superior */}
      <path 
        d="M 70 35 Q 80 25 75 20 Q 70 15 65 20 Q 60 25 65 35 Z" 
        fill="#FF6B35"
        opacity="0.9"
      />
      
      {/* Asa direita inferior */}
      <path 
        d="M 70 55 Q 85 60 85 70 Q 85 80 75 80 Q 65 80 65 70 Q 65 60 70 55 Z" 
        fill="#FF6B35"
        opacity="0.8"
      />
      
      {/* Antenas */}
      <line x1="47" y1="32" x2="42" y2="25" stroke="#FF6B35" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="41" cy="23" r="2" fill="#FF6B35"/>
      
      <line x1="53" y1="32" x2="58" y2="25" stroke="#FF6B35" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="59" cy="23" r="2" fill="#FF6B35"/>
      
      {/* Detalhes decorativos nas asas */}
      <circle cx="28" cy="27" r="2" fill="#FFF" opacity="0.6"/>
      <circle cx="72" cy="27" r="2" fill="#FFF" opacity="0.6"/>
      <circle cx="23" cy="70" r="3" fill="#FFF" opacity="0.5"/>
      <circle cx="77" cy="70" r="3" fill="#FFF" opacity="0.5"/>
    </svg>
  );
};

export default ButterflyLogo;
