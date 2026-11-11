import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  FileText,
  Printer,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Layers,
  Users,
  Package,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building,
} from 'lucide-react';
import type {
  Transaction,
  Client,
  Product,
  Deal,
  CompanyProfile,
  Category,
  DatePeriodFilter,
} from '../../../types';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { ExportService } from '../../../services/exportService';
import { Badge } from '../../common/Badge';
import { format, subMonths, parseISO, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReportsViewProps {
  transactions: Transaction[];
  clients: Client[];
  products: Product[];
  deals: Deal[];
  categories: Category[];
  company?: CompanyProfile | null;
}

type ReportType =
  | 'dre'
  | 'cashflow'
  | 'payables_receivables'
  | 'sales_by_client'
  | 'sales_by_product'
  | 'funnel_performance'
  | 'stock';

export function ReportsView({
  transactions,
  clients,
  products,
  deals,
  categories,
  company,
}: ReportsViewProps) {
  const [selectedReport, setSelectedReport] = useState<ReportType>('dre');
  const [period, setPeriod] = useState<DatePeriodFilter>('month');
  const [customStart, setCustomStart] = useState(
    format(subMonths(new Date(), 1), 'yyyy-MM-dd')
  );
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  const now = new Date();
  const currentMonthKey = format(now, 'yyyy-MM');

  // Filter transactions according to selected period
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const d = t.paymentDate || t.date || t.dueDate;
      if (period === 'today') {
        return d === format(now, 'yyyy-MM-dd');
      }
      if (period === 'month') {
        return d.startsWith(currentMonthKey);
      }
      if (period === 'year') {
        return d.startsWith(format(now, 'yyyy'));
      }
      if (period === 'custom') {
        return d >= customStart && d <= customEnd;
      }
      return true;
    });
  }, [transactions, period, currentMonthKey, customStart, customEnd, now]);

  // DRE Simplificado
  const dreData = useMemo(() => {
    const paidIncomes = filteredTransactions.filter(
      (t) => t.type === 'income' && t.status === 'paid'
    );
    const paidExpenses = filteredTransactions.filter(
      (t) => t.type === 'expense' && t.status === 'paid'
    );

    const receitaBruta = paidIncomes.reduce((acc, t) => acc + t.amount, 0);
    const totalDespesas = paidExpenses.reduce((acc, t) => acc + t.amount, 0);
    const lucroLiquido = receitaBruta - totalDespesas;
    const margemLiquida =
      receitaBruta > 0 ? Math.round((lucroLiquido / receitaBruta) * 100 * 10) / 10 : 0;

    // Despesas agrupadas por categoria
    const despesasPorCategoria: Record<string, number> = {};
    paidExpenses.forEach((t) => {
      const cat = t.categoryName || 'Outras Despesas';
      despesasPorCategoria[cat] = (despesasPorCategoria[cat] || 0) + t.amount;
    });

    // Receitas agrupadas por categoria
    const receitasPorCategoria: Record<string, number> = {};
    paidIncomes.forEach((t) => {
      const cat = t.categoryName || 'Vendas / Serviços';
      receitasPorCategoria[cat] = (receitasPorCategoria[cat] || 0) + t.amount;
    });

    return {
      receitaBruta,
      totalDespesas,
      lucroLiquido,
      margemLiquida,
      despesasPorCategoria,
      receitasPorCategoria,
    };
  }, [filteredTransactions]);

  // Vendas por Cliente
  const salesByClient = useMemo(() => {
    const map: Record<string, { clientName: string; total: number; count: number }> = {};
    filteredTransactions
      .filter((t) => t.type === 'income' && t.entityType === 'client' && t.status === 'paid')
      .forEach((t) => {
        const name = t.entityName || 'Cliente Diversos';
        if (!map[name]) map[name] = { clientName: name, total: 0, count: 0 };
        map[name].total += t.amount;
        map[name].count += 1;
      });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredTransactions]);

  // Funnel Performance
  const funnelPerformance = useMemo(() => {
    const totalDeals = deals.length;
    const wonDeals = deals.filter((d) => d.stageId === 'ganho');
    const lostDeals = deals.filter((d) => d.stageId === 'perdido');
    const openDeals = deals.filter((d) => d.stageId !== 'ganho' && d.stageId !== 'perdido');

    const conversionRate =
      totalDeals > 0 ? Math.round((wonDeals.length / totalDeals) * 100 * 10) / 10 : 0;

    // Loss reasons breakdown
    const lossReasons: Record<string, number> = {};
    lostDeals.forEach((d) => {
      const reason = d.lossReason || 'Motivo não informado';
      lossReasons[reason] = (lossReasons[reason] || 0) + 1;
    });

    return {
      totalDeals,
      wonDealsCount: wonDeals.length,
      wonTotalValue: wonDeals.reduce((sum, d) => sum + (d.value || 0), 0),
      lostDealsCount: lostDeals.length,
      openDealsCount: openDeals.length,
      conversionRate,
      lossReasons,
    };
  }, [deals]);

  // Stock and low stock
  const lowStockItems = useMemo(() => {
    return products.filter(
      (p) => p.type === 'product' && p.stockQuantity <= (p.minStockQuantity || 0)
    );
  }, [products]);

  // Export current report to CSV
  const handleExportCSV = () => {
    const dateStamp = format(new Date(), 'yyyyMMdd');

    if (selectedReport === 'dre') {
      const rows = [
        { Descricao: 'RECEITA OPERACIONAL BRUTA', Valor: dreData.receitaBruta },
        ...Object.entries(dreData.receitasPorCategoria).map(([cat, val]) => ({
          Descricao: `  (+) ${cat}`,
          Valor: val,
        })),
        { Descricao: 'DESPESAS OPERACIONAIS', Valor: -dreData.totalDespesas },
        ...Object.entries(dreData.despesasPorCategoria).map(([cat, val]) => ({
          Descricao: `  (-) ${cat}`,
          Valor: -val,
        })),
        { Descricao: 'LUCRO LÍQUIDO DO PERÍODO', Valor: dreData.lucroLiquido },
        { Descricao: 'MARGEM LÍQUIDA (%)', Valor: `${dreData.margemLiquida}%` },
      ];
      ExportService.exportToCSV(`DRE_Demonstrativo_${dateStamp}`, rows);
    } else if (selectedReport === 'sales_by_client') {
      ExportService.exportToCSV(
        `Vendas_por_Cliente_${dateStamp}`,
        salesByClient.map((c) => ({
          Cliente: c.clientName,
          Total_Comprado: c.total,
          Numero_de_Transacoes: c.count,
        }))
      );
    } else if (selectedReport === 'stock') {
      ExportService.exportToCSV(
        `Posicao_Estoque_${dateStamp}`,
        products.map((p) => ({
          Codigo: p.code || '',
          Item: p.name,
          Tipo: p.type,
          Estoque_Atual: p.stockQuantity,
          Estoque_Minimo: p.minStockQuantity,
          Preco_Custo: p.costPrice,
          Preco_Venda: p.salePrice,
          Status: p.type === 'product' && p.stockQuantity <= (p.minStockQuantity || 0) ? 'CRITICO' : 'NORMAL',
        }))
      );
    } else {
      ExportService.exportToCSV(
        `Relatorio_${selectedReport}_${dateStamp}`,
        filteredTransactions.map((t) => ({
          Data: formatDate(t.date),
          Descricao: t.description,
          Tipo: t.type,
          Valor: t.amount,
          Status: t.status,
          Categoria: t.categoryName,
        }))
      );
    }
  };

  const reportNames: Record<ReportType, string> = {
    dre: 'DRE Simplificado (Demonstrativo do Resultado do Exercício)',
    cashflow: 'Demonstrativo de Fluxo de Caixa',
    payables_receivables: 'Contas a Pagar, Receber e Inadimplência',
    sales_by_client: 'Vendas por Cliente',
    sales_by_product: 'Vendas por Produto e Serviços',
    funnel_performance: 'Desempenho do Funil de Vendas (CRM)',
    stock: 'Posição de Estoque & Produtos Críticos',
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Reports Menu (Hidden in Print) */}
      <div className="no-print space-y-4">
        {/* Report Selector Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {(
            [
              { id: 'dre', label: 'DRE Simplificado' },
              { id: 'cashflow', label: 'Fluxo de Caixa' },
              { id: 'payables_receivables', label: 'Contas e Inadimplência' },
              { id: 'sales_by_client', label: 'Vendas por Cliente' },
              { id: 'funnel_performance', label: 'Funil e Conversão' },
              { id: 'stock', label: 'Estoque e Reposição' },
            ] as { id: ReportType; label: string }[]
          ).map((rep) => (
            <button
              key={rep.id}
              onClick={() => setSelectedReport(rep.id)}
              className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all shadow-xs ${
                selectedReport === rep.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              {rep.label}
            </button>
          ))}
        </div>

        {/* Period Selector & Print/Export Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-semibold text-slate-500">Período:</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <option value="month">Este Mês</option>
              <option value="today">Hoje</option>
              <option value="year">Este Ano</option>
              <option value="custom">Personalizado</option>
            </select>

            {period === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <span className="text-slate-400">até</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              Exportar CSV / Excel
            </button>

            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all"
            >
              <Printer className="w-4 h-4" />
              Imprimir Relatório (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* PRINT-READY CLEAN REPORT CONTAINER */}
      <div className="print-container bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 sm:p-8 space-y-6">
        {/* Header da Empresa para Impressão */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-5 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {company?.name || 'GESTOR PRO - GESTÃO EMPRESARIAL'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              CNPJ: {company?.document || '-'} • Tel: {company?.phone || '-'} • {company?.email || ''}
            </p>
            <p className="text-xs text-slate-400">
              {company?.street ? `${company.street}, ${company.number || ''} - ${company.city}/${company.state}` : ''}
            </p>
          </div>

          <div className="text-right text-xs text-slate-500">
            <p className="font-bold text-slate-800 dark:text-slate-200">
              Emissão: {format(new Date(), 'dd/MM/yyyy HH:mm')}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Período selecionado: {period === 'month' ? 'Mês Corrente' : period.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Report Title */}
        <div className="pb-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {reportNames[selectedReport]}
          </h3>
        </div>

        {/* REPORT 1: DRE SIMPLIFICADO */}
        {selectedReport === 'dre' && (
          <div className="space-y-6 text-xs">
            {/* DRE Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Receita Bruta</span>
                <p className="text-lg font-bold font-mono text-emerald-600 mt-1">
                  {formatCurrency(dreData.receitaBruta)}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Despesas</span>
                <p className="text-lg font-bold font-mono text-rose-600 mt-1">
                  {formatCurrency(dreData.totalDespesas)}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Lucro Líquido</span>
                <p
                  className={`text-lg font-bold font-mono mt-1 ${
                    dreData.lucroLiquido >= 0 ? 'text-blue-600' : 'text-rose-600'
                  }`}
                >
                  {formatCurrency(dreData.lucroLiquido)}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Margem Líquida</span>
                <p className="text-lg font-bold font-mono text-slate-800 dark:text-slate-100 mt-1">
                  {dreData.margemLiquida}%
                </p>
              </div>
            </div>

            {/* DRE Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-4">Conta Contábil / Descrição</th>
                    <th className="py-2.5 px-4 text-right">Valor (R$)</th>
                    <th className="py-2.5 px-4 text-right">% Receita</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {/* Receitas */}
                  <tr className="bg-emerald-50/40 dark:bg-emerald-950/20 font-bold">
                    <td className="py-2 px-4 text-emerald-800 dark:text-emerald-300">
                      1. RECEITA OPERACIONAL BRUTA
                    </td>
                    <td className="py-2 px-4 text-right text-emerald-700">
                      {formatCurrency(dreData.receitaBruta)}
                    </td>
                    <td className="py-2 px-4 text-right">100.0%</td>
                  </tr>
                  {Object.entries(dreData.receitasPorCategoria).map(([cat, val], idx) => (
                    <tr key={idx} className="text-slate-600 dark:text-slate-300">
                      <td className="py-1.5 px-6 font-sans">1.1. {cat}</td>
                      <td className="py-1.5 px-4 text-right">{formatCurrency(val)}</td>
                      <td className="py-1.5 px-4 text-right">
                        {dreData.receitaBruta > 0
                          ? ((val / dreData.receitaBruta) * 100).toFixed(1)
                          : '0.0'}
                        %
                      </td>
                    </tr>
                  ))}

                  {/* Despesas */}
                  <tr className="bg-rose-50/40 dark:bg-rose-950/20 font-bold">
                    <td className="py-2 px-4 text-rose-800 dark:text-rose-300">
                      2. DESPESAS OPERACIONAIS
                    </td>
                    <td className="py-2 px-4 text-right text-rose-700">
                      - {formatCurrency(dreData.totalDespesas)}
                    </td>
                    <td className="py-2 px-4 text-right">
                      {dreData.receitaBruta > 0
                        ? ((dreData.totalDespesas / dreData.receitaBruta) * 100).toFixed(1)
                        : '0.0'}
                      %
                    </td>
                  </tr>
                  {Object.entries(dreData.despesasPorCategoria).map(([cat, val], idx) => (
                    <tr key={idx} className="text-slate-600 dark:text-slate-300">
                      <td className="py-1.5 px-6 font-sans">2.1. {cat}</td>
                      <td className="py-1.5 px-4 text-right">- {formatCurrency(val)}</td>
                      <td className="py-1.5 px-4 text-right">
                        {dreData.receitaBruta > 0
                          ? ((val / dreData.receitaBruta) * 100).toFixed(1)
                          : '0.0'}
                        %
                      </td>
                    </tr>
                  ))}

                  {/* Lucro Líquido Final */}
                  <tr className="bg-slate-100 dark:bg-slate-800 font-extrabold text-sm">
                    <td className="py-3 px-4 text-slate-900 dark:text-white">
                      3. RESULTADO LÍQUIDO DO EXERCÍCIO
                    </td>
                    <td
                      className={`py-3 px-4 text-right ${
                        dreData.lucroLiquido >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {formatCurrency(dreData.lucroLiquido)}
                    </td>
                    <td className="py-3 px-4 text-right">{dreData.margemLiquida}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORT 2: VENDAS POR CLIENTE */}
        {selectedReport === 'sales_by_client' && (
          <div className="space-y-4 text-xs">
            <table className="w-full text-left border-collapse border border-slate-200 dark:border-slate-800 rounded-xl">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 font-bold border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2.5 px-4">Cliente</th>
                  <th className="py-2.5 px-4 text-center">Nº Transações</th>
                  <th className="py-2.5 px-4 text-right">Total Faturado (R$)</th>
                  <th className="py-2.5 px-4 text-right">Participação %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {salesByClient.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {c.clientName}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono">{c.count}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">
                      {formatCurrency(c.total)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono">
                      {dreData.receitaBruta > 0
                        ? ((c.total / dreData.receitaBruta) * 100).toFixed(1)
                        : '0'}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* REPORT 3: ESTOQUE E CRÍTICOS */}
        {selectedReport === 'stock' && (
          <div className="space-y-4 text-xs">
            <table className="w-full text-left border-collapse border border-slate-200 dark:border-slate-800 rounded-xl">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 font-bold border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2.5 px-4">Código</th>
                  <th className="py-2.5 px-4">Item</th>
                  <th className="py-2.5 px-4 text-center">Estoque Atual</th>
                  <th className="py-2.5 px-4 text-center">Estoque Mínimo</th>
                  <th className="py-2.5 px-4 text-right">Preço de Venda</th>
                  <th className="py-2.5 px-4 text-center">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {products.map((p) => {
                  const isCrit = p.type === 'product' && p.stockQuantity <= (p.minStockQuantity || 0);

                  return (
                    <tr key={p.id}>
                      <td className="py-2.5 px-4 font-mono text-slate-500">{p.code || '-'}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {p.name}
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold">
                        {p.type === 'product' ? `${p.stockQuantity} ${p.unit || 'un'}` : 'N/A'}
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono">
                        {p.type === 'product' ? p.minStockQuantity : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold">
                        {formatCurrency(p.salePrice)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {isCrit ? (
                          <Badge variant="danger" size="sm">
                            Reposição Urgente
                          </Badge>
                        ) : (
                          <Badge variant="success" size="sm">
                            Normal
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* REPORT 4: FUNIL E CONVERSÃO */}
        {selectedReport === 'funnel_performance' && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Oportunidades</span>
                <p className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {funnelPerformance.totalDeals}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Taxa de Conversão</span>
                <p className="text-lg font-bold font-mono text-emerald-600 mt-1">
                  {funnelPerformance.conversionRate}%
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Valor Fechado/Ganho</span>
                <p className="text-lg font-bold font-mono text-blue-600 mt-1">
                  {formatCurrency(funnelPerformance.wonTotalValue)}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Perdidos</span>
                <p className="text-lg font-bold font-mono text-rose-600 mt-1">
                  {funnelPerformance.lostDealsCount}
                </p>
              </div>
            </div>

            {/* Motivos de perda */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <h4 className="font-bold text-slate-800 dark:text-slate-200">
                Principais Motivos de Perda no Funil
              </h4>
              <div className="space-y-1.5">
                {Object.entries(funnelPerformance.lossReasons).map(([reason, count], i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-300">{reason}</span>
                    <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                      {count} ocorrência(s)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Rodapé do Relatório Impresso */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
          <span>Gestor Pro ERP • Relatório Gerencial Interno</span>
          <span>Página 1 de 1</span>
        </div>
      </div>
    </div>
  );
}
