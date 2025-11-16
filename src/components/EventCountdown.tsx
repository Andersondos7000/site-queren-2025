
import React, { useState, useEffect } from 'react';

interface CountdownProps {
  targetDate: Date;
  className?: string;
}

const EventCountdown: React.FC<CountdownProps> = ({ targetDate, className = "" }) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = +targetDate - +new Date();
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <div className={`flex flex-wrap justify-center gap-4 ${className}`}>
      <div className="flex flex-col items-center">
        <div className="bg-butterfly-orange text-white text-2xl md:text-4xl font-bold rounded-lg w-16 md:w-24 h-16 md:h-24 flex items-center justify-center">
          {timeLeft.days}
        </div>
        <span className="mt-2 text-xs md:text-sm">Dias</span>
      </div>
      
      <div className="flex flex-col items-center">
        <div className="bg-butterfly-orange text-white text-2xl md:text-4xl font-bold rounded-lg w-16 md:w-24 h-16 md:h-24 flex items-center justify-center">
          {timeLeft.hours}
        </div>
        <span className="mt-2 text-xs md:text-sm">Horas</span>
      </div>
      
      <div className="flex flex-col items-center">
        <div className="bg-butterfly-orange text-white text-2xl md:text-4xl font-bold rounded-lg w-16 md:w-24 h-16 md:h-24 flex items-center justify-center">
          {timeLeft.minutes}
        </div>
        <span className="mt-2 text-xs md:text-sm">Minutos</span>
      </div>
      
      <div className="flex flex-col items-center">
        <div className="bg-butterfly-orange text-white text-2xl md:text-4xl font-bold rounded-lg w-16 md:w-24 h-16 md:h-24 flex items-center justify-center">
          {timeLeft.seconds}
        </div>
        <span className="mt-2 text-xs md:text-sm">Segundos</span>
      </div>
    </div>
  );
};

export default EventCountdown;
