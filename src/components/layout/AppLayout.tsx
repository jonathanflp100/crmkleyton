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
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, loadDemoData } from '../../services/demoDataService';
import { useAuth } from '../../hooks/useAuth';
import { isFirebaseConfigured } from '../../services/firebase';
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
} from '../../types';
import { format } from 'date-fns';

export function AppLayout() {
  const { profile, isAdmin, isDemoMode } = useAuth();

  const [currentModule, setCurrentModule] = useState<AppModule>('dashboard');
  const [period, setPeriod] = useState<DatePeriodFilter>('month');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Quick Action trigger
  const [quickAction, setQuickAction] = useState<string | null>(null);

  // Application Data States
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [interactions, setInteractions] = useState<DealInteraction[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [accounts, setAccounts] = useState<Account[]>(DEFAULT_ACCOUNTS);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);

  // Real-time subscriptions
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      // In demo / preview mode without keys: auto-populate with initial mockup data if empty
      return;
    }

    // Company Profile
    const unsubCompany = FirestoreService.subscribeDoc<CompanyProfile>(
      'company',
      'profile',
      (data) => {
        if (data) setCompany(data);
      }
    );

    // Collections
    const unsubTrans = FirestoreService.subscribeCollection<Transaction>(
      'transactions',
      (data) => setTransactions(data)
    );
    const unsubClients = FirestoreService.subscribeCollection<Client>('clients', (data) =>
      setClients(data)
    );
    const unsubSuppliers = FirestoreService.subscribeCollection<Supplier>(
      'suppliers',
      (data) => setSuppliers(data)
    );
    const unsubProducts = FirestoreService.subscribeCollection<Product>('products', (data) =>
      setProducts(data)
    );
    const unsubDeals = FirestoreService.subscribeCollection<Deal>('deals', (data) =>
      setDeals(data)
    );
    const unsubInteractions = FirestoreService.subscribeCollection<DealInteraction>(
      'deal_interactions',
      (data) => setInteractions(data)
    );
    const unsubProposals = FirestoreService.subscribeCollection<Proposal>(
      'proposals',
      (data) => setProposals(data)
    );
    const unsubTasks = FirestoreService.subscribeCollection<Task>('tasks', (data) =>
      setTasks(data)
    );
    const unsubAccounts = FirestoreService.subscribeCollection<Account>('accounts', (data) => {
      if (data && data.length > 0) setAccounts(data);
    });
    const unsubCategories = FirestoreService.subscribeCollection<Category>(
      'categories',
      (data) => {
        if (data && data.length > 0) setCategories(data);
      }
    );
    const unsubUsers = FirestoreService.subscribeCollection<UserProfile>('users', (data) =>
      setUsersList(data)
    );

    return () => {
      unsubCompany();
      unsubTrans();
      unsubClients();
      unsubSuppliers();
      unsubProducts();
      unsubDeals();
      unsubInteractions();
      unsubProposals();
      unsubTasks();
      unsubAccounts();
      unsubCategories();
      unsubUsers();
    };
  }, []);

  // Calculate overdue tasks count for the badge
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const overdueTasksCount = useMemo(() => {
    return tasks.filter((t) => t.status === 'pending' && t.dueDate < todayStr).length;
  }, [tasks, todayStr]);

  const handleQuickAction = (action: string) => {
    setQuickAction(action);
    if (action === 'new_income' || action === 'new_expense') {
      setCurrentModule('financial');
    } else if (action === 'new_deal') {
      setCurrentModule('crm');
    } else if (action === 'new_client') {
      setCurrentModule('clients');
    } else if (action === 'new_proposal') {
      setCurrentModule('proposals');
    } else if (action === 'new_task') {
      setCurrentModule('tasks');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased">
      {/* Sidebar */}
      <Sidebar
        currentModule={currentModule}
        onSelectModule={setCurrentModule}
        overdueTasksCount={overdueTasksCount}
        companyName={company?.tradingName || company?.name || 'Gestor Pro'}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col flex-1 min-w-0 transition-all duration-300">
        {/* Header */}
        <Header
          currentModule={currentModule}
          period={period}
          onPeriodChange={setPeriod}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onQuickAction={handleQuickAction}
          companyName={company?.name}
        />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentModule === 'dashboard' && (
            <DashboardView
              transactions={transactions}
              deals={deals}
              accounts={accounts}
              categories={categories}
              period={period}
              onNavigateTo={setCurrentModule}
              onNewTransaction={(type) => {
                setQuickAction(type === 'income' ? 'new_income' : 'new_expense');
                setCurrentModule('financial');
              }}
            />
          )}

          {currentModule === 'financial' && (
            <FinancialView
              transactions={transactions}
              accounts={accounts}
              categories={categories}
              clients={clients}
              suppliers={suppliers}
              openCreateWith={
                quickAction === 'new_income'
                  ? 'income'
                  : quickAction === 'new_expense'
                  ? 'expense'
                  : null
              }
              onClearQuickAction={() => setQuickAction(null)}
            />
          )}

          {currentModule === 'crm' && (
            <CrmView
              deals={deals}
              clients={clients}
              interactions={interactions}
              openCreateDeal={quickAction === 'new_deal'}
              onClearQuickAction={() => setQuickAction(null)}
            />
          )}

          {currentModule === 'clients' && (
            <ClientsView
              clients={clients}
              transactions={transactions}
              deals={deals}
              tasks={tasks}
              openCreateClient={quickAction === 'new_client'}
              onClearQuickAction={() => setQuickAction(null)}
            />
          )}

          {currentModule === 'suppliers' && (
            <SuppliersView suppliers={suppliers} transactions={transactions} />
          )}

          {currentModule === 'products' && <ProductsView products={products} />}

          {currentModule === 'proposals' && (
            <ProposalsView
              proposals={proposals}
              clients={clients}
              products={products}
              accounts={accounts}
              company={company}
              openCreateProposal={quickAction === 'new_proposal'}
              onClearQuickAction={() => setQuickAction(null)}
            />
          )}

          {currentModule === 'tasks' && (
            <TasksView
              tasks={tasks}
              clients={clients}
              deals={deals}
              openCreateTask={quickAction === 'new_task'}
              onClearQuickAction={() => setQuickAction(null)}
            />
          )}

          {currentModule === 'reports' && (
            <ReportsView
              transactions={transactions}
              clients={clients}
              products={products}
              deals={deals}
              categories={categories}
              company={company}
            />
          )}

          {currentModule === 'settings' && (
            <SettingsView company={company} users={usersList} />
          )}
        </main>
      </div>
    </div>
  );
}
