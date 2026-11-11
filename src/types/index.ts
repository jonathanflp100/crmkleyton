/**
 * Gestor Pro - Core Type Definitions
 */

export type UserRole = 'admin' | 'employee';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  avatarUrl?: string;
  phone?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface CompanyProfile {
  name: string;
  tradingName?: string;
  document: string; // RUC
  email: string;
  phone: string;
  whatsapp?: string;
  website?: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  logoUrl?: string;
  receiptNotes?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type PersonType = 'PF' | 'PJ';

export interface Client {
  id: string;
  type: PersonType;
  name: string;
  document: string; // CI ou RUC
  phone?: string;
  whatsapp?: string;
  email?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  birthDate?: string; // YYYY-MM-DD
  source?: string; // 'Indicação', 'Google', 'Instagram', 'Outro', etc.
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface Supplier {
  id: string;
  type: PersonType;
  name: string;
  document: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  contactPerson?: string;
  bankInfo?: string;
  pixKey?: string; // legado
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'paid' | 'pending' | 'overdue';

export type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'debit_card'
  | 'credit_card'
  | 'qr'
  | 'wallet'
  | 'check'
  | 'other'
  // legados (dados antigos)
  | 'pix'
  | 'bank_slip';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  date: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  paymentDate?: string; // YYYY-MM-DD if paid
  categoryId: string;
  categoryName?: string;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  entityType?: 'client' | 'supplier' | 'none';
  entityId?: string;
  entityName?: string;
  costCenter?: string;
  accountId: string;
  accountName?: string;
  notes?: string;
  receiptUrl?: string;
  isRecurring?: boolean;
  recurrenceFrequency?: 'weekly' | 'monthly' | 'yearly';
  installmentNumber?: number;
  totalInstallments?: number;
  parentTransactionId?: string;
  dealId?: string;
  proposalId?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  createdByName?: string;
  updatedBy?: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'investment' | 'other';
  bankName?: string;
  initialBalance: number;
  currentBalance: number;
  color?: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon?: string;
  createdAt?: string;
}

export interface Transfer {
  id: string;
  fromAccountId: string;
  fromAccountName?: string;
  toAccountId: string;
  toAccountName?: string;
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export type DealPriority = 'low' | 'medium' | 'high';

export interface Deal {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  value: number;
  stageId: string;
  stageName?: string;
  assignedToUserId?: string;
  assignedToUserName?: string;
  expectedCloseDate?: string;
  priority: DealPriority;
  tags?: string[];
  lossReason?: string;
  wonDate?: string;
  lostDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface DealInteraction {
  id: string;
  dealId: string;
  type: 'call' | 'whatsapp' | 'meeting' | 'email' | 'note';
  description: string;
  date: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface DealTask {
  id: string;
  dealId: string;
  title: string;
  dueDate: string;
  completed: boolean;
  assignedToUserId?: string;
  createdAt: string;
}

export type ItemType = 'product' | 'service';

export interface Product {
  id: string;
  code?: string;
  name: string;
  type: ItemType;
  costPrice: number;
  salePrice: number;
  marginPercent: number;
  stockQuantity: number;
  minStockQuantity: number;
  unit?: string; // 'un', 'cx', 'kg', 'hr', etc.
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface ProposalItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  discount: number;
  totalPrice: number;
}

export type ProposalStatus = 'draft' | 'sent' | 'approved' | 'rejected';

export interface Proposal {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  clientDocument?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientAddress?: string;
  date: string;
  validUntil: string;
  status: ProposalStatus;
  items: ProposalItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  paymentConditions: string;
  notes?: string;
  convertedToSale?: boolean;
  saleDate?: string;
  saleInstallments?: number;
  dealId?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  createdByName?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
  assignedToUserId?: string;
  assignedToUserName?: string;
  clientId?: string;
  clientName?: string;
  dealId?: string;
  dealTitle?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface AuditLog {
  id: string;
  action: 'create' | 'update' | 'delete' | 'status_change' | 'login';
  collectionName: string;
  documentId: string;
  details: string;
  performedByUserId: string;
  performedByUserName: string;
  timestamp: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  isWon?: boolean;
  isLost?: boolean;
}

export type DatePeriodFilter = 'today' | 'week' | 'month' | 'last_month' | 'year' | 'custom';

export interface DateRange {
  start: string; // yyyy-MM-dd
  end: string; // yyyy-MM-dd
}

/** Usuário que executa a ação (para auditoria) */
export interface Actor {
  uid: string;
  name: string;
}
