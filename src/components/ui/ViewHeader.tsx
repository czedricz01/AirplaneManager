import type { ReactNode } from 'react';

interface ViewHeaderProps {
  /** Small uppercase line above the title, e.g. "Global Aviation Intelligence". */
  eyebrow?: string;
  title: ReactNode;
  icon?: ReactNode;
  /** Right-aligned controls: search box, filters, action buttons. */
  right?: ReactNode;
}

export function ViewHeader({ eyebrow, title, icon, right }: ViewHeaderProps) {
  return (
    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-3 shrink-0 border-b border-white/10 pb-4">
      <div>
        {eyebrow && (
          <div className="text-aero-yellow font-mono text-3xs tracking-[0.3em] uppercase mb-1">{eyebrow}</div>
        )}
        <h2 className="text-2xl lg:text-3xl font-mono text-aero-yellow uppercase tracking-[0.3em] font-black drop-shadow-lg flex items-center gap-2">
          {icon}
          {title}
        </h2>
      </div>
      {right && <div className="w-full lg:w-auto shrink-0">{right}</div>}
    </div>
  );
}
