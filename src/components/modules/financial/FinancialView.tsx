import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Wallet,
  Tag,
  Trash2,
  Edit2,
  Printer,
  Download,
  Repeat,
  Layers,
  Undo2,
  FileText,
} from 'lucide-react';
import type {
  Transaction,
  Account,
  Category,
  Client,
  Supplier,
  TransactionType,
  PaymentMethod,
  CompanyProfile,
  DatePeriodFilter,
  DateRange,
  Transfer,
} from '../../../types';
import {
  formatCurrency,
  formatDate,
  formatMoneyInput,
  parseMoney,
  PAYMENT_METHODS,
  paymentMethodLabel,
} from '../../../utils/formatters';
import { cashDate, inRange, periodLabel } from '../../../utils/period';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { EmptyState } from '../../common/EmptyState';
import { Pagination } from '../../common/Pagination';
import { MoneyInput } from '../../common/MoneyInput';
import { inputCls, inputSmCls, labelCls, btnPrimary, btnSecondary, btnIcon, cardCls } from '../../common/ui';
import { FirestoreService } from '../../../services/firestoreService';
import { ExportService } from '../../../services/exportService';
import { printReceipt, printTransactionList } from '../../../services/printDocuments';
import { useAuth, useActor } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import { format, parseISO, eachDayOfInterval } from 'date-fns';

interface FinancialViewProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  clients: Client[];
  suppliers: Supplier[];
  transfers: Transfer[];
  company: CompanyProfile | null;
  period: DatePeriodFilter;
  range: DateRange;
  openCreateWith?: 'income' | 'expense' | null;
  onClearQuickAction?: () => void;
}

type TabType = 'all' | 'receivables' | 'payables' | 'cashflow' | 'accounts';

const today = () => format(new Date(), 'yyyy-MM-dd');

const statusInfo = (t: Transaction) =>
  t.status === 'paid'
    ? { label: t.type === 'income' ? 'Recebido' : 'Pago', variant: 'success' as const }
    : t.status === 'overdue'
    ? { label: 'Vencido', variant: 'danger' as const }
    : { label: 'Pendente', variant: 'warning' as const };

export function FinancialView({
  transactions,
  accounts,
  categories,
  clients,
  suppliers,
  transfers,
  company,
  period,
  range,
  openCreateWith,
  onClearQuickAction,
}: FinancialViewProps) {
  const { isAdmin } = useAuth();
  const actor = useActor();
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<TabType>(
    openCreateWith === 'expense' ? 'payables' : openCreateWith === 'income' ? 'receivables' : 'all'
  );

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'paid' | 'pending' | 'overdue'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [scope, setScope] = useState<'period' | 'all'>('period');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactionType, setTransactionType] = useState<TransactionType>('income');
  const [isSaving, setIsSaving] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [accountModal, setAccountModal] = useState<{ open: boolean; editing: Account | null }>({ open: false, editing: null });
  const [payingTransaction, setPayingTransaction] = useState<Transaction | null>(null);
  const [payDate, setPayDate] = useState(today());
  const [payAccountId, setPayAccountId] = useState('');

  // Exclusão
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [deleteGroup, setDeleteGroup] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);

  // Formulário de lançamento
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(today());
  const [formDueDate, setFormDueDate] = useState(today());
  const [formPaymentDate, setFormPaymentDate] = useState(today());
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod>('cash');
  const [formStatus, setFormStatus] = useState<'paid' | 'pending'>('paid');
  const [formEntityType, setFormEntityType] = useState<'client' | 'supplier' | 'none'>('none');
  const [formEntityId, setFormEntityId] = useState('');
  const [formAccountId, setFormAccountId] = useState('');
  const [formCostCenter, setFormCostCenter] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formReceiptUrl, setFormReceiptUrl] = useState('');
  const [isInstallments, setIsInstallments] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState(2);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');

  // Transferência
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDate, setTransferDate] = useState(today());
  const [transferNotes, setTransferNotes] = useState('');

  // Categoria
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<TransactionType>('expense');
  const [catColor, setCatColor] = useState('#3b82f6');
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  // Conta
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<Account['type']>('bank');
  const [accBank, setAccBank] = useState('');
  const [accBalance, setAccBalance] = useState('');
  const [accColor, setAccColor] = useState('#3b82f6');

  const defaultAccountId = accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || '';

  // Abre o formulário quando vem do botão "+ Novo"
  useEffect(() => {
    if (openCreateWith) openNewTransactionModal(openCreateWith);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openNewTransactionModal = (type: TransactionType) => {
    setEditingTransaction(null);
    setTransactionType(type);
    setFormDescription('');
    setFormAmount('');
    setFormDate(today());
    setFormDueDate(today());
    setFormPaymentDate(today());
    setFormCategoryId(categories.find((c) => c.type === type)?.id || '');
    setFormPaymentMethod('cash');
    setFormStatus('paid');
    setFormEntityType(type === 'income' ? 'client' : 'supplier');
    setFormEntityId('');
    setFormAccountId(defaultAccountId);
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
    setFormAmount(formatMoneyInput(t.amount));
    setFormDate(t.date || today());
    setFormDueDate(t.dueDate || today());
    setFormPaymentDate(t.paymentDate || t.dueDate || today());
    setFormCategoryId(t.categoryId);
    setFormPaymentMethod(t.paymentMethod);
    setFormStatus(t.status === 'paid' ? 'paid' : 'pending');
    setFormEntityType(t.entityType || 'none');
    setFormEntityId(t.entityId || '');
    setFormAccountId(t.accountId || defaultAccountId);
    setFormCostCenter(t.costCenter || '');
    setFormNotes(t.notes || '');
    setFormReceiptUrl(t.receiptUrl || '');
    setIsInstallments(false);
    setIsRecurring(Boolean(t.isRecurring));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    onClearQuickAction?.();
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseMoney(formAmount);
    if (!formDescription.trim() || val <= 0) {
      error('Preencha a descrição e um valor válido.');
      return;
    }
    if (!formCategoryId) {
      error('Escolha uma categoria.');
      return;
    }
    const categoryObj = categories.find((c) => c.id === formCategoryId);
    const accountObj = accounts.find((a) => a.id === formAccountId);
    const entityName =
      formEntityType === 'client'
        ? clients.find((c) => c.id === formEntityId)?.name
        : formEntityType === 'supplier'
        ? suppliers.find((s) => s.id === formEntityId)?.name
        : undefined;

    const payload = {
      description: formDescription.trim(),
      amount: val,
      type: transactionType,
      date: formDate,
      dueDate: formDueDate,
      paymentDate: formStatus === 'paid' ? formPaymentDate : undefined,
      categoryId: formCategoryId,
      categoryName: categoryObj?.name,
      paymentMethod: formPaymentMethod,
      status: formStatus,
      entityType: formEntityId ? formEntityType : 'none',
      entityId: formEntityId || undefined,
      entityName: formEntityId ? entityName : undefined,
      accountId: formAccountId,
      accountName: accountObj?.name,
      costCenter: formCostCenter,
      notes: formNotes,
      receiptUrl: formReceiptUrl,
    } as const;

    setIsSaving(true);
    try {
      if (editingTransaction) {
        if (formStatus === 'pending' && editingTransaction.status === 'paid') {
          await FirestoreService.markTransactionAsPending(editingTransaction, actor);
        }
        await FirestoreService.updateDocument<Transaction>('transactions', editingTransaction.id, payload, actor);
        success('Lançamento atualizado!');
      } else {
        const ids = await FirestoreService.createTransactionWithInstallments(
          {
            ...payload,
            isRecurring,
            recurrenceFrequency: isRecurring ? recurrenceFreq : undefined,
            installmentsCount: isInstallments ? installmentsCount : 1,
            frequency: 'monthly',
          },
          actor
        );
        success(
          isRecurring
            ? `Lançamento recorrente criado (${ids.length} ocorrências programadas).`
            : isInstallments
            ? `Lançamento criado em ${installmentsCount} parcelas.`
            : 'Lançamento registrado!'
        );
      }
      closeModal();
    } catch (err: any) {
      error('Erro ao salvar lançamento', err?.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openPayModal = (t: Transaction) => {
    setPayingTransaction(t);
    setPayDate(today());
    setPayAccountId(t.accountId || defaultAccountId);
  };

  const handleConfirmPay = async () => {
    if (!payingTransaction) return;
    try {
      await FirestoreService.markTransactionAsPaid(payingTransaction, payDate, payAccountId, actor);
      success(payingTransaction.type === 'income' ? 'Recebimento registrado!' : 'Pagamento registrado!');
      setPayingTransaction(null);
    } catch (err: any) {
      error('Erro ao dar baixa', err?.message);
    }
  };

  const handleUndoPay = async (t: Transaction) => {
    try {
      await FirestoreService.markTransactionAsPending(t, actor);
      success('Baixa estornada — o lançamento voltou para pendente.');
    } catch (err: any) {
      error('Erro ao estornar', err?.message);
    }
  };

  const groupSiblings = (t: Transaction | null) =>
    t?.parentTransactionId
      ? transactions.filter((x) => x.parentTransactionId === t.parentTransactionId && x.id !== t.id && x.status !== 'paid' && x.dueDate >= t.dueDate)
      : [];

  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      const extra = deleteGroup ? groupSiblings(deleting) : [];
      for (const t of [deleting, ...extra]) {
        await FirestoreService.deleteDocument('transactions', t.id, actor);
      }
      success(extra.length ? `${extra.length + 1} lançamentos excluídos.` : 'Lançamento excluído.');
      setDeleting(null);
    } catch (err: any) {
      error('Erro ao excluir', err?.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const openTransfer = () => {
    setFromAccount(accounts[0]?.id || '');
    setToAccount(accounts[1]?.id || '');
    setTransferAmount('');
    setTransferDate(today());
    setTransferNotes('');
    setIsTransferModalOpen(true);
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseMoney(transferAmount);
    if (fromAccount === toAccount) return error('A conta de origem e a de destino devem ser diferentes.');
    if (val <= 0) return error('Informe um valor válido.');
    try {
      await FirestoreService.transferBetweenAccounts(fromAccount, toAccount, val, transferDate, transferNotes, actor, {
        from: accounts.find((a) => a.id === fromAccount)?.name,
        to: accounts.find((a) => a.id === toAccount)?.name,
      });
      success('Transferência registrada!');
      setIsTransferModalOpen(false);
    } catch (err: any) {
      error('Erro na transferência', err?.message);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    try {
      await FirestoreService.createDocument('categories', { name: catName.trim(), type: catType, color: catColor } as any, actor);
      success('Categoria criada!');
      setCatName('');
    } catch (err: any) {
      error('Erro ao criar categoria', err?.message);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    try {
      await FirestoreService.deleteDocument('categories', deletingCategory.id, actor);
      success('Categoria excluída.');
    } catch (err: any) {
      error('Erro ao excluir categoria', err?.message);
    }
    setDeletingCategory(null);
  };

  const openAccountModal = (acc: Account | null) => {
    setAccName(acc?.name || '');
    setAccType(acc?.type || 'bank');
    setAccBank(acc?.bankName || '');
    setAccBalance(formatMoneyInput(acc?.initialBalance || 0));
    setAccColor(acc?.color || '#3b82f6');
    setAccountModal({ open: true, editing: acc });
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;
    const data = { name: accName.trim(), type: accType, bankName: accBank, initialBalance: parseMoney(accBalance), color: accColor };
    try {
      if (accountModal.editing) {
        // a conta padrão pode ainda não existir no banco (antes do primeiro acesso do admin)
        await FirestoreService.createDocument('accounts', { ...accountModal.editing, ...data, currentBalance: 0 } as any, actor);
        success('Conta atualizada!');
      } else {
        await FirestoreService.createDocument('accounts', { ...data, currentBalance: 0 } as any, actor);
        success('Conta cadastrada!');
      }
      setAccountModal({ open: false, editing: null });
    } catch (err: any) {
      error('Erro ao salvar conta', err?.message);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletingAccount) return;
    const used = transactions.some((t) => t.accountId === deletingAccount.id) || transfers.some((t) => t.fromAccountId === deletingAccount.id || t.toAccountId === deletingAccount.id);
    if (used) {
      error('Esta conta tem lançamentos', 'Mova ou exclua os lançamentos antes de excluir a conta.');
      setDeletingAccount(null);
      return;
    }
    try {
      await FirestoreService.deleteDocument('accounts', deletingAccount.id, actor);
      success('Conta excluída.');
    } catch (err: any) {
      error('Erro ao excluir conta', err?.message);
    }
    setDeletingAccount(null);
  };

  /* ================= LISTAGEM ================= */
  const filteredTransactions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return transactions.filter((t) => {
      if (activeTab === 'receivables' && t.type !== 'income') return false;
      if (activeTab === 'payables' && t.type !== 'expense') return false;
      if (scope === 'period' && !inRange(cashDate(t), range)) return false;
      if (statusFilter === 'open' && t.status === 'paid') return false;
      if (statusFilter !== 'all' && statusFilter !== 'open' && t.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false;
      if (accountFilter !== 'all' && t.accountId !== accountFilter) return false;
      if (q) {
        const hay = `${t.description} ${t.entityName || ''} ${t.categoryName || ''} ${t.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, activeTab, scope, range, statusFilter, categoryFilter, accountFilter, searchTerm]);

  const totals = useMemo(() => {
    const inc = filteredTransactions.filter((t) => t.type === 'income');
    const exp = filteredTransactions.filter((t) => t.type === 'expense');
    const s = (l: Transaction[]) => l.reduce((a, t) => a + t.amount, 0);
    return {
      income: s(inc),
      expense: s(exp),
      incomePaid: s(inc.filter((t) => t.status === 'paid')),
      expensePaid: s(exp.filter((t) => t.status === 'paid')),
    };
  }, [filteredTransactions]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginated = filteredTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const accountName = (id?: string) => accounts.find((a) => a.id === id)?.name || '-';

  /* ================= FLUXO DE CAIXA ================= */
  const cashflow = useMemo(() => {
    const paid = transactions.filter((t) => t.status === 'paid');
    const initial = accounts.reduce((s, a) => s + (a.initialBalance || 0), 0);
    const before = paid
      .filter((t) => cashDate(t) < range.start)
      .reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
    let running = initial + before;
    const end = range.end > today() ? today() : range.end;
    if (end < range.start) return { opening: running, days: [] as any[] };
    const days = eachDayOfInterval({ start: parseISO(range.start), end: parseISO(end) }).map((d) => {
      const key = format(d, 'yyyy-MM-dd');
      const items = paid.filter((t) => cashDate(t) === key);
      const income = items.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = items.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      running += income - expense;
      return { date: key, income, expense, net: income - expense, balance: running, count: items.length };
    });
    return { opening: initial + before, days };
  }, [transactions, accounts, range]);

  const exportList = () =>
    ExportService.exportToCSV(
      `Lancamentos_${format(new Date(), 'yyyyMMdd')}`,
      filteredTransactions.map((t) => ({
        Emissao: formatDate(t.date),
        Vencimento: formatDate(t.dueDate),
        Pagamento: t.paymentDate ? formatDate(t.paymentDate) : '',
        Descricao: t.description,
        Tipo: t.type === 'income' ? 'Entrada' : 'Saída',
        Valor_Gs: t.amount,
        Situacao: statusInfo(t).label,
        Categoria: t.categoryName || '',
        Forma_Pagamento: paymentMethodLabel(t.paymentMethod),
        Conta: accountName(t.accountId),
        Cliente_Fornecedor: t.entityName || '',
        Centro_de_Custo: t.costCenter || '',
      }))
    );

  const listTitle =
    activeTab === 'receivables' ? 'Contas a receber' : activeTab === 'payables' ? 'Contas a pagar' : 'Lançamentos financeiros';
  const scopeLabel = scope === 'period' ? periodLabel(period, range) : 'Todos os períodos';

  const tabBtn = (id: TabType, label: React.ReactNode, active: string) => (
    <button
      onClick={() => {
        setActiveTab(id);
        setCurrentPage(1);
      }}
      className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
        activeTab === id ? `bg-white dark:bg-slate-700 ${active} shadow-xs` : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
      }`}
    >
      {label}
    </button>
  );

  const entityOptions = formEntityType === 'client' ? clients : formEntityType === 'supplier' ? suppliers : [];

  return (
    <div className="space-y-6">
      {/* Abas + ações */}
      <div className="flex flex-col 2xl:flex-row items-stretch 2xl:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-x-auto">
          {tabBtn('all', 'Todos os lançamentos', 'text-blue-600 dark:text-white')}
          {tabBtn('receivables', <><ArrowUpRight className="w-3.5 h-3.5" />A receber / Entradas</>, 'text-emerald-600 dark:text-emerald-400')}
          {tabBtn('payables', <><ArrowDownRight className="w-3.5 h-3.5" />A pagar / Saídas</>, 'text-rose-600 dark:text-rose-400')}
          {tabBtn('cashflow', <><Layers className="w-3.5 h-3.5" />Fluxo de caixa</>, 'text-indigo-600 dark:text-indigo-400')}
          {tabBtn('accounts', <><Wallet className="w-3.5 h-3.5" />Contas & caixas</>, 'text-amber-600 dark:text-amber-400')}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={openTransfer} className={`${btnSecondary} text-xs flex items-center gap-1.5`}>
            <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500" />
            Transferência
          </button>
          <button onClick={() => openNewTransactionModal('income')} className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm">
            <Plus className="w-3.5 h-3.5" />
            Nova entrada
          </button>
          <button onClick={() => openNewTransactionModal('expense')} className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm">
            <Plus className="w-3.5 h-3.5" />
            Nova saída
          </button>
        </div>
      </div>

      {/* LISTAGEM */}
      {(activeTab === 'all' || activeTab === 'receivables' || activeTab === 'payables') && (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/20">
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar descrição, cliente, fornecedor..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className={`${inputSmCls} w-full pl-9 text-xs`}
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              <select value={scope} onChange={(e) => { setScope(e.target.value as any); setCurrentPage(1); }} className={inputSmCls} title="Período">
                <option value="period">Período do topo</option>
                <option value="all">Todos os períodos</option>
              </select>
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setCurrentPage(1); }} className={inputSmCls}>
                <option value="all">Todas as situações</option>
                <option value="open">Em aberto (pendente + vencido)</option>
                <option value="paid">Pago / recebido</option>
                <option value="pending">Pendente</option>
                <option value="overdue">Vencido</option>
              </select>
              <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }} className={inputSmCls}>
                <option value="all">Todas as categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select value={accountFilter} onChange={(e) => { setAccountFilter(e.target.value); setCurrentPage(1); }} className={inputSmCls}>
                <option value="all">Todas as contas</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <button onClick={() => printTransactionList(listTitle, scopeLabel, filteredTransactions, company)} title="Imprimir lista" className={`${btnIcon} border border-slate-200 dark:border-slate-700`}>
                <Printer className="w-4 h-4" />
              </button>
              <button onClick={exportList} title="Exportar para Excel (CSV)" className={`${btnIcon} border border-slate-200 dark:border-slate-700`}>
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Totais do filtro */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-100 dark:bg-slate-800 text-xs">
            {activeTab !== 'payables' && (
              <div className="bg-white dark:bg-slate-900 px-4 py-2.5">
                <span className="text-slate-500">Entradas</span>
                <p className="font-bold font-mono text-emerald-600">{formatCurrency(totals.income)}</p>
                <span className="text-[10px] text-slate-400">recebido {formatCurrency(totals.incomePaid)}</span>
              </div>
            )}
            {activeTab !== 'receivables' && (
              <div className="bg-white dark:bg-slate-900 px-4 py-2.5">
                <span className="text-slate-500">Saídas</span>
                <p className="font-bold font-mono text-rose-600">{formatCurrency(totals.expense)}</p>
                <span className="text-[10px] text-slate-400">pago {formatCurrency(totals.expensePaid)}</span>
              </div>
            )}
            {activeTab === 'all' && (
              <div className="bg-white dark:bg-slate-900 px-4 py-2.5">
                <span className="text-slate-500">Resultado</span>
                <p className={`font-bold font-mono ${totals.income - totals.expense >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                  {formatCurrency(totals.income - totals.expense)}
                </p>
                <span className="text-[10px] text-slate-400">realizado {formatCurrency(totals.incomePaid - totals.expensePaid)}</span>
              </div>
            )}
            <div className="bg-white dark:bg-slate-900 px-4 py-2.5">
              <span className="text-slate-500">Lançamentos</span>
              <p className="font-bold font-mono text-slate-800 dark:text-slate-200">{filteredTransactions.length}</p>
              <span className="text-[10px] text-slate-400 truncate block">{scopeLabel}</span>
            </div>
          </div>

          {paginated.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Vencimento</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4">Categoria / Conta</th>
                    <th className="py-3 px-4">Vinculado</th>
                    <th className="py-3 px-4">Situação</th>
                    <th className="py-3 px-4 text-right">Valor</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {paginated.map((t) => {
                    const st = statusInfo(t);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className={`font-medium ${t.status === 'overdue' ? 'text-rose-600' : 'text-slate-900 dark:text-slate-100'}`}>{formatDate(t.dueDate)}</div>
                          <div className="text-[11px] text-slate-400">
                            {t.status === 'paid' ? `Pago em ${formatDate(t.paymentDate)}` : `Emissão ${formatDate(t.date)}`}
                          </div>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">{t.description}</div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                            <span>{paymentMethodLabel(t.paymentMethod)}</span>
                            {t.installmentNumber && (
                              <span className="px-1.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded font-mono">
                                {t.installmentNumber}/{t.totalInstallments}
                              </span>
                            )}
                            {t.isRecurring && (
                              <span className="flex items-center gap-0.5 text-purple-600">
                                <Repeat className="w-2.5 h-2.5" /> Recorrente
                              </span>
                            )}
                            {t.receiptUrl && (
                              <a href={t.receiptUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-0.5">
                                <FileText className="w-2.5 h-2.5" /> comprovante
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="text-slate-700 dark:text-slate-300 font-medium">{t.categoryName || '-'}</div>
                          <div className="text-[11px] text-slate-400">{accountName(t.accountId)}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300">{t.entityName || '-'}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <Badge variant={st.variant} dot>
                            {st.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className={`font-bold font-mono text-sm ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {t.status !== 'paid' ? (
                              <button onClick={() => openPayModal(t)} title={t.type === 'income' ? 'Receber' : 'Pagar'} className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100">
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button onClick={() => handleUndoPay(t)} title="Estornar baixa (voltar para pendente)" className={btnIcon}>
                                <Undo2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {t.status === 'paid' && (
                              <button onClick={() => printReceipt(t, company)} title="Imprimir recibo" className={`${btnIcon} hover:text-blue-600`}>
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => openEditTransactionModal(t)} title="Editar" className={btnIcon}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setDeleting(t);
                                  setDeleteGroup(false);
                                }}
                                title="Excluir"
                                className={`${btnIcon} hover:text-rose-600`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Nenhum lançamento encontrado"
              description={scope === 'period' ? 'Nada neste período. Troque o período no topo ou escolha "Todos os períodos".' : 'Ajuste os filtros ou crie um novo lançamento.'}
              actionText="Novo lançamento"
              onAction={() => openNewTransactionModal(activeTab === 'payables' ? 'expense' : 'income')}
            />
          )}

          <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filteredTransactions.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
        </div>
      )}

      {/* FLUXO DE CAIXA */}
      {activeTab === 'cashflow' && (
        <div className={`${cardCls} p-6 space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Fluxo de caixa diário</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {periodLabel(period, range)} · saldo inicial do período: <strong>{formatCurrency(cashflow.opening)}</strong>
              </p>
            </div>
            <button
              onClick={() =>
                ExportService.exportToCSV(
                  `Fluxo_de_Caixa_${format(new Date(), 'yyyyMMdd')}`,
                  cashflow.days.map((d) => ({ Data: formatDate(d.date), Entradas: d.income, Saidas: d.expense, Resultado: d.net, Saldo: d.balance }))
                )
              }
              className={`${btnSecondary} text-xs flex items-center gap-1.5`}
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
                  <th className="py-3 px-4 text-right">Entradas</th>
                  <th className="py-3 px-4 text-right">Saídas</th>
                  <th className="py-3 px-4 text-right">Resultado do dia</th>
                  <th className="py-3 px-4 text-right">Saldo acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {cashflow.days.filter((d) => d.count > 0).length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">Nenhuma movimentação paga no período.</td>
                  </tr>
                )}
                {[...cashflow.days].reverse().filter((d) => d.count > 0).map((day) => (
                  <tr key={day.date} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">{formatDate(day.date, "dd/MM/yyyy (EEE)")}</td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600">+ {formatCurrency(day.income)}</td>
                    <td className="py-3 px-4 text-right font-mono text-rose-600">- {formatCurrency(day.expense)}</td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${day.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(day.net)}</td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${day.balance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'}`}>{formatCurrency(day.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTAS */}
      {activeTab === 'accounts' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Contas bancárias e caixas</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Saldo = saldo inicial + recebimentos − pagamentos ± transferências. Total: <strong>{formatCurrency(accounts.reduce((s, a) => s + a.currentBalance, 0))}</strong>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsCategoryModalOpen(true)} className={`${btnSecondary} text-xs flex items-center gap-1.5`}>
                <Tag className="w-3.5 h-3.5 text-purple-500" />
                Categorias ({categories.length})
              </button>
              {isAdmin && (
                <button onClick={() => openAccountModal(null)} className={`${btnPrimary} text-xs flex items-center gap-1.5`}>
                  <Plus className="w-3.5 h-3.5" />
                  Nova conta
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <div key={acc.id} className={`${cardCls} p-5 relative overflow-hidden`}>
                <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: acc.color || '#3b82f6' }} />
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {acc.type === 'cash' ? 'Caixa / efetivo' : acc.type === 'bank' ? 'Conta bancária' : 'Outro'}
                      {acc.bankName ? ` · ${acc.bankName}` : ''}
                    </span>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1">{acc.name}</h4>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => openAccountModal(acc)} className={btnIcon} title="Editar conta">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeletingAccount(acc)} className={`${btnIcon} hover:text-rose-600`} title="Excluir conta">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500">Saldo atual</span>
                  <p className={`text-xl font-bold font-mono mt-0.5 ${acc.currentBalance < 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>{formatCurrency(acc.currentBalance)}</p>
                  <span className="text-[10px] text-slate-400">Saldo inicial: {formatCurrency(acc.initialBalance)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className={`${cardCls} p-5`}>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-3">Transferências entre contas</h4>
            {transfers.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhuma transferência registrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <th className="py-2 px-2">Data</th>
                      <th className="py-2 px-2">De</th>
                      <th className="py-2 px-2">Para</th>
                      <th className="py-2 px-2">Obs.</th>
                      <th className="py-2 px-2 text-right">Valor</th>
                      {isAdmin && <th />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {[...transfers].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map((tr) => (
                      <tr key={tr.id}>
                        <td className="py-2 px-2">{formatDate(tr.date)}</td>
                        <td className="py-2 px-2">{accountName(tr.fromAccountId)}</td>
                        <td className="py-2 px-2">{accountName(tr.toAccountId)}</td>
                        <td className="py-2 px-2 text-slate-500">{tr.notes || '-'}</td>
                        <td className="py-2 px-2 text-right font-mono font-semibold">{formatCurrency(tr.amount)}</td>
                        {isAdmin && (
                          <td className="py-2 px-2 text-right">
                            <button
                              className={`${btnIcon} hover:text-rose-600`}
                              title="Excluir transferência"
                              onClick={async () => {
                                await FirestoreService.deleteDocument('transfers', tr.id, actor);
                                success('Transferência excluída.');
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: LANÇAMENTO */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingTransaction ? 'Editar lançamento' : transactionType === 'income' ? 'Nova entrada (receita)' : 'Nova saída (despesa)'}
        subtitle="Valores em guaranis (Gs.)"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveTransaction} className="space-y-4 text-xs">
          {!editingTransaction && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              {(['income', 'expense'] as const).map((tp) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => {
                    setTransactionType(tp);
                    setFormCategoryId(categories.find((c) => c.type === tp)?.id || '');
                    setFormEntityType(tp === 'income' ? 'client' : 'supplier');
                    setFormEntityId('');
                  }}
                  className={`py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                    transactionType === tp ? (tp === 'income' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white') : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tp === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  {tp === 'income' ? 'Entrada (receita)' : 'Saída (despesa)'}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className={labelCls}>Descrição *</label>
              <input type="text" required placeholder="Ex.: Venda balcão, Aluguel, Conta da ANDE..." value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>{isInstallments ? 'Valor total *' : 'Valor *'}</label>
              <MoneyInput required value={formAmount} onChange={setFormAmount} className={`${inputCls} font-mono font-bold`} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className={labelCls}>Situação *</label>
              <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as any)} className={inputCls}>
                <option value="paid">{transactionType === 'income' ? 'Já recebido' : 'Já pago'}</option>
                <option value="pending">{transactionType === 'income' ? 'A receber' : 'A pagar'}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Vencimento *</label>
              <input type="date" required value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} className={inputCls} />
            </div>
            {formStatus === 'paid' ? (
              <div className="space-y-1">
                <label className={labelCls}>Data do {transactionType === 'income' ? 'recebimento' : 'pagamento'}</label>
                <input type="date" value={formPaymentDate} onChange={(e) => setFormPaymentDate(e.target.value)} className={inputCls} />
              </div>
            ) : (
              <div className="space-y-1">
                <label className={labelCls}>Data de emissão</label>
                <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className={inputCls} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className={labelCls}>Categoria *</label>
              <select value={formCategoryId} onChange={(e) => setFormCategoryId(e.target.value)} className={inputCls}>
                <option value="">Selecione</option>
                {categories.filter((c) => c.type === transactionType).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Forma de pagamento</label>
              <select value={formPaymentMethod} onChange={(e) => setFormPaymentMethod(e.target.value as PaymentMethod)} className={inputCls}>
                {PAYMENT_METHODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Conta / caixa *</label>
              <select value={formAccountId} onChange={(e) => setFormAccountId(e.target.value)} className={inputCls}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatCurrency(a.currentBalance)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelCls}>Vincular a</label>
              <div className="flex items-center gap-2">
                <select
                  value={formEntityType}
                  onChange={(e) => {
                    setFormEntityType(e.target.value as any);
                    setFormEntityId('');
                  }}
                  className={`${inputCls} !w-32`}
                >
                  <option value="none">Nenhum</option>
                  <option value="client">Cliente</option>
                  <option value="supplier">Fornecedor</option>
                </select>
                {formEntityType !== 'none' && (
                  <select value={formEntityId} onChange={(e) => setFormEntityId(e.target.value)} className={`${inputCls} flex-1`}>
                    <option value="">{formEntityType === 'client' ? 'Selecione o cliente' : 'Selecione o fornecedor'}</option>
                    {entityOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Centro de custo</label>
              <input type="text" placeholder="Ex.: Loja, Escritório, Veículo..." value={formCostCenter} onChange={(e) => setFormCostCenter(e.target.value)} className={inputCls} />
            </div>
          </div>

          {!editingTransaction && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={isInstallments}
                    onChange={(e) => {
                      setIsInstallments(e.target.checked);
                      if (e.target.checked) setIsRecurring(false);
                    }}
                  />
                  <span>Parcelar</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => {
                      setIsRecurring(e.target.checked);
                      if (e.target.checked) setIsInstallments(false);
                    }}
                  />
                  <span>Recorrente (aluguel, salário, internet...)</span>
                </label>
              </div>
              {isInstallments && (
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-400">Parcelas mensais:</span>
                  <select value={installmentsCount} onChange={(e) => setInstallmentsCount(Number(e.target.value))} className={inputSmCls}>
                    {[2, 3, 4, 5, 6, 8, 10, 12, 18, 24, 36].map((n) => (
                      <option key={n} value={n}>
                        {n}x
                      </option>
                    ))}
                  </select>
                  {parseMoney(formAmount) > 0 && <span className="text-slate-500 font-mono">≈ {formatCurrency(Math.floor(parseMoney(formAmount) / installmentsCount))} por parcela</span>}
                  <span className="text-[11px] text-slate-400 w-full">A 1ª parcela fica com a situação escolhida acima; as demais ficam a {transactionType === 'income' ? 'receber' : 'pagar'}.</span>
                </div>
              )}
              {isRecurring && (
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-400">Repetir:</span>
                  <select value={recurrenceFreq} onChange={(e) => setRecurrenceFreq(e.target.value as any)} className={inputSmCls}>
                    <option value="monthly">Todo mês (12 meses)</option>
                    <option value="weekly">Toda semana (12 semanas)</option>
                    <option value="yearly">Todo ano (3 anos)</option>
                  </select>
                  <span className="text-[11px] text-slate-400 w-full">O valor cheio é repetido em cada ocorrência; as futuras ficam pendentes.</span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelCls}>Observações</label>
              <input type="text" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Link do comprovante (opcional)</label>
              <input type="url" placeholder="https://drive.google.com/..." value={formReceiptUrl} onChange={(e) => setFormReceiptUrl(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button type="button" onClick={closeModal} className={btnSecondary}>
              Cancelar
            </button>
            <button type="submit" disabled={isSaving} className={btnPrimary}>
              {isSaving ? 'Salvando...' : 'Salvar lançamento'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: DAR BAIXA */}
      <Modal
        isOpen={Boolean(payingTransaction)}
        onClose={() => setPayingTransaction(null)}
        title={payingTransaction?.type === 'income' ? 'Registrar recebimento' : 'Registrar pagamento'}
        subtitle={payingTransaction ? `${payingTransaction.description} — ${formatCurrency(payingTransaction.amount)}` : ''}
        maxWidth="md"
      >
        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className={labelCls}>Data</label>
            <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Conta / caixa</label>
            <select value={payAccountId} onChange={(e) => setPayAccountId(e.target.value)} className={inputCls}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button onClick={() => setPayingTransaction(null)} className={btnSecondary}>
              Cancelar
            </button>
            <button onClick={handleConfirmPay} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              Confirmar
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: TRANSFERÊNCIA */}
      <Modal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} title="Transferência entre contas" subtitle="Ex.: depósito do caixa no banco" maxWidth="md">
        <form onSubmit={handleExecuteTransfer} className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className={labelCls}>De (sai o valor)</label>
            <select value={fromAccount} onChange={(e) => setFromAccount(e.target.value)} className={inputCls}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (saldo {formatCurrency(a.currentBalance)})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Para (entra o valor)</label>
            <select value={toAccount} onChange={(e) => setToAccount(e.target.value)} className={inputCls}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (saldo {formatCurrency(a.currentBalance)})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelCls}>Valor *</label>
              <MoneyInput required value={transferAmount} onChange={setTransferAmount} className={`${inputCls} font-mono font-bold`} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Data</label>
              <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Observação</label>
            <input type="text" value={transferNotes} onChange={(e) => setTransferNotes(e.target.value)} className={inputCls} />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button type="button" onClick={() => setIsTransferModalOpen(false)} className={btnSecondary}>
              Cancelar
            </button>
            <button type="submit" className={btnPrimary}>
              Confirmar transferência
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CATEGORIAS */}
      <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title="Categorias" subtitle="Organize suas entradas e saídas" maxWidth="md">
        <div className="space-y-4 text-xs">
          <form onSubmit={handleCreateCategory} className="space-y-3 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-2 gap-2">
              <input type="text" required placeholder="Nome da categoria" value={catName} onChange={(e) => setCatName(e.target.value)} className={inputSmCls} />
              <select value={catType} onChange={(e) => setCatType(e.target.value as any)} className={inputSmCls}>
                <option value="expense">Saída (despesa)</option>
                <option value="income">Entrada (receita)</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                Cor: <input type="color" value={catColor} onChange={(e) => setCatColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
              </label>
              <button type="submit" className={`${btnPrimary} text-xs`}>
                Adicionar
              </button>
            </div>
          </form>
          <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
            {categories.map((c) => (
              <div key={c.id} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="font-medium text-slate-800 dark:text-slate-200">{c.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.type === 'income' ? 'success' : 'danger'}>{c.type === 'income' ? 'Entrada' : 'Saída'}</Badge>
                  {isAdmin && (
                    <button onClick={() => setDeletingCategory(c)} className={`${btnIcon} hover:text-rose-600`} title="Excluir categoria">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* MODAL: CONTA */}
      <Modal
        isOpen={accountModal.open}
        onClose={() => setAccountModal({ open: false, editing: null })}
        title={accountModal.editing ? 'Editar conta' : 'Nova conta / caixa'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveAccount} className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className={labelCls}>Nome *</label>
            <input type="text" required placeholder="Ex.: Banco Continental, ueno, Caixa da loja..." value={accName} onChange={(e) => setAccName(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelCls}>Tipo</label>
              <select value={accType} onChange={(e) => setAccType(e.target.value as any)} className={inputCls}>
                <option value="bank">Conta bancária</option>
                <option value="cash">Caixa / efetivo</option>
                <option value="other">Outro</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Banco</label>
              <input type="text" value={accBank} onChange={(e) => setAccBank(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelCls}>Saldo inicial</label>
              <MoneyInput value={accBalance} onChange={setAccBalance} className={`${inputCls} font-mono`} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Cor</label>
              <input type="color" value={accColor} onChange={(e) => setAccColor(e.target.value)} className="w-full h-9 rounded-xl cursor-pointer border border-slate-200 dark:border-slate-700 bg-transparent" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">O saldo inicial é o dinheiro que já existia na conta antes de começar a usar o sistema.</p>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button type="button" onClick={() => setAccountModal({ open: false, editing: null })} className={btnSecondary}>
              Cancelar
            </button>
            <button type="submit" className={btnPrimary}>
              Salvar
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Excluir lançamento"
        message={
          groupSiblings(deleting).length
            ? `Excluir "${deleting?.description}"? Marque abaixo para excluir também as ${groupSiblings(deleting).length} parcelas/ocorrências seguintes ainda em aberto.`
            : `Excluir "${deleting?.description}"? Essa ação não pode ser desfeita.`
        }
        loading={isDeleting}
      >
        {groupSiblings(deleting).length > 0 && (
          <label className="flex items-center gap-2 text-xs mt-3 cursor-pointer">
            <input type="checkbox" checked={deleteGroup} onChange={(e) => setDeleteGroup(e.target.checked)} />
            Excluir também as {groupSiblings(deleting).length} seguintes em aberto
          </label>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        isOpen={Boolean(deletingCategory)}
        onClose={() => setDeletingCategory(null)}
        onConfirm={handleDeleteCategory}
        title="Excluir categoria"
        message={`Excluir a categoria "${deletingCategory?.name}"? Os lançamentos antigos continuam com o nome dela.`}
      />
      <ConfirmDialog
        isOpen={Boolean(deletingAccount)}
        onClose={() => setDeletingAccount(null)}
        onConfirm={handleDeleteAccount}
        title="Excluir conta"
        message={`Excluir a conta "${deletingAccount?.name}"? Só é possível se ela não tiver lançamentos nem transferências.`}
      />
    </div>
  );
}
