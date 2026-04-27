import { useEffect, useState } from 'react';

interface GameTimerProps {
  durationSeconds: number;
  onTimeUp?: () => void;
}

export default function GameTimer({ durationSeconds, onTimeUp }: GameTimerProps) {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);

  useEffect(() => {
    if (timeLeft <= 0) {
      if (onTimeUp) onTimeUp();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onTimeUp]);

  const progressPercentage = (timeLeft / durationSeconds) * 100;

  let colorClass = "bg-blue-500";
  if (progressPercentage < 25) {
    colorClass = "bg-red-500 animate-pulse";
  } else if (progressPercentage < 50) {
    colorClass = "bg-yellow-500";
  }

  return (
    <div className="w-full bg-gray-200 rounded-full h-4 mb-6 shadow-inner overflow-hidden">
      <div 
        className={`h-4 rounded-full transition-all duration-1000 ease-linear ${colorClass}`}
        style={{ width: `${Math.max(0, progressPercentage)}%` }}
      ></div>
    </div>
  );
}
