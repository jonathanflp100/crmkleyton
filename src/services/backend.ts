/**
 * Camada de armazenamento única.
 * - Com Firebase configurado: Cloud Firestore (dados compartilhados entre todos os usuários).
 * - Sem Firebase (pré-visualização / teste): salva no navegador (localStorage).
 * Todo o resto do sistema usa só esta interface.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

export type Unsub = () => void;
export interface WriteOp {
  type: 'set' | 'update' | 'delete';
  col: string;
  id: string;
  data?: Record<string, any>;
}

export interface Backend {
  kind: 'firebase' | 'local';
  get<T = any>(col: string, id: string): Promise<T | null>;
  getAll<T = any>(col: string): Promise<T[]>;
  set(col: string, id: string, data: Record<string, any>, merge?: boolean): Promise<void>;
  update(col: string, id: string, data: Record<string, any>): Promise<void>;
  remove(col: string, id: string): Promise<void>;
  batch(ops: WriteOp[]): Promise<void>;
  subscribeCol<T = any>(col: string, cb: (items: T[]) => void, onError?: (e: Error) => void): Unsub;
  subscribeDoc<T = any>(col: string, id: string, cb: (item: T | null) => void): Unsub;
}

/** Remove undefined (o Firestore e o JSON não aceitam bem) */
function clean<T>(data: T): T {
  return JSON.parse(JSON.stringify(data ?? {}));
}

export function newId(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/* ===================== FIREBASE ===================== */
const firebaseBackend: Backend = {
  kind: 'firebase',
  async get(col, id) {
    const snap = await getDoc(doc(db, col, id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as any) : null;
  },
  async getAll(col) {
    const snap = await getDocs(collection(db, col));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any;
  },
  async set(col, id, data, merge = false) {
    await setDoc(doc(db, col, id), clean(data), { merge });
  },
  async update(col, id, data) {
    await updateDoc(doc(db, col, id), clean(data) as any);
  },
  async remove(col, id) {
    await deleteDoc(doc(db, col, id));
  },
  async batch(ops) {
    // Firestore aceita no máximo 500 operações por lote
    for (let i = 0; i < ops.length; i += 450) {
      const b = writeBatch(db);
      ops.slice(i, i + 450).forEach((op) => {
        const ref = doc(db, op.col, op.id);
        if (op.type === 'set') b.set(ref, clean(op.data || {}));
        else if (op.type === 'update') b.update(ref, clean(op.data || {}) as any);
        else b.delete(ref);
      });
      await b.commit();
    }
  },
  subscribeCol(col, cb, onError) {
    return onSnapshot(
      collection(db, col),
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any),
      (err) => {
        console.error(`Erro ao ler ${col}:`, err);
        onError?.(err);
      }
    );
  },
  subscribeDoc(col, id, cb) {
    return onSnapshot(
      doc(db, col, id),
      (snap) => cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as any) : null),
      (err) => console.error(`Erro ao ler ${col}/${id}:`, err)
    );
  },
};

/* ===================== LOCAL (navegador) ===================== */
const STORAGE_KEY = 'gestorpro_local_db_v1';
type LocalDB = Record<string, Record<string, any>>;

let memory: LocalDB | null = null;
const listeners: Record<string, Set<() => void>> = {};

function load(): LocalDB {
  if (memory) return memory;
  try {
    memory = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    memory = {};
  }
  return memory!;
}

function persist(changedCols: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory || {}));
  } catch (e) {
    console.warn('Não foi possível salvar no navegador:', e);
  }
  // notifica de forma assíncrona (igual ao Firestore)
  setTimeout(() => {
    new Set(changedCols).forEach((c) => listeners[c]?.forEach((fn) => fn()));
  }, 0);
}

function colData(col: string) {
  const data = load();
  if (!data[col]) data[col] = {};
  return data[col];
}

function applyOp(op: WriteOp) {
  const c = colData(op.col);
  if (op.type === 'delete') {
    delete c[op.id];
  } else if (op.type === 'update') {
    if (!c[op.id]) throw new Error(`Registro não encontrado: ${op.col}/${op.id}`);
    c[op.id] = { ...c[op.id], ...clean(op.data || {}) };
  } else {
    c[op.id] = { ...clean(op.data || {}), id: op.id };
  }
}

const localBackend: Backend = {
  kind: 'local',
  async get(col, id) {
    const item = colData(col)[id];
    return item ? clean({ ...item, id }) : null;
  },
  async getAll(col) {
    return Object.entries(colData(col)).map(([id, v]) => clean({ ...v, id }));
  },
  async set(col, id, data, merge = false) {
    const c = colData(col);
    c[id] = merge ? { ...(c[id] || {}), ...clean(data), id } : { ...clean(data), id };
    persist([col]);
  },
  async update(col, id, data) {
    applyOp({ type: 'update', col, id, data });
    persist([col]);
  },
  async remove(col, id) {
    delete colData(col)[id];
    persist([col]);
  },
  async batch(ops) {
    ops.forEach(applyOp);
    persist(ops.map((o) => o.col));
  },
  subscribeCol(col, cb) {
    const fire = () => cb(Object.entries(colData(col)).map(([id, v]) => clean({ ...v, id })));
    (listeners[col] ||= new Set()).add(fire);
    setTimeout(fire, 0);
    return () => listeners[col]?.delete(fire);
  },
  subscribeDoc(col, id, cb) {
    const fire = () => {
      const item = colData(col)[id];
      cb(item ? clean({ ...item, id }) : null);
    };
    (listeners[col] ||= new Set()).add(fire);
    setTimeout(fire, 0);
    return () => listeners[col]?.delete(fire);
  },
};

export const backend: Backend = isFirebaseConfigured() && db ? firebaseBackend : localBackend;
