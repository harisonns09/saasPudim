import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  api,
  clearSession,
  getStoredSession,
  isDemoModeEnabled,
  setDemoModeEnabled,
} from '../services/api';
import { AuthSession, Order, OrderOrigin } from '../types';
import { formatCurrency } from '../utils/format';
import {
  BrowserNotificationPermission,
  getBrowserNotificationPermission,
  playKitchenBellChime,
  requestBrowserNotificationPermission,
  sendBrowserOrderNotification,
  sendTestBrowserNotification,
  subscribeNewOrderEvents,
} from '../utils/kitchenNotifications';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'error';
}

export interface KitchenAlertItem {
  id: string;
  orderId: string;
  codigo: string;
  clienteNome: string;
  valorTotal: number;
  origem: OrderOrigin;
  resumoItens: string;
  horaRecebimento: string;
  read: boolean;
}

const PREF_KEYS = {
  BROWSER_NOTIF: 'pudimflow_browser_notif_enabled',
  SOUND_ALERTS: 'pudimflow_sound_alerts_enabled',
} as const;

function readBoolPref(key: string, fallback: boolean): boolean {
  try {
    const val = localStorage.getItem(key);
    if (val === null) return fallback;
    return val === 'true';
  } catch {
    return fallback;
  }
}

interface AppContextValue {
  currentPath: string;
  navigate: (path: string, replace?: boolean) => void;
  session: AuthSession | null;
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  setDemoMode: (enabled: boolean) => void;
  login: (email: string, senha: string) => Promise<void>;
  loginDemo: (redirectTo?: string) => Promise<void>;
  logout: () => void;
  storeSlug: string;
  setStoreSlug: (slug: string) => void;
  storeName: string;
  setStoreName: (name: string) => void;
  toasts: ToastMessage[];
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  browserNotificationsEnabled: boolean;
  soundAlertsEnabled: boolean;
  notificationPermission: BrowserNotificationPermission;
  toggleBrowserNotifications: () => Promise<void>;
  toggleSoundAlerts: () => void;
  testKitchenAlert: () => Promise<void>;
  kitchenAlerts: KitchenAlertItem[];
  unreadAlertsCount: number;
  markAlertsAsRead: () => void;
  isLiveConnected: boolean;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

function normalizeInitialPath(): string {
  const path = window.location.pathname;
  if (!path || path === '/') {
    return getStoredSession() ? '/admin/dashboard' : '/admin/login';
  }
  return path;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentPath, setCurrentPath] = useState<string>(normalizeInitialPath);
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  const [isDemoMode, setIsDemoModeState] = useState<boolean>(() => isDemoModeEnabled());
  const [storeSlug, setStoreSlug] = useState<string>('pudim-da-maria');
  const [storeName, setStoreName] = useState<string>('Pudim da Maria');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermission>(() => getBrowserNotificationPermission());
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState<boolean>(
    () => readBoolPref(PREF_KEYS.BROWSER_NOTIF, true)
  );
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState<boolean>(() =>
    readBoolPref(PREF_KEYS.SOUND_ALERTS, true)
  );
  const [kitchenAlerts, setKitchenAlerts] = useState<KitchenAlertItem[]>([]);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(true);
  const notifiedOrderIdsRef = useRef<Set<string>>(new Set());

  const navigate = useCallback((path: string, replace = false) => {
    if (replace) {
      window.history.replaceState({}, '', path);
    } else {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname || '/admin/login');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (window.location.pathname === '/') {
      const target = session ? '/admin/dashboard' : '/admin/login';
      window.history.replaceState({}, '', target);
      setCurrentPath(target);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    api
      .getStoreConfig()
      .then((cfg) => {
        if (cfg.slug) setStoreSlug(cfg.slug);
        if (cfg.nomeLoja) setStoreName(cfg.nomeLoja);
      })
      .catch(() => {
        // Ignore if Real API is offline during boot
      });
  }, [session, isDemoMode]);

  useEffect(() => {
    if (!session) {
      setIsLiveConnected(false);
      return;
    }
    return api.subscribeOrdersStream(
      () => {
        // Orders emitted by SSE are automatically broadcast to all listeners via broadcastNewOrder
      },
      (connected) => setIsLiveConnected(connected)
    );
  }, [session, isDemoMode]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-2), { ...toast, id }]);
      window.setTimeout(() => {
        dismissToast(id);
      }, 4500);
    },
    [dismissToast]
  );

  // Listen globally for incoming orders from Public Menu or WhatsApp IA
  useEffect(() => {
    const handleIncomingOrder = (order: Order) => {
      if (
        order.origem !== OrderOrigin.WHATSAPP_IA &&
        order.origem !== OrderOrigin.CARDAPIO_WEB
      ) {
        return;
      }

      if (notifiedOrderIdsRef.current.has(order.id)) {
        return;
      }
      notifiedOrderIdsRef.current.add(order.id);

      const horaRecebimento = new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date());

      const resumoItens = order.itens
        .map((item) => `${item.quantidade}x ${item.nomeProduto}`)
        .join(', ');

      setKitchenAlerts((prev) =>
        [
          {
            id: `alert-${order.id}`,
            orderId: order.id,
            codigo: order.codigo,
            clienteNome: order.clienteNome,
            valorTotal: order.valorTotal,
            origem: order.origem,
            resumoItens,
            horaRecebimento,
            read: false,
          },
          ...prev,
        ].slice(0, 15)
      );

      // Fire native browser notification and sound only when admin session is active
      if (!session) return;

      if (soundAlertsEnabled) {
        playKitchenBellChime();
      }

      if (browserNotificationsEnabled) {
        const sent = sendBrowserOrderNotification(order, storeName, () => {
          navigate('/admin/pedidos');
        });

        // If on a public route or browser notification was not available, provide an in-app toast when on admin pages
        const isOnAdminPage = window.location.pathname.startsWith('/admin');
        if (!sent && isOnAdminPage && order.origem === OrderOrigin.CARDAPIO_WEB) {
          pushToast({
            title: `Novo pedido ${order.codigo} via Cardápio Público`,
            description: `${order.clienteNome} · ${formatCurrency(order.valorTotal)}`,
            tone: 'success',
          });
        }
      }
    };

    return subscribeNewOrderEvents(handleIncomingOrder);
  }, [
    session,
    soundAlertsEnabled,
    browserNotificationsEnabled,
    storeName,
    navigate,
    pushToast,
  ]);

  const toggleBrowserNotifications = useCallback(async () => {
    const currentPerm = getBrowserNotificationPermission();
    setNotificationPermission(currentPerm);

    if (currentPerm === 'unsupported') {
      pushToast({
        title: 'Notificações indisponíveis neste navegador',
        description: 'Mantenha a campainha sonora ativa para alertar a cozinha.',
        tone: 'warning',
      });
      return;
    }

    if (currentPerm === 'denied') {
      pushToast({
        title: 'Permissão bloqueada pelo navegador',
        description:
          'Libere as notificações no ícone de cadeado da barra de endereço para receber avisos do sistema.',
        tone: 'warning',
      });
      return;
    }

    if (currentPerm === 'default') {
      const requested = await requestBrowserNotificationPermission();
      setNotificationPermission(requested);
      if (requested === 'granted') {
        setBrowserNotificationsEnabled(true);
        localStorage.setItem(PREF_KEYS.BROWSER_NOTIF, 'true');
        sendTestBrowserNotification(storeName, () => navigate('/admin/pedidos'));
        pushToast({
          title: 'Notificações da cozinha ativadas',
          description:
            'Você será alertado sempre que chegar um pedido pelo Cardápio Público ou WhatsApp IA.',
          tone: 'success',
        });
      } else {
        pushToast({
          title: 'Permissão não concedida',
          description: 'Você ainda receberá alertas sonoros e visuais no painel.',
          tone: 'neutral',
        });
      }
      return;
    }

    const nextEnabled = !browserNotificationsEnabled;
    setBrowserNotificationsEnabled(nextEnabled);
    localStorage.setItem(PREF_KEYS.BROWSER_NOTIF, String(nextEnabled));
    pushToast({
      title: nextEnabled
        ? 'Notificações do navegador reativadas'
        : 'Notificações do navegador pausadas',
      tone: 'neutral',
    });
  }, [browserNotificationsEnabled, storeName, navigate, pushToast]);

  const toggleSoundAlerts = useCallback(() => {
    setSoundAlertsEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(PREF_KEYS.SOUND_ALERTS, String(next));
      if (next) {
        playKitchenBellChime();
      }
      return next;
    });
  }, []);

  const testKitchenAlert = useCallback(async () => {
    if (soundAlertsEnabled) {
      playKitchenBellChime();
    }

    let perm = getBrowserNotificationPermission();
    if (perm === 'default') {
      perm = await requestBrowserNotificationPermission();
      setNotificationPermission(perm);
    }

    if (perm === 'granted' && browserNotificationsEnabled) {
      sendTestBrowserNotification(storeName, () => navigate('/admin/pedidos'));
      pushToast({
        title: 'Alerta de teste enviado',
        description: 'Notificação do navegador e campainha acionadas com sucesso.',
        tone: 'success',
      });
      return;
    }

    pushToast({
      title: 'Campainha de teste acionada',
      description:
        perm === 'denied'
          ? 'Notificações nativas bloqueadas pelo navegador — alerta sonoro e visual funcionando.'
          : 'Autorize as notificações do navegador para receber alertas mesmo fora da aba.',
      tone: 'neutral',
    });
  }, [
    soundAlertsEnabled,
    browserNotificationsEnabled,
    storeName,
    navigate,
    pushToast,
  ]);

  const markAlertsAsRead = useCallback(() => {
    setKitchenAlerts((prev) => prev.map((alert) => ({ ...alert, read: true })));
  }, []);

  const unreadAlertsCount = kitchenAlerts.filter((a) => !a.read).length;

  const setDemoMode = useCallback(
    (enabled: boolean) => {
      setDemoModeEnabled(enabled);
      setIsDemoModeState(enabled);
      pushToast({
        title: enabled ? 'Modo Demo ativado' : 'Modo API Real ativado',
        description: enabled
          ? 'Dados simulados da confeitaria Pudim da Maria prontos para teste.'
          : 'Conectando ao backend Quarkus configurado em VITE_API_URL.',
        tone: 'neutral',
      });
    },
    [pushToast]
  );

  const toggleDemoMode = useCallback(() => {
    setDemoMode(!isDemoMode);
  }, [isDemoMode, setDemoMode]);

  const login = useCallback(
    async (email: string, senha: string) => {
      const newSession = await api.login(email, senha);
      setSession(newSession);
      if (newSession.tenantId) setStoreSlug(newSession.tenantId);
      navigate('/admin/dashboard', true);
    },
    [navigate]
  );

  const loginDemo = useCallback(
    async (redirectTo = '/admin/dashboard') => {
      setDemoModeEnabled(true);
      setIsDemoModeState(true);
      const demoSession = await api.loginDemo();
      setSession(demoSession);
      setStoreSlug(demoSession.tenantId);
      navigate(redirectTo, true);
      pushToast({
        title: 'Bem-vinda ao painel da Pudim da Maria',
        description: 'Painel carregado em Modo Demonstração.',
        tone: 'success',
      });
    },
    [navigate, pushToast]
  );

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
    navigate('/admin/login', true);
  }, [navigate]);

  return (
    <AppContext.Provider
      value={{
        currentPath,
        navigate,
        session,
        isDemoMode,
        toggleDemoMode,
        setDemoMode,
        login,
        loginDemo,
        logout,
        storeSlug,
        setStoreSlug,
        storeName,
        setStoreName,
        toasts,
        pushToast,
        dismissToast,
        browserNotificationsEnabled,
        soundAlertsEnabled,
        notificationPermission,
        toggleBrowserNotifications,
        toggleSoundAlerts,
        testKitchenAlert,
        kitchenAlerts,
        unreadAlertsCount,
        markAlertsAsRead,
        isLiveConnected,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp deve ser usado dentro de AppProvider');
  }
  return ctx;
}
