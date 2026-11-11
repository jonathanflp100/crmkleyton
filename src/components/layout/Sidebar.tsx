import React from 'react';
import {
  LayoutDashboard,
  KanbanSquare,
  BadgeDollarSign,
  Users2,
  Truck,
  Package,
  FileSpreadsheet,
  CheckSquare,
  BarChart3,
  Settings,
  LogOut,
  Building2,
  Sun,
  Moon,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

export type AppModule =
  | 'dashboard'
  | 'financial'
  | 'crm'
  | 'clients'
  | 'suppliers'
  | 'products'
  | 'proposals'
  | 'tasks'
  | 'reports'
  | 'settings';

interface SidebarProps {
  currentModule: AppModule;
  onSelectModule: (module: AppModule) => void;
  overdueTasksCount?: number;
  companyName?: string;
  logoUrl?: string;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  currentModule,
  onSelectModule,
  overdueTasksCount = 0,
  companyName = 'Gestor Pro',
  logoUrl,
  isOpenMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const { profile, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { id: 'dashboard' as AppModule, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'crm' as AppModule, label: 'CRM Funil', icon: KanbanSquare },
    { id: 'financial' as AppModule, label: 'Financeiro', icon: BadgeDollarSign },
    { id: 'clients' as AppModule, label: 'Clientes', icon: Users2 },
    { id: 'suppliers' as AppModule, label: 'Fornecedores', icon: Truck },
    { id: 'products' as AppModule, label: 'Produtos & Serviços', icon: Package },
    { id: 'proposals' as AppModule, label: 'Orçamentos & Vendas', icon: FileSpreadsheet },
    {
      id: 'tasks' as AppModule,
      label: 'Tarefas & Agenda',
      icon: CheckSquare,
      badge: overdueTasksCount > 0 ? overdueTasksCount : undefined,
    },
    { id: 'reports' as AppModule, label: 'Relatórios', icon: BarChart3 },
    ...(isAdmin
      ? [{ id: 'settings' as AppModule, label: 'Configurações', icon: Settings }]
      : []),
  ];

  const handleSelect = (id: AppModule) => {
    onSelectModule(id);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        } no-print`}
      >
        {/* Brand / Logo */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-9 h-9 rounded-xl object-contain bg-white p-0.5" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black text-lg tracking-wider">
                GP
              </div>
            )}
            <div className="leading-tight">
              <span className="font-bold text-base text-white tracking-tight flex items-center gap-1.5">
                Gestor Pro
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  ERP
                </span>
              </span>
              <p className="text-[11px] text-slate-400 truncate max-w-[140px]">
                {companyName}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Módulos Principais
          </p>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer: User profile, theme, and logout */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/30 space-y-2">
          {/* Theme switcher */}
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-800/50 text-xs text-slate-400">
            <span>Tema da interface</span>
            <button
              onClick={toggleTheme}
              className="p-1 rounded-md hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
              title="Alternar modo claro / escuro"
            >
              {theme === 'dark' ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[11px]">Escuro</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px]">Claro</span>
                </>
              )}
            </button>
          </div>

          {/* User profile card */}
          <div className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-500/30">
                {profile?.name ? profile.name.slice(0, 2).toUpperCase() : <UserIcon className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {profile?.name || 'Usuário'}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span
                    className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                      isAdmin
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {isAdmin ? <ShieldCheck className="w-2.5 h-2.5" /> : null}
                    {isAdmin ? 'Admin' : 'Funcionário'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sair do sistema"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
