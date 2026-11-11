import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Users,
  Database,
  Upload,
  Download,
  ShieldAlert,
  Sparkles,
  Trash2,
  Save,
  UserPlus,
  Power,
  KanbanSquare,
  Plus,
  ArrowUp,
  ArrowDown,
  ImagePlus,
  Info,
} from 'lucide-react';
import type { CompanyProfile, KanbanColumn, UserProfile, UserRole } from '../../../types';
import { FirestoreService } from '../../../services/firestoreService';
import { ExportService } from '../../../services/exportService';
import { loadDemoData, clearDemoData } from '../../../services/demoDataService';
import { AuthService } from '../../../services/authService';
import { friendlyFirebaseError } from '../../../services/firebase';
import { useAuth, useActor } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import { Modal } from '../../common/Modal';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { Badge } from '../../common/Badge';
import { AddressFields, type AddressValue } from '../../common/AddressFields';
import { inputCls, labelCls, btnPrimary, btnSecondary, btnIcon, cardCls } from '../../common/ui';
import { maskDocumentInput, validateRUC } from '../../../utils/formatters';

interface SettingsViewProps {
  company: CompanyProfile | null;
  users: UserProfile[];
  stages: KanbanColumn[];
}

type Tab = 'company' | 'funnel' | 'users' | 'backup' | 'demo';

const emptyCompany = {
  name: '',
  tradingName: '',
  document: '',
  email: '',
  phone: '',
  whatsapp: '',
  website: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  logoUrl: '',
  receiptNotes: '',
};

/** Reduz a imagem do logo para caber no banco (máx. ~300px) */
function resizeImage(file: File, max = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function SettingsView({ company, users, stages }: SettingsViewProps) {
  const { profile, isAdmin, isConfigured } = useAuth();
  const actor = useActor();
  const { success, error, info } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('company');

  // Empresa
  const [form, setForm] = useState({ ...emptyCompany });
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    // carrega os dados quando chegam do banco (sem apagar o que a pessoa está digitando)
    if (company && !dirty) setForm({ ...emptyCompany, ...(company as any) });
  }, [company]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };
  const logoInput = useRef<HTMLInputElement>(null);

  // Funil
  const [stageDraft, setStageDraft] = useState<KanbanColumn[]>(stages);
  useEffect(() => setStageDraft(stages), [stages]);

  // Usuários
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('employee');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Backup / demo
  const [isImporting, setIsImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ name: string; data: any } | null>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [confirmClearDemo, setConfirmClearDemo] = useState(false);

  if (!isAdmin) {
    return (
      <div className={`${cardCls} p-8 text-center`}>
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Acesso restrito</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">Só administradores podem acessar as configurações.</p>
      </div>
    );
  }

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.document && form.document.includes('-') && !validateRUC(form.document)) {
      info('Atenção: o dígito verificador do RUC parece incorreto. Os dados foram salvos mesmo assim.');
    }
    try {
      await FirestoreService.updateCompanyProfile(form as CompanyProfile, actor);
      setDirty(false);
      success('Dados da empresa salvos!');
    } catch (err: any) {
      error('Erro ao salvar', friendlyFirebaseError(err));
    }
  };

  const handleLogo = async (file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file);
      set({ logoUrl: dataUrl });
      info('Logo carregado. Clique em "Salvar" para gravar.');
    } catch (err: any) {
      error(err.message);
    }
  };

  /* ---- Funil ---- */
  const middleStages = stageDraft.filter((s) => !s.isWon && !s.isLost);
  const fixedStages = stageDraft.filter((s) => s.isWon || s.isLost);
  const updateStage = (id: string, patch: Partial<KanbanColumn>) => setStageDraft((l) => l.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const moveStage = (id: string, dir: -1 | 1) => {
    const list = [...middleStages];
    const i = list.findIndex((s) => s.id === id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setStageDraft([...list, ...fixedStages]);
  };
  const addStage = () => setStageDraft([...middleStages, { id: `etapa_${Date.now().toString(36)}`, title: 'Nova etapa', color: '#8b5cf6' }, ...fixedStages]);
  const removeStage = (id: string) => setStageDraft(stageDraft.filter((s) => s.id !== id));
  const saveStages = async () => {
    if (stageDraft.some((s) => !s.title.trim())) return error('Todas as etapas precisam de nome.');
    try {
      await FirestoreService.saveKanbanStages(stageDraft, actor);
      success('Etapas do funil salvas!');
    } catch (err: any) {
      error('Erro ao salvar etapas', friendlyFirebaseError(err));
    }
  };

  /* ---- Usuários ---- */
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPass || !newUserName) return error('Preencha todos os campos.');
    if (newUserPass.length < 6) return error('A senha precisa ter pelo menos 6 caracteres.');
    setIsCreatingUser(true);
    try {
      await AuthService.createUser(newUserEmail, newUserPass, newUserName, newUserRole, profile?.uid);
      success(`Usuário ${newUserName} criado!`, `Passe o e-mail e a senha para ${newUserName} entrar.`);
      setIsNewUserModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPass('');
      setNewUserRole('employee');
    } catch (err: any) {
      error('Erro ao criar usuário', friendlyFirebaseError(err));
    } finally {
      setIsCreatingUser(false);
    }
  };

  const toggleStatus = async (u: UserProfile) => {
    if (u.uid === profile?.uid) return error('Você não pode desativar a sua própria conta.');
    try {
      await FirestoreService.setUserStatus(u.uid, !u.active, actor);
      success(`${u.name} ${!u.active ? 'reativado' : 'desativado'}.`);
    } catch (err: any) {
      error('Erro ao alterar status', friendlyFirebaseError(err));
    }
  };

  const toggleRole = async (u: UserProfile) => {
    if (u.uid === profile?.uid) return error('Você não pode mudar o seu próprio perfil.');
    const role: UserRole = u.role === 'admin' ? 'employee' : 'admin';
    try {
      await FirestoreService.setUserRole(u.uid, role, actor);
      success(`${u.name} agora é ${role === 'admin' ? 'administrador' : 'funcionário'}.`);
    } catch (err: any) {
      error('Erro ao alterar perfil', friendlyFirebaseError(err));
    }
  };

  /* ---- Backup ---- */
  const handleExportBackup = async () => {
    info('Gerando backup...');
    try {
      const data = await FirestoreService.exportAllData();
      ExportService.exportToJSON(`Backup_GestorPro_${new Date().toISOString().slice(0, 10)}`, data);
      success('Backup baixado!', 'Guarde o arquivo em local seguro (Google Drive, pendrive...).');
    } catch (err: any) {
      error('Erro ao gerar backup', friendlyFirebaseError(err));
    }
  };

  const handleBackupFile = async (file?: File) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      setPendingImport({ name: file.name, data });
    } catch {
      error('Arquivo inválido', 'Escolha um arquivo .json gerado pelo botão "Baixar backup".');
    }
    if (backupInput.current) backupInput.current.value = '';
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    setIsImporting(true);
    try {
      const n = await FirestoreService.importAllData(pendingImport.data, actor);
      success(`Backup restaurado (${n} registros).`);
    } catch (err: any) {
      error('Falha ao restaurar', friendlyFirebaseError(err));
    } finally {
      setIsImporting(false);
      setPendingImport(null);
    }
  };

  const handleLoadDemo = async () => {
    setIsLoadingDemo(true);
    try {
      await loadDemoData(actor);
      success('Dados de demonstração carregados!');
    } catch (err: any) {
      error('Erro ao carregar demonstração', friendlyFirebaseError(err));
    } finally {
      setIsLoadingDemo(false);
    }
  };

  const handleClearDemo = async () => {
    try {
      const n = await clearDemoData(actor);
      success(n ? `${n} registros de demonstração apagados.` : 'Não havia dados de demonstração.');
    } catch (err: any) {
      error('Erro ao apagar', friendlyFirebaseError(err));
    }
    setConfirmClearDemo(false);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'company', label: 'Dados da empresa', icon: Building2 },
    { id: 'funnel', label: 'Etapas do funil', icon: KanbanSquare },
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'backup', label: 'Backup', icon: Database },
    { id: 'demo', label: 'Demonstração', icon: Sparkles },
  ];

  const address: AddressValue = {
    street: form.street,
    number: form.number,
    complement: form.complement,
    neighborhood: form.neighborhood,
    city: form.city,
    state: form.state,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 dark:border-slate-800 pb-2 text-xs">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === t.id ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* EMPRESA */}
      {activeTab === 'company' && (
        <form onSubmit={handleSaveCompany} className={`${cardCls} p-6 space-y-4 text-xs`}>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Dados da empresa</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Aparecem no cabeçalho dos orçamentos, recibos, fichas e relatórios.</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-800">
              {form.logoUrl ? <img src={form.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" /> : <ImagePlus className="w-8 h-8 text-slate-300" />}
            </div>
            <div className="space-y-2">
              <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={(e) => handleLogo(e.target.files?.[0])} />
              <button type="button" onClick={() => logoInput.current?.click()} className={`${btnSecondary} text-xs flex items-center gap-1.5`}>
                <Upload className="w-3.5 h-3.5" /> Enviar logo
              </button>
              {form.logoUrl && (
                <button type="button" onClick={() => set({ logoUrl: '' })} className="text-rose-600 text-xs font-semibold block">
                  Remover logo
                </button>
              )}
              <p className="text-[10px] text-slate-400">PNG ou JPG. A imagem é reduzida automaticamente.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelCls}>Razão social *</label>
              <input type="text" required value={form.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Nome fantasia</label>
              <input type="text" value={form.tradingName} onChange={(e) => set({ tradingName: e.target.value })} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className={labelCls}>RUC</label>
              <input type="text" inputMode="numeric" placeholder="80012345-6" value={form.document} onChange={(e) => set({ document: maskDocumentInput(e.target.value) })} className={`${inputCls} font-mono`} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Telefone</label>
              <input type="tel" placeholder="021 123 456" value={form.phone} onChange={(e) => set({ phone: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>WhatsApp</label>
              <input type="tel" placeholder="0981 123 456" value={form.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>E-mail</label>
              <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} className={inputCls} />
            </div>
          </div>

          <AddressFields value={address} onChange={(p) => set(p as any)} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelCls}>Site / Instagram</label>
              <input type="text" value={form.website} onChange={(e) => set({ website: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Mensagem no rodapé dos recibos</label>
              <input type="text" placeholder="Ex.: Obrigado pela preferência!" value={form.receiptNotes} onChange={(e) => set({ receiptNotes: e.target.value })} className={inputCls} />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
            {dirty && <span className="text-amber-600 text-[11px] font-semibold">Alterações não salvas</span>}
            <button type="submit" className={`${btnPrimary} flex items-center gap-2`}>
              <Save className="w-4 h-4" /> Salvar
            </button>
          </div>
        </form>
      )}

      {/* FUNIL */}
      {activeTab === 'funnel' && (
        <div className={`${cardCls} p-6 space-y-4 text-xs`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Etapas do funil de vendas</h3>
              <p className="text-xs text-slate-500 mt-0.5">Renomeie, mude a cor, a ordem ou crie etapas. "Ganho" e "Perdido" são fixas.</p>
            </div>
            <button onClick={addStage} className={`${btnSecondary} text-xs flex items-center gap-1.5`}>
              <Plus className="w-3.5 h-3.5" /> Nova etapa
            </button>
          </div>
          <div className="space-y-2">
            {[...middleStages, ...fixedStages].map((s, i) => {
              const fixed = s.isWon || s.isLost;
              return (
                <div key={s.id} className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  <input type="color" value={s.color} onChange={(e) => updateStage(s.id, { color: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                  <input type="text" value={s.title} onChange={(e) => updateStage(s.id, { title: e.target.value })} className={`${inputCls} flex-1`} />
                  {fixed ? (
                    <Badge variant={s.isWon ? 'success' : 'danger'}>{s.isWon ? 'Ganho' : 'Perdido'}</Badge>
                  ) : (
                    <>
                      <button onClick={() => moveStage(s.id, -1)} disabled={i === 0} className={btnIcon} title="Subir">
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => moveStage(s.id, 1)} disabled={i === middleStages.length - 1} className={btnIcon} title="Descer">
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeStage(s.id)} disabled={middleStages.length <= 1} className={`${btnIcon} hover:text-rose-600`} title="Remover">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <Info className="w-3 h-3" /> Negócios que estiverem numa etapa removida continuam salvos; mova-os para outra etapa antes de remover.
          </p>
          <div className="flex justify-end">
            <button onClick={saveStages} className={`${btnPrimary} flex items-center gap-2`}>
              <Save className="w-4 h-4" /> Salvar etapas
            </button>
          </div>
        </div>
      )}

      {/* USUÁRIOS */}
      {activeTab === 'users' && (
        <div className={`${cardCls} p-6 space-y-4 text-xs`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Usuários e acessos</h3>
              <p className="text-xs text-slate-500 mt-0.5">Administrador: acesso total. Funcionário: não vê Configurações e não exclui registros.</p>
            </div>
            <button onClick={() => setIsNewUserModalOpen(true)} className={`${btnPrimary} flex items-center gap-2`}>
              <UserPlus className="w-4 h-4" /> Adicionar usuário
            </button>
          </div>
          {!isConfigured && (
            <p className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300">
              Modo de teste: os usuários só passam a fazer login de verdade depois de conectar o Firebase.
            </p>
          )}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 font-bold border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">E-mail</th>
                  <th className="py-3 px-4">Perfil</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">Nenhum usuário cadastrado ainda.</td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u.uid || (u as any).id}>
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {u.name} {u.uid === profile?.uid && <span className="text-[10px] text-blue-600">(você)</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{u.email}</td>
                    <td className="py-3 px-4">
                      <button onClick={() => toggleRole(u)} title="Clique para trocar o perfil">
                        <Badge variant={u.role === 'admin' ? 'purple' : 'info'}>{u.role === 'admin' ? 'Administrador' : 'Funcionário'}</Badge>
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={u.active ? 'success' : 'danger'}>{u.active ? 'Ativo' : 'Desativado'}</Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => toggleStatus(u)}
                        title={u.active ? 'Desativar acesso' : 'Reativar'}
                        className={`p-1.5 rounded-lg ${u.active ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40' : 'text-emerald-600 hover:bg-emerald-50'}`}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BACKUP */}
      {activeTab === 'backup' && (
        <div className={`${cardCls} p-6 space-y-5 text-xs`}>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Backup e restauração</h3>
            <p className="text-xs text-slate-500 mt-0.5">Baixe uma cópia de tudo (clientes, financeiro, funil, produtos...) — recomendo fazer uma vez por semana.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <p className="font-bold text-slate-800 dark:text-slate-200">Baixar backup</p>
              <p className="text-slate-500">Gera um arquivo .json com todos os dados.</p>
              <button onClick={handleExportBackup} className={`${btnPrimary} flex items-center gap-2`}>
                <Download className="w-4 h-4" /> Baixar backup
              </button>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <p className="font-bold text-slate-800 dark:text-slate-200">Restaurar backup</p>
              <p className="text-slate-500">Os registros do arquivo são gravados por cima dos atuais com o mesmo código. Nada é apagado.</p>
              <input ref={backupInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => handleBackupFile(e.target.files?.[0])} />
              <button onClick={() => backupInput.current?.click()} disabled={isImporting} className={`${btnSecondary} flex items-center gap-2`}>
                <Upload className="w-4 h-4" /> {isImporting ? 'Restaurando...' : 'Escolher arquivo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEMONSTRAÇÃO */}
      {activeTab === 'demo' && (
        <div className={`${cardCls} p-6 space-y-4 text-xs`}>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Dados de demonstração</h3>
            <p className="text-xs text-slate-500 mt-0.5">Útil para conhecer o sistema: cria clientes, fornecedores, produtos, negócios no funil, 6 meses de financeiro e tarefas.</p>
          </div>
          <p className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300">
            Os registros de demonstração ficam marcados. O botão "Apagar demonstração" remove <strong>somente</strong> eles — seus dados reais não são tocados.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={handleLoadDemo} disabled={isLoadingDemo} className={`${btnPrimary} flex items-center gap-2`}>
              <Sparkles className="w-4 h-4" /> {isLoadingDemo ? 'Carregando...' : 'Carregar demonstração'}
            </button>
            <button onClick={() => setConfirmClearDemo(true)} className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/40 font-semibold flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Apagar demonstração
            </button>
          </div>
        </div>
      )}

      {/* Modal novo usuário */}
      <Modal isOpen={isNewUserModalOpen} onClose={() => setIsNewUserModalOpen(false)} title="Novo usuário" subtitle="A pessoa entra com este e-mail e senha" maxWidth="md">
        <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className={labelCls}>Nome *</label>
            <input type="text" required value={newUserName} onChange={(e) => setNewUserName(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>E-mail *</label>
            <input type="email" required value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelCls}>Senha inicial *</label>
              <input type="text" required minLength={6} value={newUserPass} onChange={(e) => setNewUserPass(e.target.value)} className={`${inputCls} font-mono`} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Perfil</label>
              <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as UserRole)} className={inputCls}>
                <option value="employee">Funcionário</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">Depois a pessoa pode trocar a senha pelo "Esqueci minha senha" na tela de login.</p>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button type="button" onClick={() => setIsNewUserModalOpen(false)} className={btnSecondary}>
              Cancelar
            </button>
            <button type="submit" disabled={isCreatingUser} className={btnPrimary}>
              {isCreatingUser ? 'Criando...' : 'Criar usuário'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingImport)}
        onClose={() => setPendingImport(null)}
        onConfirm={confirmImport}
        loading={isImporting}
        variant="warning"
        confirmText="Restaurar"
        title="Restaurar backup"
        message={`Restaurar o arquivo "${pendingImport?.name}"? Registros com o mesmo código serão substituídos pela versão do backup.`}
      />
      <ConfirmDialog
        isOpen={confirmClearDemo}
        onClose={() => setConfirmClearDemo(false)}
        onConfirm={handleClearDemo}
        confirmText="Apagar"
        title="Apagar dados de demonstração"
        message="Remove somente os registros de demonstração. Seus dados reais continuam."
      />
    </div>
  );
}
