/**
 * The aircraft classes an airline has to develop before it may buy them.
 *
 * Until now only rank gated aircraft, and only two kinds. The market is now
 * cut into six classes by size, and every class beyond the first is a project
 * in the development tree (see research.ts): research it, and every aircraft
 * of the class can be bought, new, ordered or second-hand.
 *
 *   commuter    regional aircraft up to 60 seats           open from the start
 *   regional    regional aircraft over 60 seats, narrowbodies up to 130
 *   narrowbody  narrowbodies over 130 seats
 *   widebody    wide-bodies up to 500 seats
 *   jumbo       wide-bodies over 500 seats
 *   supersonic  anything faster than sound
 *
 * What the airline already flies is never taken away: a class an aircraft in
 * the fleet belongs to counts as open (see classesOpenFor).
 *
 * Everything here is pure.
 */

export type AircraftClassId = 'commuter' | 'regional' | 'narrowbody' | 'widebody' | 'jumbo' | 'supersonic';

export interface AircraftClassDef {
  id: AircraftClassId;
  title: string;
  detail: string;
  /** The development project that opens the class; null for the class open from the start. */
  projectId: string | null;
}

export const AIRCRAFT_CLASSES: readonly AircraftClassDef[] = [
  { id: 'commuter', title: 'Commuter aircraft', detail: 'Regional aircraft up to 60 seats', projectId: null },
  { id: 'regional', title: 'Regional aircraft', detail: 'Regional aircraft over 60 seats and small jets up to 130 seats', projectId: 'class-regional' },
  { id: 'narrowbody', title: 'Narrowbody aircraft', detail: 'Single-aisle jets over 130 seats', projectId: 'class-narrowbody' },
  { id: 'widebody', title: 'Wide-body aircraft', detail: 'Twin-aisle jets up to 500 seats', projectId: 'class-widebody' },
  { id: 'jumbo', title: 'Jumbo aircraft', detail: 'Twin-aisle jets over 500 seats', projectId: 'class-jumbo' },
  { id: 'supersonic', title: 'Supersonic aircraft', detail: 'Airliners that fly faster than sound', projectId: 'class-supersonic' }
];

export const ALL_CLASS_IDS: readonly AircraftClassId[] = AIRCRAFT_CLASSES.map(c => c.id);

export function classDef(id: AircraftClassId): AircraftClassDef {
  return AIRCRAFT_CLASSES.find(c => c.id === id)!;
}

/** Seats (the data's maximum) above which a wide-body counts as a jumbo: the 747, A380, A340-600, 777-9. */
export const JUMBO_SEATS = 500;

/** The class an aircraft belongs to. */
export function classOfAircraft(a: { class?: string; capacity?: number; cruiseSpeed?: number }): AircraftClassId {
  if ((a.cruiseSpeed ?? 0) > 1000) return 'supersonic';
  const seats = Number(a.capacity) || 0;
  const kind = String(a.class || '').toLowerCase();
  if (kind === 'widebody') return seats > JUMBO_SEATS ? 'jumbo' : 'widebody';
  if (kind === 'narrowbody') return seats <= 130 ? 'regional' : 'narrowbody';
  return seats <= 60 ? 'commuter' : 'regional';
}

/** The classes open to an airline: the free one, those it researched, all of them in Free Mode. */
export function openClasses(doneProjects: readonly string[], free = false): Set<AircraftClassId> {
  if (free) return new Set(ALL_CLASS_IDS);
  const done = new Set(doneProjects);
  return new Set(AIRCRAFT_CLASSES.filter(c => c.projectId === null || done.has(c.projectId)).map(c => c.id));
}

/** The classes of the aircraft already in the fleet, which stay open. */
export function classesOfFleet(fleet: ReadonlyArray<{ class?: string; capacity?: number; cruiseSpeed?: number }>): Set<AircraftClassId> {
  return new Set(fleet.map(classOfAircraft));
}

/** The text of a refusal, or null when the aircraft's class is open. */
export function classGateMessage(
  aircraft: { class?: string; capacity?: number; cruiseSpeed?: number; manufacturer?: string; type?: string },
  open: ReadonlySet<AircraftClassId>
): string | null {
  const id = classOfAircraft(aircraft);
  if (open.has(id)) return null;
  const def = classDef(id);
  const name = [aircraft.manufacturer, aircraft.type].filter(Boolean).join(' ') || 'This aircraft';
  return `The ${name} belongs to the class "${def.title}" (${def.detail.toLowerCase()}). Develop it first under Progression.`;
}
