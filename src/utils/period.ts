import {
  format,
  startOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  subDays,
  subYears,
  differenceInCalendarDays,
  parseISO,
} from 'date-fns';
import type { DatePeriodFilter, DateRange, Transaction } from '../types';
import { formatDate } from './formatters';

const f = (d: Date) => format(d, 'yyyy-MM-dd');

export const PERIOD_OPTIONS: { id: DatePeriodFilter; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mês' },
  { id: 'last_month', label: 'Mês passado' },
  { id: 'year', label: 'Este ano' },
  { id: 'custom', label: 'Personalizado' },
];

export function todayStr(): string {
  return f(new Date());
}

/** Intervalo de datas (inclusivo) do período escolhido */
export function getPeriodRange(period: DatePeriodFilter, custom?: DateRange): DateRange {
  const now = new Date();
  switch (period) {
    case 'today':
      return { start: f(startOfDay(now)), end: f(now) };
    case 'week':
      return { start: f(startOfWeek(now, { weekStartsOn: 1 })), end: f(endOfWeek(now, { weekStartsOn: 1 })) };
    case 'last_month': {
      const last = subMonths(now, 1);
      return { start: f(startOfMonth(last)), end: f(endOfMonth(last)) };
    }
    case 'year':
      return { start: f(startOfYear(now)), end: f(endOfYear(now)) };
    case 'custom':
      return custom && custom.start && custom.end
        ? { start: custom.start <= custom.end ? custom.start : custom.end, end: custom.start <= custom.end ? custom.end : custom.start }
        : { start: f(startOfMonth(now)), end: f(endOfMonth(now)) };
    case 'month':
    default:
      return { start: f(startOfMonth(now)), end: f(endOfMonth(now)) };
  }
}

/** Período anterior equivalente (para comparar % de variação) */
export function getPreviousRange(period: DatePeriodFilter, range: DateRange): DateRange {
  const start = parseISO(range.start);
  const end = parseISO(range.end);
  if (period === 'month' || period === 'last_month') {
    const prev = subMonths(start, 1);
    return { start: f(startOfMonth(prev)), end: f(endOfMonth(prev)) };
  }
  if (period === 'year') {
    const prev = subYears(start, 1);
    return { start: f(startOfYear(prev)), end: f(endOfYear(prev)) };
  }
  const days = differenceInCalendarDays(end, start) + 1;
  return { start: f(subDays(start, days)), end: f(subDays(start, 1)) };
}

export function periodLabel(period: DatePeriodFilter, range: DateRange): string {
  const opt = PERIOD_OPTIONS.find((p) => p.id === period)?.label || '';
  const dates =
    range.start === range.end
      ? formatDate(range.start)
      : `${formatDate(range.start)} a ${formatDate(range.end)}`;
  return period === 'custom' ? dates : `${opt} (${dates})`;
}

export function inRange(date: string | undefined, range: DateRange): boolean {
  if (!date) return false;
  const d = date.slice(0, 10);
  return d >= range.start && d <= range.end;
}

/**
 * Data que vale para o caixa:
 * pago -> data do pagamento; pendente -> vencimento.
 */
export function cashDate(t: Transaction): string {
  if (t.status === 'paid') return (t.paymentDate || t.date || t.dueDate || '').slice(0, 10);
  return (t.dueDate || t.date || '').slice(0, 10);
}
