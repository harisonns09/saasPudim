import { CheckCircle2, AlertTriangle, Info, X, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function ToastContainer() {
  const { toasts, dismissToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-full max-w-sm flex-col gap-2.5 px-4 sm:px-0"
    >
      {toasts.map((toast) => {
        const iconMap = {
          success: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />,
          warning: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />,
          error: <AlertCircle className="h-4 w-4 shrink-0 text-red-700" />,
          neutral: <Info className="h-4 w-4 shrink-0 text-[#B45309]" />,
        };
        const tone = toast.tone || 'neutral';

        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-[#E6DACB] bg-white p-3.5 shadow-lg shadow-[#291D16]/8 transition-all"
          >
            <div className="mt-0.5">{iconMap[tone]}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#291D16]">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-xs leading-relaxed text-[#6B574A]">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Fechar notificação"
              className="rounded-md p-1 text-[#8A7566] transition-colors hover:bg-[#FAF7F2] hover:text-[#291D16]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
