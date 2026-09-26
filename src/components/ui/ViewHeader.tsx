import type { ReactNode } from 'react';

interface ViewHeaderProps {
  /** Small uppercase line above the title, e.g. "Global Aviation Intelligence". */
  eyebrow?: string;
  title: ReactNode;
  icon?: ReactNode;
  /** Right-aligned controls: search box, filters, action buttons. */
  right?: ReactNode;
}

/**
 * On phones the header gives most of its height back to the view: smaller
 * upright, and on a phone held sideways the title and the controls share one
 * row (as they do on the desktop) with the eyebrow line left out.
 */
export function ViewHeader({ eyebrow, title, icon, right }: ViewHeaderProps) {
  return (
    <div className="flex flex-col lg:flex-row short:flex-row items-start lg:items-center short:items-center justify-between gap-4 bar:gap-2 short:gap-3 mb-3 bar:mb-2 short:mb-1.5 shrink-0 border-b border-white/10 pb-4 bar:pb-2 short:pb-1.5">
      <div className="short:shrink-0">
        {eyebrow && (
          <div className="text-aero-yellow font-mono text-3xs tracking-[0.3em] uppercase mb-1 short:hidden">{eyebrow}</div>
        )}
        <h2 className="text-2xl lg:text-3xl bar:text-xl short:text-base font-mono text-aero-yellow uppercase tracking-[0.3em] short:tracking-[0.2em] font-black drop-shadow-lg flex items-center gap-2 short:[&_svg]:size-5">
          {icon}
          {title}
        </h2>
      </div>
      {right && <div className="w-full lg:w-auto short:w-auto short:min-w-0 short:flex short:justify-end shrink-0 short:shrink">{right}</div>}
    </div>
  );
}
