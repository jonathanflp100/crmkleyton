import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

export interface FirebaseConfigOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

// Read from environment variables (mandatory requirement)
const envConfig: FirebaseConfigOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    envConfig.apiKey &&
    envConfig.projectId &&
    !envConfig.apiKey.includes('YourApiKeyHere') &&
    !envConfig.projectId.includes('seu-projeto')
  );
}

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;
let storageInstance: FirebaseStorage | undefined;

try {
  if (isFirebaseConfigured()) {
    if (!getApps().length) {
      app = initializeApp(envConfig);
    } else {
      app = getApp();
    }
    authInstance = getAuth(app);
    dbInstance = getFirestore(app);
    try {
      storageInstance = getStorage(app);
    } catch (e) {
      console.warn('Firebase Storage not initialized:', e);
    }
  }
} catch (error) {
  console.error('Error initializing Firebase with environment variables:', error);
}

export const firebaseApp = app;
export const auth = authInstance as Auth;
export const db = dbInstance as Firestore;
export const storage = storageInstance as FirebaseStorage | undefined;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentAuth = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: currentAuth?.uid || null,
      email: currentAuth?.email || null,
      emailVerified: currentAuth?.emailVerified || null,
      isAnonymous: currentAuth?.isAnonymous || null,
    },
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
