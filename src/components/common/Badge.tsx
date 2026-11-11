import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export function Badge({
  children,
  variant = 'neutral',
  size = 'sm',
  className = '',
  dot = false,
}: BadgeProps) {
  const variantStyles = {
    success: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80',
    danger: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/80',
    warning: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/80',
    info: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/80',
    purple: 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/80',
    neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  };

  const dotColors = {
    success: 'bg-emerald-500',
    danger: 'bg-rose-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
    purple: 'bg-purple-500',
    neutral: 'bg-slate-400',
  };

  const sizeStyles = {
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3 py-1 text-xs font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}
