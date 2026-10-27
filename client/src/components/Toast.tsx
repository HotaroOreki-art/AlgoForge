import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import './Toast.css';

type Kind = 'ok' | 'danger' | 'info' | 'celebrate';
interface Toast {
  id: number;
  kind: Kind;
  text: string;
}

const ToastContext = createContext<{ push: (text: string, kind?: Kind) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const push = useCallback((text: string, kind: Kind = 'info') => {
    const id = idRef.current++;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'danger' ? 6000 : 3600);
  }, []);

  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`}>
            {t.kind === 'celebrate' && <span className="toast__spark" aria-hidden="true" />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
