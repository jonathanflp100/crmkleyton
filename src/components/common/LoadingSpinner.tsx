import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({ message = 'Carregando...', size = 'md' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 dark:text-slate-400">
      <Loader2 className={`animate-spin text-blue-600 mb-2.5 ${sizeClasses[size]}`} />
      {message && <p className="text-xs font-medium tracking-wide">{message}</p>}
    </div>
  );
}
