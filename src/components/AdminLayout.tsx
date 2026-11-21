import React, { useState } from 'react';
import {
  ChefHat,
  Package,
  Sparkles,
  Store,
  ArrowUpRight,
  LogOut,
  Menu,
  X,
  Radio,
  Database,
  Server,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { API_BASE_URL } from '../services/api';

interface AdminLayoutProps {
  title: string;
  sectionLabel: string;
  topBarAction?: React.ReactNode;
  isLiveConnected?: boolean;
  children: React.ReactNode;
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#B45309] text-[#FAF7F2]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-4.5 w-4.5"
          aria-hidden="true"
        >
          <path
            d="M5 17.5C5 16.67 5.67 16 6.5 16H17.5C18.33 16 19 16.67 19 17.5C19 18.33 18.33 19 17.5 19H6.5C5.67 19 5 18.33 5 17.5Z"
            fill="currentColor"
            fillOpacity="0.45"
          />
          <path
            d="M6.8 15.5L8.3 8.2C8.6 6.9 9.7 6 11 6H13C14.3 6 15.4 6.9 15.7 8.2L17.2 15.5H6.8Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M8.1 9.5C9.3 10.6 10.4 9.1 12 10.2C13.6 11.3 14.7 9.3 15.9 10.1"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {!compact && (
        <span className="font-display text-lg font-semibold tracking-tight text-[#291D16]">
          PudimFlow
        </span>
      )}
    </div>
  );
}

export function AdminLayout({
  title,
  sectionLabel,
  topBarAction,
  isLiveConnected = true,
  children,
}: AdminLayoutProps) {
  const {
    currentPath,
    navigate,
    session,
    logout,
    storeSlug,
    storeName,
    isDemoMode,
    toggleDemoMode,
  } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    {
      label: 'Pedidos (Cozinha)',
      path: '/admin/pedidos',
      icon: ChefHat,
    },
    {
      label: 'Produtos & Estoque',
      path: '/admin/produtos',
      icon: Package,
    },
    {
      label: 'Agente de IA & Loja',
      path: '/admin/configuracoes',
      icon: Sparkles,
    },
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white">
      <div>
        <div className="flex items-center justify-between border-b border-[#EAE1D5] px-5 py-4">
          <button
            type="button"
            onClick={() => handleNavClick('/admin/pedidos')}
            className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309] rounded-md"
          >
            <BrandMark />
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Fechar menu"
            className="rounded-lg p-1.5 text-[#6B574A] hover:bg-[#FAF7F2] lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-[#F2EAE0]">
          <p className="text-xs font-medium text-[#856F60]">Confeitaria ativa</p>
          <p className="mt-0.5 truncate font-display text-base font-semibold text-[#291D16]">
            {storeName}
          </p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-[#856F60]">
            /loja/{storeSlug}
          </p>
        </div>

        <nav className="space-y-1 p-3" aria-label="Navegação principal">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNavClick(item.path)}
                className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#FAF3E8] text-[#9A3412]'
                    : 'text-[#5C4A3E] hover:bg-[#FAF7F2] hover:text-[#291D16]'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-[#B45309]' : 'text-[#8C7768]'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-3 pt-2">
          <button
            type="button"
            onClick={() => handleNavClick(`/loja/${storeSlug}`)}
            className="flex w-full items-center justify-between rounded-lg border border-[#E6D9C7] bg-[#FAF7F2] px-3.5 py-2.5 text-sm font-medium text-[#291D16] transition-colors hover:border-[#D97706] hover:bg-[#FDF8F1]"
          >
            <span className="flex items-center gap-2.5 whitespace-nowrap">
              <Store className="h-4 w-4 text-[#B45309]" />
              Ver meu Cardápio
            </span>
            <ArrowUpRight className="h-4 w-4 text-[#8C7768]" />
          </button>
        </div>
      </div>

      <div className="space-y-3 border-t border-[#EAE1D5] p-4">
        <div className="rounded-lg border border-[#EFE6DA] bg-[#FAF7F2] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#5C4A3E]">
              {isDemoMode ? (
                <Database className="h-3.5 w-3.5 text-[#B45309]" />
              ) : (
                <Server className="h-3.5 w-3.5 text-emerald-700" />
              )}
              {isDemoMode ? 'Modo Demo' : 'API Real'}
            </span>
            <button
              type="button"
              onClick={toggleDemoMode}
              className="rounded-md border border-[#DFD2C0] bg-white px-2 py-1 text-[11px] font-semibold text-[#291D16] transition-colors hover:border-[#B45309] hover:text-[#B45309] whitespace-nowrap"
            >
              {isDemoMode ? 'Usar API Real' : 'Usar Demo'}
            </button>
          </div>
          {!isDemoMode && (
            <p className="mt-1.5 truncate font-mono text-[10px] text-[#7A6658]" title={API_BASE_URL}>
              {API_BASE_URL}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-[#291D16]">
              {session?.nome || 'Confeiteira'}
            </p>
            <p className="truncate text-[11px] text-[#7A6658]">
              {session?.email || 'admin@pudimflow.com'}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Sair da conta"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#7A6658] transition-colors hover:bg-[#FAF7F2] hover:text-[#291D16]"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#FAF7F2] text-[#291D16]">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-[#EAE1D5] bg-white lg:block">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile/Tablet Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#291D16]/40 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 h-full w-72 max-w-[85vw] border-r border-[#EAE1D5] bg-white shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#EAE1D5] bg-white/95 px-4 py-3.5 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu lateral"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#EAE1D5] bg-[#FAF7F2] text-[#291D16] lg:hidden"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-[#7A6658]">
                <span className="truncate">{storeName}</span>
                <span aria-hidden="true">/</span>
                <span className="truncate font-medium text-[#5C4A3E]">{sectionLabel}</span>
              </div>
              <h1 className="truncate font-display text-lg font-semibold text-[#291D16] sm:text-xl">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            <div
              className="hidden items-center gap-2 text-xs font-medium sm:flex"
              title={
                isDemoMode
                  ? 'Fluxo em tempo real pronto (SSE /api/pedidos/stream em produção)'
                  : 'Conectado ao stream SSE de pedidos'
              }
            >
              <Radio
                className={`h-3.5 w-3.5 ${
                  isLiveConnected ? 'text-emerald-700' : 'text-amber-700'
                }`}
              />
              <span
                className={`whitespace-nowrap ${
                  isLiveConnected ? 'text-emerald-800' : 'text-amber-800'
                }`}
              >
                {isLiveConnected ? 'Ao vivo - Cozinha' : 'Reconectando - Cozinha'}
              </span>
            </div>

            {topBarAction}
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
