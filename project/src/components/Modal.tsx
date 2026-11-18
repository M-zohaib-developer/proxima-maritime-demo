import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  footer?: React.ReactNode;
}

const SIZE: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl', '2xl': 'max-w-4xl',
};

export default function Modal({ open, onClose, title, subtitle, children, size = 'md', footer }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => {
      const first = panel.current?.querySelector<HTMLElement>('input, textarea, select, button:not([data-close])');
      (first ?? panel.current)?.focus();
    }, 30);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(t); prev?.focus?.(); };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ocean-950/45 animate-fade-in" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        className={`relative w-full ${SIZE[size]} bg-white rounded-t-lg sm:rounded-lg shadow-modal flex flex-col max-h-[92vh] animate-scale-in outline-none`}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-line shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-semibold">{title}</h3>
            {subtitle && <p className="text-xs text-slate mt-0.5">{subtitle}</p>}
          </div>
          <button data-close onClick={onClose} className="btn-icon -mr-2 -mt-1" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">{children}</div>
        {footer && <div className="shrink-0 px-5 py-3.5 border-t border-line bg-cloud/50 rounded-b-lg flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, children, confirmLabel, tone = 'primary', onConfirm, onClose }: {
  open: boolean; title: string; children: React.ReactNode; confirmLabel: string;
  tone?: 'primary' | 'danger' | 'teal'; onConfirm: () => void; onClose: () => void;
}) {
  const cls = tone === 'danger' ? 'btn-danger' : tone === 'teal' ? 'btn-teal' : 'btn-primary';
  return (
    <Modal open={open} onClose={onClose} title={title} size="md"
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className={cls} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
      </>}>
      <div className="text-sm text-graphite space-y-2">{children}</div>
    </Modal>
  );
}
