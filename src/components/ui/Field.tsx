import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

/** The look every text field and select shares: an outline, 36 px high, 44 px on phones. */
export const FIELD_CLASS =
  'w-full min-h-9 bar:min-h-11 short:min-h-11 px-3 bg-surface border border-rule rounded-sm text-sm text-ink placeholder:text-muted ' +
  'hover:border-ink focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40 disabled:cursor-not-allowed';

interface LabelProps {
  /** The field's name, shown above it. */
  label?: string;
  /** One line of help below the field. */
  hint?: ReactNode;
  /** What is wrong with the value; replaces the hint and marks the field. */
  error?: ReactNode;
  className?: string;
}

function Wrap({ label, hint, error, className = '', children }: LabelProps & { children: ReactNode }) {
  if (!label && !hint && !error) return <>{children}</>;
  return (
    <label className={`block ${className}`}>
      {label && <span className="block mb-1 font-label font-semibold text-2xs uppercase tracking-label text-muted">{label}</span>}
      {children}
      {error ? <span className="block mt-1 text-xs text-bad">{error}</span> : hint ? <span className="block mt-1 text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & LabelProps & { /** An icon inside the field, on the left. */ icon?: ReactNode };

/** A text field, with an optional label above and hint or error below. */
export function TextInput({ label, hint, error, icon, className = '', ...rest }: TextInputProps) {
  const input = (
    <span className="relative block">
      {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">{icon}</span>}
      <input className={`${FIELD_CLASS} ${icon ? 'pl-9' : ''} ${error ? 'border-bad' : ''}`} aria-invalid={error ? true : undefined} {...rest} />
    </span>
  );
  return <Wrap label={label} hint={hint} error={error} className={className}>{input}</Wrap>;
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & LabelProps;

/** A select, styled like TextInput. */
export function Select({ label, hint, error, className = '', children, ...rest }: SelectProps) {
  return (
    <Wrap label={label} hint={hint} error={error} className={className}>
      <select className={`${FIELD_CLASS} ${error ? 'border-bad' : ''}`} aria-invalid={error ? true : undefined} {...rest}>{children}</select>
    </Wrap>
  );
}
