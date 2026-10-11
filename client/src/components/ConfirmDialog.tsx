import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './UI';

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};
type PendingConfirm = ConfirmOptions & { resolve: (confirmed: boolean) => void };
type ConfirmContextValue = { confirm: (options: ConfirmOptions) => Promise<boolean> };
const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);
  const close = useCallback((confirmed: boolean) => {
    const current = pendingRef.current;
    if (!current) return;
    pendingRef.current = null;
    setPending(null);
    current.resolve(confirmed);
  }, []);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>(resolve => {
    const next = { ...options, resolve };
    pendingRef.current = next;
    setPending(next);
  }), []);
  const value = useMemo(() => ({ confirm }), [confirm]);

  useEffect(() => {
    if (!pending) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pending, close]);

  return <ConfirmContext.Provider value={value}>
    {children}
    {pending && <div className="confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(false); }}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <div className="confirm-icon"><AlertTriangle size={22}/></div>
        <div className="confirm-copy">
          <h2 id="confirm-title">{pending.title ?? 'Bạn có chắc không?'}</h2>
          <p id="confirm-message">{pending.message}</p>
        </div>
        <div className="confirm-actions">
          <Button variant="secondary" onClick={() => close(false)} autoFocus>{pending.cancelLabel ?? 'Hủy'}</Button>
          <Button variant="danger" onClick={() => close(true)}>{pending.confirmLabel ?? 'Xóa'}</Button>
        </div>
      </section>
    </div>}
  </ConfirmContext.Provider>;
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm phải nằm trong ConfirmProvider');
  return context.confirm;
}
