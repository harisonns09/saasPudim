import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Store,
  ClipboardList,
  Clock,
  ArrowRight,
  Search,
  MapPin,
  ShoppingBag,
  Phone,
  X,
  MessageSquareText,
  Sparkles,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { ExportMenuButton } from '../components/ExportMenuButton';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { DeliveryType, Order, OrderOrigin, OrderStatus } from '../types';
import { formatCurrency, formatWeight } from '../utils/format';
import { exportOrdersCsv, exportOrdersPdf } from '../utils/exportData';
import { subscribeNewOrderEvents } from '../utils/kitchenNotifications';

interface ColumnDefinition {
  status: OrderStatus;
  label: string;
  nextStatus: OrderStatus | null;
  nextActionLabel: string | null;
  accentText: string;
  headerBg: string;
}

const KANBAN_COLUMNS: ColumnDefinition[] = [
  {
    status: OrderStatus.PENDENTE,
    label: 'Pendente',
    nextStatus: OrderStatus.PAGO,
    nextActionLabel: 'Confirmar Pago',
    accentText: 'text-amber-800',
    headerBg: 'bg-amber-50/80 border-amber-200/80',
  },
  {
    status: OrderStatus.PAGO,
    label: 'Pago',
    nextStatus: OrderStatus.EM_PRODUCAO,
    nextActionLabel: 'Iniciar Produção',
    accentText: 'text-sky-800',
    headerBg: 'bg-sky-50/80 border-sky-200/80',
  },
  {
    status: OrderStatus.EM_PRODUCAO,
    label: 'Em Produção',
    nextStatus: OrderStatus.PRONTO,
    nextActionLabel: 'Marcar Pronto',
    accentText: 'text-orange-800',
    headerBg: 'bg-orange-50/80 border-orange-200/80',
  },
  {
    status: OrderStatus.PRONTO,
    label: 'Pronto',
    nextStatus: OrderStatus.ENTREGUE,
    nextActionLabel: 'Entregar Pedido',
    accentText: 'text-emerald-800',
    headerBg: 'bg-emerald-50/80 border-emerald-200/80',
  },
  {
    status: OrderStatus.ENTREGUE,
    label: 'Entregue',
    nextStatus: null,
    nextActionLabel: null,
    accentText: 'text-[#5C4A3E]',
    headerBg: 'bg-[#F4EEE6] border-[#E4D9C9]',
  },
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDENTE]: 'Pendente',
  [OrderStatus.PAGO]: 'Pago',
  [OrderStatus.EM_PRODUCAO]: 'Em Produção',
  [OrderStatus.PRONTO]: 'Pronto',
  [OrderStatus.ENTREGUE]: 'Entregue',
};

function OriginTag({ origin }: { origin: OrderOrigin }) {
  if (origin === OrderOrigin.WHATSAPP_IA) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-800 ring-1 ring-inset ring-violet-200/90 whitespace-nowrap">
        <Bot className="h-3 w-3 text-emerald-700" />
        WhatsApp IA
      </span>
    );
  }
  if (origin === OrderOrigin.CARDAPIO_WEB) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-inset ring-amber-200/90 whitespace-nowrap">
        <Store className="h-3 w-3 text-[#B45309]" />
        Cardápio Web
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#F4EEE6] px-2 py-0.5 text-[11px] font-semibold text-[#5C4A3E] ring-1 ring-inset ring-[#E2D6C6] whitespace-nowrap">
      <ClipboardList className="h-3 w-3 text-[#7A6658]" />
      Manual
    </span>
  );
}

export function OrdersKanbanPage() {
  const { isDemoMode, storeName, pushToast } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [originFilter, setOriginFilter] = useState<'ALL' | OrderOrigin>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOrders();
      setOrders(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar os pedidos da cozinha.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders, isDemoMode]);

  useEffect(() => {
    return subscribeNewOrderEvents((incomingOrder) => {
      setOrders((prev) => {
        if (prev.some((o) => o.id === incomingOrder.id)) return prev;
        return [incomingOrder, ...prev];
      });
    });
  }, []);

  const handleSimulateWhatsAppOrder = async () => {
    setSimulating(true);
    try {
      const created = await api.simulateWhatsAppOrder();
      setOrders((prev) => [created, ...prev]);
      pushToast({
        title: `Novo pedido via WhatsApp IA (${created.codigo})`,
        description: `${created.clienteNome} • ${created.itens
          .map((i) => `${i.quantidade}x ${i.nomeProduto.replace('Pudim ', '')}`)
          .join(', ')}`,
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

  const handleMoveStatus = async (order: Order, nextStatus: OrderStatus) => {
    setUpdatingId(order.id);
    try {
      const updated = await api.updateOrderStatus(order.id, nextStatus);
      setOrders((prev) => prev.map((item) => (item.id === order.id ? updated : item)));
      if (selectedOrder?.id === order.id) {
        setSelectedOrder(updated);
      }
      pushToast({
        title: `Pedido ${order.codigo} movido para ${STATUS_LABELS[nextStatus]}`,
        tone: 'neutral',
      });
    } catch (err) {
      pushToast({
        title: 'Falha ao atualizar status',
        description: err instanceof Error ? err.message : 'Verifique a conexão.',
        tone: 'error',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      if (originFilter !== 'ALL' && order.origem !== originFilter) return false;
      if (!term) return true;
      return (
        order.codigo.toLowerCase().includes(term) ||
        order.clienteNome.toLowerCase().includes(term) ||
        order.itens.some((item) => item.nomeProduto.toLowerCase().includes(term))
      );
    });
  }, [orders, originFilter, searchQuery]);

  const metrics = useMemo(() => {
    const totalRevenue = orders.reduce((sum, o) => sum + o.valorTotal, 0);
    const inKitchen = orders.filter(
      (o) => o.status === OrderStatus.PAGO || o.status === OrderStatus.EM_PRODUCAO
    ).length;
    const whatsappIaCount = orders.filter(
      (o) => o.origem === OrderOrigin.WHATSAPP_IA
    ).length;
    const pendingCount = orders.filter((o) => o.status === OrderStatus.PENDENTE).length;
    return { totalRevenue, inKitchen, whatsappIaCount, pendingCount };
  }, [orders]);

  const handleExportCsv = () => {
    const filename = exportOrdersCsv(filteredOrders, storeName);
    pushToast({
      title: 'CSV de pedidos exportado',
      description: `Arquivo ${filename} baixado com ${filteredOrders.length} registro(s).`,
      tone: 'success',
    });
  };

  const handleExportPdf = () => {
    const filename = exportOrdersPdf(filteredOrders, storeName);
    pushToast({
      title: 'Relatório PDF de pedidos gerado',
      description: `Arquivo ${filename} pronto para arquivamento contábil.`,
      tone: 'success',
    });
  };

  return (
    <AdminLayout
      title="Kanban de Pedidos da Cozinha"
      sectionLabel="Pedidos (Cozinha)"
      topBarAction={
        <button
          type="button"
          onClick={handleSimulateWhatsAppOrder}
          disabled={simulating}
          className="inline-flex items-center gap-2 rounded-lg bg-[#B45309] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#92400E] disabled:opacity-60 whitespace-nowrap shrink-0 sm:px-4 sm:text-sm"
        >
          <Sparkles className="h-4 w-4" />
          <span>{simulating ? 'Recebendo...' : 'Simular Pedido via WhatsApp IA'}</span>
        </button>
      }
    >
      {/* Operational KPI Strip */}
      <section
        aria-label="Resumo operacional do dia"
        className="mb-5 grid grid-cols-2 divide-y divide-[#EAE1D5] rounded-xl border border-[#EAE1D5] bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0"
      >
        <div className="px-4 py-3.5">
          <p className="text-xs font-medium text-[#7A6658]">Pedidos hoje</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#291D16] tabular-nums">
            {orders.length}
          </p>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-xs font-medium text-[#7A6658]">Aguardando confirmação</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#B45309] tabular-nums">
            {metrics.pendingCount}
          </p>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-xs font-medium text-[#7A6658]">Ativos na cozinha</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#291D16] tabular-nums">
            {metrics.inKitchen}
          </p>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-xs font-medium text-[#7A6658]">
            Faturamento · {metrics.whatsappIaCount} via IA
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-emerald-800 tabular-nums">
            {formatCurrency(metrics.totalRevenue)}
          </p>
        </div>
      </section>

      {/* Filter Toolbar */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8C7768]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por código, cliente ou sabor..."
            className="w-full rounded-lg border border-[#E2D7C8] bg-white py-2 pl-9 pr-3.5 text-sm text-[#291D16] placeholder-[#9B8878] focus:border-[#B45309] focus:outline-none focus:ring-2 focus:ring-[#B45309]/15"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#E6DCD0] bg-[#F4EEE6] p-1">
            {[
              { value: 'ALL' as const, label: 'Todos' },
              { value: OrderOrigin.WHATSAPP_IA, label: 'WhatsApp IA' },
              { value: OrderOrigin.CARDAPIO_WEB, label: 'Cardápio Web' },
              { value: OrderOrigin.MANUAL, label: 'Manual' },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setOriginFilter(tab.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  originFilter === tab.value
                    ? 'bg-white text-[#291D16] shadow-xs'
                    : 'text-[#6B574A] hover:text-[#291D16]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <ExportMenuButton
            recordCount={filteredOrders.length}
            recordLabel={filteredOrders.length === 1 ? 'pedido' : 'pedidos'}
            onExportCsv={handleExportCsv}
            onExportPdf={handleExportPdf}
            disabled={loading}
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadOrders}
            className="inline-flex items-center gap-1.5 font-semibold underline"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* 5-Column Kanban Board */}
      <div className="kanban-scroll -mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="grid min-w-[1220px] grid-cols-5 gap-4">
          {KANBAN_COLUMNS.map((column) => {
            const columnOrders = filteredOrders.filter((o) => o.status === column.status);

            return (
              <section
                key={column.status}
                aria-label={`Coluna ${column.label}`}
                className="flex min-h-[540px] flex-col rounded-xl border border-[#EAE1D5] bg-[#F5EFE7]/70"
              >
                <div
                  className={`flex items-center justify-between rounded-t-xl border-b px-3.5 py-3 ${column.headerBg}`}
                >
                  <h2 className={`font-sans text-sm font-semibold ${column.accentText}`}>
                    {column.label}
                  </h2>
                  <span className="font-mono text-xs font-semibold text-[#5C4A3E] tabular-nums">
                    {columnOrders.length}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-3">
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2].map((skeleton) => (
                        <div
                          key={skeleton}
                          className="h-40 animate-pulse rounded-xl border border-[#EAE1D5] bg-white/80"
                        />
                      ))}
                    </div>
                  ) : columnOrders.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-[#DFD4C6] px-4 py-8 text-center">
                      <p className="text-xs font-medium text-[#8C7768]">
                        Nenhum pedido em {column.label.toLowerCase()}
                      </p>
                    </div>
                  ) : (
                    columnOrders.map((order) => (
                      <article
                        key={order.id}
                        className="group flex flex-col rounded-xl border border-[#EAE1D5] bg-white p-3.5 transition-colors hover:border-[#D4BFA6]"
                      >
                        {/* Header row: Code + Origin */}
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="font-mono text-xs font-semibold text-[#291D16] hover:text-[#B45309] tabular-nums"
                          >
                            {order.codigo}
                          </button>
                          <OriginTag origin={order.origem} />
                        </div>

                        {/* Customer + Delivery Time */}
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="mt-2.5 text-left"
                        >
                          <h3 className="font-sans text-sm font-semibold text-[#291D16] group-hover:text-[#9A3412]">
                            {order.clienteNome}
                          </h3>
                          <div className="mt-1 flex items-center gap-2 text-xs text-[#6B574A]">
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Clock className="h-3 w-3 text-[#8C7768]" />
                              {order.horarioEntrega}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {order.tipoEntrega === DeliveryType.ENTREGA
                                ? 'Entrega'
                                : 'Retirada'}
                            </span>
                          </div>
                        </button>

                        {/* Items summary */}
                        <ul className="mt-3 space-y-1 border-t border-[#F3ECE2] pt-2.5 text-xs text-[#4C3B31]">
                          {order.itens.map((item, idx) => (
                            <li
                              key={`${order.id}-${item.produtoId}-${idx}`}
                              className="flex items-start gap-1.5 leading-snug"
                            >
                              <span className="font-mono font-semibold text-[#B45309] tabular-nums">
                                {item.quantidade}x
                              </span>
                              <span className="flex-1">
                                {item.nomeProduto}{' '}
                                <span className="text-[#856F60]">
                                  {formatWeight(item.pesoGramas)}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>

                        {order.observacoes && (
                          <p className="mt-2.5 line-clamp-2 rounded-md bg-[#FAF7F2] px-2.5 py-1.5 text-[11px] leading-relaxed text-[#6B574A]">
                            {order.observacoes}
                          </p>
                        )}

                        {/* Footer: Total + Quick Advance */}
                        <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-[#F3ECE2] pt-3">
                          <span className="font-mono text-sm font-semibold text-[#291D16] tabular-nums">
                            {formatCurrency(order.valorTotal)}
                          </span>

                          {column.nextStatus && column.nextActionLabel ? (
                            <button
                              type="button"
                              disabled={updatingId === order.id}
                              onClick={() => handleMoveStatus(order, column.nextStatus!)}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#FAF3E8] px-2.5 py-1.5 text-xs font-semibold text-[#9A3412] transition-colors hover:bg-[#B45309] hover:text-white disabled:opacity-50 whitespace-nowrap"
                            >
                              <span>{column.nextActionLabel}</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Concluído
                            </span>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Order Details Slide-over Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-[#291D16]/40 backdrop-blur-[1px]"
            onClick={() => setSelectedOrder(null)}
          />
          <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EAE1D5] px-6 py-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-base font-semibold text-[#291D16] tabular-nums">
                    {selectedOrder.codigo}
                  </span>
                  <OriginTag origin={selectedOrder.origem} />
                </div>
                <p className="mt-0.5 text-xs text-[#7A6658]">
                  Status atual: {STATUS_LABELS[selectedOrder.status]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                aria-label="Fechar detalhes do pedido"
                className="rounded-lg p-1.5 text-[#6B574A] hover:bg-[#FAF7F2] hover:text-[#291D16]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <div>
                <h3 className="font-sans text-xs font-semibold text-[#856F60]">
                  Cliente e logística
                </h3>
                <p className="mt-1.5 font-display text-lg font-semibold text-[#291D16]">
                  {selectedOrder.clienteNome}
                </p>
                <div className="mt-2.5 space-y-2 text-sm text-[#4C3B31]">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-[#8C7768]" />
                    <span className="tabular-nums">{selectedOrder.clienteWhatsapp}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#8C7768]" />
                    <span>{selectedOrder.horarioEntrega}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    {selectedOrder.tipoEntrega === DeliveryType.ENTREGA ? (
                      <>
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" />
                        <span>{selectedOrder.endereco || 'Endereço a confirmar'}</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" />
                        <span>Retirada no balcão da loja</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {selectedOrder.observacoes && (
                <div className="rounded-xl border border-[#EAE1D5] bg-[#FAF7F2] p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6B574A]">
                    <MessageSquareText className="h-3.5 w-3.5 text-[#B45309]" />
                    Observações do pedido
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#291D16]">
                    {selectedOrder.observacoes}
                  </p>
                </div>
              )}

              <div>
                <h3 className="font-sans text-xs font-semibold text-[#856F60]">
                  Itens encomendados
                </h3>
                <div className="mt-2.5 divide-y divide-[#F0E8DD] rounded-xl border border-[#EAE1D5]">
                  {selectedOrder.itens.map((item, index) => (
                    <div
                      key={`${item.produtoId}-${index}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-[#291D16]">
                          <span className="font-mono font-semibold text-[#B45309] tabular-nums">
                            {item.quantidade}x
                          </span>{' '}
                          {item.nomeProduto}
                        </p>
                        <p className="text-xs text-[#7A6658]">
                          {formatWeight(item.pesoGramas)} ·{' '}
                          {formatCurrency(item.precoUnitario)} un.
                        </p>
                      </div>
                      <span className="font-mono font-semibold text-[#291D16] tabular-nums">
                        {formatCurrency(item.precoUnitario * item.quantidade)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between text-[#6B574A]">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(selectedOrder.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#6B574A]">
                    <span>Taxa de entrega</span>
                    <span className="font-mono tabular-nums">
                      {selectedOrder.taxaEntrega > 0
                        ? formatCurrency(selectedOrder.taxaEntrega)
                        : 'Grátis'}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-[#EAE1D5] pt-2 text-base font-semibold text-[#291D16]">
                    <span>Total</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(selectedOrder.valorTotal)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-sans text-xs font-semibold text-[#856F60]">
                  Mover etapa na cozinha
                </h3>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {KANBAN_COLUMNS.map((col) => {
                    const isCurrent = selectedOrder.status === col.status;
                    return (
                      <button
                        key={col.status}
                        type="button"
                        disabled={isCurrent || updatingId === selectedOrder.id}
                        onClick={() => handleMoveStatus(selectedOrder, col.status)}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                          isCurrent
                            ? 'border-[#B45309] bg-[#FAF3E8] text-[#9A3412]'
                            : 'border-[#E6DCD0] bg-white text-[#4C3B31] hover:border-[#B45309] hover:text-[#291D16]'
                        }`}
                      >
                        {col.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </AdminLayout>
  );
}
