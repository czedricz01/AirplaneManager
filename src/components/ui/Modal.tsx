import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
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
  /** Optional header bar. Omit `title` when a call site renders its own heading inside `children`
   *  (e.g. a crisis modal whose title needs custom layout) — only the outer shell is mandatory. */
  title?: ReactNode;
  icon?: ReactNode;
  accent?: ModalAccent;
  /** 'default' = z-[100] for standard modals. 'critical' = z-[110] for blocking/crisis modals. */
  layer?: 'default' | 'critical';
  children: ReactNode;
  footer?: ReactNode;
}

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
  const borderClass = accent === 'warn' ? 'border-aero-warn/40' : 'border-white/10';
  const titleClass = accent === 'warn' ? 'text-aero-warn' : 'text-aero-yellow';
  const zClass = layer === 'critical' ? 'z-[110]' : 'z-[100]';
  const bgOpacity = layer === 'critical' ? 'bg-black/85' : 'bg-black/80';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`absolute inset-0 ${zClass} flex items-center justify-center ${bgOpacity} backdrop-blur-sm p-4`}
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.97 }}
            className={`bg-aero-carbon border ${borderClass} shadow-2xl w-full ${SIZE_CLASSES[size]} rounded-sm overflow-hidden max-h-[90vh] flex flex-col`}
          >
            {(title || onClose) && (
              <div className="px-4 py-3 bg-black/40 border-b border-white/5 flex items-center justify-between shrink-0">
                {title ? (
                  <h3 className={`font-black uppercase tracking-widest text-lg flex items-center gap-2 ${titleClass}`}>
                    {icon}
                    {title}
                  </h3>
                ) : (
                  <span />
                )}
                {onClose && (
                  <button type="button" onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                    <X size={22} />
                  </button>
                )}
              </div>
            )}
            <div className="p-4 overflow-y-auto custom-scrollbar">{children}</div>
            {footer && <div className="px-4 py-3 border-t border-white/5 flex justify-end gap-2 shrink-0">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
