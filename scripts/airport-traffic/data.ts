import { ASIA_PACIFIC } from './data-asia-pacific';
import { EUROPE } from './data-europe';
import { LATIN_AMERICA } from './data-latin-america';
import { MIDDLE_EAST_AFRICA } from './data-middle-east-africa';
import { NORTH_AMERICA } from './data-north-america';
import type { TrafficEntry } from './types';

const parts: Record<string, TrafficEntry>[] = [NORTH_AMERICA, EUROPE, MIDDLE_EAST_AFRICA, ASIA_PACIFIC, LATIN_AMERICA];

/** Alle Flughäfen; ein Code darf nur in einer Teil-Datei stehen. */
export const TRAFFIC: Record<string, TrafficEntry> = {};
for (const part of parts) {
  for (const [id, entry] of Object.entries(part)) {
    if (TRAFFIC[id]) throw new Error(`${id} steht in zwei Quelldateien`);
    TRAFFIC[id] = entry;
  }
}
