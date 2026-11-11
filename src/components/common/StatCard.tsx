import React from 'react';
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number; // percentage, e.g. 12.5 or -5.2
    label?: string; // e.g. 'vs mês anterior'
    isPositiveGood?: boolean; // default true (false for expenses where down is good)
  };
  highlight?: 'red' | 'green' | 'blue' | 'amber' | 'none';
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  highlight = 'none',
  onClick,
}: StatCardProps) {
  const highlightStyles = {
    none: 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800',
    red: 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800/80 shadow-rose-500/5',
    green: 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/80 shadow-emerald-500/5',
    blue: 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800/80 shadow-blue-500/5',
    amber: 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/80 shadow-amber-500/5',
  };

  const isUp = trend ? trend.value >= 0 : false;
  const isGood = trend ? (trend.isPositiveGood !== false ? isUp : !isUp) : true;

  return (
    <div
      onClick={onClick}
      className={`relative p-5 rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md ${
        highlightStyles[highlight]
      } ${onClick ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-700' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
            {title}
          </p>
          <h3 className="text-lg xl:text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1.5 font-mono whitespace-nowrap truncate" title={value}>
            {value}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>

        {icon && (
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
            {icon}
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center gap-1.5 text-xs">
          <span
            className={`inline-flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded-md ${
              isGood
                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60'
                : 'text-rose-700 dark:text-rose-400 bg-rose-100/70 dark:bg-rose-950/60'
            }`}
          >
            {isUp ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            {Math.abs(trend.value).toFixed(1)}%
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            {trend.label || 'vs mês anterior'}
          </span>
        </div>
      )}
    </div>
  );
}
