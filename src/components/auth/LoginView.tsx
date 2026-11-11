import React, { useEffect, useState } from 'react';
import { Lock, Mail, ArrowRight, ShieldCheck, Building2, Sparkles, CheckCircle2, AlertCircle, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { AuthService } from '../../services/authService';
import { friendlyFirebaseError } from '../../services/firebase';

type Mode = 'login' | 'forgot' | 'setup';

const field =
  'w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all text-xs';

export function LoginView() {
  const { login, resetPassword, isConfigured, isDemoMode, authMessage } = useAuth();
  const { success, error } = useToast();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  // Primeiro acesso: se ainda não existe administrador, oferece o cadastro inicial
  useEffect(() => {
    if (!isConfigured) return;
    AuthService.isSetupDone().then((done) => {
      if (!done) {
        setNeedsSetup(true);
        setMode('setup');
      }
    });
  }, [isConfigured]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'forgot') {
        await resetPassword(email);
        setResetSent(true);
      } else if (mode === 'setup') {
        if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
        if (password !== password2) throw new Error('As senhas não conferem.');
        await AuthService.createFirstAdmin(name.trim() || 'Administrador', email, password);
        success('Conta de administrador criada! Bem-vindo.');
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      error(friendlyFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'forgot' ? 'Recuperar senha' : mode === 'setup' ? 'Primeiro acesso' : 'Entrar';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl shadow-blue-600/30 text-white font-black text-2xl tracking-wider">GP</div>
          <h1 className="text-2xl font-black text-white tracking-tight">Gestor Pro</h1>
          <p className="text-xs text-slate-400">CRM, financeiro e gestão da empresa</p>
        </div>

        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 shadow-2xl">
          {authMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {authMessage}
            </div>
          )}

          {resetSent ? (
            <div className="text-center py-4 space-y-3 text-xs">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">E-mail enviado!</h3>
              <p className="text-slate-300">
                Veja a caixa de entrada (e o spam) de <strong>{email}</strong> para criar uma nova senha.
              </p>
              <button
                type="button"
                onClick={() => {
                  setResetSent(false);
                  setMode('login');
                }}
                className="mt-3 text-blue-400 font-semibold hover:underline"
              >
                Voltar para o login
              </button>
            </div>
          ) : isDemoMode ? (
            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 leading-relaxed">
                <strong>Modo de teste.</strong> O Firebase ainda não foi conectado, então os dados ficam salvos só neste navegador.
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => login('', '', 'admin')} className="p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Entrar como admin
                </button>
                <button type="button" onClick={() => login('', '', 'employee')} className="p-3 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-200 font-bold flex items-center justify-center gap-1.5">
                  <Building2 className="w-4 h-4" /> Como funcionário
                </button>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Dica: em Configurações → Demonstração dá para carregar dados de exemplo.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-bold text-slate-200 text-sm">{title}</span>
                <span className="text-[11px] text-slate-500">Acesso restrito</span>
              </div>

              {mode === 'setup' && (
                <>
                  <p className="text-slate-300 leading-relaxed">
                    Ainda não existe nenhum administrador. Crie agora a conta principal — ela terá acesso total e poderá cadastrar os funcionários.
                  </p>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-300">Seu nome</label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={field} />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">E-mail</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="email" required autoComplete="email" placeholder="seuemail@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-300">Senha</label>
                    {mode === 'login' && (
                      <button type="button" onClick={() => setMode('forgot')} className="text-[11px] text-blue-400 hover:text-blue-300 font-medium">
                        Esqueci minha senha
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="password" required autoComplete={mode === 'setup' ? 'new-password' : 'current-password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
                  </div>
                </div>
              )}

              {mode === 'setup' && (
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300">Repita a senha</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="password" required autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} className={field} />
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-white shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50 text-sm mt-2">
                <span>{loading ? 'Aguarde...' : mode === 'forgot' ? 'Enviar link' : mode === 'setup' ? 'Criar administrador' : 'Entrar'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {mode === 'forgot' && (
                <button type="button" onClick={() => setMode('login')} className="w-full text-center text-slate-400 hover:text-white pt-2 text-[11px]">
                  Voltar para o login
                </button>
              )}
              {needsSetup && mode === 'login' && (
                <button type="button" onClick={() => setMode('setup')} className="w-full text-center text-slate-400 hover:text-white pt-2 text-[11px]">
                  Primeiro acesso? Criar administrador
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
