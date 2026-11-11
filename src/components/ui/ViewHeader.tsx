import type { ReactNode } from 'react';

interface ViewHeaderProps {
  title: ReactNode;
  icon?: ReactNode;
  /** Right-aligned controls: search box, filters, action buttons. */
  right?: ReactNode;
}

/**
 * The title row of a screen: its name on the left, its controls on the right.
 * On a phone held upright the controls go below the name.
 */
export function ViewHeader({ title, icon, right }: ViewHeaderProps) {
  return (
    <div className="flex flex-col lg:flex-row short:flex-row items-start lg:items-center short:items-center justify-between gap-3 bar:gap-2 mb-3 bar:mb-2 short:mb-1.5 shrink-0">
      <h2 className="font-label font-semibold text-xl short:text-lg text-ink flex items-center gap-2 [&_svg]:size-5 [&_svg]:text-muted short:shrink-0">
        {icon}
        {title}
      </h2>
      {right && <div className="w-full lg:w-auto short:w-auto short:min-w-0 short:flex short:justify-end shrink-0 short:shrink">{right}</div>}
    </div>
  );
}
