import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  AlertTriangle,
  Pencil,
  Trash2,
  X,
  Minus,
  Package,
  RotateCcw,
} from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { ResilientImage } from '../components/ResilientImage';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { ASSET_IMAGES } from '../services/mockData';
import { Product } from '../types';
import {
  calculateProfitMargin,
  formatCurrency,
  formatWeight,
} from '../utils/format';

interface ProductFormState {
  id?: string;
  nome: string;
  descricao: string;
  pesoGramas: string;
  precoVenda: string;
  custoEstimado: string;
  estoqueAtual: string;
  ativo: boolean;
  imagemUrl: string;
  destaque: string;
}

const IMAGE_PRESETS = [
  { label: 'Tradicional', url: ASSET_IMAGES.tradicional },
  { label: 'Pistache', url: ASSET_IMAGES.pistache },
  { label: 'Doce de Leite', url: ASSET_IMAGES.doceDeLeite },
  { label: 'Zero Lactose', url: ASSET_IMAGES.zeroLactose },
];

const EMPTY_FORM: ProductFormState = {
  nome: '',
  descricao: '',
  pesoGramas: '1000',
  precoVenda: '89.00',
  custoEstimado: '29.00',
  estoqueAtual: '6',
  ativo: true,
  imagemUrl: ASSET_IMAGES.tradicional,
  destaque: '',
};

export function ProductsPage() {
  const { isDemoMode, pushToast } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'ACTIVE'>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getProducts();
      setProducts(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao carregar os produtos.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts, isDemoMode]);

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setForm({
      id: product.id,
      nome: product.nome,
      descricao: product.descricao,
      pesoGramas: String(product.pesoGramas),
      precoVenda: product.precoVenda.toFixed(2),
      custoEstimado: product.custoEstimado.toFixed(2),
      estoqueAtual: String(product.estoqueAtual),
      ativo: product.ativo,
      imagemUrl: product.imagemUrl,
      destaque: product.destaque || '',
    });
    setModalOpen(true);
  };

  const handleToggleActive = async (product: Product) => {
    const nextValue = !product.ativo;
    setProducts((prev) =>
      prev.map((item) => (item.id === product.id ? { ...item, ativo: nextValue } : item))
    );
    try {
      await api.toggleProductActive(product.id, nextValue);
      pushToast({
        title: nextValue
          ? `${product.nome} ativado no cardápio`
          : `${product.nome} pausado no cardápio`,
        tone: 'neutral',
      });
    } catch (err) {
      setProducts((prev) =>
        prev.map((item) => (item.id === product.id ? product : item))
      );
      pushToast({
        title: 'Erro ao alterar status',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        tone: 'error',
      });
    }
  };

  const handleAdjustStock = async (product: Product, delta: number) => {
    const nextStock = Math.max(0, product.estoqueAtual + delta);
    if (nextStock === product.estoqueAtual) return;
    setProducts((prev) =>
      prev.map((item) =>
        item.id === product.id ? { ...item, estoqueAtual: nextStock } : item
      )
    );
    try {
      await api.adjustProductStock(product.id, delta);
    } catch {
      setProducts((prev) =>
        prev.map((item) => (item.id === product.id ? product : item))
      );
    }
  };

  const handleDelete = async (product: Product) => {
    try {
      await api.deleteProduct(product.id);
      setProducts((prev) => prev.filter((item) => item.id !== product.id));
      pushToast({
        title: `${product.nome} removido`,
        tone: 'neutral',
      });
    } catch (err) {
      pushToast({
        title: 'Erro ao remover produto',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        tone: 'error',
      });
    }
  };

  const handleSaveForm = async (event: React.FormEvent) => {
    event.preventDefault();
    const preco = parseFloat(form.precoVenda.replace(',', '.')) || 0;
    const custo = parseFloat(form.custoEstimado.replace(',', '.')) || 0;
    const peso = parseInt(form.pesoGramas, 10) || 500;
    const estoque = Math.max(0, parseInt(form.estoqueAtual, 10) || 0);

    if (!form.nome.trim() || preco <= 0) {
      pushToast({
        title: 'Preencha o nome e um preço de venda válido.',
        tone: 'warning',
      });
      return;
    }

    setSaving(true);
    try {
      const saved = await api.saveProduct({
        id: form.id,
        nome: form.nome.trim(),
        descricao:
          form.descricao.trim() ||
          'Pudim artesanal preparado em banho-maria com calda de caramelo feita no tacho.',
        pesoGramas: peso,
        precoVenda: preco,
        custoEstimado: custo,
        estoqueAtual: estoque,
        ativo: form.ativo,
        imagemUrl: form.imagemUrl.trim() || ASSET_IMAGES.tradicional,
        destaque: form.destaque.trim() || undefined,
      });

      setProducts((prev) => {
        if (form.id) {
          return prev.map((item) => (item.id === saved.id ? saved : item));
        }
        return [saved, ...prev];
      });
      setModalOpen(false);
      pushToast({
        title: form.id ? 'Produto atualizado' : 'Novo sabor cadastrado',
        description: `${saved.nome} (${formatWeight(saved.pesoGramas)}) salvo com sucesso.`,
        tone: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Não foi possível salvar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      if (stockFilter === 'LOW' && product.estoqueAtual >= 3) return false;
      if (stockFilter === 'ACTIVE' && !product.ativo) return false;
      if (!query) return true;
      return (
        product.nome.toLowerCase().includes(query) ||
        product.descricao.toLowerCase().includes(query)
      );
    });
  }, [products, searchQuery, stockFilter]);

  const stats = useMemo(() => {
    const activeCount = products.filter((p) => p.ativo).length;
    const lowStockCount = products.filter((p) => p.estoqueAtual < 3).length;
    const totalUnits = products.reduce((sum, p) => sum + p.estoqueAtual, 0);
    const avgMargin =
      products.length > 0
        ? products.reduce(
            (sum, p) => sum + calculateProfitMargin(p.precoVenda, p.custoEstimado),
            0
          ) / products.length
        : 0;
    return { activeCount, lowStockCount, totalUnits, avgMargin };
  }, [products]);

  const formPreviewPrice = parseFloat(form.precoVenda.replace(',', '.')) || 0;
  const formPreviewCost = parseFloat(form.custoEstimado.replace(',', '.')) || 0;
  const formPreviewMargin = calculateProfitMargin(formPreviewPrice, formPreviewCost);
  const formPreviewProfit = formPreviewPrice - formPreviewCost;

  return (
    <AdminLayout
      title="Produtos & Estoque"
      sectionLabel="Produtos & Estoque"
      topBarAction={
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-[#B45309] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#92400E] whitespace-nowrap shrink-0 sm:px-4 sm:text-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Sabor</span>
        </button>
      }
    >
      {/* Summary Strip */}
      <section className="mb-5 grid grid-cols-2 divide-y divide-[#EAE1D5] rounded-xl border border-[#EAE1D5] bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="px-4 py-3.5">
          <p className="text-xs font-medium text-[#7A6658]">Sabores ativos</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#291D16] tabular-nums">
            {stats.activeCount}
            <span className="ml-1 text-sm font-normal text-[#856F60]">
              / {products.length}
            </span>
          </p>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-xs font-medium text-[#7A6658]">Margem média</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-emerald-800 tabular-nums">
            {stats.avgMargin.toFixed(1).replace('.', ',')}%
          </p>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-xs font-medium text-[#7A6658]">Unidades em estoque</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#291D16] tabular-nums">
            {stats.totalUnits}
          </p>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-xs font-medium text-[#7A6658]">Abaixo de 3 unidades</p>
          <p
            className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
              stats.lowStockCount > 0 ? 'text-red-700' : 'text-[#291D16]'
            }`}
          >
            {stats.lowStockCount}
          </p>
        </div>
      </section>

      {/* Search & Filter Row */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8C7768]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por sabor ou ingrediente..."
            className="w-full rounded-lg border border-[#E2D7C8] bg-white py-2 pl-9 pr-3.5 text-sm text-[#291D16] placeholder-[#9B8878] focus:border-[#B45309] focus:outline-none focus:ring-2 focus:ring-[#B45309]/15"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-[#E6DCD0] bg-[#F4EEE6] p-1">
          {[
            { id: 'ALL' as const, label: 'Todos' },
            { id: 'ACTIVE' as const, label: 'Ativos' },
            { id: 'LOW' as const, label: 'Estoque baixo (<3)' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStockFilter(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                stockFilter === tab.id
                  ? 'bg-white text-[#291D16] shadow-xs'
                  : 'text-[#6B574A] hover:text-[#291D16]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadProducts}
            className="inline-flex items-center gap-1.5 font-semibold underline"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Recarregar
          </button>
        </div>
      )}

      {/* High-Density Product Table */}
      <div className="overflow-hidden rounded-xl border border-[#EAE1D5] bg-white">
        {loading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="h-14 animate-pulse rounded-lg bg-[#F5EFE7]" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Package className="h-10 w-10 text-[#C9B7A2]" />
            <h2 className="mt-3 font-display text-lg font-semibold text-[#291D16]">
              Nenhum sabor encontrado
            </h2>
            <p className="mt-1 max-w-sm text-sm text-[#6B574A]">
              Ajuste os filtros ou cadastre um novo sabor artesanal para o seu cardápio.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#B45309] px-4 py-2 text-sm font-semibold text-white hover:bg-[#92400E]"
            >
              <Plus className="h-4 w-4" />
              Cadastrar sabor
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#EAE1D5] bg-[#FAF7F2] text-xs font-semibold text-[#6B574A]">
                  <th className="py-3 pl-5 pr-4">Sabor</th>
                  <th className="px-3 py-3 text-right">Peso</th>
                  <th className="px-3 py-3 text-right">Preço de venda</th>
                  <th className="px-3 py-3 text-right">Custo estimado</th>
                  <th className="px-3 py-3 text-right">Margem</th>
                  <th className="px-3 py-3 text-center">Estoque atual</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="py-3 pl-3 pr-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E8DD] text-sm">
                {filteredProducts.map((product) => {
                  const margin = calculateProfitMargin(
                    product.precoVenda,
                    product.custoEstimado
                  );
                  const isLowStock = product.estoqueAtual < 3;
                  const isOutOfStock = product.estoqueAtual === 0;

                  return (
                    <tr
                      key={product.id}
                      className="transition-colors hover:bg-[#FCF9F4]"
                    >
                      <td className="py-3.5 pl-5 pr-4">
                        <div className="flex items-center gap-3.5">
                          <ResilientImage
                            src={product.imagemUrl}
                            alt={product.nome}
                            fallbackLabel={product.nome}
                            className="h-12 w-16 shrink-0 rounded-lg border border-[#EAE1D5] object-cover"
                          />
                          <div className="min-w-0 max-w-xs">
                            <p className="truncate font-semibold text-[#291D16]">
                              {product.nome}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-[#7A6658]">
                              {product.descricao}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3.5 text-right font-mono text-xs font-medium text-[#5C4A3E] tabular-nums">
                        {formatWeight(product.pesoGramas)}
                      </td>

                      <td className="px-3 py-3.5 text-right font-mono font-semibold text-[#291D16] tabular-nums">
                        {formatCurrency(product.precoVenda)}
                      </td>

                      <td className="px-3 py-3.5 text-right font-mono text-xs text-[#6B574A] tabular-nums">
                        {formatCurrency(product.custoEstimado)}
                      </td>

                      <td className="px-3 py-3.5 text-right">
                        <span
                          className={`font-mono text-sm font-semibold tabular-nums ${
                            margin >= 60
                              ? 'text-emerald-800'
                              : margin >= 45
                                ? 'text-[#B45309]'
                                : 'text-red-700'
                          }`}
                        >
                          {margin.toFixed(1).replace('.', ',')}%
                        </span>
                        <p className="font-mono text-[11px] text-[#7A6658] tabular-nums">
                          +{formatCurrency(product.precoVenda - product.custoEstimado)}
                        </p>
                      </td>

                      <td className="px-3 py-3.5">
                        <div className="flex flex-col items-center gap-1">
                          <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5DACB] bg-[#FAF7F2] p-0.5">
                            <button
                              type="button"
                              onClick={() => handleAdjustStock(product, -1)}
                              disabled={product.estoqueAtual === 0}
                              aria-label={`Diminuir estoque de ${product.nome}`}
                              className="flex h-6 w-6 items-center justify-center rounded-md text-[#5C4A3E] transition-colors hover:bg-white disabled:opacity-35"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span
                              className={`min-w-[2rem] text-center font-mono text-sm font-semibold tabular-nums ${
                                isLowStock ? 'text-red-700' : 'text-[#291D16]'
                              }`}
                            >
                              {product.estoqueAtual}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAdjustStock(product, 1)}
                              aria-label={`Aumentar estoque de ${product.nome}`}
                              className="flex h-6 w-6 items-center justify-center rounded-md text-[#5C4A3E] transition-colors hover:bg-white"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          {isLowStock && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
                              <AlertTriangle className="h-3 w-3" />
                              {isOutOfStock ? 'Esgotado' : 'Estoque baixo'}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3.5 text-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={product.ativo}
                          aria-label={`Alternar status de ${product.nome}`}
                          onClick={() => handleToggleActive(product)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309] focus-visible:ring-offset-2 ${
                            product.ativo ? 'bg-[#B45309]' : 'bg-[#D6C9B8]'
                          }`}
                        >
                          <span
                            className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-xs transition-transform ${
                              product.ativo ? 'translate-x-5.5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <p className="mt-1 text-[11px] font-medium text-[#7A6658]">
                          {product.ativo ? 'Ativo' : 'Pausado'}
                        </p>
                      </td>

                      <td className="py-3.5 pl-3 pr-5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(product)}
                            aria-label={`Editar ${product.nome}`}
                            className="rounded-lg p-2 text-[#6B574A] transition-colors hover:bg-[#FAF3E8] hover:text-[#B45309]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(product)}
                            aria-label={`Excluir ${product.nome}`}
                            className="rounded-lg p-2 text-[#8C7768] transition-colors hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#291D16]/45 backdrop-blur-[1px]"
            onClick={() => setModalOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
            className="relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#EAE1D5] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#EAE1D5] px-6 py-4">
              <h2
                id="product-modal-title"
                className="font-display text-xl font-semibold text-[#291D16]"
              >
                {form.id ? 'Editar sabor de pudim' : 'Cadastrar novo sabor'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Fechar modal"
                className="rounded-lg p-1.5 text-[#6B574A] hover:bg-[#FAF7F2]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4 p-6">
              <div>
                <label className="block text-sm font-medium text-[#291D16]">
                  Nome do produto
                </label>
                <input
                  type="text"
                  required
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Pudim de Pistache Siciliano"
                  className="mt-1.5 w-full rounded-lg border border-[#DFD4C6] bg-white px-3.5 py-2 text-sm text-[#291D16] focus:border-[#B45309] focus:outline-none focus:ring-2 focus:ring-[#B45309]/15"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#291D16]">
                  Descrição para o cardápio
                </label>
                <textarea
                  rows={2}
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Descreva ingredientes, textura e diferencial da calda..."
                  className="mt-1.5 w-full rounded-lg border border-[#DFD4C6] bg-white px-3.5 py-2 text-sm text-[#291D16] focus:border-[#B45309] focus:outline-none focus:ring-2 focus:ring-[#B45309]/15"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <label className="block text-xs font-medium text-[#5C4A3E]">
                    Peso (g)
                  </label>
                  <input
                    type="number"
                    min={100}
                    step={50}
                    required
                    value={form.pesoGramas}
                    onChange={(e) => setForm({ ...form, pesoGramas: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#DFD4C6] px-3 py-2 font-mono text-sm tabular-nums focus:border-[#B45309] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5C4A3E]">
                    Preço venda (R$)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="0.50"
                    required
                    value={form.precoVenda}
                    onChange={(e) => setForm({ ...form, precoVenda: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#DFD4C6] px-3 py-2 font-mono text-sm tabular-nums focus:border-[#B45309] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5C4A3E]">
                    Custo est. (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.50"
                    required
                    value={form.custoEstimado}
                    onChange={(e) =>
                      setForm({ ...form, custoEstimado: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-[#DFD4C6] px-3 py-2 font-mono text-sm tabular-nums focus:border-[#B45309] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5C4A3E]">
                    Estoque inicial
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.estoqueAtual}
                    onChange={(e) => setForm({ ...form, estoqueAtual: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#DFD4C6] px-3 py-2 font-mono text-sm tabular-nums focus:border-[#B45309] focus:outline-none"
                  />
                </div>
              </div>

              {/* Automatic Profit Margin Preview */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EAE1D5] bg-[#FAF7F2] px-4 py-3">
                <div>
                  <p className="text-xs font-medium text-[#6B574A]">
                    Margem de lucro calculada automaticamente
                  </p>
                  <p className="mt-0.5 text-xs text-[#856F60]">
                    Lucro bruto unitário:{' '}
                    <span className="font-mono font-semibold text-[#291D16] tabular-nums">
                      {formatCurrency(Math.max(0, formPreviewProfit))}
                    </span>
                  </p>
                </div>
                <span
                  className={`font-mono text-xl font-semibold tabular-nums ${
                    formPreviewMargin >= 60
                      ? 'text-emerald-800'
                      : formPreviewMargin >= 45
                        ? 'text-[#B45309]'
                        : 'text-red-700'
                  }`}
                >
                  {formPreviewMargin.toFixed(1).replace('.', ',')}%
                </span>
              </div>

              {/* Photo Selection */}
              <div>
                <label className="block text-sm font-medium text-[#291D16]">
                  Foto do produto
                </label>
                <div className="mt-2 grid grid-cols-4 gap-2.5">
                  {IMAGE_PRESETS.map((preset) => {
                    const selected = form.imagemUrl === preset.url;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setForm({ ...form, imagemUrl: preset.url })}
                        className={`overflow-hidden rounded-lg border text-left transition-all ${
                          selected
                            ? 'border-[#B45309] ring-2 ring-[#B45309]/25'
                            : 'border-[#E6DCD0] hover:border-[#CBB89E]'
                        }`}
                      >
                        <ResilientImage
                          src={preset.url}
                          alt={preset.label}
                          className="h-14 w-full object-cover"
                        />
                        <p className="truncate px-2 py-1 text-[11px] font-medium text-[#4C3B31]">
                          {preset.label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium text-[#291D16]">
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                    className="h-4 w-4 rounded border-[#CBB89E] accent-[#B45309]"
                  />
                  <span>Exibir imediatamente no cardápio público</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-[#EAE1D5] pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-[#DFD4C6] px-4 py-2 text-sm font-medium text-[#5C4A3E] hover:bg-[#FAF7F2]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#B45309] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#92400E] disabled:opacity-60"
                >
                  {saving
                    ? 'Salvando...'
                    : form.id
                      ? 'Salvar alterações'
                      : 'Cadastrar produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
