import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Calendar,
  Wallet,
  Tag,
  FileText,
  Trash2,
  Edit2,
  Printer,
  Download,
  Repeat,
  Layers,
  ChevronDown,
} from 'lucide-react';
import type {
  Transaction,
  Account,
  Category,
  Client,
  Supplier,
  TransactionType,
  TransactionStatus,
  PaymentMethod,
} from '../../../types';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { EmptyState } from '../../common/EmptyState';
import { Pagination } from '../../common/Pagination';
import { FirestoreService } from '../../../services/firestoreService';
import { ExportService } from '../../../services/exportService';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import { format } from 'date-fns';

interface FinancialViewProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  clients: Client[];
  suppliers: Supplier[];
  onRefresh?: () => void;
  openCreateWith?: 'income' | 'expense' | null;
  onClearQuickAction?: () => void;
}

type TabType = 'all' | 'receivables' | 'payables' | 'cashflow' | 'accounts';

export function FinancialView({
  transactions,
  accounts,
  categories,
  clients,
  suppliers,
  openCreateWith,
  onClearQuickAction,
}: FinancialViewProps) {
  const { profile, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<TabType>(
    openCreateWith === 'expense' ? 'payables' : openCreateWith === 'income' ? 'receivables' : 'all'
  );

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TransactionStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(Boolean(openCreateWith));
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactionType, setTransactionType] = useState<TransactionType>(
    openCreateWith || 'income'
  );

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form fields for Transaction
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formDueDate, setFormDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod>('pix');
  const [formStatus, setFormStatus] = useState<TransactionStatus>('paid');
  const [formEntityType, setFormEntityType] = useState<'client' | 'supplier' | 'none'>('none');
  const [formEntityId, setFormEntityId] = useState('');
  const [formAccountId, setFormAccountId] = useState(accounts[0]?.id || '');
  const [formCostCenter, setFormCostCenter] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formReceiptUrl, setFormReceiptUrl] = useState('');

  // Installments & Recurrence
  const [isInstallments, setIsInstallments] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState<number>(2);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');

  // Form for Transfer
  const [fromAccount, setFromAccount] = useState(accounts[0]?.id || '');
  const [toAccount, setToAccount] = useState(accounts[1]?.id || '');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  // Form for Category
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<TransactionType>('expense');
  const [catColor, setCatColor] = useState('#3b82f6');

  // Form for Account
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<'cash' | 'bank' | 'other'>('bank');
  const [accBalance, setAccBalance] = useState('');
  const [accColor, setAccColor] = useState('#3b82f6');

  const openNewTransactionModal = (type: TransactionType) => {
    setEditingTransaction(null);
    setTransactionType(type);
    setFormDescription('');
    setFormAmount('');
    setFormDate(format(new Date(), 'yyyy-MM-dd'));
    setFormDueDate(format(new Date(), 'yyyy-MM-dd'));
    setFormCategoryId(categories.find((c) => c.type === type)?.id || '');
    setFormPaymentMethod('pix');
    setFormStatus('paid');
    setFormEntityType(type === 'income' ? 'client' : 'supplier');
    setFormEntityId('');
    setFormAccountId(accounts[0]?.id || '');
    setFormCostCenter('');
    setFormNotes('');
    setFormReceiptUrl('');
    setIsInstallments(false);
    setInstallmentsCount(2);
    setIsRecurring(false);
    setIsModalOpen(true);
  };

  const openEditTransactionModal = (t: Transaction) => {
    setEditingTransaction(t);
    setTransactionType(t.type);
    setFormDescription(t.description);
    setFormAmount(String(t.amount));
    setFormDate(t.date || format(new Date(), 'yyyy-MM-dd'));
    setFormDueDate(t.dueDate || format(new Date(), 'yyyy-MM-dd'));
    setFormCategoryId(t.categoryId);
    setFormPaymentMethod(t.paymentMethod);
    setFormStatus(t.status);
    setFormEntityType(t.entityType || 'none');
    setFormEntityId(t.entityId || '');
    setFormAccountId(t.accountId);
    setFormCostCenter(t.costCenter || '');
    setFormNotes(t.notes || '');
    setFormReceiptUrl(t.receiptUrl || '');
    setIsInstallments(false);
    setIsRecurring(Boolean(t.isRecurring));
    setIsModalOpen(true);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(formAmount.replace(',', '.'));
    if (!formDescription || isNaN(val) || val <= 0) {
      error('Preencha a descrição e um valor válido.');
      return;
    }

    const categoryObj = categories.find((c) => c.id === formCategoryId);
    const accountObj = accounts.find((a) => a.id === formAccountId);

    let entityName = '';
    if (formEntityType === 'client') {
      entityName = clients.find((c) => c.id === formEntityId)?.name || '';
    } else if (formEntityType === 'supplier') {
      entityName = suppliers.find((s) => s.id === formEntityId)?.name || '';
    }

    try {
      if (editingTransaction) {
        await FirestoreService.updateDocument<Transaction>(
          'transactions',
          editingTransaction.id,
          {
            description: formDescription,
            amount: val,
            type: transactionType,
            date: formDate,
            dueDate: formDueDate,
            paymentDate: formStatus === 'paid' ? formDate : undefined,
            categoryId: formCategoryId,
            categoryName: categoryObj?.name,
            paymentMethod: formPaymentMethod,
            status: formStatus,
            entityType: formEntityType,
            entityId: formEntityId,
            entityName,
            accountId: formAccountId,
            accountName: accountObj?.name,
            costCenter: formCostCenter,
            notes: formNotes,
            receiptUrl: formReceiptUrl,
          },
          profile ? { uid: profile.uid, name: profile.name } : undefined
        );
        success('Lançamento atualizado com sucesso!');
      } else {
        await FirestoreService.createTransactionWithInstallments(
          {
            description: formDescription,
            amount: val,
            type: transactionType,
            date: formDate,
            dueDate: formDueDate,
            paymentDate: formStatus === 'paid' ? formDate : undefined,
            categoryId: formCategoryId,
            categoryName: categoryObj?.name,
            paymentMethod: formPaymentMethod,
            status: formStatus,
            entityType: formEntityType,
            entityId: formEntityId,
            entityName,
            accountId: formAccountId,
            accountName: accountObj?.name,
            costCenter: formCostCenter,
            notes: formNotes,
            receiptUrl: formReceiptUrl,
            isRecurring,
            recurrenceFrequency: isRecurring ? recurrenceFreq : undefined,
            installmentsCount: isInstallments ? installmentsCount : 1,
            frequency: 'monthly',
          },
          profile ? { uid: profile.uid, name: profile.name } : undefined
        );
        success(
          isInstallments
            ? `Lançamento criado com ${installmentsCount} parcelas automáticas!`
            : 'Lançamento registrado com sucesso!'
        );
      }

      setIsModalOpen(false);
      onClearQuickAction?.();
    } catch (err: any) {
      error('Erro ao salvar lançamento', err?.message);
    }
  };

  const handleMarkAsPaid = async (t: Transaction) => {
    try {
      await FirestoreService.markTransactionAsPaid(
        t,
        format(new Date(), 'yyyy-MM-dd'),
        t.accountId,
        profile ? { uid: profile.uid, name: profile.name } : undefined
      );
      success('Lançamento marcado como pago!');
    } catch (err: any) {
      error('Erro ao marcar como pago', err?.message);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await FirestoreService.deleteDocument(
        'transactions',
        deletingId,
        profile ? { uid: profile.uid, name: profile.name } : undefined
      );
      success('Lançamento excluído com sucesso.');
      setDeletingId(null);
    } catch (err: any) {
      error('Erro ao excluir lançamento', err?.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(transferAmount.replace(',', '.'));
    if (fromAccount === toAccount) {
      error('A conta de origem e destino devem ser diferentes.');
      return;
    }
    if (isNaN(val) || val <= 0) {
      error('Informe um valor de transferência válido.');
      return;
    }

    try {
      await FirestoreService.transferBetweenAccounts(
        fromAccount,
        toAccount,
        val,
        format(new Date(), 'yyyy-MM-dd'),
        transferNotes,
        profile ? { uid: profile.uid, name: profile.name } : undefined
      );
      success('Transferência efetuada com sucesso!');
      setIsTransferModalOpen(false);
      setTransferAmount('');
      setTransferNotes('');
    } catch (err: any) {
      error('Erro na transferência', err?.message);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName) return;
    try {
      await FirestoreService.createDocument<Category>(
        'categories',
        {
          name: catName,
          type: catType,
          color: catColor,
        } as any,
        profile ? { uid: profile.uid, name: profile.name } : undefined
      );
      success('Categoria criada!');
      setCatName('');
      setIsCategoryModalOpen(false);
    } catch (err: any) {
      error('Erro ao criar categoria', err?.message);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const bal = parseFloat(accBalance.replace(',', '.')) || 0;
    if (!accName) return;
    try {
      await FirestoreService.createDocument<Account>(
        'accounts',
        {
          name: accName,
          type: accType,
          initialBalance: bal,
          currentBalance: bal,
          color: accColor,
        } as any,
        profile ? { uid: profile.uid, name: profile.name } : undefined
      );
      success('Conta cadastrada!');
      setAccName('');
      setAccBalance('');
      setIsAccountModalOpen(false);
    } catch (err: any) {
      error('Erro ao cadastrar conta', err?.message);
    }
  };

  // Filtered list
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Tab check
      if (activeTab === 'receivables' && t.type !== 'income') return false;
      if (activeTab === 'payables' && t.type !== 'expense') return false;

      // Status check
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;

      // Category check
      if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false;

      // Account check
      if (accountFilter !== 'all' && t.accountId !== accountFilter) return false;

      // Search term
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchDesc = t.description?.toLowerCase().includes(query);
        const matchEntity = t.entityName?.toLowerCase().includes(query);
        const matchCat = t.categoryName?.toLowerCase().includes(query);
        if (!matchDesc && !matchEntity && !matchCat) return false;
      }

      return true;
    });
  }, [transactions, activeTab, statusFilter, categoryFilter, accountFilter, searchTerm]);

  // Paginated records
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage]);

  // Cashflow daily grouping calculations
  const dailyCashFlow = useMemo(() => {
    const map: Record<string, { date: string; income: number; expense: number }> = {};

    transactions.forEach((t) => {
      const d = t.paymentDate || t.date || t.dueDate;
      if (!map[d]) {
        map[d] = { date: d, income: 0, expense: 0 };
      }
      if (t.type === 'income') map[d].income += t.amount;
      else map[d].expense += t.amount;
    });

    const sorted = Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
    let runningBalance = accounts.reduce((acc, a) => acc + a.currentBalance, 0);

    return sorted.map((day) => {
      const net = day.income - day.expense;
      return {
        ...day,
        net,
        accumulated: runningBalance,
      };
    });
  }, [transactions, accounts]);

  return (
    <div className="space-y-6">
      {/* Top Action Bar & Tabs */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-x-auto">
          <button
            onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Todos os Lançamentos
          </button>
          <button
            onClick={() => { setActiveTab('receivables'); setCurrentPage(1); }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'receivables'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Contas a Receber
          </button>
          <button
            onClick={() => { setActiveTab('payables'); setCurrentPage(1); }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'payables'
                ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowDownRight className="w-3.5 h-3.5" />
            Contas a Pagar
          </button>
          <button
            onClick={() => setActiveTab('cashflow')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'cashflow'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Fluxo de Caixa
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'accounts'
                ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            Contas & Caixas
          </button>
        </div>

        {/* Buttons: Transfer, New Income, New Expense */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500" />
            Transferência
          </button>

          <button
            onClick={() => openNewTransactionModal('income')}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Entrada
          </button>

          <button
            onClick={() => openNewTransactionModal('expense')}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Saída
          </button>
        </div>
      </div>

      {/* TAB 1: TRANSACTIONS LIST */}
      {(activeTab === 'all' || activeTab === 'receivables' || activeTab === 'payables') && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Filters Bar */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/20">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative w-full max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por descrição, cliente ou fornecedor..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as any); setCurrentPage(1); }}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos os Status</option>
                <option value="paid">Pago</option>
                <option value="pending">Pendente</option>
                <option value="overdue">Vencido</option>
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todas Categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Account Filter */}
              <select
                value={accountFilter}
                onChange={(e) => { setAccountFilter(e.target.value); setCurrentPage(1); }}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todas as Contas</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>

              {/* Export CSV button */}
              <button
                onClick={() =>
                  ExportService.exportToCSV(
                    `Lancamentos_${format(new Date(), 'yyyyMMdd')}`,
                    filteredTransactions.map((t) => ({
                      Data: formatDate(t.date),
                      Vencimento: formatDate(t.dueDate),
                      Descricao: t.description,
                      Tipo: t.type === 'income' ? 'Entrada' : 'Saida',
                      Valor: t.amount,
                      Status: t.status,
                      Categoria: t.categoryName || '',
                      Forma_Pagamento: t.paymentMethod,
                      Conta: t.accountName || '',
                      Entidade: t.entityName || '',
                    }))
                  )
                }
                title="Exportar listagem para Excel / CSV"
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Table */}
          {paginatedTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Data / Vencimento</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4">Categoria & Conta</th>
                    <th className="py-3 px-4">Vinculado</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Valor (R$)</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {paginatedTransactions.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {formatDate(t.dueDate)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Emissão: {formatDate(t.date)}
                        </div>
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {t.description}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                          <span className="capitalize">{t.paymentMethod.replace('_', ' ')}</span>
                          {t.installmentNumber && (
                            <span className="px-1.5 py-0.2 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded font-mono">
                              {t.installmentNumber}/{t.totalInstallments}
                            </span>
                          )}
                          {t.isRecurring && (
                            <span className="flex items-center gap-0.5 text-purple-600">
                              <Repeat className="w-2.5 h-2.5" /> Recorrente
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-slate-700 dark:text-slate-300 font-medium">
                          {t.categoryName || 'Geral'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {t.accountName || 'Caixa'}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-slate-700 dark:text-slate-300">
                          {t.entityName || '-'}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge
                          variant={
                            t.status === 'paid'
                              ? 'success'
                              : t.status === 'overdue'
                              ? 'danger'
                              : 'warning'
                          }
                          dot
                        >
                          {t.status === 'paid'
                            ? 'Pago'
                            : t.status === 'overdue'
                            ? 'Vencido'
                            : 'Pendente'}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-bold font-mono text-sm ${
                            t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {/* Marcar como pago */}
                          {t.status !== 'paid' && (
                            <button
                              onClick={() => handleMarkAsPaid(t)}
                              title="Marcar como pago"
                              className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Recibo em PDF */}
                          {t.type === 'income' && (
                            <button
                              onClick={() => ExportService.generateReceiptPDF(t)}
                              title="Gerar recibo de pagamento com valor por extenso"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Editar */}
                          <button
                            onClick={() => openEditTransactionModal(t)}
                            title="Editar lançamento"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Excluir (somente admin) */}
                          {isAdmin && (
                            <button
                              onClick={() => setDeletingId(t.id)}
                              title="Excluir lançamento"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Nenhum lançamento encontrado"
              description="Ajuste os filtros ou crie um novo lançamento financeiro de entrada ou saída."
              actionText="Novo Lançamento"
              onAction={() => openNewTransactionModal('income')}
            />
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredTransactions.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* TAB 2: FLUXO DE CAIXA DIÁRIO */}
      {activeTab === 'cashflow' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Fluxo de Caixa Diário com Saldo Acumulado
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Acompanhamento dia a dia das entradas, saídas, resultado líquido e evolução do saldo
              </p>
            </div>
            <button
              onClick={() =>
                ExportService.exportToCSV(
                  `Fluxo_de_Caixa_${format(new Date(), 'yyyyMMdd')}`,
                  dailyCashFlow.map((d) => ({
                    Data: formatDate(d.date),
                    Entradas: d.income,
                    Saidas: d.expense,
                    Resultado_Dia: d.net,
                  }))
                )
              }
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4 text-right">Entradas (R$)</th>
                  <th className="py-3 px-4 text-right">Saídas (R$)</th>
                  <th className="py-3 px-4 text-right">Saldo do Dia</th>
                  <th className="py-3 px-4 text-right">Status do Dia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dailyCashFlow.map((day, i) => (
                  <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {formatDate(day.date)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600 font-medium">
                      + {formatCurrency(day.income)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-600 font-medium">
                      - {formatCurrency(day.expense)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        day.net >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {day.net >= 0 ? '+' : ''} {formatCurrency(day.net)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Badge variant={day.net >= 0 ? 'success' : 'danger'}>
                        {day.net >= 0 ? 'Superávit' : 'Déficit'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CONTAS E CAIXAS */}
      {activeTab === 'accounts' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Contas Bancárias e Caixas
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Saldos disponíveis e conciliação por conta financeira
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                <Tag className="w-3.5 h-3.5 text-purple-500" />
                Categorias ({categories.length})
              </button>
              {isAdmin && (
                <button
                  onClick={() => setIsAccountModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nova Conta
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: acc.color || '#3b82f6' }}
                />
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {acc.type === 'cash' ? 'Caixa Espécie' : 'Conta Corrente'}
                    </span>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                      {acc.name}
                    </h4>
                  </div>
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: acc.color || '#3b82f6' }}
                  >
                    <Wallet className="w-4 h-4" />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500">Saldo Atual</span>
                  <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                    {formatCurrency(acc.currentBalance)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: CRIAR / EDITAR LANÇAMENTO */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); onClearQuickAction?.(); }}
        title={editingTransaction ? 'Editar Lançamento' : transactionType === 'income' ? 'Nova Entrada (Receita)' : 'Nova Saída (Despesa)'}
        subtitle="Informe os dados financeiros com precisão"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveTransaction} className="space-y-4 text-xs">
          {/* Type Switcher */}
          {!editingTransaction && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setTransactionType('income')}
                className={`py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                  transactionType === 'income'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                Receita (Entrada)
              </button>
              <button
                type="button"
                onClick={() => setTransactionType('expense')}
                className={`py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                  transactionType === 'expense'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <ArrowDownRight className="w-4 h-4" />
                Despesa (Saída)
              </button>
            </div>
          )}

          {/* Description & Value */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Descrição do Lançamento *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Fatura Servidor, Venda Software..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Valor (R$) *
              </label>
              <input
                type="text"
                required
                placeholder="0,00"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Dates & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Data de Vencimento *
              </label>
              <input
                type="date"
                required
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Data de Emissão
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Status *
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="paid">Já Pago / Recebido</option>
                <option value="pending">Pendente (A Pagar / Receber)</option>
                <option value="overdue">Vencido</option>
              </select>
            </div>
          </div>

          {/* Category, Payment Method, Account */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Categoria *
              </label>
              <select
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione uma categoria</option>
                {categories
                  .filter((c) => c.type === transactionType)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Forma de Pagamento
              </label>
              <select
                value={formPaymentMethod}
                onChange={(e) => setFormPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="pix">Pix</option>
                <option value="bank_slip">Boleto Bancário</option>
                <option value="credit_card">Cartão de Crédito</option>
                <option value="debit_card">Cartão de Débito</option>
                <option value="bank_transfer">Transferência / TED</option>
                <option value="cash">Dinheiro em Espécie</option>
                <option value="other">Outros</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Conta / Caixa *
              </label>
              <select
                value={formAccountId}
                onChange={(e) => setFormAccountId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatCurrency(a.currentBalance)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Entity Link (Client / Supplier) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Vincular a:
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={formEntityType}
                  onChange={(e) => {
                    setFormEntityType(e.target.value as any);
                    setFormEntityId('');
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="none">Nenhum</option>
                  <option value="client">Cliente</option>
                  <option value="supplier">Fornecedor</option>
                </select>

                {formEntityType === 'client' && (
                  <select
                    value={formEntityId}
                    onChange={(e) => setFormEntityId(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Selecione o Cliente</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}

                {formEntityType === 'supplier' && (
                  <select
                    value={formEntityId}
                    onChange={(e) => setFormEntityId(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Selecione o Fornecedor</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Centro de Custo / Observação
              </label>
              <input
                type="text"
                placeholder="Ex: Operacional, TI, Matriz..."
                value={formCostCenter}
                onChange={(e) => setFormCostCenter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Parcelamento & Recorrência (Only on creation) */}
          {!editingTransaction && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={isInstallments}
                    onChange={(e) => {
                      setIsInstallments(e.target.checked);
                      if (e.target.checked) setIsRecurring(false);
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Parcelar em N vezes</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => {
                      setIsRecurring(e.target.checked);
                      if (e.target.checked) setIsInstallments(false);
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Lançamento Recorrente (Aluguel, etc.)</span>
                </label>
              </div>

              {isInstallments && (
                <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-400">Quantidade de parcelas:</span>
                  <select
                    value={installmentsCount}
                    onChange={(e) => setInstallmentsCount(Number(e.target.value))}
                    className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    {[2, 3, 4, 5, 6, 10, 12, 24, 36].map((num) => (
                      <option key={num} value={num}>
                        {num}x parcelas mensais
                      </option>
                    ))}
                  </select>
                  {formAmount && (
                    <span className="text-slate-500 font-mono">
                      (~ {formatCurrency(parseFloat(formAmount.replace(',', '.')) / installmentsCount)} / mês)
                    </span>
                  )}
                </div>
              )}

              {isRecurring && (
                <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-400">Frequência:</span>
                  <select
                    value={recurrenceFreq}
                    onChange={(e) => setRecurrenceFreq(e.target.value as any)}
                    className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="monthly">Mensal (padrão)</option>
                    <option value="weekly">Semanal</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Anexo de comprovante URL */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Link ou Comprovante (URL)
            </label>
            <input
              type="text"
              placeholder="Cole o link do comprovante no Storage ou anexo..."
              value={formReceiptUrl}
              onChange={(e) => setFormReceiptUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => { setIsModalOpen(false); onClearQuickAction?.(); }}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-600/20"
            >
              Salvar Lançamento
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: TRANSFERÊNCIA ENTRE CONTAS */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Transferência entre Contas"
        subtitle="Mova saldo entre contas bancárias e caixa"
        maxWidth="md"
      >
        <form onSubmit={handleExecuteTransfer} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Conta de Origem (Sai o valor)
            </label>
            <select
              value={fromAccount}
              onChange={(e) => setFromAccount(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (Saldo: {formatCurrency(a.currentBalance)})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Conta de Destino (Recebe o valor)
            </label>
            <select
              value={toAccount}
              onChange={(e) => setToAccount(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (Saldo: {formatCurrency(a.currentBalance)})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Valor da Transferência (R$) *
            </label>
            <input
              type="text"
              required
              placeholder="0,00"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Observações (opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Saque para caixa físico..."
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-600/20"
            >
              Confirmar Transferência
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CRIAR CATEGORIA */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Gerenciar Categorias"
        subtitle="Categorias de receitas e despesas com cores"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <form onSubmit={handleCreateCategory} className="space-y-3 pb-4 border-b border-slate-200 dark:border-slate-700">
            <h4 className="font-bold text-slate-800 dark:text-slate-200">Adicionar Nova Categoria</h4>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Nome da categoria..."
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
              <select
                value={catType}
                onChange={(e) => setCatType(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>Cor:</span>
                <input
                  type="color"
                  value={catColor}
                  onChange={(e) => setCatColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                Salvar Categoria
              </button>
            </div>
          </form>

          {/* List of Categories */}
          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
            {categories.map((c) => (
              <div
                key={c.id}
                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {c.name}
                  </span>
                </div>
                <Badge variant={c.type === 'income' ? 'success' : 'danger'}>
                  {c.type === 'income' ? 'Entrada' : 'Saída'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* MODAL: CRIAR CONTA */}
      <Modal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        title="Cadastrar Nova Conta Bancária / Caixa"
        subtitle="Informe o nome e saldo inicial da conta"
        maxWidth="md"
      >
        <form onSubmit={handleCreateAccount} className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Nome da Conta *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Santander Empresas, Nubank, Caixa 2..."
              value={accName}
              onChange={(e) => setAccName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Tipo da Conta
              </label>
              <select
                value={accType}
                onChange={(e) => setAccType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="bank">Banco / Corrente</option>
                <option value="cash">Caixa Físico</option>
                <option value="other">Outros</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Saldo Inicial (R$)
              </label>
              <input
                type="text"
                placeholder="0,00"
                value={accBalance}
                onChange={(e) => setAccBalance(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              Criar Conta
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRMAÇÃO DE EXCLUSÃO */}
      <ConfirmDialog
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Excluir Lançamento Financeiro"
        message="Tem certeza de que deseja excluir este lançamento financeiro? Essa ação não pode ser desfeita e será registrada na auditoria do sistema."
        loading={isDeleting}
      />
    </div>
  );
}
