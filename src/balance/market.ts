/**
 * Balance-Skript (Paket 3.9a): Abschnitte 1–3 der Spezifikation – Zeit und Geld, Zufriedenheit, Nachfrage.
 */

import { airportsData } from '../data/airports';
import { costIndex, difficultyFactor } from '../model/basics';
import { CABIN_CLASSES, type CabinClass, type RivalPersonality } from '../model/constants';
import { fuelTable } from '../model/costs';
import {
  blockMinutes,
  classShares,
  demandGrowth,
  distanceFactor,
  marketSizeParts,
  referenceBlockMinutes,
  worldScale,
  type MarketAirport,
} from '../model/demand';
import { marketFare } from '../model/fare';
import { flightTimeFactor } from '../model/marketSplit';
import { flightTimeIndex, maxServiceShortfall, satisfactionFactor } from '../model/satisfaction';
import { num, pct, usd, type Check, type Section, type Table } from './report';
import { NEUTRAL_INPUTS, catalogType, modelAirport, monthOf, pairKm, routeOf, runMarket, sampleMonth } from './world';

const CLASS_NAMES: Readonly<Record<CabinClass, string>> = { economy: 'Y', premium: 'W', business: 'J', first: 'F' };

/** Quantil einer sortierten Liste (lineare Interpolation). */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// ---------------------------------------------------------------------------
// Abschnitt 1: Zeit und Geld
// ---------------------------------------------------------------------------

const DECADES = [1960, 1970, 1980, 1990, 2000, 2010, 2020, 2030];

export function timeAndMoney(): Section {
  const km = pairKm('FRA', 'MAD');
  const rows = DECADES.map((year) => {
    const m = monthOf(year);
    const fuel = fuelTable(m);
    return [
      String(year),
      num(costIndex(m), 2),
      num(demandGrowth(m), 2),
      `${num(fuel, 2)} $`,
      num(fuel / fuelTable(0) / costIndex(m), 2),
      usd(marketFare('economy', km, m)),
    ];
  });
  const fuelVsIndex2020 = fuelTable(monthOf(2020)) / fuelTable(0) / costIndex(monthOf(2020));
  const checks: Check[] = [
    {
      id: 'B1.1',
      spec: '1.3, 5.2',
      rule: 'Treibstoff (Tabelle) gegenüber Kostenindex: wie stark verschiebt sich das Verhältnis 1960 → 2020 (Grundlage der Langstrecken-Marge, 5.18)',
      value: `Treibstoff ÷ Kostenindex 2020 = ${num(fuelVsIndex2020, 2)} (1960 = 1)`,
      verdict: 'info',
    },
  ];
  const table: Table = {
    title: 'Kostenindex, Nachfrage-Wachstum, Treibstoff, Marktpreis (Januar)',
    header: ['Jahr', 'costIndex', 'demandGrowth', 'Treibstoff je Gallone', 'Treibstoff ÷ Index (1960 = 1)', 'Marktpreis Y FRA–MAD'],
    rows,
    note: 'Treibstoff aus `fuelTable` (mit Krisen, E61). Der Marktpreis wächst nur mit dem Kostenindex (4.3).',
  };
  return { title: 'Abschnitt 1: Zeit und Geld', checks, tables: [table] };
}

// ---------------------------------------------------------------------------
// Abschnitt 2: Zufriedenheit
// ---------------------------------------------------------------------------

const SATISFACTION_POINTS = [0, 50, 80, 100, 120, 140, 160];

/** Kurz- und Langstrecke, auf der die Ausstattung der Persönlichkeiten verglichen wird. */
const SATISFACTION_ROUTES = [
  { label: 'FRA–CDG, A320ceo, 1990', from: 'FRA', to: 'CDG', typeId: 'a320ceo', year: 1990, departures: 14 },
  { label: 'FRA–JFK, A330-300, 1995', from: 'FRA', to: 'JFK', typeId: 'a330-300', year: 1995, departures: 14 },
] as const;

const COMPARED_PERSONALITIES: readonly RivalPersonality[] = ['lcc', 'expansionist', 'flag', 'boutique'];

export function satisfactionSection(): Section {
  const f50 = satisfactionFactor(50);
  const checks: Check[] = [
    {
      id: 'B2.1',
      spec: '2.10',
      rule: '`satisfactionFactor(50)` liegt bei 0,75 (± 0,05)',
      value: num(f50, 3),
      verdict: Math.abs(f50 - 0.75) <= 0.05 ? 'ok' : 'abweichung',
    },
  ];

  const factorTable: Table = {
    title: 'Satisfaction factor',
    header: ['Satisfaction', ...SATISFACTION_POINTS.map(String)],
    rows: [['Faktor', ...SATISFACTION_POINTS.map((s) => num(satisfactionFactor(s), 3))]],
    note: 'Zahlungsbereitschaft gegenüber Satisfaction 100 (2.10).',
  };

  const shortfallRows = CABIN_CLASSES.map((c) => [
    CLASS_NAMES[c],
    ...[45, 120, 300, 600, 900].map((min) => num(maxServiceShortfall(c, flightTimeIndex(min)), 1)),
  ]);
  const shortfallTable: Table = {
    title: 'Größter Service-Abzug (gar kein Service) in Satisfaction-Punkten',
    header: ['Klasse', '45 min', '2 h', '5 h', '10 h', '15 h'],
    rows: shortfallRows,
    note: '`maxServiceShortfall` (2.6.2). Mit `satisfactionFactor` ergibt z. B. −40 Punkte eine Zahlungsbereitschaft von 0,80.',
  };

  // Satisfaction der Ausstattung je Persönlichkeit (Kabine 7.5, Service 7.5) auf einer Kurz- und Langstrecke.
  const rows: string[][] = [];
  let lccShortGap = 0;
  for (const r of SATISFACTION_ROUTES) {
    for (const p of COMPARED_PERSONALITIES) {
      const ops = runMarket({
        from: r.from,
        to: r.to,
        month: sampleMonth(r.year),
        offers: [{ company: 'a', typeId: r.typeId, personality: p, departures: r.departures }],
      });
      const route = routeOf(ops, 'a');
      const cells = CABIN_CLASSES.map((c) => {
        const s = route.satisfaction[c];
        return s === undefined ? '–' : `${num(s, 0)} (${num(satisfactionFactor(s), 2)})`;
      });
      const seats = CABIN_CLASSES.map((c) => route.offeredSeats[c] / route.plannedLegs).map((n) => num(n)).join(' / ');
      rows.push([r.label, p, seats, ...cells]);
      if (r.from === 'FRA' && r.to === 'CDG' && p === 'lcc') lccShortGap = route.satisfaction.economy ?? Number.NaN;
    }
  }
  checks.push({
    id: 'B2.2',
    spec: '2.6.2, 7.4',
    rule: 'Stärke der Service-Abzüge: Satisfaction der LCC (kein Service, dichte Kabine) auf Kurzstrecke; Ausgleich über Preis-Lage 0,90 (7.4)',
    value: `LCC Economy FRA–CDG: ${num(lccShortGap, 0)} → Faktor ${num(satisfactionFactor(lccShortGap), 2)}`,
    verdict: 'info',
  });
  const personalityTable: Table = {
    title: 'Satisfaction je Klasse nach Ausstattung (Persönlichkeit) – Wert (Satisfaction factor)',
    header: ['Strecke', 'Ausstattung', 'Sitze Y / W / J / F', 'Y', 'W', 'J', 'F'],
    rows,
    note: 'Neues Flugzeug, Kabine und Service nach `rivalCabin` / `rivalService` (7.5), Ruf 50, Lohn 100 %, zwei normale Schalter je Ende.',
  };

  return { title: 'Abschnitt 2: Zufriedenheit', checks, tables: [factorTable, shortfallTable, personalityTable] };
}

// ---------------------------------------------------------------------------
// Abschnitt 3: Nachfrage
// ---------------------------------------------------------------------------

/** Typische Städtepaare für die Marktgröße. */
export const SAMPLE_PAIRS = [
  ['HAM', 'NUE', 'klein, kurz'],
  ['FRA', 'CDG', 'groß, kurz'],
  ['FRA', 'MAD', 'Mittelstrecke'],
  ['ATL', 'ORD', 'US-Inland'],
  ['FRA', 'JFK', 'Langstrecke'],
  ['FRA', 'SIN', 'sehr lang'],
] as const;

const SAMPLE_YEARS = [1960, 1975, 1990, 2005, 2020];

/** Marktgröße aller Paare in zwei Monaten (ohne Ereignisse) und Premium-Anteil aller Paare. */
export interface AllPairs {
  readonly pairs: number;
  /** Mittel der Verhältnisse Marktgröße 2019 / 1960 (je Paar). */
  readonly meanRatio: number;
  readonly medianRatio: number;
  /** Σ Marktgröße 2019 / Σ 1960. */
  readonly sumRatio: number;
  /** Premium-Anteil 1990: 5 %- und 95 %-Wert. */
  readonly premiumP5: number;
  readonly premiumP95: number;
  readonly businessP5: number;
  readonly businessP95: number;
  readonly firstP5: number;
  readonly firstP95: number;
}

export function allPairs(airports: readonly MarketAirport[] = airportsData): AllPairs {
  const m1960 = monthOf(1960);
  const m2019 = monthOf(2019);
  const m1990 = monthOf(1990);
  const w1960 = worldScale(m1960, airports);
  const w2019 = worldScale(m2019, airports);
  const w1990 = worldScale(m1990, airports);
  const ratios: number[] = [];
  const premium: number[] = [];
  const business: number[] = [];
  const first: number[] = [];
  let sum1960 = 0;
  let sum2019 = 0;
  for (let i = 0; i < airports.length; i++) {
    for (let j = i + 1; j < airports.length; j++) {
      const a = airports[i];
      const b = airports[j];
      const s0 = marketSizeParts({ a, b, month: m1960, world: w1960 }).marketSize;
      const s1 = marketSizeParts({ a, b, month: m2019, world: w2019 }).marketSize;
      sum1960 += s0;
      sum2019 += s1;
      if (s0 > 0) ratios.push(s1 / s0);
      const p = marketSizeParts({ a, b, month: m1990, world: w1990 });
      const shares = classShares(p.businessShare, p.referenceBlockMinutes);
      premium.push(shares.premium);
      business.push(shares.business);
      first.push(shares.first);
    }
  }
  const sorted = (xs: number[]) => xs.sort((x, y) => x - y);
  sorted(ratios);
  sorted(premium);
  sorted(business);
  sorted(first);
  return {
    pairs: premium.length,
    meanRatio: ratios.reduce((s, x) => s + x, 0) / ratios.length,
    medianRatio: quantile(ratios, 0.5),
    sumRatio: sum2019 / sum1960,
    premiumP5: quantile(premium, 0.05),
    premiumP95: quantile(premium, 0.95),
    businessP5: quantile(business, 0.05),
    businessP95: quantile(business, 0.95),
    firstP5: quantile(first, 0.05),
    firstP95: quantile(first, 0.95),
  };
}

/** Toleranz für „im Mittel × 2,5“ (3.3): ± 10 %. Festlegung des Balance-Skripts, nicht der Spezifikation. */
export const GROWTH_TOLERANCE = 0.1;

export function demandSection(all: AllPairs = allPairs()): Section {
  const checks: Check[] = [
    {
      id: 'B3.1',
      spec: '3.3',
      rule: 'Im Mittel aller Paare wächst die Marktgröße 1960 → 2019 um × 2,5 (± 10 %)',
      value: `Mittel ${num(all.meanRatio, 2)}, Median ${num(all.medianRatio, 2)}, Summe ${num(all.sumRatio, 2)} (${num(all.pairs)} Paare)`,
      verdict: Math.abs(all.meanRatio / 2.5 - 1) <= GROWTH_TOLERANCE ? 'ok' : 'abweichung',
    },
    {
      id: 'B3.2',
      spec: '3.7',
      rule: 'Premium-Anteil schwankt über alle Paare: 5 %- bis 95 %-Wert mindestens 3 Prozentpunkte auseinander (1990)',
      value: `${pct(all.premiumP5, 1)} … ${pct(all.premiumP95, 1)} (${num((all.premiumP95 - all.premiumP5) * 100, 1)} Pp.)`,
      verdict: all.premiumP95 - all.premiumP5 >= 0.03 ? 'ok' : 'abweichung',
    },
  ];

  // Marktgröße typischer Paare
  const sizeRows: string[][] = [];
  for (const [from, to, label] of SAMPLE_PAIRS) {
    const a = modelAirport(from);
    const b = modelAirport(to);
    const cells = SAMPLE_YEARS.map((year) => {
      const m = sampleMonth(year);
      return num(marketSizeParts({ a, b, month: m, world: worldScale(m) }).marketSize);
    });
    const p = marketSizeParts({ a, b, month: sampleMonth(1990), world: worldScale(sampleMonth(1990)) });
    const shares = classShares(p.businessShare, p.referenceBlockMinutes);
    sizeRows.push([
      `${from}–${to} (${label})`,
      num(pairKm(from, to)),
      ...cells,
      CABIN_CLASSES.map((c) => pct(shares[c], 1)).join(' / '),
    ]);
  }
  const sizeTable: Table = {
    title: 'Marktgröße typischer Paare (Fluggäste je Woche, beide Richtungen, Mai, ohne Ereignisse)',
    header: ['Paar', 'km', ...SAMPLE_YEARS.map(String), 'Klassen Y / W / J / F (1990)'],
    rows: sizeRows,
    note: '`marketSize` (3.6) mit `eventFactor` 1; Klassen-Anteile `classShares` (3.7).',
  };

  const classTable: Table = {
    title: 'Klassen-Anteile über alle Paare (1990)',
    header: ['Klasse', '5 %-Wert', '95 %-Wert'],
    rows: [
      ['Premium', pct(all.premiumP5, 1), pct(all.premiumP95, 1)],
      ['Business', pct(all.businessP5, 1), pct(all.businessP95, 1)],
      ['First', pct(all.firstP5, 1), pct(all.firstP95, 1)],
    ],
  };

  // Entfernung
  const shortLong = distanceFactor(45) / distanceFactor(1200);
  checks.push({
    id: 'B3.3',
    spec: '3.4',
    rule: 'Entfernungs-Faktor kurz : lang (45 min : 20 h); Startwert 5,2',
    value: num(shortLong, 2),
    verdict: 'info',
  });

  // Flugzeit: Turboprop gegen Jet auf derselben Strecke
  const km = pairKm('FRA', 'CDG');
  const ref = referenceBlockMinutes(modelAirport('FRA').coords, modelAirport('CDG').coords);
  const atr = catalogType('atr-72-200');
  const a320 = catalogType('a320ceo');
  const atrFactor = flightTimeFactor(blockMinutes(km, atr.cruiseSpeed), ref);
  const jetFactor = flightTimeFactor(blockMinutes(km, a320.cruiseSpeed), ref);
  const longKm = pairKm('FRA', 'MAD');
  const longRef = referenceBlockMinutes(modelAirport('FRA').coords, modelAirport('MAD').coords);
  const atrLong = flightTimeFactor(blockMinutes(longKm, atr.cruiseSpeed), longRef) / flightTimeFactor(blockMinutes(longKm, a320.cruiseSpeed), longRef);
  checks.push({
    id: 'B3.4',
    spec: '3.9.3',
    rule: 'Stärke von `FLIGHT_TIME_EXP`: Anziehung Turboprop ÷ Jet bei sonst gleichem Angebot',
    value: `FRA–CDG ${num(atrFactor / jetFactor, 2)}, FRA–MAD ${num(atrLong, 2)}`,
    verdict: 'info',
  });

  // Schwierigkeit (so viele Abflüge, dass die Sitze nicht begrenzen)
  const DIFFICULTY_DEPARTURES = 300;
  const diffRows: string[][] = [];
  const market = (difficulty: 'Easy' | 'Normal' | 'Hard', rival: boolean) =>
    runMarket({
      from: 'FRA',
      to: 'MAD',
      month: sampleMonth(1990),
      offers: [
        { company: 'pl', typeId: 'a320ceo', personality: 'flag', departures: DIFFICULTY_DEPARTURES, inputs: { ...NEUTRAL_INPUTS, difficulty } },
        ...(rival ? [{ company: 'ai', typeId: 'a320ceo', personality: 'flag' as const, departures: DIFFICULTY_DEPARTURES }] : []),
      ],
    });
  const pax = (ops: ReturnType<typeof market>) => routeOf(ops, 'pl').passengers.economy;
  const loadOf = (ops: ReturnType<typeof market>) => routeOf(ops, 'pl').passengers.economy / routeOf(ops, 'pl').offeredSeats.economy;
  const alone = pax(market('Normal', false));
  const duel = pax(market('Normal', true));
  let hardDuel = 0;
  for (const d of ['Easy', 'Normal', 'Hard'] as const) {
    const a = pax(market(d, false)) / alone;
    const b = pax(market(d, true)) / duel;
    if (d === 'Hard') hardDuel = b;
    diffRows.push([d, num(difficultyFactor(d), 2), pct(a - 1, 1), pct(b - 1, 1), pct(loadOf(market(d, true)), 0)]);
  }
  checks.push({
    id: 'B3.5',
    spec: '1.8',
    rule: 'Stärke der Schwierigkeit: Fluggäste des Spielers auf Hard gegenüber Normal (gegen einen gleichen Rivalen)',
    value: pct(hardDuel - 1, 1),
    verdict: 'info',
  });
  const diffTable: Table = {
    title: `Schwierigkeit: Fluggäste Economy des Spielers gegenüber Normal (FRA–MAD 1990, A320ceo, ${DIFFICULTY_DEPARTURES} Abflüge je Gesellschaft, Sitze nicht voll)`,
    header: ['Schwierigkeit', 'Faktor', 'allein', 'gegen gleichen Rivalen', 'Auslastung Y (mit Rivale)'],
    rows: diffRows,
    note: 'Viele Abflüge, damit die Sitze nicht begrenzen. Allein wirkt der Faktor nur gegen „Nicht fliegen“ (1.8).',
  };

  return { title: 'Abschnitt 3: Nachfrage', checks, tables: [sizeTable, classTable, diffTable] };
}
