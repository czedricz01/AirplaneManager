/**
 * Balance-Skript (Paket 3.9a): Abschnitte 4 und 5 der Spezifikation – Preis, Erlös und Kosten typischer Strecken.
 *
 * Jede Strecke wird mit `monthOperations` gerechnet (dieselbe Rechnung wie Planer und Abschluss, R2). Der Preis ist
 * der gewinnbeste Preis je Klasse (`bestFareRatio` mit `routeClassPassengersAt`, 4.10), wie ihn der Planer mit
 * „Set best fares“ setzt.
 */

import { CABIN_CLASSES, FARE_RATIO_MAX, WEEKS_PER_MONTH, type CabinClass, type RivalPersonality } from '../model/constants';
import { breakEvenFareLevel, bestFareRatio, loadFactor, type BreakEvenClass, type PartialClassFigures } from '../model/fare';
import { newAircraftPrice } from '../model/fleet';
import { routeClassPassengersAt, type RouteFigures } from '../model/monthClose';
import { marketSize, worldScale } from '../model/demand';
import { musd, num, pct, usd, type Check, type Section, type Table } from './report';
import { catalogType, marketState, modelAirport, routeOf, runMarket, sampleMonth, seatsTotal, type MarketSpec, type OfferSpec } from './world';

/** Eine typische Strecke. */
export interface RouteCase {
  readonly label: string;
  readonly from: string;
  readonly to: string;
  readonly typeId: string;
  readonly year: number;
  /**
   * Abflüge je Woche (beide Richtungen). Im Bericht die Obergrenze: `bestDeparturesCase` wählt die gewinnbeste gerade
   * Zahl bis dahin („gut geführt“, Paket 3.9d).
   */
  readonly departures: number;
  readonly personality: RivalPersonality;
  /** Kurzstrecke (für die Landegebühr-Regel). */
  readonly short?: boolean;
}

export const ROUTE_CASES: readonly RouteCase[] = [
  { label: 'Caravelle III FRA–CDG 1962', from: 'FRA', to: 'CDG', typeId: 'caravelle-iii', year: 1962, departures: 14, personality: 'flag', short: true },
  { label: '707-320B FRA–JFK 1965', from: 'FRA', to: 'JFK', typeId: '707-320b', year: 1965, departures: 14, personality: 'flag' },
  { label: '727-200 FRA–MAD 1975', from: 'FRA', to: 'MAD', typeId: '727-200', year: 1975, departures: 14, personality: 'flag' },
  { label: 'ATR 72-200 HAM–NUE 1990', from: 'HAM', to: 'NUE', typeId: 'atr-72-200', year: 1990, departures: 14, personality: 'flag', short: true },
  { label: 'A320ceo FRA–MAD 1990', from: 'FRA', to: 'MAD', typeId: 'a320ceo', year: 1990, departures: 14, personality: 'flag' },
  { label: 'A320ceo FRA–MAD 1990 (LCC)', from: 'FRA', to: 'MAD', typeId: 'a320ceo', year: 1990, departures: 14, personality: 'lcc' },
  { label: 'A320ceo ATL–ORD 1990', from: 'ATL', to: 'ORD', typeId: 'a320ceo', year: 1990, departures: 14, personality: 'flag' },
  { label: 'A330-300 FRA–JFK 1995', from: 'FRA', to: 'JFK', typeId: 'a330-300', year: 1995, departures: 14, personality: 'flag' },
  { label: 'A320ceo FRA–MAD 2019', from: 'FRA', to: 'MAD', typeId: 'a320ceo', year: 2019, departures: 14, personality: 'flag' },
  { label: 'A330-300 FRA–JFK 2019', from: 'FRA', to: 'JFK', typeId: 'a330-300', year: 2019, departures: 14, personality: 'flag' },
  { label: '787-9 FRA–SIN 2019', from: 'FRA', to: 'SIN', typeId: '787-9', year: 2019, departures: 8, personality: 'flag' },
];

/** Die Strecke eines Falls als Markt mit einer Gesellschaft. */
export function caseMarket(c: RouteCase, fareRatios?: PartialClassFigures, departures = c.departures, demandScale = 1): MarketSpec {
  return {
    from: c.from,
    to: c.to,
    month: sampleMonth(c.year),
    demandScale,
    offers: [{ company: 'a', typeId: c.typeId, personality: c.personality, departures, fareRatios }],
  };
}

/**
 * Gewinnbestes Preisniveau je Klasse für die Gesellschaft `company` (alle anderen Angebote fest; 4.10).
 * Jede Klasse ist ein eigener Markt (3.7), daher je Klasse getrennt.
 */
export function bestFareRatios(market: MarketSpec, company: string): PartialClassFigures {
  const state = marketState(market);
  const route = routeOf(runMarket(market), company);
  const routeId = state.companies.find((c) => c.id === company)?.routes[0].id as string;
  const ratios: Partial<Record<CabinClass, number>> = {};
  for (const c of CABIN_CLASSES) {
    if (!(route.offeredSeats[c] > 0)) continue;
    const cost = route.costPerPassenger[c] ?? 0;
    ratios[c] = bestFareRatio((r) => routeClassPassengersAt(state, company, routeId, c, r), route.fares[c] / currentRatio(market, company, c), cost);
  }
  return ratios;
}

/** Eingestelltes Preisniveau einer Gesellschaft in Klasse `c` (fehlt = 1). */
function currentRatio(market: MarketSpec, company: string, c: CabinClass): number {
  return market.offers.find((o) => o.company === company)?.fareRatios?.[c] ?? 1;
}

/** Gewinnschwelle einer gerechneten Strecke bei Auslastung `load` (4.11). */
export function breakEven(route: RouteFigures, load: number, marketFares: Readonly<Record<CabinClass, number>>): number {
  const classes: Partial<Record<CabinClass, BreakEvenClass>> = {};
  for (const c of CABIN_CLASSES) {
    if (!(route.offeredSeats[c] > 0)) continue;
    classes[c] = { seatsPerWeek: route.offeredSeats[c], marketFare: marketFares[c], costPerPassenger: route.costPerPassenger[c] ?? 0 };
  }
  return breakEvenFareLevel(load, route.fixed.total, classes);
}

/** Marktpreise einer Strecke (Preis ÷ Preisniveau). */
function marketFaresOf(route: RouteFigures, ratios: PartialClassFigures): Record<CabinClass, number> {
  const out = {} as Record<CabinClass, number>;
  for (const c of CABIN_CLASSES) out[c] = route.fares[c] / (ratios[c] ?? 1);
  return out;
}

/** Ergebnis eines Falls. */
export interface CaseResult {
  readonly c: RouteCase;
  readonly marketSize: number;
  readonly seatsPerWeek: number;
  /** Auslastung beim Marktpreis (Preisniveau 1). */
  readonly loadAtMarket: number;
  /** Auslastung beim höchsten Preisniveau. */
  readonly loadAtMax: number;
  readonly best: PartialClassFigures;
  readonly route: RouteFigures;
  readonly load: number;
  readonly margin: number;
  readonly breakEvenFull: number;
  readonly breakEvenExpected: number;
  /** Jahre, bis das Ergebnis den Kaufpreis eines neuen Flugzeugs (mit Kabine) einspielt. */
  readonly paybackYears: number;
}

export function runCase(c: RouteCase, demandScale = 1): CaseResult {
  const month = sampleMonth(c.year);
  const size = demandScale * marketSize({ a: modelAirport(c.from), b: modelAirport(c.to), month, world: worldScale(month) });
  const atMarket = routeOf(runMarket(caseMarket(c, undefined, c.departures, demandScale)), 'a');
  const allMax = Object.fromEntries(CABIN_CLASSES.map((k) => [k, FARE_RATIO_MAX]));
  const atMax = routeOf(runMarket(caseMarket(c, allMax, c.departures, demandScale)), 'a');
  const best = bestFareRatios(caseMarket(c, undefined, c.departures, demandScale), 'a');
  const route = routeOf(runMarket(caseMarket(c, best, c.departures, demandScale)), 'a');
  const seats = seatsTotal(route.offeredSeats);
  const pax = (r: RouteFigures) => seatsTotal(r.passengers) + seatsTotal(r.transferPassengers);
  const load = loadFactor(pax(route), seats);
  const fares = marketFaresOf(route, best);
  const type = catalogType(c.typeId);
  const plane = marketState(caseMarket(c)).companies[0].aircraft[0];
  const price = newAircraftPrice(type.basePrice, plane.cabinListPrice1960, month);
  const yearly = route.result * WEEKS_PER_MONTH * 12;
  return {
    c,
    marketSize: size,
    seatsPerWeek: seats,
    loadAtMarket: loadFactor(pax(atMarket), seatsTotal(atMarket.offeredSeats)),
    loadAtMax: loadFactor(pax(atMax), seatsTotal(atMax.offeredSeats)),
    best,
    route,
    load,
    margin: route.result / route.revenue,
    breakEvenFull: breakEven(route, 1, fares),
    breakEvenExpected: breakEven(route, load, fares),
    paybackYears: yearly > 0 ? price / yearly : Number.POSITIVE_INFINITY,
  };
}

/**
 * Der Fall mit der gewinnbesten geraden Abflugzahl von 2 bis `c.departures` (jeweils beim besten Preis): Eine gut
 * geführte Strecke wählt auch die Zahl der Flüge (Paket 3.9d, nach der kleineren Marktgröße aus E67, E70).
 */
export function bestDeparturesCase(c: RouteCase, demandScale = 1): RouteCase {
  let best = c;
  let bestResult = Number.NEGATIVE_INFINITY;
  for (let departures = 2; departures <= c.departures; departures += 2) {
    const candidate = { ...c, departures };
    const ratios = bestFareRatios(caseMarket(candidate, undefined, departures, demandScale), 'a');
    const result = routeOf(runMarket(caseMarket(candidate, ratios, departures, demandScale)), 'a').result;
    if (result > bestResult) {
      best = candidate;
      bestResult = result;
    }
  }
  return best;
}

/** Die typischen Strecken des Berichts: je Fall die gewinnbeste Abflugzahl beim besten Preis. */
export function routeCaseResults(cases: readonly RouteCase[] = ROUTE_CASES): CaseResult[] {
  return cases.map((c) => runCase(bestDeparturesCase(c)));
}

const ratioText = (r: PartialClassFigures) =>
  CABIN_CLASSES.filter((c) => r[c] !== undefined).map((c) => num(r[c] as number, 2)).join(' / ');

// ---------------------------------------------------------------------------
// Preiskampf zweier gleicher Gesellschaften (4.10, 7.6)
// ---------------------------------------------------------------------------

/** Ergebnis der wechselseitigen besten Antworten. */
export interface PriceDuel {
  readonly departures: number;
  /** Preisniveau Economy nach jeder Runde (Gesellschaft a). */
  readonly path: readonly number[];
  readonly converged: boolean;
  /** Die Preise springen zwischen zwei Werten hin und her (Zyklus der Länge 2). */
  readonly cycle: boolean;
  readonly final: PartialClassFigures;
  readonly route: RouteFigures;
  readonly breakEvenFull: number;
  readonly firstAnswer: number;
}

/**
 * Zwei gleiche Gesellschaften auf einem Paar antworten abwechselnd mit dem besten Preis auf den Preis der anderen
 * (Optimizer, 4.10). Start beim Marktpreis; Ende, wenn sich kein Preis mehr um mehr als 0,002 ändert.
 */
export function priceDuel(base: Omit<MarketSpec, 'offers'>, offer: Omit<OfferSpec, 'company' | 'fareRatios'>, rounds = 30): PriceDuel {
  let a: PartialClassFigures = {};
  let b: PartialClassFigures = {};
  const market = (): MarketSpec => ({ ...base, offers: [{ ...offer, company: 'a', fareRatios: a }, { ...offer, company: 'b', fareRatios: b }] });
  const path: number[] = [];
  let converged = false;
  let cycle = false;
  let firstAnswer = Number.NaN;
  for (let k = 0; k < rounds; k++) {
    const nextA = bestFareRatios(market(), 'a');
    if (k === 0) firstAnswer = nextA.economy ?? Number.NaN;
    const changeA = maxChange(a, nextA);
    a = nextA;
    const nextB = bestFareRatios(market(), 'b');
    const changeB = maxChange(b, nextB);
    b = nextB;
    path.push(a.economy ?? Number.NaN);
    if (k > 0 && changeA < 0.002 && changeB < 0.002) {
      converged = true;
      break;
    }
    if (k >= 3 && Math.abs(path[k] - path[k - 2]) < 0.002 && Math.abs(path[k - 1] - path[k - 3]) < 0.002) {
      cycle = true;
      break;
    }
  }
  const route = routeOf(runMarket(market()), 'a');
  return { departures: offer.departures, path, converged, cycle, final: a, route, breakEvenFull: breakEven(route, 1, marketFaresOf(route, a)), firstAnswer };
}

function maxChange(before: PartialClassFigures, after: PartialClassFigures): number {
  let m = 0;
  for (const c of CABIN_CLASSES) {
    if (after[c] === undefined) continue;
    m = Math.max(m, Math.abs((after[c] as number) - (before[c] ?? 1)));
  }
  return m;
}

// ---------------------------------------------------------------------------
// Abschnitte
// ---------------------------------------------------------------------------

/**
 * Prüfregel B4.2 (E103): Der tiefste Preis im Preis-Duell muss mindestens bei diesem Anteil der Gewinnschwelle
 * voller Maschine liegen („kein Lauf gegen 0“). Kein Preis-Boden im Modell, nur die Grenze der Prüfung.
 */
export const DUEL_FLOOR_SHARE = 0.9;

/** Faktoren auf die Marktgröße für die Empfindlichkeits-Tabelle (wie ein kleineres `DEMAND_SCALE`). */
export const DEMAND_SCALES = [1, 0.5, 0.25, 0.1];

/** Fälle der Empfindlichkeits-Tabelle. */
export const SENSITIVITY_CASES: readonly string[] = ['ATR 72-200 HAM–NUE 1990', 'A320ceo FRA–MAD 1990', 'A330-300 FRA–JFK 1995'];

/** Bester Preis, Auslastung und Marge je Fall und Faktor auf die Marktgröße. */
export function scaleSensitivity(scales: readonly number[] = DEMAND_SCALES, labels: readonly string[] = SENSITIVITY_CASES): CaseResult[][] {
  return labels.map((label) => {
    const c = ROUTE_CASES.find((x) => x.label === label) as RouteCase;
    return scales.map((scale) => runCase(c, scale));
  });
}

/** Abschnitt 4 (Preis) und 5 (Kosten) aus denselben Fällen. */
export function routeSections(
  results: readonly CaseResult[] = routeCaseResults(),
  duels: readonly PriceDuel[] = defaultDuels(),
  sensitivity: readonly (readonly CaseResult[])[] = scaleSensitivity(),
): Section[] {
  // ---- Abschnitt 4 ----
  const priceRows = results.map((r) => [
    r.c.label,
    num(r.marketSize),
    String(r.c.departures),
    num(r.seatsPerWeek),
    pct(r.loadAtMarket),
    pct(r.loadAtMax),
    ratioText(r.best),
    pct(r.load),
    num(r.breakEvenFull, 2),
    num(r.breakEvenExpected, 2),
  ]);
  const priceTable: Table = {
    title: 'Preis und Auslastung typischer Strecken (eine Gesellschaft, Mai)',
    header: ['Strecke', 'Marktgröße', 'Abflüge je Woche', 'Sitze je Woche', 'Auslastung bei Marktpreis', `Auslastung bei Preisniveau ${num(FARE_RATIO_MAX)}`, 'Bester Preis (Niveau je Klasse)', 'Auslastung beim besten Preis', 'Gewinnschwelle voll', 'Gewinnschwelle bei dieser Auslastung'],
    rows: priceRows,
    note: 'Bester Preis nach 4.10 (gewinnbest, Kosten je Fluggast abgezogen). Abflüge: gewinnbeste gerade Zahl bis 14 (787-9: 8) beim besten Preis (`bestDeparturesCase`). Gewinnschwelle als Preisniveau für alle Klassen (4.11).',
  };

  const fullAtMax = results.filter((r) => r.loadAtMax > 0.99);
  const priceChecks: Check[] = [
    {
      id: 'B4.1',
      spec: '3.6, 4.10',
      rule: 'Marktgröße gegenüber einem Flugzeug: Strecken, die selbst beim höchsten Preisniveau voll bleiben (Hinweis aus 3.8b)',
      value: fullAtMax.length === 0 ? 'keine' : `${fullAtMax.length} von ${results.length}: ${fullAtMax.map((r) => r.c.label).join('; ')}`,
      verdict: 'info',
    },
  ];

  const duelRows: string[][] = [];
  for (const d of duels) {
    duelRows.push([
      String(d.departures),
      num(d.firstAnswer, 2),
      d.path.map((x) => num(x, 2)).join(' → '),
      d.converged ? 'ja' : d.cycle ? 'nein, Zyklus' : 'nein',
      ratioText(d.final),
      num(d.breakEvenFull, 2),
      pct(loadFactor(seatsTotal(d.route.passengers), seatsTotal(d.route.offeredSeats))),
      usd(d.route.result),
    ]);
  }
  const lowest = (d: PriceDuel) => Math.min(...d.path, d.final.economy ?? Number.NaN);
  priceChecks.push({
    id: 'B4.2',
    spec: '4.10, 7.6, E103',
    rule: `Wechselseitige beste Antworten zweier gleicher Gesellschaften laufen nicht gegen 0: tiefster Preis ≥ ${pct(DUEL_FLOOR_SHARE)} der Gewinnschwelle voller Maschine; mit einem Flugzeug je Gesellschaft (erster Fall) auch Ergebnis > 0. Ein Verlust mit mehr Sitzen, als der Markt füllt, kommt aus der Überkapazität, nicht aus dem Unterbieten (Paket 3.9d, E103)`,
    value: duels.map((d) => `${d.departures} Abflüge: tiefster Preis Y ${num(lowest(d), 2)}, Schwelle ${num(d.breakEvenFull, 2)} (${pct(lowest(d) / d.breakEvenFull)}), Ergebnis ${usd(d.route.result)}`).join('; '),
    verdict: duels.every((d) => lowest(d) >= DUEL_FLOOR_SHARE * d.breakEvenFull) && (duels[0]?.route.result ?? 0) > 0 ? 'ok' : 'abweichung',
  });
  priceChecks.push({
    id: 'B4.3',
    spec: '7.6',
    rule: 'Enden die besten Antworten in einem festen Punkt? Nicht verlangt (7.6, E65); verlangt ist B4.2',
    value: duels.map((d) => `${d.departures} Abflüge: ${d.converged ? 'fest' : d.cycle ? 'Zyklus' : 'nicht fest'}`).join('; '),
    verdict: 'info',
  });
  priceChecks.push({
    id: 'B4.4',
    spec: '4.10',
    rule: 'Bester Preis gegen einen gleichen Rivalen beim Marktpreis (Hinweis 4.10: 70 % des Marktpreises)',
    value: duels.map((d) => `${d.departures} Abflüge: ${num(d.firstAnswer, 2)}`).join('; '),
    verdict: 'info',
  });
  const duelTable: Table = {
    title: 'Preiskampf: zwei gleiche Gesellschaften (A320ceo, Flag-Ausstattung) auf FRA–MAD 1990, abwechselnd bester Preis',
    header: ['Abflüge je Gesellschaft', 'Erste Antwort Y', 'Verlauf Y (Gesellschaft a)', 'fest', 'Endpreis (Niveau je Klasse)', 'Gewinnschwelle voll', 'Auslastung', 'Ergebnis je Woche'],
    rows: duelRows,
    note: 'Jede Runde: a antwortet auf b, dann b auf a (`bestFareRatios`). 14 Abflüge = ein Flugzeug, 28 = zwei Flugzeuge je Gesellschaft (eine Strecke, mehr Sitze als der Markt füllt; bis Paket 3.9d 56 = vier Flugzeuge, bei der kleineren Marktgröße nur noch Überkapazität).',
  };

  // ---- Abschnitt 5 ----
  const costRows = results.map((r) => {
    const cost = r.route.passengerCost.total + r.route.fixed.total;
    const f = r.route.fixed;
    return [
      r.c.label,
      usd(r.route.revenue),
      usd(cost),
      usd(r.route.result),
      pct(r.margin),
      pct(f.fuel / cost),
      pct(f.landing / cost),
      pct(r.route.passengerCost.fees / cost),
      pct(r.route.passengerCost.catering / cost),
      pct(f.crew / cost),
      pct(f.aircraftShare / cost),
      pct(f.slotShare / cost),
      Number.isFinite(r.paybackYears) ? num(r.paybackYears, 1) : '–',
    ];
  });
  const costTable: Table = {
    title: 'Erlös, Kosten und Ergebnis je Woche beim besten Preis',
    header: ['Strecke', 'Erlös', 'Kosten', 'Ergebnis', 'Marge', 'Treibstoff', 'Landung', 'Gebühren je Fluggast', 'Verpflegung', 'Besatzung', 'Flugzeug-Anteil', 'Slots', 'Jahre bis Kaufpreis'],
    rows: costRows,
    note: 'Anteile an den Kosten der Strecke (5.9). „Jahre bis Kaufpreis“ = Neupreis mit Kabine ÷ Jahresergebnis (`WEEKS_PER_MONTH` × 12 Wochen).',
  };

  const short = results.filter((r) => r.c.short);
  const landingShares = short.map((r) => r.route.fixed.landing / (r.route.passengerCost.total + r.route.fixed.total));
  const longHaul = results.filter((r) => r.c.to === 'JFK' || r.c.to === 'SIN');
  const shortMedium = results.filter((r) => !(r.c.to === 'JFK' || r.c.to === 'SIN'));
  const avg = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const costChecks: Check[] = [
    {
      id: 'B5.1',
      spec: '5.5',
      rule: 'Landegebühr auf Kurzstrecke 26–40 % der Kosten (Hinweis 5.5 / 5.18)',
      value: short.map((r, i) => `${r.c.label}: ${pct(landingShares[i])}`).join('; '),
      verdict: landingShares.every((s) => s >= 0.26 && s <= 0.4) ? 'ok' : 'abweichung',
    },
    {
      id: 'B5.2',
      spec: '5.18',
      rule: 'Marge beim besten Preis: Langstrecke gegenüber Kurz- und Mittelstrecke (Hinweis 5.18: Langstrecke sehr einträglich)',
      value: `Lang Ø ${pct(avg(longHaul.map((r) => r.margin)))}, kurz/mittel Ø ${pct(avg(shortMedium.map((r) => r.margin)))}`,
      verdict: 'info',
    },
    {
      id: 'B5.3',
      spec: '5.6',
      rule: 'Check-in und Abfertigung ohne Bodenpersonal-Aufschlag: Anteil an den Kosten (heute mit Bodenpersonal 2–4 % mehr)',
      value: `${pct(Math.min(...results.map((r) => r.route.passengerCost.fees / (r.route.passengerCost.total + r.route.fixed.total))))} … ${pct(Math.max(...results.map((r) => r.route.passengerCost.fees / (r.route.passengerCost.total + r.route.fixed.total))))}`,
      verdict: 'info',
    },
    {
      id: 'B5.4',
      spec: '5.13, E54',
      rule: 'Listenpreise und Abschreibung: Jahre, bis eine Strecke den Kaufpreis eines neuen Flugzeugs einspielt',
      value: `${num(Math.min(...results.map((r) => r.paybackYears)), 1)} … ${num(Math.max(...results.filter((r) => Number.isFinite(r.paybackYears)).map((r) => r.paybackYears)), 1)} Jahre`,
      verdict: 'info',
    },
  ];

  const sensitivityTable: Table = {
    title: 'Empfindlichkeit: Marktgröße × Faktor (wie ein kleineres `DEMAND_SCALE`), ein Flugzeug allein',
    header: ['Strecke', ...DEMAND_SCALES.map((f) => `× ${num(f, 2)}: Preis Y / Auslastung / Marge`)],
    rows: sensitivity.map((row) => [
      row[0].c.label,
      ...row.map((r) => `${num(r.best.economy ?? Number.NaN, 2)} / ${pct(r.load)} / ${pct(r.margin)}`),
    ]),
    note: 'Der Faktor wirkt als weltweites Ereignis im Beispiel-Spielstand (3.5), also genau wie eine andere Marktgröße; keine Konstante wird geändert.',
  };
  const mid = sensitivity.find((row) => row[0].c.label === 'A320ceo FRA–MAD 1990');
  if (mid) {
    priceChecks.push({
      id: 'B4.5',
      spec: '3.6, 4.10',
      rule: 'Empfindlichkeit: bester Preis Y eines A320ceo allein auf FRA–MAD 1990 bei kleinerer Marktgröße',
      value: mid.map((r, i) => `× ${num(DEMAND_SCALES[i], 2)}: ${num(r.best.economy ?? Number.NaN, 2)}`).join('; '),
      verdict: 'info',
    });
  }

  const lcc = results.find((r) => r.c.label === 'A320ceo FRA–MAD 1990 (LCC)');
  const flag = results.find((r) => r.c.label === 'A320ceo FRA–MAD 1990');
  costChecks.push({
    id: 'B5.5',
    spec: 'E7',
    rule: 'Eine gut geführte Strecke jeder Länge bringt in jedem Jahrzehnt Gewinn (alle Fälle beim besten Preis)',
    value: `${results.filter((r) => r.route.result > 0).length} von ${results.length} mit Gewinn`,
    verdict: results.every((r) => r.route.result > 0) ? 'ok' : 'abweichung',
  });
  if (lcc && flag) {
    costChecks.push({
      id: 'B5.6',
      spec: '7.4, E45',
      rule: 'Vorschau „ähnlicher Erfolg“: Ergebnis LCC ÷ Flag mit demselben Flugzeug allein auf derselben Strecke',
      value: `A320ceo FRA–MAD 1990: ${num(lcc.route.result / flag.route.result, 2)} (Marge ${pct(lcc.margin)} gegen ${pct(flag.margin)})`,
      verdict: 'info',
    });
  }

  const priceSection: Section = { title: 'Abschnitt 4: Preis und Erlös', checks: priceChecks, tables: [priceTable, sensitivityTable, duelTable] };
  const costSection: Section = {
    title: 'Abschnitt 5: Kosten',
    checks: costChecks,
    tables: [costTable, { title: 'Kaufpreise', header: ['Strecke', 'Neupreis mit Kabine'], rows: results.map((r) => [r.c.label, musd(newAircraftPrice(catalogType(r.c.typeId).basePrice, marketState(caseMarket(r.c)).companies[0].aircraft[0].cabinListPrice1960, sampleMonth(r.c.year)))]) }],
  };
  return [priceSection, costSection];
}

/** Die beiden Preiskampf-Fälle: ein Flugzeug (Sitze knapp) und vier (Sitze reichlich) je Gesellschaft. */
export function defaultDuels(): PriceDuel[] {
  const base = { from: 'FRA', to: 'MAD', month: sampleMonth(1990) };
  return [14, 28].map((departures) => priceDuel(base, { typeId: 'a320ceo', personality: 'flag', departures }));
}
