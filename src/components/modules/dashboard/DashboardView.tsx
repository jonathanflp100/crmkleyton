import React, { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Briefcase,
  CheckCircle2,
  PieChart as PieIcon,
  BarChart2,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
} from 'recharts';
import { format, subMonths, parseISO, isAfter, isBefore, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  Transaction,
  Deal,
  Account,
  DatePeriodFilter,
  Category,
} from '../../../types';
import { StatCard } from '../../common/StatCard';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { Badge } from '../../common/Badge';

interface DashboardViewProps {
  transactions: Transaction[];
  deals: Deal[];
  accounts: Account[];
  categories: Category[];
  period: DatePeriodFilter;
  onNavigateTo: (module: any) => void;
  onNewTransaction: (type: 'income' | 'expense') => void;
}

export function DashboardView({
  transactions,
  deals,
  accounts,
  categories,
  period,
  onNavigateTo,
  onNewTransaction,
}: DashboardViewProps) {
  const now = new Date();
  const currentMonthKey = format(now, 'yyyy-MM');
  const prevMonthKey = format(subMonths(now, 1), 'yyyy-MM');

  // Filter transactions based on selected period
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const d = parseISO(t.date || t.dueDate);
      if (period === 'today') {
        return format(d, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
      }
      if (period === 'week') {
        const weekAgo = subMonths(now, 0); // approx
        return isAfter(d, addDays(now, -7));
      }
      if (period === 'year') {
        return format(d, 'yyyy') === format(now, 'yyyy');
      }
      // default: month
      return format(d, 'yyyy-MM') === currentMonthKey;
    });
  }, [transactions, period, currentMonthKey, now]);

  // Current Month calculations
  const curMonthTrans = useMemo(() => {
    return transactions.filter((t) => (t.date || t.dueDate).startsWith(currentMonthKey));
  }, [transactions, currentMonthKey]);

  // Previous Month calculations (for comparison trend %)
  const prevMonthTrans = useMemo(() => {
    return transactions.filter((t) => (t.date || t.dueDate).startsWith(prevMonthKey));
  }, [transactions, prevMonthKey]);

  const curIncomes = curMonthTrans
    .filter((t) => t.type === 'income' && t.status === 'paid')
    .reduce((sum, t) => sum + t.amount, 0);

  const prevIncomes = prevMonthTrans
    .filter((t) => t.type === 'income' && t.status === 'paid')
    .reduce((sum, t) => sum + t.amount, 0);

  const curExpenses = curMonthTrans
    .filter((t) => t.type === 'expense' && t.status === 'paid')
    .reduce((sum, t) => sum + t.amount, 0);

  const prevExpenses = prevMonthTrans
    .filter((t) => t.type === 'expense' && t.status === 'paid')
    .reduce((sum, t) => sum + t.amount, 0);

  const curProfit = curIncomes - curExpenses;
  const prevProfit = prevIncomes - prevExpenses;

  // Percentage variations
  const incomeTrend = prevIncomes > 0 ? ((curIncomes - prevIncomes) / prevIncomes) * 100 : 0;
  const expenseTrend = prevExpenses > 0 ? ((curExpenses - prevExpenses) / prevExpenses) * 100 : 0;
  const profitTrend = prevProfit !== 0 ? ((curProfit - prevProfit) / Math.abs(prevProfit)) * 100 : 0;

  // Account balances sum
  const totalBalance = useMemo(() => {
    return accounts.reduce((acc, a) => acc + (a.currentBalance || 0), 0);
  }, [accounts]);

  // Pending Receivables & Payables
  const pendingReceivables = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'income' && t.status !== 'paid')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const pendingPayables = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'expense' && t.status !== 'paid')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  // Overdue transactions (highlighted in red)
  const overdueTransactions = useMemo(() => {
    const todayStr = format(now, 'yyyy-MM-dd');
    return transactions.filter(
      (t) => (t.status === 'overdue' || (t.status === 'pending' && t.dueDate < todayStr))
    );
  }, [transactions, now]);

  const overdueTotal = useMemo(() => {
    return overdueTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [overdueTransactions]);

  // Open Deals in CRM Pipeline
  const openDeals = useMemo(() => {
    return deals.filter((d) => d.stageId !== 'ganho' && d.stageId !== 'perdido');
  }, [deals]);

  const openDealsTotal = useMemo(() => {
    return openDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  }, [openDeals]);

  // 12-Month Incomes x Expenses + Profit Chart Data
  const monthlyChartData = useMemo(() => {
    const data = [];
    for (let i = 11; i >= 0; i--) {
      const targetMonth = subMonths(now, i);
      const key = format(targetMonth, 'yyyy-MM');
      const label = format(targetMonth, 'MMM/yy', { locale: ptBR });

      const monthItems = transactions.filter(
        (t) => (t.date || t.dueDate).startsWith(key) && t.status === 'paid'
      );

      const inc = monthItems
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const exp = monthItems
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      data.push({
        month: label,
        Entradas: Math.round(inc),
        Saídas: Math.round(exp),
        Lucro: Math.round(inc - exp),
      });
    }
    return data;
  }, [transactions, now]);

  // Category Pie Chart Data (Expenses of current month)
  const categoryPieData = useMemo(() => {
    const expensesOfMonth = curMonthTrans.filter((t) => t.type === 'expense');
    const group: Record<string, { name: string; value: number; color: string }> = {};

    expensesOfMonth.forEach((t) => {
      const catName = t.categoryName || 'Outras Despesas';
      const catObj = categories.find((c) => c.id === t.categoryId);
      const color = catObj?.color || '#94a3b8';

      if (!group[catName]) {
        group[catName] = { name: catName, value: 0, color };
      }
      group[catName].value += t.amount;
    });

    return Object.values(group)
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [curMonthTrans, categories]);

  // CRM Funnel by Stage
  const pipelineFunnelData = useMemo(() => {
    const stages = [
      { id: 'novo', name: 'Novo Contato', color: '#64748b' },
      { id: 'negociacao', name: 'Em Negociação', color: '#3b82f6' },
      { id: 'proposta', name: 'Proposta Enviada', color: '#f59e0b' },
      { id: 'ganho', name: 'Fechado/Ganho', color: '#10b981' },
      { id: 'perdido', name: 'Perdido', color: '#ef4444' },
    ];

    return stages.map((s) => {
      const stageDeals = deals.filter((d) => d.stageId === s.id);
      const total = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
      return {
        etapa: s.name,
        quantidade: stageDeals.length,
        valor: total,
        color: s.color,
      };
    });
  }, [deals]);

  // Upcoming dues (next 7 days)
  const upcomingTransactions = useMemo(() => {
    const todayStr = format(now, 'yyyy-MM-dd');
    const maxDateStr = format(addDays(now, 7), 'yyyy-MM-dd');

    return transactions
      .filter(
        (t) =>
          t.status === 'pending' &&
          t.dueDate >= todayStr &&
          t.dueDate <= maxDateStr
      )
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 6);
  }, [transactions, now]);

  // Recent transactions (last 6)
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date))
      .slice(0, 6);
  }, [transactions]);

  const PIE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#8b5cf6', '#3b82f6', '#06b6d4', '#64748b'];

  return (
    <div className="space-y-6">
      {/* 8 Essential Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Entradas */}
        <StatCard
          title="Entradas do Mês"
          value={formatCurrency(curIncomes)}
          icon={<ArrowUpRight className="w-5 h-5 text-emerald-600" />}
          trend={{ value: incomeTrend, isPositiveGood: true }}
          highlight="green"
        />

        {/* Saídas */}
        <StatCard
          title="Saídas do Mês"
          value={formatCurrency(curExpenses)}
          icon={<ArrowDownRight className="w-5 h-5 text-rose-600" />}
          trend={{ value: expenseTrend, isPositiveGood: false }}
          highlight="none"
        />

        {/* Lucro */}
        <StatCard
          title="Lucro do Mês"
          value={formatCurrency(curProfit)}
          icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
          trend={{ value: profitTrend, isPositiveGood: true }}
          highlight={curProfit >= 0 ? 'blue' : 'red'}
        />

        {/* Saldo Atual */}
        <StatCard
          title="Saldo Atual em Contas"
          value={formatCurrency(totalBalance)}
          subtitle={`${accounts.length} contas cadastradas`}
          icon={<Wallet className="w-5 h-5 text-indigo-600" />}
          highlight="none"
          onClick={() => onNavigateTo('financial')}
        />

        {/* A Receber */}
        <StatCard
          title="Contas a Receber"
          value={formatCurrency(pendingReceivables)}
          subtitle="Previsão a entrar"
          icon={<DollarSign className="w-5 h-5 text-emerald-500" />}
          highlight="none"
          onClick={() => onNavigateTo('financial')}
        />

        {/* A Pagar */}
        <StatCard
          title="Contas a Pagar"
          value={formatCurrency(pendingPayables)}
          subtitle="Compromissos pendentes"
          icon={<Calendar className="w-5 h-5 text-amber-500" />}
          highlight="none"
          onClick={() => onNavigateTo('financial')}
        />

        {/* Contas Vencidas - Red Highlight */}
        <StatCard
          title="Contas Vencidas"
          value={formatCurrency(overdueTotal)}
          subtitle={`${overdueTransactions.length} títulos pendentes`}
          icon={<AlertCircle className="w-5 h-5 text-rose-600 animate-pulse" />}
          highlight="red"
          onClick={() => onNavigateTo('financial')}
        />

        {/* Negócios em Aberto (CRM) */}
        <StatCard
          title="Pipeline Funil de Vendas"
          value={formatCurrency(openDealsTotal)}
          subtitle={`${openDeals.length} negócios em negociação`}
          icon={<Briefcase className="w-5 h-5 text-purple-600" />}
          highlight="none"
          onClick={() => onNavigateTo('crm')}
        />
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entradas x Saídas (12 Meses) + Lucro */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-600" />
                Histórico Financeiro (Últimos 12 Meses)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Comparativo mensal de receitas realizadas, despesas pagas e lucro líquido
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg">
              Regime de Caixa
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value)), '']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line
                  type="monotone"
                  dataKey="Lucro"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#3b82f6' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Despesas por Categoria (Mês Atual) */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-purple-600" />
              Despesas por Categoria
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Distribuição de gastos do mês corrente
            </p>
          </div>

          <div className="flex-1 min-h-[200px] flex items-center justify-center">
            {categoryPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryPieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => formatCurrency(Number(val))}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400 text-center">Nenhuma despesa registrada este mês.</p>
            )}
          </div>

          {/* Category breakdown legend */}
          <div className="mt-3 space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {categoryPieData.slice(0, 5).map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="truncate text-slate-600 dark:text-slate-300">
                    {cat.name}
                  </span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono shrink-0 ml-2">
                  {formatCurrency(cat.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CRM Funnel & Lists Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funil do Kanban por Etapa */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-amber-500" />
                Funil de Vendas por Etapa
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Volume e valor total em cada fase
              </p>
            </div>
            <button
              onClick={() => onNavigateTo('crm')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Abrir Kanban &rarr;
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={pipelineFunnelData}
                margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.4} />
                <XAxis
                  type="number"
                  tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                  stroke="#94a3b8"
                  fontSize={11}
                />
                <YAxis dataKey="etapa" type="category" stroke="#94a3b8" fontSize={11} width={95} />
                <Tooltip
                  formatter={(value: any, name: any, item: any) => [
                    `${formatCurrency(Number(value))} (${item.payload.quantidade} negócios)`,
                    'Valor',
                  ]}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="valor" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  {pipelineFunnelData.map((entry, index) => (
                    <Cell key={`funnel-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Próximos Vencimentos (7 dias) */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Próximos Vencimentos (7 Dias)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Contas a pagar e receber a vencer
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto">
            {upcomingTransactions.length > 0 ? (
              upcomingTransactions.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {t.description}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <span>Vencimento: {formatDate(t.dueDate)}</span>
                      {t.entityName && <span>• {t.entityName}</span>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`font-bold font-mono ${
                        t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {t.type === 'income' ? 'A Receber' : 'A Pagar'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-8 text-center">
                Nenhum título com vencimento nos próximos 7 dias.
              </p>
            )}
          </div>
        </div>

        {/* Últimas Movimentações */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Últimas Movimentações
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Registros mais recentes no sistema
              </p>
            </div>
            <button
              onClick={() => onNavigateTo('financial')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Ver todas &rarr;
            </button>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto">
            {recentTransactions.map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {t.description}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-slate-400">
                      {formatDate(t.date || t.dueDate)}
                    </span>
                    <Badge
                      variant={
                        t.status === 'paid'
                          ? 'success'
                          : t.status === 'overdue'
                          ? 'danger'
                          : 'warning'
                      }
                      size="sm"
                    >
                      {t.status === 'paid'
                        ? 'Pago'
                        : t.status === 'overdue'
                        ? 'Vencido'
                        : 'Pendente'}
                    </Badge>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p
                    className={`font-bold font-mono ${
                      t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate max-w-[90px]">
                    {t.accountName || 'Caixa'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
