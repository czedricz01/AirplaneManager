import { Plane, Globe, Star, Bird, Crown, type LucideIcon } from 'lucide-react';
import type { Branding } from '../lib/gameState';
import { isHexColor, readableTextColor, MAP_YELLOW } from '../lib/theme';

/** The icons an airline can wear instead of its initials, by the name Branding stores. */
export const BRAND_ICONS: Record<string, LucideIcon> = {
  plane: Plane,
  globe: Globe,
  star: Star,
  bird: Bird,
  crown: Crown,
};

/** What goes on the badge when it shows letters: the airline code, else the name's initials. */
export function brandInitials(code: string, name = ''): string {
  const fromCode = code.trim().toUpperCase();
  if (fromCode) return fromCode.slice(0, 3);
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0].toUpperCase())
    .join('');
}

interface BrandBadgeProps {
  branding: Branding;
  code: string;
  /** Used for the initials while no code has been typed yet. */
  name?: string;
  /** Edge length in px. */
  size?: number;
  className?: string;
}

/**
 * The airline's mark: its initials, or the chosen icon, on its brand colour.
 * The foreground is black or white, whichever reads better on that colour.
 */
export function BrandBadge({ branding, code, name, size = 32, className = '' }: BrandBadgeProps) {
  const bg = isHexColor(branding.color) ? branding.color : MAP_YELLOW;
  const fg = readableTextColor(bg);
  const Icon = BRAND_ICONS[branding.icon];
  const initials = brandInitials(code, name);
  // No code and no name yet: the plane stands in for the letters.
  const Glyph = Icon ?? (initials ? null : Plane);

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 rounded-sm border border-black/40 shadow-lg font-mono font-black leading-none tracking-normal normal-case select-none ${className}`}
      style={{ width: size, height: size, backgroundColor: bg, color: fg, fontSize: Math.round(size * (initials.length > 2 ? 0.3 : 0.4)) }}
      aria-label={`${initials || 'Airline'} badge`}
    >
      {Glyph ? <Glyph size={Math.round(size * 0.56)} strokeWidth={2.25} /> : initials}
    </span>
  );
}
