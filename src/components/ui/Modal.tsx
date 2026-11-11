import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

type ModalAccent = 'yellow' | 'warn';

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  size?: ModalSize;
  /** Optional header bar. Omit `title` when a call site renders its own heading inside `children`. */
  title?: ReactNode;
  icon?: ReactNode;
  /** 'warn' marks a dialog about something going wrong: a red title and outline. */
  accent?: ModalAccent;
  /**
   * 'default' = z-[100] for standard dialogs. 'critical' = z-[110] for blocking ones.
   * 'top' = z-[5000], above the full-screen views (airport console, route planner and
   * cabin editor sit at z-[2000]); for app-level alerts and decisions, which were
   * otherwise hidden behind whichever of those views had raised them.
   */
  layer?: 'default' | 'critical' | 'top';
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * A dialog over a dimmed page. Escape closes it when it can be closed, and it
 * fades in with the system's one animation (see --animate-appear).
 */
export function Modal({
  open,
  onClose,
  size = 'md',
  title,
  icon,
  accent = 'yellow',
  layer = 'default',
  children,
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const borderClass = accent === 'warn' ? 'border-bad' : 'border-rule';
  const titleClass = accent === 'warn' ? 'text-bad' : 'text-ink';
  const zClass = layer === 'top' ? 'z-[5000]' : layer === 'critical' ? 'z-[110]' : 'z-[100]';

  return (
    <div className={`absolute inset-0 ${zClass} flex items-center justify-center bg-ground/80 p-4 short:p-2 animate-appear`}>
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-surface border ${borderClass} shadow-pop w-full ${SIZE_CLASSES[size]} rounded-sm overflow-hidden max-h-[90dvh] flex flex-col`}
      >
        {(title || onClose) && (
          <div className="pl-4 pr-2 py-2 border-b border-line flex items-center justify-between gap-3 shrink-0">
            {title ? (
              <h3 className={`font-label font-semibold text-lg short:text-base flex items-center gap-2 ${titleClass}`}>
                {icon}
                {title}
              </h3>
            ) : (
              <span />
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="size-9 bar:size-11 short:size-11 inline-flex items-center justify-center text-muted hover:text-ink hover:bg-raised rounded-sm transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}
        <div className="p-4 short:p-3 overflow-y-auto">{children}</div>
        {footer && <div className="px-4 py-3 short:py-2 border-t border-line flex justify-end gap-2 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
