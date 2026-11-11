import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Printer,
  MessageCircle,
  Download,
  Trash2,
  DollarSign,
  Package,
  Calendar,
  AlertCircle,
  Sparkles,
  ShoppingBag,
  Edit2,
} from 'lucide-react';
import type {
  Proposal,
  ProposalItem,
  ProposalStatus,
  Client,
  Product,
  Account,
  CompanyProfile,
  Transaction,
  Category,
} from '../../../types';
import { formatCurrency, formatDate, formatMoneyInput, parseMoney, whatsappLink, PAYMENT_METHODS, formatAddress } from '../../../utils/formatters';
import { MoneyInput } from '../../common/MoneyInput';
import { printProposal } from '../../../services/printDocuments';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { EmptyState } from '../../common/EmptyState';
import { Pagination } from '../../common/Pagination';
import { FirestoreService } from '../../../services/firestoreService';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import { addDays, format } from 'date-fns';

interface ProposalsViewProps {
  proposals: Proposal[];
  clients: Client[];
  products: Product[];
  accounts: Account[];
  categories: Category[];
  company?: CompanyProfile | null;
  openCreateProposal?: boolean;
  onClearQuickAction?: () => void;
}

export function ProposalsView({
  proposals,
  clients,
  products,
  accounts,
  categories,
  company,
  openCreateProposal = false,
  onClearQuickAction,
}: ProposalsViewProps) {
  const { profile, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProposalStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  React.useEffect(() => {
    if (openCreateProposal) openNewModal();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);

  // Convert to sale modal
  const [convertingProposal, setConvertingProposal] = useState<Proposal | null>(null);
  const [salePaymentMethod, setSalePaymentMethod] = useState<Transaction['paymentMethod']>('bank_transfer');
  const [saleReceivedNow, setSaleReceivedNow] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [saleAccountId, setSaleAccountId] = useState(accounts[0]?.id || '');
  const [saleInstallments, setSaleInstallments] = useState<number>(1);
  const [saleFirstDue, setSaleFirstDue] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Form Fields
  const [formClientId, setFormClientId] = useState('');
  const [formValidUntil, setFormValidUntil] = useState(format(addDays(new Date(), 15), 'yyyy-MM-dd'));
  const [formPaymentConditions, setFormPaymentConditions] = useState('À vista ou em até 3x');
  const [formDiscount, setFormDiscount] = useState<string>('0');
  const [formShipping, setFormShipping] = useState<string>('0');
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<ProposalStatus>('draft');

  // Proposal Items
  const [items, setItems] = useState<ProposalItem[]>([
    {
      productId: '',
      productName: '',
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      totalPrice: 0,
    },
  ]);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Subtotal calculation
  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => acc + (item.totalPrice || 0), 0);
  }, [items]);

  const totalCalculated = useMemo(() => {
    return Math.max(0, subtotal - parseMoney(formDiscount) + parseMoney(formShipping));
  }, [subtotal, formDiscount, formShipping]);

  const openNewModal = () => {
    setEditingProposal(null);
    setFormClientId(clients[0]?.id || '');
    setFormValidUntil(format(addDays(new Date(), 15), 'yyyy-MM-dd'));
    setFormPaymentConditions('À vista ou em até 3x');
    setFormDiscount('');
    setFormShipping('');
    setFormNotes('');
    setFormStatus('draft');
    setItems([
      {
        productId: products[0]?.id || '',
        productName: products[0]?.name || '',
        quantity: 1,
        unitPrice: products[0]?.salePrice || 0,
        discount: 0,
        totalPrice: products[0]?.salePrice || 0,
      },
    ]);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Proposal) => {
    setEditingProposal(p);
    setFormClientId(p.clientId);
    setFormValidUntil(p.validUntil || format(addDays(new Date(), 15), 'yyyy-MM-dd'));
    setFormPaymentConditions(p.paymentConditions || '');
    setFormDiscount(formatMoneyInput(p.discount));
    setFormShipping(formatMoneyInput(p.shipping));
    setFormNotes(p.notes || '');
    setFormStatus(p.status);
    setItems(p.items?.length ? p.items.map((i) => ({ ...i })) : []);
    setIsModalOpen(true);
  };

  const recalc = (it: ProposalItem): ProposalItem => ({
    ...it,
    totalPrice: Math.max(0, Math.round(it.quantity * it.unitPrice - (it.discount || 0))),
  });

  const handleItemProductChange = (index: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    setItems(items.map((it, i) => (i === index ? recalc({ ...it, productId, productName: prod?.name || '', unitPrice: prod?.salePrice || 0, costPrice: prod?.costPrice }) : it)));
  };

  const handleItemQuantityChange = (index: number, qty: number) => {
    setItems(items.map((it, i) => (i === index ? recalc({ ...it, quantity: Math.max(1, qty || 1) }) : it)));
  };

  const handleItemPriceChange = (index: number, price: number) => {
    setItems(items.map((it, i) => (i === index ? recalc({ ...it, unitPrice: Math.max(0, price || 0) }) : it)));
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        productId: products[0]?.id || '',
        productName: products[0]?.name || '',
        quantity: 1,
        unitPrice: products[0]?.salePrice || 0,
        discount: 0,
        totalPrice: products[0]?.salePrice || 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSaveProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find((c) => c.id === formClientId);
    if (!client) {
      error('Selecione um cliente para o orçamento.');
      return;
    }

    const validItems = items.filter((i) => i.productId || i.productName);
    if (!validItems.length) {
      error('Adicione pelo menos um item ao orçamento.');
      return;
    }
    const disc = parseMoney(formDiscount);
    const ship = parseMoney(formShipping);
    const nextNumber = await FirestoreService.nextProposalNumber(proposals);

    try {
      if (editingProposal) {
        await FirestoreService.updateDocument<Proposal>(
          'proposals',
          editingProposal.id,
          {
            clientId: client.id,
            clientName: client.name,
            clientDocument: client.document,
            clientPhone: client.whatsapp || client.phone,
            clientEmail: client.email,
            validUntil: formValidUntil,
            status: formStatus,
            items: validItems,
            subtotal,
            clientAddress: formatAddress(client),
            discount: disc,
            shipping: ship,
            total: totalCalculated,
            paymentConditions: formPaymentConditions,
            notes: formNotes,
          },
          profile ? { uid: profile.uid, name: profile.name } : undefined
        );
        success('Orçamento atualizado!');
      } else {
        await FirestoreService.createDocument<Proposal>(
          'proposals',
          {
            number: nextNumber,
            clientId: client.id,
            clientName: client.name,
            clientDocument: client.document,
            clientPhone: client.whatsapp || client.phone,
            clientEmail: client.email,
            date: format(new Date(), 'yyyy-MM-dd'),
            validUntil: formValidUntil,
            status: formStatus,
            items: validItems,
            subtotal,
            clientAddress: formatAddress(client),
            discount: disc,
            shipping: ship,
            total: totalCalculated,
            paymentConditions: formPaymentConditions,
            notes: formNotes,
            convertedToSale: false,
          } as any,
          profile ? { uid: profile.uid, name: profile.name } : undefined
        );
        success(`Orçamento #${nextNumber} criado com sucesso!`);
      }

      setIsModalOpen(false);
      onClearQuickAction?.();
    } catch (err: any) {
      error('Erro ao salvar orçamento', err?.message);
    }
  };

  // Convert to sale logic: Aprovado vira Venda -> Baixa estoque e gera conta a receber
  const handleExecuteConvertToSale = async () => {
    if (!convertingProposal || isConverting) return;
    setIsConverting(true);
    try {
      const salesCat = categories.find((c) => c.id === 'cat_vendas') || categories.find((c) => c.type === 'income');
      await FirestoreService.convertProposalToSale(
        convertingProposal,
        salePaymentMethod,
        saleAccountId,
        saleInstallments,
        saleFirstDue,
        profile ? { uid: profile.uid, name: profile.name } : undefined,
        {
          receivedNow: saleReceivedNow,
          categoryId: salesCat?.id,
          categoryName: salesCat?.name,
          accountName: accounts.find((a) => a.id === saleAccountId)?.name,
        }
      );
      success(saleReceivedNow ? 'Venda concluída e recebimento lançado no Financeiro!' : 'Venda concluída! Estoque baixado e conta a receber gerada.');
      setConvertingProposal(null);
    } catch (err: any) {
      error('Erro ao concluir a venda', err?.message);
    } finally {
      setIsConverting(false);
    }
  };

  // Send WhatsApp message
  const handleSendWhatsApp = (p: Proposal) => {
    const client = clients.find((c) => c.id === p.clientId);
    const itemsText = p.items.map((i) => `• ${i.quantity}x ${i.productName} — ${formatCurrency(i.totalPrice)}`).join('\n');
    const link = whatsappLink(
      client?.whatsapp || client?.phone || p.clientPhone,
      `Olá ${p.clientName}! Segue o orçamento Nº ${p.number}:\n\n${itemsText}\n\n*Total: ${formatCurrency(p.total)}*\nVálido até ${formatDate(p.validUntil)}.\n${p.paymentConditions ? `Pagamento: ${p.paymentConditions}\n` : ''}\nQualquer dúvida estamos à disposição!`
    );
    if (!link) {
      error('O cliente não tem telefone/WhatsApp cadastrado.');
      return;
    }
    window.open(link, '_blank');
  };

  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchNum = p.number?.includes(query);
        const matchClient = p.clientName?.toLowerCase().includes(query);
        if (!matchNum && !matchClient) return false;
      }
      return true;
    });
  }, [proposals, statusFilter, searchTerm]);

  const totalPages = Math.ceil(filteredProposals.length / itemsPerPage);
  const paginatedProposals = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProposals.slice(start, start + itemsPerPage);
  }, [filteredProposals, currentPage]);

  const statusBadges: Record<ProposalStatus, { label: string; variant: 'neutral' | 'info' | 'success' | 'danger' }> = {
    draft: { label: 'Rascunho', variant: 'neutral' },
    sent: { label: 'Enviado', variant: 'info' },
    approved: { label: 'Aprovado / Venda', variant: 'success' },
    rejected: { label: 'Recusado', variant: 'danger' },
  };

  return (
    <div className="space-y-6">
      {/* Top filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por número ou cliente..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as any); setCurrentPage(1); }}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="all">Todos os Status</option>
            <option value="draft">Rascunho</option>
            <option value="sent">Enviado</option>
            <option value="approved">Aprovado (Venda)</option>
            <option value="rejected">Recusado</option>
          </select>

          <button
            onClick={openNewModal}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Orçamento
          </button>
        </div>
      </div>

      {/* Grid of Proposals */}
      {paginatedProposals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedProposals.map((p) => (
            <div
              key={p.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-blue-600">
                        #{p.number}
                      </span>
                      <Badge variant={statusBadges[p.status].variant} size="sm">
                        {statusBadges[p.status].label}
                      </Badge>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1">
                      {p.clientName}
                    </h4>
                  </div>
                  <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
                    {formatCurrency(p.total)}
                  </span>
                </div>

                <div className="mt-3.5 space-y-1 text-xs text-slate-500">
                  <div className="flex items-center justify-between">
                    <span>Emissão:</span>
                    <span>{formatDate(p.date)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Validade:</span>
                    <span>{formatDate(p.validUntil)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Itens incluídos:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {p.items?.length || 0} itens
                    </span>
                  </div>
                </div>

                {/* Items summary */}
                <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {p.items?.[0]?.productName || 'Sem itens'} {p.items?.length > 1 ? `e mais ${p.items.length - 1}...` : ''}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {p.paymentConditions}
                  </p>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                {/* Convert to sale button */}
                {p.status !== 'approved' && (
                  <button
                    onClick={() => {
                      setConvertingProposal(p);
                      setSalePaymentMethod('bank_transfer');
                      setSaleAccountId(accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || '');
                      setSaleInstallments(1);
                      setSaleReceivedNow(false);
                      setSaleFirstDue(format(new Date(), 'yyyy-MM-dd'));
                    }}
                    className="font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Aprovar & Vender
                  </button>
                )}
                {p.status === 'approved' && (
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Venda Concretizada
                  </span>
                )}

                <div className="flex items-center gap-1">
                  {/* WhatsApp */}
                  {p.clientPhone && (
                    <button
                      onClick={() => handleSendWhatsApp(p)}
                      title="Enviar via WhatsApp"
                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  )}

                  {/* Gerar PDF */}
                  <button
                    onClick={() => printProposal(p, company, clients.find((c) => c.id === p.clientId))}
                    title="Imprimir / salvar PDF"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800"
                  >
                    <Printer className="w-4 h-4" />
                  </button>

                  {p.status !== 'approved' && (
                    <button
                      onClick={() => openEditModal(p)}
                      title="Editar orçamento"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => setDeletingId(p.id)}
                      title="Excluir orçamento"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nenhum orçamento cadastrado"
          description="Crie propostas comerciais detalhadas, calcule descontos e transforme orçamentos em vendas."
          actionText="Novo Orçamento"
          onAction={openNewModal}
        />
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredProposals.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      {/* MODAL: CRIAR / EDITAR ORÇAMENTO */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); onClearQuickAction?.(); }}
        title={editingProposal ? 'Editar Orçamento' : 'Novo Orçamento Comercial'}
        subtitle="Adicione itens do catálogo e defina condições de pagamento"
        maxWidth="3xl"
      >
        <form onSubmit={handleSaveProposal} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Cliente *
              </label>
              <select
                required
                value={formClientId}
                onChange={(e) => setFormClientId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">Selecione o Cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Validade da Proposta
              </label>
              <input
                type="date"
                value={formValidUntil}
                onChange={(e) => setFormValidUntil(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Items Table */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Itens do Orçamento
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 hover:bg-blue-100"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Item
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  <div className="col-span-5">
                    <select
                      value={item.productId}
                      onChange={(e) => handleItemProductChange(index, e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Selecione o Item...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({formatCurrency(p.salePrice)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <input
                      type="number"
                      min={1}
                      placeholder="Qtd"
                      value={item.quantity}
                      onChange={(e) => handleItemQuantityChange(index, parseInt(e.target.value, 10))}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-mono"
                    />
                  </div>

                  <div className="col-span-2">
                    <MoneyInput
                      showSymbol={false}
                      placeholder="Preço"
                      value={formatMoneyInput(item.unitPrice)}
                      onChange={(v) => handleItemPriceChange(index, parseMoney(v))}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-right font-mono"
                    />
                  </div>

                  <div className="col-span-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                    {formatCurrency(item.totalPrice)}
                  </div>

                  <div className="col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Subtotals, Desconto e Frete */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-1.5 text-right">
              <div className="text-slate-500">
                Subtotal dos Itens: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{formatCurrency(subtotal)}</span>
              </div>

              <div className="flex items-center justify-end gap-3">
                <span className="text-slate-500">Desconto:</span>
                <div className="w-40">
                  <MoneyInput
                    value={formDiscount}
                    onChange={setFormDiscount}
                    className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-right"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <span className="text-slate-500">Frete / entrega:</span>
                <div className="w-40">
                  <MoneyInput
                    value={formShipping}
                    onChange={setFormShipping}
                    className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-right"
                  />
                </div>
              </div>

              <div className="pt-2 text-sm font-bold text-slate-900 dark:text-white flex items-center justify-end gap-3">
                <span>TOTAL DO ORÇAMENTO:</span>
                <span className="text-lg font-mono text-blue-600">{formatCurrency(totalCalculated)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Condições de Pagamento
            </label>
            <input
              type="text"
              value={formPaymentConditions}
              onChange={(e) => setFormPaymentConditions(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Observações
            </label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => { setIsModalOpen(false); onClearQuickAction?.(); }}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              Salvar Orçamento
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: TRANSFORMAR EM VENDA */}
      <Modal
        isOpen={Boolean(convertingProposal)}
        onClose={() => setConvertingProposal(null)}
        title="Transformar Orçamento em Venda"
        subtitle={`Orçamento #${convertingProposal?.number} • ${formatCurrency(convertingProposal?.total)}`}
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100">
            <p className="font-bold">Ações automáticas:</p>
            <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
              <li>O orçamento será marcado como <strong>Aprovado</strong></li>
              <li>O estoque dos produtos físicos será baixado automaticamente</li>
              <li>Uma ou mais contas a receber serão lançadas no Financeiro</li>
            </ul>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Forma de Pagamento Acordada *
            </label>
            <select
              value={salePaymentMethod}
              onChange={(e) => setSalePaymentMethod(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm.value} value={pm.value}>
                  {pm.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Conta de Destino do Recebimento *
            </label>
            <select
              value={saleAccountId}
              onChange={(e) => setSaleAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatCurrency(a.currentBalance)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Parcelamento
              </label>
              <select
                value={saleInstallments}
                onChange={(e) => setSaleInstallments(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value={1}>À vista (1x)</option>
                <option value={2}>2x parcelas mensais</option>
                <option value={3}>3x parcelas mensais</option>
                <option value={4}>4x parcelas mensais</option>
                <option value={6}>6x parcelas mensais</option>
                <option value={10}>10x parcelas mensais</option>
                <option value={12}>12x parcelas mensais</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                1º vencimento
              </label>
              <input
                type="date"
                value={saleFirstDue}
                onChange={(e) => setSaleFirstDue(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {saleInstallments === 1 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={saleReceivedNow} onChange={(e) => setSaleReceivedNow(e.target.checked)} />
              <span className="font-semibold text-slate-700 dark:text-slate-300">O cliente já pagou (lançar como recebido)</span>
            </label>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setConvertingProposal(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              onClick={handleExecuteConvertToSale}
              disabled={isConverting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20"
            >
              Confirmar e Concluir Venda
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={async () => {
          if (!deletingId) return;
          try {
            await FirestoreService.deleteDocument(
              'proposals',
              deletingId,
              profile ? { uid: profile.uid, name: profile.name } : undefined
            );
            success('Orçamento excluído com sucesso.');
            setDeletingId(null);
          } catch (err: any) {
            error('Erro ao excluir orçamento', err?.message);
          }
        }}
        title="Excluir Orçamento"
        message="Deseja excluir este orçamento? A exclusão não poderá ser desfeita."
      />
    </div>
  );
}
