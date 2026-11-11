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
import { addDays, format } from 'date-fns';

interface ProposalsViewProps {
  proposals: Proposal[];
  clients: Client[];
  products: Product[];
  accounts: Account[];
  company?: CompanyProfile | null;
  openCreateProposal?: boolean;
  onClearQuickAction?: () => void;
}

export function ProposalsView({
  proposals,
  clients,
  products,
  accounts,
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
  const [isModalOpen, setIsModalOpen] = useState(openCreateProposal);
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);

  // Convert to sale modal
  const [convertingProposal, setConvertingProposal] = useState<Proposal | null>(null);
  const [salePaymentMethod, setSalePaymentMethod] = useState<Transaction['paymentMethod']>('pix');
  const [saleAccountId, setSaleAccountId] = useState(accounts[0]?.id || '');
  const [saleInstallments, setSaleInstallments] = useState<number>(1);
  const [saleFirstDue, setSaleFirstDue] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Form Fields
  const [formClientId, setFormClientId] = useState('');
  const [formValidUntil, setFormValidUntil] = useState(format(addDays(new Date(), 15), 'yyyy-MM-dd'));
  const [formPaymentConditions, setFormPaymentConditions] = useState('À vista via Pix com 5% ou em até 3x no boleto');
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
    const disc = parseFloat(formDiscount.replace(',', '.')) || 0;
    const ship = parseFloat(formShipping.replace(',', '.')) || 0;
    return Math.max(0, subtotal - disc + ship);
  }, [subtotal, formDiscount, formShipping]);

  const openNewModal = () => {
    setEditingProposal(null);
    setFormClientId(clients[0]?.id || '');
    setFormValidUntil(format(addDays(new Date(), 15), 'yyyy-MM-dd'));
    setFormPaymentConditions('À vista via Pix com 5% de desconto ou em até 3x sem juros');
    setFormDiscount('0');
    setFormShipping('0');
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

  const handleItemProductChange = (index: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    const updated = [...items];
    updated[index].productId = productId;
    updated[index].productName = prod?.name || '';
    updated[index].unitPrice = prod?.salePrice || 0;
    updated[index].totalPrice =
      updated[index].quantity * (prod?.salePrice || 0) - (updated[index].discount || 0);
    setItems(updated);
  };

  const handleItemQuantityChange = (index: number, qty: number) => {
    const updated = [...items];
    updated[index].quantity = Math.max(1, qty);
    updated[index].totalPrice =
      updated[index].quantity * updated[index].unitPrice - (updated[index].discount || 0);
    setItems(updated);
  };

  const handleItemPriceChange = (index: number, price: number) => {
    const updated = [...items];
    updated[index].unitPrice = Math.max(0, price);
    updated[index].totalPrice =
      updated[index].quantity * updated[index].unitPrice - (updated[index].discount || 0);
    setItems(updated);
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
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSaveProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find((c) => c.id === formClientId);
    if (!client) {
      error('Selecione um cliente para o orçamento.');
      return;
    }

    const disc = parseFloat(formDiscount.replace(',', '.')) || 0;
    const ship = parseFloat(formShipping.replace(',', '.')) || 0;
    const nextNumber = `${new Date().getFullYear()}${(proposals.length + 1).toString().padStart(4, '0')}`;

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
            items,
            subtotal,
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
            items,
            subtotal,
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
    if (!convertingProposal) return;
    try {
      await FirestoreService.convertProposalToSale(
        convertingProposal,
        salePaymentMethod,
        saleAccountId,
        saleInstallments,
        saleFirstDue,
        profile ? { uid: profile.uid, name: profile.name } : undefined
      );
      success('Orçamento transformado em Venda! Estoque baixado e contas a receber geradas.');
      setConvertingProposal(null);
    } catch (err: any) {
      error('Erro ao converter venda', err?.message);
    }
  };

  // Send WhatsApp message
  const handleSendWhatsApp = (p: Proposal) => {
    const phone = p.clientPhone?.replace(/\D/g, '');
    if (!phone) {
      error('Cliente não possui telefone/WhatsApp cadastrado.');
      return;
    }
    const cleanPhone = phone.startsWith('55') ? phone : `55${phone}`;
    const text = encodeURIComponent(
      `Olá ${p.clientName}! Segue o link com o Orçamento #${p.number} no valor de ${formatCurrency(
        p.total
      )}. Válido até ${formatDate(p.validUntil)}. Ficamos à disposição!`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
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
                      setSalePaymentMethod('pix');
                      setSaleAccountId(accounts[0]?.id || '');
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
                    onClick={() => ExportService.generateProposalPDF(p, company)}
                    title="Baixar PDF com logo e dados da empresa"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800"
                  >
                    <Printer className="w-4 h-4" />
                  </button>

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
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Preço Unit."
                      value={item.unitPrice}
                      onChange={(e) => handleItemPriceChange(index, parseFloat(e.target.value))}
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
                <span className="text-slate-500">Desconto (R$):</span>
                <input
                  type="text"
                  value={formDiscount}
                  onChange={(e) => setFormDiscount(e.target.value)}
                  className="w-24 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-right"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <span className="text-slate-500">Frete / Entrega (R$):</span>
                <input
                  type="text"
                  value={formShipping}
                  onChange={(e) => setFormShipping(e.target.value)}
                  className="w-24 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-right"
                />
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
              <option value="pix">Pix (à vista)</option>
              <option value="bank_slip">Boleto Bancário</option>
              <option value="credit_card">Cartão de Crédito</option>
              <option value="bank_transfer">Transferência Bancária</option>
              <option value="cash">Dinheiro em Espécie</option>
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
                Data do 1º Vencimento
              </label>
              <input
                type="date"
                value={saleFirstDue}
                onChange={(e) => setSaleFirstDue(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setConvertingProposal(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              onClick={handleExecuteConvertToSale}
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
