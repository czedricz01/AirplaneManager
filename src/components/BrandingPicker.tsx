import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import type { Branding } from '../lib/gameState';
import { BRAND_PRESETS, isHexColor, readableTextColor } from '../lib/theme';
import { BrandBadge, BRAND_ICONS, brandInitials } from './BrandBadge';

interface BrandingPickerProps {
  value: Branding;
  onChange: (next: Branding) => void;
  /** The airline code and name, for the preview and the initials button. */
  code: string;
  name?: string;
}

const sectionLabel = 'block text-2xs font-semibold uppercase tracking-label text-muted mb-2';

/**
 * Colour and badge for the player's airline: eight preset colours, a free
 * colour picker, and initials or one of a few icons. Used when founding the
 * airline and again from My Company.
 */
export function BrandingPicker({ value, onChange, code, name }: BrandingPickerProps) {
  const current = value.color.toLowerCase();
  const isPreset = BRAND_PRESETS.some(p => p.color.toLowerCase() === current);
  const initials = brandInitials(code, name) || 'AB';

  const iconButton = (id: string, content: ReactNode, title: string) => {
    const active = value.icon === id;
    return (
      <button
        key={id}
        type="button"
        title={title}
        aria-pressed={active}
        onClick={() => onChange({ ...value, icon: id })}
        className={`w-10 h-10 flex items-center justify-center border font-mono text-xs font-semibold transition-colors ${
          active ? 'bg-accent text-on-accent border-accent' : 'bg-raised border-line text-muted hover:border-accent hover:text-ink'
        }`}
      >
        {content}
      </button>
    );
  };

  return (
    <div className="flex flex-col sm:flex-row gap-5 items-start">
      <div className="flex flex-col items-center gap-2 shrink-0">
        <BrandBadge branding={value} code={code} name={name} size={64} />
        <span className="text-2xs font-label uppercase tracking-label text-muted">Preview</span>
      </div>

      <div className="flex-1 min-w-0 space-y-4">
        <div>
          <span className={sectionLabel}>Colour</span>
          <div className="flex flex-wrap items-center gap-2">
            {BRAND_PRESETS.map(preset => {
              const active = preset.color.toLowerCase() === current;
              return (
                <button
                  key={preset.color}
                  type="button"
                  title={preset.name}
                  aria-label={preset.name}
                  aria-pressed={active}
                  onClick={() => onChange({ ...value, color: preset.color })}
                  className={`w-8 h-8 flex items-center justify-center border transition-transform hover:scale-110 ${
                    active ? 'border-ink ring-2 ring-ink' : 'border-ground'
                  }`}
                  style={{ backgroundColor: preset.color, color: readableTextColor(preset.color) }}
                >
                  {active && <Check size={14} strokeWidth={3} />}
                </button>
              );
            })}
            <label
              title="Custom colour"
              className={`relative h-8 flex items-center gap-2 pl-1 pr-2 border cursor-pointer text-2xs font-label uppercase tracking-label transition-colors ${
                !isPreset ? 'border-ink text-ink' : 'border-line text-muted hover:border-accent hover:text-ink'
              }`}
            >
              <input
                type="color"
                value={isHexColor(value.color) ? current : '#facc15'}
                onChange={(e) => {
                  if (isHexColor(e.target.value)) onChange({ ...value, color: e.target.value.toUpperCase() });
                }}
                className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer"
              />
              Custom
            </label>
          </div>
        </div>

        <div>
          <span className={sectionLabel}>Badge</span>
          <div className="flex flex-wrap gap-2">
            {iconButton('initials', initials, 'Initials')}
            {Object.entries(BRAND_ICONS).map(([id, Icon]) =>
              iconButton(id, <Icon size={18} />, id[0].toUpperCase() + id.slice(1))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
