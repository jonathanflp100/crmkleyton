import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isFirebaseConfigured } from './firebase';
import type {
  Client,
  Supplier,
  Transaction,
  Account,
  Category,
  Deal,
  DealInteraction,
  DealTask,
  Product,
  Proposal,
  Task,
  Transfer,
  AuditLog,
  CompanyProfile,
  UserProfile,
} from '../types';
import { addDays, addMonths, addWeeks, addYears, format } from 'date-fns';

export class FirestoreService {
  /**
   * Record an audit log entry
   */
  static async logAudit(
    action: AuditLog['action'],
    collectionName: string,
    documentId: string,
    details: string,
    user?: { uid: string; name: string }
  ): Promise<void> {
    if (!db) return;
    try {
      const logId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const logRef = doc(db, 'audit_logs', logId);
      const logData: AuditLog = {
        id: logId,
        action,
        collectionName,
        documentId,
        details,
        performedByUserId: user?.uid || 'system',
        performedByUserName: user?.name || 'Sistema',
        timestamp: new Date().toISOString(),
      };
      await setDoc(logRef, logData);
    } catch (err) {
      console.warn('Failed to record audit log:', err);
    }
  }

  // ================= COMPANY PROFILE =================
  static async getCompanyProfile(): Promise<CompanyProfile | null> {
    if (!db) return null;
    try {
      const snap = await getDoc(doc(db, 'company', 'profile'));
      if (snap.exists()) {
        return snap.data() as CompanyProfile;
      }
      return null;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'company/profile');
    }
  }

  static async updateCompanyProfile(profile: CompanyProfile, user?: { uid: string; name: string }): Promise<void> {
    if (!db) return;
    try {
      const data = {
        ...profile,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.name || 'Admin',
      };
      await setDoc(doc(db, 'company', 'profile'), data, { merge: true });
      await this.logAudit('update', 'company', 'profile', 'Dados da empresa atualizados', user);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'company/profile');
    }
  }

  // ================= SUBSCRIPTIONS =================
  static subscribeCollection<T>(
    collectionName: string,
    onData: (items: T[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    if (!db || !isFirebaseConfigured()) {
      onData([]);
      return () => {};
    }

    const colRef = collection(db, collectionName);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as T));
        onData(items);
      },
      (error) => {
        console.error(`Error subscribing to ${collectionName}:`, error);
        if (onError) onError(error);
        else handleFirestoreError(error, OperationType.LIST, collectionName);
      }
    );
  }

  static subscribeDoc<T>(
    collectionName: string,
    docId: string,
    onData: (data: T | null) => void
  ): Unsubscribe {
    if (!db || !isFirebaseConfigured()) {
      onData(null);
      return () => {};
    }

    const docRef = doc(db, collectionName, docId);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onData({ id: snapshot.id, ...snapshot.data() } as T);
        } else {
          onData(null);
        }
      },
      (error) => {
        console.error(`Error subscribing to ${collectionName}/${docId}:`, error);
        handleFirestoreError(error, OperationType.GET, `${collectionName}/${docId}`);
      }
    );
  }

  // ================= GENERIC CRUD =================
  static async createDocument<T extends { id?: string }>(
    collectionName: string,
    data: T,
    user?: { uid: string; name: string }
  ): Promise<string> {
    if (!db) throw new Error('Firebase não configurado');
    try {
      const id = data.id || `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const docRef = doc(db, collectionName, id);
      const payload = {
        ...data,
        id,
        createdAt: (data as any).createdAt || new Date().toISOString(),
        createdBy: user?.uid,
        createdByName: user?.name,
      };
      await setDoc(docRef, payload);
      await this.logAudit('create', collectionName, id, `Criado registro em ${collectionName}`, user);
      return id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, collectionName);
    }
  }

  static async updateDocument<T>(
    collectionName: string,
    id: string,
    data: Partial<T>,
    user?: { uid: string; name: string }
  ): Promise<void> {
    if (!db) throw new Error('Firebase não configurado');
    try {
      const docRef = doc(db, collectionName, id);
      const payload = {
        ...data,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.name || user?.uid,
      };
      await updateDoc(docRef, payload as any);
      await this.logAudit('update', collectionName, id, `Atualizado registro em ${collectionName}`, user);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${id}`);
    }
  }

  static async deleteDocument(
    collectionName: string,
    id: string,
    user?: { uid: string; name: string }
  ): Promise<void> {
    if (!db) throw new Error('Firebase não configurado');
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
      await this.logAudit('delete', collectionName, id, `Excluído registro em ${collectionName}`, user);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
    }
  }

  // ================= TRANSACTIONS (FINANCEIRO) =================
  static async createTransactionWithInstallments(
    data: Omit<Transaction, 'id' | 'createdAt'> & {
      installmentsCount?: number;
      frequency?: 'weekly' | 'monthly' | 'yearly';
    },
    user?: { uid: string; name: string }
  ): Promise<string[]> {
    if (!db) throw new Error('Firebase não configurado');
    try {
      const installmentsCount = data.installmentsCount || 1;
      const createdIds: string[] = [];
      const parentId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const installmentAmount = Math.round((data.amount / installmentsCount) * 100) / 100;
      const baseDueDate = new Date(data.dueDate);

      const batch = writeBatch(db);

      for (let i = 1; i <= installmentsCount; i++) {
        const transId = installmentsCount === 1 ? parentId : `${parentId}_p${i}`;
        createdIds.push(transId);

        let installmentDueDate = baseDueDate;
        if (i > 1) {
          if (data.frequency === 'weekly') {
            installmentDueDate = addWeeks(baseDueDate, i - 1);
          } else if (data.frequency === 'yearly') {
            installmentDueDate = addYears(baseDueDate, i - 1);
          } else {
            installmentDueDate = addMonths(baseDueDate, i - 1);
          }
        }

        const formattedDueDate = format(installmentDueDate, 'yyyy-MM-dd');
        const desc = installmentsCount > 1 
          ? `${data.description} (${i}/${installmentsCount})`
          : data.description;

        const transDoc: Transaction = {
          ...data,
          id: transId,
          description: desc,
          amount: installmentAmount,
          dueDate: formattedDueDate,
          installmentNumber: installmentsCount > 1 ? i : undefined,
          totalInstallments: installmentsCount > 1 ? installmentsCount : undefined,
          parentTransactionId: installmentsCount > 1 ? parentId : undefined,
          createdAt: new Date().toISOString(),
          createdBy: user?.uid,
          createdByName: user?.name,
        };

        const docRef = doc(db, 'transactions', transId);
        batch.set(docRef, transDoc);
      }

      await batch.commit();

      // If it's already marked as paid on creation, update account balance
      if (data.status === 'paid' && data.accountId) {
        await this.adjustAccountBalance(
          data.accountId,
          data.type === 'income' ? data.amount : -data.amount
        );
      }

      await this.logAudit(
        'create',
        'transactions',
        parentId,
        `Criado lançamento: ${data.description} (${installmentsCount}x de R$ ${installmentAmount})`,
        user
      );

      return createdIds;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'transactions');
    }
  }

  static async markTransactionAsPaid(
    transaction: Transaction,
    paymentDate: string = format(new Date(), 'yyyy-MM-dd'),
    accountId?: string,
    user?: { uid: string; name: string }
  ): Promise<void> {
    if (!db) throw new Error('Firebase não configurado');
    try {
      const targetAccountId = accountId || transaction.accountId;
      const transRef = doc(db, 'transactions', transaction.id);

      await updateDoc(transRef, {
        status: 'paid',
        paymentDate,
        accountId: targetAccountId,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.name || user?.uid,
      });

      // Update account balance
      if (targetAccountId) {
        const delta = transaction.type === 'income' ? transaction.amount : -transaction.amount;
        await this.adjustAccountBalance(targetAccountId, delta);
      }

      await this.logAudit(
        'status_change',
        'transactions',
        transaction.id,
        `Lançamento marcado como pago: ${transaction.description} (${transaction.amount})`,
        user
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `transactions/${transaction.id}`);
    }
  }

  static async markTransactionAsPending(
    transaction: Transaction,
    user?: { uid: string; name: string }
  ): Promise<void> {
    if (!db) throw new Error('Firebase não configurado');
    try {
      const transRef = doc(db, 'transactions', transaction.id);

      // Revert account balance if it was paid
      if (transaction.status === 'paid' && transaction.accountId) {
        const delta = transaction.type === 'income' ? -transaction.amount : transaction.amount;
        await this.adjustAccountBalance(transaction.accountId, delta);
      }

      await updateDoc(transRef, {
        status: 'pending',
        paymentDate: null,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.name || user?.uid,
      });

      await this.logAudit(
        'status_change',
        'transactions',
        transaction.id,
        `Lançamento revertido para pendente: ${transaction.description}`,
        user
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `transactions/${transaction.id}`);
    }
  }

  // ================= ACCOUNT TRANSFERS =================
  static async transferBetweenAccounts(
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    date: string,
    notes?: string,
    user?: { uid: string; name: string }
  ): Promise<string> {
    if (!db) throw new Error('Firebase não configurado');
    try {
      const transferId = `${Date.now()}_trf`;
      const transferRef = doc(db, 'transfers', transferId);

      const transferData: Transfer = {
        id: transferId,
        fromAccountId,
        toAccountId,
        amount,
        date,
        notes,
        createdAt: new Date().toISOString(),
        createdBy: user?.name || 'Sistema',
      };

      await setDoc(transferRef, transferData);

      // Adjust balances
      await this.adjustAccountBalance(fromAccountId, -amount);
      await this.adjustAccountBalance(toAccountId, amount);

      await this.logAudit(
        'create',
        'transfers',
        transferId,
        `Transferência de R$ ${amount} entre contas`,
        user
      );

      return transferId;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'transfers');
    }
  }

  static async adjustAccountBalance(accountId: string, delta: number): Promise<void> {
    if (!db) return;
    try {
      const accRef = doc(db, 'accounts', accountId);
      const snap = await getDoc(accRef);
      if (snap.exists()) {
        const current = snap.data().currentBalance || 0;
        await updateDoc(accRef, {
          currentBalance: Math.round((current + delta) * 100) / 100,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Error adjusting account balance:', err);
    }
  }

  // ================= PROPOSALS & SALES =================
  static async convertProposalToSale(
    proposal: Proposal,
    paymentMethod: Transaction['paymentMethod'],
    accountId: string,
    installmentsCount: number = 1,
    firstDueDate: string = format(new Date(), 'yyyy-MM-dd'),
    user?: { uid: string; name: string }
  ): Promise<void> {
    if (!db) throw new Error('Firebase não configurado');
    try {
      // 1. Decrement product stock for items that are products
      for (const item of proposal.items) {
        if (!item.productId) continue;
        const prodRef = doc(db, 'products', item.productId);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
          const prodData = prodSnap.data() as Product;
          if (prodData.type === 'product') {
            const newStock = Math.max(0, (prodData.stockQuantity || 0) - item.quantity);
            await updateDoc(prodRef, {
              stockQuantity: newStock,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      // 2. Generate financial receivable transaction(s)
      await this.createTransactionWithInstallments(
        {
          description: `Venda - Orçamento #${proposal.number} (${proposal.clientName})`,
          amount: proposal.total,
          type: 'income',
          date: format(new Date(), 'yyyy-MM-dd'),
          dueDate: firstDueDate,
          categoryId: 'vendas_cat',
          categoryName: 'Vendas',
          paymentMethod,
          status: 'pending',
          entityType: 'client',
          entityId: proposal.clientId,
          entityName: proposal.clientName,
          accountId,
          proposalId: proposal.id,
          installmentsCount,
          frequency: 'monthly',
        },
        user
      );

      // 3. Update proposal status
      await updateDoc(doc(db, 'proposals', proposal.id), {
        status: 'approved',
        convertedToSale: true,
        saleDate: format(new Date(), 'yyyy-MM-dd'),
        saleInstallments: installmentsCount,
        updatedAt: new Date().toISOString(),
      });

      await this.logAudit(
        'status_change',
        'proposals',
        proposal.id,
        `Orçamento #${proposal.number} aprovado e transformado em venda (R$ ${proposal.total})`,
        user
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `proposals/${proposal.id}`);
    }
  }

  // ================= CRM PIPELINE INTERACTIONS =================
  static async addDealInteraction(
    interaction: Omit<DealInteraction, 'id' | 'createdAt'>,
    user?: { uid: string; name: string }
  ): Promise<string> {
    if (!db) throw new Error('Firebase não configurado');
    try {
      const id = `${Date.now()}_act`;
      const docRef = doc(db, 'deal_interactions', id);
      const data: DealInteraction = {
        ...interaction,
        id,
        createdAt: new Date().toISOString(),
      };
      await setDoc(docRef, data);
      await this.logAudit('create', 'deal_interactions', id, `Interação registrada no negócio: ${interaction.type}`, user);
      return id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'deal_interactions');
    }
  }

  // ================= USERS MANAGEMENT (ADMIN ONLY) =================
  static async setUserStatus(userId: string, active: boolean, user?: { uid: string; name: string }): Promise<void> {
    if (!db) throw new Error('Firebase não configurado');
    try {
      await updateDoc(doc(db, 'users', userId), {
        active,
        updatedAt: new Date().toISOString(),
      });
      await this.logAudit('status_change', 'users', userId, `Usuário ${active ? 'ativado' : 'desativado'}`, user);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  }

  static async setUserRole(userId: string, role: 'admin' | 'employee', user?: { uid: string; name: string }): Promise<void> {
    if (!db) throw new Error('Firebase não configurado');
    try {
      await updateDoc(doc(db, 'users', userId), {
        role,
        updatedAt: new Date().toISOString(),
      });
      await this.logAudit('status_change', 'users', userId, `Perfil alterado para ${role}`, user);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  }

  // ================= BACKUP & EXPORT =================
  static async exportAllData(): Promise<Record<string, any[]>> {
    if (!db) return {};
    const collectionsToExport = [
      'company',
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
    ];

    const backupData: Record<string, any[]> = {};

    for (const colName of collectionsToExport) {
      try {
        const snap = await getDocs(collection(db, colName));
        backupData[colName] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error(`Error exporting ${colName}:`, e);
      }
    }

    return backupData;
  }

  static async importAllData(data: Record<string, any[]>, user?: { uid: string; name: string }): Promise<void> {
    if (!db) throw new Error('Firebase não configurado');
    for (const [colName, docs] of Object.entries(data)) {
      if (!Array.isArray(docs)) continue;
      const batch = writeBatch(db);
      for (const item of docs) {
        if (!item.id) continue;
        const docRef = doc(db, colName, item.id);
        batch.set(docRef, item, { merge: true });
      }
      await batch.commit();
    }
    await this.logAudit('create', 'backup', 'import', 'Restauração de backup realizada com sucesso', user);
  }
}
