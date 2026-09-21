import { AlertTriangle, Check, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Tone = 'info' | 'success' | 'error';

type Toast = {
  id: number;
  title: string;
  description?: string;
  tone: Tone;
};

type ToastContextValue = {
  push: (toast: { title: string; description?: string; tone?: Tone }) => void;
};

const ToastContext = createContext<ToastContextValue>({ push: () => undefined });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

const TONE_STYLES: Record<Tone, { icon: ReactNode; ring: string }> = {
  info: { icon: <Info className="h-4 w-4 text-ink-muted" />, ring: 'border-line' },
  success: { icon: <Check className="h-4 w-4 text-ok" />, ring: 'border-ok/30' },
  error: { icon: <AlertTriangle className="h-4 w-4 text-danger" />, ring: 'border-danger/40' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((toast: { title: string; description?: string; tone?: Tone }) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-3), { id, tone: toast.tone ?? 'info', title: toast.title, description: toast.description }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((entry) => entry.id !== id));
    }, toast.tone === 'error' ? 6_000 : 3_200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[340px]">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex animate-toast-in items-start gap-3 rounded-xl border bg-surface-raised/95 p-3.5 shadow-raised backdrop-blur ${TONE_STYLES[toast.tone].ring}`}
          >
            <div className="mt-0.5">{TONE_STYLES[toast.tone].icon}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ink">{toast.title}</p>
              {toast.description ? <p className="mt-0.5 text-[12px] leading-snug text-ink-muted">{toast.description}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => setToasts((current) => current.filter((entry) => entry.id !== toast.id))}
              className="rounded-md p-1 text-ink-dim transition hover:bg-white/5 hover:text-ink"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
