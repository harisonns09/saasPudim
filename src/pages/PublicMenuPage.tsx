import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShoppingBag,
  Plus,
  Minus,
  MapPin,
  Clock,
  CheckCircle2,
  X,
  ArrowLeft,
  Bike,
  Store,
  AlertCircle,
  ChefHat,
  RotateCcw,
} from 'lucide-react';
import { ResilientImage } from '../components/ResilientImage';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { DeliveryType, Order, Product, PublicMenuResponse } from '../types';
import { formatCurrency, formatWeight } from '../utils/format';

interface PublicMenuPageProps {
  slug: string;
}

export function PublicMenuPage({ slug }: PublicMenuPageProps) {
  const { navigate, session, loginDemo, isDemoMode, pushToast } = useApp();
  const [menuData, setMenuData] = useState<PublicMenuResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cart, setCart] = useState<Record<string, number>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Checkout Form
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(DeliveryType.ENTREGA);
  const [clienteNome, setClienteNome] = useState('');
  const [clienteWhatsapp, setClienteWhatsapp] = useState('');
  const [endereco, setEndereco] = useState('');
  const [horarioEntrega, setHorarioEntrega] = useState('Hoje, 18:00');
  const [observacoes, setObservacoes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  const loadMenu = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getPublicMenu(slug);
      setMenuData(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar o cardápio desta loja.'
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu, isDemoMode]);

  const products = useMemo(() => {
    return (menuData?.produtos || []).filter(
      (product) => product.ativo && product.estoqueAtual > 0
    );
  }, [menuData]);

  const cartEntries = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantidade]) => {
        const product = products.find((p) => p.id === productId);
        return product ? { product, quantidade } : null;
      })
      .filter((entry): entry is { product: Product; quantidade: number } => entry !== null);
  }, [cart, products]);

  const totalItems = useMemo(
    () => cartEntries.reduce((sum, item) => sum + item.quantidade, 0),
    [cartEntries]
  );

  const subtotal = useMemo(
    () =>
      cartEntries.reduce(
        (sum, item) => sum + item.product.precoVenda * item.quantidade,
        0
      ),
    [cartEntries]
  );

  const deliveryFee =
    deliveryType === DeliveryType.ENTREGA
      ? menuData?.loja.taxaEntregaPadrao || 0
      : 0;

  const grandTotal = subtotal + deliveryFee;

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const current = prev[product.id] || 0;
      if (current >= product.estoqueAtual) {
        pushToast({
          title: `Limite de estoque atingido`,
          description: `Temos ${product.estoqueAtual} unidade(s) disponível(is) de ${product.nome}.`,
          tone: 'warning',
        });
        return prev;
      }
      return { ...prev, [product.id]: current + 1 };
    });
  };

  const decrementCart = (productId: string) => {
    setCart((prev) => {
      const current = prev[productId] || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: current - 1 };
    });
  };

  const handleFinalizeOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (cartEntries.length === 0) {
      setFormError('Adicione pelo menos um pudim à sacola.');
      return;
    }
    if (!clienteNome.trim() || !clienteWhatsapp.trim()) {
      setFormError('Informe seu nome e WhatsApp para confirmarmos o pedido.');
      return;
    }
    if (deliveryType === DeliveryType.ENTREGA && !endereco.trim()) {
      setFormError('Informe o endereço completo para entrega.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.createPublicOrder(slug, {
        clienteNome,
        clienteWhatsapp,
        tipoEntrega: deliveryType,
        endereco: deliveryType === DeliveryType.ENTREGA ? endereco : undefined,
        horarioEntrega,
        observacoes,
        itens: cartEntries.map(({ product, quantidade }) => ({
          produtoId: product.id,
          quantidade,
        })),
      });

      setConfirmedOrder(created);
      setCart({});
      setDrawerOpen(false);
      await loadMenu();
      pushToast({
        title: `Pedido ${created.codigo} enviado para a cozinha!`,
        description: isDemoMode
          ? 'Ele já apareceu na coluna Pendente do Kanban administrativo.'
          : 'A loja receberá seu pedido em instantes.',
        tone: 'success',
      });
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Erro ao finalizar pedido.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4EEE6] sm:py-6">
      {/* Mobile-First Container */}
      <div className="mx-auto min-h-screen w-full max-w-lg bg-[#FAF7F2] sm:min-h-[calc(100vh-3rem)] sm:overflow-hidden sm:rounded-3xl sm:border sm:border-[#E4D9C9] sm:shadow-xl sm:shadow-[#291D16]/6">
        {/* Top Utility Strip for returning to Admin during testing */}
        <div className="flex items-center justify-between border-b border-[#EAE1D5] bg-white px-4 py-2.5 text-xs">
          <button
            type="button"
            onClick={() => navigate(session ? '/admin/dashboard' : '/admin/login')}
            className="inline-flex items-center gap-1.5 font-semibold text-[#5C4A3E] transition-colors hover:text-[#B45309]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{session ? 'Voltar ao Painel' : 'Área da Confeitaria'}</span>
          </button>
          <span className="font-mono text-[11px] text-[#856F60]">
            /loja/{slug}
          </span>
        </div>

        {loading ? (
          <div className="space-y-4 p-5">
            <div className="h-44 animate-pulse rounded-2xl bg-[#EBE2D6]" />
            <div className="h-28 animate-pulse rounded-xl bg-white" />
            <div className="h-28 animate-pulse rounded-xl bg-white" />
          </div>
        ) : error || !menuData ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <AlertCircle className="h-9 w-9 text-red-700" />
            <h1 className="mt-3 font-display text-xl font-semibold text-[#291D16]">
              Cardápio indisponível
            </h1>
            <p className="mt-1.5 text-sm text-[#6B574A]">
              {error || 'Não encontramos esta confeitaria.'}
            </p>
            <button
              type="button"
              onClick={loadMenu}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#B45309] px-4 py-2.5 text-sm font-semibold text-white"
            >
              <RotateCcw className="h-4 w-4" />
              Tentar novamente
            </button>
          </div>
        ) : confirmedOrder ? (
          /* Order Confirmation Receipt Screen */
          <div className="px-5 py-8">
            <div className="rounded-2xl border border-[#EAE1D5] bg-white p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="mt-3 font-mono text-sm font-semibold text-[#B45309] tabular-nums">
                Pedido {confirmedOrder.codigo}
              </p>
              <h1 className="mt-1 font-display text-2xl font-semibold text-[#291D16]">
                Encomenda recebida
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#6B574A]">
                Obrigado, {confirmedOrder.clienteNome}. A cozinha da{' '}
                <strong className="font-semibold text-[#291D16]">
                  {menuData.loja.nomeLoja}
                </strong>{' '}
                já recebeu seu pedido e confirmará pelo WhatsApp{' '}
                <span className="tabular-nums">{confirmedOrder.clienteWhatsapp}</span>.
              </p>

              <div className="mt-6 space-y-2 border-y border-[#F0E8DD] py-4 text-left text-sm">
                {confirmedOrder.itens.map((item, idx) => (
                  <div
                    key={`${item.produtoId}-${idx}`}
                    className="flex justify-between gap-2"
                  >
                    <span className="text-[#4C3B31]">
                      <strong className="font-mono text-[#B45309] tabular-nums">
                        {item.quantidade}x
                      </strong>{' '}
                      {item.nomeProduto} ({formatWeight(item.pesoGramas)})
                    </span>
                    <span className="font-mono font-medium text-[#291D16] tabular-nums">
                      {formatCurrency(item.precoUnitario * item.quantidade)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 text-xs text-[#7A6658]">
                  <span>
                    {confirmedOrder.tipoEntrega === DeliveryType.ENTREGA
                      ? 'Entrega'
                      : 'Retirada no balcão'}
                  </span>
                  <span className="font-mono tabular-nums">
                    {confirmedOrder.taxaEntrega > 0
                      ? formatCurrency(confirmedOrder.taxaEntrega)
                      : 'Grátis'}
                  </span>
                </div>
                <div className="flex justify-between pt-1 text-base font-semibold text-[#291D16]">
                  <span>Total</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(confirmedOrder.valorTotal)}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!session && isDemoMode) {
                      void loginDemo('/admin/pedidos');
                    } else {
                      navigate('/admin/pedidos');
                    }
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#B45309] px-4 py-3 text-sm font-semibold text-white hover:bg-[#92400E]"
                >
                  <ChefHat className="h-4 w-4" />
                  <span>Ver pedido no Kanban da Cozinha</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmedOrder(null)}
                  className="w-full rounded-xl border border-[#DFD4C6] bg-white px-4 py-2.5 text-sm font-semibold text-[#5C4A3E] hover:bg-[#FAF7F2]"
                >
                  Fazer novo pedido
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Main Mobile-First Storefront */
          <div className={totalItems > 0 ? 'pb-24' : 'pb-10'}>
            {/* Store Hero Header */}
            <header className="relative">
              <div className="relative h-44 w-full overflow-hidden bg-[#291D16]">
                <ResilientImage
                  src={menuData.loja.bannerUrl}
                  alt={menuData.loja.nomeLoja}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#21150F]/90 via-[#291D16]/35 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <p className="text-xs font-medium text-amber-200">
                    {menuData.loja.abertaParaEncomendas
                      ? 'Aberto para encomendas'
                      : 'Fechado no momento'}
                  </p>
                  <h1 className="mt-0.5 font-display text-2xl font-semibold tracking-tight text-white">
                    {menuData.loja.nomeLoja}
                  </h1>
                </div>
              </div>

              <div className="border-b border-[#EAE1D5] bg-white px-4 py-3.5">
                <p className="text-xs leading-relaxed text-[#6B574A]">
                  {menuData.loja.subtitulo}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-[#4C3B31]">
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Bike className="h-3.5 w-3.5 text-[#B45309]" />
                    Entrega {formatCurrency(menuData.loja.taxaEntregaPadrao)}
                  </span>
                  <span aria-hidden="true" className="text-[#C9B7A2]">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-[#B45309]" />
                    {menuData.loja.tempoPreparoMedio}
                  </span>
                </div>
              </div>
            </header>

            {/* Flavor Catalog */}
            <main className="px-4 pt-5">
              <div className="mb-3.5 flex items-baseline justify-between">
                <h2 className="font-display text-lg font-semibold text-[#291D16]">
                  Sabores do dia
                </h2>
                <span className="text-xs text-[#7A6658] tabular-nums">
                  {products.length} disponíveis
                </span>
              </div>

              {products.length === 0 ? (
                <div className="rounded-2xl border border-[#EAE1D5] bg-white px-5 py-12 text-center">
                  <Store className="mx-auto h-8 w-8 text-[#C9B7A2]" />
                  <p className="mt-3 font-display text-base font-semibold text-[#291D16]">
                    Fornada esgotada por hoje
                  </p>
                  <p className="mt-1 text-xs text-[#6B574A]">
                    Todos os pudins ativos estão sem estoque no momento.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {products.map((product) => {
                    const qtyInCart = cart[product.id] || 0;
                    const isLowStock = product.estoqueAtual < 3;

                    return (
                      <article
                        key={product.id}
                        className="overflow-hidden rounded-2xl border border-[#EAE1D5] bg-white transition-colors hover:border-[#D7C6B0]"
                      >
                        <div className="flex gap-3.5 p-3.5">
                          <ResilientImage
                            src={product.imagemUrl}
                            alt={product.nome}
                            fallbackLabel={product.nome}
                            className="h-24 w-24 shrink-0 rounded-xl border border-[#F0E8DD] object-cover sm:h-28 sm:w-28"
                          />

                          <div className="flex min-w-0 flex-1 flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#856F60]">
                                <span className="font-mono tabular-nums">
                                  {formatWeight(product.pesoGramas)}
                                </span>
                                {product.destaque && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-[#B45309]">
                                      {product.destaque}
                                    </span>
                                  </>
                                )}
                              </div>
                              <h3 className="mt-0.5 font-sans text-sm font-semibold leading-snug text-[#291D16]">
                                {product.nome}
                              </h3>
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#6B574A]">
                                {product.descricao}
                              </p>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-2">
                              <div>
                                <p className="font-mono text-base font-semibold text-[#291D16] tabular-nums">
                                  {formatCurrency(product.precoVenda)}
                                </p>
                                {isLowStock && (
                                  <p className="text-[11px] font-medium text-amber-800">
                                    Restam {product.estoqueAtual} un.
                                  </p>
                                )}
                              </div>

                              {qtyInCart === 0 ? (
                                <button
                                  type="button"
                                  disabled={!menuData.loja.abertaParaEncomendas}
                                  onClick={() => addToCart(product)}
                                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#B45309] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#92400E] disabled:opacity-50 whitespace-nowrap"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  <span>Adicionar</span>
                                </button>
                              ) : (
                                <div className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-[#DFD2C0] bg-[#FAF7F2] px-1.5">
                                  <button
                                    type="button"
                                    onClick={() => decrementCart(product.id)}
                                    aria-label={`Remover uma unidade de ${product.nome}`}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#291D16] shadow-xs hover:text-[#B45309]"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <span className="min-w-[1.25rem] text-center font-mono text-sm font-semibold text-[#291D16] tabular-nums">
                                    {qtyInCart}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => addToCart(product)}
                                    aria-label={`Adicionar mais uma unidade de ${product.nome}`}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#B45309] text-white hover:bg-[#92400E]"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {/* Pickup address footnote */}
              <div className="mt-6 flex items-start gap-2 rounded-xl border border-[#EAE1D5] bg-white/80 px-3.5 py-3 text-xs text-[#6B574A]">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" />
                <div>
                  <span className="font-semibold text-[#291D16]">Retirada na loja: </span>
                  <span>{menuData.loja.enderecoRetirada}</span>
                </div>
              </div>
            </main>

            {/* Compact Floating Bottom Cart Bar (<= 15% mobile viewport height) */}
            {totalItems > 0 && (
              <div className="fixed bottom-4 left-1/2 z-30 w-full max-w-lg -translate-x-1/2 px-4">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="flex w-full items-center justify-between rounded-2xl bg-[#291D16] px-4 py-3.5 text-white shadow-xl shadow-[#291D16]/25 transition-transform active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#D97706] font-mono text-xs font-bold text-white tabular-nums">
                      {totalItems}
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-[#DFD2C0]">
                        {totalItems === 1 ? '1 pudim na sacola' : `${totalItems} pudins na sacola`}
                      </p>
                      <p className="font-mono text-sm font-semibold tabular-nums">
                        {formatCurrency(subtotal)}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/12 px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    Ver Sacola
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Slide-Up Mobile Checkout Drawer */}
        {drawerOpen && menuData && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
            <div
              className="fixed inset-0 bg-[#291D16]/50 backdrop-blur-[1px]"
              onClick={() => setDrawerOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="checkout-drawer-title"
              className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-[#FAF7F2] shadow-2xl sm:rounded-3xl"
            >
              <div className="flex items-center justify-between border-b border-[#EAE1D5] bg-white px-5 py-4 rounded-t-3xl">
                <div>
                  <h2
                    id="checkout-drawer-title"
                    className="font-display text-lg font-semibold text-[#291D16]"
                  >
                    Finalizar encomenda
                  </h2>
                  <p className="text-xs text-[#7A6658]">{menuData.loja.nomeLoja}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Fechar sacola"
                  className="rounded-lg p-1.5 text-[#6B574A] hover:bg-[#FAF7F2]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                onSubmit={handleFinalizeOrder}
                className="flex-1 space-y-5 overflow-y-auto px-5 py-5"
              >
                {/* Cart Items with + and - */}
                <div>
                  <h3 className="font-sans text-xs font-semibold text-[#6B574A]">
                    Seus pudins
                  </h3>
                  <div className="mt-2 divide-y divide-[#F0E8DD] rounded-2xl border border-[#EAE1D5] bg-white">
                    {cartEntries.map(({ product, quantidade }) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#291D16]">
                            {product.nome}
                          </p>
                          <p className="font-mono text-xs text-[#7A6658] tabular-nums">
                            {formatWeight(product.pesoGramas)} ·{' '}
                            {formatCurrency(product.precoVenda * quantidade)}
                          </p>
                        </div>

                        <div className="inline-flex items-center gap-2 rounded-lg border border-[#E5DACB] bg-[#FAF7F2] p-0.5">
                          <button
                            type="button"
                            onClick={() => decrementCart(product.id)}
                            aria-label="Diminuir quantidade"
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-[#291D16]"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[1.25rem] text-center font-mono text-xs font-semibold tabular-nums">
                            {quantidade}
                          </span>
                          <button
                            type="button"
                            onClick={() => addToCart(product)}
                            aria-label="Aumentar quantidade"
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-[#B45309] text-white"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery vs Pickup Selector */}
                <div>
                  <h3 className="font-sans text-xs font-semibold text-[#6B574A]">
                    Como deseja receber?
                  </h3>
                  <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-[#E6DCD0] bg-[#EFE8DE] p-1">
                    <button
                      type="button"
                      onClick={() => setDeliveryType(DeliveryType.ENTREGA)}
                      className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-colors ${
                        deliveryType === DeliveryType.ENTREGA
                          ? 'bg-white text-[#291D16] shadow-xs'
                          : 'text-[#6B574A]'
                      }`}
                    >
                      <Bike className="h-4 w-4 text-[#B45309]" />
                      <span>
                        Entrega ({formatCurrency(menuData.loja.taxaEntregaPadrao)})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryType(DeliveryType.RETIRADA)}
                      className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-colors ${
                        deliveryType === DeliveryType.RETIRADA
                          ? 'bg-white text-[#291D16] shadow-xs'
                          : 'text-[#6B574A]'
                      }`}
                    >
                      <Store className="h-4 w-4 text-[#B45309]" />
                      <span>Retirada (Grátis)</span>
                    </button>
                  </div>
                </div>

                {/* Customer Info Fields */}
                <div className="space-y-3.5 rounded-2xl border border-[#EAE1D5] bg-white p-4">
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-[#5C4A3E]">
                        Seu nome *
                      </label>
                      <input
                        type="text"
                        required
                        value={clienteNome}
                        onChange={(e) => setClienteNome(e.target.value)}
                        placeholder="Ex: Ana Paula Silva"
                        className="mt-1 w-full rounded-lg border border-[#DFD4C6] px-3 py-2 text-sm text-[#291D16] focus:border-[#B45309] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#5C4A3E]">
                        WhatsApp *
                      </label>
                      <input
                        type="tel"
                        required
                        value={clienteWhatsapp}
                        onChange={(e) => setClienteWhatsapp(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="mt-1 w-full rounded-lg border border-[#DFD4C6] px-3 py-2 text-sm tabular-nums text-[#291D16] focus:border-[#B45309] focus:outline-none"
                      />
                    </div>
                  </div>

                  {deliveryType === DeliveryType.ENTREGA ? (
                    <div>
                      <label className="block text-xs font-medium text-[#5C4A3E]">
                        Endereço de entrega *
                      </label>
                      <input
                        type="text"
                        required
                        value={endereco}
                        onChange={(e) => setEndereco(e.target.value)}
                        placeholder="Rua, número, complemento e bairro"
                        className="mt-1 w-full rounded-lg border border-[#DFD4C6] px-3 py-2 text-sm text-[#291D16] focus:border-[#B45309] focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div className="rounded-lg bg-[#FAF7F2] px-3 py-2 text-xs text-[#6B574A]">
                      <strong className="text-[#291D16]">Local de retirada:</strong>{' '}
                      {menuData.loja.enderecoRetirada}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-[#5C4A3E]">
                      Horário desejado
                    </label>
                    <select
                      value={horarioEntrega}
                      onChange={(e) => setHorarioEntrega(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#DFD4C6] bg-white px-3 py-2 text-sm text-[#291D16] focus:border-[#B45309] focus:outline-none"
                    >
                      <option value="Hoje, 17:00">Hoje, 17:00</option>
                      <option value="Hoje, 18:00">Hoje, 18:00</option>
                      <option value="Hoje, 19:00">Hoje, 19:00</option>
                      <option value="Amanhã, 11:00">Amanhã, 11:00</option>
                      <option value="Amanhã, 15:00">Amanhã, 15:00</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#5C4A3E]">
                      Observações (opcional)
                    </label>
                    <textarea
                      rows={2}
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      placeholder="Ex: Embalagem para presente, calda à parte..."
                      className="mt-1 w-full rounded-lg border border-[#DFD4C6] px-3 py-2 text-sm text-[#291D16] focus:border-[#B45309] focus:outline-none"
                    />
                  </div>
                </div>

                {formError && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-900"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-700" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Order Total Summary */}
                <div className="space-y-1.5 rounded-2xl border border-[#EAE1D5] bg-white px-4 py-3.5 text-sm">
                  <div className="flex justify-between text-[#6B574A]">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#6B574A]">
                    <span>
                      {deliveryType === DeliveryType.ENTREGA
                        ? 'Taxa de entrega'
                        : 'Retirada no balcão'}
                    </span>
                    <span className="font-mono tabular-nums">
                      {deliveryFee > 0 ? formatCurrency(deliveryFee) : 'Grátis'}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-[#F0E8DD] pt-2 text-base font-semibold text-[#291D16]">
                    <span>Total do pedido</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(grandTotal)}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || cartEntries.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#B45309] px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#92400E] disabled:opacity-50"
                >
                  <span>
                    {submitting
                      ? 'Enviando pedido...'
                      : `Finalizar Pedido · ${formatCurrency(grandTotal)}`}
                  </span>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
