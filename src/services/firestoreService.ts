import { addMonths, addWeeks, addYears, format, parseISO } from 'date-fns';
import { backend, newId, type Unsub, type WriteOp } from './backend';
import type {
  Actor,
  AuditLog,
  CompanyProfile,
  DealInteraction,
  KanbanColumn,
  Product,
  Proposal,
  Transaction,
  Transfer,
  UserRole,
} from '../types';
import { formatCurrency } from '../utils/formatters';

export const DATA_COLLECTIONS = [
  'clients',
  'suppliers',
  'transactions',
  'accounts',
  'categories',
  'deals',
  'deal_interactions',
  'products',
  'proposals',
  'tasks',
  'transfers',
] as const;

type NewTransaction = Omit<Transaction, 'id' | 'createdAt'> & {
  installmentsCount?: number;
  frequency?: 'weekly' | 'monthly' | 'yearly';
};

/** Quantas ocorrências futuras gerar para lançamentos recorrentes */
const RECURRENCE_COUNT: Record<'weekly' | 'monthly' | 'yearly', number> = {
  weekly: 12,
  monthly: 12,
  yearly: 3,
};

function addPeriod(base: Date, i: number, freq: 'weekly' | 'monthly' | 'yearly') {
  if (freq === 'weekly') return addWeeks(base, i);
  if (freq === 'yearly') return addYears(base, i);
  return addMonths(base, i);
}

export class FirestoreService {
  static get isLocal() {
    return backend.kind === 'local';
  }

  /* ================= AUDITORIA ================= */
  static async logAudit(
    action: AuditLog['action'],
    collectionName: string,
    documentId: string,
    details: string,
    user?: Actor
  ): Promise<void> {
    try {
      const id = newId('log_');
      await backend.set('audit_logs', id, {
        id,
        action,
        collectionName,
        documentId,
        details,
        performedByUserId: user?.uid || 'system',
        performedByUserName: user?.name || 'Sistema',
        timestamp: new Date().toISOString(),
      } satisfies AuditLog);
    } catch (err) {
      console.warn('Falha ao registrar auditoria:', err);
    }
  }

  /* ================= EMPRESA ================= */
  static async updateCompanyProfile(profile: CompanyProfile, user?: Actor): Promise<void> {
    await backend.set(
      'company',
      'profile',
      { ...profile, updatedAt: new Date().toISOString(), updatedBy: user?.name || 'Admin' },
      true
    );
    await this.logAudit('update', 'company', 'profile', 'Dados da empresa atualizados', user);
  }

  static async saveKanbanStages(stages: KanbanColumn[], user?: Actor): Promise<void> {
    await backend.set('company', 'kanban', { stages, updatedAt: new Date().toISOString() }, true);
    await this.logAudit('update', 'company', 'kanban', 'Etapas do funil atualizadas', user);
  }

  /* ================= LEITURA EM TEMPO REAL ================= */
  static subscribeCollection<T>(col: string, onData: (items: T[]) => void, onError?: (e: Error) => void): Unsub {
    return backend.subscribeCol<T>(col, onData, onError);
  }

  static subscribeDoc<T>(col: string, id: string, onData: (data: T | null) => void): Unsub {
    return backend.subscribeDoc<T>(col, id, onData);
  }

  /* ================= CRUD GENÉRICO ================= */
  static async createDocument<T extends { id?: string }>(col: string, data: T, user?: Actor): Promise<string> {
    const id = data.id || newId();
    await backend.set(col, id, {
      ...data,
      id,
      createdAt: (data as any).createdAt || new Date().toISOString(),
      createdBy: user?.uid,
      createdByName: user?.name,
    });
    await this.logAudit('create', col, id, `Criado registro em ${col}`, user);
    return id;
  }

  static async updateDocument<T>(col: string, id: string, data: Partial<T>, user?: Actor): Promise<void> {
    await backend.update(col, id, {
      ...data,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.name || user?.uid,
    });
    await this.logAudit('update', col, id, `Atualizado registro em ${col}`, user);
  }

  static async deleteDocument(col: string, id: string, user?: Actor): Promise<void> {
    await backend.remove(col, id);
    await this.logAudit('delete', col, id, `Excluído registro em ${col}`, user);
  }

  /* ================= FINANCEIRO ================= */

  /**
   * Cria um lançamento simples, parcelado (valor dividido) ou recorrente (valor repetido).
   * Os saldos das contas são calculados a partir dos lançamentos pagos — não é preciso ajustar nada.
   */
  static async createTransactionWithInstallments(data: NewTransaction, user?: Actor): Promise<string[]> {
    const { installmentsCount: rawCount, frequency: rawFreq, ...base } = data;
    const isRecurring = Boolean(base.isRecurring);
    const freq = (isRecurring ? base.recurrenceFrequency : rawFreq) || 'monthly';
    const count = isRecurring ? RECURRENCE_COUNT[freq] : Math.max(1, rawCount || 1);
    const parentId = newId('trx_');
    const baseDue = parseISO(base.dueDate);
    const now = new Date().toISOString();

    // Parcelado: divide em inteiros, sobra vai na 1ª parcela. Recorrente: repete o valor cheio.
    const total = Math.round(base.amount);
    const installmentValue = isRecurring ? total : Math.floor(total / count);
    const remainder = isRecurring ? 0 : total - installmentValue * count;

    const ops: WriteOp[] = [];
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = count === 1 ? parentId : `${parentId}_${i + 1}`;
      ids.push(id);
      const first = i === 0;
      const status = first ? base.status : 'pending';
      const docData: Transaction = {
        ...base,
        id,
        description:
          count > 1 && !isRecurring ? `${base.description} (${i + 1}/${count})` : base.description,
        amount: first ? installmentValue + remainder : installmentValue,
        dueDate: format(addPeriod(baseDue, i, freq), 'yyyy-MM-dd'),
        status,
        paymentDate: status === 'paid' ? base.paymentDate || base.date : undefined,
        installmentNumber: count > 1 && !isRecurring ? i + 1 : undefined,
        totalInstallments: count > 1 && !isRecurring ? count : undefined,
        parentTransactionId: count > 1 ? parentId : undefined,
        recurrenceFrequency: isRecurring ? freq : undefined,
        createdAt: now,
        createdBy: user?.uid,
        createdByName: user?.name,
      };
      ops.push({ type: 'set', col: 'transactions', id, data: docData as any });
    }
    await backend.batch(ops);

    const what = isRecurring
      ? `recorrente (${count} ocorrências)`
      : count > 1
      ? `${count}x de ${formatCurrency(installmentValue)}`
      : formatCurrency(total);
    await this.logAudit('create', 'transactions', parentId, `Criado lançamento: ${base.description} — ${what}`, user);
    return ids;
  }

  static async markTransactionAsPaid(
    transaction: Transaction,
    paymentDate: string = format(new Date(), 'yyyy-MM-dd'),
    accountId?: string,
    user?: Actor
  ): Promise<void> {
    await backend.update('transactions', transaction.id, {
      status: 'paid',
      paymentDate,
      accountId: accountId || transaction.accountId,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.name || user?.uid,
    });
    await this.logAudit(
      'status_change',
      'transactions',
      transaction.id,
      `Baixa: ${transaction.description} (${formatCurrency(transaction.amount)})`,
      user
    );
  }

  static async markTransactionAsPending(transaction: Transaction, user?: Actor): Promise<void> {
    const current = await backend.get('transactions', transaction.id);
    if (!current) return;
    const { paymentDate, ...rest } = current as any;
    await backend.set('transactions', transaction.id, {
      ...rest,
      status: 'pending',
      updatedAt: new Date().toISOString(),
      updatedBy: user?.name || user?.uid,
    });
    await this.logAudit('status_change', 'transactions', transaction.id, `Estorno da baixa: ${transaction.description}`, user);
  }

  static async transferBetweenAccounts(
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    date: string,
    notes?: string,
    user?: Actor,
    names?: { from?: string; to?: string }
  ): Promise<string> {
    const id = newId('trf_');
    const data: Transfer = {
      id,
      fromAccountId,
      fromAccountName: names?.from,
      toAccountId,
      toAccountName: names?.to,
      amount: Math.round(amount),
      date,
      notes,
      createdAt: new Date().toISOString(),
      createdBy: user?.name || 'Sistema',
    };
    await backend.set('transfers', id, data as any);
    await this.logAudit('create', 'transfers', id, `Transferência de ${formatCurrency(amount)} entre contas`, user);
    return id;
  }

  /* ================= ORÇAMENTOS -> VENDA ================= */
  static async nextProposalNumber(existing: Proposal[]): Promise<string> {
    const year = new Date().getFullYear().toString();
    const seqs = existing
      .map((p) => p.number || '')
      .filter((n) => n.startsWith(year))
      .map((n) => parseInt(n.slice(4), 10) || 0);
    const next = (seqs.length ? Math.max(...seqs) : 0) + 1;
    return `${year}${next.toString().padStart(4, '0')}`;
  }

  static async convertProposalToSale(
    proposal: Proposal,
    paymentMethod: Transaction['paymentMethod'],
    accountId: string,
    installmentsCount = 1,
    firstDueDate: string = format(new Date(), 'yyyy-MM-dd'),
    user?: Actor,
    options?: { receivedNow?: boolean; categoryId?: string; categoryName?: string; accountName?: string }
  ): Promise<void> {
    // 1. Baixa do estoque (só produtos físicos)
    const stockOps: WriteOp[] = [];
    for (const item of proposal.items) {
      if (!item.productId) continue;
      const prod = await backend.get<Product>('products', item.productId);
      if (prod && prod.type === 'product') {
        stockOps.push({
          type: 'update',
          col: 'products',
          id: item.productId,
          data: {
            stockQuantity: Math.max(0, (prod.stockQuantity || 0) - item.quantity),
            updatedAt: new Date().toISOString(),
          },
        });
      }
    }
    if (stockOps.length) await backend.batch(stockOps);

    // 2. Contas a receber
    const today = format(new Date(), 'yyyy-MM-dd');
    await this.createTransactionWithInstallments(
      {
        description: `Venda — Orçamento #${proposal.number} (${proposal.clientName})`,
        amount: proposal.total,
        type: 'income',
        date: today,
        dueDate: firstDueDate,
        paymentDate: options?.receivedNow ? today : undefined,
        categoryId: options?.categoryId || 'cat_vendas',
        categoryName: options?.categoryName || 'Vendas de Produtos',
        paymentMethod,
        status: options?.receivedNow ? 'paid' : 'pending',
        entityType: 'client',
        entityId: proposal.clientId,
        entityName: proposal.clientName,
        accountId,
        accountName: options?.accountName,
        proposalId: proposal.id,
        installmentsCount,
        frequency: 'monthly',
      },
      user
    );

    // 3. Orçamento aprovado
    await backend.update('proposals', proposal.id, {
      status: 'approved',
      convertedToSale: true,
      saleDate: today,
      saleInstallments: installmentsCount,
      updatedAt: new Date().toISOString(),
    });
    await this.logAudit(
      'status_change',
      'proposals',
      proposal.id,
      `Orçamento #${proposal.number} virou venda (${formatCurrency(proposal.total)})`,
      user
    );
  }

  /* ================= CRM ================= */
  static async addDealInteraction(interaction: Omit<DealInteraction, 'id' | 'createdAt'>, user?: Actor): Promise<string> {
    const id = newId('act_');
    await backend.set('deal_interactions', id, { ...interaction, id, createdAt: new Date().toISOString() });
    await this.logAudit('create', 'deal_interactions', id, `Interação registrada: ${interaction.type}`, user);
    return id;
  }

  /* ================= USUÁRIOS ================= */
  static async setUserStatus(userId: string, active: boolean, user?: Actor): Promise<void> {
    await backend.update('users', userId, { active, updatedAt: new Date().toISOString() });
    await this.logAudit('status_change', 'users', userId, `Usuário ${active ? 'ativado' : 'desativado'}`, user);
  }

  static async setUserRole(userId: string, role: UserRole, user?: Actor): Promise<void> {
    await backend.update('users', userId, { role, updatedAt: new Date().toISOString() });
    await this.logAudit('status_change', 'users', userId, `Perfil alterado para ${role}`, user);
  }

  /* ================= PADRÕES INICIAIS ================= */
  /** Cria contas e categorias padrão na primeira vez que um admin entra */
  static async ensureDefaults(
    defaults: { accounts: any[]; categories: any[] },
    user?: Actor
  ): Promise<void> {
    try {
      const [accounts, categories] = await Promise.all([backend.getAll('accounts'), backend.getAll('categories')]);
      const ops: WriteOp[] = [];
      const now = new Date().toISOString();
      if (accounts.length === 0) {
        defaults.accounts.forEach((a) => ops.push({ type: 'set', col: 'accounts', id: a.id, data: { ...a, createdAt: now } }));
      }
      if (categories.length === 0) {
        defaults.categories.forEach((c) => ops.push({ type: 'set', col: 'categories', id: c.id, data: { ...c, createdAt: now } }));
      }
      if (ops.length) {
        await backend.batch(ops);
        await this.logAudit('create', 'system', 'defaults', 'Contas e categorias padrão criadas', user);
      }
    } catch (err) {
      console.warn('Não foi possível criar os padrões iniciais:', err);
    }
  }

  /* ================= BACKUP ================= */
  static async exportAllData(): Promise<Record<string, any[]>> {
    const result: Record<string, any[]> = {};
    for (const col of ['company', ...DATA_COLLECTIONS]) {
      try {
        result[col] = await backend.getAll(col);
      } catch (e) {
        console.error(`Erro ao exportar ${col}:`, e);
      }
    }
    return { ...result, _meta: [{ app: 'Gestor Pro', exportedAt: new Date().toISOString(), currency: 'PYG' }] };
  }

  static async importAllData(data: Record<string, any[]>, user?: Actor): Promise<number> {
    const allowed = new Set<string>(['company', ...DATA_COLLECTIONS]);
    const ops: WriteOp[] = [];
    for (const [col, docs] of Object.entries(data)) {
      if (!allowed.has(col) || !Array.isArray(docs)) continue;
      docs.forEach((item) => {
        if (item?.id) ops.push({ type: 'set', col, id: String(item.id), data: item });
      });
    }
    if (!ops.length) throw new Error('O arquivo não contém dados do Gestor Pro.');
    await backend.batch(ops);
    await this.logAudit('create', 'backup', 'import', `Backup restaurado (${ops.length} registros)`, user);
    return ops.length;
  }
}
