import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../services/firebase';
import { AuthService } from '../services/authService';
import type { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  isEmployee: boolean;
  loading: boolean;
  isConfigured: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  switchDemoRole?: (role: UserRole) => void;
  isDemoMode?: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoRole, setDemoRole] = useState<UserRole>('admin');
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured || !auth) {
      // In demo / unconfigured mode: provide default admin profile
      setProfile({
        uid: 'demo_admin_uid',
        email: 'admin@gestorpro.com.br',
        name: 'Administrador (Demo)',
        role: demoRole,
        active: true,
        createdAt: new Date().toISOString(),
      });
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser && db) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(userDocRef);

          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            setProfile(data);
          } else {
            // Bootstrap initial user profile
            const isFirstAdmin =
              firebaseUser.email?.toLowerCase().includes('admin') ||
              firebaseUser.email === 'jonathanflp100@gmail.com';
            const initialProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
              role: isFirstAdmin ? 'admin' : 'employee',
              active: true,
              createdAt: new Date().toISOString(),
            };
            await setDoc(userDocRef, initialProfile);
            setProfile(initialProfile);
          }
        } catch (err) {
          console.error('Error fetching user profile from Firestore:', err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [configured, demoRole]);

  const login = async (email: string, pass: string) => {
    if (!configured) {
      // Demo simulated login
      setProfile({
        uid: 'demo_uid',
        email,
        name: email.split('@')[0],
        role: email.includes('admin') ? 'admin' : 'employee',
        active: true,
        createdAt: new Date().toISOString(),
      });
      return;
    }
    await AuthService.login(email, pass);
  };

  const logout = async () => {
    if (!configured) {
      setProfile(null);
      setUser(null);
      return;
    }
    await AuthService.logout();
    setProfile(null);
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    if (!configured) return;
    await AuthService.sendPasswordReset(email);
  };

  const switchDemoRole = (role: UserRole) => {
    setDemoRole(role);
    if (profile) {
      setProfile({
        ...profile,
        role,
        name: role === 'admin' ? 'Administrador (Demo)' : 'Funcionário Operacional (Demo)',
      });
    }
  };

  const isAdmin = profile?.role === 'admin';
  const isEmployee = profile?.role === 'employee';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin,
        isEmployee,
        loading,
        isConfigured: configured,
        login,
        logout,
        resetPassword,
        switchDemoRole,
        isDemoMode: !configured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
