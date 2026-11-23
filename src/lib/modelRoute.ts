/**
 * Prognose einer Strecke nach dem Modell (Paket 4.5a, F62): Planer Schritt 4 (Preise) liest alle Zahlen von hier.
 *
 * - `routeForecast` rechnet eine geplante oder bestehende Strecke mit `plannerRouteFigures` (dieselbe Rechnung wie der
 *   Monatsabschluss, R2): Hauptzahl „Expected weekly profit“ nach dem Anlauf, Nebenzahlen „First month“, „before
 *   aircraft costs“ und „Full aircraft at market fare“ (4.12, E26, E57), je Klasse Marktpreis, Preisniveau,
 *   Satisfaction, Fluggäste und Gewinnschwelle (4.11) bei erwarteter und voller Auslastung.
 * - `routeBestFares` liefert je Klasse den gewinnbesten Preis (4.10).
 * - `routeMarketFares` / `pricesAtLevel` setzen Preise über ein Preisniveau für alle Klassen („Adjust All“, Startpreis
 *   = Marktpreis, E23).
 * - `plannedSatisfaction` liefert Planer Schritt 3 und dem Kabinen-Fenster die Satisfaction je Klasse mit allen Teilen und
 *   die Verpflegungskosten (Paket 4.5b, 2.4–2.7, 5.7).
 * - `routesThisMonth` liefert Streckenliste, Streckenansicht und Karte die Zahlen aller Strecken des Spielers im
 *   laufenden Monat aus `monthOperations`, derselben Rechnung, die der Abschluss bucht (Paket 4.5c, 8.1, R2).
 *
 * Rein: liest nur seine Eingabe (R12). Die Strecke kommt im Format der Oberfläche (`SimulatedRoute`, Preise in $) und
 * wird über die Brücke (`routeState`) gelesen.
 */
import { CABIN_CLASSES, RAMP_MONTHS, type CabinClass } from '../model/constants';
import {
  bestFareRatio,
  breakEvenFareLevel,
  fareVsMarket,
  fullAircraftRevenue,
  loadFactor,
  marketFares,
  type BreakEvenClass,
  type ClassFigures,
} from '../model/fare';
import { establishedRouteBonus } from '../model/marketSplit';
import {
  monthOperations,
  plannerRouteFigures,
  routeClassPassengersCurve,
  routeSatisfactionDetail,
  type CompanyState,
  type ModelState,
  type RouteFigures,
  type RouteSatisfactionDetail,
  type RouteState,
} from '../model/monthClose';
import { flightTimeIndex, routeSatisfaction, satisfactionFactor } from '../model/satisfaction';
import type { SimulatedRoute } from './gameTypes';
import { departuresPerWeek, routeKm, routeState, type RouteContext } from './modelBridge';
import { PLAYER_ID } from './modelMonth';

/** Was `App.tsx` dem Planer gibt: der ganze Spielstand als Modell (`modelGame`) und der erste Spielmonat. */
export interface PlannerModel {
  readonly state: ModelState;
  readonly startMonth: number;
}

/** Die Strecke, die der Planer rechnet. */
export interface PlannedRoute {
  /** Strecke im Format der Oberfläche; Preise in $ des Monats (`ticketPrices`), Fahrplan, Service je Klasse. */
  readonly route: SimulatedRoute;
  /** Neue Strecke (noch nicht gespeichert): Der erste Monat ist Monat 0 des Anlaufs. */
  readonly isNew: boolean;
  /** Erster Spielmonat des Spielers (Alter alter Strecken ohne `openedOffset`). */
  readonly startMonth: number;
}

/** Eine Klasse der Prognose (4.12 „Je Klasse“). */
export interface ClassForecast {
  /** Sitze je Woche, beide Richtungen. */
  readonly seatsPerWeek: number;
  /** `marketFare` (4.3). */
  readonly marketFare: number;
  /** Eingestellter Preis in $, wie er ab dem nächsten Monat gilt (`fareRatio × marketFare`). */
  readonly fare: number;
  readonly fareRatio: number;
  /** `fareVsMarket`: −0,1 = 10 % unter dem Marktpreis. */
  readonly vsMarket: number;
  /** Direktgäste je Woche nach dem Anlauf (3.11). */
  readonly passengers: number;
  /** Direktgäste / Sitze. */
  readonly loadFactor: number;
  /** Satisfaction der Klasse (2.7). */
  readonly satisfaction: number;
  /** Zahlungsbereitschaft für diese Satisfaction (2.10): 1,05 = Fluggäste zahlen bis zu 5 % mehr. */
  readonly satisfactionFactor: number;
  /** Kosten je Direktgast (5.8). */
  readonly costPerPassenger: number;
  /** Preis der Klasse an der Gewinnschwelle bei erwarteter Auslastung (fehlt ohne Fluggäste). */
  readonly breakEvenExpected?: number;
  /** Preis der Klasse an der Gewinnschwelle bei voller Maschine. */
  readonly breakEvenFull: number;
}

/** Was der Planer für eine Strecke zeigt (4.11, 4.12). */
export interface RouteForecast {
  readonly greatCircleKm: number;
  readonly marketFares: ClassFigures;
  /** Rechnung nach dem Anlauf (Anlauf = 1): Hauptzahl und alle Posten. */
  readonly figures: RouteFigures;
  /** Rechnung im ersten Monat (neue Strecke: Anlauf-Monat 0; bestehende: ihr Alter). */
  readonly firstMonth: RouteFigures;
  /** Hauptzahl „Expected weekly profit“ = `figures.result`. */
  readonly weeklyProfit: number;
  /** Nebenzahl „First month“ je Woche. */
  readonly firstMonthWeeklyProfit: number;
  /** Nebenzahl „before aircraft costs“ (E57): Ergebnis ohne Flugzeug-Anteil. */
  readonly beforeAircraftWeeklyProfit: number;
  /** Nebenzahl „Full aircraft at market fare“ (E26): jeder Sitz zum Marktpreis verkauft, nicht erwartet. */
  readonly fullAircraft: { readonly revenue: number; readonly cost: number; readonly profit: number };
  /** Direktgäste / Sitze über alle Klassen (erwartete Auslastung für die Gewinnschwelle). */
  readonly expectedLoad: number;
  /** Gewinnschwelle als Preisniveau (4.11): bei erwarteter Auslastung (fehlt ohne Fluggäste) und bei voller Maschine. */
  readonly breakEvenLevel: { readonly expected?: number; readonly full: number };
  readonly classes: Readonly<Partial<Record<CabinClass, ClassForecast>>>;
}

/** Bester Preis einer Klasse (4.10). */
export interface ClassBestFare {
  readonly fareRatio: number;
  /** In $ des Monats. */
  readonly fare: number;
}

/** Id, unter der die geplante Strecke im Planer-Spielstand steht. */
const routeIdOf = (planned: PlannedRoute): string => planned.route.id;

/** Laufmonate der Strecke im ersten Monat: neu 0, sonst ihr Alter nach der Brücke. */
function firstMonthAge(planned: PlannedRoute, route: RouteState): number {
  return planned.isNew ? 0 : route.ageMonths;
}

/**
 * Der Spielstand mit der geplanten Strecke des Spielers im Alter `ageMonths`: eine gespeicherte Strecke mit derselben
 * Id wird ersetzt, sonst kommt die Strecke dazu. Das Flugzeug muss in der Flotte des Spielers stehen.
 */
export function withPlannedRoute(state: ModelState, planned: PlannedRoute, ageMonths?: number): ModelState {
  const ctx: RouteContext = { month: state.month, startMonth: planned.startMonth, airports: state.airports };
  const read = routeState(planned.route, ctx);
  const route: RouteState = { ...read, ageMonths: ageMonths ?? firstMonthAge(planned, read) };
  const companies = state.companies.map((c) => {
    if (c.id !== PLAYER_ID) return c;
    if (!c.aircraft.some((p) => p.id === route.aircraftId)) throw new Error(`Planer: Flugzeug ${route.aircraftId} fehlt in der Flotte`);
    const others = c.routes.filter((r) => r.id !== route.id);
    return { ...c, routes: [...others, route] };
  });
  return { ...state, companies };
}

/** Zwei Spielstände: nach dem Anlauf (Hauptzahl, bester Preis) und im ersten Monat. */
function plannerStates(state: ModelState, planned: PlannedRoute): { readonly established: ModelState; readonly first: ModelState } {
  const first = withPlannedRoute(state, planned);
  const age = (first.companies.find((c) => c.id === PLAYER_ID)?.routes.find((r) => r.id === routeIdOf(planned)) as RouteState).ageMonths;
  return { established: withPlannedRoute(state, planned, Math.max(age, RAMP_MONTHS)), first };
}

/** Was eine Klasse für die Gewinnschwelle braucht (4.11). */
function breakEvenClasses(figures: RouteFigures, fares: ClassFigures): Partial<Record<CabinClass, BreakEvenClass>> {
  const classes: Partial<Record<CabinClass, BreakEvenClass>> = {};
  for (const c of CABIN_CLASSES) {
    if (!(figures.offeredSeats[c] > 0)) continue;
    classes[c] = { seatsPerWeek: figures.offeredSeats[c], marketFare: fares[c], costPerPassenger: figures.costPerPassenger[c] ?? 0 };
  }
  return classes;
}

/**
 * Prognose der Strecke (4.11, 4.12) im Monat des Spielstands; Preise, die ab dem nächsten Monat gelten. Ohne Abflüge
 * oder ohne Sitze `null`.
 */
export function routeForecast(state: ModelState, planned: PlannedRoute): RouteForecast | null {
  if (departuresPerWeek(planned.route) <= 0) return null;
  const id = routeIdOf(planned);
  const { established, first } = plannerStates(state, planned);
  const own = established.companies.find((c) => c.id === PLAYER_ID)?.routes.find((r) => r.id === id) as RouteState;
  const figures = plannerRouteFigures(established, PLAYER_ID, id, own.departuresPerWeek);
  const firstMonth = plannerRouteFigures(first, PLAYER_ID, id, own.departuresPerWeek);

  const km = routeKm(planned.route, state.airports);
  const fares = marketFares(km, state.month);
  const classesForBreakEven = breakEvenClasses(figures, fares);
  let seats = 0;
  let passengers = 0;
  let fullCost = figures.fixed.total;
  for (const c of CABIN_CLASSES) {
    seats += figures.offeredSeats[c];
    passengers += figures.passengers[c];
    fullCost += figures.offeredSeats[c] * (figures.costPerPassenger[c] ?? 0);
  }
  if (!(seats > 0)) return null;

  const expectedLoad = Math.min(1, loadFactor(passengers, seats));
  const full = breakEvenFareLevel(1, figures.fixed.total, classesForBreakEven);
  const expected = expectedLoad > 0 ? breakEvenFareLevel(expectedLoad, figures.fixed.total, classesForBreakEven) : undefined;

  const classes: Partial<Record<CabinClass, ClassForecast>> = {};
  for (const c of CABIN_CLASSES) {
    const seatsPerWeek = figures.offeredSeats[c];
    if (!(seatsPerWeek > 0)) continue;
    const fare = figures.fares[c];
    const fareRatio = fare / fares[c];
    const sat = figures.satisfaction[c] ?? 0;
    classes[c] = {
      seatsPerWeek,
      marketFare: fares[c],
      fare,
      fareRatio,
      vsMarket: fareVsMarket(fareRatio),
      passengers: figures.passengers[c],
      loadFactor: loadFactor(figures.passengers[c], seatsPerWeek),
      satisfaction: sat,
      satisfactionFactor: satisfactionFactor(sat),
      costPerPassenger: figures.costPerPassenger[c] ?? 0,
      breakEvenExpected: expected !== undefined ? expected * fares[c] : undefined,
      breakEvenFull: full * fares[c],
    };
  }

  const fullRevenue = fullAircraftRevenue(figures.offeredSeats, fares);
  return {
    greatCircleKm: km,
    marketFares: fares,
    figures,
    firstMonth,
    weeklyProfit: figures.result,
    firstMonthWeeklyProfit: firstMonth.result,
    beforeAircraftWeeklyProfit: figures.result + figures.fixed.aircraftShare,
    fullAircraft: { revenue: fullRevenue, cost: fullCost, profit: fullRevenue - fullCost },
    expectedLoad,
    breakEvenLevel: { expected, full },
    classes,
  };
}

/**
 * Bester Preis je Klasse mit Sitzen (4.10): Direktgäste nach dem Anlauf, alle anderen Preise und Angebote fest, Kosten
 * je Fluggast der Klasse. Hängt nicht vom eingestellten Preis der Klasse ab (jede Klasse ist ein eigener Markt, 3.7).
 */
export function routeBestFares(state: ModelState, planned: PlannedRoute): Partial<Record<CabinClass, ClassBestFare>> {
  if (departuresPerWeek(planned.route) <= 0) return {};
  const id = routeIdOf(planned);
  const { established } = plannerStates(state, planned);
  const own = established.companies.find((c) => c.id === PLAYER_ID)?.routes.find((r) => r.id === id) as RouteState;
  const figures = plannerRouteFigures(established, PLAYER_ID, id, own.departuresPerWeek);
  const fares = marketFares(routeKm(planned.route, state.airports), state.month);
  const out: Partial<Record<CabinClass, ClassBestFare>> = {};
  for (const c of CABIN_CLASSES) {
    if (!(figures.offeredSeats[c] > 0)) continue;
    const curve = routeClassPassengersCurve(established, PLAYER_ID, id, c);
    const fareRatio = bestFareRatio(curve, fares[c], figures.costPerPassenger[c] ?? 0);
    out[c] = { fareRatio, fare: fareRatio * fares[c] };
  }
  return out;
}

/**
 * Satisfaction der geplanten Strecke je Klasse mit allen Teilen (2.7) und Verpflegung je Fluggast (5.7), aus denselben
 * Eingaben wie der Abschluss (`routeSatisfactionDetail`, R2): Boden-Teil mit allen eigenen Abflügen an beiden Enden
 * samt der geplanten Strecke. Ohne Abflüge `null` (keine Schalter-Last, keine belegten Slots).
 */
export function plannedSatisfaction(state: ModelState, planned: PlannedRoute): RouteSatisfactionDetail | null {
  if (departuresPerWeek(planned.route) <= 0) return null;
  return routeSatisfactionDetail(withPlannedRoute(state, planned), PLAYER_ID, routeIdOf(planned));
}

/** Marktpreise der Strecke im Monat des Spielstands (4.3), für Startpreise und Regler. */
export function routeMarketFares(state: ModelState, route: Pick<SimulatedRoute, 'origin' | 'destination'>): ClassFigures {
  return marketFares(routeKm(route, state.airports), state.month);
}

/**
 * Preise in $ (gerundet) für ein Preisniveau in allen Klassen (`classes`): „Adjust All“ (4.5), Startpreis einer neuen
 * Strecke mit `level = 1` (Marktpreis, E23). Die Klassen-Verhältnisse kommen aus den Marktpreisen (4.2).
 */
export function pricesAtLevel(fares: ClassFigures, level: number, classes: readonly CabinClass[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of classes) out[c] = Math.max(1, Math.round(level * fares[c]));
  return out;
}

/** Eine Klasse einer Strecke im laufenden Monat (je Woche, beide Richtungen). */
export interface RouteMonthClass {
  /** Sitze im Markt (ohne gestrichene Flüge, 8.9). */
  readonly seatsPerWeek: number;
  /** Direktgäste (3.11). */
  readonly passengers: number;
  /** Umsteiger auf dieser Strecke (3.13). */
  readonly transferPassengers: number;
  /** Preis in $, der in diesem Monat gilt. */
  readonly fare: number;
  /** Direktgäste × Preis. */
  readonly directRevenue: number;
  /** (Direktgäste + Umsteiger) / Sitze. */
  readonly loadFactor: number;
  /** Satisfaction der Klasse (2.7). */
  readonly satisfaction: number;
}

/** Was Streckenliste, Streckenansicht und Karte von einer Strecke zeigen (Paket 4.5c). */
export interface RouteMonth {
  /** Alle Zahlen der Strecke aus dem Abschluss (Erlös, Kosten nach Posten, Ergebnis je Woche). */
  readonly figures: RouteFigures;
  /** Laufmonate (0 = erster Monat); Anlauf bis `RAMP_MONTHS` (3.12). */
  readonly ageMonths: number;
  /** Established route bonus (3.9.6, E9): 1,05 = 5 % mehr Anziehung. */
  readonly establishedBonus: number;
  readonly flightTimeIndex: number;
  /** Direktgäste + Umsteiger je Woche. */
  readonly passengers: number;
  readonly directPassengers: number;
  readonly transferPassengers: number;
  /** Erlös-Anteil der Umsteiger (4.8) = Erlös − Σ Direktgäste × Preis. */
  readonly transferRevenue: number;
  /** Sitze im Markt je Woche. */
  readonly seatsPerWeek: number;
  /** Route satisfaction (2.9), Mittel nach Fluggästen (Direktgäste + Umsteiger, wie die Airline satisfaction). */
  readonly satisfaction: number;
  readonly classes: Readonly<Partial<Record<CabinClass, RouteMonthClass>>>;
}

/**
 * Zahlen aller Strecken des Spielers im Monat des Spielstands, nach Strecken-Id: dieselbe Rechnung wie der Abschluss
 * (`monthOperations`, 8.1, R2) mit den Preisen dieses Monats, Störungen und Umsteigern. Eine Preisänderung zählt erst
 * im nächsten Monat (4.5).
 */
export function routesThisMonth(state: ModelState): ReadonlyMap<string, RouteMonth> {
  const ops = monthOperations(state)[PLAYER_ID];
  const player = state.companies.find((c) => c.id === PLAYER_ID);
  if (!ops || !player) return new Map();
  return routeMonthsOf(ops.routes, player);
}

/** `RouteMonth` je Strecke aus den Strecken-Zahlen von `monthOperations` einer Gesellschaft. */
export function routeMonthsOf(figures: readonly RouteFigures[], player: Pick<CompanyState, 'routes'>): Map<string, RouteMonth> {
  const out = new Map<string, RouteMonth>();
  for (const f of figures) {
    const age = player.routes.find((r) => r.id === f.routeId)?.ageMonths ?? 0;
    const classes: Partial<Record<CabinClass, RouteMonthClass>> = {};
    let direct = 0;
    let transfer = 0;
    let seats = 0;
    let directRevenue = 0;
    const weights: { satisfaction: number; passengers: number; seats: number }[] = [];
    for (const c of CABIN_CLASSES) {
      const s = f.offeredSeats[c];
      const sat = f.satisfaction[c];
      direct += f.passengers[c];
      transfer += f.transferPassengers[c];
      directRevenue += f.passengers[c] * f.fares[c];
      if (sat === undefined) continue;
      seats += s;
      weights.push({ satisfaction: sat, passengers: f.passengers[c] + f.transferPassengers[c], seats: s });
      classes[c] = {
        seatsPerWeek: s,
        passengers: f.passengers[c],
        transferPassengers: f.transferPassengers[c],
        fare: f.fares[c],
        directRevenue: f.passengers[c] * f.fares[c],
        loadFactor: loadFactor(f.passengers[c] + f.transferPassengers[c], s),
        satisfaction: sat,
      };
    }
    out.set(f.routeId, {
      figures: f,
      ageMonths: age,
      establishedBonus: establishedRouteBonus(age),
      flightTimeIndex: flightTimeIndex(f.blockMinutes),
      passengers: direct + transfer,
      directPassengers: direct,
      transferPassengers: transfer,
      transferRevenue: f.revenue - directRevenue,
      seatsPerWeek: seats,
      satisfaction: routeSatisfaction(weights),
      classes,
    });
  }
  return out;
}
