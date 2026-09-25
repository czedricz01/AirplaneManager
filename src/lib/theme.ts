import type { BadgeTone } from '../components/ui/Badge';

export type AiPersonality = 'flag' | 'lcc' | 'expansionist' | 'optimizer' | 'boutique';

export const PERSONALITY_META: Record<AiPersonality, { label: string; description: string; tone: BadgeTone }> = {
  flag: { label: 'Legacy Flag', description: 'Legacy Flag Operator', tone: 'yellow' },
  lcc: { label: 'Budget/LCC', description: 'Low Cost Carrier (LCC)', tone: 'good' },
  expansionist: { label: 'Expansionist', description: 'Aggressive Expansion', tone: 'neutral' },
  optimizer: { label: 'Optimizer', description: 'Efficiency Optimizer', tone: 'yellow' },
  boutique: { label: 'Boutique/Elite', description: 'Boutique/Elite Status', tone: 'warn' },
};

export function personalityMeta(personality: AiPersonality | undefined) {
  return personality ? PERSONALITY_META[personality] : undefined;
}

/** Aircraft condition thresholds shared by MyFleetView and AircraftDetailsModal. */
export function conditionTone(value: number): 'warn' | 'yellow' | 'neutral' {
  if (value < 40) return 'warn';
  if (value < 50) return 'yellow';
  return 'neutral';
}

export const CONDITION_TEXT_CLASS: Record<ReturnType<typeof conditionTone>, string> = {
  warn: 'text-aero-warn font-black animate-pulse',
  yellow: 'text-yellow-400 font-bold',
  neutral: 'text-white font-bold',
};

export const CONDITION_BAR_CLASS: Record<ReturnType<typeof conditionTone>, string> = {
  warn: 'bg-aero-warn animate-pulse',
  yellow: 'bg-yellow-400',
  neutral: 'bg-aero-yellow/20',
};

/** Single source for the map yellow — Leaflet/canvas paints are JS strings, not Tailwind classes. */
export const MAP_YELLOW = '#FACC15';

/** Airport/route congestion severity palette used only on the Leaflet map (WorldMap.tsx). */
export const MAP_CONGESTION_COLORS = {
  low: '#FB923C',
  medium: '#EA580C',
  high: '#DC2626',
  good: '#10b981',
  bad: '#ef4444',
} as const;

/**
 * Colours for the rival airlines, one each. Picked to read on the dark map and
 * to stay clear of the default player yellow and the congestion reds above.
 */
export const RIVAL_PALETTE = [
  '#38BDF8', // sky
  '#818CF8', // indigo
  '#C084FC', // purple
  '#F472B6', // pink
  '#34D399', // emerald
  '#A3E635', // lime
  '#F5F5F4', // white
  '#94A3B8', // slate
  '#22D3EE', // cyan
  '#FB7185', // rose
  '#E879F9', // fuchsia
  '#2563EB', // royal blue
] as const;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Whether a value is a #RRGGBB colour, the only form the map code handles. */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

/** Straight-line distance between two #RRGGBB colours in RGB space, 0-441. */
export function colorDistance(a: string, b: string): number {
  const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

/** Palette colours closer than this to the player's are not given to a rival. */
const MIN_PLAYER_COLOR_DISTANCE = 100;

/**
 * A colour for every rival, in order. A rival that already has one keeps it;
 * the others start at a palette entry picked by hashing their code, so the
 * same airline gets the same colour in every game, and move on past colours
 * already taken or too close to the player's. Only once the palette runs out
 * are colours shared.
 */
export function assignRivalColors(
  rivals: { code?: string; color?: string }[],
  playerColor: string = MAP_YELLOW
): string[] {
  const usable = RIVAL_PALETTE.filter(c => !isHexColor(playerColor) || colorDistance(c, playerColor) >= MIN_PLAYER_COLOR_DISTANCE);
  const pool: readonly string[] = usable.length > 0 ? usable : RIVAL_PALETTE;
  const taken = new Set(rivals.map(r => r.color).filter(isHexColor).map(c => c.toUpperCase()));

  return rivals.map(rival => {
    if (isHexColor(rival.color)) return rival.color;
    let hash = 0;
    for (const ch of String(rival.code || '')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const start = hash % pool.length;
    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[(start + i) % pool.length];
      if (!taken.has(candidate)) {
        taken.add(candidate);
        return candidate;
      }
    }
    return pool[start];
  });
}
