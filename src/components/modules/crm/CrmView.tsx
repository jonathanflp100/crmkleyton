import React, { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import confetti from 'canvas-confetti';
import {
  Plus,
  MessageCircle,
  Phone,
  Mail,
  Users,
  Calendar,
  DollarSign,
  Tag,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  Sparkles,
  ExternalLink,
  Edit2,
  Trash2,
} from 'lucide-react';
import type {
  Deal,
  DealInteraction,
  DealTask,
  Client,
  KanbanColumn,
  DatePeriodFilter,
} from '../../../types';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { FirestoreService } from '../../../services/firestoreService';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import { KANBAN_STAGES } from '../../../services/demoDataService';
import { format } from 'date-fns';

interface CrmViewProps {
  deals: Deal[];
  clients: Client[];
  interactions: DealInteraction[];
  openCreateDeal?: boolean;
  onClearQuickAction?: () => void;
}

// Single Kanban Card Component
function KanbanCard({
  deal,
  onClick,
  onWhatsApp,
}: {
  deal: Deal;
  onClick: () => void;
  onWhatsApp: (e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    data: { deal },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const priorityColors = {
    low: 'border-l-slate-400',
    medium: 'border-l-blue-500',
    high: 'border-l-rose-500',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing border-l-4 ${
        priorityColors[deal.priority || 'medium']
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-snug line-clamp-2">
          {deal.title}
        </h4>
        {deal.clientPhone && (
          <button
            onClick={onWhatsApp}
            title="Enviar mensagem no WhatsApp"
            className="p-1 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 shrink-0"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
        {deal.clientName}
      </p>

      {/* Value */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs font-bold font-mono text-slate-900 dark:text-white">
          {formatCurrency(deal.value)}
        </span>
        {deal.expectedCloseDate && (
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(deal.expectedCloseDate)}
          </span>
        )}
      </div>

      {/* Tags & Assignee */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
        <span className="truncate max-w-[110px]">
          {deal.assignedToUserName || 'Não atribuído'}
        </span>
        {deal.tags && deal.tags.length > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
            {deal.tags[0]}
          </span>
        )}
      </div>
    </div>
  );
}

export function CrmView({
  deals,
  clients,
  interactions,
  openCreateDeal = false,
  onClearQuickAction,
}: CrmViewProps) {
  const { profile, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [stages] = useState<KanbanColumn[]>(KANBAN_STAGES);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [selectedDealForModal, setSelectedDealForModal] = useState<Deal | null>(null);

  // Filters
  const [filterTag, setFilterTag] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');

  // New / Edit Deal Modal
  const [isDealModalOpen, setIsDealModalOpen] = useState(openCreateDeal);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [dealTitle, setDealTitle] = useState('');
  const [dealClientId, setDealClientId] = useState('');
  const [dealValue, setDealValue] = useState('');
  const [dealStageId, setDealStageId] = useState('novo');
  const [dealPriority, setDealPriority] = useState<Deal['priority']>('medium');
  const [dealExpectedDate, setDealExpectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dealAssignee, setDealAssignee] = useState(profile?.name || 'Comercial');
  const [dealTags, setDealTags] = useState('');
  const [dealNotes, setDealNotes] = useState('');

  // Move to Won (Income creation prompt)
  const [wonDealCandidate, setWonDealCandidate] = useState<Deal | null>(null);
  const [createIncomeFromWon, setCreateIncomeFromWon] = useState(true);

  // Move to Lost (Reason prompt)
  const [lostDealCandidate, setLostDealCandidate] = useState<Deal | null>(null);
  const [lossReasonText, setLossReasonText] = useState('');

  // New Interaction within detail modal
  const [interactionType, setInteractionType] = useState<DealInteraction['type']>('whatsapp');
  const [interactionDesc, setInteractionDesc] = useState('');

  // Delete deal
  const [deletingDealId, setDeletingDealId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Unique tags and assignees for filters
  const allTags = useMemo(() => {
    const set = new Set<string>();
    deals.forEach((d) => d.tags?.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [deals]);

  const allAssignees = useMemo(() => {
    const set = new Set<string>();
    deals.forEach((d) => { if (d.assignedToUserName) set.add(d.assignedToUserName); });
    return Array.from(set);
  }, [deals]);

  // Filtered deals
  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      if (filterTag !== 'all' && !d.tags?.includes(filterTag)) return false;
      if (filterAssignee !== 'all' && d.assignedToUserName !== filterAssignee) return false;
      return true;
    });
  }, [deals, filterTag, filterAssignee]);

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals.find((d) => d.id === event.active.id);
    if (deal) setActiveDeal(deal);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);
    if (!over) return;

    const dealId = String(active.id);
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;

    // Check if dropped directly on a stage column or on a card in that column
    let targetStageId = String(over.id);
    const isStageDirect = stages.some((s) => s.id === targetStageId);

    if (!isStageDirect) {
      // It was dropped on another card
      const targetCard = deals.find((d) => d.id === targetStageId);
      if (targetCard) targetStageId = targetCard.stageId;
    }

    if (deal.stageId === targetStageId) return;

    // Check if moving to Won
    if (targetStageId === 'ganho') {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      setWonDealCandidate({ ...deal, stageId: 'ganho' });
      return;
    }

    // Check if moving to Lost
    if (targetStageId === 'perdido') {
      setLostDealCandidate({ ...deal, stageId: 'perdido' });
      setLossReasonText('');
      return;
    }

    // Normal stage move
    try {
      const stageObj = stages.find((s) => s.id === targetStageId);
      await FirestoreService.updateDocument<Deal>(
        'deals',
        dealId,
        { stageId: targetStageId, stageName: stageObj?.title },
        profile ? { uid: profile.uid, name: profile.name } : undefined
      );
      success(`Negócio movido para "${stageObj?.title}".`);
    } catch (err: any) {
      error('Erro ao mover negócio', err?.message);
    }
  };

  // Confirm Won Deal
  const handleConfirmWon = async () => {
    if (!wonDealCandidate) return;
    try {
      await FirestoreService.updateDocument<Deal>(
        'deals',
        wonDealCandidate.id,
        {
          stageId: 'ganho',
          stageName: 'Fechado / Ganho',
          wonDate: format(new Date(), 'yyyy-MM-dd'),
        },
        profile ? { uid: profile.uid, name: profile.name } : undefined
      );

      // Automatically generate financial receivable if checked
      if (createIncomeFromWon) {
        await FirestoreService.createTransactionWithInstallments(
          {
            description: `Receita - Negócio Ganho: ${wonDealCandidate.title}`,
            amount: wonDealCandidate.value,
            type: 'income',
            date: format(new Date(), 'yyyy-MM-dd'),
            dueDate: format(new Date(), 'yyyy-MM-dd'),
            categoryId: 'cat_vendas',
            categoryName: 'Vendas',
            paymentMethod: 'pix',
            status: 'pending',
            entityType: 'client',
            entityId: wonDealCandidate.clientId,
            entityName: wonDealCandidate.clientName,
            accountId: 'acc_itau',
            dealId: wonDealCandidate.id,
          },
          profile ? { uid: profile.uid, name: profile.name } : undefined
        );
        success('Negócio ganho e conta a receber gerada no Financeiro!');
      } else {
        success('Negócio marcado como Ganho!');
      }
      setWonDealCandidate(null);
    } catch (err: any) {
      error('Erro ao finalizar negócio', err?.message);
    }
  };

  // Confirm Lost Deal
  const handleConfirmLost = async () => {
    if (!lostDealCandidate) return;
    try {
      await FirestoreService.updateDocument<Deal>(
        'deals',
        lostDealCandidate.id,
        {
          stageId: 'perdido',
          stageName: 'Perdido',
          lostDate: format(new Date(), 'yyyy-MM-dd'),
          lossReason: lossReasonText || 'Não informado',
        },
        profile ? { uid: profile.uid, name: profile.name } : undefined
      );
      success('Negócio atualizado para Perdido.');
      setLostDealCandidate(null);
    } catch (err: any) {
      error('Erro ao atualizar negócio', err?.message);
    }
  };

  // Create / Edit Deal
  const openNewDealModal = () => {
    setEditingDeal(null);
    setDealTitle('');
    setDealClientId(clients[0]?.id || '');
    setDealValue('');
    setDealStageId('novo');
    setDealPriority('medium');
    setDealExpectedDate(format(new Date(), 'yyyy-MM-dd'));
    setDealAssignee(profile?.name || 'Comercial');
    setDealTags('');
    setDealNotes('');
    setIsDealModalOpen(true);
  };

  const handleSaveDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(dealValue.replace(',', '.'));
    if (!dealTitle || isNaN(val)) {
      error('Preencha o título e um valor válido.');
      return;
    }

    const selectedClient = clients.find((c) => c.id === dealClientId);
    const stageObj = stages.find((s) => s.id === dealStageId);
    const parsedTags = dealTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (editingDeal) {
        await FirestoreService.updateDocument<Deal>(
          'deals',
          editingDeal.id,
          {
            title: dealTitle,
            clientId: dealClientId,
            clientName: selectedClient?.name || 'Cliente',
            clientPhone: selectedClient?.whatsapp || selectedClient?.phone,
            clientEmail: selectedClient?.email,
            value: val,
            stageId: dealStageId,
            stageName: stageObj?.title,
            priority: dealPriority,
            expectedCloseDate: dealExpectedDate,
            assignedToUserName: dealAssignee,
            tags: parsedTags,
            notes: dealNotes,
          },
          profile ? { uid: profile.uid, name: profile.name } : undefined
        );
        success('Negócio atualizado!');
      } else {
        await FirestoreService.createDocument<Deal>(
          'deals',
          {
            title: dealTitle,
            clientId: dealClientId,
            clientName: selectedClient?.name || 'Cliente',
            clientPhone: selectedClient?.whatsapp || selectedClient?.phone,
            clientEmail: selectedClient?.email,
            value: val,
            stageId: dealStageId,
            stageName: stageObj?.title,
            priority: dealPriority,
            expectedCloseDate: dealExpectedDate,
            assignedToUserName: dealAssignee,
            tags: parsedTags,
            notes: dealNotes,
          } as any,
          profile ? { uid: profile.uid, name: profile.name } : undefined
        );
        success('Nova oportunidade criada no CRM!');
      }

      setIsDealModalOpen(false);
      onClearQuickAction?.();
    } catch (err: any) {
      error('Erro ao salvar oportunidade', err?.message);
    }
  };

  // Add Interaction in Deal Modal
  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDealForModal || !interactionDesc) return;
    try {
      await FirestoreService.addDealInteraction(
        {
          dealId: selectedDealForModal.id,
          type: interactionType,
          description: interactionDesc,
          date: format(new Date(), 'yyyy-MM-dd'),
          userId: profile?.uid || 'user',
          userName: profile?.name || 'Usuário',
        },
        profile ? { uid: profile.uid, name: profile.name } : undefined
      );
      success('Histórico registrado!');
      setInteractionDesc('');
    } catch (err: any) {
      error('Erro ao salvar histórico', err?.message);
    }
  };

  const handleOpenWhatsApp = (deal: Deal, e: React.MouseEvent) => {
    e.stopPropagation();
    const phone = deal.clientPhone?.replace(/\D/g, '');
    if (!phone) {
      error('Este cliente não possui telefone/WhatsApp cadastrado.');
      return;
    }
    const cleanPhone = phone.startsWith('55') ? phone : `55${phone}`;
    const text = encodeURIComponent(
      `Olá ${deal.clientName}, tudo bem? Sou da equipe da Gestor Pro e gostaria de falar sobre "${deal.title}".`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  const dealInteractionsList = useMemo(() => {
    if (!selectedDealForModal) return [];
    return interactions
      .filter((i) => i.dealId === selectedDealForModal.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [interactions, selectedDealForModal]);

  return (
    <div className="space-y-5">
      {/* Top Filter and Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Tag Filter */}
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="all">Todas as Etiquetas</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Assignee Filter */}
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="all">Todos os Responsáveis</option>
            {allAssignees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-400">
            {filteredDeals.length} negócios filtrados
          </span>
        </div>

        <button
          onClick={openNewDealModal}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Novo Negócio
        </button>
      </div>

      {/* Kanban Board with dnd-kit */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-start overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageDeals = filteredDeals.filter((d) => d.stageId === stage.id);
            const totalValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);

            return (
              <div
                key={stage.id}
                id={stage.id}
                className="w-full min-w-[260px] bg-slate-100/80 dark:bg-slate-900/50 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[82vh]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100">
                      {stage.title}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-2xs">
                    {stageDeals.length}
                  </span>
                </div>

                {/* Subtotal of column */}
                <div className="mb-3 px-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Total da etapa:</span>
                  <span className="font-bold font-mono text-slate-700 dark:text-slate-300">
                    {formatCurrency(totalValue)}
                  </span>
                </div>

                {/* Cards List */}
                <SortableContext
                  items={stageDeals.map((d) => d.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[140px]">
                    {stageDeals.map((deal) => (
                      <KanbanCard
                        key={deal.id}
                        deal={deal}
                        onClick={() => setSelectedDealForModal(deal)}
                        onWhatsApp={(e) => handleOpenWhatsApp(deal, e)}
                      />
                    ))}
                    {stageDeals.length === 0 && (
                      <div className="h-28 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl flex items-center justify-center text-slate-400 text-xs">
                        Arraste cards aqui
                      </div>
                    )}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>

        {/* Drag Overlay Preview */}
        <DragOverlay>
          {activeDeal ? (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border-2 border-blue-500 shadow-2xl opacity-90 max-w-xs">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                {activeDeal.title}
              </h4>
              <p className="text-xs text-slate-500 mt-1">{activeDeal.clientName}</p>
              <p className="text-xs font-bold font-mono text-blue-600 mt-2">
                {formatCurrency(activeDeal.value)}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* MODAL 1: CRIAR / EDITAR NEGÓCIO */}
      <Modal
        isOpen={isDealModalOpen}
        onClose={() => { setIsDealModalOpen(false); onClearQuickAction?.(); }}
        title={editingDeal ? 'Editar Negócio' : 'Novo Negócio no CRM'}
        subtitle="Cadastre uma nova oportunidade de venda no funil"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveDeal} className="space-y-3.5 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Título da Oportunidade *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Contrato Anual TI, Compra Servidor..."
              value={dealTitle}
              onChange={(e) => setDealTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Cliente Vinculado *
              </label>
              <select
                required
                value={dealClientId}
                onChange={(e) => setDealClientId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">Selecione o Cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Valor Previsto (R$) *
              </label>
              <input
                type="text"
                required
                placeholder="0,00"
                value={dealValue}
                onChange={(e) => setDealValue(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Etapa Inicial
              </label>
              <select
                value={dealStageId}
                onChange={(e) => setDealStageId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Prioridade
              </label>
              <select
                value={dealPriority}
                onChange={(e) => setDealPriority(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta (Urgente)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Previsão de Fechamento
              </label>
              <input
                type="date"
                value={dealExpectedDate}
                onChange={(e) => setDealExpectedDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Responsável
              </label>
              <input
                type="text"
                placeholder="Nome do consultor/vendedor"
                value={dealAssignee}
                onChange={(e) => setDealAssignee(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Etiquetas (separadas por vírgula)
              </label>
              <input
                type="text"
                placeholder="Ex: VIP, Hardware, Renovação"
                value={dealTags}
                onChange={(e) => setDealTags(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Observações & Detalhes
            </label>
            <textarea
              rows={3}
              placeholder="Anotações comerciais sobre a negociação..."
              value={dealNotes}
              onChange={(e) => setDealNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => { setIsDealModalOpen(false); onClearQuickAction?.(); }}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              Salvar Oportunidade
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: DETALHES DO CARD (HISTÓRICO DE INTERAÇÕES E TAREFAS) */}
      <Modal
        isOpen={Boolean(selectedDealForModal)}
        onClose={() => setSelectedDealForModal(null)}
        title={selectedDealForModal?.title || 'Detalhes do Negócio'}
        subtitle={`Cliente: ${selectedDealForModal?.clientName || ''}`}
        maxWidth="3xl"
      >
        {selectedDealForModal && (
          <div className="space-y-5 text-xs">
            {/* Header badges */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(selectedDealForModal.value)}
                </span>
                <Badge variant="info">
                  Etapa: {selectedDealForModal.stageName || selectedDealForModal.stageId}
                </Badge>
                <Badge
                  variant={
                    selectedDealForModal.priority === 'high'
                      ? 'danger'
                      : selectedDealForModal.priority === 'medium'
                      ? 'warning'
                      : 'neutral'
                  }
                >
                  Prioridade {selectedDealForModal.priority?.toUpperCase()}
                </Badge>
              </div>

              {selectedDealForModal.clientPhone && (
                <button
                  onClick={(e) => handleOpenWhatsApp(selectedDealForModal, e)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Chamar no WhatsApp
                </button>
              )}
            </div>

            {/* Interaction recording form */}
            <form onSubmit={handleAddInteraction} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                Registrar Nova Interação no Histórico
              </h4>

              <div className="flex items-center gap-2">
                <select
                  value={interactionType}
                  onChange={(e) => setInteractionType(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value="whatsapp">Mensagem WhatsApp</option>
                  <option value="call">Ligação Telefônica</option>
                  <option value="meeting">Reunião Presencial/Online</option>
                  <option value="email">E-mail Comercial</option>
                  <option value="note">Nota Interna</option>
                </select>

                <input
                  type="text"
                  required
                  placeholder="Descreva o que foi conversado ou alinhado..."
                  value={interactionDesc}
                  onChange={(e) => setInteractionDesc(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />

                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  Registrar
                </button>
              </div>
            </form>

            {/* Timeline of interactions */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-700 dark:text-slate-300">
                Linha do Tempo de Interações ({dealInteractionsList.length})
              </h4>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {dealInteractionsList.length > 0 ? (
                  dealInteractionsList.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start gap-3"
                    >
                      <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 shrink-0 mt-0.5">
                        {item.type === 'whatsapp' && <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />}
                        {item.type === 'call' && <Phone className="w-3.5 h-3.5 text-blue-600" />}
                        {item.type === 'meeting' && <Users className="w-3.5 h-3.5 text-purple-600" />}
                        {item.type === 'email' && <Mail className="w-3.5 h-3.5 text-amber-600" />}
                        {item.type === 'note' && <FileText className="w-3.5 h-3.5 text-slate-600" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                            {item.type} • {item.userName}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatDate(item.createdAt)}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    Nenhuma interação registrada ainda. Use o formulário acima para registrar contatos.
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Actions: Edit / Delete */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setDeletingDealId(selectedDealForModal.id);
                    setSelectedDealForModal(null);
                  }}
                  className="text-rose-600 hover:text-rose-700 flex items-center gap-1 font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir Negócio
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedDealForModal(null)}
                className="ml-auto px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* PROMPT: MOVER PARA GANHO */}
      <Modal
        isOpen={Boolean(wonDealCandidate)}
        onClose={() => setWonDealCandidate(null)}
        title="Parabéns! Negócio Fechado / Ganho"
        subtitle="Deseja registrar o faturamento no financeiro?"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-sm">
                Valor Total: {formatCurrency(wonDealCandidate?.value)}
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Cliente: {wonDealCandidate?.clientName}
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
            <input
              type="checkbox"
              checked={createIncomeFromWon}
              onChange={(e) => setCreateIncomeFromWon(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
            />
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Gerar lançamento de receita no Financeiro
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Cria automaticamente uma conta a receber no valor de{' '}
                {formatCurrency(wonDealCandidate?.value)}.
              </p>
            </div>
          </label>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setWonDealCandidate(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmWon}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20"
            >
              Confirmar Fechamento
            </button>
          </div>
        </div>
      </Modal>

      {/* PROMPT: MOVER PARA PERDIDO (MOTIVO) */}
      <Modal
        isOpen={Boolean(lostDealCandidate)}
        onClose={() => setLostDealCandidate(null)}
        title="Oportunidade Perdida"
        subtitle="Informe o motivo para alimentar os relatórios de conversão"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Qual foi o principal motivo da perda? *
            </label>
            <select
              value={lossReasonText}
              onChange={(e) => setLossReasonText(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="">Selecione um motivo...</option>
              <option value="Preço / Orçamento fora do limite">Preço / Orçamento fora do limite</option>
              <option value="Fechou com concorrente">Fechou com concorrente</option>
              <option value="Decidiu adiar o projeto">Decidiu adiar o projeto</option>
              <option value="Cliente não respondeu / Desistiu">Cliente não respondeu / Desistiu</option>
              <option value="Falta de funcionalidade específica">Falta de funcionalidade específica</option>
              <option value="Outro motivo">Outro motivo</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setLostDealCandidate(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmLost}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              Confirmar Perda
            </button>
          </div>
        </div>
      </Modal>

      {/* CONFIRMAR EXCLUSÃO */}
      <ConfirmDialog
        isOpen={Boolean(deletingDealId)}
        onClose={() => setDeletingDealId(null)}
        onConfirm={async () => {
          if (!deletingDealId) return;
          try {
            await FirestoreService.deleteDocument(
              'deals',
              deletingDealId,
              profile ? { uid: profile.uid, name: profile.name } : undefined
            );
            success('Negócio excluído com sucesso.');
            setDeletingDealId(null);
          } catch (err: any) {
            error('Erro ao excluir negócio', err?.message);
          }
        }}
        title="Excluir Oportunidade"
        message="Deseja realmente excluir este negócio do funil? O histórico de interações também deixará de ser exibido."
      />
    </div>
  );
}
