
import React from 'react';

const LocationMap = () => {
  return (
    <div className="w-full h-72 md:h-80 rounded-lg overflow-hidden">
      <iframe
        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3924.5!2d-48.2048!3d-7.1928!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sAraguaína%2C%20TO!5e0!3m2!1spt-BR!2sbr!4v1640995200000!5m2!1spt-BR!2sbr"
        width="100%"
        height="100%"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title="Localização do Evento - Araguaína, TO"
        className="w-full h-full"
      />
    </div>
  );
};

export default LocationMap;
