import React, { useMemo } from 'react';
import {
  TrendingUp,
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
  PackageX,
  ListTodo,
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
import { format, subMonths, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  Transaction,
  Deal,
  Account,
  DatePeriodFilter,
  DateRange,
  Category,
  KanbanColumn,
  Task,
  Product,
} from '../../../types';
import { StatCard } from '../../common/StatCard';
import { formatCurrency, formatCurrencyCompact, formatDate } from '../../../utils/formatters';
import { cashDate, getPreviousRange, inRange, periodLabel } from '../../../utils/period';
import { Badge } from '../../common/Badge';

interface DashboardViewProps {
  transactions: Transaction[];
  deals: Deal[];
  accounts: Account[];
  categories: Category[];
  stages: KanbanColumn[];
  tasks: Task[];
  products: Product[];
  period: DatePeriodFilter;
  range: DateRange;
  onNavigateTo: (module: any) => void;
}

const sum = (items: Transaction[]) => items.reduce((s, t) => s + (t.amount || 0), 0);
const pct = (cur: number, prev: number) => (prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : 0);

export function DashboardView({
  transactions,
  deals,
  accounts,
  categories,
  stages,
  tasks,
  products,
  period,
  range,
  onNavigateTo,
}: DashboardViewProps) {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const prevRange = useMemo(() => getPreviousRange(period, range), [period, range]);
  const label = periodLabel(period, range);

  // Regime de caixa: o que foi efetivamente pago/recebido no período
  const paidIn = (r: DateRange) => transactions.filter((t) => t.status === 'paid' && inRange(cashDate(t), r));
  const periodPaid = useMemo(() => paidIn(range), [transactions, range]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevPaid = useMemo(() => paidIn(prevRange), [transactions, prevRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const curIncomes = sum(periodPaid.filter((t) => t.type === 'income'));
  const curExpenses = sum(periodPaid.filter((t) => t.type === 'expense'));
  const prevIncomes = sum(prevPaid.filter((t) => t.type === 'income'));
  const prevExpenses = sum(prevPaid.filter((t) => t.type === 'expense'));
  const curProfit = curIncomes - curExpenses;
  const prevProfit = prevIncomes - prevExpenses;

  const totalBalance = accounts.reduce((acc, a) => acc + (a.currentBalance || 0), 0);
  const pendingReceivables = sum(transactions.filter((t) => t.type === 'income' && t.status !== 'paid'));
  const pendingPayables = sum(transactions.filter((t) => t.type === 'expense' && t.status !== 'paid'));
  const overdueTransactions = transactions.filter((t) => t.status === 'overdue');
  const overdueIn = sum(overdueTransactions.filter((t) => t.type === 'income'));
  const overdueOut = sum(overdueTransactions.filter((t) => t.type === 'expense'));

  const wonIds = new Set(stages.filter((s) => s.isWon).map((s) => s.id));
  const lostIds = new Set(stages.filter((s) => s.isLost).map((s) => s.id));
  const openDeals = deals.filter((d) => !wonIds.has(d.stageId) && !lostIds.has(d.stageId));
  const openDealsTotal = openDeals.reduce((s, d) => s + (d.value || 0), 0);

  const overdueTasks = tasks.filter((t) => t.status === 'pending' && t.dueDate < todayStr).length;
  const todayTasks = tasks.filter((t) => t.status === 'pending' && t.dueDate === todayStr).length;
  const lowStock = products.filter((p) => p.type === 'product' && p.stockQuantity <= (p.minStockQuantity || 0)).length;

  // 12 meses: entradas x saídas pagas + lucro
  const monthlyChartData = useMemo(() => {
    const data = [];
    for (let i = 11; i >= 0; i--) {
      const m = subMonths(now, i);
      const key = format(m, 'yyyy-MM');
      const items = transactions.filter((t) => t.status === 'paid' && cashDate(t).startsWith(key));
      const inc = sum(items.filter((t) => t.type === 'income'));
      const exp = sum(items.filter((t) => t.type === 'expense'));
      data.push({ month: format(m, 'MMM/yy', { locale: ptBR }), Entradas: inc, Saídas: exp, Lucro: inc - exp });
    }
    return data;
  }, [transactions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Despesas do período por categoria
  const categoryPieData = useMemo(() => {
    const group: Record<string, { name: string; value: number; color: string }> = {};
    periodPaid
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const cat = categories.find((c) => c.id === t.categoryId);
        const name = cat?.name || t.categoryName || 'Outras Despesas';
        if (!group[name]) group[name] = { name, value: 0, color: cat?.color || '#94a3b8' };
        group[name].value += t.amount;
      });
    return Object.values(group).sort((a, b) => b.value - a.value);
  }, [periodPaid, categories]);

  const pipelineFunnelData = useMemo(
    () =>
      stages.map((s) => {
        const stageDeals = deals.filter((d) => d.stageId === s.id);
        return {
          etapa: s.title,
          quantidade: stageDeals.length,
          valor: stageDeals.reduce((acc, d) => acc + (d.value || 0), 0),
          color: s.color,
        };
      }),
    [deals, stages]
  );

  // Vencidos + próximos 7 dias
  const upcomingTransactions = useMemo(() => {
    const max = format(addDays(now, 7), 'yyyy-MM-dd');
    return transactions
      .filter((t) => t.status !== 'paid' && t.dueDate <= max)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 8);
  }, [transactions]); // eslint-disable-line react-hooks/exhaustive-deps

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 6),
    [transactions]
  );

  const periodShort = period === 'month' ? 'do Mês' : period === 'today' ? 'de Hoje' : period === 'week' ? 'da Semana' : period === 'year' ? 'do Ano' : 'do Período';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Período: <strong className="text-slate-700 dark:text-slate-200">{label}</strong> · valores pagos/recebidos (regime de caixa)
        </p>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {overdueTasks > 0 && (
            <button onClick={() => onNavigateTo('tasks')} className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-1">
              <ListTodo className="w-3.5 h-3.5" /> {overdueTasks} tarefa(s) atrasada(s)
            </button>
          )}
          {todayTasks > 0 && (
            <button onClick={() => onNavigateTo('tasks')} className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold flex items-center gap-1">
              <ListTodo className="w-3.5 h-3.5" /> {todayTasks} tarefa(s) para hoje
            </button>
          )}
          {lowStock > 0 && (
            <button onClick={() => onNavigateTo('products')} className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1">
              <PackageX className="w-3.5 h-3.5" /> {lowStock} produto(s) com estoque baixo
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Entradas */}
        <StatCard
          title={`Entradas ${periodShort}`}
          value={formatCurrency(curIncomes)}
          icon={<ArrowUpRight className="w-5 h-5 text-emerald-600" />}
          trend={{ value: pct(curIncomes, prevIncomes), isPositiveGood: true, label: 'vs período anterior' }}
          highlight="green"
        />

        {/* Saídas */}
        <StatCard
          title={`Saídas ${periodShort}`}
          value={formatCurrency(curExpenses)}
          icon={<ArrowDownRight className="w-5 h-5 text-rose-600" />}
          trend={{ value: pct(curExpenses, prevExpenses), isPositiveGood: false, label: 'vs período anterior' }}
          highlight="none"
        />

        {/* Lucro */}
        <StatCard
          title={`Lucro ${periodShort}`}
          value={formatCurrency(curProfit)}
          icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
          trend={{ value: pct(curProfit, prevProfit), isPositiveGood: true, label: 'vs período anterior' }}
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
          value={formatCurrency(overdueIn + overdueOut)}
          subtitle={`${overdueTransactions.length} título(s) · receber ${formatCurrency(overdueIn)} · pagar ${formatCurrency(overdueOut)}`}
          icon={<AlertCircle className="w-5 h-5 text-rose-600 animate-pulse" />}
          highlight={overdueTransactions.length ? 'red' : 'none'}
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
              <ComposedChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  width={56}
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => formatCurrencyCompact(Number(val))}
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
              Distribuição dos gastos pagos no período
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
                        fill={entry.color || '#94a3b8'}
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
              <p className="text-xs text-slate-400 text-center">Nenhuma despesa paga no período.</p>
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
                  tickFormatter={(val) => formatCurrencyCompact(Number(val))}
                  stroke="#94a3b8"
                  fontSize={11}
                />
                <YAxis dataKey="etapa" type="category" stroke="#94a3b8" fontSize={11} width={105} />
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
                Vencidos e Próximos 7 Dias
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Contas a pagar e a receber em aberto
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
                      <span className={t.status === 'overdue' ? 'text-rose-600 font-semibold' : ''}>
                        {t.status === 'overdue' ? 'Venceu' : 'Vence'} {formatDate(t.dueDate)}
                      </span>
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
                Nada vencido nem vencendo nos próximos 7 dias. 👍
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
            {recentTransactions.length === 0 && (
              <p className="text-xs text-slate-400 py-8 text-center">Nenhum lançamento ainda.</p>
            )}
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
                    {accounts.find((a) => a.id === t.accountId)?.name || t.accountName || '-'}
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
