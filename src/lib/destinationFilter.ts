/**
 * The filters of the destination list in the route planner's first step.
 *
 * Kept apart from the component so the rules can be tested without React.
 * The bounds are held as the text typed into the inputs: an empty field means
 * "no limit", and the field can be cleared or half-typed without the value
 * snapping back to a number.
 */

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
