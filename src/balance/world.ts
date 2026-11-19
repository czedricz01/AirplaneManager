/**
 * Balance-Skript (Paket 3.9): Beispiel-Welten aus den Modell-Funktionen.
 *
 * Kein Spielcode. Baut kleine `ModelState`s (eine oder zwei Gesellschaften, eine Strecke) und rechnet sie mit
 * `monthOperations` aus `src/model/` – also mit genau der Rechnung des Monatsabschlusses (R1, R2). So zeigen die
 * Beispielwerte, was ein Spieler im Planer und im Monatsbericht sehen würde.
 */

import { aircraftList } from '../data/aircraft';
import { airportsData } from '../data/airports';
import { regionOf } from '../lib/geoUtils';
import { START_YEAR, CABIN_CLASSES, type CabinClass, type RivalPersonality, type WorldRegion } from '../model/constants';
import { blockMinutes, distanceKm } from '../model/demand';
import {
  fleetValue,
  monthOperations,
  newLedger,
  type AircraftState,
  type CatalogType,
  type CompanyInputs,
  type CompanyOperations,
  type CompanyState,
  type HoldingState,
  type ModelAirport,
  type ModelState,
  type RouteFigures,
  type RouteState,
} from '../model/monthClose';
import { RIVAL_INPUTS, rivalAircraft, rivalService } from '../model/rivals';
import type { PartialClassFigures } from '../model/fare';

/** Spielmonat aus Jahr und Kalendermonat (1 = Januar). */
export const monthOf = (year: number, calendarMonth = 1): number => (year - START_YEAR) * 12 + calendarMonth - 1;

/**
 * Kalendermonat der Beispiele: Mai. Die Saison (`SEASON_BY_MONTH`) liegt dort bei 1,03, also nahe am Jahresmittel;
 * Januar läge mit 0,89 deutlich darunter.
 */
export const SAMPLE_CALENDAR_MONTH = 5;

/** Spielmonat eines Beispieljahres (Mai). */
export const sampleMonth = (year: number): number => monthOf(year, SAMPLE_CALENDAR_MONTH);

/** Neutrale Eingaben (die der KI, 7.2): Lohn 100 %, keine Forschung, keine Werbung, Schwierigkeit Normal. */
export const NEUTRAL_INPUTS: CompanyInputs = { ...RIVAL_INPUTS, campaigns: [] };

/** Ein Flughafen aus `src/data/airports.ts` als `ModelAirport` (Region über `regionOf`, R15). */
export function modelAirport(id: string): ModelAirport {
  const a = airportsData.find((x) => x.id === id);
  if (!a) throw new Error(`Flughafen ${id} fehlt`);
  return { id, coords: a.coords, stats: a.stats, size: a.level, region: regionOf(a.coords) as WorldRegion, maxIcaoCode: a.maxIcaoCode };
}

/** Ein Flugzeugtyp aus `src/data/aircraft.ts`. */
export function catalogType(id: string): CatalogType {
  const t = aircraftList.find((x) => x.id === id);
  if (!t) throw new Error(`Flugzeugtyp ${id} fehlt`);
  return t;
}

/** Großkreis-Entfernung zweier Flughäfen in km. */
export function pairKm(from: string, to: string): number {
  return distanceKm(modelAirport(from).coords, modelAirport(to).coords);
}

/** Ein Angebot einer Gesellschaft: ein neues Flugzeug, eine Strecke. */
export interface OfferSpec {
  /** Kennung der Gesellschaft. */
  readonly company: string;
  readonly typeId: string;
  /** Kabine und Service nach dieser Persönlichkeit (7.5), damit Spieler und KI gleich ausgestattet sind. */
  readonly personality: RivalPersonality;
  /** Abflüge je Woche, beide Richtungen. */
  readonly departures: number;
  /** Preisniveau je Klasse; fehlt = 1 (Marktpreis). */
  readonly fareRatios?: PartialClassFigures;
  /** Laufmonate; Standard 24 (Anlauf vorbei). */
  readonly ageMonths?: number;
  readonly inputs?: CompanyInputs;
  readonly reputation?: number;
  /** Zustand von Zelle und Kabine in % (Standard 100, neu); für gebrauchte Flugzeuge (Szenario, 3.9c). */
  readonly condition?: { readonly airframe: number; readonly cabin: number };
}

/** Ein Markt: Städtepaar, Monat, Angebote. */
export interface MarketSpec {
  readonly from: string;
  readonly to: string;
  readonly month: number;
  readonly offers: readonly OfferSpec[];
  /**
   * Faktor auf die Marktgröße (Standard 1). Wirkt als weltweites Ereignis im Spielstand (`randomEvents`, 3.5), also
   * genau wie ein anderer Wert von `DEMAND_SCALE`, ohne die Konstante zu ändern. Nur für Empfindlichkeits-Tabellen.
   */
  readonly demandScale?: number;
}

/** Holding an einem Strecken-Ende: Slots für die Abflüge an diesem Ende, zwei normale Schalter. */
function holdingFor(plane: AircraftState, departuresHere: number): HoldingState {
  return {
    managementTier: 0,
    slots: { [plane.aircraftClass]: Math.ceil(departuresHere) },
    stands: {},
    desks: { normal: 2, self: 0 },
    facilities: [],
  };
}

/** Die Strecke eines Angebots (Service je Klasse nach der Persönlichkeit). */
function routeFor(spec: OfferSpec, plane: AircraftState, from: string, to: string): RouteState {
  const minutes = blockMinutes(pairKm(from, to), plane.cruiseSpeed);
  const service: Partial<Record<CabinClass, ReturnType<typeof rivalService>>> = {};
  for (const c of CABIN_CLASSES) if ((plane.seats[c] ?? 0) > 0) service[c] = rivalService(spec.personality, c, minutes);
  return {
    id: `${spec.company}-r`,
    aircraftId: plane.id,
    from,
    to,
    departuresPerWeek: spec.departures,
    fareRatios: spec.fareRatios ?? {},
    ageMonths: spec.ageMonths ?? 24,
    service,
  };
}

/** Eine Gesellschaft mit einem neuen Flugzeug (gebaut im Monat des Markts) auf einer Strecke. */
function companyFor(spec: OfferSpec, market: MarketSpec): CompanyState {
  const fresh = rivalAircraft(spec.personality, catalogType(spec.typeId), market.month, `${spec.company}-p`);
  const plane = spec.condition ? { ...fresh, airframeCondition: spec.condition.airframe, cabinCondition: spec.condition.cabin } : fresh;
  const route = routeFor(spec, plane, market.from, market.to);
  const cash = 100_000_000;
  const holding = holdingFor(plane, spec.departures / 2);
  return {
    id: spec.company,
    cash,
    reputation: spec.reputation ?? 50,
    inputs: spec.inputs ?? NEUTRAL_INPUTS,
    aircraft: [plane],
    routes: [route],
    airports: { [market.from]: holding, [market.to]: holding },
    preorders: [],
    overdrawnMonths: 0,
    profitStreak: 0,
    ledger: newLedger(cash, fleetValue([plane], market.month), 0),
    reports: [],
  };
}

/** Der Spielstand eines Markts (ohne Störungen, ohne Zufallsereignisse; geschichtliche Ereignisse wirken). */
export function marketState(market: MarketSpec): ModelState {
  return {
    month: market.month,
    seed: 1,
    airports: { [market.from]: modelAirport(market.from), [market.to]: modelAirport(market.to) },
    randomEvents:
      market.demandScale === undefined || market.demandScale === 1
        ? []
        : [{ title: 'Balance: market scale', startMonth: market.month, months: 1, demandMultiplier: market.demandScale }],
    disruptions: [],
    badLuck: false,
    resold: [],
    companies: market.offers.map((o) => companyFor(o, market)),
  };
}

/** Rechnet einen Markt mit `monthOperations` (dieselbe Rechnung wie der Abschluss). */
export function runMarket(market: MarketSpec): Readonly<Record<string, CompanyOperations>> {
  return monthOperations(marketState(market));
}

/** Die einzige Strecke einer Gesellschaft im Ergebnis. */
export function routeOf(ops: Readonly<Record<string, CompanyOperations>>, company: string): RouteFigures {
  return ops[company].routes[0];
}

/** Sitze je Woche über alle Klassen. */
export function seatsTotal(figures: PartialClassFigures): number {
  return CABIN_CLASSES.reduce((s, c) => s + (figures[c] ?? 0), 0);
}
