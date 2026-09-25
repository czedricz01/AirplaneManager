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

const rgbOf = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

/** Straight-line distance between two #RRGGBB colours in RGB space, 0-441. */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = rgbOf(a);
  const [r2, g2, b2] = rgbOf(b);
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

/**
 * Recolours only the rivals whose colour now sits too close to the player's,
 * for when the player changes colour in the middle of a game. Everyone else
 * keeps the colour the player has come to know them by.
 */
export function recolorClashingRivals(
  rivals: { code?: string; color?: string }[],
  playerColor: string
): string[] {
  const kept = rivals.map(rival =>
    isHexColor(rival.color) && isHexColor(playerColor) && colorDistance(rival.color, playerColor) < MIN_PLAYER_COLOR_DISTANCE
      ? { code: rival.code }
      : rival
  );
  return assignRivalColors(kept, playerColor);
}

/** Brand colours offered when founding an airline; any other can be picked too. */
export const BRAND_PRESETS: readonly { color: string; name: string }[] = [
  { color: MAP_YELLOW, name: 'Signal yellow' },
  { color: '#F97316', name: 'Orange' },
  { color: '#EF4444', name: 'Red' },
  { color: '#EC4899', name: 'Pink' },
  { color: '#A855F7', name: 'Purple' },
  { color: '#2563EB', name: 'Blue' },
  { color: '#06B6D4', name: 'Cyan' },
  { color: '#22C55E', name: 'Green' },
];

/** WCAG relative luminance of a #RRGGBB colour, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = rgbOf(hex).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Black or white, whichever contrasts more with the given background, for
 * text and icons drawn on a brand colour the player picked.
 */
export function readableTextColor(background: string): '#000000' | '#FFFFFF' {
  if (!isHexColor(background)) return '#000000';
  const l = relativeLuminance(background);
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? '#000000' : '#FFFFFF';
}

/** The profit heatmap's three anchors: loss, break-even and profit. */
export const HEATMAP_COLORS = {
  loss: '#ef4444',
  neutral: '#9ca3af',
  profit: '#10b981',
} as const;

function mixHex(a: string, b: string, t: number): string {
  const ca = rgbOf(a);
  const cb = rgbOf(b);
  return '#' + ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** The share of routes whose profit or loss stays inside the heatmap's scale. */
export const HEATMAP_SCALE_PERCENTILE = 0.8;

/**
 * The profit or loss that reaches the heatmap's full colour: the 80th
 * percentile of the absolute results on the map, at least 1. The percentile
 * is taken at rank floor((n - 1) x 0.8), the nearest value at or below it.
 *
 * The largest result used to set it, so a single trunk route earning ten
 * times the rest washed every other line out to grey. With a percentile the
 * typical route reads clearly red or green, and the few beyond the scale
 * simply stay at the end colour.
 *
 * Rounding the rank down matters on a small network: with five routes or
 * fewer it never lands on the largest result, which the nearest-rank rule,
 * ceil(n x 0.8), always did there, leaving an early airline with one big
 * earner as grey as before.
 */
export function heatmapScale(profits: Iterable<number>): number {
  const abs: number[] = [];
  for (const p of profits) if (Number.isFinite(p)) abs.push(Math.abs(p));
  if (abs.length === 0) return 1;
  abs.sort((a, b) => a - b);
  const rank = Math.floor(HEATMAP_SCALE_PERCENTILE * (abs.length - 1));
  return Math.max(1, abs[rank]);
}

/**
 * A route's colour on the profit heatmap: red for a loss, grey around break
 * even, green for a profit. `maxAbs` is the profit or loss that reaches the
 * full colour (see heatmapScale); anything beyond it stays there. The curve is
 * a tanh, steep around zero, so that small results still read as clearly
 * losing or clearly earning instead of fading to grey.
 */
export function profitColor(profit: number, maxAbs: number): string {
  if (!(maxAbs > 0) || !Number.isFinite(profit)) return HEATMAP_COLORS.neutral;
  const t = Math.max(-1, Math.min(1, Math.tanh((2 * profit) / maxAbs) / Math.tanh(2)));
  return t < 0
    ? mixHex(HEATMAP_COLORS.neutral, HEATMAP_COLORS.loss, -t)
    : mixHex(HEATMAP_COLORS.neutral, HEATMAP_COLORS.profit, t);
}

/**
 * Line width for a route on the heatmap, 1 to 5 px by passengers. Square-root
 * scaled, so the busiest trunk route does not reduce every other line to a
 * hairline.
 */
export function paxWeight(pax: number, maxPax: number): number {
  if (!(maxPax > 0) || !(pax > 0)) return 1;
  return Math.max(1, Math.min(5, 1 + 4 * Math.sqrt(pax / maxPax)));
}

/**
 * The history charts on the dark panels (aero-panel, #141414). Two series at
 * most, always in this order, so revenue and costs, or all passengers and
 * connecting ones, keep their colours from chart to chart.
 *
 * Both series colours pass the dataviz palette checks against that surface:
 * lightness band, chroma floor, colour-blind separation (worst pair 27 dE)
 * and 3:1 contrast. The first is the amber step of the app's signal yellow;
 * #FACC15 itself is too light to sit in the band beside a second series.
 * Grid, axis and muted text are one step off the surface, so the data is the
 * only loud thing on the chart.
 */
export const CHART_COLORS = {
  series: ['#c98500', '#3987e5'],
  surface: '#141414',
  grid: '#2c2c2a',
  axis: '#383835',
  muted: '#898781',
  crosshair: 'rgba(255, 255, 255, 0.35)',
} as const;
