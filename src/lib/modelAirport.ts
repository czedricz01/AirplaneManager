/**
 * Flughafen und Infrastruktur nach dem Modell (Paket 4.3, docs/neubau F60; W1–W3 aus `bestand/8-oberflaeche.md`).
 *
 * Flughafen-Ansicht, Flughafen-Liste und Infrastruktur-Teil des Planers lesen alle Preise, Mieten, Gebühren,
 * Grenzen und die Schalter-Last von hier. Jede Zahl kommt aus `src/model/` und ist dieselbe, die der Abschluss bucht
 * (R2): Mieten und Unterhalt wie `companyOperations` (`src/model/monthClose.ts`), Einmalpreise wie die KI sie zahlt
 * (`src/model/rivalMonth.ts`).
 *
 * Alles hier ist rein (keine Zustände, keine globalen Daten).
 */
import { aircraftList, type Aircraft } from '../data/aircraft';
import type { OwnedAircraft } from '../components/MyFleetView';
import {
  AIRCRAFT_CLASSES,
  CABIN_CLASSES,
  DESK_FIXED_SHARE,
  DESK_TYPE_PENALTY,
  LANDING_REFERENCE_SEATS,
  PROPELLER_MAX_SPEED,
  type AircraftClass,
  type DeskType,
  type FacilityKind,
} from '../model/constants';
import {
  airportUpkeepParts,
  deskRent,
  facilityPrice,
  facilityUpkeep,
  hasStands,
  isDeskTypeAvailable,
  managementTierPrice,
  slotLimit,
  slotPrice,
  slotRent,
  slotResalePrice,
  standRent,
  type AirportUpkeepParts,
} from '../model/airportCosts';
import { airportFeeFactor, checkInFee, handlingFee, landingFee } from '../model/costs';
import { deskCapacity, deskLoad, deskOverloadPoints } from '../model/satisfaction';
import { hubQuality } from '../model/transfers';
import { researchEffects } from '../model/progress';
import { rivalAgentOf } from '../model/rivalMonth';
import type { AirportInfrastructure, SimulatedRoute } from './gameTypes';
import { aircraftState, departuresPerWeek, holdingState } from './modelBridge';
import type { RivalRecord } from './modelBridgeWorld';

/** Art eines Slots oder Stands, wie die Oberfläche sie schreibt. */
export type SlotKind = 'regional' | 'narrowbody' | 'widebody';

/** Oberflächen-Name → Flugzeugklasse des Modells. */
export const SLOT_CLASS: Readonly<Record<SlotKind, AircraftClass>> = {
  regional: 'Regional',
  narrowbody: 'Narrowbody',
  widebody: 'Widebody',
};

const SLOT_KINDS: readonly SlotKind[] = ['regional', 'narrowbody', 'widebody'];
const FACILITY_KINDS: readonly FacilityKind[] = ['hangar', 'vipLounge', 'catering'];

/** Leerer Bestand: kein Recht an diesem Flughafen. */
export const NO_INFRASTRUCTURE: AirportInfrastructure = {
  level: 0,
  slots: { regional: 0, narrowbody: 0, widebody: 0 },
  stands: { regional: 0, narrowbody: 0, widebody: 0 },
  desks: { normal: 0, self: 0 },
};

// ===========================================================================
// Was alle Preise brauchen
// ===========================================================================

/**
 * Was die Preise an Flughäfen vom Spielstand brauchen: Monat, Forschung und Meilensteine des Spielers und die Slots,
 * die die KI an jedem Flughafen gekauft hat (Grenze aller Gesellschaften, E50).
 */
export interface AirportPricing {
  readonly month: number;
  readonly completedResearch: readonly string[];
  /** `milestoneSlotFactor` des Spielers (Abschnitt 6), sonst 1. */
  readonly milestoneSlotFactor: number;
  /** Gekaufte Slots aller KI je Flughafen (`rivalSlotsByAirport`). */
  readonly rivalSlots: Readonly<Record<string, number>>;
}

/** Slots, die die KI je Flughafen gekauft hat (alle Arten, alle KI zusammen). Aufgelöste KI zählen nicht. */
export function rivalSlotsByAirport(rivals: readonly Pick<RivalRecord, 'company'>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { company } of rivals) {
    if (rivalAgentOf(company)?.distress.status === 'liquidated') continue;
    for (const [id, h] of Object.entries(company.airports)) {
      const n = AIRCRAFT_CLASSES.reduce((s, c) => s + (h.slots[c] ?? 0), 0);
      if (n > 0) out[id] = (out[id] ?? 0) + n;
    }
  }
  return out;
}

// ===========================================================================
// Slots: Grenze und Preise (5.10, E50)
// ===========================================================================

/** Gekaufte Slots des Spielers an einem Flughafen, alle Arten. */
export function ownSlots(infra: Pick<AirportInfrastructure, 'slots'> | undefined): number {
  if (!infra) return 0;
  return SLOT_KINDS.reduce((s, k) => s + (Number(infra.slots?.[k]) || 0), 0);
}

/** Slots eines Flughafens: Grenze, eigene, die der KI, frei. */
export interface SlotCapacity {
  /** `slotLimit(Flughafengröße)`: alle Arten, alle Gesellschaften zusammen. */
  readonly total: number;
  readonly own: number;
  readonly rivals: number;
  /** `max(0, total − own − rivals)`: so viele kann der Spieler noch kaufen. */
  readonly free: number;
}

/** Slots an einem Flughafen der Größe `airportSize` (5.10). Ein Slot = ein Abflug je Woche (1.6, E50). */
export function slotCapacity(
  airportId: string,
  airportSize: number,
  infra: Pick<AirportInfrastructure, 'slots'> | undefined,
  pricing: Pick<AirportPricing, 'rivalSlots'>,
): SlotCapacity {
  const total = slotLimit(airportSize);
  const own = ownSlots(infra);
  const rivals = pricing.rivalSlots[airportId] ?? 0;
  return { total, own, rivals, free: Math.max(0, total - own - rivals) };
}

/** Kaufpreis eines Slots heute (`slotPrice` mit Forschung und Meilensteinen). SPEZIFIKATION 5.10. */
export function slotBuyPrice(kind: SlotKind, pricing: AirportPricing): number {
  return slotPrice(SLOT_CLASS[kind], pricing.month, pricing.completedResearch, pricing.milestoneSlotFactor);
}

/** Verkaufserlös eines Slots heute (`slotResalePrice`). SPEZIFIKATION 5.10. */
export function slotSalePrice(kind: SlotKind, pricing: AirportPricing): number {
  return slotResalePrice(SLOT_CLASS[kind], pricing.month, pricing.completedResearch, pricing.milestoneSlotFactor);
}

/**
 * Was ein Slot-Geschäft kostet: Kauf `amount × slotBuyPrice`, Verkauf (negatives `amount`) `amount × slotSalePrice`
 * (negativ = Geld kommt herein).
 */
export function slotTradeCost(kind: SlotKind, amount: number, pricing: AirportPricing): number {
  if (amount === 0) return 0;
  return amount * (amount > 0 ? slotBuyPrice(kind, pricing) : slotSalePrice(kind, pricing));
}

// ===========================================================================
// Was an einem Flughafen gebaut werden kann (5.10)
// ===========================================================================

/** Was an einem Flughafen zu haben ist. */
export interface InfraAvailability {
  /** Widebody-Slots: erst ab Flughafengröße 3 (Regel der Oberfläche, wie bisher). */
  readonly widebodySlots: boolean;
  /** Abstellplätze: ab `STANDS_MIN_AIRPORT_SIZE` (`hasStands`). */
  readonly stands: boolean;
  /** Selbstbedienungs-Schalter: ab `SELF_DESK_FROM` (`isDeskTypeAvailable`). */
  readonly selfCheckIn: boolean;
}

/** Widebody-Slots erst an Flughäfen ab dieser Größe (Regel der Oberfläche seit `getInfraAvailability`, nicht im Modell). */
const WIDEBODY_SLOTS_FROM_SIZE = 3;

/** Was an einem Flughafen der Größe `airportSize` im Monat `month` gebaut werden kann. */
export function infraAvailability(airportSize: number, month: number): InfraAvailability {
  return {
    widebodySlots: airportSize >= WIDEBODY_SLOTS_FROM_SIZE,
    stands: hasStands(airportSize),
    selfCheckIn: isDeskTypeAvailable('self', month),
  };
}

// ===========================================================================
// Schalter: Last und Pflicht (2.6.3, 5.10, E18, E55)
// ===========================================================================

/**
 * Sitze aller eigenen Abflüge an einem Flughafen je Woche, wie der Abschluss sie für `deskLoad` zählt
 * (`companyOperations`): je Strecke mit einem Ende hier Sitze × Flugabschnitte je Woche / 2. Der Planer gibt die
 * geplante Strecke als weitere Strecke mit (2.6.3: „im Planer zählt die geplante Strecke mit“) und lässt die bearbeitete
 * über `excludeRouteId` weg.
 */
/** Was eine Strecke für die Schalter-Last braucht (eine gespeicherte oder die geplante des Planers). */
export type DeskRoute = Pick<SimulatedRoute, 'id' | 'origin' | 'destination' | 'aircraft' | 'schedule' | 'weeklyFlights'>;

export function departingSeatsAt(
  airportId: string,
  routes: readonly DeskRoute[],
  fleet: readonly OwnedAircraft[],
  catalog: readonly Aircraft[] = aircraftList,
  excludeRouteId?: string,
): number {
  const seatsOf = new Map<string, number>();
  for (const plane of fleet) {
    const seats = aircraftState(plane, catalog).seats;
    seatsOf.set(plane.registration, CABIN_CLASSES.reduce((s, c) => s + (seats[c] ?? 0), 0));
  }
  let total = 0;
  for (const r of routes) {
    if (r.id === excludeRouteId) continue;
    if (r.origin !== airportId && r.destination !== airportId) continue;
    const seats = seatsOf.get(r.aircraft);
    if (seats === undefined) continue;
    total += (seats * departuresPerWeek(r)) / 2;
  }
  return total;
}

/** Schalter an einem Flughafen und was sie für die Satisfaction bedeuten. */
export interface DeskState {
  /** Sitze aller eigenen Abflüge je Woche (`departingSeatsAt`). */
  readonly departingSeats: number;
  /** Sitze je Woche, die die Schalter abfertigen (`deskCapacity`). */
  readonly capacity: number;
  /** `deskLoad` als Anteil (1 = voll; unendlich ohne Schalter). */
  readonly load: number;
  /** Abzug für Überlast an diesem Ende (`deskOverloadPoints`), vor Mittel beider Enden und Bodengewicht. */
  readonly overloadPoints: number;
  /** Abzug der Premium-Klassen an diesem Ende ohne bedienten Schalter (`DESK_TYPE_PENALTY`, E55), sonst 0. */
  readonly premiumPenalty: number;
  /** Strecken haben hier Abflüge, aber es gibt keinen Schalter (Pflicht verletzt, E18, E55). */
  readonly missing: boolean;
}

/** Schalter-Lage an einem Flughafen nach 2.6.3 (dieselben Funktionen wie die Satisfaction im Abschluss). */
export function deskState(desks: Readonly<Record<DeskType, number>>, departingSeats: number): DeskState {
  const capacity = deskCapacity(desks);
  const load = deskLoad(departingSeats, desks);
  return {
    departingSeats,
    capacity,
    load,
    overloadPoints: deskOverloadPoints(load),
    premiumPenalty: desks.normal < 1 && departingSeats > 0 ? DESK_TYPE_PENALTY : 0,
    missing: departingSeats > 0 && capacity <= 0,
  };
}

/**
 * Wie viele Schalter dieser Art höchstens verkauft werden dürfen (E18, E55): An einem Flughafen mit eigener
 * Verwaltungsstufe bleibt mindestens ein Schalter, gleich welcher Art. `Infinity`, wenn nichts dagegen spricht.
 */
export function deskSellLimit(infra: Pick<AirportInfrastructure, 'level' | 'desks'>, type: DeskType): number {
  const have = Number(infra.desks?.[type]) || 0;
  if ((infra.level ?? 0) < 1) return have;
  const other = Number(infra.desks?.[type === 'normal' ? 'self' : 'normal']) || 0;
  return Math.max(0, Math.min(have, have + other - 1));
}

// ===========================================================================
// Laufende Kosten und Gebühren (5.1, 5.5, 5.6, 5.10, 5.11)
// ===========================================================================

/** Wochen-Miete eines Schalters: heute, leer und voll ausgelastet. */
export interface DeskRent {
  readonly now: number;
  readonly idle: number;
  readonly full: number;
}

/** Alles, was die Flughafen-Ansicht an laufenden Kosten zeigt, im Geld des Monats, je Woche. */
export interface AirportCosts {
  /** `airportFeeFactor` des Spielers hier (Stufe und Forschung). */
  readonly feeFactor: number;
  readonly desks: DeskState;
  /** Miete je gekauftem Slot. */
  readonly slotRent: Readonly<Record<SlotKind, number>>;
  /** Miete je Abstellplatz (ab Stufe 2: 0). */
  readonly standRent: Readonly<Record<SlotKind, number>>;
  readonly deskRent: Readonly<Record<DeskType, DeskRent>>;
  /** Unterhalt je Einrichtung. */
  readonly facilityUpkeep: Readonly<Record<FacilityKind, number>>;
  /** Aufschlüsselung je Art: Slot- und Stand-Miete × Bestand, Schalter-Miete × Bestand, Unterhalt der eigenen Einrichtungen. */
  readonly breakdown: {
    readonly slots: Readonly<Record<SlotKind, number>>;
    readonly stands: Readonly<Record<SlotKind, number>>;
    readonly desks: Readonly<Record<DeskType, number>>;
    readonly facilities: Readonly<Record<FacilityKind, number>>;
  };
  /** `airportUpkeepParts` des Modells: dieselbe Summe, die der Abschluss als „Airport upkeep“ bucht. */
  readonly upkeep: AirportUpkeepParts;
  /** Landegebühr je Sitz eines Jets der Bezugsgröße (Narrowbody, `LANDING_REFERENCE_SEATS`). */
  readonly landingPerSeat: number;
  /** Check-in je Reise, die hier beginnt (`checkInFee`). */
  readonly checkInPerPassenger: number;
  /** Abfertigung je abfliegendem Fluggast (`handlingFee`). */
  readonly handlingPerPassenger: number;
}

const perKind = <T>(f: (k: SlotKind) => T): Record<SlotKind, T> => ({ regional: f('regional'), narrowbody: f('narrowbody'), widebody: f('widebody') });

/**
 * Laufende Kosten des Spielers an einem Flughafen je Woche und die Gebühren je Fluggast und Landung, im Geld des
 * Monats `pricing.month`. Dieselben Funktionen und Eingaben wie der Abschluss (`companyOperations`): Mieten mit
 * `airportFeeFactor`, Schalter-Miete nach `deskLoad` aller eigenen Abflüge. SPEZIFIKATION 5.1, 5.5, 5.6, 5.10, 5.11.
 */
export function airportCosts(
  airportId: string,
  airportSize: number,
  infra: AirportInfrastructure,
  routes: readonly DeskRoute[],
  fleet: readonly OwnedAircraft[],
  pricing: Pick<AirportPricing, 'month' | 'completedResearch'>,
  catalog: readonly Aircraft[] = aircraftList,
): AirportCosts {
  const X = pricing.month;
  const h = holdingState(infra);
  const feeFactor = airportFeeFactor(h.managementTier, pricing.completedResearch);
  const desks = deskState(h.desks, departingSeatsAt(airportId, routes, fleet, catalog));
  const slotRentOf = perKind((k) => slotRent(SLOT_CLASS[k], X, feeFactor));
  const standRentOf = perKind((k) => standRent(SLOT_CLASS[k], X, h.managementTier, feeFactor));
  const deskRentOf = (type: DeskType): DeskRent => ({
    now: deskRent(type, X, desks.load, feeFactor),
    idle: deskRent(type, X, 0, feeFactor),
    full: deskRent(type, X, 1, feeFactor),
  });
  const rent = { normal: deskRentOf('normal'), self: deskRentOf('self') };
  const upkeepOf = Object.fromEntries(FACILITY_KINDS.map((f) => [f, facilityUpkeep(f, X)])) as Record<FacilityKind, number>;
  const standsHere = hasStands(airportSize);
  const upkeep = airportUpkeepParts(
    {
      airportSize,
      managementTier: h.managementTier,
      feeFactor,
      slots: h.slots,
      // Ein Flughafen ohne Abstellplätze hat keine (alte Spielstände können welche tragen; das Modell bucht sie nicht).
      stands: standsHere ? h.stands : {},
      desks: h.desks,
      deskLoad: desks.load,
      facilities: h.facilities,
    },
    X,
  );
  const reference = { aircraftClass: 'Narrowbody' as const, capacity: LANDING_REFERENCE_SEATS.Narrowbody, cruiseSpeed: PROPELLER_MAX_SPEED };
  return {
    feeFactor,
    desks,
    slotRent: slotRentOf,
    standRent: standRentOf,
    deskRent: rent,
    facilityUpkeep: upkeepOf,
    breakdown: {
      slots: perKind((k) => (h.slots[SLOT_CLASS[k]] ?? 0) * slotRentOf[k]),
      stands: perKind((k) => (standsHere ? (h.stands[SLOT_CLASS[k]] ?? 0) * standRentOf[k] : 0)),
      desks: { normal: h.desks.normal * rent.normal.now, self: h.desks.self * rent.self.now },
      facilities: Object.fromEntries(FACILITY_KINDS.map((f) => [f, h.facilities.includes(f) ? upkeepOf[f] : 0])) as Record<FacilityKind, number>,
    },
    upkeep,
    landingPerSeat: landingFee(reference, airportSize, X, feeFactor) / reference.capacity,
    checkInPerPassenger: checkInFee(X, feeFactor),
    handlingPerPassenger: handlingFee(airportSize, X, feeFactor),
  };
}

/** Anteil der vollen Schalter-Miete, den ein leerer Schalter kostet (`DESK_FIXED_SHARE`), für Texte. */
export const DESK_IDLE_SHARE = DESK_FIXED_SHARE;

// ===========================================================================
// Einmalpreise (5.11) und Drehkreuz-Güte (3.13)
// ===========================================================================

/** Einmalpreis der Verwaltungsstufe `tier` (1 … 3) an einem Flughafen der Größe `airportSize` (`managementTierPrice`). */
export function tierPrice(tier: number, airportSize: number, month: number): number {
  return managementTierPrice(tier, airportSize, month);
}

/** Einmalpreis einer Einrichtung (`facilityPrice`). */
export function facilityBuyPrice(kind: FacilityKind, month: number): number {
  return facilityPrice(kind, month);
}

/**
 * Drehkreuz-Güte des Spielers an einem Flughafen (3.13): `hubQuality` des Modells mit Stufe, Lounge, Catering und dem
 * Forschungs-Faktor `hubQualityFactor` (wie der Abschluss).
 */
export function playerHubQuality(infra: Pick<AirportInfrastructure, 'level' | 'hubFacilities'>, completedResearch: readonly string[]): number {
  return hubQuality(
    { level: infra.level ?? 0, lounge: infra.hubFacilities?.vipLounge === true, catering: infra.hubFacilities?.catering === true },
    researchEffects(completedResearch).hubQualityFactor,
  );
}
