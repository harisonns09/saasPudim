import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  api,
  clearSession,
  getStoredSession,
  isDemoModeEnabled,
  setDemoModeEnabled,
} from '../services/api';
import { AuthSession } from '../types';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'error';
}

interface AppContextValue {
  currentPath: string;
  navigate: (path: string, replace?: boolean) => void;
  session: AuthSession | null;
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  setDemoMode: (enabled: boolean) => void;
  login: (email: string, senha: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => void;
  storeSlug: string;
  setStoreSlug: (slug: string) => void;
  storeName: string;
  setStoreName: (name: string) => void;
  toasts: ToastMessage[];
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

function normalizeInitialPath(): string {
  const path = window.location.pathname;
  if (!path || path === '/') {
    return getStoredSession() ? '/admin/pedidos' : '/admin/login';
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
      const target = session ? '/admin/pedidos' : '/admin/login';
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

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-2), { ...toast, id }]);
      window.setTimeout(() => {
        dismissToast(id);
      }, 4200);
    },
    [dismissToast]
  );

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
      navigate('/admin/pedidos', true);
    },
    [navigate]
  );

  const loginDemo = useCallback(async () => {
    setDemoModeEnabled(true);
    setIsDemoModeState(true);
    const demoSession = await api.loginDemo();
    setSession(demoSession);
    setStoreSlug(demoSession.tenantId);
    navigate('/admin/pedidos', true);
    pushToast({
      title: 'Bem-vinda à cozinha da Pudim da Maria',
      description: 'Painel carregado em Modo Demonstração.',
      tone: 'success',
    });
  }, [navigate, pushToast]);

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
