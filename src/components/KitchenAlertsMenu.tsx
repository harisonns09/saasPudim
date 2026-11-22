import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Bot,
  Store,
  CheckCheck,
  Send,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { OrderOrigin } from '../types';
import { formatCurrency } from '../utils/format';

export function KitchenAlertsMenu() {
  const {
    browserNotificationsEnabled,
    soundAlertsEnabled,
    notificationPermission,
    toggleBrowserNotifications,
    toggleSoundAlerts,
    testKitchenAlert,
    kitchenAlerts,
    unreadAlertsCount,
    markAlertsAsRead,
    navigate,
  } = useApp();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const isActive =
    (browserNotificationsEnabled && notificationPermission === 'granted') ||
    soundAlertsEnabled;

  const permissionLabel =
    notificationPermission === 'granted'
      ? browserNotificationsEnabled
        ? 'Permitidas no navegador'
        : 'Pausadas pelo usuário'
      : notificationPermission === 'denied'
        ? 'Bloqueadas nas configurações do navegador'
        : notificationPermission === 'unsupported'
          ? 'Navegador sem suporte a Notification API'
          : 'Clique no seletor para autorizar';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Alertas da cozinha"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`relative flex h-9 items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
          open
            ? 'border-[#B45309] bg-[#FAF3E8] text-[#9A3412]'
            : 'border-[#E6DCD0] bg-[#FAF7F2] text-[#4C3B31] hover:border-[#D4BFA6] hover:text-[#291D16]'
        }`}
      >
        {isActive ? (
          <Bell className="h-4 w-4 text-[#B45309]" />
        ) : (
          <BellOff className="h-4 w-4 text-[#8C7768]" />
        )}
        <span className="hidden md:inline">Alertas</span>
        {unreadAlertsCount > 0 && (
          <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-md bg-[#B45309] px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none text-white tabular-nums">
            {unreadAlertsCount > 9 ? '9+' : unreadAlertsCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Configurações e histórico de alertas da cozinha"
          className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-[#E6DACB] bg-white shadow-2xl shadow-[#291D16]/12 sm:w-96"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#F0E8DD] px-4 py-3.5">
            <div>
              <h2 className="font-display text-base font-semibold text-[#291D16]">
                Alertas da Cozinha
              </h2>
              <p className="text-[11px] text-[#7A6658]">
                Avisos instantâneos de Cardápio Público e WhatsApp IA
              </p>
            </div>
            <button
              type="button"
              onClick={testKitchenAlert}
              className="inline-flex items-center gap-1 rounded-lg border border-[#E2D7C8] bg-[#FAF7F2] px-2.5 py-1.5 text-[11px] font-semibold text-[#291D16] transition-colors hover:border-[#B45309] hover:text-[#B45309] whitespace-nowrap"
            >
              <Send className="h-3 w-3 text-[#B45309]" />
              <span>Testar</span>
            </button>
          </div>

          {/* Controls */}
          <div className="space-y-3 border-b border-[#F0E8DD] bg-[#FCF9F4] px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#291D16]">
                  Notificações do navegador
                </p>
                <p className="mt-0.5 text-[11px] text-[#7A6658]">
                  {permissionLabel}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={
                  browserNotificationsEnabled &&
                  notificationPermission === 'granted'
                }
                aria-label="Ativar notificações do navegador"
                onClick={toggleBrowserNotifications}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  browserNotificationsEnabled &&
                  notificationPermission === 'granted'
                    ? 'bg-[#B45309]'
                    : 'bg-[#D6C9B8]'
                }`}
              >
                <span
                  className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-xs transition-transform ${
                    browserNotificationsEnabled &&
                    notificationPermission === 'granted'
                      ? 'translate-x-5.5'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {notificationPermission === 'denied' && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-950">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                <span>
                  O navegador bloqueou notificações para este endereço. Libere no
                  ícone de cadeado da barra de endereço ou mantenha o som ativo.
                </span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 min-w-0">
                {soundAlertsEnabled ? (
                  <Volume2 className="h-4 w-4 shrink-0 text-[#B45309]" />
                ) : (
                  <VolumeX className="h-4 w-4 shrink-0 text-[#8C7768]" />
                )}
                <div>
                  <p className="text-xs font-semibold text-[#291D16]">
                    Campainha sonora da cozinha
                  </p>
                  <p className="text-[11px] text-[#7A6658]">
                    Toca alerta suave ao chegar pedido
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={soundAlertsEnabled}
                aria-label="Ativar campainha sonora da cozinha"
                onClick={toggleSoundAlerts}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  soundAlertsEnabled ? 'bg-[#B45309]' : 'bg-[#D6C9B8]'
                }`}
              >
                <span
                  className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-xs transition-transform ${
                    soundAlertsEnabled ? 'translate-x-5.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Recent Alerts Feed */}
          <div className="max-h-72 overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[11px] font-semibold text-[#7A6658]">
                Pedidos recentes recebidos
              </span>
              {unreadAlertsCount > 0 && (
                <button
                  type="button"
                  onClick={markAlertsAsRead}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B45309] hover:text-[#92400E]"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Marcar lidos
                </button>
              )}
            </div>

            {kitchenAlerts.length === 0 ? (
              <div className="px-4 pb-6 pt-3 text-center">
                <p className="text-xs font-medium text-[#6B574A]">
                  Nenhum alerta novo nesta sessão
                </p>
                <p className="mt-1 text-[11px] text-[#8C7768]">
                  Simule um pedido via WhatsApp IA ou envie uma encomenda pelo
                  Cardápio Público para testar.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#F2EAE0]">
                {kitchenAlerts.map((alert) => (
                  <li key={alert.id}>
                    <button
                      type="button"
                      onClick={() => {
                        markAlertsAsRead();
                        setOpen(false);
                        navigate('/admin/pedidos');
                      }}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#FAF7F2] ${
                        alert.read ? 'bg-white' : 'bg-[#FDF9F2]'
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          alert.origem === OrderOrigin.WHATSAPP_IA
                            ? 'bg-violet-50 text-emerald-700'
                            : 'bg-amber-50 text-[#B45309]'
                        }`}
                      >
                        {alert.origem === OrderOrigin.WHATSAPP_IA ? (
                          <Bot className="h-4 w-4" />
                        ) : (
                          <Store className="h-4 w-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-semibold text-[#291D16]">
                            <span className="font-mono text-[#B45309] tabular-nums">
                              {alert.codigo}
                            </span>{' '}
                            · {alert.clienteNome}
                          </p>
                          <span className="shrink-0 font-mono text-[11px] font-semibold text-[#291D16] tabular-nums">
                            {formatCurrency(alert.valorTotal)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-[#6B574A]">
                          {alert.resumoItens}
                        </p>
                        <p className="mt-0.5 text-[10px] text-[#8C7768] tabular-nums">
                          {alert.origem === OrderOrigin.WHATSAPP_IA
                            ? 'WhatsApp IA'
                            : 'Cardápio Público'}{' '}
                          · {alert.horaRecebimento}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
