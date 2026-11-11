import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar, type AppModule } from './Sidebar';
import { Header } from './Header';
import { DashboardView } from '../modules/dashboard/DashboardView';
import { FinancialView } from '../modules/financial/FinancialView';
import { CrmView } from '../modules/crm/CrmView';
import { ClientsView } from '../modules/clients/ClientsView';
import { SuppliersView } from '../modules/suppliers/SuppliersView';
import { ProductsView } from '../modules/products/ProductsView';
import { ProposalsView } from '../modules/proposals/ProposalsView';
import { TasksView } from '../modules/tasks/TasksView';
import { ReportsView } from '../modules/reports/ReportsView';
import { SettingsView } from '../modules/settings/SettingsView';
import { FirestoreService } from '../../services/firestoreService';
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, KANBAN_STAGES } from '../../services/demoDataService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import type {
  Transaction,
  Client,
  Supplier,
  Product,
  Deal,
  DealInteraction,
  Proposal,
  Task,
  Account,
  Category,
  CompanyProfile,
  UserProfile,
  DatePeriodFilter,
  DateRange,
  Transfer,
  KanbanColumn,
} from '../../types';
import { format, startOfMonth } from 'date-fns';
import { getPeriodRange } from '../../utils/period';

export function AppLayout() {
  const { profile, isAdmin } = useAuth();
  const { error } = useToast();

  const [currentModule, setCurrentModule] = useState<AppModule>('dashboard');
  const [period, setPeriod] = useState<DatePeriodFilter>('month');
  const [customRange, setCustomRange] = useState<DateRange>({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [quickAction, setQuickAction] = useState<string | null>(null);

  // Dados (tempo real)
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [rawTransactions, setRawTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [interactions, setInteractions] = useState<DealInteraction[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rawAccounts, setRawAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [stages, setStages] = useState<KanbanColumn[]>(KANBAN_STAGES);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);

  // Cria contas/categorias padrão no primeiro acesso do admin
  useEffect(() => {
    if (isAdmin) {
      FirestoreService.ensureDefaults(
        { accounts: DEFAULT_ACCOUNTS, categories: DEFAULT_CATEGORIES },
        profile ? { uid: profile.uid, name: profile.name } : undefined
      );
    }
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let warned = false;
    const onError = (e: Error) => {
      if (!warned) {
        warned = true;
        error('Erro ao carregar dados', (e as any)?.code === 'permission-denied' ? 'Sem permissão. Verifique as regras do Firestore.' : e.message);
      }
    };
    const sub = <T,>(col: string, set: (items: T[]) => void) => FirestoreService.subscribeCollection<T>(col, set, onError);

    const unsubs = [
      FirestoreService.subscribeDoc<CompanyProfile>('company', 'profile', (d) => setCompany(d)),
      FirestoreService.subscribeDoc<{ stages: KanbanColumn[] }>('company', 'kanban', (d) => {
        if (d?.stages?.length) setStages(normalizeStages(d.stages));
      }),
      sub<Transaction>('transactions', setRawTransactions),
      sub<Client>('clients', (d) => setClients(sortByName(d))),
      sub<Supplier>('suppliers', (d) => setSuppliers(sortByName(d))),
      sub<Product>('products', (d) => setProducts(sortByName(d))),
      sub<Deal>('deals', setDeals),
      sub<DealInteraction>('deal_interactions', setInteractions),
      sub<Proposal>('proposals', (d) => setProposals([...d].sort((a, b) => (b.number || '').localeCompare(a.number || '')))),
      sub<Task>('tasks', setTasks),
      sub<Account>('accounts', (d) => setRawAccounts([...d].sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)) || a.name.localeCompare(b.name)))),
      sub<Transfer>('transfers', setTransfers),
      sub<Category>('categories', (d) => {
        if (d.length) setCategories([...d].sort((a, b) => a.name.localeCompare(b.name)));
      }),
    ];
    if (isAdmin) unsubs.push(sub<UserProfile>('users', setUsersList));
    return () => unsubs.forEach((u) => u());
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Status "vencido" é automático: pendente com vencimento antes de hoje
  const transactions = useMemo(
    () =>
      rawTransactions
        .map((t) => (t.status !== 'paid' && t.dueDate && t.dueDate < todayStr ? { ...t, status: 'overdue' as const } : t.status === 'overdue' && t.dueDate >= todayStr ? { ...t, status: 'pending' as const } : t))
        .sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || '') || (b.createdAt || '').localeCompare(a.createdAt || '')),
    [rawTransactions, todayStr]
  );

  // Saldo de cada conta = saldo inicial + recebido - pago + transferências
  const accounts = useMemo(() => {
    const list = rawAccounts.length ? rawAccounts : DEFAULT_ACCOUNTS;
    return list.map((acc) => {
      let balance = acc.initialBalance || 0;
      rawTransactions.forEach((t) => {
        if (t.status === 'paid' && t.accountId === acc.id) balance += t.type === 'income' ? t.amount : -t.amount;
      });
      transfers.forEach((tr) => {
        if (tr.fromAccountId === acc.id) balance -= tr.amount;
        if (tr.toAccountId === acc.id) balance += tr.amount;
      });
      return { ...acc, currentBalance: balance };
    });
  }, [rawAccounts, rawTransactions, transfers]);

  const range = useMemo(() => getPeriodRange(period, customRange), [period, customRange]);

  const overdueTasksCount = useMemo(
    () => tasks.filter((t) => t.status === 'pending' && t.dueDate < todayStr).length,
    [tasks, todayStr]
  );

  const handleQuickAction = (action: string) => {
    setQuickAction(action);
    const target: Record<string, AppModule> = {
      new_income: 'financial',
      new_expense: 'financial',
      new_deal: 'crm',
      new_client: 'clients',
      new_proposal: 'proposals',
      new_task: 'tasks',
    };
    if (target[action]) setCurrentModule(target[action]);
  };

  const clearQuick = () => setQuickAction(null);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased">
      <Sidebar
        currentModule={currentModule}
        onSelectModule={(m) => {
          setCurrentModule(m);
          setQuickAction(null);
        }}
        overdueTasksCount={overdueTasksCount}
        companyName={company?.tradingName || company?.name || 'Gestor Pro'}
        logoUrl={company?.logoUrl}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      <div className="lg:pl-64 flex flex-col flex-1 min-w-0 transition-all duration-300">
        <Header
          currentModule={currentModule}
          period={period}
          onPeriodChange={setPeriod}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onQuickAction={handleQuickAction}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentModule === 'dashboard' && (
            <DashboardView
              transactions={transactions}
              deals={deals}
              accounts={accounts}
              categories={categories}
              stages={stages}
              tasks={tasks}
              products={products}
              period={period}
              range={range}
              onNavigateTo={setCurrentModule}
            />
          )}

          {currentModule === 'financial' && (
            <FinancialView
              key={quickAction || 'financial'}
              transactions={transactions}
              accounts={accounts}
              categories={categories}
              clients={clients}
              suppliers={suppliers}
              transfers={transfers}
              company={company}
              period={period}
              range={range}
              openCreateWith={quickAction === 'new_income' ? 'income' : quickAction === 'new_expense' ? 'expense' : null}
              onClearQuickAction={clearQuick}
            />
          )}

          {currentModule === 'crm' && (
            <CrmView
              deals={deals}
              clients={clients}
              interactions={interactions}
              tasks={tasks}
              accounts={accounts}
              stages={stages}
              openCreateDeal={quickAction === 'new_deal'}
              onClearQuickAction={clearQuick}
            />
          )}

          {currentModule === 'clients' && (
            <ClientsView
              clients={clients}
              transactions={transactions}
              deals={deals}
              tasks={tasks}
              company={company}
              openCreateClient={quickAction === 'new_client'}
              onClearQuickAction={clearQuick}
            />
          )}

          {currentModule === 'suppliers' && (
            <SuppliersView suppliers={suppliers} transactions={transactions} company={company} />
          )}

          {currentModule === 'products' && <ProductsView products={products} />}

          {currentModule === 'proposals' && (
            <ProposalsView
              proposals={proposals}
              clients={clients}
              products={products}
              accounts={accounts}
              categories={categories}
              company={company}
              openCreateProposal={quickAction === 'new_proposal'}
              onClearQuickAction={clearQuick}
            />
          )}

          {currentModule === 'tasks' && (
            <TasksView
              tasks={tasks}
              clients={clients}
              deals={deals}
              users={usersList}
              openCreateTask={quickAction === 'new_task'}
              onClearQuickAction={clearQuick}
            />
          )}

          {currentModule === 'reports' && (
            <ReportsView
              transactions={transactions}
              clients={clients}
              suppliers={suppliers}
              products={products}
              proposals={proposals}
              deals={deals}
              stages={stages}
              accounts={accounts}
              transfers={transfers}
              categories={categories}
              company={company}
              globalPeriod={period}
              globalRange={customRange}
            />
          )}

          {currentModule === 'settings' && (
            <SettingsView company={company} users={usersList} stages={stages} />
          )}
        </main>
      </div>
    </div>
  );
}

function sortByName<T extends { name?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

/** Garante que "ganho" e "perdido" sempre existam e fiquem no final */
export function normalizeStages(stages: KanbanColumn[]): KanbanColumn[] {
  const middle = stages.filter((s) => s.id !== 'ganho' && s.id !== 'perdido' && !s.isWon && !s.isLost);
  const won = stages.find((s) => s.id === 'ganho') || KANBAN_STAGES[3];
  const lost = stages.find((s) => s.id === 'perdido') || KANBAN_STAGES[4];
  return [...middle, { ...won, id: 'ganho', isWon: true }, { ...lost, id: 'perdido', isLost: true }];
}
