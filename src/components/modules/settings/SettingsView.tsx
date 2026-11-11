import React, { useState } from 'react';
import {
  Building2,
  Users,
  Database,
  Upload,
  Download,
  Shield,
  ShieldAlert,
  Sparkles,
  Trash2,
  Save,
  CheckCircle,
  AlertTriangle,
  UserPlus,
  Power,
  RotateCcw,
} from 'lucide-react';
import type { CompanyProfile, UserProfile, UserRole } from '../../../types';
import { FirestoreService } from '../../../services/firestoreService';
import { ExportService } from '../../../services/exportService';
import { loadDemoData, clearDemoData } from '../../../services/demoDataService';
import { AuthService } from '../../../services/authService';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import { Modal } from '../../common/Modal';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { Badge } from '../../common/Badge';

interface SettingsViewProps {
  company: CompanyProfile | null;
  users: UserProfile[];
}

export function SettingsView({ company, users }: SettingsViewProps) {
  const { profile, isAdmin, isConfigured } = useAuth();
  const { success, error, info } = useToast();

  const [activeTab, setActiveTab] = useState<'company' | 'users' | 'backup' | 'demo'>('company');

  // Company profile form
  const [name, setName] = useState(company?.name || '');
  const [tradingName, setTradingName] = useState(company?.tradingName || '');
  const [document, setDocument] = useState(company?.document || '');
  const [email, setEmail] = useState(company?.email || '');
  const [phone, setPhone] = useState(company?.phone || '');
  const [whatsapp, setWhatsapp] = useState(company?.whatsapp || '');
  const [website, setWebsite] = useState(company?.website || '');
  const [cep, setCep] = useState(company?.cep || '');
  const [street, setStreet] = useState(company?.street || '');
  const [number, setNumber] = useState(company?.number || '');
  const [complement, setComplement] = useState(company?.complement || '');
  const [neighborhood, setNeighborhood] = useState(company?.neighborhood || '');
  const [city, setCity] = useState(company?.city || '');
  const [state, setState] = useState(company?.state || '');
  const [logoUrl, setLogoUrl] = useState(company?.logoUrl || '');
  const [receiptNotes, setReceiptNotes] = useState(company?.receiptNotes || '');

  // New User Form Modal
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('employee');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Backup Import File Input
  const [importJsonText, setImportJsonText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Demo data loaders
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [isClearingDemo, setIsClearingDemo] = useState(false);
  const [confirmClearDemo, setConfirmClearDemo] = useState(false);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Acesso Restrito
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          Apenas usuários com perfil de Administrador têm permissão para acessar as configurações do sistema.
        </p>
      </div>
    );
  }

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await FirestoreService.updateCompanyProfile(
        {
          name,
          tradingName,
          document,
          email,
          phone,
          whatsapp,
          website,
          cep,
          street,
          number,
          complement,
          neighborhood,
          city,
          state,
          logoUrl,
          receiptNotes,
        },
        profile ? { uid: profile.uid, name: profile.name } : undefined
      );
      success('Dados da empresa atualizados com sucesso!');
    } catch (err: any) {
      error('Erro ao salvar dados da empresa', err?.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPass || !newUserName) {
      error('Preencha todos os campos do usuário.');
      return;
    }
    if (newUserPass.length < 6) {
      error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setIsCreatingUser(true);
    try {
      await AuthService.createUser(
        newUserEmail,
        newUserPass,
        newUserName,
        newUserRole,
        profile?.uid
      );
      success(`Usuário ${newUserName} criado com sucesso!`);
      setIsNewUserModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPass('');
    } catch (err: any) {
      error('Erro ao criar usuário', err?.message);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleToggleUserStatus = async (user: UserProfile) => {
    try {
      await FirestoreService.setUserStatus(
        user.uid,
        !user.active,
        profile ? { uid: profile.uid, name: profile.name } : undefined
      );
      success(`Usuário ${user.name} ${!user.active ? 'ativado' : 'desativado'}.`);
    } catch (err: any) {
      error('Erro ao alterar status do usuário', err?.message);
    }
  };

  const handleToggleUserRole = async (user: UserProfile) => {
    const newRole: UserRole = user.role === 'admin' ? 'employee' : 'admin';
    try {
      await FirestoreService.setUserRole(
        user.uid,
        newRole,
        profile ? { uid: profile.uid, name: profile.name } : undefined
      );
      success(`Perfil de ${user.name} alterado para ${newRole}.`);
    } catch (err: any) {
      error('Erro ao alterar perfil', err?.message);
    }
  };

  const handleExportBackup = async () => {
    info('Gerando arquivo de backup...');
    try {
      const data = await FirestoreService.exportAllData();
      ExportService.exportToJSON(`Backup_GestorPro_${Date.now()}`, data);
      success('Backup baixado com sucesso!');
    } catch (err: any) {
      error('Erro ao exportar backup', err?.message);
    }
  };

  const handleImportBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importJsonText.trim()) return;

    setIsImporting(true);
    try {
      const parsed = JSON.parse(importJsonText);
      await FirestoreService.importAllData(
        parsed,
        profile ? { uid: profile.uid, name: profile.name } : undefined
      );
      success('Dados restaurados com sucesso a partir do backup!');
      setImportJsonText('');
    } catch (err: any) {
      error('Falha ao restaurar backup. Verifique se o JSON é válido.', err?.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleLoadDemo = async () => {
    setIsLoadingDemo(true);
    try {
      await loadDemoData(profile ? { uid: profile.uid, name: profile.name } : undefined);
      success('Dados de demonstração carregados com sucesso! Clientes, 6 meses de transações e funil prontos.');
    } catch (err: any) {
      error('Erro ao carregar dados de demonstração', err?.message);
    } finally {
      setIsLoadingDemo(false);
    }
  };

  const handleClearDemo = async () => {
    setIsClearingDemo(true);
    try {
      await clearDemoData(profile ? { uid: profile.uid, name: profile.name } : undefined);
      success('Dados de demonstração apagados do banco de dados.');
      setConfirmClearDemo(false);
    } catch (err: any) {
      error('Erro ao apagar dados', err?.message);
    } finally {
      setIsClearingDemo(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 dark:border-slate-800 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('company')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeTab === 'company'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Dados da Empresa
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeTab === 'users'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          Gestão de Usuários
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeTab === 'backup'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Database className="w-4 h-4" />
          Backup & Restauração
        </button>

        <button
          onClick={() => setActiveTab('demo')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeTab === 'demo'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          Dados de Demonstração
        </button>
      </div>

      {/* TAB 1: DADOS DA EMPRESA */}
      {activeTab === 'company' && (
        <form onSubmit={handleSaveCompany} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4 text-xs">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Identificação & Dados da Empresa
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Estes dados serão impressos nos cabeçalhos de orçamentos, recibos de pagamento e relatórios
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Razão Social *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Nome Fantasia
              </label>
              <input
                type="text"
                value={tradingName}
                onChange={(e) => setTradingName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                CNPJ *
              </label>
              <input
                type="text"
                required
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Telefone de Contato
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                E-mail Institucional
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">CEP</label>
              <input
                type="text"
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Logradouro / Rua</label>
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Cidade / UF</label>
              <input
                type="text"
                value={city ? `${city}/${state}` : ''}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              URL do Logo da Empresa
            </label>
            <input
              type="text"
              placeholder="https://..."
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Texto Padrão de Rodapé dos Recibos
            </label>
            <input
              type="text"
              value={receiptNotes}
              onChange={(e) => setReceiptNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2 shadow-md shadow-blue-600/20"
            >
              <Save className="w-4 h-4" />
              Salvar Alterações
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: GESTÃO DE USUÁRIOS */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Usuários & Perfis de Acesso
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Administradores possuem controle total; Funcionários não acessam Configurações nem excluem registros.
              </p>
            </div>

            <button
              onClick={() => setIsNewUserModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Adicionar Usuário
            </button>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
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
                {users.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {u.name}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{u.email}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleUserRole(u)}
                        title="Clique para alternar o perfil"
                        className="cursor-pointer"
                      >
                        <Badge variant={u.role === 'admin' ? 'purple' : 'info'}>
                          {u.role === 'admin' ? 'Administrador' : 'Funcionário'}
                        </Badge>
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={u.active ? 'success' : 'danger'}>
                        {u.active ? 'Ativo' : 'Desativado'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleUserStatus(u)}
                        title={u.active ? 'Desativar acesso do usuário' : 'Reativar usuário'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          u.active
                            ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                            : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                        }`}
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

      {/* TAB 3: BACKUP & RESTAURAÇÃO */}
      {activeTab === 'backup' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6 text-xs">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Backup e Restauração de Dados
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Exporte todos os cadastros e transações em JSON ou importe um backup anterior
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Export */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                <Download className="w-5 h-5 text-blue-600" />
                <span>Exportar Dados (Backup Completo)</span>
              </div>
              <p className="text-slate-500 leading-relaxed">
                Gera um arquivo JSON contendo todas as coleções do Firestore: clientes, fornecedores, lançamentos financeiros, produtos, orçamentos, negócios e tarefas.
              </p>
              <button
                onClick={handleExportBackup}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center justify-center gap-2 shadow-sm"
              >
                <Download className="w-4 h-4" />
                Baixar Arquivo JSON de Backup
              </button>
            </div>

            {/* Import */}
            <form onSubmit={handleImportBackup} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                <Upload className="w-5 h-5 text-emerald-600" />
                <span>Restaurar Backup (JSON)</span>
              </div>
              <p className="text-slate-500 leading-relaxed">
                Cole o conteúdo do arquivo JSON de backup para importar os dados de volta para o Firestore:
              </p>
              <textarea
                rows={3}
                placeholder="Cole o código JSON do backup aqui..."
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[11px]"
              />
              <button
                type="submit"
                disabled={isImporting || !importJsonText.trim()}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {isImporting ? 'Processando Restauração...' : 'Restaurar Dados'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: DADOS DE DEMONSTRAÇÃO */}
      {activeTab === 'demo' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4 text-xs">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Ambiente de Demonstração & Testes
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Crie rapidamente dados realistas de exemplo ou limpe o banco de dados
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-bold">O que o botão "Carregar dados de demonstração" faz?</p>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-800 dark:text-amber-300">
              <li>Popula dados da empresa ("Gestor Pro Soluções Ltda" na Av. Paulista)</li>
              <li>Cadastra 3 contas bancárias (Itaú, Banco do Brasil, Caixa pequeno) com saldos</li>
              <li>Cadastra 13 categorias de receitas e despesas com cores</li>
              <li>Cadastra 5 clientes (TechCorp, Restaurante Sabor, etc.) e 3 fornecedores (Dell, Enel, etc.)</li>
              <li>Gera 6 meses de lançamentos financeiros históricos (pagos, pendentes e vencidos)</li>
              <li>Alimenta o funil CRM Kanban com oportunidades em todas as etapas</li>
              <li>Cadastra catálogo de produtos e serviços com estoque crítico de teste</li>
            </ul>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleLoadDemo}
              disabled={isLoadingDemo}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2 shadow-md shadow-blue-600/20 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              {isLoadingDemo ? 'Carregando dados...' : 'Carregar Dados de Demonstração'}
            </button>

            <button
              onClick={() => setConfirmClearDemo(true)}
              className="px-4 py-2.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Apagar Dados de Demonstração
            </button>
          </div>
        </div>
      )}

      {/* MODAL: NOVO USUÁRIO */}
      <Modal
        isOpen={isNewUserModalOpen}
        onClose={() => setIsNewUserModalOpen(false)}
        title="Cadastrar Novo Usuário"
        subtitle="Crie o login e perfil de acesso"
        maxWidth="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Nome Completo *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Carlos Eduardo"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              E-mail de Acesso *
            </label>
            <input
              type="email"
              required
              placeholder="carlos@gestorpro.com.br"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Senha Provisória (Mínimo 6 dígitos) *
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={newUserPass}
              onChange={(e) => setNewUserPass(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Perfil de Acesso *
            </label>
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="employee">Funcionário Operacional</option>
              <option value="admin">Administrador Geral</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setIsNewUserModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isCreatingUser}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {isCreatingUser ? 'Criando...' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRMAÇÃO DE APAGAR DADOS DE DEMO */}
      <ConfirmDialog
        isOpen={confirmClearDemo}
        onClose={() => setConfirmClearDemo(false)}
        onConfirm={handleClearDemo}
        title="Apagar Dados de Demonstração"
        message="Tem certeza de que deseja apagar todos os clientes, produtos, negócios e lançamentos cadastrados? Os dados da empresa serão preservados."
        loading={isClearingDemo}
      />
    </div>
  );
}
