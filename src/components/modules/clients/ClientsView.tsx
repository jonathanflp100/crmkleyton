import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  User,
  Building,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Calendar,
  Gift,
  DollarSign,
  Briefcase,
  FileText,
  Printer,
  Trash2,
  Edit2,
  ExternalLink,
  Cake,
} from 'lucide-react';
import type { Client, Transaction, Deal, Task, CompanyProfile } from '../../../types';
import {
  formatCurrency,
  formatDate,
  formatDocument,
  formatPhone,
  formatAddress,
  maskDocumentInput,
  validateRUC,
  whatsappLink,
} from '../../../utils/formatters';
import { AddressFields } from '../../common/AddressFields';
import { printClientSheet } from '../../../services/printDocuments';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { EmptyState } from '../../common/EmptyState';
import { Pagination } from '../../common/Pagination';
import { FirestoreService } from '../../../services/firestoreService';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import { format } from 'date-fns';

interface ClientsViewProps {
  clients: Client[];
  transactions: Transaction[];
  deals: Deal[];
  tasks: Task[];
  company: CompanyProfile | null;
  openCreateClient?: boolean;
  onClearQuickAction?: () => void;
}

export function ClientsView({
  clients,
  transactions,
  deals,
  tasks,
  company,
  openCreateClient = false,
  onClearQuickAction,
}: ClientsViewProps) {
  const { profile, isAdmin } = useAuth();
  const { success, error, warning } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'PF' | 'PJ'>('all');
  const [showBirthdaysOnly, setShowBirthdaysOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Selected client for Client Profile Sheet (Ficha do Cliente)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeFichaTab, setActiveFichaTab] = useState<'dados' | 'negocios' | 'financeiro' | 'tarefas'>('dados');

  // Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  React.useEffect(() => {
    if (openCreateClient) openNewModal();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Form fields
  const [formType, setFormType] = useState<'PF' | 'PJ'>('PJ');
  const [formName, setFormName] = useState('');
  const [formDocument, setFormDocument] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCep, setFormCep] = useState('');
  const [formStreet, setFormStreet] = useState('');
  const [formNumber, setFormNumber] = useState('');
  const [formComplement, setFormComplement] = useState('');
  const [formNeighborhood, setFormNeighborhood] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formSource, setFormSource] = useState('Indicação');
  const [formNotes, setFormNotes] = useState('');
  const [formTags, setFormTags] = useState('');

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openNewModal = () => {
    setEditingClient(null);
    setFormType('PJ');
    setFormName('');
    setFormDocument('');
    setFormPhone('');
    setFormWhatsapp('');
    setFormEmail('');
    setFormCep('');
    setFormStreet('');
    setFormNumber('');
    setFormComplement('');
    setFormNeighborhood('');
    setFormCity('');
    setFormState('');
    setFormBirthDate('');
    setFormSource('Indicação');
    setFormNotes('');
    setFormTags('');
    setIsModalOpen(true);
  };

  const openEditModal = (c: Client) => {
    setEditingClient(c);
    setFormType(c.type || 'PJ');
    setFormName(c.name);
    setFormDocument(c.document || '');
    setFormPhone(c.phone || '');
    setFormWhatsapp(c.whatsapp || '');
    setFormEmail(c.email || '');
    setFormCep(c.cep || '');
    setFormStreet(c.street || '');
    setFormNumber(c.number || '');
    setFormComplement(c.complement || '');
    setFormNeighborhood(c.neighborhood || '');
    setFormCity(c.city || '');
    setFormState(c.state || '');
    setFormBirthDate(c.birthDate || '');
    setFormSource(c.source || 'Indicação');
    setFormNotes(c.notes || '');
    setFormTags(c.tags ? c.tags.join(', ') : '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      error('Informe o nome ou razão social.');
      return;
    }

    // RUC: confere o dígito verificador (só avisa, não bloqueia)
    if (formDocument.includes('-') && !validateRUC(formDocument)) {
      warning('Atenção: o dígito verificador do RUC parece incorreto.');
    }
    const duplicate = formDocument
      ? clients.find((c) => c.id !== editingClient?.id && c.document && c.document.replace(/\D/g, '') === formDocument.replace(/\D/g, ''))
      : null;
    if (duplicate) {
      warning(`Já existe um cliente com este documento: ${duplicate.name}`);
    }

    const parsedTags = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (editingClient) {
        await FirestoreService.updateDocument<Client>(
          'clients',
          editingClient.id,
          {
            type: formType,
            name: formName.trim(),
            document: formDocument,
            phone: formPhone,
            whatsapp: formWhatsapp,
            email: formEmail,
            cep: formCep,
            street: formStreet,
            number: formNumber,
            complement: formComplement,
            neighborhood: formNeighborhood,
            city: formCity,
            state: formState,
            birthDate: formBirthDate,
            source: formSource,
            notes: formNotes,
            tags: parsedTags,
          },
          profile ? { uid: profile.uid, name: profile.name } : undefined
        );
        success('Cliente atualizado com sucesso!');
      } else {
        await FirestoreService.createDocument<Client>(
          'clients',
          {
            type: formType,
            name: formName.trim(),
            document: formDocument,
            phone: formPhone,
            whatsapp: formWhatsapp,
            email: formEmail,
            cep: formCep,
            street: formStreet,
            number: formNumber,
            complement: formComplement,
            neighborhood: formNeighborhood,
            city: formCity,
            state: formState,
            birthDate: formBirthDate,
            source: formSource,
            notes: formNotes,
            tags: parsedTags,
          } as any,
          profile ? { uid: profile.uid, name: profile.name } : undefined
        );
        success('Cliente cadastrado com sucesso!');
      }

      setIsModalOpen(false);
      onClearQuickAction?.();
    } catch (err: any) {
      error('Erro ao salvar cliente', err?.message);
    }
  };

  // Filtered clients
  const currentMonthNumber = format(new Date(), 'MM');

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;

      // Aniversariantes do mês filter
      if (showBirthdaysOnly) {
        if (!c.birthDate) return false;
        const bMonth = c.birthDate.split('-')[1];
        if (bMonth !== currentMonthNumber) return false;
      }

      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchName = c.name?.toLowerCase().includes(query);
        const matchDoc = c.document?.replace(/\D/g, '').includes(query.replace(/\D/g, '') || '§');
        const matchPhone = `${c.phone || ''} ${c.whatsapp || ''}`.replace(/\D/g, '').includes(query.replace(/\D/g, '') || '§');
        const matchEmail = c.email?.toLowerCase().includes(query);
        const matchCity = c.city?.toLowerCase().includes(query);
        if (!matchName && !matchDoc && !matchEmail && !matchCity && !matchPhone) return false;
      }

      return true;
    });
  }, [clients, typeFilter, showBirthdaysOnly, currentMonthNumber, searchTerm]);

  // Paginated clients
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredClients.slice(start, start + itemsPerPage);
  }, [filteredClients, currentPage]);

  // Client Ficha Metrics & Data
  const clientTransactions = useMemo(() => {
    if (!selectedClient) return [];
    return transactions.filter(
      (t) => t.entityType === 'client' && t.entityId === selectedClient.id
    );
  }, [selectedClient, transactions]);

  const clientPaidTransactions = clientTransactions.filter(
    (t) => t.type === 'income' && t.status === 'paid'
  );
  const clientOpenTransactions = clientTransactions.filter(
    (t) => t.type === 'income' && t.status !== 'paid'
  );

  const totalComprado = clientPaidTransactions.reduce((acc, t) => acc + t.amount, 0);
  const valorEmAberto = clientOpenTransactions.reduce((acc, t) => acc + t.amount, 0);
  const ticketMedio =
    clientPaidTransactions.length > 0 ? totalComprado / clientPaidTransactions.length : 0;
  const ultimaCompra =
    clientPaidTransactions.length > 0
      ? [...clientPaidTransactions].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]
      : null;

  const clientDeals = useMemo(() => {
    if (!selectedClient) return [];
    return deals.filter((d) => d.clientId === selectedClient.id);
  }, [selectedClient, deals]);

  const clientTasks = useMemo(() => {
    if (!selectedClient) return [];
    return tasks.filter((t) => t.clientId === selectedClient.id);
  }, [selectedClient, tasks]);

  return (
    <div className="space-y-6">
      {/* Search, Filter, and Add Client */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, CI/RUC, telefone, e-mail ou cidade..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* PF/PJ Filter */}
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as any); setCurrentPage(1); }}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="all">Pessoa Física & Jurídica</option>
            <option value="PF">Apenas Pessoa Física (PF)</option>
            <option value="PJ">Apenas Pessoa Jurídica (PJ)</option>
          </select>

          {/* Aniversariantes do Mês Button */}
          <button
            onClick={() => setShowBirthdaysOnly(!showBirthdaysOnly)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showBirthdaysOnly
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Cake className="w-3.5 h-3.5 text-purple-400" />
            Aniversariantes do Mês
          </button>

          <button
            onClick={openNewModal}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Cliente
          </button>
        </div>
      </div>

      {/* Grid of Client Cards */}
      {paginatedClients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {paginatedClients.map((client) => (
            <div
              key={client.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                      {client.type === 'PJ' ? <Building className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {client.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {formatDocument(client.document || '') || 'Doc. não informado'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={client.type === 'PJ' ? 'info' : 'purple'} size="sm">
                    {client.type}
                  </Badge>
                </div>

                {/* Contact info */}
                <div className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {client.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatPhone(client.phone)}</span>
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.city && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {client.city} - {client.state || 'BR'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tags */}
                {client.tags && client.tags.length > 0 && (
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    {client.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <button
                  onClick={() => { setSelectedClient(client); setActiveFichaTab('dados'); }}
                  className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Abrir Ficha &rarr;
                </button>

                <div className="flex items-center gap-1">
                  {client.whatsapp && (
                    <a
                      href={whatsappLink(client.whatsapp) || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Conversar no WhatsApp"
                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => openEditModal(client)}
                    title="Editar cliente"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setDeletingId(client.id)}
                      title="Excluir cliente"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
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
          title="Nenhum cliente encontrado"
          description="Cadastre novos clientes para emitir orçamentos, vendas e gerenciar oportunidades no CRM."
          actionText="Novo Cliente"
          onAction={openNewModal}
        />
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredClients.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      {/* MODAL: FICHA COMPLETA DO CLIENTE (PRINT-READY) */}
      <Modal
        isOpen={Boolean(selectedClient)}
        onClose={() => setSelectedClient(null)}
        title={selectedClient?.name || 'Ficha do Cliente'}
        subtitle={`Cadastro ${selectedClient?.type} • ${formatDocument(selectedClient?.document || '')}`}
        maxWidth="4xl"
      >
        {selectedClient && (
          <div className="space-y-5 text-xs">
            {/* Top 4 Indicators (Total comprado, ticket médio, última compra, valor em aberto) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Comprado</span>
                <p className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatCurrency(totalComprado)}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Ticket Médio</span>
                <p className="text-base font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                  {formatCurrency(ticketMedio)}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Última Compra</span>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-1">
                  {ultimaCompra ? formatDate(ultimaCompra.date) : 'Nenhuma'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Valor em Aberto</span>
                <p className={`text-base font-bold font-mono mt-0.5 ${valorEmAberto > 0 ? 'text-amber-600' : 'text-slate-600'}`}>
                  {formatCurrency(valorEmAberto)}
                </p>
              </div>
            </div>

            {/* Ficha Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700 pb-2">
              <button
                onClick={() => setActiveFichaTab('dados')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                  activeFichaTab === 'dados'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Dados Cadastrais
              </button>
              <button
                onClick={() => setActiveFichaTab('negocios')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                  activeFichaTab === 'negocios'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Negócios no CRM ({clientDeals.length})
              </button>
              <button
                onClick={() => setActiveFichaTab('financeiro')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                  activeFichaTab === 'financeiro'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Histórico Financeiro ({clientTransactions.length})
              </button>
              <button
                onClick={() => setActiveFichaTab('tarefas')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                  activeFichaTab === 'tarefas'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Tarefas Vinculadas ({clientTasks.length})
              </button>
            </div>

            {/* TAB CONTENT */}
            {activeFichaTab === 'dados' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="text-slate-400">Endereço Completo:</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {formatAddress(selectedClient) || 'Não informado'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Origem do Cliente:</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {selectedClient.source || 'Não especificada'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Data de Nascimento / Fundação:</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {selectedClient.birthDate ? formatDate(selectedClient.birthDate) : 'Não informada'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Cadastrado em:</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {formatDate(selectedClient.createdAt)}
                    </p>
                  </div>
                </div>

                {selectedClient.notes && (
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Observações:</span>
                    <p className="mt-1 text-slate-600 dark:text-slate-300 leading-relaxed">
                      {selectedClient.notes}
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeFichaTab === 'negocios' && (
              <div className="space-y-2">
                {clientDeals.length > 0 ? (
                  clientDeals.map((d) => (
                    <div
                      key={d.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{d.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Etapa: {d.stageName || d.stageId} • Resp: {d.assignedToUserName}
                        </p>
                      </div>
                      <span className="font-bold font-mono text-blue-600">
                        {formatCurrency(d.value)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 py-6 text-center">Nenhum negócio no CRM para este cliente.</p>
                )}
              </div>
            )}

            {activeFichaTab === 'financeiro' && (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {clientTransactions.length > 0 ? (
                  clientTransactions.map((t) => (
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
                      <span className="font-bold font-mono text-emerald-600">
                        {formatCurrency(t.amount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 py-6 text-center">Nenhum lançamento financeiro para este cliente.</p>
                )}
              </div>
            )}

            {activeFichaTab === 'tarefas' && (
              <div className="space-y-2">
                {clientTasks.length > 0 ? (
                  clientTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{t.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Prazo: {formatDate(t.dueDate)}</p>
                      </div>
                      <Badge variant={t.status === 'completed' ? 'success' : 'warning'}>
                        {t.status === 'completed' ? 'Concluída' : 'Pendente'}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 py-6 text-center">Nenhuma tarefa agendada para este cliente.</p>
                )}
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() =>
                  printClientSheet(selectedClient, { transactions: clientTransactions, deals: clientDeals, tasks: clientTasks }, company)
                }
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Imprimir ficha
              </button>
              <button
                onClick={() => setSelectedClient(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: CRIAR / EDITAR CLIENTE */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); onClearQuickAction?.(); }}
        title={editingClient ? 'Editar Cliente' : 'Novo Cliente'}
        subtitle="Informe os dados cadastrais da Pessoa Física ou Jurídica"
        maxWidth="2xl"
      >
        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          {/* PF / PJ Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setFormType('PJ')}
              className={`py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                formType === 'PJ'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Building className="w-4 h-4" />
              Pessoa Jurídica (PJ)
            </button>
            <button
              type="button"
              onClick={() => setFormType('PF')}
              className={`py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                formType === 'PF'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <User className="w-4 h-4" />
              Pessoa Física (PF)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {formType === 'PJ' ? 'Razão Social / Nome Fantasia *' : 'Nome Completo *'}
              </label>
              <input
                type="text"
                required
                placeholder={formType === 'PJ' ? 'Ex.: Comercial Ejemplo S.A.' : 'Ex.: Juan Pérez'}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {formType === 'PJ' ? 'RUC' : 'CI ou RUC'}
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder={formType === 'PJ' ? '80012345-6' : 'CI: 4512345 · RUC: 4512345-0'}
                value={formDocument}
                onChange={(e) => setFormDocument(maskDocumentInput(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Contacts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                WhatsApp / Celular
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
                E-mail
              </label>
              <input
                type="email"
                placeholder="contato@empresa.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <AddressFields
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

          {/* Origem, Data Nascimento, Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Data de Nascimento / Fundação
              </label>
              <input
                type="date"
                value={formBirthDate}
                onChange={(e) => setFormBirthDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Origem do Cliente
              </label>
              <select
                value={formSource}
                onChange={(e) => setFormSource(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="Indicação">Indicação</option>
                <option value="Google / SEO">Google / SEO</option>
                <option value="Instagram / Redes">Instagram / Redes Sociais</option>
                <option value="Prospecção Ativa">Prospecção Ativa</option>
                <option value="Evento">Evento / Feira</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Etiquetas (tags por vírgula)
              </label>
              <input
                type="text"
                placeholder="Ex: VIP, Recorrente, Atacado"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Observações
            </label>
            <textarea
              rows={2}
              placeholder="Informações relevantes sobre este cliente..."
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
              Salvar Cliente
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRMAR EXCLUSÃO */}
      <ConfirmDialog
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={async () => {
          if (!deletingId) return;
          try {
            await FirestoreService.deleteDocument(
              'clients',
              deletingId,
              profile ? { uid: profile.uid, name: profile.name } : undefined
            );
            success('Cliente excluído com sucesso.');
            setDeletingId(null);
          } catch (err: any) {
            error('Erro ao excluir cliente', err?.message);
          }
        }}
        title="Excluir Cliente"
        message="Tem certeza de que deseja excluir este cliente? Seus lançamentos financeiros continuarão registrados para fins de conciliação."
      />
    </div>
  );
}
