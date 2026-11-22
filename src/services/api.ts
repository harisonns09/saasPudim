import {
  AuthSession,
  CreatePublicOrderPayload,
  DeliveryType,
  Order,
  OrderOrigin,
  OrderStatus,
  Product,
  PublicMenuResponse,
  StoreConfig,
} from '../types';
import {
  DEMO_SESSION,
  INITIAL_ORDERS,
  INITIAL_PRODUCTS,
  INITIAL_STORE_CONFIG,
  WHATSAPP_SIMULATION_TEMPLATES,
} from './mockData';
import { broadcastNewOrder } from '../utils/kitchenNotifications';

const STORAGE_KEYS = {
  TOKEN: 'pudimflow_token',
  SESSION: 'pudimflow_session',
  DEMO_MODE: 'pudimflow_demo_mode',
  ORDERS: 'pudimflow_demo_orders_v1',
  PRODUCTS: 'pudimflow_demo_products_v1',
  STORE_CONFIG: 'pudimflow_demo_config_v1',
  ORDER_SEQ: 'pudimflow_demo_order_seq_v1',
} as const;

export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors in constrained environments
  }
}

export function isDemoModeEnabled(): boolean {
  const stored = localStorage.getItem(STORAGE_KEYS.DEMO_MODE);
  if (stored === null) return true; // Enabled by default for immediate preview
  return stored === 'true';
}

export function setDemoModeEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEYS.DEMO_MODE, String(enabled));
}

export function getStoredSession(): AuthSession | null {
  return readJson<AuthSession | null>(STORAGE_KEYS.SESSION, null);
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(STORAGE_KEYS.TOKEN, session.token);
  writeJson(STORAGE_KEYS.SESSION, session);
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.SESSION);
}

function getDemoProducts(): Product[] {
  return readJson<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
}

function saveDemoProducts(products: Product[]): void {
  writeJson(STORAGE_KEYS.PRODUCTS, products);
}

function getDemoOrders(): Order[] {
  return readJson<Order[]>(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
}

function saveDemoOrders(orders: Order[]): void {
  writeJson(STORAGE_KEYS.ORDERS, orders);
}

function getDemoConfig(): StoreConfig {
  return readJson<StoreConfig>(STORAGE_KEYS.STORE_CONFIG, INITIAL_STORE_CONFIG);
}

function saveDemoConfig(config: StoreConfig): void {
  writeJson(STORAGE_KEYS.STORE_CONFIG, config);
}

function getNextOrderNumber(): number {
  const current = readJson<number>(STORAGE_KEYS.ORDER_SEQ, 1042);
  const next = current + 1;
  writeJson(STORAGE_KEYS.ORDER_SEQ, next);
  return next;
}

function delay(ms = 140): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RequestOptions extends RequestInit {
  tenantSlug?: string;
  requiresAuth?: boolean;
}

async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { tenantSlug, requiresAuth = false, headers = {}, ...rest } = options;
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (requiresAuth) {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  if (tenantSlug) {
    requestHeaders['X-Tenant-Id'] = tenantSlug;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...rest,
    headers: requestHeaders,
  });

  if (!response.ok) {
    let message = `Erro na API (${response.status})`;
    try {
      const errorData = await response.json();
      if (errorData?.message) message = errorData.message;
    } catch {
      // Keep default status message
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  async login(email: string, senha: string): Promise<AuthSession> {
    if (isDemoModeEnabled()) {
      await delay(260);
      if (!email.trim() || !senha.trim()) {
        throw new Error('Preencha e-mail e senha para entrar.');
      }
      const session: AuthSession = {
        ...DEMO_SESSION,
        email: email.trim(),
      };
      saveSession(session);
      return session;
    }

    const data = await apiRequest<{ token: string; tenantId: string; nome: string }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, senha }),
      }
    );

    const session: AuthSession = {
      token: data.token,
      tenantId: data.tenantId,
      nome: data.nome,
      email,
    };
    saveSession(session);
    return session;
  },

  async loginDemo(): Promise<AuthSession> {
    setDemoModeEnabled(true);
    await delay(180);
    saveSession(DEMO_SESSION);
    return DEMO_SESSION;
  },

  async getOrders(): Promise<Order[]> {
    if (isDemoModeEnabled()) {
      await delay(120);
      return getDemoOrders();
    }
    return apiRequest<Order[]>('/admin/pedidos', { requiresAuth: true });
  },

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
    if (isDemoModeEnabled()) {
      await delay(100);
      const orders = getDemoOrders();
      const updated = orders.map((order) =>
        order.id === orderId ? { ...order, status } : order
      );
      saveDemoOrders(updated);
      const target = updated.find((o) => o.id === orderId);
      if (!target) throw new Error('Pedido não encontrado.');
      return target;
    }

    return apiRequest<Order>(`/admin/pedidos/${orderId}/status`, {
      method: 'PATCH',
      requiresAuth: true,
      body: JSON.stringify({ status }),
    });
  },

  async simulateWhatsAppOrder(): Promise<Order> {
    await delay(180);
    const config = getDemoConfig();
    const orders = getDemoOrders();
    const nextNumber = getNextOrderNumber();
    const template =
      WHATSAPP_SIMULATION_TEMPLATES[nextNumber % WHATSAPP_SIMULATION_TEMPLATES.length];

    const subtotal = template.itens.reduce(
      (sum, item) => sum + item.precoUnitario * item.quantidade,
      0
    );
    const taxaEntrega =
      template.tipoEntrega === DeliveryType.ENTREGA ? config.taxaEntregaPadrao : 0;

    const newOrder: Order = {
      id: `ord-${nextNumber}`,
      codigo: `#${nextNumber}`,
      clienteNome: template.clienteNome,
      clienteWhatsapp: template.clienteWhatsapp,
      horarioEntrega: template.horarioEntrega,
      tipoEntrega: template.tipoEntrega,
      endereco: template.endereco,
      observacoes: template.observacoes,
      itens: template.itens,
      subtotal,
      taxaEntrega,
      valorTotal: subtotal + taxaEntrega,
      status: OrderStatus.PENDENTE,
      origem: OrderOrigin.WHATSAPP_IA,
      criadoEm: new Date().toISOString(),
    };

    saveDemoOrders([newOrder, ...orders]);

    // Update simulated AI token usage realistically
    const updatedConfig: StoreConfig = {
      ...config,
      consumoIa: {
        ...config.consumoIa,
        tokensUsados: Math.min(
          config.consumoIa.limiteMensal,
          config.consumoIa.tokensUsados + 1450
        ),
        atendimentosMes: config.consumoIa.atendimentosMes + 1,
      },
    };
    saveDemoConfig(updatedConfig);
    broadcastNewOrder(newOrder);

    return newOrder;
  },

  /**
   * Prepared for Quarkus SSE endpoint: GET /api/pedidos/stream
   * Returns a cleanup function.
   */
  subscribeOrdersStream(
    onNewOrder: (order: Order) => void,
    onConnectionChange: (connected: boolean) => void
  ): () => void {
    if (isDemoModeEnabled()) {
      onConnectionChange(true);
      return () => {
        onConnectionChange(false);
      };
    }

    const token = localStorage.getItem(STORAGE_KEYS.TOKEN) || '';
    const streamUrl = `${API_BASE_URL}/pedidos/stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(streamUrl);

    eventSource.onopen = () => onConnectionChange(true);
    eventSource.onerror = () => onConnectionChange(false);
    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as Order;
        broadcastNewOrder(parsed);
        onNewOrder(parsed);
      } catch {
        // Ignore malformed heartbeat payloads
      }
    };

    return () => {
      eventSource.close();
      onConnectionChange(false);
    };
  },

  async getProducts(): Promise<Product[]> {
    if (isDemoModeEnabled()) {
      await delay(120);
      return getDemoProducts();
    }
    return apiRequest<Product[]>('/admin/produtos', { requiresAuth: true });
  },

  async saveProduct(
    productInput: Omit<Product, 'id'> & { id?: string }
  ): Promise<Product> {
    if (isDemoModeEnabled()) {
      await delay(150);
      const products = getDemoProducts();
      if (productInput.id) {
        const updatedProduct: Product = {
          ...(productInput as Product),
        };
        const nextList = products.map((item) =>
          item.id === updatedProduct.id ? updatedProduct : item
        );
        saveDemoProducts(nextList);
        return updatedProduct;
      }

      const created: Product = {
        ...productInput,
        id: `prod-${Date.now()}`,
      };
      saveDemoProducts([created, ...products]);
      return created;
    }

    if (productInput.id) {
      return apiRequest<Product>(`/admin/produtos/${productInput.id}`, {
        method: 'PUT',
        requiresAuth: true,
        body: JSON.stringify(productInput),
      });
    }

    return apiRequest<Product>('/admin/produtos', {
      method: 'POST',
      requiresAuth: true,
      body: JSON.stringify(productInput),
    });
  },

  async toggleProductActive(productId: string, ativo: boolean): Promise<Product> {
    if (isDemoModeEnabled()) {
      await delay(90);
      const products = getDemoProducts();
      const next = products.map((p) => (p.id === productId ? { ...p, ativo } : p));
      saveDemoProducts(next);
      const target = next.find((p) => p.id === productId);
      if (!target) throw new Error('Produto não encontrado.');
      return target;
    }

    return apiRequest<Product>(`/admin/produtos/${productId}`, {
      method: 'PATCH',
      requiresAuth: true,
      body: JSON.stringify({ ativo }),
    });
  },

  async adjustProductStock(productId: string, delta: number): Promise<Product> {
    if (isDemoModeEnabled()) {
      await delay(80);
      const products = getDemoProducts();
      const next = products.map((p) =>
        p.id === productId
          ? { ...p, estoqueAtual: Math.max(0, p.estoqueAtual + delta) }
          : p
      );
      saveDemoProducts(next);
      const target = next.find((p) => p.id === productId);
      if (!target) throw new Error('Produto não encontrado.');
      return target;
    }

    return apiRequest<Product>(`/admin/produtos/${productId}/estoque`, {
      method: 'PATCH',
      requiresAuth: true,
      body: JSON.stringify({ delta }),
    });
  },

  async deleteProduct(productId: string): Promise<void> {
    if (isDemoModeEnabled()) {
      await delay(100);
      const products = getDemoProducts().filter((p) => p.id !== productId);
      saveDemoProducts(products);
      return;
    }

    await apiRequest<void>(`/admin/produtos/${productId}`, {
      method: 'DELETE',
      requiresAuth: true,
    });
  },

  async getStoreConfig(): Promise<StoreConfig> {
    if (isDemoModeEnabled()) {
      await delay(120);
      return getDemoConfig();
    }
    return apiRequest<StoreConfig>('/admin/configuracoes', { requiresAuth: true });
  },

  async updateStoreConfig(config: StoreConfig): Promise<StoreConfig> {
    if (isDemoModeEnabled()) {
      await delay(180);
      saveDemoConfig(config);
      return config;
    }
    return apiRequest<StoreConfig>('/admin/configuracoes', {
      method: 'PUT',
      requiresAuth: true,
      body: JSON.stringify(config),
    });
  },

  async getPublicMenu(slug: string): Promise<PublicMenuResponse> {
    if (isDemoModeEnabled()) {
      await delay(140);
      const config = getDemoConfig();
      const products = getDemoProducts().filter(
        (product) => product.ativo && product.estoqueAtual > 0
      );
      return {
        loja: {
          nomeLoja: config.nomeLoja,
          slug: slug || config.slug,
          subtitulo: config.subtitulo,
          taxaEntregaPadrao: config.taxaEntregaPadrao,
          abertaParaEncomendas: config.abertaParaEncomendas,
          tempoPreparoMedio: config.tempoPreparoMedio,
          enderecoRetirada: config.enderecoRetirada,
          bannerUrl: config.bannerUrl,
          whatsappId: config.whatsappId,
        },
        produtos: products,
      };
    }

    return apiRequest<PublicMenuResponse>(`/loja/${encodeURIComponent(slug)}/cardapio`, {
      tenantSlug: slug,
    });
  },

  async createPublicOrder(
    slug: string,
    payload: CreatePublicOrderPayload
  ): Promise<Order> {
    if (isDemoModeEnabled()) {
      await delay(260);
      const config = getDemoConfig();
      const products = getDemoProducts();
      const orders = getDemoOrders();
      const nextNumber = getNextOrderNumber();

      const resolvedItems = payload.itens.map((entry) => {
        const product = products.find((p) => p.id === entry.produtoId);
        if (!product) {
          throw new Error('Um dos produtos selecionados não está mais disponível.');
        }
        return {
          produtoId: product.id,
          nomeProduto: product.nome,
          pesoGramas: product.pesoGramas,
          quantidade: entry.quantidade,
          precoUnitario: product.precoVenda,
        };
      });

      const subtotal = resolvedItems.reduce(
        (sum, item) => sum + item.precoUnitario * item.quantidade,
        0
      );
      const taxaEntrega =
        payload.tipoEntrega === DeliveryType.ENTREGA ? config.taxaEntregaPadrao : 0;

      const createdOrder: Order = {
        id: `ord-${nextNumber}`,
        codigo: `#${nextNumber}`,
        clienteNome: payload.clienteNome.trim(),
        clienteWhatsapp: payload.clienteWhatsapp.trim(),
        horarioEntrega: payload.horarioEntrega || 'Hoje, próximo horário',
        tipoEntrega: payload.tipoEntrega,
        endereco:
          payload.tipoEntrega === DeliveryType.ENTREGA
            ? payload.endereco?.trim()
            : undefined,
        observacoes: payload.observacoes?.trim() || undefined,
        itens: resolvedItems,
        subtotal,
        taxaEntrega,
        valorTotal: subtotal + taxaEntrega,
        status: OrderStatus.PENDENTE,
        origem: OrderOrigin.CARDAPIO_WEB,
        criadoEm: new Date().toISOString(),
      };

      // Decrement inventory in demo mode so Admin Products stays synchronized
      const updatedProducts = products.map((product) => {
        const ordered = payload.itens.find((i) => i.produtoId === product.id);
        if (!ordered) return product;
        return {
          ...product,
          estoqueAtual: Math.max(0, product.estoqueAtual - ordered.quantidade),
        };
      });

      saveDemoProducts(updatedProducts);
      saveDemoOrders([createdOrder, ...orders]);
      broadcastNewOrder(createdOrder);
      return createdOrder;
    }

    const created = await apiRequest<Order>(
      `/loja/${encodeURIComponent(slug)}/pedidos`,
      {
        method: 'POST',
        tenantSlug: slug,
        body: JSON.stringify(payload),
      }
    );
    broadcastNewOrder(created);
    return created;
  },
};
