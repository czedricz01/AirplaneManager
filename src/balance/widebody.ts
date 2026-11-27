/**
 * Balance-Skript (Paket 5.3e, O79 → E84): Warum kauft die KI keinen Widebody?
 *
 * Für die größten Langstrecken-Paare zwischen Flughäfen, an denen Widebody-Slots möglich sind (E78), rechnet das
 * Skript je lieferbarem Narrowbody und Widebody, was die KI vor einem Kauf rechnet (7.9, 7.11, E81): eine neue Strecke
 * mit einem neuen Flugzeug dieses Typs (Kabine nach 7.5), Anlauf vorbei (`RAMP_MONTHS`), Preisniveau einer neuen
 * KI-Strecke (7.6, aus der Satisfaction bei den höchsten Umläufen), Flugzahlen aus `planFrequencies`, Planer-Hauptzahl
 * (`plannerRouteResult`, 4.12) und Gewinn nach Kapitalkosten (`profitAfterCapital`). Die Gesellschaft fliegt das Paar
 * allein (wie die KI fast immer, Fund 49). Kein Spielcode; keine Regel wird geändert.
 */

import { aircraftList } from '../data/aircraft';
import { airportsData } from '../data/airports';
import {
  CABIN_CLASSES,
  LONG_HAUL_KM,
  RAMP_MONTHS,
  SCALES,
  WIDEBODY_SLOTS_MIN_AIRPORT_SIZE,
  type AircraftClass,
  type CabinClass,
  type RivalPersonality,
} from '../model/constants';
import { distanceKm, marketSize, worldScale } from '../model/demand';
import type { PartialClassFigures } from '../model/fare';
import { newAircraftPrice } from '../model/fleet';
import { plannerRouteFigures, plannerRouteResult, type CatalogType, type RouteFigures } from '../model/monthClose';
import { isOnMarket, rivalAircraft, rivalFareRatio, rivalTargetFareRatio } from '../model/rivals';
import { planFrequencies, profitAfterCapital, rivalMaxRotations, runwayFits } from '../model/rivalMonth';
import { satisfactionFactor } from '../model/satisfaction';
import { musd, num, pct, type Check, type Section, type Table } from './report';
import { marketState, modelAirport, pairKm, sampleMonth, seatsTotal } from './world';

/** Ein Städtepaar mit Entfernung und Marktgröße. */
export interface LongPair {
  readonly from: string;
  readonly to: string;
  readonly km: number;
  readonly marketSize: number;
}

/**
 * Die `count` größten Paare (Marktgröße im Mai des Jahres) zwischen Flughäfen ab Größe
 * `WIDEBODY_SLOTS_MIN_AIRPORT_SIZE` mit einer Entfernung über `minKm`.
 */
export function largestLongPairs(year: number, count: number, minKm: number = LONG_HAUL_KM): LongPair[] {
  const month = sampleMonth(year);
  const world = worldScale(month);
  const ids = airportsData.filter((a) => a.level >= WIDEBODY_SLOTS_MIN_AIRPORT_SIZE).map((a) => a.id);
  const airports = ids.map(modelAirport);
  const pairs: LongPair[] = [];
  for (let i = 0; i < airports.length; i++) {
    for (let j = i + 1; j < airports.length; j++) {
      const km = distanceKm(airports[i].coords, airports[j].coords);
      if (km <= minKm) continue;
      pairs.push({ from: airports[i].id, to: airports[j].id, km, marketSize: marketSize({ a: airports[i], b: airports[j], month, world }) });
    }
  }
  return pairs.sort((a, b) => b.marketSize - a.marketSize || (a.from + a.to < b.from + b.to ? -1 : 1)).slice(0, count);
}

/** Bewertung eines Typs auf einem Paar, wie die KI vor dem Kauf rechnet. */
export interface TypeOnPair {
  readonly typeId: string;
  readonly cls: AircraftClass;
  /** Eingebaute Sitze (Kabine nach 7.5). */
  readonly seats: number;
  /** Höchste Umläufe je Woche (`rivalMaxRotations`). */
  readonly maxRotations: number;
  /** Gewählte Umläufe (beste aus `planFrequencies`). */
  readonly rotations: number;
  /** Planer-Hauptzahl je Monat. */
  readonly expectedProfit: number;
  /** Kaufpreis mit Kabine (`newAircraftPrice`). */
  readonly price: number;
  /** `profitAfterCapital(expectedProfit, price)`. */
  readonly value: number;
  /** Auslastung beim gewählten Plan. */
  readonly load: number;
}

const passengersOf = (r: RouteFigures) => seatsTotal(r.passengers) + seatsTotal(r.transferPassengers);

/** Rechnet einen Typ auf einem Paar wie die KI (siehe Kopf der Datei). */
export function typeOnPair(pair: Pick<LongPair, 'from' | 'to'>, type: CatalogType, year: number, personality: RivalPersonality): TypeOnPair {
  const month = sampleMonth(year);
  const plane = rivalAircraft(personality, type, month, 'probe');
  const cls = type.class as AircraftClass;
  const km = pairKm(pair.from, pair.to);
  const maxRotations = rivalMaxRotations(km, type.cruiseSpeed, cls);
  const state = (f: number, fareRatios: PartialClassFigures = {}) =>
    marketState({ from: pair.from, to: pair.to, month, offers: [{ company: 'a', typeId: type.id, personality, departures: 2 * f, ageMonths: RAMP_MONTHS, fareRatios }] });
  // Preisniveau einer neuen KI-Strecke (7.6): aus der Satisfaction bei den höchsten Umläufen, Lage 0, kein Preiskampf.
  const probe = plannerRouteFigures(state(maxRotations), 'a', 'a-r', 2 * maxRotations);
  const fares: Partial<Record<CabinClass, number>> = {};
  for (const c of CABIN_CLASSES) {
    if (!((plane.seats[c] ?? 0) > 0)) continue;
    const factor = satisfactionFactor(probe.satisfaction[c] ?? SCALES.satisfaction.neutral);
    fares[c] = rivalFareRatio({ personality, target: rivalTargetFareRatio(personality, factor, factor), yieldPosition: 0, priceWar: false, breakEvenFull: 0 });
  }
  let rotations = 0;
  let expectedProfit = Number.NEGATIVE_INFINITY;
  for (const f of planFrequencies(maxRotations)) {
    const profit = plannerRouteResult(state(f, fares), 'a', 'a-r', 2 * f);
    if (profit > expectedProfit) {
      rotations = f;
      expectedProfit = profit;
    }
  }
  const figures = plannerRouteFigures(state(rotations, fares), 'a', 'a-r', 2 * rotations);
  const price = newAircraftPrice(plane.listPrice1960, plane.cabinListPrice1960, month);
  return {
    typeId: type.id,
    cls,
    seats: seatsTotal(plane.seats),
    maxRotations,
    rotations,
    expectedProfit,
    price,
    value: profitAfterCapital(expectedProfit, price),
    load: passengersOf(figures) / seatsTotal(figures.offeredSeats),
  };
}

/** Bester Narrowbody und bester Widebody eines Paars (nach `value`); `null`, wenn keiner der Bauart passt. */
export interface PairChoice {
  readonly pair: LongPair;
  readonly year: number;
  readonly narrow: TypeOnPair | null;
  readonly wide: TypeOnPair | null;
}

/** Lieferbare Typen einer Bauart, die Reichweite und Pisten beider Enden erfüllen (wie `pickPurchaseType`). */
function fittingTypes(pair: LongPair, year: number, cls: AircraftClass): CatalogType[] {
  const month = sampleMonth(year);
  const a = modelAirport(pair.from);
  const b = modelAirport(pair.to);
  return aircraftList.filter(
    (t) => t.class === cls && isOnMarket(t, month) && t.maxRange >= pair.km && runwayFits(t.icaoCode, a.maxIcaoCode) && runwayFits(t.icaoCode, b.maxIcaoCode),
  );
}

const bestOf = (xs: readonly TypeOnPair[]) => (xs.length === 0 ? null : xs.reduce((best, x) => (x.value > best.value ? x : best)));

export function pairChoice(pair: LongPair, year: number, personality: RivalPersonality): PairChoice {
  const rate = (cls: AircraftClass) => bestOf(fittingTypes(pair, year, cls).map((t) => typeOnPair(pair, t, year, personality)));
  return { pair, year, narrow: rate('Narrowbody'), wide: rate('Widebody') };
}

/** Kosten je Woche eines Typs auf einem Paar beim Marktpreis, bei halben und bei den höchsten Umläufen. */
export interface SeatCostRow {
  readonly typeId: string;
  readonly cls: AircraftClass;
  readonly rotations: number;
  readonly maxRotations: number;
  readonly seatsPerWeek: number;
  readonly passengers: number;
  readonly fuelPerSeat: number;
  readonly crewLandingPerSeat: number;
  readonly aircraftPerSeat: number;
  readonly fixedPerSeat: number;
  readonly result: number;
}

export function seatCostRows(from: string, to: string, year: number, typeIds: readonly string[], personality: RivalPersonality = 'flag'): SeatCostRow[] {
  const month = sampleMonth(year);
  const km = pairKm(from, to);
  const rows: SeatCostRow[] = [];
  for (const id of typeIds) {
    const type = aircraftList.find((t) => t.id === id);
    if (!type) throw new Error(`Flugzeugtyp ${id} fehlt`);
    const cls = type.class as AircraftClass;
    const maxRotations = rivalMaxRotations(km, type.cruiseSpeed, cls);
    for (const f of [Math.round(maxRotations / 2), maxRotations]) {
      const state = marketState({ from, to, month, offers: [{ company: 'a', typeId: id, personality, departures: 2 * f, ageMonths: RAMP_MONTHS }] });
      const r = plannerRouteFigures(state, 'a', 'a-r', 2 * f);
      const seats = seatsTotal(r.offeredSeats);
      rows.push({
        typeId: id,
        cls,
        rotations: f,
        maxRotations,
        seatsPerWeek: seats,
        passengers: passengersOf(r),
        fuelPerSeat: r.fixed.fuel / seats,
        crewLandingPerSeat: (r.fixed.crew + r.fixed.landing) / seats,
        aircraftPerSeat: r.fixed.aircraftShare / seats,
        fixedPerSeat: r.fixed.total / seats,
        result: r.result,
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Abschnitt
// ---------------------------------------------------------------------------

/** Jahre und Paare der Messung (O79: die 20 größten Langstrecken-Paare ab 1990). */
export const WIDEBODY_YEARS = [1990, 2000, 2010];
export const WIDEBODY_PAIRS = 20;
/** Paare jenseits der Reichweite fast aller Narrowbodies: Entfernung über diesem Wert. */
export const ULTRA_LONG_KM = 7500;
export const ULTRA_LONG_PAIRS = 10;
/** Beispiel für die Kosten je Sitz. */
export const SEAT_COST_CASE = { from: 'LHR', to: 'JFK', year: 2000, types: ['737-700', 'a321ceo', '767-300er', 'a330-300', '777-200er'] };

export interface WidebodyData {
  readonly long: readonly PairChoice[];
  readonly ultra: readonly PairChoice[];
  readonly seatCost: readonly SeatCostRow[];
}

export function widebodyData(
  years: readonly number[] = WIDEBODY_YEARS,
  pairs = WIDEBODY_PAIRS,
  ultraPairs = ULTRA_LONG_PAIRS,
  personality: RivalPersonality = 'flag',
): WidebodyData {
  const choices = (minKm: number, count: number) => years.flatMap((y) => largestLongPairs(y, count, minKm).map((p) => pairChoice(p, y, personality)));
  return {
    long: choices(LONG_HAUL_KM, pairs),
    ultra: choices(ULTRA_LONG_KM, ultraPairs),
    seatCost: seatCostRows(SEAT_COST_CASE.from, SEAT_COST_CASE.to, SEAT_COST_CASE.year, SEAT_COST_CASE.types, personality),
  };
}

const typeText = (t: TypeOnPair | null) => (t ? `${t.typeId} (${t.seats} Sitze, ${t.rotations}/${t.maxRotations} Umläufe, ${pct(t.load)})` : '–');
const money = (t: TypeOnPair | null, pick: (t: TypeOnPair) => number) => (t ? musd(pick(t), 2) : '–');

function choiceTable(title: string, rows: readonly PairChoice[], note: string): Table {
  return {
    title,
    header: ['Jahr', 'Paar', 'km', 'Marktgröße', 'Narrowbody', 'Planer-Zahl', 'nach Zins', 'Widebody', 'Planer-Zahl', 'nach Zins', 'besser'],
    rows: rows.map((c) => [
      String(c.year),
      `${c.pair.from}–${c.pair.to}`,
      num(c.pair.km),
      num(c.pair.marketSize),
      typeText(c.narrow),
      money(c.narrow, (t) => t.expectedProfit),
      money(c.narrow, (t) => t.value),
      typeText(c.wide),
      money(c.wide, (t) => t.expectedProfit),
      money(c.wide, (t) => t.value),
      winner(c),
    ]),
    note,
  };
}

/** Welche Bauart vorn liegt (nach Gewinn nach Kapitalkosten). */
export function winner(c: PairChoice): 'Narrowbody' | 'Widebody' | '–' {
  if (!c.narrow && !c.wide) return '–';
  if (!c.wide) return 'Narrowbody';
  if (!c.narrow) return 'Widebody';
  return c.wide.value > c.narrow.value ? 'Widebody' : 'Narrowbody';
}

export function widebodySection(data: WidebodyData = widebodyData()): Section {
  const count = (rows: readonly PairChoice[], pick: (c: PairChoice) => boolean) => rows.filter(pick).length;
  const both = data.long.filter((c) => c.narrow && c.wide);
  const wideBeforeCapital = count(both, (c) => (c.wide as TypeOnPair).expectedProfit > (c.narrow as TypeOnPair).expectedProfit);
  const wideAfterCapital = count(both, (c) => (c.wide as TypeOnPair).value > (c.narrow as TypeOnPair).value);
  const ultraWide = data.ultra.filter((c) => winner(c) === 'Widebody');
  const ultraPositive = ultraWide.filter((c) => (c.wide as TypeOnPair).value > 0);
  const checks: Check[] = [
    {
      id: 'B7.13',
      spec: '7.11, E81, E84, E85',
      rule: `Größte Langstrecken-Paare (über ${num(LONG_HAUL_KM)} km, beide Flughäfen ab Größe ${WIDEBODY_SLOTS_MIN_AIRPORT_SIZE}): bringt der beste Widebody der KI mehr als der beste Narrowbody?`,
      value: `${wideBeforeCapital} von ${both.length} Paaren vor Kapitalkosten (Planer-Zahl), ${wideAfterCapital} von ${both.length} nach Kapitalkosten (${WIDEBODY_YEARS.join(', ')}, je ${WIDEBODY_PAIRS} Paare)`,
      verdict: 'info',
    },
    {
      id: 'B7.14',
      spec: '7.11, E81, E84, E85',
      rule: `Paare über ${num(ULTRA_LONG_KM)} km (fast nur Widebodies haben die Reichweite): Widebody vorn und nach Kapitalkosten mit Gewinn`,
      value: `Widebody vorn auf ${ultraWide.length} von ${data.ultra.length} Paaren, davon mit Gewinn nach Kapitalkosten ${ultraPositive.length}`,
      verdict: 'info',
    },
  ];
  const seatTable: Table = {
    title: `Kosten je Sitz und Woche: ${SEAT_COST_CASE.from}–${SEAT_COST_CASE.to} ${SEAT_COST_CASE.year}, ein Flugzeug allein, Marktpreis`,
    header: ['Typ', 'Bauart', 'Umläufe', 'Sitze je Woche', 'Fluggäste', 'Treibstoff je Sitz', 'Besatzung + Landung je Sitz', 'Flugzeug-Anteil je Sitz', 'feste Kosten je Sitz', 'Ergebnis je Woche'],
    rows: data.seatCost.map((r) => [
      r.typeId,
      r.cls,
      `${r.rotations}/${r.maxRotations}`,
      num(r.seatsPerWeek),
      num(r.passengers),
      num(r.fuelPerSeat),
      num(r.crewLandingPerSeat),
      num(r.aircraftPerSeat),
      num(r.fixedPerSeat),
      musd(r.result, 2),
    ]),
    note: 'Treibstoff je Sitz hängt nur an der Effizienz des Typs (5.3, `fuelLitresPerSeat100km`), nicht an der Größe. Der Flugzeug-Anteil (Unterhalt + Abschreibung, 5.9) ist je Woche fest; fliegt ein Widebody nur die Hälfte der Umläufe, trägt jeder Sitz das Doppelte.',
  };
  return {
    title: 'Abschnitt 7: Flugzeugwahl der KI auf Langstrecke (O79)',
    checks,
    tables: [
      choiceTable(
        `Die ${WIDEBODY_PAIRS} größten Langstrecken-Paare je Jahr: bester Narrowbody gegen besten Widebody (Flag-Ausstattung)`,
        data.long,
        'Je Typ: neues Flugzeug mit Kabine nach 7.5, Strecke nach dem Anlauf, Preisniveau einer neuen KI-Strecke (7.6), beste Flugzahl aus `planFrequencies` (100 / 60 / 30 % der höchsten Umläufe), Planer-Hauptzahl je Monat (4.12); „nach Zins“ = `profitAfterCapital` (8 % je Jahr auf den Kaufpreis, E81). Bester Typ je Bauart nach „nach Zins“. Marktgröße = Fluggäste je Woche, beide Richtungen. Die Gesellschaft fliegt das Paar allein.',
      ),
      choiceTable(
        `Die ${ULTRA_LONG_PAIRS} größten Paare über ${num(ULTRA_LONG_KM)} km je Jahr`,
        data.ultra,
        'Wie oben. „–“ = kein lieferbarer Typ der Bauart mit dieser Reichweite.',
      ),
      seatTable,
    ],
  };
}
