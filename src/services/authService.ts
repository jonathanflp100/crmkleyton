import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { auth, db, getSecondaryAuth, isFirebaseConfigured } from './firebase';
import { backend } from './backend';
import type { UserProfile, UserRole } from '../types';

export class AuthService {
  /** Enquanto o primeiro admin está sendo criado, o listener de login espera esta promessa */
  static pendingSetup: Promise<void> | null = null;

  static async login(email: string, pass: string): Promise<User> {
    if (!auth || !isFirebaseConfigured()) {
      throw new Error('Firebase não está configurado. Verifique as variáveis VITE_FIREBASE_*.');
    }
    const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
    return cred.user;
  }

  static async logout(): Promise<void> {
    if (!auth) return;
    await signOut(auth);
  }

  static async sendPasswordReset(email: string): Promise<void> {
    if (!auth || !isFirebaseConfigured()) throw new Error('Firebase não está configurado.');
    await sendPasswordResetEmail(auth, email.trim());
  }

  /** O documento system/setup é público (só leitura) e indica se o primeiro admin já foi criado */
  static async isSetupDone(): Promise<boolean> {
    if (!isFirebaseConfigured() || !db) return true;
    try {
      const snap = await getDoc(doc(db, 'system', 'setup'));
      return snap.exists();
    } catch {
      return true; // na dúvida, não mostra o cadastro inicial
    }
  }

  /** Primeiro acesso: cria a conta do administrador principal */
  static createFirstAdmin(name: string, email: string, pass: string): Promise<void> {
    const job = this.doCreateFirstAdmin(name, email, pass);
    this.pendingSetup = job;
    return job.finally(() => {
      this.pendingSetup = null;
    });
  }

  private static async doCreateFirstAdmin(name: string, email: string, pass: string): Promise<void> {
    if (!auth || !db) throw new Error('Firebase não está configurado.');
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    await updateProfile(cred.user, { displayName: name });
    const now = new Date().toISOString();
    const profile: UserProfile = {
      uid: cred.user.uid,
      email: email.trim(),
      name,
      role: 'admin',
      active: true,
      createdAt: now,
      createdBy: 'setup',
    };
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', cred.user.uid), profile);
    batch.set(doc(db, 'system', 'setup'), { adminUid: cred.user.uid, createdAt: now });
    await batch.commit();
  }

  /**
   * Admin cria um usuário. Usa um app Firebase secundário para que o admin
   * continue logado (senão o Firebase troca a sessão para a conta nova).
   */
  static async createUser(
    email: string,
    pass: string,
    name: string,
    role: UserRole = 'employee',
    createdBy?: string
  ): Promise<UserProfile> {
    const now = new Date().toISOString();
    if (!isFirebaseConfigured()) {
      const uid = `local_${Date.now()}`;
      const profile: UserProfile = { uid, email, name, role, active: true, createdAt: now, createdBy };
      await backend.set('users', uid, profile as any);
      return profile;
    }
    const secondaryAuth = getSecondaryAuth();
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), pass);
    await updateProfile(cred.user, { displayName: name });
    const profile: UserProfile = {
      uid: cred.user.uid,
      email: email.trim(),
      name,
      role,
      active: true,
      createdAt: now,
      createdBy: createdBy || 'admin',
    };
    // gravado pelo admin (sessão principal), conforme as regras do Firestore
    await backend.set('users', cred.user.uid, profile as any);
    await signOut(secondaryAuth);
    return profile;
  }
}
