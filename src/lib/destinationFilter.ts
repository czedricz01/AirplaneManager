/**
 * The filters of the destination list in the route planner's first step.
 *
 * Kept apart from the component so the rules can be tested without React.
 * The bounds are held as the text typed into the inputs: an empty field means
 * "no limit", and the field can be cleared or half-typed without the value
 * snapping back to a number.
 *
 * The filters are also kept in the browser. The planner closes whenever a route
 * is finished, and the next route should start from the filters the player had
 * set instead of from an empty panel.
 */

import { readJson, writeJson } from './safeStorage';

export interface RangeFilter {
  min: string;
  max: string;
}

export interface DestinationFilters {
  /** Only airports that none of the player's routes touches yet. */
  unservedOnly: boolean;
  /** Distance from the chosen origin, in km. */
  distance: RangeFilter;
  business: RangeFilter;
  tourism: RangeFilter;
}

export const NO_DESTINATION_FILTERS: DestinationFilters = {
  unservedOnly: false,
  distance: { min: '', max: '' },
  business: { min: '', max: '' },
  tourism: { min: '', max: '' }
};

/** Where the filters are kept in the browser, like the other planner preferences. */
export const DESTINATION_FILTERS_KEY = 'planner_destination_filters';

/** A stored bound is the text that was typed; anything else is an empty field. */
function storedBound(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function storedRange(value: unknown): RangeFilter {
  const range = (value ?? {}) as Record<string, unknown>;
  return { min: storedBound(range.min), max: storedBound(range.max) };
}

/**
 * Brings whatever was stored back into the shape of DestinationFilters.
 *
 * The browser's storage can hold anything: an older version, another tab or the
 * player may have left something else under the key. A field that is missing or
 * has the wrong type counts as "no filter", so one bad field does not discard
 * the others and the planner never starts from a broken value.
 */
export function sanitizeDestinationFilters(raw: unknown): DestinationFilters {
  const stored = (raw ?? {}) as Record<string, unknown>;
  return {
    unservedOnly: stored.unservedOnly === true,
    distance: storedRange(stored.distance),
    business: storedRange(stored.business),
    tourism: storedRange(stored.tourism)
  };
}

/** The filters the player left behind; none if nothing is stored or it is unreadable. */
export function loadDestinationFilters(): DestinationFilters {
  return sanitizeDestinationFilters(readJson<unknown>(DESTINATION_FILTERS_KEY, null));
}

/** Remembers the filters for the next time the planner opens. */
export function saveDestinationFilters(filters: DestinationFilters): void {
  writeJson(DESTINATION_FILTERS_KEY, filters);
}

/** What the filters look at for one candidate airport. */
export interface DestinationCandidate {
  /** Null while no origin is chosen, so there is nothing to measure from. */
  distanceKm: number | null;
  business: number;
  tourism: number;
  /** True when one of the player's routes starts or ends here. */
  served: boolean;
}

/** A typed bound as a number; null for an empty or invalid field. */
function parseBound(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function isRangeSet(range: RangeFilter): boolean {
  return parseBound(range.min) !== null || parseBound(range.max) !== null;
}

function inRange(value: number, range: RangeFilter): boolean {
  const min = parseBound(range.min);
  const max = parseBound(range.max);
  return (min === null || value >= min) && (max === null || value <= max);
}

/**
 * How many filters currently narrow the list. The distance filter needs an
 * origin to measure from; without one it has no effect and is not counted.
 */
export function activeDestinationFilterCount(filters: DestinationFilters, hasOrigin: boolean): number {
  let count = 0;
  if (filters.unservedOnly) count++;
  if (hasOrigin && isRangeSet(filters.distance)) count++;
  if (isRangeSet(filters.business)) count++;
  if (isRangeSet(filters.tourism)) count++;
  return count;
}

export function passesDestinationFilters(filters: DestinationFilters, airport: DestinationCandidate): boolean {
  if (filters.unservedOnly && airport.served) return false;
  if (airport.distanceKm !== null && !inRange(airport.distanceKm, filters.distance)) return false;
  return inRange(airport.business, filters.business) && inRange(airport.tourism, filters.tourism);
}
