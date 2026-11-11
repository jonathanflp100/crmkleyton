import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../services/firebase';
import { AuthService } from '../services/authService';
import { backend } from '../services/backend';
import type { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  isEmployee: boolean;
  loading: boolean;
  isConfigured: boolean;
  authMessage: string | null;
  login: (email: string, pass: string, demoRole?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  switchDemoRole?: (role: UserRole) => void;
  isDemoMode?: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const DEMO_SESSION_KEY = 'gestorpro_demo_session';

function demoProfile(role: UserRole, email?: string): UserProfile {
  return {
    uid: role === 'admin' ? 'demo_admin' : 'demo_employee',
    email: email || (role === 'admin' ? 'admin@demo.local' : 'funcionario@demo.local'),
    name: role === 'admin' ? 'Administrador (Demo)' : 'Funcionário (Demo)',
    role,
    active: true,
    createdAt: new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured || !auth) {
      // Modo de teste local: mantém a sessão enquanto a aba estiver aberta
      try {
        const saved = sessionStorage.getItem(DEMO_SESSION_KEY);
        if (saved) setProfile(JSON.parse(saved));
      } catch {
        /* ignore */
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        if (AuthService.pendingSetup) await AuthService.pendingSetup.catch(() => undefined);
        const data = await backend.get<UserProfile>('users', firebaseUser.uid);
        if (!data) {
          setAuthMessage('Sua conta ainda não foi liberada. Peça ao administrador para cadastrar seu acesso.');
          await AuthService.logout();
          setProfile(null);
        } else if (data.active === false) {
          setAuthMessage('Seu acesso foi desativado pelo administrador.');
          await AuthService.logout();
          setProfile(null);
        } else {
          setAuthMessage(null);
          setProfile({ ...data, uid: firebaseUser.uid });
        }
      } catch (err) {
        console.error('Erro ao carregar o perfil do usuário:', err);
        setAuthMessage('Não foi possível carregar seu perfil. Verifique as regras do Firestore.');
        await AuthService.logout();
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [configured]);

  const login = async (email: string, pass: string, demoRole: UserRole = 'admin') => {
    setAuthMessage(null);
    if (!configured) {
      const p = demoProfile(demoRole, email || undefined);
      sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(p));
      setProfile(p);
      return;
    }
    await AuthService.login(email, pass);
  };

  const logout = async () => {
    if (!configured) {
      sessionStorage.removeItem(DEMO_SESSION_KEY);
      setProfile(null);
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
    if (configured) return;
    const p = demoProfile(role);
    sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(p));
    setProfile(p);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin: profile?.role === 'admin',
        isEmployee: profile?.role === 'employee',
        loading,
        isConfigured: configured,
        authMessage,
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
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

/** Atalho para a auditoria */
export function useActor() {
  const { profile } = useAuth();
  return profile ? { uid: profile.uid, name: profile.name } : undefined;
}
