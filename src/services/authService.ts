import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import type { UserProfile, UserRole } from '../types';

export class AuthService {
  static async login(email: string, pass: string): Promise<User> {
    if (!auth || !isFirebaseConfigured()) {
      throw new Error('Firebase não está configurado. Verifique as variáveis de ambiente VITE_FIREBASE_*.');
    }
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return cred.user;
  }

  static async logout(): Promise<void> {
    if (!auth) return;
    await signOut(auth);
  }

  static async sendPasswordReset(email: string): Promise<void> {
    if (!auth || !isFirebaseConfigured()) {
      throw new Error('Firebase não está configurado.');
    }
    await sendPasswordResetEmail(auth, email);
  }

  static async getUserProfile(uid: string): Promise<UserProfile | null> {
    if (!db) return null;
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        return snap.data() as UserProfile;
      }
      return null;
    } catch (err) {
      console.error('Error fetching user profile:', err);
      return null;
    }
  }

  static async createUser(
    email: string,
    pass: string,
    name: string,
    role: UserRole = 'employee',
    createdBy?: string
  ): Promise<UserProfile> {
    if (!auth || !db || !isFirebaseConfigured()) {
      throw new Error('Firebase não está configurado.');
    }

    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });

    const newProfile: UserProfile = {
      uid: cred.user.uid,
      email,
      name,
      role,
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: createdBy || 'admin',
    };

    await setDoc(doc(db, 'users', cred.user.uid), newProfile);
    return newProfile;
  }
}
