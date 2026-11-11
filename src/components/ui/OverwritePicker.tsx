import type { ConfigItem } from '../../lib/configStore';

interface OverwritePickerProps {
  /** The saves that can be replaced. Renders nothing when there are none. */
  items: ConfigItem[];
  /** The id of the save to replace, or null to store a new one. */
  value: string | null;
  onChange: (item: ConfigItem | null) => void;
}

/**
 * The "replace an existing save" option of the two save dialogs.
 *
 * "New save" is the default, so nothing is overwritten by accident. Picking a
 * save hands it to the dialog, which fills the name field with the old name.
 */
export function OverwritePicker({ items, value, onChange }: OverwritePickerProps) {
  if (items.length === 0) return null;

  const row = (selected: boolean) =>
    `w-full text-left px-3 py-2 border text-2xs font-label uppercase tracking-label transition-colors ${
      selected
        ? 'bg-accent/10 border-accent text-accent'
        : 'bg-surface border-line text-muted hover:border-accent/40 hover:text-ink'
    }`;

  return (
    <div role="radiogroup" aria-label="Overwrite an existing save">
      <label className="text-2xs uppercase tracking-label text-muted mb-2 block font-semibold">
        Overwrite Existing Save (optional)
      </label>
      <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          onClick={() => onChange(null)}
          className={row(value === null)}
        >
          New save
        </button>
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={value === item.id}
            onClick={() => onChange(item)}
            className={row(value === item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>
    </div>
  );
}
