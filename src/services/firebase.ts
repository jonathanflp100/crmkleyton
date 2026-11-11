import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, type Firestore } from 'firebase/firestore';

export interface FirebaseConfigOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

// Lido das variáveis de ambiente (Cloudflare Pages > Settings > Environment variables)
export const firebaseConfig: FirebaseConfigOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      !firebaseConfig.apiKey.includes('YourApiKeyHere') &&
      !firebaseConfig.projectId.includes('seu-projeto')
  );
}

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

try {
  if (isFirebaseConfigured()) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    try {
      // ignoreUndefinedProperties: campos opcionais vazios (undefined) não quebram a gravação
      dbInstance = initializeFirestore(app, { ignoreUndefinedProperties: true });
    } catch {
      dbInstance = getFirestore(app);
    }
  }
} catch (error) {
  console.error('Erro ao inicializar o Firebase:', error);
}

export const firebaseApp = app;
export const auth = authInstance as Auth;
export const db = dbInstance as Firestore;

/**
 * App secundário usado só para o admin criar contas de funcionários
 * sem ser deslogado (createUserWithEmailAndPassword loga automaticamente na conta criada).
 */
export function getSecondaryAuth(): Auth {
  const name = 'secondary-user-creator';
  const existing = getApps().find((a) => a.name === name);
  const secondary = existing || initializeApp(firebaseConfig, name);
  return getAuth(secondary);
}

/** Traduz erros comuns do Firebase para português */
export function friendlyFirebaseError(err: any): string {
  const code: string = err?.code || '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
    'auth/network-request-failed': 'Sem conexão com a internet.',
    'permission-denied': 'Você não tem permissão para fazer isso.',
    unavailable: 'Servidor indisponível. Verifique sua internet.',
  };
  if (map[code]) return map[code];
  return err?.message || 'Ocorreu um erro inesperado.';
}
