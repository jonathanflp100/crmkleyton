import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  FileText,
  Printer,
  Download,
  Layers,
  Users,
  Package,
  AlertTriangle,
  Truck,
  ShoppingBag,
  KanbanSquare,
  CalendarRange,
} from 'lucide-react';
import { eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth, subMonths, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  Account,
  Category,
  Client,
  CompanyProfile,
  DatePeriodFilter,
  DateRange,
  Deal,
  KanbanColumn,
  Product,
  Proposal,
  Supplier,
  Transaction,
  Transfer,
} from '../../../types';
import { formatCurrency, formatDate, paymentMethodLabel } from '../../../utils/formatters';
import { PERIOD_OPTIONS, cashDate, getPeriodRange, inRange, periodLabel, todayStr } from '../../../utils/period';
import { ExportService } from '../../../services/exportService';
import { PrintHeader, PrintService } from '../../../services/printService';
import { TransactionsTable } from '../../../services/printDocuments';
import { cardCls, inputSmCls } from '../../common/ui';

interface ReportsViewProps {
  transactions: Transaction[];
  clients: Client[];
  suppliers: Supplier[];
  products: Product[];
  proposals: Proposal[];
  deals: Deal[];
  stages: KanbanColumn[];
  accounts: Account[];
  transfers: Transfer[];
  categories: Category[];
  company?: CompanyProfile | null;
  globalPeriod: DatePeriodFilter;
  globalRange: DateRange;
}

type ReportType =
  | 'summary'
  | 'dre'
  | 'cashflow'
  | 'open'
  | 'sales_by_client'
  | 'sales_by_product'
  | 'expenses_by_supplier'
  | 'funnel'
  | 'stock';

const REPORTS: { id: ReportType; title: string; desc: string; icon: React.ElementType; usesPeriod: boolean }[] = [
  { id: 'summary', title: 'Resumo do período', desc: 'Entradas, saídas, lucro e todas as movimentações (semanal / mensal)', icon: CalendarRange, usesPeriod: true },
  { id: 'dre', title: 'DRE simplificado', desc: 'Receitas e despesas por categoria, lucro e margem', icon: FileText, usesPeriod: true },
  { id: 'cashflow', title: 'Fluxo de caixa', desc: 'Dia a dia com saldo acumulado', icon: Layers, usesPeriod: true },
  { id: 'open', title: 'Contas a pagar e receber', desc: 'Em aberto, vencidas e inadimplência', icon: AlertTriangle, usesPeriod: false },
  { id: 'sales_by_client', title: 'Vendas por cliente', desc: 'Quanto cada cliente pagou no período', icon: Users, usesPeriod: true },
  { id: 'sales_by_product', title: 'Vendas por produto', desc: 'Itens vendidos (orçamentos aprovados)', icon: ShoppingBag, usesPeriod: true },
  { id: 'expenses_by_supplier', title: 'Gastos por fornecedor', desc: 'Quanto foi pago a cada fornecedor', icon: Truck, usesPeriod: true },
  { id: 'funnel', title: 'Funil de vendas (CRM)', desc: 'Conversão, valores por etapa e motivos de perda', icon: KanbanSquare, usesPeriod: false },
  { id: 'stock', title: 'Estoque', desc: 'Posição, valor em estoque e itens críticos', icon: Package, usesPeriod: false },
];

const sum = (l: { amount: number }[]) => l.reduce((s, t) => s + (t.amount || 0), 0);
const pctOf = (v: number, total: number) => (total > 0 ? `${((v / total) * 100).toFixed(1).replace('.', ',')}%` : '-');

/* Tabela simples usada na tela e na impressão */
function Table({ head, rows, foot, align }: { head: string[]; rows: React.ReactNode[][]; foot?: React.ReactNode[]; align?: ('l' | 'r')[] }) {
  const a = (i: number) => (align?.[i] === 'r' ? 'num text-right' : '');
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] tracking-wider">
            {head.map((h, i) => (
              <th key={h} className={`py-2 px-3 text-left font-semibold ${a(i)}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.length === 0 && (
            <tr>
              <td colSpan={head.length} className="py-6 text-center text-slate-400">
                Sem dados para mostrar.
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={`py-2 px-3 text-slate-700 dark:text-slate-300 ${a(j)}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot>
            <tr className="font-bold border-t-2 border-slate-300 dark:border-slate-600">
              {foot.map((c, j) => (
                <td key={j} className={`py-2 px-3 text-slate-900 dark:text-white ${a(j)}`}>
                  {c}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function Kpis({ items }: { items: { label: string; value: string; tone?: 'green' | 'red' | 'blue' }[] }) {
  const tone = { green: 'text-emerald-600', red: 'text-rose-600', blue: 'text-blue-600' };
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))`, gap: 10 }}>
      {items.map((k) => (
        <div key={k.label} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700" style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px' }}>
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{k.label}</p>
          <p className={`text-base font-extrabold font-mono mt-0.5 ${k.tone ? tone[k.tone] : 'text-slate-900 dark:text-white'}`}>{k.value}</p>
        </div>
      ))}
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mt-6 mb-2" style={{ marginTop: 18, marginBottom: 6 }}>{children}</h4>;
}

export function ReportsView(props: ReportsViewProps) {
  const { transactions, clients, suppliers, products, proposals, deals, stages, accounts, categories, company } = props;
  const [selected, setSelected] = useState<ReportType>('summary');
  const [period, setPeriod] = useState<DatePeriodFilter>(props.globalPeriod);
  const [custom, setCustom] = useState<DateRange>(props.globalRange);
  const range = useMemo(() => getPeriodRange(period, custom), [period, custom]);
  const label = periodLabel(period, range);
  const report = REPORTS.find((r) => r.id === selected)!;

  const paidInRange = useMemo(() => transactions.filter((t) => t.status === 'paid' && inRange(cashDate(t), range)), [transactions, range]);
  const incomes = paidInRange.filter((t) => t.type === 'income');
  const expenses = paidInRange.filter((t) => t.type === 'expense');
  const totalIn = sum(incomes);
  const totalOut = sum(expenses);

  const byCategory = (list: Transaction[]) => {
    const map: Record<string, { name: string; total: number; count: number }> = {};
    list.forEach((t) => {
      const name = categories.find((c) => c.id === t.categoryId)?.name || t.categoryName || 'Sem categoria';
      (map[name] ||= { name, total: 0, count: 0 }).total += t.amount;
      map[name].count++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  };

  const byEntity = (list: Transaction[], fallback: string) => {
    const map: Record<string, { name: string; total: number; count: number; last: string }> = {};
    list.forEach((t) => {
      const name = t.entityName || fallback;
      const e = (map[name] ||= { name, total: 0, count: 0, last: '' });
      e.total += t.amount;
      e.count++;
      if (cashDate(t) > e.last) e.last = cashDate(t);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  };

  /* ------------ dados de cada relatório ------------ */
  const data = useMemo(() => {
    const today = todayStr();
    const opening = (() => {
      const initial = accounts.reduce((s, a) => s + (a.initialBalance || 0), 0);
      return initial + transactions.filter((t) => t.status === 'paid' && cashDate(t) < range.start).reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
    })();

    // fluxo de caixa diário
    const end = range.end > today ? today : range.end;
    let running = opening;
    const days =
      end >= range.start
        ? eachDayOfInterval({ start: parseISO(range.start), end: parseISO(end) }).map((d) => {
            const key = format(d, 'yyyy-MM-dd');
            const items = paidInRange.filter((t) => cashDate(t) === key);
            const i = sum(items.filter((t) => t.type === 'income'));
            const o = sum(items.filter((t) => t.type === 'expense'));
            running += i - o;
            return { key, i, o, balance: running, count: items.length };
          })
        : [];

    // em aberto
    const open = transactions.filter((t) => t.status !== 'paid').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const aging = (list: Transaction[]) => {
      const b = { aVencer: 0, d30: 0, d60: 0, d90: 0, mais: 0 };
      list.forEach((t) => {
        const late = differenceInCalendarDays(parseISO(today), parseISO(t.dueDate));
        if (late <= 0) b.aVencer += t.amount;
        else if (late <= 30) b.d30 += t.amount;
        else if (late <= 60) b.d60 += t.amount;
        else if (late <= 90) b.d90 += t.amount;
        else b.mais += t.amount;
      });
      return b;
    };

    // vendas por produto (orçamentos aprovados no período)
    const sold: Record<string, { name: string; qty: number; total: number; cost: number }> = {};
    proposals
      .filter((p) => p.status === 'approved' && inRange(p.saleDate || p.date, range))
      .forEach((p) =>
        p.items.forEach((it) => {
          const key = it.productId || it.productName;
          const prod = products.find((x) => x.id === it.productId);
          const e = (sold[key] ||= { name: it.productName || prod?.name || 'Item', qty: 0, total: 0, cost: 0 });
          e.qty += it.quantity;
          e.total += it.totalPrice;
          e.cost += (it.costPrice ?? prod?.costPrice ?? 0) * it.quantity;
        })
      );

    // funil
    const wonIds = new Set(stages.filter((s) => s.isWon).map((s) => s.id));
    const lostIds = new Set(stages.filter((s) => s.isLost).map((s) => s.id));
    const won = deals.filter((d) => wonIds.has(d.stageId));
    const lost = deals.filter((d) => lostIds.has(d.stageId));
    const reasons: Record<string, number> = {};
    lost.forEach((d) => (reasons[d.lossReason || 'Não informado'] = (reasons[d.lossReason || 'Não informado'] || 0) + 1));

    return {
      opening,
      days,
      open,
      receivables: open.filter((t) => t.type === 'income'),
      payables: open.filter((t) => t.type === 'expense'),
      aging,
      sold: Object.values(sold).sort((a, b) => b.total - a.total),
      won,
      lost,
      reasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]),
    };
  }, [transactions, accounts, paidInRange, range, proposals, products, deals, stages]);

  /* ------------ conteúdo (tela + impressão) ------------ */
  const renderBody = (): React.ReactElement => {
    switch (selected) {
      case 'summary': {
        const pendingIn = transactions.filter((t) => t.type === 'income' && t.status !== 'paid' && inRange(t.dueDate, range));
        const pendingOut = transactions.filter((t) => t.type === 'expense' && t.status !== 'paid' && inRange(t.dueDate, range));
        const sorted = [...paidInRange].sort((a, b) => cashDate(a).localeCompare(cashDate(b)));
        return (
          <div>
            <Kpis
              items={[
                { label: 'Entradas recebidas', value: formatCurrency(totalIn), tone: 'green' },
                { label: 'Saídas pagas', value: formatCurrency(totalOut), tone: 'red' },
                { label: 'Lucro do período', value: formatCurrency(totalIn - totalOut), tone: totalIn - totalOut >= 0 ? 'blue' : 'red' },
                { label: 'Margem', value: pctOf(totalIn - totalOut, totalIn) },
              ]}
            />
            <div style={{ height: 10 }} />
            <Kpis
              items={[
                { label: 'A receber (vence no período)', value: formatCurrency(sum(pendingIn)) },
                { label: 'A pagar (vence no período)', value: formatCurrency(sum(pendingOut)) },
                { label: 'Saldo no início', value: formatCurrency(data.opening) },
                { label: 'Saldo no fim', value: formatCurrency(data.opening + totalIn - totalOut) },
              ]}
            />
            <H>Despesas por categoria</H>
            <Table
              head={['Categoria', 'Lançamentos', 'Total', '% das saídas']}
              align={['l', 'r', 'r', 'r']}
              rows={byCategory(expenses).map((c) => [c.name, c.count, formatCurrency(c.total), pctOf(c.total, totalOut)])}
              foot={['Total', expenses.length, formatCurrency(totalOut), '']}
            />
            <H>Movimentações pagas / recebidas ({sorted.length})</H>
            <TransactionsTable items={sorted} />
          </div>
        );
      }
      case 'dre': {
        const rec = byCategory(incomes);
        const desp = byCategory(expenses);
        const lucro = totalIn - totalOut;
        return (
          <div>
            <Table
              head={['Descrição', 'Valor', '% da receita']}
              align={['l', 'r', 'r']}
              rows={[
                [<strong>(=) RECEITA BRUTA</strong>, <strong>{formatCurrency(totalIn)}</strong>, '100%'],
                ...rec.map((c) => [`   (+) ${c.name}`, formatCurrency(c.total), pctOf(c.total, totalIn)]),
                [<strong>(−) DESPESAS</strong>, <strong>{formatCurrency(totalOut)}</strong>, pctOf(totalOut, totalIn)],
                ...desp.map((c) => [`   (−) ${c.name}`, formatCurrency(c.total), pctOf(c.total, totalIn)]),
              ]}
              foot={['(=) LUCRO LÍQUIDO', <span style={{ color: lucro >= 0 ? '#059669' : '#e11d48' }}>{formatCurrency(lucro)}</span>, pctOf(lucro, totalIn)]}
            />
            <p className="text-[11px] text-slate-400 mt-2">Regime de caixa: considera o que foi efetivamente recebido e pago no período.</p>
          </div>
        );
      }
      case 'cashflow': {
        const rows = data.days.filter((d) => d.count > 0);
        return (
          <div>
            <Kpis
              items={[
                { label: 'Saldo inicial', value: formatCurrency(data.opening) },
                { label: 'Entradas', value: formatCurrency(totalIn), tone: 'green' },
                { label: 'Saídas', value: formatCurrency(totalOut), tone: 'red' },
                { label: 'Saldo final', value: formatCurrency(data.opening + totalIn - totalOut), tone: 'blue' },
              ]}
            />
            <H>Dia a dia</H>
            <Table
              head={['Data', 'Entradas', 'Saídas', 'Resultado', 'Saldo acumulado']}
              align={['l', 'r', 'r', 'r', 'r']}
              rows={rows.map((d) => [formatDate(d.key, 'dd/MM/yyyy (EEE)'), formatCurrency(d.i), formatCurrency(d.o), formatCurrency(d.i - d.o), formatCurrency(d.balance)])}
              foot={['Total', formatCurrency(totalIn), formatCurrency(totalOut), formatCurrency(totalIn - totalOut), formatCurrency(data.opening + totalIn - totalOut)]}
            />
          </div>
        );
      }
      case 'open': {
        const ar = data.aging(data.receivables);
        const ap = data.aging(data.payables);
        const row = (n: string, b: ReturnType<typeof data.aging>) => [n, formatCurrency(b.aVencer), formatCurrency(b.d30), formatCurrency(b.d60), formatCurrency(b.d90), formatCurrency(b.mais), formatCurrency(b.aVencer + b.d30 + b.d60 + b.d90 + b.mais)];
        const overdueIn = data.receivables.filter((t) => t.status === 'overdue');
        const openRows = (list: Transaction[]) =>
          list.map((t) => [
            <span style={{ color: t.status === 'overdue' ? '#e11d48' : undefined, fontWeight: t.status === 'overdue' ? 700 : 400 }}>{formatDate(t.dueDate)}</span>,
            t.description,
            t.entityName || '-',
            t.status === 'overdue' ? `${differenceInCalendarDays(new Date(), parseISO(t.dueDate))} dias` : 'a vencer',
            formatCurrency(t.amount),
          ]);
        return (
          <div>
            <Kpis
              items={[
                { label: 'Total a receber', value: formatCurrency(sum(data.receivables)), tone: 'green' },
                { label: 'Recebíveis vencidos', value: formatCurrency(sum(overdueIn)), tone: 'red' },
                { label: 'Total a pagar', value: formatCurrency(sum(data.payables)), tone: 'red' },
                { label: 'Inadimplência', value: pctOf(sum(overdueIn), sum(data.receivables)) },
              ]}
            />
            <H>Por tempo de atraso</H>
            <Table head={['', 'A vencer', '1–30 dias', '31–60', '61–90', '+90', 'Total']} align={['l', 'r', 'r', 'r', 'r', 'r', 'r']} rows={[row('A receber', ar), row('A pagar', ap)]} />
            <H>Contas a receber ({data.receivables.length})</H>
            <Table head={['Vencimento', 'Descrição', 'Cliente', 'Atraso', 'Valor']} align={['l', 'l', 'l', 'l', 'r']} rows={openRows(data.receivables)} foot={['', '', '', 'Total', formatCurrency(sum(data.receivables))]} />
            <H>Contas a pagar ({data.payables.length})</H>
            <Table head={['Vencimento', 'Descrição', 'Fornecedor', 'Atraso', 'Valor']} align={['l', 'l', 'l', 'l', 'r']} rows={openRows(data.payables)} foot={['', '', '', 'Total', formatCurrency(sum(data.payables))]} />
          </div>
        );
      }
      case 'sales_by_client': {
        const list = byEntity(incomes.filter((t) => t.entityType === 'client' || t.entityName), 'Sem cliente vinculado');
        return (
          <Table
            head={['#', 'Cliente', 'Pagamentos', 'Último', 'Total', '% do total']}
            align={['l', 'l', 'r', 'l', 'r', 'r']}
            rows={list.map((c, i) => [i + 1, c.name, c.count, formatDate(c.last), formatCurrency(c.total), pctOf(c.total, totalIn)])}
            foot={['', 'Total', list.reduce((s, c) => s + c.count, 0), '', formatCurrency(sum(incomes)), '']}
          />
        );
      }
      case 'sales_by_product': {
        const total = data.sold.reduce((s, x) => s + x.total, 0);
        const cost = data.sold.reduce((s, x) => s + x.cost, 0);
        return (
          <div>
            <Kpis
              items={[
                { label: 'Faturado em vendas', value: formatCurrency(total), tone: 'green' },
                { label: 'Custo dos itens', value: formatCurrency(cost) },
                { label: 'Lucro bruto', value: formatCurrency(total - cost), tone: 'blue' },
                { label: 'Margem bruta', value: pctOf(total - cost, total) },
              ]}
            />
            <H>Itens vendidos</H>
            <Table
              head={['Produto / serviço', 'Qtd.', 'Faturado', 'Custo', 'Lucro', 'Margem']}
              align={['l', 'r', 'r', 'r', 'r', 'r']}
              rows={data.sold.map((x) => [x.name, x.qty, formatCurrency(x.total), formatCurrency(x.cost), formatCurrency(x.total - x.cost), pctOf(x.total - x.cost, x.total)])}
              foot={['Total', data.sold.reduce((s, x) => s + x.qty, 0), formatCurrency(total), formatCurrency(cost), formatCurrency(total - cost), pctOf(total - cost, total)]}
            />
            <p className="text-[11px] text-slate-400 mt-2">Baseado nos orçamentos aprovados como venda (botão "Aprovar & vender").</p>
          </div>
        );
      }
      case 'expenses_by_supplier': {
        const list = byEntity(expenses.filter((t) => t.entityType === 'supplier'), 'Sem fornecedor');
        const total = list.reduce((s, x) => s + x.total, 0);
        return (
          <div>
            <Table
              head={['#', 'Fornecedor', 'Pagamentos', 'Último', 'Total', '% das saídas']}
              align={['l', 'l', 'r', 'l', 'r', 'r']}
              rows={list.map((c, i) => [i + 1, c.name, c.count, formatDate(c.last), formatCurrency(c.total), pctOf(c.total, totalOut)])}
              foot={['', 'Total', list.reduce((s, c) => s + c.count, 0), '', formatCurrency(total), pctOf(total, totalOut)]}
            />
            <p className="text-[11px] text-slate-400 mt-2">Só aparecem as saídas vinculadas a um fornecedor.</p>
          </div>
        );
      }
      case 'funnel': {
        const totalDeals = deals.length;
        const closed = data.won.length + data.lost.length;
        return (
          <div>
            <Kpis
              items={[
                { label: 'Negócios', value: String(totalDeals) },
                { label: 'Ganhos', value: `${data.won.length} · ${formatCurrency(data.won.reduce((s, d) => s + d.value, 0))}`, tone: 'green' },
                { label: 'Perdidos', value: String(data.lost.length), tone: 'red' },
                { label: 'Taxa de conversão', value: pctOf(data.won.length, closed) },
              ]}
            />
            <H>Por etapa</H>
            <Table
              head={['Etapa', 'Negócios', 'Valor total', 'Ticket médio']}
              align={['l', 'r', 'r', 'r']}
              rows={stages.map((s) => {
                const l = deals.filter((d) => d.stageId === s.id);
                const v = l.reduce((a, d) => a + (d.value || 0), 0);
                return [s.title, l.length, formatCurrency(v), formatCurrency(l.length ? v / l.length : 0)];
              })}
            />
            <H>Motivos de perda</H>
            <Table head={['Motivo', 'Quantidade', '%']} align={['l', 'r', 'r']} rows={data.reasons.map(([r, n]) => [r, n, pctOf(n, data.lost.length)])} />
          </div>
        );
      }
      case 'stock': {
        const items = products.filter((p) => p.type === 'product');
        const value = items.reduce((s, p) => s + (p.costPrice || 0) * Math.max(0, p.stockQuantity || 0), 0);
        const saleValue = items.reduce((s, p) => s + (p.salePrice || 0) * Math.max(0, p.stockQuantity || 0), 0);
        const critical = items.filter((p) => p.stockQuantity <= (p.minStockQuantity || 0));
        return (
          <div>
            <Kpis
              items={[
                { label: 'Produtos', value: String(items.length) },
                { label: 'Valor em estoque (custo)', value: formatCurrency(value) },
                { label: 'Valor de venda', value: formatCurrency(saleValue), tone: 'green' },
                { label: 'Itens críticos', value: String(critical.length), tone: critical.length ? 'red' : undefined },
              ]}
            />
            <H>Posição de estoque</H>
            <Table
              head={['Código', 'Produto', 'Estoque', 'Mínimo', 'Custo', 'Venda', 'Situação']}
              align={['l', 'l', 'r', 'r', 'r', 'r', 'l']}
              rows={[...items]
                .sort((a, b) => a.stockQuantity - (a.minStockQuantity || 0) - (b.stockQuantity - (b.minStockQuantity || 0)))
                .map((p) => [p.code || '-', p.name, `${p.stockQuantity} ${p.unit || ''}`, p.minStockQuantity, formatCurrency(p.costPrice), formatCurrency(p.salePrice), p.stockQuantity <= (p.minStockQuantity || 0) ? <strong style={{ color: '#e11d48' }}>REPOR</strong> : 'OK'])}
            />
          </div>
        );
      }
    }
  };

  const handlePrint = () => {
    PrintService.print(
      report.title,
      <div>
        <PrintHeader company={company} title={report.title} subtitle={report.usesPeriod ? `Período: ${label}` : `Posição em ${formatDate(todayStr())}`} />
        {renderBody()}
      </div>
    );
  };

  const handleExport = () => {
    const stamp = format(new Date(), 'yyyyMMdd');
    const trxRows = (l: Transaction[]) =>
      l.map((t) => ({
        Data: formatDate(cashDate(t)),
        Vencimento: formatDate(t.dueDate),
        Descricao: t.description,
        Tipo: t.type === 'income' ? 'Entrada' : 'Saída',
        Valor_Gs: t.amount,
        Situacao: t.status === 'paid' ? 'Pago' : t.status === 'overdue' ? 'Vencido' : 'Pendente',
        Categoria: t.categoryName || '',
        Cliente_Fornecedor: t.entityName || '',
        Forma_Pagamento: paymentMethodLabel(t.paymentMethod),
      }));
    const rows: Record<ReportType, () => Record<string, any>[]> = {
      summary: () => trxRows([...paidInRange].sort((a, b) => cashDate(a).localeCompare(cashDate(b)))),
      dre: () => [
        { Descricao: 'RECEITA BRUTA', Valor_Gs: totalIn },
        ...byCategory(incomes).map((c) => ({ Descricao: `(+) ${c.name}`, Valor_Gs: c.total })),
        { Descricao: 'DESPESAS', Valor_Gs: -totalOut },
        ...byCategory(expenses).map((c) => ({ Descricao: `(-) ${c.name}`, Valor_Gs: -c.total })),
        { Descricao: 'LUCRO LÍQUIDO', Valor_Gs: totalIn - totalOut },
      ],
      cashflow: () => data.days.map((d) => ({ Data: formatDate(d.key), Entradas: d.i, Saidas: d.o, Resultado: d.i - d.o, Saldo: d.balance })),
      open: () => trxRows(data.open),
      sales_by_client: () => byEntity(incomes, 'Sem cliente').map((c) => ({ Cliente: c.name, Pagamentos: c.count, Total_Gs: c.total })),
      sales_by_product: () => data.sold.map((x) => ({ Item: x.name, Quantidade: x.qty, Faturado_Gs: x.total, Custo_Gs: x.cost, Lucro_Gs: x.total - x.cost })),
      expenses_by_supplier: () => byEntity(expenses.filter((t) => t.entityType === 'supplier'), 'Sem fornecedor').map((c) => ({ Fornecedor: c.name, Pagamentos: c.count, Total_Gs: c.total })),
      funnel: () => deals.map((d) => ({ Negocio: d.title, Cliente: d.clientName, Etapa: stages.find((s) => s.id === d.stageId)?.title || d.stageName, Valor_Gs: d.value, Responsavel: d.assignedToUserName || '', Motivo_Perda: d.lossReason || '' })),
      stock: () => products.map((p) => ({ Codigo: p.code || '', Item: p.name, Tipo: p.type === 'product' ? 'Produto' : 'Serviço', Estoque: p.stockQuantity, Minimo: p.minStockQuantity, Custo_Gs: p.costPrice, Venda_Gs: p.salePrice })),
    };
    ExportService.exportToCSV(`${report.title.replace(/\s+/g, '_')}_${stamp}`, rows[selected]());
  };

  const pickMonth = (value: string) => {
    if (!value) return;
    const d = parseISO(`${value}-01`);
    setCustom({ start: format(startOfMonth(d), 'yyyy-MM-dd'), end: format(endOfMonth(d), 'yyyy-MM-dd') });
    setPeriod('custom');
  };

  return (
    <div className="space-y-6">
      {/* Escolha do relatório */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {REPORTS.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelected(r.id)}
            className={`p-3 rounded-2xl border text-left transition-all ${
              selected === r.id
                ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300 text-slate-700 dark:text-slate-200'
            }`}
          >
            <r.icon className={`w-4 h-4 ${selected === r.id ? 'text-white' : 'text-blue-600'}`} />
            <p className="font-bold text-xs mt-1.5">{r.title}</p>
            <p className={`text-[10px] mt-0.5 leading-snug ${selected === r.id ? 'text-blue-100' : 'text-slate-400'}`}>{r.desc}</p>
          </button>
        ))}
      </div>

      {/* Barra de período e ações */}
      <div className={`${cardCls} p-4 flex flex-wrap items-center justify-between gap-3 text-xs`}>
        <div className="flex flex-wrap items-center gap-2">
          {report.usesPeriod ? (
            <>
              <span className="font-semibold text-slate-600 dark:text-slate-300">Período:</span>
              <select value={period} onChange={(e) => setPeriod(e.target.value as DatePeriodFilter)} className={inputSmCls}>
                {PERIOD_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <select value="" onChange={(e) => pickMonth(e.target.value)} className={inputSmCls} title="Escolher um mês">
                <option value="">Escolher mês…</option>
                {Array.from({ length: 13 }, (_, i) => subMonths(new Date(), i)).map((m) => (
                  <option key={format(m, 'yyyy-MM')} value={format(m, 'yyyy-MM')}>
                    {format(m, "MMMM 'de' yyyy", { locale: ptBR })}
                  </option>
                ))}
              </select>
              {period === 'custom' && (
                <>
                  <input type="date" value={custom.start} onChange={(e) => setCustom({ ...custom, start: e.target.value })} className={inputSmCls} />
                  <span className="text-slate-400">até</span>
                  <input type="date" value={custom.end} onChange={(e) => setCustom({ ...custom, end: e.target.value })} className={inputSmCls} />
                </>
              )}
              <span className="text-slate-400">{label}</span>
            </>
          ) : (
            <span className="text-slate-500">Posição atual — {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
            <Download className="w-4 h-4 text-emerald-600" />
            Excel (CSV)
          </button>
          <button onClick={handlePrint} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/20">
            <Printer className="w-4 h-4" />
            Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Relatório */}
      <div className={`${cardCls} p-5 sm:p-7`}>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{report.title}</h3>
            <p className="text-[11px] text-slate-400">{report.usesPeriod ? label : 'Posição atual'}</p>
          </div>
        </div>
        {renderBody()}
      </div>
    </div>
  );
}
