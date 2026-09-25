/**
 * Putting new aircraft into the player's fleet.
 *
 * A purchase and a scenario's starting fleet go through the same function, so
 * a starting aircraft carries exactly the fields a bought one does: a unique
 * registration from the hub's country, the date it joined the fleet (which
 * the disruption model reads as its age), its condition and its cabin.
 */
import { aircraftList, type Aircraft } from '../data/aircraft';
import type { Scenario } from '../data/scenarios';
import type { OwnedAircraft } from '../components/MyFleetView';
import type { ConfigOutput } from '../components/ConfigurePurchaseView';
import { generateUniqueRegistration } from '../utils/registration';

export interface NewAircraftOptions {
  config: ConfigOutput;
  baseInteriorPop: number;
  /** The hub whose country prefix the registrations take. */
  hub: string;
  /** Registrations already flying, which the new ones must not repeat. */
  existingRegistrations: string[];
  /** The month offset the aircraft joined the fleet. */
  purchasedAt: number;
  /** Airframe and cabin condition, 0-100; 100 for a new aircraft. */
  condition?: number;
}

/** `count` aircraft of one type, each with its own registration. */
export function createOwnedAircraft(aircraft: Aircraft, count: number, opts: NewAircraftOptions): OwnedAircraft[] {
  const condition = Math.min(100, Math.max(0, opts.condition ?? 100));
  const taken = [...opts.existingRegistrations];
  const planes: OwnedAircraft[] = [];
  for (let i = 0; i < count; i++) {
    const registration = generateUniqueRegistration(aircraft.manufacturer, aircraft.type, aircraft.family || '', opts.hub || 'FRA', taken);
    taken.push(registration);
    planes.push({
      ...aircraft,
      registration,
      purchasedAt: opts.purchasedAt,
      conditionInterior: condition,
      conditionGeneral: condition,
      refitsDone: 0,
      config: opts.config,
      baseInteriorPop: opts.baseInteriorPop
    });
  }
  return planes;
}

/** The purchase screen's seat defaults, for a cabin nobody has configured. */
const DEFAULT_PITCH = { first: 180, business: 120, premium: 90, economy: 74 };

/**
 * The cabin the purchase screen starts from: every seat economy at the
 * standard 74 cm pitch, no extras. Its interior rating is the screen's
 * economy base, 50.
 */
export function defaultCabin(aircraft: Pick<Aircraft, 'capacity'>): { config: ConfigOutput; baseInteriorPop: number } {
  const empty = (pitch: number) => ({ seats: 0, pitch, seatType: 'Standard', hasIFE: false, hasPower: false });
  const config: ConfigOutput = {
    first: 0,
    business: 0,
    premium: 0,
    economy: aircraft.capacity,
    details: {
      first: empty(DEFAULT_PITCH.first),
      business: empty(DEFAULT_PITCH.business),
      premium: empty(DEFAULT_PITCH.premium),
      economy: { ...empty(DEFAULT_PITCH.economy), seats: aircraft.capacity },
      hasWifi: false,
      hasAmbientLighting: false,
      hasPremiumCatering: false,
      hasOnboardBar: false,
      hasShower: false,
      hasReducedGalley: false,
      hasMinimalServices: false
    }
  };
  return { config, baseInteriorPop: 50 };
}

/**
 * A scenario's starting fleet, free of charge: new or used as the scenario
 * says, in the default cabin. Models missing from the catalogue are skipped
 * (the scenario tests make sure there are none).
 */
export function startingFleet(scenario: Pick<Scenario, 'fleet' | 'hub' | 'startOffset'>): OwnedAircraft[] {
  const planes: OwnedAircraft[] = [];
  for (const entry of scenario.fleet) {
    const spec = aircraftList.find(a => a.id === entry.model);
    if (!spec || !(entry.count > 0)) continue;
    const { config, baseInteriorPop } = defaultCabin(spec);
    planes.push(...createOwnedAircraft(spec, entry.count, {
      config,
      baseInteriorPop,
      hub: scenario.hub,
      existingRegistrations: planes.map(p => p.registration),
      purchasedAt: scenario.startOffset - Math.max(0, entry.ageMonths ?? 0),
      condition: entry.condition
    }));
  }
  return planes;
}
