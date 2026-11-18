import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Toast { id: number; type: ToastType; title: string; message?: string; leaving?: boolean }
interface ToastContextValue { showToast: (type: ToastType, title: string, message?: string) => void }

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const ICON: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={17} className="text-success" />,
  error: <XCircle size={17} className="text-critical" />,
  warning: <AlertTriangle size={17} className="text-warning" />,
  info: <Info size={17} className="text-info" />,
};
const BAR: Record<ToastType, string> = { success: 'bg-success', error: 'bg-critical', warning: 'bg-warning', info: 'bg-info' };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(p => p.map(t => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 160);
  }, []);

  const showToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = ++counter.current;
    setToasts(p => [...p.slice(-3), { id, type, title, message }]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 items-stretch sm:items-end pointer-events-none" aria-live="polite">
        {toasts.map(t => <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />)}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  // keep the timer stable across parent re-renders (new toasts must not reset older ones)
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    const t = setTimeout(() => dismissRef.current(), 4500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`pointer-events-auto relative overflow-hidden flex items-start gap-3 pl-4 pr-3 py-3 rounded-lg bg-white border border-line shadow-panel sm:w-96
      transition-all duration-150 ${toast.leaving ? 'opacity-0 translate-x-3' : 'animate-slide-in-right'}`}>
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${BAR[toast.type]}`} />
      <span className="mt-0.5 shrink-0">{ICON[toast.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-graphite leading-snug">{toast.title}</p>
        {toast.message && <p className="text-xs text-slate mt-0.5">{toast.message}</p>}
      </div>
      <button onClick={onDismiss} className="shrink-0 text-slate hover:text-graphite p-0.5" aria-label="Dismiss"><X size={14} /></button>
    </div>
  );
}
