import React, { useState } from 'react';
import {
  Menu,
  Plus,
  Calendar,
  Building,
  UserCheck,
  ChevronDown,
  KanbanSquare,
  BadgeDollarSign,
  Users2,
  FileSpreadsheet,
  CheckSquare,
} from 'lucide-react';
import type { AppModule } from './Sidebar';
import type { DatePeriodFilter } from '../../types';
import { useAuth } from '../../hooks/useAuth';

interface HeaderProps {
  currentModule: AppModule;
  period: DatePeriodFilter;
  onPeriodChange: (p: DatePeriodFilter) => void;
  onOpenMobileMenu: () => void;
  onQuickAction?: (action: string) => void;
  companyName?: string;
}

export function Header({
  currentModule,
  period,
  onPeriodChange,
  onOpenMobileMenu,
  onQuickAction,
  companyName,
}: HeaderProps) {
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const { isDemoMode, switchDemoRole, isAdmin } = useAuth();

  const moduleTitles: Record<AppModule, { title: string; subtitle: string }> = {
    dashboard: { title: 'Visão Geral', subtitle: 'Acompanhe a saúde financeira e comercial em tempo real' },
    crm: { title: 'CRM & Funil de Vendas', subtitle: 'Gestão de oportunidades, propostas e negociações' },
    financial: { title: 'Gestão Financeira', subtitle: 'Contas a pagar, a receber, caixas e fluxo de caixa' },
    clients: { title: 'Carteira de Clientes', subtitle: 'Cadastro completo de pessoas físicas e jurídicas' },
    suppliers: { title: 'Fornecedores', subtitle: 'Gestão de parceiros e histórico de compras' },
    products: { title: 'Produtos & Serviços', subtitle: 'Catálogo de itens, custos, margens e estoque' },
    proposals: { title: 'Orçamentos & Vendas', subtitle: 'Emissão de propostas comerciais e pedidos' },
    tasks: { title: 'Tarefas & Agenda', subtitle: 'Planejamento de compromissos e atividades' },
    reports: { title: 'Relatórios & DRE', subtitle: 'Demonstrativos e análises operacionais' },
    settings: { title: 'Configurações do Sistema', subtitle: 'Parâmetros da empresa, usuários e categorias' },
  };

  const currentInfo = moduleTitles[currentModule] || { title: 'Gestor Pro', subtitle: '' };

  const periods: { id: DatePeriodFilter; label: string }[] = [
    { id: 'today', label: 'Hoje' },
    { id: 'week', label: 'Esta Semana' },
    { id: 'month', label: 'Este Mês' },
    { id: 'year', label: 'Este Ano' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors no-print">
      <div className="px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Mobile hamburger & Page Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden text-slate-600 dark:text-slate-300 transition-colors"
            title="Abrir menu de navegação"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {currentInfo.title}
            </h1>
            <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {currentInfo.subtitle}
            </p>
          </div>
        </div>

        {/* Right: Period Selector & Quick Add Button */}
        <div className="flex items-center gap-2.5 ml-auto">
          {/* Demo role switch badge if running without keys */}
          {isDemoMode && switchDemoRole && (
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
              <span className="font-medium text-[11px]">Modo de Teste:</span>
              <button
                onClick={() => switchDemoRole(isAdmin ? 'employee' : 'admin')}
                className="underline font-bold hover:text-amber-900 dark:hover:text-amber-100"
                title="Clique para alternar entre perfil Admin e Funcionário"
              >
                {isAdmin ? 'Simular Funcionário' : 'Simular Admin'}
              </button>
            </div>
          )}

          {/* Period selector */}
          <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            {periods.map((p) => (
              <button
                key={p.id}
                onClick={() => onPeriodChange(p.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  period === p.id
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Quick Action "+ Novo" Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowQuickMenu(!showQuickMenu)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-blue-600/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Novo</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-80" />
            </button>

            {showQuickMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowQuickMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">
                    Criar Registro
                  </div>

                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      onQuickAction?.('new_income');
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-2.5 transition-colors"
                  >
                    <BadgeDollarSign className="w-4 h-4 text-emerald-600" />
                    <span>Nova Entrada (Receita)</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      onQuickAction?.('new_expense');
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-2.5 transition-colors"
                  >
                    <BadgeDollarSign className="w-4 h-4 text-rose-600" />
                    <span>Nova Saída (Despesa)</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      onQuickAction?.('new_deal');
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-2.5 transition-colors"
                  >
                    <KanbanSquare className="w-4 h-4 text-blue-600" />
                    <span>Novo Negócio (CRM)</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      onQuickAction?.('new_client');
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                  >
                    <Users2 className="w-4 h-4 text-slate-500" />
                    <span>Novo Cliente</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      onQuickAction?.('new_proposal');
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                    <span>Novo Orçamento</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      onQuickAction?.('new_task');
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                  >
                    <CheckSquare className="w-4 h-4 text-slate-500" />
                    <span>Nova Tarefa</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
