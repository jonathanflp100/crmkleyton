import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Package,
  Wrench,
  AlertTriangle,
  ArrowUpDown,
  Tag,
  DollarSign,
  TrendingUp,
  Edit2,
  Trash2,
  Boxes,
} from 'lucide-react';
import type { Product, ItemType } from '../../../types';
import { formatCurrency } from '../../../utils/formatters';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { EmptyState } from '../../common/EmptyState';
import { Pagination } from '../../common/Pagination';
import { FirestoreService } from '../../../services/firestoreService';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';

interface ProductsViewProps {
  products: Product[];
}

export function ProductsView({ products }: ProductsViewProps) {
  const { profile, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ItemType>('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form
  const [formType, setFormType] = useState<ItemType>('product');
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCostPrice, setFormCostPrice] = useState('');
  const [formSalePrice, setFormSalePrice] = useState('');
  const [formStock, setFormStock] = useState('0');
  const [formMinStock, setFormMinStock] = useState('2');
  const [formUnit, setFormUnit] = useState('un');
  const [formNotes, setFormNotes] = useState('');

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Automatic margin calculation
  const calculatedMargin = useMemo(() => {
    const cost = parseFloat(formCostPrice.replace(',', '.')) || 0;
    const sale = parseFloat(formSalePrice.replace(',', '.')) || 0;
    if (sale <= 0) return 0;
    const profit = sale - cost;
    return Math.round((profit / sale) * 100 * 10) / 10;
  }, [formCostPrice, formSalePrice]);

  const openNewModal = () => {
    setEditingProduct(null);
    setFormType('product');
    setFormCode('');
    setFormName('');
    setFormCostPrice('');
    setFormSalePrice('');
    setFormStock('10');
    setFormMinStock('2');
    setFormUnit('un');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormType(p.type);
    setFormCode(p.code || '');
    setFormName(p.name);
    setFormCostPrice(String(p.costPrice || ''));
    setFormSalePrice(String(p.salePrice));
    setFormStock(String(p.stockQuantity ?? 0));
    setFormMinStock(String(p.minStockQuantity ?? 0));
    setFormUnit(p.unit || 'un');
    setFormNotes(p.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(formCostPrice.replace(',', '.')) || 0;
    const sale = parseFloat(formSalePrice.replace(',', '.'));
    const stock = parseInt(formStock, 10) || 0;
    const minStock = parseInt(formMinStock, 10) || 0;

    if (!formName.trim() || isNaN(sale) || sale <= 0) {
      error('Preencha o nome do item e um preço de venda válido.');
      return;
    }

    try {
      if (editingProduct) {
        await FirestoreService.updateDocument<Product>(
          'products',
          editingProduct.id,
          {
            type: formType,
            code: formCode,
            name: formName,
            costPrice: cost,
            salePrice: sale,
            marginPercent: calculatedMargin,
            stockQuantity: formType === 'product' ? stock : 9999,
            minStockQuantity: formType === 'product' ? minStock : 0,
            unit: formUnit,
            notes: formNotes,
          },
          profile ? { uid: profile.uid, name: profile.name } : undefined
        );
        success('Item do catálogo atualizado!');
      } else {
        await FirestoreService.createDocument<Product>(
          'products',
          {
            type: formType,
            code: formCode || `COD-${Date.now().toString().slice(-4)}`,
            name: formName,
            costPrice: cost,
            salePrice: sale,
            marginPercent: calculatedMargin,
            stockQuantity: formType === 'product' ? stock : 9999,
            minStockQuantity: formType === 'product' ? minStock : 0,
            unit: formUnit,
            notes: formNotes,
          } as any,
          profile ? { uid: profile.uid, name: profile.name } : undefined
        );
        success('Item cadastrado com sucesso!');
      }

      setIsModalOpen(false);
    } catch (err: any) {
      error('Erro ao salvar item', err?.message);
    }
  };

  const lowStockCount = useMemo(() => {
    return products.filter(
      (p) => p.type === 'product' && p.stockQuantity <= (p.minStockQuantity || 0)
    ).length;
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (typeFilter !== 'all' && p.type !== typeFilter) return false;
      if (showLowStockOnly && (p.type !== 'product' || p.stockQuantity > (p.minStockQuantity || 0))) {
        return false;
      }
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchName = p.name?.toLowerCase().includes(query);
        const matchCode = p.code?.toLowerCase().includes(query);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });
  }, [products, typeFilter, showLowStockOnly, searchTerm]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  return (
    <div className="space-y-6">
      {/* Top filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou código..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as any); setCurrentPage(1); }}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="all">Produtos & Serviços</option>
            <option value="product">Apenas Produtos Físicos</option>
            <option value="service">Apenas Serviços</option>
          </select>

          {/* Low stock alert filter */}
          <button
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showLowStockOnly
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${showLowStockOnly ? 'text-white' : 'text-rose-500'}`} />
            Estoque Baixo ({lowStockCount})
          </button>

          <button
            onClick={openNewModal}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Item
          </button>
        </div>
      </div>

      {/* Grid of Products */}
      {paginatedProducts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {paginatedProducts.map((prod) => {
            const isLowStock = prod.type === 'product' && prod.stockQuantity <= (prod.minStockQuantity || 0);

            return (
              <div
                key={prod.id}
                className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all shadow-xs hover:shadow-md flex flex-col justify-between ${
                  isLowStock
                    ? 'border-rose-300 dark:border-rose-900/80 bg-rose-50/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          prod.type === 'product'
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600'
                            : 'bg-purple-50 dark:bg-purple-950/60 text-purple-600'
                        }`}
                      >
                        {prod.type === 'product' ? <Package className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono text-slate-400">
                          {prod.code || 'S/C'}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {prod.name}
                        </h4>
                      </div>
                    </div>
                    <Badge variant={prod.type === 'product' ? 'info' : 'purple'} size="sm">
                      {prod.type === 'product' ? 'Produto' : 'Serviço'}
                    </Badge>
                  </div>

                  {/* Stock warning */}
                  {prod.type === 'product' && (
                    <div className="mt-3.5 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Estoque Atual:</span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-bold font-mono ${
                            isLowStock ? 'text-rose-600 font-extrabold' : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {prod.stockQuantity} {prod.unit || 'un'}
                        </span>
                        {isLowStock && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-600 font-bold animate-pulse">
                            Crítico!
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Prices & Margins */}
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Preço de Custo:</span>
                      <span className="font-mono text-slate-600 dark:text-slate-400">
                        {formatCurrency(prod.costPrice)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">Preço de Venda:</span>
                      <span className="font-bold font-mono text-slate-900 dark:text-white text-sm">
                        {formatCurrency(prod.salePrice)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Margem de Lucro:</span>
                      <span className="font-semibold text-emerald-600 font-mono">
                        {prod.marginPercent || 0}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-1 text-xs">
                  <button
                    onClick={() => openEditModal(prod)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setDeletingId(prod.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Nenhum item encontrado no catálogo"
          description="Cadastre seus produtos e serviços para compor orçamentos, pedidos e baixar estoque."
          actionText="Novo Item"
          onAction={openNewModal}
        />
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredProducts.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      {/* MODAL: CRIAR / EDITAR PRODUTO */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? 'Editar Item' : 'Novo Produto ou Serviço'}
        subtitle="Controle de preços, margem e estoque"
        maxWidth="xl"
      >
        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          {/* Type switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setFormType('product')}
              className={`py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                formType === 'product'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Package className="w-4 h-4" />
              Produto Físico
            </button>
            <button
              type="button"
              onClick={() => setFormType('service')}
              className={`py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                formType === 'service'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Wrench className="w-4 h-4" />
              Serviço / Mão de Obra
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Código / SKU
              </label>
              <input
                type="text"
                placeholder="Ex: PROD-01"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Nome do Item *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Servidor Dell Xeon..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Pricing & Automatic Margin */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
            <span className="font-bold text-slate-700 dark:text-slate-300">Formação de Preço & Margem</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-slate-500">Preço de Custo (R$)</label>
                <input
                  type="text"
                  placeholder="0,00"
                  value={formCostPrice}
                  onChange={(e) => setFormCostPrice(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500">Preço de Venda (R$) *</label>
                <input
                  type="text"
                  required
                  placeholder="0,00"
                  value={formSalePrice}
                  onChange={(e) => setFormSalePrice(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500">Margem Calculada (%)</label>
                <div className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 font-mono font-bold text-emerald-600">
                  {calculatedMargin}%
                </div>
              </div>
            </div>
          </div>

          {/* Stock (only for products) */}
          {formType === 'product' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Estoque Atual
                </label>
                <input
                  type="number"
                  value={formStock}
                  onChange={(e) => setFormStock(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Estoque Mínimo (Alerta)
                </label>
                <input
                  type="number"
                  value={formMinStock}
                  onChange={(e) => setFormMinStock(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Unidade
                </label>
                <select
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="un">un (Unidade)</option>
                  <option value="cx">cx (Caixa)</option>
                  <option value="kg">kg (Quilo)</option>
                  <option value="pc">pc (Peça)</option>
                  <option value="hr">hr (Hora)</option>
                  <option value="mes">mês (Mensalidade)</option>
                </select>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Observações
            </label>
            <textarea
              rows={2}
              placeholder="Especificações técnicas, garantia..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              Salvar Item
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={async () => {
          if (!deletingId) return;
          try {
            await FirestoreService.deleteDocument(
              'products',
              deletingId,
              profile ? { uid: profile.uid, name: profile.name } : undefined
            );
            success('Item excluído com sucesso.');
            setDeletingId(null);
          } catch (err: any) {
            error('Erro ao excluir item', err?.message);
          }
        }}
        title="Excluir Item do Catálogo"
        message="Tem certeza de que deseja excluir este item? Os orçamentos existentes que continham este item manterão o registro histórico."
      />
    </div>
  );
}
