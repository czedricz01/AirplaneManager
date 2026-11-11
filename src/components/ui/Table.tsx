import { forwardRef, type ReactNode, type ThHTMLAttributes, type TdHTMLAttributes } from 'react';

/**
 * Pure styling helpers for the sortable data tables (AirportsView, RoutesView).
 * These carry no table/row logic of their own — sorting, row-virtualization and
 * keys stay exactly as each view already implements them; only className strings
 * move here so both tables render identically.
 */

export const TableScrollContainer = forwardRef<HTMLDivElement, { children: ReactNode; className?: string }>(
  function TableScrollContainer({ children, className = '' }, ref) {
    return (
      // overflow-auto, not overflow-y-auto: on a phone the columns are wider than
      // the screen and have to scroll sideways instead of being cut off.
      <div ref={ref} className={`flex-1 overflow-auto pr-2 md:pr-4 bg-ground/20 border border-line rounded-sm p-2 md:p-4 ${className}`}>
        {children}
      </div>
    );
  }
);

export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <table className={`w-full text-left font-mono text-sm border-collapse ${className}`}>{children}</table>;
}

export function Thead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-accent/30 text-accent uppercase tracking-label text-2xs">
        {children}
      </tr>
    </thead>
  );
}

interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** Sortable columns get the hover/cursor treatment; non-sortable header cells stay muted. */
  sortable?: boolean;
  first?: boolean;
  children?: ReactNode;
}

export function Th({ sortable = true, first = false, className = '', children, ...rest }: ThProps) {
  return (
    <th
      className={`py-4 sticky top-0 bg-raised z-10 ${first ? 'pl-4' : ''} ${sortable ? 'cursor-pointer hover:text-accent' : 'text-muted cursor-default'} ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({ className = '', children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`py-4 ${className}`} {...rest}>
      {children}
    </td>
  );
}
