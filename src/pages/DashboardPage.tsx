import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  ArrowRight,
  Sparkles,
  RotateCcw,
  AlertTriangle,
  ChefHat,
  TrendingUp,
} from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { ResilientImage } from '../components/ResilientImage';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Order, OrderOrigin, OrderStatus, Product } from '../types';
import { formatCurrency, formatWeight } from '../utils/format';
import { subscribeNewOrderEvents } from '../utils/kitchenNotifications';

interface HourlyPoint {
  hora: string;
  receitaHora: number;
  receitaAcumulada: number;
  pedidos: number;
}

interface StatusVolumePoint {
  status: OrderStatus;
  label: string;
  quantidade: number;
  valorTotal: number;
  color: string;
}

interface TopFlavorPoint {
  produtoId: string;
  nome: string;
  nomeCurto: string;
  unidades: number;
  receita: number;
  participacao: number;
  pesoGramas: number;
  imagemUrl?: string;
}

const STATUS_CHART_META: Array<{
  status: OrderStatus;
  label: string;
  color: string;
}> = [
  { status: OrderStatus.PENDENTE, label: 'Pendente', color: '#D97706' },
  { status: OrderStatus.PAGO, label: 'Pago', color: '#0284C7' },
  { status: OrderStatus.EM_PRODUCAO, label: 'Produção', color: '#EA580C' },
  { status: OrderStatus.PRONTO, label: 'Pronto', color: '#059669' },
  { status: OrderStatus.ENTREGUE, label: 'Entregue', color: '#786355' },
];

const TOP_FLAVOR_COLORS = ['#9A3412', '#B45309', '#D97706'];

function extractOrderHour(order: Order): number {
  const created = new Date(order.criadoEm);
  if (!Number.isNaN(created.getTime())) {
    const utcHour = created.getUTCHours();
    if (utcHour >= 8 && utcHour <= 21) {
      return utcHour;
    }
    const localHour = created.getHours();
    if (localHour >= 8 && localHour <= 21) {
      return localHour;
    }
  }
  const match = order.horarioEntrega.match(/(\d{1,2}):\d{2}/);
  if (match) {
    return Math.min(21, Math.max(8, parseInt(match[1], 10)));
  }
  return 15;
}

function shortenFlavorName(name: string): string {
  return name
    .replace(/^Pudim\s+(de\s+)?/i, '')
    .replace(/\s+de Leite Condensado/i, '')
    .replace(/\s+Argentino/i, '')
    .trim();
}

export function DashboardPage() {
  const { isDemoMode, navigate, pushToast } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [revenueMode, setRevenueMode] = useState<'acumulada' | 'hora'>('acumulada');

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersData, productsData] = await Promise.all([
        api.getOrders(),
        api.getProducts(),
      ]);
      setOrders(ordersData);
      setProducts(productsData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar os indicadores do painel.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData, isDemoMode]);

  useEffect(() => {
    return subscribeNewOrderEvents((incomingOrder) => {
      setOrders((prev) => {
        if (prev.some((o) => o.id === incomingOrder.id)) return prev;
        return [incomingOrder, ...prev];
      });
    });
  }, []);

  const handleSimulateOrder = async () => {
    setSimulating(true);
    try {
      const created = await api.simulateWhatsAppOrder();
      setOrders((prev) => [created, ...prev]);
      pushToast({
        title: `Novo pedido ${created.codigo} contabilizado`,
        description: `${created.clienteNome} — ${formatCurrency(created.valorTotal)} via WhatsApp IA`,
        tone: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Erro ao simular pedido',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        tone: 'error',
      });
    } finally {
      setSimulating(false);
    }
  };

  // Summary KPIs
  const summary = useMemo(() => {
    const totalRevenue = orders.reduce((sum, order) => sum + order.valorTotal, 0);
    const totalOrders = orders.length;
    const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const activeKitchen = orders.filter(
      (o) =>
        o.status === OrderStatus.PAGO ||
        o.status === OrderStatus.EM_PRODUCAO ||
        o.status === OrderStatus.PRONTO
    ).length;
    const whatsappCount = orders.filter(
      (o) => o.origem === OrderOrigin.WHATSAPP_IA
    ).length;
    const whatsappShare =
      totalOrders > 0 ? (whatsappCount / totalOrders) * 100 : 0;
    const lowStockProducts = products.filter((p) => p.ativo && p.estoqueAtual < 3);

    return {
      totalRevenue,
      totalOrders,
      avgTicket,
      activeKitchen,
      whatsappCount,
      whatsappShare,
      lowStockCount: lowStockProducts.length,
    };
  }, [orders, products]);

  // 1. Hourly & Cumulative Daily Revenue Series
  const hourlyRevenueData = useMemo<HourlyPoint[]>(() => {
    const buckets = new Map<number, { receita: number; pedidos: number }>();
    const defaultHours = [10, 11, 12, 13, 14, 15, 16, 17, 18];

    defaultHours.forEach((h) => buckets.set(h, { receita: 0, pedidos: 0 }));

    orders.forEach((order) => {
      const hour = extractOrderHour(order);
      const current = buckets.get(hour) || { receita: 0, pedidos: 0 };
      buckets.set(hour, {
        receita: current.receita + order.valorTotal,
        pedidos: current.pedidos + 1,
      });
    });

    const sortedHours = Array.from(buckets.keys()).sort((a, b) => a - b);
    let runningTotal = 0;

    return sortedHours.map((hour) => {
      const entry = buckets.get(hour) || { receita: 0, pedidos: 0 };
      runningTotal += entry.receita;
      return {
        hora: `${String(hour).padStart(2, '0')}h`,
        receitaHora: Number(entry.receita.toFixed(2)),
        receitaAcumulada: Number(runningTotal.toFixed(2)),
        pedidos: entry.pedidos,
      };
    });
  }, [orders]);

  // 2. Order Volume by Status Series
  const statusVolumeData = useMemo<StatusVolumePoint[]>(() => {
    return STATUS_CHART_META.map((meta) => {
      const matching = orders.filter((order) => order.status === meta.status);
      return {
        status: meta.status,
        label: meta.label,
        quantidade: matching.length,
        valorTotal: matching.reduce((sum, o) => sum + o.valorTotal, 0),
        color: meta.color,
      };
    });
  }, [orders]);

  // 3. Top 3 Best-Selling Flavors
  const topFlavors = useMemo<TopFlavorPoint[]>(() => {
    const productById = new Map(products.map((p) => [p.id, p]));
    const totals = new Map<
      string,
      {
        produtoId: string;
        nome: string;
        unidades: number;
        receita: number;
        pesoGramas: number;
      }
    >();

    let grandUnits = 0;

    orders.forEach((order) => {
      order.itens.forEach((item) => {
        grandUnits += item.quantidade;
        const key = item.produtoId || item.nomeProduto;
        const current = totals.get(key) || {
          produtoId: item.produtoId,
          nome: item.nomeProduto,
          unidades: 0,
          receita: 0,
          pesoGramas: item.pesoGramas,
        };
        totals.set(key, {
          ...current,
          unidades: current.unidades + item.quantidade,
          receita: current.receita + item.precoUnitario * item.quantidade,
        });
      });
    });

    return Array.from(totals.values())
      .sort((a, b) => b.unidades - a.unidades || b.receita - a.receita)
      .slice(0, 3)
      .map((entry) => {
        const matchedProduct = productById.get(entry.produtoId);
        return {
          ...entry,
          nomeCurto: shortenFlavorName(entry.nome),
          participacao: grandUnits > 0 ? (entry.unidades / grandUnits) * 100 : 0,
          imagemUrl: matchedProduct?.imagemUrl,
        };
      });
  }, [orders, products]);

  return (
    <AdminLayout
      title="Visão Geral da Confeitaria"
      sectionLabel="Dashboard"
      topBarAction={
        <button
          type="button"
          onClick={handleSimulateOrder}
          disabled={simulating}
          className="inline-flex items-center gap-2 rounded-lg bg-[#B45309] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#92400E] disabled:opacity-60 whitespace-nowrap shrink-0 sm:px-4 sm:text-sm"
        >
          <Sparkles className="h-4 w-4" />
          <span>{simulating ? 'Recebendo...' : 'Simular Pedido via WhatsApp IA'}</span>
        </button>
      }
    >
      {error && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadDashboardData}
            className="inline-flex items-center gap-1.5 font-semibold underline"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Recarregar
          </button>
        </div>
      )}

      {/* KPI Strip */}
      <section
        aria-label="Indicadores principais do dia"
        className="mb-6 grid grid-cols-2 divide-y divide-[#EAE1D5] rounded-xl border border-[#EAE1D5] bg-white lg:grid-cols-4 lg:divide-x lg:divide-y-0"
      >
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-[#7A6658]">Receita do dia</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-[#291D16] tabular-nums">
            {formatCurrency(summary.totalRevenue)}
          </p>
          <p className="mt-1 text-xs text-[#7A6658] tabular-nums">
            Ticket médio: {formatCurrency(summary.avgTicket)}
          </p>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs font-medium text-[#7A6658]">Volume de pedidos</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-[#291D16] tabular-nums">
            {summary.totalOrders}
          </p>
          <p className="mt-1 text-xs text-[#7A6658] tabular-nums">
            {summary.activeKitchen} ativos na fila da cozinha
          </p>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs font-medium text-[#7A6658]">Vendas pelo WhatsApp IA</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-emerald-800 tabular-nums">
            {summary.whatsappShare.toFixed(0)}%
          </p>
          <p className="mt-1 text-xs text-[#7A6658] tabular-nums">
            {summary.whatsappCount} de {summary.totalOrders} pedidos fechados pela IA
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/admin/produtos')}
          className="px-5 py-4 text-left transition-colors hover:bg-[#FCF9F4]"
        >
          <p className="text-xs font-medium text-[#7A6658]">Alertas de estoque</p>
          <p
            className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums ${
              summary.lowStockCount > 0 ? 'text-red-700' : 'text-[#291D16]'
            }`}
          >
            {summary.lowStockCount}
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#B45309]">
            {summary.lowStockCount > 0 ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Sabores abaixo de 3 un.</span>
              </>
            ) : (
              <span>Estoque saudável</span>
            )}
          </p>
        </button>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-80 animate-pulse rounded-xl border border-[#EAE1D5] bg-white lg:col-span-7" />
          <div className="h-80 animate-pulse rounded-xl border border-[#EAE1D5] bg-white lg:col-span-5" />
          <div className="h-72 animate-pulse rounded-xl border border-[#EAE1D5] bg-white lg:col-span-12" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Chart 1: Receita do Dia (AreaChart) */}
          <section className="rounded-xl border border-[#EAE1D5] bg-white p-5 sm:p-6 lg:col-span-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-[#7A6658]">
                  <TrendingUp className="h-3.5 w-3.5 text-[#B45309]" />
                  <span>Desempenho financeiro de hoje</span>
                </div>
                <h2 className="mt-1 font-display text-lg font-semibold text-[#291D16]">
                  Receita do dia
                </h2>
              </div>

              <div className="inline-flex items-center gap-1 rounded-lg border border-[#E6DCD0] bg-[#F4EEE6] p-0.5">
                <button
                  type="button"
                  onClick={() => setRevenueMode('acumulada')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                    revenueMode === 'acumulada'
                      ? 'bg-white text-[#291D16] shadow-xs'
                      : 'text-[#6B574A] hover:text-[#291D16]'
                  }`}
                >
                  Acumulada
                </button>
                <button
                  type="button"
                  onClick={() => setRevenueMode('hora')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                    revenueMode === 'hora'
                      ? 'bg-white text-[#291D16] shadow-xs'
                      : 'text-[#6B574A] hover:text-[#291D16]'
                  }`}
                >
                  Por hora
                </button>
              </div>
            </div>

            <div className="mt-5 h-68 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={hourlyRevenueData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="pudimRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D97706" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#D97706" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#EFE7DC"
                  />
                  <XAxis
                    dataKey="hora"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#7A6658', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tickFormatter={(val: number) => `R$ ${val}`}
                    tick={{ fill: '#7A6658', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  />
                  <Tooltip
                    cursor={{ stroke: '#D4BFA6', strokeDasharray: '4 4' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const point = payload[0].payload as HourlyPoint;
                      return (
                        <div className="rounded-xl border border-[#E6DACB] bg-white px-3.5 py-2.5 shadow-lg shadow-[#291D16]/10">
                          <p className="font-mono text-xs font-semibold text-[#7A6658]">
                            Horário: {label}
                          </p>
                          <p className="mt-1 font-mono text-sm font-semibold text-[#291D16] tabular-nums">
                            {revenueMode === 'acumulada'
                              ? formatCurrency(point.receitaAcumulada)
                              : formatCurrency(point.receitaHora)}
                          </p>
                          <p className="mt-0.5 text-xs text-[#6B574A] tabular-nums">
                            {point.pedidos === 0
                              ? 'Sem novos pedidos nesta faixa'
                              : point.pedidos === 1
                                ? '1 pedido registrado'
                                : `${point.pedidos} pedidos registrados`}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey={revenueMode === 'acumulada' ? 'receitaAcumulada' : 'receitaHora'}
                    stroke="#B45309"
                    strokeWidth={2.5}
                    fill="url(#pudimRevenueFill)"
                    activeDot={{
                      r: 5,
                      fill: '#B45309',
                      stroke: '#FFFFFF',
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Chart 2: Volume de Pedidos por Status (BarChart) */}
          <section className="flex flex-col justify-between rounded-xl border border-[#EAE1D5] bg-white p-5 sm:p-6 lg:col-span-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[#7A6658]">
                  Distribuição no Kanban
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold text-[#291D16]">
                  Volume de pedidos por status
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin/pedidos')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#B45309] hover:text-[#92400E] whitespace-nowrap"
              >
                <span>Ver Kanban</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-5 h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={statusVolumeData}
                  margin={{ top: 10, right: 8, left: -18, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#EFE7DC"
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#5C4A3E', fontSize: 11, fontWeight: 500 }}
                    dy={6}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#7A6658', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  />
                  <Tooltip
                    cursor={{ fill: '#FAF7F2' }}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const point = payload[0].payload as StatusVolumePoint;
                      return (
                        <div className="rounded-xl border border-[#E6DACB] bg-white px-3.5 py-2.5 shadow-lg shadow-[#291D16]/10">
                          <p className="text-xs font-semibold text-[#291D16]">
                            {point.label}
                          </p>
                          <p className="mt-1 font-mono text-sm font-semibold text-[#B45309] tabular-nums">
                            {point.quantidade}{' '}
                            {point.quantidade === 1 ? 'pedido' : 'pedidos'}
                          </p>
                          <p className="mt-0.5 font-mono text-xs text-[#6B574A] tabular-nums">
                            {formatCurrency(point.valorTotal)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="quantidade" radius={[6, 6, 0, 0]} maxBarSize={42}>
                    {statusVolumeData.map((entry) => (
                      <Cell key={entry.status} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[#F0E8DD] pt-3 text-xs text-[#6B574A]">
              <span className="inline-flex items-center gap-1.5">
                <ChefHat className="h-3.5 w-3.5 text-[#B45309]" />
                Sincronizado com o quadro da cozinha
              </span>
              <span className="font-mono font-semibold text-[#291D16] tabular-nums">
                {summary.totalOrders} total
              </span>
            </div>
          </section>

          {/* Chart 3: Os 3 Sabores Mais Vendidos */}
          <section className="rounded-xl border border-[#EAE1D5] bg-white p-5 sm:p-6 lg:col-span-12">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#F0E8DD] pb-4">
              <div>
                <p className="text-xs font-medium text-[#7A6658]">
                  Ranking de demanda por sabor
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold text-[#291D16]">
                  Os 3 sabores mais vendidos
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin/produtos')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#B45309] hover:text-[#92400E] whitespace-nowrap"
              >
                <span>Gerenciar estoque</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {topFlavors.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#7A6658]">
                Ainda não há pedidos suficientes para montar o ranking de sabores.
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
                {/* Horizontal BarChart */}
                <div className="h-56 w-full lg:col-span-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topFlavors}
                      layout="vertical"
                      margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke="#EFE7DC"
                      />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: '#7A6658',
                          fontSize: 11,
                          fontFamily: 'JetBrains Mono',
                        }}
                      />
                      <YAxis
                        type="category"
                        dataKey="nomeCurto"
                        width={118}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#291D16', fontSize: 12, fontWeight: 600 }}
                      />
                      <Tooltip
                        cursor={{ fill: '#FAF7F2' }}
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const item = payload[0].payload as TopFlavorPoint;
                          return (
                            <div className="rounded-xl border border-[#E6DACB] bg-white px-3.5 py-2.5 shadow-lg shadow-[#291D16]/10">
                              <p className="text-xs font-semibold text-[#291D16]">
                                {item.nome}
                              </p>
                              <p className="mt-1 font-mono text-sm font-semibold text-[#B45309] tabular-nums">
                                {item.unidades}{' '}
                                {item.unidades === 1 ? 'unidade vendida' : 'unidades vendidas'}
                              </p>
                              <p className="mt-0.5 font-mono text-xs text-[#6B574A] tabular-nums">
                                Receita: {formatCurrency(item.receita)} (
                                {item.participacao.toFixed(0)}%)
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="unidades" radius={[0, 6, 6, 0]} barSize={28}>
                        {topFlavors.map((flavor, idx) => (
                          <Cell
                            key={flavor.produtoId || flavor.nome}
                            fill={TOP_FLAVOR_COLORS[idx] || '#D97706'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Structured Top 3 Detail List */}
                <div className="divide-y divide-[#F0E8DD] lg:col-span-6">
                  {topFlavors.map((flavor, idx) => (
                    <div
                      key={flavor.produtoId || flavor.nome}
                      className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <span className="font-mono text-sm font-semibold text-[#B45309] tabular-nums">
                          0{idx + 1}
                        </span>
                        <ResilientImage
                          src={flavor.imagemUrl}
                          alt={flavor.nome}
                          fallbackLabel={flavor.nomeCurto}
                          className="h-11 w-14 shrink-0 rounded-lg border border-[#EAE1D5] object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#291D16]">
                            {flavor.nome}
                          </p>
                          <p className="mt-0.5 text-xs text-[#7A6658] tabular-nums">
                            {formatWeight(flavor.pesoGramas)} ·{' '}
                            {flavor.participacao.toFixed(0)}% das unidades do dia
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="font-mono text-sm font-semibold text-[#291D16] tabular-nums">
                          {flavor.unidades} un.
                        </p>
                        <p className="font-mono text-xs text-emerald-800 tabular-nums">
                          {formatCurrency(flavor.receita)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
}
