/**
 * The aircraft classes an airline has to develop before it may buy them (docs/neubau 6.8).
 *
 * Which class an aircraft belongs to, which classes are open and which project opens a class are the model's
 * rules (`sizeClassOf`, `openSizeClasses`, `CLASS_RESEARCH`). This file adds the names and the refusal text of
 * the screen. The seat and speed limits in the texts come from the model's constants.
 */
import {
  CLASS_RESEARCH,
  COMMUTER_MAX_SEATS,
  JUMBO_MIN_SEATS,
  REGIONAL_JET_MAX_SEATS,
  SIZE_CLASSES,
  SUPERSONIC_MIN_KMH,
  type SizeClass,
} from '../model/constants';
import { openSizeClasses, sizeClassOf, type GameMode } from '../model/progress';

export type AircraftClassId = SizeClass;

export interface AircraftClassDef {
  id: AircraftClassId;
  title: string;
  detail: string;
  /** The development project that opens the class; null for the class open from the start. */
  projectId: string | null;
}

const TITLES: Readonly<Record<SizeClass, string>> = {
  commuter: 'Commuter aircraft',
  regional: 'Regional aircraft',
  narrowbody: 'Narrowbody aircraft',
  widebody: 'Wide-body aircraft',
  jumbo: 'Jumbo aircraft',
  supersonic: 'Supersonic aircraft',
};

const DETAILS: Readonly<Record<SizeClass, string>> = {
  commuter: `Regional aircraft up to ${COMMUTER_MAX_SEATS} seats`,
  regional: `Regional aircraft over ${COMMUTER_MAX_SEATS} seats and small jets up to ${REGIONAL_JET_MAX_SEATS} seats`,
  narrowbody: `Single-aisle jets over ${REGIONAL_JET_MAX_SEATS} seats`,
  widebody: `Twin-aisle jets up to ${JUMBO_MIN_SEATS} seats`,
  jumbo: `Twin-aisle jets over ${JUMBO_MIN_SEATS} seats`,
  supersonic: `Airliners faster than ${SUPERSONIC_MIN_KMH} km/h`,
};

export const AIRCRAFT_CLASSES: readonly AircraftClassDef[] = SIZE_CLASSES.map((id) => ({
  id,
  title: TITLES[id],
  detail: DETAILS[id],
  projectId: id === 'commuter' ? null : CLASS_RESEARCH[id].id,
}));

export const ALL_CLASS_IDS: readonly AircraftClassId[] = SIZE_CLASSES;

export function classDef(id: AircraftClassId): AircraftClassDef {
  return AIRCRAFT_CLASSES.find((c) => c.id === id)!;
}

type AircraftLike = { class?: string; capacity?: number; cruiseSpeed?: number };

/** The class an aircraft belongs to (`sizeClassOf`); missing fields count as a small, slow aircraft. */
export function classOfAircraft(a: AircraftLike): AircraftClassId {
  return sizeClassOf({ class: String(a.class ?? ''), capacity: Number(a.capacity) || 0, cruiseSpeed: Number(a.cruiseSpeed) || 0 });
}

/** The classes of the aircraft already in the fleet. */
export function classesOfFleet(fleet: ReadonlyArray<AircraftLike>): Set<AircraftClassId> {
  return new Set(fleet.map(classOfAircraft));
}

/**
 * The classes open to an airline (`openSizeClasses`): Commuter, every class researched, every class of the
 * fleet (never taken away); all of them in Free Mode.
 */
export function openClasses(doneProjects: readonly string[], fleet: ReadonlyArray<AircraftLike> = [], mode: GameMode = 'normal'): Set<AircraftClassId> {
  return new Set(openSizeClasses(doneProjects, [...classesOfFleet(fleet)], mode));
}

/** The text of a refusal, or null when the aircraft's class is open. */
export function classGateMessage(
  aircraft: AircraftLike & { manufacturer?: string; type?: string },
  open: ReadonlySet<AircraftClassId>,
): string | null {
  const id = classOfAircraft(aircraft);
  if (open.has(id)) return null;
  const def = classDef(id);
  const name = [aircraft.manufacturer, aircraft.type].filter(Boolean).join(' ') || 'This aircraft';
  return `The ${name} belongs to the class "${def.title}" (${def.detail.toLowerCase()}). Develop it first under Career > Development.`;
}
