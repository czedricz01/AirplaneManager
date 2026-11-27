/**
 * Brücke zwischen dem Spielstand der Oberfläche und dem Spielstand des Modells (`ModelState`, `src/model/monthClose.ts`).
 * Paket 4.2b Teil 1 (E72): Welt (Flughäfen, Typen-Katalog) und der Betrieb des Spielers (Flugzeuge, Strecken, Bestand an
 * Flughäfen), in beide Richtungen.
 *
 * - **Lesen** (`…State`): baut aus den Feldern der Oberfläche die Modell-Werte. Alles, was sich nur durch Einstellungen
 *   ändert (Sitze, Interior score, Kabinen-Listenpreis, Service-Auswahl), wird hier einmal ausgerechnet (F41).
 * - **Zurückschreiben** (`apply…`): übernimmt, was der Abschluss ändert (Zustand der Flugzeuge, Preise, verkaufte
 *   Flugzeuge mit ihren Strecken). Felder, die das Modell nicht kennt (Kennzeichen, Kabinen-Details, Fahrplan,
 *   Anzeige-Werte), bleiben unverändert.
 * - Regel: Lesen und gleich wieder Zurückschreiben ändert nichts (Test „Hin und zurück“).
 *
 * Die Datei ist Teil der Oberfläche (`src/lib/`): Sie kennt die Typen der Ansichten, das Modell kennt sie nicht.
 */

import { aircraftList, type Aircraft } from '../data/aircraft';
import { airports as registryAirports } from '../data/airportRegistry';
import type { Airport } from '../data/airportTypes';
import type { ClassSetup, ConfigOutput } from '../components/ConfigurePurchaseView';
import type { OwnedAircraft } from '../components/MyFleetView';
import { regionOf } from './geoUtils';
import type { AirportInfrastructure, ManagementLevel, ScheduledTrip, SimulatedRoute } from './gameTypes';
import {
  CABIN_CLASSES,
  MINUTES_PER_WEEK,
  RAMP_MONTHS,
  type AircraftClass,
  type CabinClass,
  type CabinExtra,
  type FacilityKind,
  type WorldRegion,
} from '../model/constants';
import { cabinListPrice, deliverableExtras, interiorScore, quickTurnCabin, type CabinFit, type ClassInterior, type PricedClass } from '../model/cabin';
import { distanceKm } from '../model/demand';
import { clampFareRatio, marketFare, type PartialClassFigures } from '../model/fare';
import type { ServiceSelection } from '../model/satisfaction';
import { hasStands } from '../model/airportCosts';
import type {
  AircraftState,
  CatalogType,
  HoldingState,
  ModelAirport,
  RouteSchedule,
  RouteState,
} from '../model/monthClose';

// ===========================================================================
// Welt
// ===========================================================================

/** Ein Flughafen der Daten als `ModelAirport` (Region über `regionOf`, R15). */
export function modelAirport(a: Pick<Airport, 'id' | 'coords' | 'stats' | 'level' | 'maxIcaoCode'>): ModelAirport {
  return { id: a.id, coords: a.coords, stats: a.stats, size: a.level, region: regionOf(a.coords) as WorldRegion, maxIcaoCode: a.maxIcaoCode };
}

/** Alle Flughäfen als `ModelAirport`, je Kennung. Standard: die eine Flughafen-Liste des Spiels (`airportRegistry`). */
export function modelAirports(list: readonly Airport[] = registryAirports): Record<string, ModelAirport> {
  const out: Record<string, ModelAirport> = {};
  for (const a of list) out[a.id] = modelAirport(a);
  return out;
}

/** Ein Flugzeugtyp der Daten als `CatalogType` (gleiche Felder). */
export function catalogType(a: Aircraft): CatalogType {
  return {
    id: a.id,
    family: a.family,
    class: a.class,
    capacity: a.capacity,
    cruiseSpeed: a.cruiseSpeed,
    efficiency: a.efficiency,
    popularity: a.popularity,
    maxRange: a.maxRange,
    basePrice: a.basePrice,
    icaoCode: a.icaoCode,
    firstDeliveryOffset: a.firstDeliveryOffset,
    lastDeliveryOffset: a.lastDeliveryOffset,
  };
}

/** Der Typen-Katalog des Modells. */
export function modelCatalog(list: readonly Aircraft[] = aircraftList): CatalogType[] {
  return list.map(catalogType);
}

// ===========================================================================
// Kabine (Kaufdialog-Format → 2.3, 5.13)
// ===========================================================================

/**
 * Ausstattung je Klasse: Schalter im Kaufdialog (`ClassSetup`) → Schlüssel in `FEATURE_POINTS`. Dieselbe Zuordnung wie
 * `FEATURE_POP` und die Lieferbarkeits-Prüfungen in `src/components/ConfigurePurchaseView.tsx:98-102`, `:405-460`.
 */
export const FEATURE_FLAGS: Readonly<Record<CabinClass, Readonly<Record<string, keyof ClassSetup>>>> = {
  economy: { ife: 'hasIFE', power: 'hasPower', hooks: 'hasHooks', armrests: 'hasMovableArmrests', headrests: 'hasAdjHeadrests', shell: 'hasFixedShell', ped: 'hasPedHolder' },
  premium: { ife: 'hasIFE', power: 'hasPower', table: 'hasCocktailTable', calf: 'hasCalfRest', foot: 'hasFootrests', light: 'hasGooseneckLight', usbc: 'hasUSBC' },
  business: { ife: 'hasIFE', power: 'hasPower', lumbar: 'hasLumbarSupport', control: 'hasElecSeatControl', massage: 'hasMassage', divider: 'hasPrivacyDivider', charging: 'hasInductiveCharging' },
  first: { ife: 'hasIFE', power: 'hasPower', wardrobe: 'hasWardrobe', wood: 'hasWoodLeather', mirror: 'hasMirrors', minibar: 'hasMinibar', climate: 'hasActiveClimate' },
};

/** Kabinenweite Extras: Schalter in `ConfigOutput.details` → `CabinExtra` (wie `CABIN_EXTRA_POP`, `:106`). */
export const EXTRA_FLAGS: Readonly<Record<CabinExtra, keyof ConfigOutput['details']>> = {
  wifi: 'hasWifi',
  ambient: 'hasAmbientLighting',
  catering: 'hasPremiumCatering',
  bar: 'hasOnboardBar',
  shower: 'hasShower',
  reduced: 'hasReducedGalley',
  minimal: 'hasMinimalServices',
};

/** Sitzabstand des Kaufdialogs für eine Klasse ohne Angabe (`src/lib/fleet.ts`, `DEFAULT_PITCH`). */
const DEFAULT_PITCH: Readonly<Record<CabinClass, number>> = { first: 180, business: 120, premium: 90, economy: 74 };

/** Ausstattung einer Klasse aus dem Kaufdialog. Fehlende Angaben: Sitztyp `Standard`, Sitzabstand des Dialogs. */
export function classInterior(c: CabinClass, setup: Partial<ClassSetup> | undefined): ClassInterior {
  const features = Object.entries(FEATURE_FLAGS[c])
    .filter(([, flag]) => setup?.[flag] === true)
    .map(([key]) => key);
  return {
    seatType: typeof setup?.seatType === 'string' ? setup.seatType : 'Standard',
    pitch: Number.isFinite(setup?.pitch) ? (setup!.pitch as number) : DEFAULT_PITCH[c],
    features,
  };
}

/** Kabinenweite Extras aus dem Kaufdialog. */
export function cabinExtras(details: Partial<ConfigOutput['details']> | undefined): CabinExtra[] {
  return (Object.keys(EXTRA_FLAGS) as CabinExtra[]).filter((e) => details?.[EXTRA_FLAGS[e]] === true);
}

/** Sitze einer Klasse: `config[c]`, sonst `details[c].seats`, sonst 0. */
function seatsOf(config: Partial<ConfigOutput> | undefined, c: CabinClass): number {
  const n = config?.[c] ?? config?.details?.[c]?.seats;
  return Number.isFinite(n) && (n as number) > 0 ? (n as number) : 0;
}

/** Eine Kabine im Modell: Sitze, `interiorScore` und Listenpreis (alles fertig, F41). */
export interface ModelCabin {
  readonly seats: PartialClassFigures;
  readonly interiorScore: PartialClassFigures;
  readonly cabinListPrice1960: number;
  readonly hasWifi: boolean;
  readonly hasPremiumGalley: boolean;
  /** LCC-Kabine (`quickTurnCabin`, E98): kürzere Wendezeit. */
  readonly quickTurn: boolean;
}

/**
 * Kabine des Kaufdialogs als Modell-Werte: Sitze je Klasse mit Sitzen, `interiorScore` je Klasse (2.3) und
 * `cabinListPrice` (5.13), beide mit den Teilen, die im Einbaumonat lieferbar waren. WLAN und Premium-Bordküche aus den
 * eingebauten, lieferbaren Extras (wie `rivalAircraft`, 7.5).
 */
export function modelCabin(config: Partial<ConfigOutput> | undefined, fit: Omit<CabinFit, 'extras'>): ModelCabin {
  const full: CabinFit = { ...fit, extras: cabinExtras(config?.details) };
  const seats: Partial<Record<CabinClass, number>> = {};
  const scores: Partial<Record<CabinClass, number>> = {};
  const priced: Partial<Record<CabinClass, PricedClass>> = {};
  for (const c of CABIN_CLASSES) {
    const n = seatsOf(config, c);
    if (n === 0) continue;
    const interior = classInterior(c, config?.details?.[c]);
    seats[c] = n;
    scores[c] = interiorScore(c, interior, full);
    priced[c] = { seats: n, interior };
  }
  const fitted = deliverableExtras(full.extras, full);
  return {
    seats,
    interiorScore: scores,
    cabinListPrice1960: cabinListPrice(priced, full),
    hasWifi: fitted.includes('wifi'),
    hasPremiumGalley: fitted.includes('catering'),
    quickTurn: quickTurnCabin(seats, full),
  };
}

/** Flugzeug der Flotte, soweit die Wendezeit es braucht. */
export interface QuickTurnPlane {
  readonly config?: Partial<ConfigOutput> | { readonly details?: unknown };
  readonly capacity?: number;
  readonly purchasedAt?: number;
  readonly cabinInstalledAt?: number;
}

/**
 * Hat ein Flugzeug der Flotte eine LCC-Kabine (`quickTurnCabin`, E98)? Dieselbe Regel wie `modelCabin`; Einbaumonat
 * `cabinInstalledAt`, sonst `purchasedAt`.
 */
export function planeQuickTurn(plane: QuickTurnPlane | undefined | null): boolean {
  if (!plane?.config) return false;
  const config = plane.config as Partial<ConfigOutput>;
  const seats: Partial<Record<CabinClass, number>> = {};
  for (const c of CABIN_CLASSES) seats[c] = seatsOf(config, c);
  const installedMonth = plane.cabinInstalledAt ?? plane.purchasedAt ?? 0;
  return quickTurnCabin(seats, { installedMonth, capacity: plane.capacity ?? 0, extras: cabinExtras(config.details) });
}

// ===========================================================================
// Flugzeuge
// ===========================================================================

/** Typ-Werte aus dem Katalog (Kennung `plane.id`); fehlt der Typ, die Werte am Flugzeug. */
function typeOf(plane: OwnedAircraft, catalog: readonly Aircraft[]): Aircraft {
  return catalog.find((a) => a.id === plane.id) ?? plane;
}

/**
 * Ein Flugzeug des Spielers als `AircraftState`. Kennung = Kennzeichen. Typ-Werte aus dem Katalog (nicht die am
 * Flugzeug fortgeschriebenen `popularity` / `efficiency`; Alter, Erstkunde und Forschung rechnet das Modell, 2.2, 5.3).
 * Baumonat = `purchasedAt` (bei Gebrauchtkauf schon um das Alter zurückgesetzt); Einbaumonat der Kabine =
 * `cabinInstalledAt`, sonst `purchasedAt`. Zustand: `conditionGeneral` → Zelle, `conditionInterior` → Kabine.
 */
export function aircraftState(plane: OwnedAircraft, catalog: readonly Aircraft[] = aircraftList): AircraftState {
  const type = typeOf(plane, catalog);
  const builtMonth = plane.purchasedAt;
  const cabinInstalledMonth = plane.cabinInstalledAt ?? plane.purchasedAt;
  const cabin = modelCabin(plane.config, { installedMonth: cabinInstalledMonth, capacity: type.capacity });
  return {
    id: plane.registration,
    typeId: type.id,
    family: type.family,
    aircraftClass: type.class as AircraftClass,
    capacity: type.capacity,
    cruiseSpeed: type.cruiseSpeed,
    efficiency: type.efficiency,
    catalogAppeal: type.popularity,
    hasWifi: cabin.hasWifi,
    hasPremiumGalley: cabin.hasPremiumGalley,
    seats: cabin.seats,
    interiorScore: cabin.interiorScore,
    listPrice1960: type.basePrice,
    builtMonth,
    cabinListPrice1960: cabin.cabinListPrice1960,
    cabinInstalledMonth,
    airframeCondition: plane.conditionGeneral,
    cabinCondition: plane.conditionInterior,
    launchCustomer: plane.launchBonusUntil !== undefined ? true : undefined,
    ...(cabin.quickTurn ? { quickTurn: true } : {}),
  };
}

/** Was der Abschluss an einem Flugzeug ändert: Zustand von Zelle und Kabine (8.10). Alles andere bleibt. */
export function applyAircraftState(plane: OwnedAircraft, state: AircraftState): OwnedAircraft {
  if (plane.conditionGeneral === state.airframeCondition && plane.conditionInterior === state.cabinCondition) return plane;
  return { ...plane, conditionGeneral: state.airframeCondition, conditionInterior: state.cabinCondition };
}

// ===========================================================================
// Bestand an Flughäfen (5.10, 5.11)
// ===========================================================================

/** Klassen der Slots und Stände: Oberfläche klein geschrieben, Modell wie die Daten. */
const SLOT_KEYS: readonly (readonly [AircraftClass, 'regional' | 'narrowbody' | 'widebody'])[] = [
  ['Regional', 'regional'],
  ['Narrowbody', 'narrowbody'],
  ['Widebody', 'widebody'],
];

const FACILITIES: readonly FacilityKind[] = ['hangar', 'vipLounge', 'catering'];

const count = (n: unknown): number => (Number.isFinite(n) && (n as number) > 0 ? (n as number) : 0);

/** Gleicher Bestand (Zahlen je Klasse, Schalter, Stufe, Einrichtungen ohne Reihenfolge). */
function sameHolding(a: HoldingState, b: HoldingState): boolean {
  return (
    a.managementTier === b.managementTier &&
    SLOT_KEYS.every(([k]) => (a.slots[k] ?? 0) === (b.slots[k] ?? 0) && (a.stands[k] ?? 0) === (b.stands[k] ?? 0)) &&
    a.desks.normal === b.desks.normal &&
    a.desks.self === b.desks.self &&
    FACILITIES.every((f) => a.facilities.includes(f) === b.facilities.includes(f))
  );
}

/** Bestand an einem Flughafen als `HoldingState`. Fehlende Zahlen = 0. */
export function holdingState(infra: AirportInfrastructure): HoldingState {
  const slots: Partial<Record<AircraftClass, number>> = {};
  const stands: Partial<Record<AircraftClass, number>> = {};
  for (const [model, ui] of SLOT_KEYS) {
    slots[model] = count(infra.slots?.[ui]);
    stands[model] = count(infra.stands?.[ui]);
  }
  return {
    managementTier: infra.level ?? 0,
    slots,
    stands,
    desks: { normal: count(infra.desks?.normal), self: count(infra.desks?.self) },
    facilities: FACILITIES.filter((f) => infra.hubFacilities?.[f] === true),
  };
}

/**
 * Bestand zurück in die Oberfläche. Einstellungen, die das Modell nicht kennt (`autoBuyStands`, `hubAutoUpgrade`),
 * kommen aus `before`.
 */
export function applyHoldingState(before: AirportInfrastructure | undefined, h: HoldingState): AirportInfrastructure {
  if (before && sameHolding(holdingState(before), h)) return before;
  const facilities = h.facilities.length > 0 || before?.hubFacilities
    ? Object.fromEntries(FACILITIES.map((f) => [f, h.facilities.includes(f)]))
    : undefined;
  return {
    ...before,
    level: h.managementTier as ManagementLevel,
    slots: { regional: h.slots.Regional ?? 0, narrowbody: h.slots.Narrowbody ?? 0, widebody: h.slots.Widebody ?? 0 },
    stands: { regional: h.stands.Regional ?? 0, narrowbody: h.stands.Narrowbody ?? 0, widebody: h.stands.Widebody ?? 0 },
    desks: { normal: h.desks.normal, self: h.desks.self },
    ...(facilities ? { hubFacilities: facilities } : {}),
  };
}

// ===========================================================================
// Strecken
// ===========================================================================

/** Flugabschnitte je Woche, beide Richtungen (`RouteState.departuresPerWeek`): je Umlauf 2, Einweg 1; ohne Fahrplan `weeklyFlights × 2`. */
export function departuresPerWeek(route: Pick<SimulatedRoute, 'schedule' | 'weeklyFlights'>): number {
  if (route.schedule && route.schedule.length > 0) return route.schedule.reduce((n, t) => n + (t.isOneWay ? 1 : 2), 0);
  return 2 * count(route.weeklyFlights);
}

/** Minute der Woche, in [0, `MINUTES_PER_WEEK`). */
const weekMinute = (m: number): number => ((m % MINUTES_PER_WEEK) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;

/**
 * Fahrplan einer Strecke in Minuten der Woche (Montag 00:00 = 0): Hinflug am Start um Tag/Stunde/Minute des Umlaufs,
 * Rückflug am Ziel nach Flugzeit + Bodenzeit (über das Wochenende hinaus wieder ab Montag). Einweg-Umläufe nur mit
 * Hinflug. Sortiert. Ohne Umläufe kein Fahrplan (keine Umsteige-Verbindungen, F42).
 */
export function routeSchedule(trips: readonly ScheduledTrip[] | undefined): RouteSchedule | undefined {
  if (!trips || trips.length === 0) return undefined;
  const fromDepartures: number[] = [];
  const toDepartures: number[] = [];
  for (const t of trips) {
    const out = (t.dayId - 1) * 24 * 60 + t.startHour * 60 + t.startMin;
    fromDepartures.push(weekMinute(out));
    if (!t.isOneWay) toDepartures.push(weekMinute(out + t.durMin + t.turnoverMin));
  }
  const asc = (a: number, b: number) => a - b;
  return { fromDepartures: fromDepartures.sort(asc), toDepartures: toDepartures.sort(asc) };
}

/**
 * Service-Auswahl einer Klasse (`classConfigs[c]`) als `ServiceSelection`. Altes Format der Mahlzeiten (eine flache
 * Liste statt einer Liste je Mahlzeit, `bestand/1-zufriedenheit.md` W15) zählt als Mahlzeit 1 (2.5: keine Kopie).
 */
export function serviceSelection(cfg: { catering?: unknown; extras?: unknown; service?: unknown } | undefined): ServiceSelection {
  const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const catering = Array.isArray(cfg?.catering) ? (cfg!.catering as unknown[]) : [];
  const flat = catering.length > 0 && catering.every((m) => typeof m === 'string');
  const meals = flat ? [strings(catering)] : catering.map(strings);
  return { meals, extras: strings(cfg?.extras), onboardService: strings(cfg?.service) };
}

/** Großkreis-Entfernung einer Strecke aus den Koordinaten (3.1); `route.distance` ist nur Anzeige. */
export function routeKm(route: Pick<SimulatedRoute, 'origin' | 'destination'>, airports: Readonly<Record<string, ModelAirport>>): number {
  const a = airports[route.origin];
  const b = airports[route.destination];
  if (!a || !b) throw new Error(`Flughafen fehlt: ${a ? route.destination : route.origin}`);
  return distanceKm(a.coords, b.coords);
}

/** Preise in $ → Preisniveau je Klasse (`fareRatio = Preis / marketFare`, begrenzt; 4.5, Umwandlung nach `SPEZIFIKATION.md` 4.5). */
export function fareRatiosOf(prices: Readonly<Record<string, number>> | undefined, km: number, month: number): PartialClassFigures | undefined {
  if (!prices) return undefined;
  const out: Partial<Record<CabinClass, number>> = {};
  for (const c of CABIN_CLASSES) {
    const p = prices[c];
    if (Number.isFinite(p) && p > 0) out[c] = clampFareRatio(p / marketFare(c, km, month));
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Preisniveau → Preise in $ des Monats (`fareRatio × marketFare`, 4.5). */
export function pricesOf(ratios: PartialClassFigures, km: number, month: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of CABIN_CLASSES) {
    const r = ratios[c];
    if (r !== undefined) out[c] = r * marketFare(c, km, month);
  }
  return out;
}

const sameRatios = (a: PartialClassFigures | undefined, b: PartialClassFigures | undefined): boolean =>
  CABIN_CLASSES.every((c) => a?.[c] === b?.[c]);

/** Was eine Strecke zum Lesen braucht. */
export interface RouteContext {
  /** Laufender Spielmonat X. */
  readonly month: number;
  /** Erster Spielmonat des Spielers: Alter einer Strecke ohne `openedOffset`. */
  readonly startMonth: number;
  readonly airports: Readonly<Record<string, ModelAirport>>;
}

/**
 * Eine Strecke des Spielers als `RouteState`.
 * - Flugzeug über das Kennzeichen (`route.aircraft`).
 * - Abflüge = Flugabschnitte je Woche (`departuresPerWeek`), Fahrplan nach `routeSchedule`.
 * - Preise: `activeTicketPrices` gelten im Monat X (`fareRatios`), `ticketPrices` ab X+1 (`nextFareRatios`, nur wenn
 *   anders; 4.5). Fehlt `activeTicketPrices`, gilt `ticketPrices` für beide.
 * - Alter: `month − openedOffset`; ohne `openedOffset` (Strecken von vor dem Anlauf) seit Spielstart, mindestens
 *   `RAMP_MONTHS` (gilt als eingeführt).
 */
export function routeState(route: SimulatedRoute, ctx: RouteContext): RouteState {
  const km = routeKm(route, ctx.airports);
  const fareRatios = fareRatiosOf(route.activeTicketPrices ?? route.ticketPrices, km, ctx.month);
  const next = fareRatiosOf(route.ticketPrices, km, ctx.month);
  const ageMonths = route.openedOffset !== undefined
    ? Math.max(0, ctx.month - route.openedOffset)
    : Math.max(RAMP_MONTHS, ctx.month - ctx.startMonth);
  const service: Partial<Record<CabinClass, ServiceSelection>> = {};
  for (const c of CABIN_CLASSES) {
    const cfg = route.classConfigs?.[c];
    if (cfg) service[c] = serviceSelection(cfg);
  }
  return {
    id: route.id,
    aircraftId: route.aircraft,
    from: route.origin,
    to: route.destination,
    departuresPerWeek: departuresPerWeek(route),
    fareRatios,
    nextFareRatios: next && !sameRatios(next, fareRatios) ? next : undefined,
    ageMonths,
    service,
    schedule: routeSchedule(route.schedule),
  };
}

/**
 * Was der Abschluss an einer Strecke ändert: die Preise (der Übergang macht `nextFareRatios` zu `fareRatios`, 4.5).
 * Geschrieben als $ des Monats `ctx.month` des Modell-Spielstands; `activeTicketPrices` = `ticketPrices`, solange kein
 * neuer Preis ansteht. Fahrplan, Service und Anzeige-Werte bleiben. Unveränderte Preisniveaus lassen die Strecke
 * unverändert (kein Rundungs-Rauschen).
 */
export function applyRouteState(route: SimulatedRoute, state: RouteState, ctx: RouteContext): SimulatedRoute {
  const before = routeState(route, ctx);
  if (sameRatios(before.fareRatios, state.fareRatios) && sameRatios(before.nextFareRatios, state.nextFareRatios)) return route;
  const km = routeKm(route, ctx.airports);
  const active = state.fareRatios ? pricesOf(state.fareRatios, km, ctx.month) : route.activeTicketPrices;
  const next = state.nextFareRatios ? pricesOf(state.nextFareRatios, km, ctx.month) : active;
  return { ...route, activeTicketPrices: active, ticketPrices: next };
}

// ===========================================================================
// Betrieb des Spielers zusammen
// ===========================================================================

/** Der Betrieb des Spielers in der Oberfläche. */
export interface PlayerOperations {
  readonly fleet: readonly OwnedAircraft[];
  readonly routes: readonly SimulatedRoute[];
  readonly airportManagement: Readonly<Record<string, AirportInfrastructure>>;
}

/** Der Betrieb des Spielers als Teile von `CompanyState`. */
export interface ModelOperations {
  readonly aircraft: readonly AircraftState[];
  readonly routes: readonly RouteState[];
  readonly airports: Readonly<Record<string, HoldingState>>;
}

/** Liest den ganzen Betrieb. Strecken ohne eigenes Flugzeug in der Flotte sind ein Fehler im Spielstand. */
export function modelOperations(ops: PlayerOperations, ctx: RouteContext, catalog: readonly Aircraft[] = aircraftList): ModelOperations {
  const regs = new Set(ops.fleet.map((p) => p.registration));
  for (const r of ops.routes) {
    if (!regs.has(r.aircraft)) throw new Error(`Strecke ${r.id}: Flugzeug ${r.aircraft} fehlt in der Flotte`);
  }
  const airports: Record<string, HoldingState> = {};
  for (const [id, infra] of Object.entries(ops.airportManagement)) {
    const holding = holdingState(infra);
    // Stands an einem Flughafen ohne Abstellplätze (5.10, Größe < 3) kamen aus älteren Ständen über den Slot-Kauf am
    // Hub dazu; das Modell lehnt sie ab und der ganze Spielstand wäre ohne Prognose. Sie zählen nicht und kosten nichts.
    const size = ctx.airports[id]?.size;
    airports[id] = size !== undefined && !hasStands(size) ? { ...holding, stands: {} } : holding;
  }
  return {
    aircraft: ops.fleet.map((p) => aircraftState(p, catalog)),
    routes: ops.routes.map((r) => routeState(r, ctx)),
    airports,
  };
}

/** Ergebnis des Zurückschreibens. */
export interface AppliedOperations extends PlayerOperations {
  /** Flugzeuge im Modell, die die Flotte nicht kennt (z. B. Lieferungen aus Vorbestellungen); Teil 2 legt sie an. */
  readonly newAircraft: readonly AircraftState[];
}

/**
 * Schreibt den Betrieb zurück: Flugzeuge, die das Modell nicht mehr hat (Zwangsverkauf, 8.14), fallen mit ihren
 * Strecken weg; die übrigen bekommen ihren Zustand, die Strecken ihre Preise im Monat `ctx.month`. Der Bestand an
 * Flughäfen wird übernommen. Reihenfolge der Oberfläche bleibt.
 */
export function applyModelOperations(
  ops: PlayerOperations,
  model: ModelOperations,
  ctx: RouteContext,
): AppliedOperations {
  const planes = new Map(model.aircraft.map((p) => [p.id, p]));
  const routes = new Map(model.routes.map((r) => [r.id, r]));
  const fleet = ops.fleet.flatMap((p) => {
    const s = planes.get(p.registration);
    return s ? [applyAircraftState(p, s)] : [];
  });
  const kept = new Set(fleet.map((p) => p.registration));
  const outRoutes = ops.routes.flatMap((r) => {
    const s = routes.get(r.id);
    return s && kept.has(r.aircraft) ? [applyRouteState(r, s, ctx)] : [];
  });
  const airportManagement: Record<string, AirportInfrastructure> = {};
  for (const [id, h] of Object.entries(model.airports)) airportManagement[id] = applyHoldingState(ops.airportManagement[id], h);
  const known = new Set(ops.fleet.map((p) => p.registration));
  return {
    fleet,
    routes: outRoutes,
    airportManagement,
    newAircraft: model.aircraft.filter((p) => !known.has(p.id)),
  };
}
