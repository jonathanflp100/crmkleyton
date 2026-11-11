/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { ToastProvider } from './hooks/useToast';
import { LoginView } from './components/auth/LoginView';
import { AppLayout } from './components/layout/AppLayout';
import { LoadingSpinner } from './components/common/LoadingSpinner';

function MainRouter() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <LoadingSpinner message="Carregando Gestor Pro..." size="lg" />
      </div>
    );
  }

  if (!profile) {
    return <LoginView />;
  }

  return <AppLayout />;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <MainRouter />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
