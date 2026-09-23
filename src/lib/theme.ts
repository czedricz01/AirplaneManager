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
  warn: 'text-aero-yellow/60 font-black animate-pulse',
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
