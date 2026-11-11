import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Truck,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  DollarSign,
  Printer,
  Trash2,
  Edit2,
  Building,
} from 'lucide-react';
import type { Supplier, Transaction, CompanyProfile } from '../../../types';
import {
  formatCurrency,
  formatDate,
  formatDocument,
  formatPhone,
  formatAddress,
  maskDocumentInput,
  whatsappLink,
} from '../../../utils/formatters';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { EmptyState } from '../../common/EmptyState';
import { Pagination } from '../../common/Pagination';
import { FirestoreService } from '../../../services/firestoreService';
import { AddressFields } from '../../common/AddressFields';
import { printSupplierSheet } from '../../../services/printDocuments';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';

interface SuppliersViewProps {
  suppliers: Supplier[];
  transactions: Transaction[];
  company: CompanyProfile | null;
}

export function SuppliersView({ suppliers, transactions, company }: SuppliersViewProps) {
  const { profile, isAdmin } = useAuth();
  const { success, error, warning } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formDocument, setFormDocument] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formPixKey, setFormPixKey] = useState('');
  const [formBankInfo, setFormBankInfo] = useState('');
  const [formCep, setFormCep] = useState('');
  const [formStreet, setFormStreet] = useState('');
  const [formNumber, setFormNumber] = useState('');
  const [formComplement, setFormComplement] = useState('');
  const [formNeighborhood, setFormNeighborhood] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formTags, setFormTags] = useState('');

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openNewModal = () => {
    setEditingSupplier(null);
    setFormName('');
    setFormDocument('');
    setFormPhone('');
    setFormWhatsapp('');
    setFormEmail('');
    setFormContactPerson('');
    setFormPixKey('');
    setFormBankInfo('');
    setFormCep('');
    setFormStreet('');
    setFormNumber('');
    setFormComplement('');
    setFormNeighborhood('');
    setFormCity('');
    setFormState('');
    setFormNotes('');
    setFormTags('');
    setIsModalOpen(true);
  };

  const openEditModal = (s: Supplier) => {
    setEditingSupplier(s);
    setFormName(s.name);
    setFormDocument(s.document || '');
    setFormPhone(s.phone || '');
    setFormWhatsapp(s.whatsapp || '');
    setFormEmail(s.email || '');
    setFormContactPerson(s.contactPerson || '');
    setFormPixKey(s.pixKey || '');
    setFormBankInfo(s.bankInfo || '');
    setFormCep(s.cep || '');
    setFormStreet(s.street || '');
    setFormNumber(s.number || '');
    setFormComplement(s.complement || '');
    setFormNeighborhood(s.neighborhood || '');
    setFormCity(s.city || '');
    setFormState(s.state || '');
    setFormNotes(s.notes || '');
    setFormTags(s.tags ? s.tags.join(', ') : '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      error('Informe o nome ou razão social do fornecedor.');
      return;
    }

    const parsedTags = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (editingSupplier) {
        await FirestoreService.updateDocument<Supplier>(
          'suppliers',
          editingSupplier.id,
          {
            type: 'PJ',
            name: formName,
            document: formDocument,
            phone: formPhone,
            whatsapp: formWhatsapp,
            email: formEmail,
            contactPerson: formContactPerson,
            pixKey: formPixKey,
            bankInfo: formBankInfo,
            cep: formCep,
            street: formStreet,
            number: formNumber,
            complement: formComplement,
            neighborhood: formNeighborhood,
            city: formCity,
            state: formState,
            notes: formNotes,
            tags: parsedTags,
          },
          profile ? { uid: profile.uid, name: profile.name } : undefined
        );
        success('Fornecedor atualizado com sucesso!');
      } else {
        await FirestoreService.createDocument<Supplier>(
          'suppliers',
          {
            type: 'PJ',
            name: formName,
            document: formDocument,
            phone: formPhone,
            whatsapp: formWhatsapp,
            email: formEmail,
            contactPerson: formContactPerson,
            pixKey: formPixKey,
            bankInfo: formBankInfo,
            cep: formCep,
            street: formStreet,
            number: formNumber,
            complement: formComplement,
            neighborhood: formNeighborhood,
            city: formCity,
            state: formState,
            notes: formNotes,
            tags: parsedTags,
          } as any,
          profile ? { uid: profile.uid, name: profile.name } : undefined
        );
        success('Fornecedor cadastrado com sucesso!');
      }

      setIsModalOpen(false);
    } catch (err: any) {
      error('Erro ao salvar fornecedor', err?.message);
    }
  };

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchName = s.name?.toLowerCase().includes(query);
        const matchDoc = s.document?.includes(query);
        const matchPerson = s.contactPerson?.toLowerCase().includes(query);
        if (!matchName && !matchDoc && !matchPerson) return false;
      }
      return true;
    });
  }, [suppliers, searchTerm]);

  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);
  const paginatedSuppliers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSuppliers.slice(start, start + itemsPerPage);
  }, [filteredSuppliers, currentPage]);

  // Supplier payments history
  const supplierPayments = useMemo(() => {
    if (!selectedSupplier) return [];
    return transactions.filter(
      (t) => t.entityType === 'supplier' && t.entityId === selectedSupplier.id
    );
  }, [selectedSupplier, transactions]);

  const totalPagoFornecedor = supplierPayments
    .filter((t) => t.type === 'expense' && t.status === 'paid')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalPendenteFornecedor = supplierPayments
    .filter((t) => t.type === 'expense' && t.status !== 'paid')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Top search & Add */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar fornecedor por nome, RUC ou contato..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
          />
        </div>

        <button
          onClick={openNewModal}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Novo Fornecedor
        </button>
      </div>

      {/* Grid */}
      {paginatedSuppliers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {paginatedSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {supplier.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {formatDocument(supplier.document || '') || 'Doc. não informado'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {supplier.contactPerson && (
                    <p className="text-slate-500">Contato: {supplier.contactPerson}</p>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatPhone(supplier.phone)}</span>
                    </div>
                  )}
                  {supplier.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{supplier.email}</span>
                    </div>
                  )}
                  {supplier.whatsapp && (
                    <a href={whatsappLink(supplier.whatsapp) || '#'} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">
                      WhatsApp: {formatPhone(supplier.whatsapp)}
                    </a>
                  )}

                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <button
                  onClick={() => setSelectedSupplier(supplier)}
                  className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Histórico de Pagamentos &rarr;
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(supplier)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setDeletingId(supplier.id)}
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
          title="Nenhum fornecedor encontrado"
          description="Cadastre parceiros e fornecedores para controlar suas despesas operacionais e custos."
          actionText="Novo Fornecedor"
          onAction={openNewModal}
        />
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredSuppliers.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      {/* MODAL: FICHA DO FORNECEDOR & HISTÓRICO */}
      <Modal
        isOpen={Boolean(selectedSupplier)}
        onClose={() => setSelectedSupplier(null)}
        title={selectedSupplier?.name || 'Ficha do Fornecedor'}
        subtitle={`RUC: ${formatDocument(selectedSupplier?.document || '') || '-'}${selectedSupplier && formatAddress(selectedSupplier) ? ` · ${formatAddress(selectedSupplier)}` : ''}`}
        maxWidth="3xl"
      >
        {selectedSupplier && (
          <div className="space-y-4 text-xs">
            {/* Indicators */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Já Pago</span>
                <p className="text-base font-bold font-mono text-emerald-600 mt-0.5">
                  {formatCurrency(totalPagoFornecedor)}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Contas a Pagar Pendentes</span>
                <p className="text-base font-bold font-mono text-rose-600 mt-0.5">
                  {formatCurrency(totalPendenteFornecedor)}
                </p>
              </div>
            </div>

            {/* Dados bancários */}
            {(selectedSupplier.bankInfo || selectedSupplier.pixKey) && (
              <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                <span className="font-bold text-blue-900 dark:text-blue-200">Dados Bancários para Pagamento:</span>
                <p className="mt-1 text-slate-700 dark:text-slate-300">
                  {selectedSupplier.bankInfo && <span>Banco: {selectedSupplier.bankInfo} • </span>}
                  {selectedSupplier.pixKey && <span>Outros dados: {selectedSupplier.pixKey}</span>}
                </p>
              </div>
            )}

            {/* Payments List */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-800 dark:text-slate-200">
                Lançamentos e Pagamentos ({supplierPayments.length})
              </h4>
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {supplierPayments.length > 0 ? (
                  supplierPayments.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{t.description}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                          <span>Venc: {formatDate(t.dueDate)}</span>
                          <Badge variant={t.status === 'paid' ? 'success' : 'warning'}>
                            {t.status === 'paid' ? 'Pago' : 'Pendente'}
                          </Badge>
                        </div>
                      </div>
                      <span className="font-bold font-mono text-rose-600">
                        {formatCurrency(t.amount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 py-6 text-center">Nenhum pagamento registrado para este fornecedor.</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => printSupplierSheet(selectedSupplier, supplierPayments, company)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Imprimir Ficha
              </button>
              <button
                onClick={() => setSelectedSupplier(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: CRIAR / EDITAR FORNECEDOR */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
        subtitle="Informe os dados para faturamento e pagamento"
        maxWidth="2xl"
      >
        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Razão Social / Nome Fantasia *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Dell do Brasil Ltda"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                RUC / CI
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="80012345-6"
                value={formDocument}
                onChange={(e) => setFormDocument(maskDocumentInput(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Pessoa de Contato
              </label>
              <input
                type="text"
                placeholder="Ex: Carlos Representante"
                value={formContactPerson}
                onChange={(e) => setFormContactPerson(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Telefone
              </label>
              <input
                type="tel"
                placeholder="021 123 456"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                E-mail
              </label>
              <input
                type="email"
                placeholder="vendas@fornecedor.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                WhatsApp
              </label>
              <input
                type="tel"
                placeholder="0981 123 456"
                value={formWhatsapp}
                onChange={(e) => setFormWhatsapp(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Dados bancários (banco, conta, titular)
              </label>
              <input
                type="text"
                placeholder="Ex.: Banco Continental — Cta. 1234567 — RUC 80012345-6"
                value={formBankInfo}
                onChange={(e) => setFormBankInfo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <AddressFields
            title="Endereço do fornecedor"
            value={{ street: formStreet, number: formNumber, complement: formComplement, neighborhood: formNeighborhood, city: formCity, state: formState }}
            onChange={(p) => {
              if (p.street !== undefined) setFormStreet(p.street);
              if (p.number !== undefined) setFormNumber(p.number);
              if (p.complement !== undefined) setFormComplement(p.complement);
              if (p.neighborhood !== undefined) setFormNeighborhood(p.neighborhood);
              if (p.city !== undefined) setFormCity(p.city);
              if (p.state !== undefined) setFormState(p.state);
            }}
          />

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">Observações</label>
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
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              Salvar Fornecedor
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={async () => {
          if (!deletingId) return;
          try {
            await FirestoreService.deleteDocument(
              'suppliers',
              deletingId,
              profile ? { uid: profile.uid, name: profile.name } : undefined
            );
            success('Fornecedor excluído com sucesso.');
            setDeletingId(null);
          } catch (err: any) {
            error('Erro ao excluir fornecedor', err?.message);
          }
        }}
        title="Excluir Fornecedor"
        message="Deseja realmente excluir este fornecedor do cadastro? Os lançamentos financeiros anteriores serão mantidos."
      />
    </div>
  );
}
