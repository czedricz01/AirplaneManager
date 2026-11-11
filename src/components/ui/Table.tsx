import { forwardRef, type ReactNode, type ThHTMLAttributes, type TdHTMLAttributes } from 'react';

/**
 * The data table: small upper-case column heads, 44 px rows separated by a
 * fine line, figures in the figure typeface (give those cells `font-mono`).
 *
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
      <div ref={ref} className={`flex-1 overflow-auto ${className}`}>
        {children}
      </div>
    );
  }
);

export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <table className={`w-full text-left text-sm border-collapse ${className}`}>{children}</table>;
}

export function Thead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-rule font-label font-semibold text-muted uppercase tracking-label text-2xs whitespace-nowrap">
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
      className={`h-9 px-2 sticky top-0 bg-ground z-10 ${first ? 'pl-3' : ''} ${sortable ? 'cursor-pointer hover:text-ink' : 'cursor-default'} ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({ className = '', children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`h-11 px-2 ${className}`} {...rest}>
      {children}
    </td>
  );
}
