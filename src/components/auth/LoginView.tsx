import React, { useState } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Building2,
  KeyRound,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

export function LoginView() {
  const { login, resetPassword, isConfigured, isDemoMode } = useAuth();
  const { success, error, info } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isForgotPassword) {
        if (!email) {
          error('Informe seu e-mail para receber as instruções de recuperação.');
          setLoading(false);
          return;
        }
        await resetPassword(email);
        setResetSent(true);
        success('Link de recuperação de senha enviado para seu e-mail!');
      } else {
        if (!email || !password) {
          error('Preencha seu e-mail e senha.');
          setLoading(false);
          return;
        }
        await login(email, password);
        success('Login realizado com sucesso!');
      }
    } catch (err: any) {
      console.error(err);
      let msg = 'Falha ao autenticar. Verifique seus dados.';
      if (err?.code === 'auth/user-not-found' || err?.code === 'auth/wrong-password') {
        msg = 'E-mail ou senha incorretos.';
      } else if (err?.code === 'auth/invalid-credential') {
        msg = 'Credenciais inválidas. Verifique seu e-mail e senha.';
      } else if (err?.message) {
        msg = err.message;
      }
      error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = (asAdmin: boolean) => {
    setEmail(asAdmin ? 'admin@gestorpro.com.br' : 'funcionario@gestorpro.com.br');
    setPassword('demo1234');
    login(asAdmin ? 'admin@gestorpro.com.br' : 'funcionario@gestorpro.com.br', 'demo1234');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Logo & Name */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl shadow-blue-600/30 text-white font-black text-2xl tracking-wider">
            GP
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Gestor Pro
          </h1>
          <p className="text-xs text-slate-400">
            Sistema Integrado de Gestão Empresarial, CRM e Financeiro
          </p>
        </div>

        {/* Card Box */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 shadow-2xl">
          {resetSent ? (
            <div className="text-center py-4 space-y-3 text-xs">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">E-mail Enviado!</h3>
              <p className="text-slate-300">
                Verifique a caixa de entrada de <strong>{email}</strong> para redefinir sua senha.
              </p>
              <button
                type="button"
                onClick={() => {
                  setResetSent(false);
                  setIsForgotPassword(false);
                }}
                className="mt-3 text-blue-400 font-semibold hover:underline"
              >
                Voltar para a tela de login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-bold text-slate-200 text-sm">
                  {isForgotPassword ? 'Recuperação de Senha' : 'Acesse sua Conta'}
                </span>
                <span className="text-[11px] text-slate-500">Acesso Restrito</span>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">
                  E-mail Profissional
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="seuemail@empresa.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all text-xs"
                  />
                </div>
              </div>

              {/* Password */}
              {!isForgotPassword && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-300">
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-white shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm mt-2"
              >
                <span>{loading ? 'Processando...' : isForgotPassword ? 'Enviar Link de Redefinição' : 'Entrar no Sistema'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {isForgotPassword && (
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="w-full text-center text-slate-400 hover:text-white pt-2 text-[11px]"
                >
                  Voltar para o login
                </button>
              )}
            </form>
          )}

          {/* Quick Demo Access (for testing) */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Acesso de Demonstração Rápida:
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin(true)}
                className="p-2 rounded-xl border border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-slate-300 hover:text-white font-medium text-[11px] flex items-center justify-center gap-1.5 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                Entrar como Admin
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin(false)}
                className="p-2 rounded-xl border border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-slate-300 hover:text-white font-medium text-[11px] flex items-center justify-center gap-1.5 transition-colors"
              >
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                Entrar Funcionário
              </button>
            </div>
          </div>
        </div>

        {/* Environmental info notice */}
        {!isConfigured && (
          <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800/60 text-slate-400 text-[11px] text-center leading-relaxed">
            <span className="text-slate-300 font-semibold">Configuração do Firebase: </span>
            Para sincronizar com seu projeto live do Firebase, configure as variáveis de ambiente VITE_FIREBASE_* conforme o arquivo <code className="text-blue-400">.env.example</code>.
          </div>
        )}
      </div>
    </div>
  );
}
