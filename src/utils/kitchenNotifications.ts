import { Order, OrderOrigin } from '../types';
import { formatCurrency, formatWeight } from './format';

export type BrowserNotificationPermission =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported';

const CHANNEL_NAME = 'pudimflow_kitchen_orders';
const LOCAL_EVENT_NAME = 'pudimflow:new-order';

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

export function playKitchenBellChime(): void {
  if (typeof window === 'undefined') return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [
      { freq: 880, start: 0, duration: 0.22 }, // A5
      { freq: 1174.66, start: 0.14, duration: 0.36 }, // D6
    ];

    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.14, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + duration + 0.03);
    });

    window.setTimeout(() => {
      ctx.close().catch(() => undefined);
    }, 700);
  } catch {
    // Ignore autoplay restriction errors before user gesture
  }
}

function formatOriginLabel(origin: OrderOrigin): string {
  if (origin === OrderOrigin.WHATSAPP_IA) return 'WhatsApp IA';
  if (origin === OrderOrigin.CARDAPIO_WEB) return 'Cardápio Público';
  return 'Pedido Manual';
}

export function sendBrowserOrderNotification(
  order: Order,
  storeName: string,
  onClick?: () => void
): boolean {
  if (getBrowserNotificationPermission() !== 'granted') {
    return false;
  }

  try {
    const itemsSummary = order.itens
      .map(
        (item) =>
          `${item.quantidade}x ${item.nomeProduto} (${formatWeight(item.pesoGramas)})`
      )
      .join(', ');

    const originLabel = formatOriginLabel(order.origem);
    const title = `Novo Pedido ${order.codigo} · ${originLabel}`;
    const body = `${order.clienteNome} — ${formatCurrency(order.valorTotal)}\n${itemsSummary}`;

    const notification = new Notification(title, {
      body,
      tag: `pudimflow-order-${order.id}`,
      silent: false,
      data: { orderId: order.id, storeName },
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      if (onClick) onClick();
    };

    return true;
  } catch {
    return false;
  }
}

export function sendTestBrowserNotification(
  storeName: string,
  onClick?: () => void
): boolean {
  if (getBrowserNotificationPermission() !== 'granted') {
    return false;
  }

  try {
    const notification = new Notification(`Cozinha conectada · ${storeName}`, {
      body: 'Os alertas de novos pedidos do Cardápio Público e WhatsApp IA estão ativos.',
      tag: 'pudimflow-kitchen-test',
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
      if (onClick) onClick();
    };
    return true;
  } catch {
    return false;
  }
}

/**
 * Broadcasts newly received orders to all open tabs and listeners in the current tab.
 */
export function broadcastNewOrder(order: Order): void {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent<Order>(LOCAL_EVENT_NAME, { detail: order }));

  if ('BroadcastChannel' in window) {
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage({ type: 'NEW_ORDER', order });
      channel.close();
    } catch {
      // Ignore BroadcastChannel errors in restricted contexts
    }
  }
}

export function subscribeNewOrderEvents(
  handler: (order: Order) => void
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const onLocalEvent = (event: Event) => {
    const customEvent = event as CustomEvent<Order>;
    if (customEvent.detail) {
      handler(customEvent.detail);
    }
  };

  window.addEventListener(LOCAL_EVENT_NAME, onLocalEvent);

  let channel: BroadcastChannel | null = null;
  if ('BroadcastChannel' in window) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent) => {
        if (event.data?.type === 'NEW_ORDER' && event.data?.order) {
          handler(event.data.order as Order);
        }
      };
    } catch {
      channel = null;
    }
  }

  return () => {
    window.removeEventListener(LOCAL_EVENT_NAME, onLocalEvent);
    if (channel) {
      channel.close();
    }
  };
}
