import React, { useState, useMemo } from 'react';
import {
  Plus,
  CheckSquare,
  Square,
  Calendar,
  Clock,
  User,
  AlertCircle,
  Tag,
  Briefcase,
  Users,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  List,
  CalendarDays,
} from 'lucide-react';
import type { Task, Client, Deal, UserProfile } from '../../../types';
import { formatDate } from '../../../utils/formatters';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { EmptyState } from '../../common/EmptyState';
import { FirestoreService } from '../../../services/firestoreService';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TasksViewProps {
  tasks: Task[];
  clients: Client[];
  deals: Deal[];
  users: UserProfile[];
  openCreateTask?: boolean;
  onClearQuickAction?: () => void;
}

export function TasksView({
  tasks,
  clients,
  deals,
  users,
  openCreateTask = false,
  onClearQuickAction,
}: TasksViewProps) {
  const { profile, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Filter
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('pending');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  React.useEffect(() => {
    if (openCreateTask) openNewModal();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Form
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDueDate, setFormDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formDueTime, setFormDueTime] = useState('10:00');
  const [formPriority, setFormPriority] = useState<Task['priority']>('medium');
  const [formAssignee, setFormAssignee] = useState(profile?.name || 'Equipe');
  const [formClientId, setFormClientId] = useState('');
  const [formDealId, setFormDealId] = useState('');

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openNewModal = () => {
    setEditingTask(null);
    setFormTitle('');
    setFormDesc('');
    setFormDueDate(format(new Date(), 'yyyy-MM-dd'));
    setFormDueTime('10:00');
    setFormPriority('medium');
    setFormAssignee(profile?.name || 'Equipe');
    setFormClientId('');
    setFormDealId('');
    setIsModalOpen(true);
  };

  const openEditModal = (t: Task) => {
    setEditingTask(t);
    setFormTitle(t.title);
    setFormDesc(t.description || '');
    setFormDueDate(t.dueDate);
    setFormDueTime(t.dueTime || '10:00');
    setFormPriority(t.priority);
    setFormAssignee(t.assignedToUserName || '');
    setFormClientId(t.clientId || '');
    setFormDealId(t.dealId || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      error('Preencha o título da tarefa.');
      return;
    }

    const client = clients.find((c) => c.id === formClientId);
    const deal = deals.find((d) => d.id === formDealId);

    try {
      if (editingTask) {
        await FirestoreService.updateDocument<Task>(
          'tasks',
          editingTask.id,
          {
            title: formTitle,
            description: formDesc,
            dueDate: formDueDate,
            dueTime: formDueTime,
            priority: formPriority,
            assignedToUserName: formAssignee,
            clientId: formClientId || undefined,
            clientName: client?.name,
            dealId: formDealId || undefined,
            dealTitle: deal?.title,
          },
          profile ? { uid: profile.uid, name: profile.name } : undefined
        );
        success('Tarefa atualizada!');
      } else {
        await FirestoreService.createDocument<Task>(
          'tasks',
          {
            title: formTitle,
            description: formDesc,
            dueDate: formDueDate,
            dueTime: formDueTime,
            priority: formPriority,
            status: 'pending',
            assignedToUserName: formAssignee,
            clientId: formClientId || undefined,
            clientName: client?.name,
            dealId: formDealId || undefined,
            dealTitle: deal?.title,
          } as any,
          profile ? { uid: profile.uid, name: profile.name } : undefined
        );
        success('Tarefa agendada com sucesso!');
      }

      setIsModalOpen(false);
      onClearQuickAction?.();
    } catch (err: any) {
      error('Erro ao salvar tarefa', err?.message);
    }
  };

  const handleToggleStatus = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await FirestoreService.updateDocument<Task>(
        'tasks',
        task.id,
        {
          status: newStatus,
          completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined,
        },
        profile ? { uid: profile.uid, name: profile.name } : undefined
      );
      success(newStatus === 'completed' ? 'Tarefa concluída!' : 'Tarefa reaberta!');
    } catch (err: any) {
      error('Erro ao atualizar tarefa', err?.message);
    }
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      return true;
    }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [tasks, statusFilter]);

  // Calendar monthly matrix generator
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days = [];
    let day = startDate;

    while (day <= endDate) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayTasks = tasks.filter((t) => t.dueDate === dateStr);
      days.push({
        date: day,
        dateStr,
        isCurrentMonth: isSameMonth(day, currentMonth),
        isToday: isSameDay(day, new Date()),
        tasks: dayTasks,
      });
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth, tasks]);

  return (
    <div className="space-y-6">
      {/* Top action and view switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* View mode switcher */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Lista
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'calendar'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Calendário Mensal
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {viewMode === 'list' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <option value="pending">Apenas Pendentes</option>
              <option value="completed">Concluídas</option>
              <option value="all">Todas as Tarefas</option>
            </select>
          )}

          {viewMode === 'calendar' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-slate-800 dark:text-slate-200 min-w-[120px] text-center capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </span>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={openNewModal}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nova Tarefa
          </button>
        </div>
      </div>

      {/* VIEW 1: LIST MODE */}
      {viewMode === 'list' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task) => {
              const isOverdue = task.status === 'pending' && task.dueDate < todayStr;

              return (
                <div
                  key={task.id}
                  className={`p-4 flex items-start justify-between gap-4 transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40 ${
                    task.status === 'completed' ? 'opacity-60 bg-slate-50/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      onClick={() => handleToggleStatus(task)}
                      className={`mt-0.5 text-slate-400 hover:text-blue-600 transition-colors ${
                        task.status === 'completed' ? 'text-emerald-600' : ''
                      }`}
                    >
                      {task.status === 'completed' ? (
                        <CheckSquare className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <h4
                        className={`text-sm font-semibold text-slate-900 dark:text-white ${
                          task.status === 'completed' ? 'line-through text-slate-400' : ''
                        }`}
                      >
                        {task.title}
                      </h4>

                      {task.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      {/* Badges / Links */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px] text-slate-500">
                        <span
                          className={`flex items-center gap-1 font-medium ${
                            isOverdue ? 'text-rose-600 font-bold' : ''
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(task.dueDate)} {task.dueTime ? `às ${task.dueTime}` : ''}
                        </span>

                        {isOverdue && (
                          <Badge variant="danger" size="sm">
                            Atrasada!
                          </Badge>
                        )}

                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {task.assignedToUserName || 'Equipe'}
                        </span>

                        {task.clientName && (
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-600 dark:text-slate-300">
                            Cliente: {task.clientName}
                          </span>
                        )}

                        {task.dealTitle && (
                          <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-600 rounded-md">
                            Negócio: {task.dealTitle}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditModal(task)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setDeletingId(task.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState
              title="Nenhuma tarefa encontrada"
              description="Planeje suas tarefas, follow-ups de vendas e compromissos operacionais."
              actionText="Nova Tarefa"
              onAction={openNewModal}
            />
          )}
        </div>
      )}

      {/* VIEW 2: CALENDAR MONTHLY MATRIX */}
      {viewMode === 'calendar' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Dom</span>
            <span>Seg</span>
            <span>Ter</span>
            <span>Qua</span>
            <span>Qui</span>
            <span>Sex</span>
            <span>Sáb</span>
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((d, idx) => (
              <div
                key={idx}
                className={`min-h-[110px] p-2 rounded-xl border flex flex-col justify-between transition-colors ${
                  d.isCurrentMonth
                    ? 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800'
                    : 'bg-slate-100/30 dark:bg-slate-900/30 border-transparent opacity-40'
                } ${d.isToday ? 'ring-2 ring-blue-500 bg-blue-50/30 dark:bg-blue-950/20' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold ${
                      d.isToday
                        ? 'w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {format(d.date, 'd')}
                  </span>
                  {d.tasks.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {d.tasks.length}
                    </span>
                  )}
                </div>

                {/* Day tasks */}
                <div className="mt-1 space-y-1 overflow-y-auto max-h-16">
                  {d.tasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => openEditModal(task)}
                      className={`text-[10px] p-1 rounded-md truncate cursor-pointer font-medium ${
                        task.status === 'completed'
                          ? 'bg-slate-200 dark:bg-slate-700 line-through text-slate-400'
                          : task.priority === 'high'
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      {task.title}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: CRIAR / EDITAR TAREFA */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); onClearQuickAction?.(); }}
        title={editingTask ? 'Editar Tarefa' : 'Nova Tarefa & Compromisso'}
        subtitle="Defina o prazo, prioridade e responsáveis"
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Título da Tarefa *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Ligar para cliente para fechar proposta..."
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

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
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
              <datalist id="task-assignees">
                {Array.from(new Set([...users.filter((u) => u.active !== false).map((u) => u.name), ...tasks.map((t) => t.assignedToUserName || '')].filter(Boolean))).map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Horário
              </label>
              <input
                type="time"
                value={formDueTime}
                onChange={(e) => setFormDueTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Prioridade
              </label>
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta (Urgente)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Responsável
              </label>
              <input
                type="text"
                placeholder="Nome do responsável"
                value={formAssignee}
                list="task-assignees"
                onChange={(e) => setFormAssignee(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Vincular a Cliente (opcional)
              </label>
              <select
                value={formClientId}
                onChange={(e) => setFormClientId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">Nenhum</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Vincular a Negócio (CRM)
              </label>
              <select
                value={formDealId}
                onChange={(e) => setFormDealId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">Nenhum</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Descrição / Detalhes
            </label>
            <textarea
              rows={2}
              placeholder="Instruções ou pauta da tarefa..."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
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
              Salvar Tarefa
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
              'tasks',
              deletingId,
              profile ? { uid: profile.uid, name: profile.name } : undefined
            );
            success('Tarefa excluída.');
            setDeletingId(null);
          } catch (err: any) {
            error('Erro ao excluir tarefa', err?.message);
          }
        }}
        title="Excluir Tarefa"
        message="Deseja remover esta tarefa da sua agenda?"
      />
    </div>
  );
}
