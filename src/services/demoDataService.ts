import { subMonths, addDays, subDays, format, setDate } from 'date-fns';
import { backend, type WriteOp } from './backend';
import { FirestoreService } from './firestoreService';
import type {
  Account,
  Actor,
  Category,
  Client,
  Deal,
  KanbanColumn,
  Product,
  Proposal,
  Supplier,
  Task,
  Transaction,
} from '../types';

/* ================= PADRÕES DO SISTEMA ================= */

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_vendas', name: 'Vendas de Produtos', type: 'income', color: '#10b981' },
  { id: 'cat_servicos', name: 'Prestação de Serviços', type: 'income', color: '#3b82f6' },
  { id: 'cat_outras_rec', name: 'Outras Receitas', type: 'income', color: '#06b6d4' },
  { id: 'cat_aluguel', name: 'Aluguel', type: 'expense', color: '#ef4444' },
  { id: 'cat_salarios', name: 'Salários e IPS', type: 'expense', color: '#f97316' },
  { id: 'cat_fornecedores', name: 'Fornecedores / Mercadoria', type: 'expense', color: '#eab308' },
  { id: 'cat_impostos', name: 'Impostos (IVA, IRE)', type: 'expense', color: '#dc2626' },
  { id: 'cat_marketing', name: 'Marketing e Publicidade', type: 'expense', color: '#ec4899' },
  { id: 'cat_utilidades', name: 'Luz (ANDE), Água e Internet', type: 'expense', color: '#6366f1' },
  { id: 'cat_transporte', name: 'Combustível e Transporte', type: 'expense', color: '#64748b' },
  { id: 'cat_manutencao', name: 'Manutenção', type: 'expense', color: '#78716c' },
  { id: 'cat_outras_desp', name: 'Outras Despesas', type: 'expense', color: '#94a3b8' },
];

export const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: 'acc_caixa',
    name: 'Caixa (Efetivo)',
    type: 'cash',
    initialBalance: 0,
    currentBalance: 0,
    color: '#10b981',
    isDefault: true,
  },
  {
    id: 'acc_banco',
    name: 'Conta Bancária',
    type: 'bank',
    initialBalance: 0,
    currentBalance: 0,
    color: '#2563eb',
  },
];

/** Etapas padrão do funil. "ganho" e "perdido" são fixas (o sistema depende delas). */
export const KANBAN_STAGES: KanbanColumn[] = [
  { id: 'novo', title: 'Novo Contato', color: '#64748b' },
  { id: 'negociacao', title: 'Em Negociação', color: '#3b82f6' },
  { id: 'proposta', title: 'Proposta Enviada', color: '#f59e0b' },
  { id: 'ganho', title: 'Fechado / Ganho', color: '#10b981', isWon: true },
  { id: 'perdido', title: 'Perdido', color: '#ef4444', isLost: true },
];

/* ================= DADOS DE DEMONSTRAÇÃO ================= */
// Todo registro de demonstração leva isDemo: true, para poder ser apagado sem tocar nos dados reais.

const DEMO_COLLECTIONS = [
  'clients',
  'suppliers',
  'products',
  'deals',
  'deal_interactions',
  'transactions',
  'tasks',
  'proposals',
  'transfers',
  'accounts',
];

export async function loadDemoData(user?: Actor): Promise<void> {
  const now = new Date();
  const d = (date: Date) => format(date, 'yyyy-MM-dd');
  const ops: WriteOp[] = [];
  const put = (col: string, item: { id: string } & Record<string, any>) =>
    ops.push({ type: 'set', col, id: item.id, data: { ...item, isDemo: true, createdAt: item.createdAt || now.toISOString() } });

  // Empresa (só preenche se ainda não houver cadastro)
  const company = await backend.get('company', 'profile');
  if (!company) {
    ops.push({
      type: 'set',
      col: 'company',
      id: 'profile',
      data: {
        name: 'Empresa Demonstração S.A.',
        tradingName: 'Demo Comercial',
        document: '80012345-0',
        email: 'contato@demo.com.py',
        phone: '021 600 123',
        whatsapp: '0981 123 456',
        street: 'Avda. Mariscal López',
        number: '1234',
        neighborhood: 'Villa Morra',
        city: 'Asunción',
        state: 'Asunción (Capital)',
        receiptNotes: 'Obrigado pela preferência!',
        updatedAt: now.toISOString(),
      },
    });
  }

  // Contas padrão (sem marca de demo, para não sumirem ao apagar a demonstração) + uma conta demo
  const existingAccounts = await backend.getAll<Account>('accounts');
  DEFAULT_ACCOUNTS.forEach((a) => {
    if (!existingAccounts.some((x) => x.id === a.id)) {
      ops.push({ type: 'set', col: 'accounts', id: a.id, data: { ...a, createdAt: now.toISOString() } });
    }
  });
  put('accounts', { id: 'acc_demo_reserva', name: 'Reserva (demo)', type: 'bank', bankName: 'Demo', initialBalance: 20_000_000, currentBalance: 0, color: '#7c3aed' });
  const existingCategories = await backend.getAll<Category>('categories');
  DEFAULT_CATEGORIES.forEach((c) => {
    if (!existingCategories.some((x) => x.id === c.id)) {
      ops.push({ type: 'set', col: 'categories', id: c.id, data: { ...c, createdAt: now.toISOString() } });
    }
  });

  // Clientes
  const clients: Client[] = [
    { id: 'cli_demo_1', type: 'PJ', name: 'Distribuidora del Este S.A.', document: '80045678-1', phone: '061 512 300', whatsapp: '0983 456 789', email: 'compras@deleste.com.py', street: 'Avda. San Blas', number: '450', neighborhood: 'Centro', city: 'Ciudad del Este', state: 'Alto Paraná', source: 'Indicação', tags: ['VIP', 'Atacado'], createdAt: subMonths(now, 6).toISOString() },
    { id: 'cli_demo_2', type: 'PJ', name: 'Restaurante Sabor Guaraní', document: '80098765-4', phone: '021 222 333', whatsapp: '0971 222 333', email: 'admin@saborguarani.com.py', street: 'Calle Palma', number: '780', neighborhood: 'Centro', city: 'Asunción', state: 'Asunción (Capital)', source: 'Instagram', tags: ['Restaurante'], createdAt: subMonths(now, 4).toISOString() },
    { id: 'cli_demo_3', type: 'PF', name: 'María José Benítez', document: '3456789', whatsapp: '0985 111 222', email: 'mariajose@gmail.com', city: 'Encarnación', state: 'Itapúa', birthDate: `1990-${format(now, 'MM')}-18`, source: 'Google', tags: [], createdAt: subMonths(now, 3).toISOString() },
    { id: 'cli_demo_4', type: 'PF', name: 'Carlos Rodrigues da Silva', document: '5123456', whatsapp: '0994 555 666', email: 'carlos.silva@hotmail.com', city: 'Pedro Juan Caballero', state: 'Amambay', source: 'Indicação', tags: ['Brasileiro'], createdAt: subMonths(now, 2).toISOString() },
    { id: 'cli_demo_5', type: 'PJ', name: 'Agro Santa Rosa S.R.L.', document: '80033221-6', phone: '0431 20 100', whatsapp: '0982 333 444', email: 'financeiro@agrosantarosa.com.py', city: 'Santa Rosa del Aguaray', state: 'San Pedro', source: 'Feira / Evento', tags: ['Agro'], createdAt: subMonths(now, 1).toISOString() },
  ];
  clients.forEach((c) => put('clients', c as any));

  // Fornecedores
  const suppliers: Supplier[] = [
    { id: 'sup_demo_1', type: 'PJ', name: 'Importadora Central S.A.', document: '80011122-3', phone: '021 555 000', whatsapp: '0981 555 000', email: 'ventas@importadoracentral.com.py', city: 'Asunción', state: 'Asunción (Capital)', contactPerson: 'Rodrigo Giménez', bankInfo: 'Banco Continental — Cta. 1234567', createdAt: subMonths(now, 6).toISOString() },
    { id: 'sup_demo_2', type: 'PJ', name: 'Logística Rápida S.R.L.', document: '80077788-2', whatsapp: '0972 777 888', city: 'Luque', state: 'Central', contactPerson: 'Ana Duarte', createdAt: subMonths(now, 5).toISOString() },
  ];
  suppliers.forEach((s) => put('suppliers', s as any));

  // Produtos e serviços
  const products: Product[] = [
    { id: 'prod_demo_1', code: 'P-001', name: 'Notebook 15" i5 16GB', type: 'product', costPrice: 3_800_000, salePrice: 5_200_000, marginPercent: 26.9, stockQuantity: 6, minStockQuantity: 2, unit: 'un', createdAt: now.toISOString() },
    { id: 'prod_demo_2', code: 'P-002', name: 'Monitor 24" Full HD', type: 'product', costPrice: 750_000, salePrice: 1_150_000, marginPercent: 34.8, stockQuantity: 1, minStockQuantity: 3, unit: 'un', createdAt: now.toISOString() },
    { id: 'prod_demo_3', code: 'P-003', name: 'Kit teclado + mouse sem fio', type: 'product', costPrice: 120_000, salePrice: 210_000, marginPercent: 42.9, stockQuantity: 25, minStockQuantity: 5, unit: 'un', createdAt: now.toISOString() },
    { id: 'serv_demo_1', code: 'S-001', name: 'Instalação e configuração', type: 'service', costPrice: 0, salePrice: 350_000, marginPercent: 100, stockQuantity: 0, minStockQuantity: 0, unit: 'hr', createdAt: now.toISOString() },
    { id: 'serv_demo_2', code: 'S-002', name: 'Suporte técnico mensal', type: 'service', costPrice: 400_000, salePrice: 1_500_000, marginPercent: 73.3, stockQuantity: 0, minStockQuantity: 0, unit: 'mes', createdAt: now.toISOString() },
  ];
  products.forEach((p) => put('products', p as any));

  // Funil (CRM)
  const deals: Deal[] = [
    { id: 'deal_demo_1', title: 'Renovação de contrato anual', clientId: 'cli_demo_1', clientName: clients[0].name, clientPhone: clients[0].whatsapp, value: 18_000_000, stageId: 'negociacao', stageName: 'Em Negociação', assignedToUserName: 'Vendas', expectedCloseDate: d(addDays(now, 10)), priority: 'high', tags: ['Renovação', 'VIP'], notes: 'Reunião marcada com o gerente financeiro.', createdAt: subDays(now, 15).toISOString() },
    { id: 'deal_demo_2', title: '5 notebooks para o escritório', clientId: 'cli_demo_2', clientName: clients[1].name, clientPhone: clients[1].whatsapp, value: 26_000_000, stageId: 'proposta', stageName: 'Proposta Enviada', assignedToUserName: 'Vendas', expectedCloseDate: d(addDays(now, 5)), priority: 'medium', tags: ['Hardware'], createdAt: subDays(now, 7).toISOString() },
    { id: 'deal_demo_3', title: 'Suporte técnico mensal', clientId: 'cli_demo_5', clientName: clients[4].name, clientPhone: clients[4].whatsapp, value: 1_500_000, stageId: 'novo', stageName: 'Novo Contato', assignedToUserName: 'Vendas', expectedCloseDate: d(addDays(now, 20)), priority: 'low', tags: ['Serviço'], createdAt: subDays(now, 2).toISOString() },
    { id: 'deal_demo_4', title: 'Monitores para a loja', clientId: 'cli_demo_4', clientName: clients[3].name, clientPhone: clients[3].whatsapp, value: 3_450_000, stageId: 'ganho', stageName: 'Fechado / Ganho', assignedToUserName: 'Vendas', wonDate: d(subDays(now, 3)), priority: 'medium', tags: [], createdAt: subDays(now, 20).toISOString() },
    { id: 'deal_demo_5', title: 'Projeto de rede', clientId: 'cli_demo_3', clientName: clients[2].name, clientPhone: clients[2].whatsapp, value: 4_800_000, stageId: 'perdido', stageName: 'Perdido', lostDate: d(subDays(now, 12)), lossReason: 'Preço / Orçamento fora do limite', priority: 'low', tags: [], createdAt: subDays(now, 30).toISOString() },
  ];
  deals.forEach((x) => put('deals', x as any));
  put('deal_interactions', { id: 'int_demo_1', dealId: 'deal_demo_2', type: 'whatsapp', description: 'Orçamento enviado pelo WhatsApp, cliente vai responder até sexta.', date: d(subDays(now, 4)), userId: user?.uid || 'demo', userName: user?.name || 'Vendas', createdAt: subDays(now, 4).toISOString() });

  // Orçamento
  const proposal: Proposal = {
    id: 'prop_demo_1',
    number: `${now.getFullYear()}0001`,
    clientId: 'cli_demo_2',
    clientName: clients[1].name,
    clientDocument: clients[1].document,
    clientPhone: clients[1].whatsapp,
    clientEmail: clients[1].email,
    date: d(subDays(now, 6)),
    validUntil: d(addDays(now, 9)),
    status: 'sent',
    items: [
      { productId: 'prod_demo_1', productName: 'Notebook 15" i5 16GB', quantity: 5, unitPrice: 5_200_000, discount: 0, totalPrice: 26_000_000 },
    ],
    subtotal: 26_000_000,
    discount: 0,
    shipping: 0,
    total: 26_000_000,
    paymentConditions: 'À vista com 5% de desconto ou em 3x',
    createdAt: subDays(now, 6).toISOString(),
  };
  put('proposals', proposal as any);

  // Financeiro: 6 meses de histórico
  let n = 0;
  const trx = (t: Partial<Transaction>) => {
    n++;
    put('transactions', {
      id: `trx_demo_${n}`,
      paymentMethod: 'bank_transfer',
      accountId: 'acc_banco',
      accountName: 'Conta Bancária',
      createdAt: now.toISOString(),
      ...t,
    } as any);
  };

  for (let m = 5; m >= 0; m--) {
    const base = subMonths(now, m);
    const day = (n: number) => d(setDate(base, Math.min(n, 28)));
    const isCurrent = m === 0;
    const upToToday = (n: number) => !isCurrent || n <= now.getDate();

    // Receitas
    [
      { dia: 5, desc: 'Venda de equipamentos', cli: 0, val: 14_500_000 + m * 600_000, cat: 'cat_vendas' },
      { dia: 12, desc: 'Suporte técnico mensal', cli: 4, val: 1_500_000, cat: 'cat_servicos' },
      { dia: 20, desc: 'Venda balcão', cli: 3, val: 3_200_000 + m * 150_000, cat: 'cat_vendas' },
    ].forEach((r) => {
      const paid = upToToday(r.dia);
      trx({
        description: r.desc,
        amount: r.val,
        type: 'income',
        date: day(r.dia),
        dueDate: day(r.dia),
        paymentDate: paid ? day(r.dia) : undefined,
        status: paid ? 'paid' : 'pending',
        categoryId: r.cat,
        categoryName: DEFAULT_CATEGORIES.find((c) => c.id === r.cat)?.name,
        entityType: 'client',
        entityId: clients[r.cli].id,
        entityName: clients[r.cli].name,
        paymentMethod: r.cli === 3 ? 'cash' : 'bank_transfer',
        accountId: r.cli === 3 ? 'acc_caixa' : 'acc_banco',
        accountName: r.cli === 3 ? 'Caixa (Efetivo)' : 'Conta Bancária',
      });
    });

    // Despesas
    [
      { dia: 5, desc: 'Aluguel do local', val: 4_500_000, cat: 'cat_aluguel' },
      { dia: 10, desc: 'Salários da equipe', val: 6_500_000, cat: 'cat_salarios' },
      { dia: 15, desc: 'Compra de mercadoria', val: 6_200_000 + m * 300_000, cat: 'cat_fornecedores', sup: 0 },
      { dia: 18, desc: 'ANDE + internet', val: 950_000, cat: 'cat_utilidades' },
      { dia: 25, desc: 'IVA do mês', val: 1_350_000, cat: 'cat_impostos' },
      { dia: 8, desc: 'Combustível', val: 600_000, cat: 'cat_transporte', cash: true },
    ].forEach((e: any) => {
      const paid = upToToday(e.dia);
      trx({
        description: e.desc,
        amount: e.val,
        type: 'expense',
        date: day(e.dia),
        dueDate: day(e.dia),
        paymentDate: paid ? day(e.dia) : undefined,
        status: paid ? 'paid' : 'pending',
        categoryId: e.cat,
        categoryName: DEFAULT_CATEGORIES.find((c) => c.id === e.cat)?.name,
        entityType: e.sup !== undefined ? 'supplier' : 'none',
        entityId: e.sup !== undefined ? suppliers[e.sup].id : undefined,
        entityName: e.sup !== undefined ? suppliers[e.sup].name : undefined,
        paymentMethod: e.cash ? 'cash' : 'bank_transfer',
        accountId: e.cash ? 'acc_caixa' : 'acc_banco',
        accountName: e.cash ? 'Caixa (Efetivo)' : 'Conta Bancária',
      });
    });
  }

  // Uma conta vencida e uma a receber em 3 dias
  trx({ description: 'Parcela atrasada — cliente', amount: 2_300_000, type: 'income', date: d(subDays(now, 20)), dueDate: d(subDays(now, 6)), status: 'pending', categoryId: 'cat_vendas', categoryName: 'Vendas de Produtos', entityType: 'client', entityId: 'cli_demo_3', entityName: clients[2].name });
  trx({ description: 'Monitores para a loja', amount: 3_450_000, type: 'income', date: d(subDays(now, 3)), dueDate: d(addDays(now, 3)), status: 'pending', categoryId: 'cat_vendas', categoryName: 'Vendas de Produtos', entityType: 'client', entityId: 'cli_demo_4', entityName: clients[3].name, dealId: 'deal_demo_4' });

  // Tarefas
  const tasks: Task[] = [
    { id: 'task_demo_1', title: 'Reunião com Distribuidora del Este', description: 'Apresentar proposta de renovação.', dueDate: d(addDays(now, 2)), dueTime: '14:30', priority: 'high', status: 'pending', assignedToUserName: 'Vendas', clientId: 'cli_demo_1', clientName: clients[0].name, dealId: 'deal_demo_1', dealTitle: deals[0].title, createdAt: now.toISOString() },
    { id: 'task_demo_2', title: 'Repor estoque de monitores', description: 'Estoque abaixo do mínimo.', dueDate: d(addDays(now, 1)), dueTime: '10:00', priority: 'high', status: 'pending', assignedToUserName: 'Compras', createdAt: now.toISOString() },
    { id: 'task_demo_3', title: 'Cobrar parcela atrasada da María José', dueDate: d(subDays(now, 1)), dueTime: '11:00', priority: 'medium', status: 'pending', assignedToUserName: 'Financeiro', clientId: 'cli_demo_3', clientName: clients[2].name, createdAt: subDays(now, 2).toISOString() },
  ];
  tasks.forEach((t) => put('tasks', t as any));

  await backend.batch(ops);
  await FirestoreService.logAudit('create', 'system', 'demo_data', 'Dados de demonstração carregados', user);
}

/** Apaga somente os registros marcados como demonstração */
export async function clearDemoData(user?: Actor): Promise<number> {
  const ops: WriteOp[] = [];
  for (const col of DEMO_COLLECTIONS) {
    const items = await backend.getAll<any>(col);
    items.filter((i) => i.isDemo).forEach((i) => ops.push({ type: 'delete', col, id: i.id }));
  }
  if (ops.length) await backend.batch(ops);
  await FirestoreService.logAudit('delete', 'system', 'demo_data', `Dados de demonstração removidos (${ops.length})`, user);
  return ops.length;
}
