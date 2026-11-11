import { writeBatch, doc, getDocs, collection } from 'firebase/firestore';
import { db } from './firebase';
import { FirestoreService } from './firestoreService';
import { subMonths, addDays, subDays, format } from 'date-fns';
import type {
  Client,
  Supplier,
  Product,
  Deal,
  Account,
  Category,
  Transaction,
  CompanyProfile,
  Task,
} from '../types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_vendas', name: 'Vendas de Produtos', type: 'income', color: '#10b981' },
  { id: 'cat_servicos', name: 'Prestação de Serviços', type: 'income', color: '#3b82f6' },
  { id: 'cat_rendimentos', name: 'Rendimentos Financeiros', type: 'income', color: '#8b5cf6' },
  { id: 'cat_outras_rec', name: 'Outras Receitas', type: 'income', color: '#06b6d4' },
  { id: 'cat_aluguel', name: 'Aluguel e Condomínio', type: 'expense', color: '#ef4444' },
  { id: 'cat_salarios', name: 'Salários e Encargos', type: 'expense', color: '#f97316' },
  { id: 'cat_fornecedores', name: 'Fornecedores e Matéria-Prima', type: 'expense', color: '#eab308' },
  { id: 'cat_impostos', name: 'Impostos e Taxas', type: 'expense', color: '#dc2626' },
  { id: 'cat_marketing', name: 'Marketing e Vendas', type: 'expense', color: '#ec4899' },
  { id: 'cat_utilidades', name: 'Água, Luz e Internet', type: 'expense', color: '#6366f1' },
  { id: 'cat_transporte', name: 'Transporte e Combustível', type: 'expense', color: '#64748b' },
  { id: 'cat_manutencao', name: 'Manutenção e TI', type: 'expense', color: '#78716c' },
  { id: 'cat_outras_desp', name: 'Outras Despesas', type: 'expense', color: '#94a3b8' },
];

export const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: 'acc_itau',
    name: 'Banco Itaú Empresas',
    type: 'bank',
    bankName: 'Itaú Unibanco',
    initialBalance: 15000.0,
    currentBalance: 42350.8,
    color: '#ec7000',
    isDefault: true,
  },
  {
    id: 'acc_bb',
    name: 'Banco do Brasil',
    type: 'bank',
    bankName: 'Banco do Brasil',
    initialBalance: 10000.0,
    currentBalance: 18450.0,
    color: '#003882',
  },
  {
    id: 'acc_caixa',
    name: 'Caixa Pequeno / Espécie',
    type: 'cash',
    initialBalance: 1000.0,
    currentBalance: 3120.0,
    color: '#10b981',
  },
];

export const KANBAN_STAGES = [
  { id: 'novo', title: 'Novo Contato', color: '#64748b' },
  { id: 'negociacao', title: 'Em Negociação', color: '#3b82f6' },
  { id: 'proposta', title: 'Proposta Enviada', color: '#f59e0b' },
  { id: 'ganho', title: 'Fechado / Ganho', color: '#10b981', isWon: true },
  { id: 'perdido', title: 'Perdido', color: '#ef4444', isLost: true },
];

export async function loadDemoData(user?: { uid: string; name: string }): Promise<void> {
  if (!db) throw new Error('Firebase não está conectado.');

  const batch = writeBatch(db);
  const now = new Date();

  // 1. Company Profile
  const companyProfile: CompanyProfile = {
    name: 'Gestor Pro Soluções e Tecnologia Ltda',
    tradingName: 'Gestor Pro Soluções',
    document: '28.192.384/0001-45',
    email: 'contato@gestorpro.com.br',
    phone: '(11) 3280-9900',
    whatsapp: '11987654321',
    website: 'https://gestorpro.com.br',
    cep: '01310-100',
    street: 'Avenida Paulista',
    number: '1200',
    complement: 'Conjunto 810',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    receiptNotes: 'Agradecemos a sua preferência! Documento emitido para fins de comprovação interna.',
    updatedAt: now.toISOString(),
    updatedBy: user?.name || 'Administrador',
  };
  batch.set(doc(db, 'company', 'profile'), companyProfile);

  // 2. Default Accounts & Categories
  for (const acc of DEFAULT_ACCOUNTS) {
    batch.set(doc(db, 'accounts', acc.id), acc);
  }
  for (const cat of DEFAULT_CATEGORIES) {
    batch.set(doc(db, 'categories', cat.id), cat);
  }

  // 3. Clients
  const clients: Client[] = [
    {
      id: 'cli_techcorp',
      type: 'PJ',
      name: 'TechCorp Soluções Digitais Ltda',
      document: '45.123.789/0001-12',
      phone: '(11) 3140-5500',
      whatsapp: '11998765432',
      email: 'compras@techcorp.com.br',
      cep: '04543-011',
      street: 'Av. Brigadeiro Faria Lima',
      number: '3477',
      complement: '14º andar',
      neighborhood: 'Itaim Bibi',
      city: 'São Paulo',
      state: 'SP',
      source: 'Google Ads',
      notes: 'Cliente corporativo com faturamento mensal. Contrato com SLA de 4 horas.',
      tags: ['VIP', 'Recorrente', 'Corporativo'],
      createdAt: subMonths(now, 5).toISOString(),
    },
    {
      id: 'cli_mariana',
      type: 'PF',
      name: 'Mariana Souza Alcantara',
      document: '215.894.638-40',
      phone: '(11) 98455-1234',
      whatsapp: '11984551234',
      email: 'mariana.alcantara@gmail.com',
      cep: '01415-000',
      street: 'Rua Bela Cintra',
      number: '1850',
      neighborhood: 'Consolação',
      city: 'São Paulo',
      state: 'SP',
      birthDate: '1988-11-15',
      source: 'Indicação',
      notes: 'Aniversariante de Novembro. Sempre solicita recibo por e-mail.',
      tags: ['Pessoa Física', 'Pontual'],
      createdAt: subMonths(now, 4).toISOString(),
    },
    {
      id: 'cli_sabor',
      type: 'PJ',
      name: 'Restaurante Sabor & Arte Eireli',
      document: '18.445.987/0001-34',
      phone: '(11) 2233-8899',
      whatsapp: '11977665544',
      email: 'financeiro@saborearte.com.br',
      cep: '05407-002',
      street: 'Rua dos Pinheiros',
      number: '450',
      neighborhood: 'Pinheiros',
      city: 'São Paulo',
      state: 'SP',
      source: 'Instagram',
      notes: 'Rede de 3 restaurantes. Negociando implantação de software nas demais filiais.',
      tags: ['Restaurante', 'Em expansão'],
      createdAt: subMonths(now, 3).toISOString(),
    },
    {
      id: 'cli_lucas',
      type: 'PF',
      name: 'Lucas Oliveira Martins',
      document: '388.945.128-09',
      phone: '(21) 99123-4567',
      whatsapp: '21991234567',
      email: 'lucas.martins@outlook.com',
      cep: '22041-001',
      street: 'Av. Nossa Senhora de Copacabana',
      number: '680',
      neighborhood: 'Copacabana',
      city: 'Rio de Janeiro',
      state: 'RJ',
      birthDate: '1992-04-20',
      source: 'Evento Tech Summit',
      notes: 'Consultor independente de TI.',
      tags: ['Consultoria', 'Remoto'],
      createdAt: subMonths(now, 2).toISOString(),
    },
    {
      id: 'cli_progresso',
      type: 'PJ',
      name: 'Distribuidora Progresso S.A.',
      document: '62.987.321/0001-55',
      phone: '(19) 3871-2000',
      whatsapp: '19981112233',
      email: 'fiscal@distprogresso.com.br',
      cep: '13010-000',
      street: 'Av. Francisco Glicério',
      number: '1400',
      neighborhood: 'Centro',
      city: 'Campinas',
      state: 'SP',
      source: 'Prospecção Ativa',
      notes: 'Grande volume de pedidos trimestrais.',
      tags: ['Atacado', 'Alto Volume'],
      createdAt: subMonths(now, 6).toISOString(),
    },
  ];
  for (const c of clients) {
    batch.set(doc(db, 'clients', c.id), c);
  }

  // 4. Suppliers
  const suppliers: Supplier[] = [
    {
      id: 'sup_dell',
      type: 'PJ',
      name: 'Dell Computadores do Brasil Ltda',
      document: '72.381.189/0001-10',
      phone: '0800-701-1268',
      email: 'vendas_empresas@dell.com',
      cep: '92990-000',
      street: 'Av. Industrial',
      number: '500',
      neighborhood: 'Distrito Industrial',
      city: 'Eldorado do Sul',
      state: 'RS',
      contactPerson: 'Carlos Eduardo Ramos',
      bankInfo: 'Banco Santander - Ag: 3340 C/C: 1300994-1',
      notes: 'Fornecedor homologado de equipamentos e servidores.',
      tags: ['Hardware', 'Homologado'],
      createdAt: subMonths(now, 6).toISOString(),
    },
    {
      id: 'sup_imobiliaria',
      type: 'PJ',
      name: 'Imobiliária Prime Paulista S/C',
      document: '51.984.321/0001-88',
      phone: '(11) 3344-9988',
      email: 'locacao@primepaulista.com.br',
      cep: '01311-000',
      street: 'Alameda Santos',
      number: '900',
      neighborhood: 'Cerqueira César',
      city: 'São Paulo',
      state: 'SP',
      contactPerson: 'Renata Vasconcelos',
      pixKey: 'financeiro@primepaulista.com.br',
      notes: 'Locação do escritório matriz. Vencimento no dia 10 de cada mês.',
      tags: ['Aluguel', 'Recorrente'],
      createdAt: subMonths(now, 6).toISOString(),
    },
    {
      id: 'sup_enel',
      type: 'PJ',
      name: 'Enel Distribuição São Paulo',
      document: '61.695.227/0001-93',
      phone: '0800-7272-120',
      email: 'contato@eneldistribuicao.com.br',
      city: 'Barueri',
      state: 'SP',
      notes: 'Concessionária de energia elétrica.',
      tags: ['Concessionária', 'Utilidades'],
      createdAt: subMonths(now, 6).toISOString(),
    },
  ];
  for (const s of suppliers) {
    batch.set(doc(db, 'suppliers', s.id), s);
  }

  // 5. Products & Services
  const products: Product[] = [
    {
      id: 'prod_consultoria',
      code: 'SRV-001',
      name: 'Consultoria Estratégica em TI (Hora)',
      type: 'service',
      costPrice: 80.0,
      salePrice: 220.0,
      marginPercent: 63.6,
      stockQuantity: 999,
      minStockQuantity: 0,
      unit: 'hr',
      notes: 'Cobrado por hora de especialista técnico.',
      createdAt: subMonths(now, 6).toISOString(),
    },
    {
      id: 'prod_implantacao',
      code: 'SRV-002',
      name: 'Implantação Completa do Sistema ERP',
      type: 'service',
      costPrice: 1200.0,
      salePrice: 4500.0,
      marginPercent: 73.3,
      stockQuantity: 999,
      minStockQuantity: 0,
      unit: 'un',
      notes: 'Inclui parametrização, migração de dados e treinamento de até 10 usuários.',
      createdAt: subMonths(now, 6).toISOString(),
    },
    {
      id: 'prod_mensalidade',
      code: 'SRV-003',
      name: 'Licença Mensal Gestor Pro Cloud',
      type: 'service',
      costPrice: 25.0,
      salePrice: 189.9,
      marginPercent: 86.8,
      stockQuantity: 999,
      minStockQuantity: 0,
      unit: 'mês',
      notes: 'Assinatura mensal com suporte e backup diário.',
      createdAt: subMonths(now, 6).toISOString(),
    },
    {
      id: 'prod_servidor',
      code: 'HRD-001',
      name: 'Servidor Dell PowerEdge T150 Xeon',
      type: 'product',
      costPrice: 3200.0,
      salePrice: 5490.0,
      marginPercent: 41.7,
      stockQuantity: 4,
      minStockQuantity: 2,
      unit: 'un',
      notes: 'Garantia de 3 anos on-site com a Dell.',
      createdAt: subMonths(now, 6).toISOString(),
    },
    {
      id: 'prod_nobreak',
      code: 'HRD-002',
      name: 'No-Break Senoidal APC 1500VA Bivolt',
      type: 'product',
      costPrice: 790.0,
      salePrice: 1350.0,
      marginPercent: 41.5,
      stockQuantity: 1, // Alerta: abaixo do estoque mínimo!
      minStockQuantity: 3,
      unit: 'un',
      notes: 'Atenção: Estoque crítico!',
      createdAt: subMonths(now, 6).toISOString(),
    },
    {
      id: 'prod_switch',
      code: 'HRD-003',
      name: 'Switch Gigabit 24 Portas Gerenciável',
      type: 'product',
      costPrice: 450.0,
      salePrice: 890.0,
      marginPercent: 49.4,
      stockQuantity: 6,
      minStockQuantity: 2,
      unit: 'un',
      notes: 'Equipamento para infraestrutura de rede corporativa.',
      createdAt: subMonths(now, 6).toISOString(),
    },
  ];
  for (const p of products) {
    batch.set(doc(db, 'products', p.id), p);
  }

  // 6. CRM Deals
  const deals: Deal[] = [
    {
      id: 'deal_1',
      title: 'Renovação Anual Contrato TI - TechCorp',
      clientId: 'cli_techcorp',
      clientName: 'TechCorp Soluções Digitais Ltda',
      clientPhone: '(11) 3140-5500',
      clientEmail: 'compras@techcorp.com.br',
      value: 18500.0,
      stageId: 'negociacao',
      stageName: 'Em Negociação',
      assignedToUserName: 'Rodrigo Vendas',
      expectedCloseDate: format(addDays(now, 10), 'yyyy-MM-dd'),
      priority: 'high',
      tags: ['Renovação', 'Recorrente', 'VIP'],
      notes: 'Reunião marcada com o diretor financeiro para apresentação do escopo.',
      createdAt: subDays(now, 15).toISOString(),
    },
    {
      id: 'deal_2',
      title: 'Implantação ERP + 2 No-breaks - Sabor & Arte',
      clientId: 'cli_sabor',
      clientName: 'Restaurante Sabor & Arte Eireli',
      clientPhone: '(11) 2233-8899',
      clientEmail: 'financeiro@saborearte.com.br',
      value: 7200.0,
      stageId: 'proposta',
      stageName: 'Proposta Enviada',
      assignedToUserName: 'Ana Comercial',
      expectedCloseDate: format(addDays(now, 5), 'yyyy-MM-dd'),
      priority: 'medium',
      tags: ['Proposta', 'Restaurante'],
      notes: 'Orçamento enviado por PDF e WhatsApp. Aguardando aceite da diretoria.',
      createdAt: subDays(now, 7).toISOString(),
    },
    {
      id: 'deal_3',
      title: 'Expansão de Infraestrutura de Servidores - Progresso',
      clientId: 'cli_progresso',
      clientName: 'Distribuidora Progresso S.A.',
      clientPhone: '(19) 3871-2000',
      value: 27450.0,
      stageId: 'novo',
      stageName: 'Novo Contato',
      assignedToUserName: 'Rodrigo Vendas',
      expectedCloseDate: format(addDays(now, 25), 'yyyy-MM-dd'),
      priority: 'high',
      tags: ['Infraestrutura', 'Hardware'],
      notes: 'Recebido contato pelo site solicitando cotação para 3 servidores e migração.',
      createdAt: subDays(now, 2).toISOString(),
    },
    {
      id: 'deal_4',
      title: 'Pacote de Consultoria Mensal 30h - Lucas Martins',
      clientId: 'cli_lucas',
      clientName: 'Lucas Oliveira Martins',
      clientPhone: '(21) 99123-4567',
      value: 6600.0,
      stageId: 'ganho',
      stageName: 'Fechado / Ganho',
      assignedToUserName: 'Ana Comercial',
      expectedCloseDate: format(subDays(now, 3), 'yyyy-MM-dd'),
      priority: 'medium',
      tags: ['Ganho', 'Consultoria'],
      wonDate: format(subDays(now, 3), 'yyyy-MM-dd'),
      notes: 'Contrato assinado digitalmente e primeira parcela faturada.',
      createdAt: subDays(now, 20).toISOString(),
    },
    {
      id: 'deal_5',
      title: 'Projeto Piloto Automação Comercial - Alpha Ltda',
      clientId: 'cli_mariana',
      clientName: 'Mariana Souza Alcantara',
      value: 4800.0,
      stageId: 'perdido',
      stageName: 'Perdido',
      assignedToUserName: 'Rodrigo Vendas',
      priority: 'low',
      tags: ['Perdido'],
      lostDate: format(subDays(now, 12), 'yyyy-MM-dd'),
      lossReason: 'Orçamento acima do valor pretendido pelo cliente neste momento.',
      createdAt: subDays(now, 30).toISOString(),
    },
  ];
  for (const d of deals) {
    batch.set(doc(db, 'deals', d.id), d);
  }

  // 7. Deal Interactions
  const interactionId = `int_1`;
  batch.set(doc(db, 'deal_interactions', interactionId), {
    id: interactionId,
    dealId: 'deal_2',
    type: 'whatsapp',
    description: 'Enviado o PDF da proposta comercial via WhatsApp para confirmação dos dados de faturamento.',
    date: format(subDays(now, 4), 'yyyy-MM-dd'),
    userId: user?.uid || 'user_1',
    userName: 'Ana Comercial',
    createdAt: subDays(now, 4).toISOString(),
  });

  // 8. 6 Months of Financial Transactions (Paid, Pending, Overdue)
  const transactions: Transaction[] = [];

  // Generate historical data for past 5 months (all paid)
  for (let m = 5; m >= 1; m--) {
    const monthDate = subMonths(now, m);
    const monthStr = format(monthDate, 'yyyy-MM');

    // Incomes
    transactions.push({
      id: `tx_inc_${monthStr}_1`,
      description: `Mensalidades Software Gestor Pro (${format(monthDate, 'MM/yyyy')})`,
      amount: 14500.0 + m * 800,
      type: 'income',
      date: `${monthStr}-05`,
      dueDate: `${monthStr}-05`,
      paymentDate: `${monthStr}-05`,
      categoryId: 'cat_servicos',
      categoryName: 'Prestação de Serviços',
      paymentMethod: 'pix',
      status: 'paid',
      entityType: 'none',
      accountId: 'acc_itau',
      accountName: 'Banco Itaú Empresas',
      createdAt: `${monthStr}-01T10:00:00.000Z`,
    });

    transactions.push({
      id: `tx_inc_${monthStr}_2`,
      description: `Faturamento Venda Equipamentos e Servidores`,
      amount: 9800.0 + m * 500,
      type: 'income',
      date: `${monthStr}-15`,
      dueDate: `${monthStr}-15`,
      paymentDate: `${monthStr}-15`,
      categoryId: 'cat_vendas',
      categoryName: 'Vendas de Produtos',
      paymentMethod: 'bank_slip',
      status: 'paid',
      entityType: 'client',
      entityId: 'cli_techcorp',
      entityName: 'TechCorp Soluções Digitais Ltda',
      accountId: 'acc_itau',
      accountName: 'Banco Itaú Empresas',
      createdAt: `${monthStr}-02T10:00:00.000Z`,
    });

    // Expenses
    transactions.push({
      id: `tx_exp_${monthStr}_aluguel`,
      description: `Aluguel Escritório Av. Paulista (${format(monthDate, 'MM/yyyy')})`,
      amount: 4200.0,
      type: 'expense',
      date: `${monthStr}-10`,
      dueDate: `${monthStr}-10`,
      paymentDate: `${monthStr}-10`,
      categoryId: 'cat_aluguel',
      categoryName: 'Aluguel e Condomínio',
      paymentMethod: 'bank_transfer',
      status: 'paid',
      entityType: 'supplier',
      entityId: 'sup_imobiliaria',
      entityName: 'Imobiliária Prime Paulista S/C',
      accountId: 'acc_itau',
      accountName: 'Banco Itaú Empresas',
      createdAt: `${monthStr}-01T10:00:00.000Z`,
    });

    transactions.push({
      id: `tx_exp_${monthStr}_salarios`,
      description: `Folha de Pagamento da Equipe (${format(monthDate, 'MM/yyyy')})`,
      amount: 11500.0,
      type: 'expense',
      date: `${monthStr}-05`,
      dueDate: `${monthStr}-05`,
      paymentDate: `${monthStr}-05`,
      categoryId: 'cat_salarios',
      categoryName: 'Salários e Encargos',
      paymentMethod: 'bank_transfer',
      status: 'paid',
      entityType: 'none',
      accountId: 'acc_bb',
      accountName: 'Banco do Brasil',
      createdAt: `${monthStr}-01T10:00:00.000Z`,
    });

    transactions.push({
      id: `tx_exp_${monthStr}_utilidades`,
      description: `Energia Elétrica Enel + Internet Fibra`,
      amount: 850.0 + m * 20,
      type: 'expense',
      date: `${monthStr}-18`,
      dueDate: `${monthStr}-18`,
      paymentDate: `${monthStr}-18`,
      categoryId: 'cat_utilidades',
      categoryName: 'Água, Luz e Internet',
      paymentMethod: 'pix',
      status: 'paid',
      entityType: 'supplier',
      entityId: 'sup_enel',
      entityName: 'Enel Distribuição São Paulo',
      accountId: 'acc_itau',
      accountName: 'Banco Itaú Empresas',
      createdAt: `${monthStr}-05T10:00:00.000Z`,
    });

    transactions.push({
      id: `tx_exp_${monthStr}_fornecedor`,
      description: `Aquisição de Lote No-breaks e Peças Dell`,
      amount: 3800.0,
      type: 'expense',
      date: `${monthStr}-22`,
      dueDate: `${monthStr}-22`,
      paymentDate: `${monthStr}-22`,
      categoryId: 'cat_fornecedores',
      categoryName: 'Fornecedores e Matéria-Prima',
      paymentMethod: 'bank_slip',
      status: 'paid',
      entityType: 'supplier',
      entityId: 'sup_dell',
      entityName: 'Dell Computadores do Brasil Ltda',
      accountId: 'acc_itau',
      accountName: 'Banco Itaú Empresas',
      createdAt: `${monthStr}-10T10:00:00.000Z`,
    });
  }

  // Current Month transactions (Includes paid, pending, and overdue!)
  const curMonthStr = format(now, 'yyyy-MM');

  // Paid this month
  transactions.push({
    id: `tx_cur_inc_1`,
    description: 'Consultoria Trimestral Lucas Oliveira (Parcela 1/3)',
    amount: 2200.0,
    type: 'income',
    date: `${curMonthStr}-03`,
    dueDate: `${curMonthStr}-03`,
    paymentDate: `${curMonthStr}-03`,
    categoryId: 'cat_servicos',
    categoryName: 'Prestação de Serviços',
    paymentMethod: 'pix',
    status: 'paid',
    entityType: 'client',
    entityId: 'cli_lucas',
    entityName: 'Lucas Oliveira Martins',
    accountId: 'acc_itau',
    accountName: 'Banco Itaú Empresas',
    createdAt: now.toISOString(),
  });

  transactions.push({
    id: `tx_cur_inc_2`,
    description: 'Venda de Servidor Dell PowerEdge - TechCorp',
    amount: 5490.0,
    type: 'income',
    date: `${curMonthStr}-08`,
    dueDate: `${curMonthStr}-08`,
    paymentDate: `${curMonthStr}-08`,
    categoryId: 'cat_vendas',
    categoryName: 'Vendas de Produtos',
    paymentMethod: 'credit_card',
    status: 'paid',
    entityType: 'client',
    entityId: 'cli_techcorp',
    entityName: 'TechCorp Soluções Digitais Ltda',
    accountId: 'acc_itau',
    accountName: 'Banco Itaú Empresas',
    createdAt: now.toISOString(),
  });

  transactions.push({
    id: `tx_cur_exp_aluguel`,
    description: `Aluguel Escritório Av. Paulista (${format(now, 'MM/yyyy')})`,
    amount: 4200.0,
    type: 'expense',
    date: `${curMonthStr}-10`,
    dueDate: `${curMonthStr}-10`,
    paymentDate: `${curMonthStr}-10`,
    categoryId: 'cat_aluguel',
    categoryName: 'Aluguel e Condomínio',
    paymentMethod: 'bank_transfer',
    status: 'paid',
    entityType: 'supplier',
    entityId: 'sup_imobiliaria',
    entityName: 'Imobiliária Prime Paulista S/C',
    accountId: 'acc_itau',
    accountName: 'Banco Itaú Empresas',
    createdAt: now.toISOString(),
  });

  // PENDING upcoming in 3-7 days
  transactions.push({
    id: `tx_cur_pend_rec_1`,
    description: 'Faturamento Mensal Software TechCorp',
    amount: 6800.0,
    type: 'income',
    date: format(now, 'yyyy-MM-dd'),
    dueDate: format(addDays(now, 4), 'yyyy-MM-dd'),
    categoryId: 'cat_servicos',
    categoryName: 'Prestação de Serviços',
    paymentMethod: 'bank_slip',
    status: 'pending',
    entityType: 'client',
    entityId: 'cli_techcorp',
    entityName: 'TechCorp Soluções Digitais Ltda',
    accountId: 'acc_itau',
    accountName: 'Banco Itaú Empresas',
    createdAt: now.toISOString(),
  });

  transactions.push({
    id: `tx_cur_pend_rec_2`,
    description: 'Orçamento Aprovado - Restaurante Sabor & Arte',
    amount: 3600.0,
    type: 'income',
    date: format(now, 'yyyy-MM-dd'),
    dueDate: format(addDays(now, 6), 'yyyy-MM-dd'),
    categoryId: 'cat_servicos',
    categoryName: 'Prestação de Serviços',
    paymentMethod: 'pix',
    status: 'pending',
    entityType: 'client',
    entityId: 'cli_sabor',
    entityName: 'Restaurante Sabor & Arte Eireli',
    accountId: 'acc_bb',
    accountName: 'Banco do Brasil',
    createdAt: now.toISOString(),
  });

  transactions.push({
    id: `tx_cur_pend_pay_1`,
    description: 'Enel Energia Elétrica Matriz',
    amount: 940.5,
    type: 'expense',
    date: format(now, 'yyyy-MM-dd'),
    dueDate: format(addDays(now, 3), 'yyyy-MM-dd'),
    categoryId: 'cat_utilidades',
    categoryName: 'Água, Luz e Internet',
    paymentMethod: 'bank_slip',
    status: 'pending',
    entityType: 'supplier',
    entityId: 'sup_enel',
    entityName: 'Enel Distribuição São Paulo',
    accountId: 'acc_itau',
    accountName: 'Banco Itaú Empresas',
    createdAt: now.toISOString(),
  });

  transactions.push({
    id: `tx_cur_pend_pay_2`,
    description: 'Fornecedor Dell - Fatura de Peças Reposição',
    amount: 2450.0,
    type: 'expense',
    date: format(now, 'yyyy-MM-dd'),
    dueDate: format(addDays(now, 7), 'yyyy-MM-dd'),
    categoryId: 'cat_fornecedores',
    categoryName: 'Fornecedores e Matéria-Prima',
    paymentMethod: 'bank_slip',
    status: 'pending',
    entityType: 'supplier',
    entityId: 'sup_dell',
    entityName: 'Dell Computadores do Brasil Ltda',
    accountId: 'acc_itau',
    accountName: 'Banco Itaú Empresas',
    createdAt: now.toISOString(),
  });

  // OVERDUE transaction (highlight in red on dashboard)
  transactions.push({
    id: `tx_cur_overdue_1`,
    description: 'Manutenção Preventiva de Ar Condicionado',
    amount: 680.0,
    type: 'expense',
    date: format(subDays(now, 10), 'yyyy-MM-dd'),
    dueDate: format(subDays(now, 3), 'yyyy-MM-dd'),
    categoryId: 'cat_manutencao',
    categoryName: 'Manutenção e TI',
    paymentMethod: 'bank_slip',
    status: 'overdue',
    entityType: 'none',
    accountId: 'acc_caixa',
    accountName: 'Caixa Pequeno / Espécie',
    notes: 'Boleto vencido há 3 dias. Verificar acréscimo de juros.',
    createdAt: subDays(now, 10).toISOString(),
  });

  transactions.push({
    id: `tx_cur_overdue_rec`,
    description: 'Mensalidade Suporte - Cliente Atrasado',
    amount: 1250.0,
    type: 'income',
    date: format(subDays(now, 12), 'yyyy-MM-dd'),
    dueDate: format(subDays(now, 4), 'yyyy-MM-dd'),
    categoryId: 'cat_servicos',
    categoryName: 'Prestação de Serviços',
    paymentMethod: 'bank_slip',
    status: 'overdue',
    entityType: 'client',
    entityId: 'cli_mariana',
    entityName: 'Mariana Souza Alcantara',
    accountId: 'acc_itau',
    accountName: 'Banco Itaú Empresas',
    notes: 'Cobrança enviada por WhatsApp para regularização.',
    createdAt: subDays(now, 12).toISOString(),
  });

  for (const t of transactions) {
    batch.set(doc(db, 'transactions', t.id), t);
  }

  // 9. Tasks & Schedule
  const tasks: Task[] = [
    {
      id: 'task_1',
      title: 'Apresentação comercial com diretor da TechCorp',
      description: 'Apresentar escopo da renovação de contrato e novos SLAs de atendimento.',
      dueDate: format(addDays(now, 2), 'yyyy-MM-dd'),
      dueTime: '14:30',
      priority: 'high',
      status: 'pending',
      assignedToUserName: 'Rodrigo Vendas',
      clientId: 'cli_techcorp',
      clientName: 'TechCorp Soluções Digitais Ltda',
      dealId: 'deal_1',
      dealTitle: 'Renovação Anual Contrato TI - TechCorp',
      createdAt: now.toISOString(),
    },
    {
      id: 'task_2',
      title: 'Repor estoque de No-Breaks APC (Estoque Crítico)',
      description: 'Cotar lote de 5 unidades com a distribuidora autorizada.',
      dueDate: format(addDays(now, 1), 'yyyy-MM-dd'),
      dueTime: '10:00',
      priority: 'high',
      status: 'pending',
      assignedToUserName: 'Gerente Operações',
      createdAt: now.toISOString(),
    },
    {
      id: 'task_3',
      title: 'Emitir Nota Fiscal e Recibo do Lucas Martins',
      description: 'Lançamento de entrada já recebido via Pix.',
      dueDate: format(now, 'yyyy-MM-dd'),
      dueTime: '17:00',
      priority: 'medium',
      status: 'pending',
      assignedToUserName: 'Financeiro',
      clientId: 'cli_lucas',
      clientName: 'Lucas Oliveira Martins',
      createdAt: now.toISOString(),
    },
    {
      id: 'task_4',
      title: 'Ligar para Mariana Souza - Cobrança amigável',
      description: 'Verificar se recebeu o código de barras atualizado.',
      dueDate: format(subDays(now, 1), 'yyyy-MM-dd'), // Overdue badge!
      dueTime: '11:00',
      priority: 'high',
      status: 'pending',
      assignedToUserName: 'Financeiro',
      clientId: 'cli_mariana',
      clientName: 'Mariana Souza Alcantara',
      createdAt: subDays(now, 2).toISOString(),
    },
  ];
  for (const task of tasks) {
    batch.set(doc(db, 'tasks', task.id), task);
  }

  await batch.commit();

  await FirestoreService.logAudit(
    'create',
    'system',
    'demo_data',
    'Conjunto completo de dados de demonstração carregado com sucesso',
    user
  );
}

export async function clearDemoData(user?: { uid: string; name: string }): Promise<void> {
  if (!db) throw new Error('Firebase não está conectado.');

  const collectionsToClear = [
    'clients',
    'suppliers',
    'products',
    'deals',
    'deal_interactions',
    'transactions',
    'tasks',
    'proposals',
    'transfers',
  ];

  for (const colName of collectionsToClear) {
    try {
      const snap = await getDocs(collection(db, colName));
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (e) {
      console.error(`Error clearing ${colName}:`, e);
    }
  }

  await FirestoreService.logAudit(
    'delete',
    'system',
    'demo_data',
    'Dados de demonstração removidos do banco de dados',
    user
  );
}
