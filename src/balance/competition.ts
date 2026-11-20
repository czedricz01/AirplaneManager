/**
 * Balance-Skript (Paket 3.9b): Auswertung der Langläufe (Abschnitt 7 und 3.13 der Spezifikation).
 *
 * Eingabe sind fertige Läufe (`LongRunResult`, aus `runLong`); hier wird nur gezählt und bewertet. Läufe:
 * - Haupt-Läufe: KI-Stärke Normal, mit Zuschuss (heutiger Stand), je Persönlichkeit ein Gründer, 10 Läufe.
 * - Läufe ohne Zuschuss: gleich, aber `subsidized = false` (Prüfregel 7.14).
 * - Stärke-Läufe: Easy und Hard mit Zuschuss (KI-Stärke-Werte, 7.3).
 */

import { CONNECTION_APPEAL, type RivalPersonality } from '../model/constants';
import { num, pct, type Check, type Section, type Table } from './report';
import { BIG_STEP, LENGTH_BANDS, PERSONALITY_ORDER, founderHub, spreadOf, type CompanyYear, type LengthBand, type LongRunResult, type YearStats } from './longRun';

/** Erfolg gilt als „ähnlich“, wenn der Median jeder Persönlichkeit innerhalb dieses Faktors um den Median aller liegt (7.4). */
export const SIMILAR_FACTOR = 2;

/** Ziel der Marktgröße (E67): Auslastung und Marge einer typischen Strecke (Median der KI-Strecken). */
export const LOAD_TARGET: readonly [number, number] = [0.75, 0.9];
export const MARGIN_TARGET: readonly [number, number] = [0.1, 0.25];

/** Jahre bis zur Auflösung, deren Median ohne Zuschuss überschritten sein muss (7.14). */
export const SUBSIDY_YEARS = 40;

/** Die Läufe nach Art. */
export interface RunGroups {
  readonly main: readonly LongRunResult[];
  readonly noSubsidy: readonly LongRunResult[];
  readonly strength: readonly LongRunResult[];
}

/** Ordnet Läufe nach Art (Stärke Normal mit / ohne Zuschuss, andere Stärken). */
export function groupRuns(runs: readonly LongRunResult[]): RunGroups {
  return {
    main: runs.filter((r) => r.settings.strength === 'normal' && r.settings.subsidy),
    noSubsidy: runs.filter((r) => r.settings.strength === 'normal' && !r.settings.subsidy),
    strength: runs.filter((r) => r.settings.strength !== 'normal'),
  };
}

const median = (values: readonly number[]) => spreadOf(values).median;
const mean = (values: readonly number[]) => (values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : Number.NaN);
const musd1960 = (v: number) => (Number.isFinite(v) ? `${num(v / 1e6, 0)} Mio. $` : '–');
const ratio = (v: number) => (Number.isFinite(v) ? num(v, 2) : '–');

/** Stand der Gründer nach `afterYears` Jahren (Januar), oder `undefined`, wenn der Lauf kürzer ist. */
function foundersAfter(run: LongRunResult, afterYears: number): readonly CompanyYear[] | undefined {
  const y = run.years[afterYears - 1];
  return y?.companies.filter((c) => c.founder);
}

/** Median des Unternehmenswerts (Preise 1960) je Persönlichkeit und über alle Gründer, nach `afterYears` Jahren. */
export function valueMedians(runs: readonly LongRunResult[], afterYears: number): { readonly all: number; readonly by: Readonly<Record<RivalPersonality, number>> } | undefined {
  const lists = runs.map((r) => foundersAfter(r, afterYears)).filter((l): l is readonly CompanyYear[] => l !== undefined);
  if (lists.length === 0) return undefined;
  const founders = lists.flat();
  const by = {} as Record<RivalPersonality, number>;
  for (const p of PERSONALITY_ORDER) by[p] = median(founders.filter((c) => c.personality === p).map((c) => c.value1960));
  return { all: median(founders.map((c) => c.value1960)), by };
}

/** Größtes Verhältnis „Median einer Persönlichkeit ÷ Median aller“ in beide Richtungen (1 = alle gleich). */
export function spreadFactor(m: { readonly all: number; readonly by: Readonly<Record<RivalPersonality, number>> }): number {
  let worst = 1;
  for (const p of PERSONALITY_ORDER) {
    const v = m.by[p];
    if (!(v > 0) || !(m.all > 0)) return Number.POSITIVE_INFINITY;
    worst = Math.max(worst, v / m.all, m.all / v);
  }
  return worst;
}

/** Jahre bis zur Auflösung je Gründer; nicht aufgelöst = `Infinity`. */
export function yearsToLiquidation(run: LongRunResult, p: RivalPersonality): number {
  const year = run.founderLiquidated[p];
  return year === undefined ? Number.POSITIVE_INFINITY : year - run.settings.startYear;
}

/** Median der Jahre bis zur Auflösung je Persönlichkeit (Infinity zählt als „nie“). */
function liquidationMedian(runs: readonly LongRunResult[], p: RivalPersonality): number {
  const years = runs.map((r) => yearsToLiquidation(r, p)).sort((a, b) => a - b);
  if (years.length === 0) return Number.NaN;
  const mid = (years.length - 1) / 2;
  const lo = years[Math.floor(mid)];
  const hi = years[Math.ceil(mid)];
  return lo === hi ? lo : (lo + hi) / 2;
}

const yearsText = (v: number) => (v === Number.POSITIVE_INFINITY ? 'nie' : Number.isFinite(v) ? num(v, 1) : '–');

/** Jahre eines Laufs in einem Jahrzehnt. */
const inDecade = (run: LongRunResult, decade: number) => run.years.filter((y) => y.year >= decade && y.year < decade + 10);

/** Mittel einer Jahres-Größe über alle Läufe und Jahre eines Jahrzehnts. */
function decadeMean(runs: readonly LongRunResult[], decade: number, pick: (y: YearStats) => number): number {
  return mean(runs.flatMap((r) => inDecade(r, decade).map(pick)).filter(Number.isFinite));
}

/** Jahrzehnte, die in den Läufen vorkommen. */
function decadesOf(runs: readonly LongRunResult[]): number[] {
  const years = runs.flatMap((r) => r.years.map((y) => y.year));
  if (years.length === 0) return [];
  const out: number[] = [];
  for (let d = Math.floor(Math.min(...years) / 10) * 10; d <= Math.max(...years); d += 10) out.push(d);
  return out;
}

/** Meldungen einer Art je Gesellschaft und Jahr (lebende KI im Januar). */
function newsPerCompany(y: YearStats, kind: string): number {
  const alive = y.companies.filter((c) => c.status !== 'liquidated').length;
  return alive > 0 ? (y.news[kind] ?? 0) / alive : 0;
}

// ---------------------------------------------------------------------------
// Tabellen
// ---------------------------------------------------------------------------

const CHECK_YEARS = [10, 20, 30, 40, 50, 60];

function valueTable(title: string, runs: readonly LongRunResult[], note: string): Table {
  const rows: string[][] = [];
  for (const after of CHECK_YEARS) {
    const m = valueMedians(runs, after);
    if (!m) continue;
    rows.push([
      `${after} (${runs[0].settings.startYear + after})`,
      musd1960(m.all),
      ...PERSONALITY_ORDER.map((p) => `${musd1960(m.by[p])} (${ratio(m.by[p] / m.all)})`),
      ratio(spreadFactor(m)),
    ]);
  }
  return { title, header: ['Nach Jahren', 'Median alle', ...PERSONALITY_ORDER, 'Faktor'], rows, note };
}

function founderTable(runs: readonly LongRunResult[]): Table {
  const rows = runs.map((r) => {
    const last = r.years[r.years.length - 1];
    return [
      `${r.settings.run}`,
      ...PERSONALITY_ORDER.map((p, k) => {
        const c = last?.companies.find((x) => x.id === `f-${p}`);
        const liq = r.founderLiquidated[p];
        return `${founderHub(r.settings.run, k)}: ${liq !== undefined ? `aufgelöst ${num(liq, 0)}` : musd1960(c?.value1960 ?? Number.NaN)}`;
      }),
    ];
  });
  return {
    title: 'Gründer je Lauf am Ende (Drehkreuz: Unternehmenswert in Preisen von 1960)',
    header: ['Lauf', ...PERSONALITY_ORDER],
    rows,
    note: 'Jede Persönlichkeit hat über die 10 Läufe jedes der 10 Drehkreuze genau einmal (`founderHub`).',
  };
}

function liquidationTable(runs: readonly LongRunResult[]): Table {
  return {
    title: 'Ohne Zuschuss: Jahre bis zur Auflösung der Gründer',
    header: ['Persönlichkeit', 'aufgelöst', 'Median Jahre', 'einzelne Läufe'],
    rows: PERSONALITY_ORDER.map((p) => {
      const years = runs.map((r) => yearsToLiquidation(r, p));
      return [p, `${years.filter(Number.isFinite).length} von ${years.length}`, yearsText(liquidationMedian(runs, p)), years.map(yearsText).join(' · ')];
    }),
  };
}

function marketTable(runs: readonly LongRunResult[]): Table {
  const rows = decadesOf(runs).map((d) => [
    `${d}er`,
    ratio(decadeMean(runs, d, (y) => y.fareEconomy.p10)),
    ratio(decadeMean(runs, d, (y) => y.fareEconomy.median)),
    ratio(decadeMean(runs, d, (y) => y.fareEconomy.p90)),
    pct(decadeMean(runs, d, (y) => y.priceWarShare), 1),
    ratio(decadeMean(runs, d, (y) => y.offersPerPair.mean)),
    pct(decadeMean(runs, d, (y) => y.sharedPairs)),
    pct(decadeMean(runs, d, (y) => y.loadFactor.median)),
    pct(decadeMean(runs, d, (y) => y.margin.median)),
    pct(decadeMean(runs, d, (y) => y.losingShare)),
  ]);
  return {
    title: 'Preise und Markt im laufenden Spiel (Mittel der Jahre, alle Haupt-Läufe)',
    header: ['Jahrzehnt', 'Preis Y p10', 'Preis Y Median', 'Preis Y p90', 'Preiskampf', 'Gesellschaften je Paar', 'Paare mit ≥ 2', 'Auslastung (Median)', 'Marge (Median)', 'Strecken mit Verlust'],
    rows,
    note: 'Preis Y = Preisniveau Economy (`fareRatio`) je Strecke und Monat. Auslastung und Marge je Strecke und Monat aus dem Bericht des Abschlusses.',
  };
}

const BAND_NAMES: Readonly<Record<LengthBand, string>> = { short: 'kurz', medium: 'mittel', long: 'lang' };

/** Auslastung und Marge je Länge (Median je Jahr, Mittel der Jahre eines Jahrzehnts); nur Läufe mit `byLength`. */
function lengthTable(runs: readonly LongRunResult[]): Table {
  const pick = (b: LengthBand, k: 'load' | 'margin') => (y: YearStats) => y.byLength?.[b][k].median ?? Number.NaN;
  const count = (b: LengthBand) => (y: YearStats) => y.byLength?.[b].load.n ?? Number.NaN;
  const rows = decadesOf(runs).map((d) => [
    `${d}er`,
    ...LENGTH_BANDS.flatMap((b) => [
      `${pct(decadeMean(runs, d, pick(b, 'load')))} / ${pct(decadeMean(runs, d, pick(b, 'margin')))}`,
      num(decadeMean(runs, d, count(b)) / 12, 0),
    ]),
  ]);
  return {
    title: 'Auslastung / Marge je Streckenlänge (Median je Jahr, Mittel der Jahre, Haupt-Läufe; E67)',
    header: ['Jahrzehnt', ...LENGTH_BANDS.flatMap((b) => [BAND_NAMES[b], 'Strecken'])],
    rows,
    note: 'kurz unter 1 000 km, mittel bis 3 500 km, lang darüber (Großkreis). „Strecken“ = KI-Strecken je Monat und Lauf.',
  };
}

function fareByPersonalityTable(runs: readonly LongRunResult[]): Table {
  const rows = decadesOf(runs).map((d) => [`${d}er`, ...PERSONALITY_ORDER.map((p) => ratio(decadeMean(runs, d, (y) => y.fareByPersonality[p] ?? Number.NaN)))]);
  return { title: 'Preisniveau Economy je Persönlichkeit (Median, Mittel der Jahre)', header: ['Jahrzehnt', ...PERSONALITY_ORDER], rows };
}

function stepTable(runs: readonly LongRunResult[]): Table {
  const rows = decadesOf(runs).map((d) => [
    `${d}er`,
    ratio(decadeMean(runs, d, (y) => y.optimizerStep.median)),
    ratio(decadeMean(runs, d, (y) => y.optimizerStep.p90)),
    pct(decadeMean(runs, d, (y) => y.optimizerBigSteps), 1),
    ratio(decadeMean(runs, d, (y) => y.otherStep.p90)),
    pct(decadeMean(runs, d, (y) => y.otherBigSteps), 1),
  ]);
  return {
    title: 'Preis-Sprünge von Monat zu Monat (|Δ Preisniveau Economy| je Strecke)',
    header: ['Jahrzehnt', 'Optimizer Median', 'Optimizer p90', `Optimizer ≥ ${num(BIG_STEP, 2)}`, 'andere p90', `andere ≥ ${num(BIG_STEP, 2)}`],
    rows,
    note: `„Sprung“ = Änderung um mindestens ${num(BIG_STEP, 2)} Preisniveau in einem Monat (z. B. 1,20 → 1,45).`,
  };
}

function transferTable(runs: readonly LongRunResult[]): Table {
  const years = [...new Set(runs.flatMap((r) => r.years.filter((y) => y.transfers).map((y) => y.year)))].sort((a, b) => a - b);
  const rows = years.map((year) => {
    const list = runs.flatMap((r) => r.years.filter((y) => y.year === year && y.transfers).map((y) => y.transfers as NonNullable<YearStats['transfers']>));
    return [
      `${year + 1}`,
      num(mean(list.map((t) => t.pairs)), 0),
      pct(mean(list.map((t) => t.placedShare.median)), 1),
      pct(mean(list.map((t) => t.placedShare.p90)), 1),
      pct(mean(list.map((t) => t.wishShare.median)), 1),
      pct(mean(list.map((t) => t.over25)), 1),
      pct(mean(list.map((t) => t.overall)), 1),
      num(mean(list.map((t) => t.withoutDirect)), 0),
    ];
  });
  return {
    title: 'Umsteiger in Märkten mit Direktangebot (Januar, Mittel der Haupt-Läufe)',
    header: ['Januar', 'Paare', 'Anteil Median', 'Anteil p90', 'Wunsch Median', 'Paare über 25 %', 'Anteil gesamt', 'Umsteiger ohne Direktangebot je Woche'],
    rows,
    note:
      'Anteil = platzierte Umsteiger ÷ (Direktgäste + Umsteiger) je Paar O–D mit Direktangebot und Umsteige-Verbindung. ' +
      '„Wunsch“ = vor der Verteilung auf freie Sitze. `CONNECTION_APPEAL` = ' + num(CONNECTION_APPEAL, 2) + '.',
  };
}

function growthTable(runs: readonly LongRunResult[]): Table {
  const rows = decadesOf(runs).map((d) => [
    `${d}er`,
    num(decadeMean(runs, d, (y) => y.companies.filter((c) => c.status !== 'liquidated').length), 1),
    num(decadeMean(runs, d, (y) => mean(y.companies.filter((c) => c.status !== 'liquidated').map((c) => c.planes))), 0),
    num(decadeMean(runs, d, (y) => newsPerCompany(y, 'routeOpened')), 1),
    num(decadeMean(runs, d, (y) => newsPerCompany(y, 'planeBought')), 1),
    num(decadeMean(runs, d, (y) => newsPerCompany(y, 'routeClosed')), 1),
    num(decadeMean(runs, d, (y) => newsPerCompany(y, 'planeSold')), 1),
    num(decadeMean(runs, d, (y) => y.news.newHub ?? 0), 2),
    num(decadeMean(runs, d, (y) => y.news.newRival ?? 0), 2),
    num(decadeMean(runs, d, (y) => y.news.liquidated ?? 0), 2),
  ]);
  return {
    title: 'Wachstum der KI (Mittel der Jahre, Haupt-Läufe)',
    header: ['Jahrzehnt', 'KI', 'Flugzeuge je KI', 'Eröffnungen je KI und Jahr', 'Käufe je KI und Jahr', 'Schließungen je KI und Jahr', 'Verkäufe je KI und Jahr', 'neue Drehkreuze je Jahr', 'Nachrücker je Jahr', 'Auflösungen je Jahr'],
    rows,
  };
}

function moneyTable(runs: readonly LongRunResult[]): Table {
  const rows = decadesOf(runs).map((d) => [
    `${d}er`,
    musd1960(decadeMean(runs, d, (y) => mean(y.companies.filter((c) => c.status !== 'liquidated').map((c) => c.revenue1960)))),
    musd1960(decadeMean(runs, d, (y) => mean(y.companies.filter((c) => c.status !== 'liquidated').map((c) => c.result1960)))),
    musd1960(decadeMean(runs, d, (y) => mean(y.companies.filter((c) => c.status !== 'liquidated').map((c) => c.subsidy1960)))),
    musd1960(decadeMean(runs, d, (y) => y.dividends1960 / Math.max(1, y.companies.filter((c) => c.status !== 'liquidated').length))),
    musd1960(decadeMean(runs, d, (y) => mean(y.companies.filter((c) => c.status !== 'liquidated').map((c) => c.cash1960)))),
    pct(decadeMean(runs, d, (y) => (y.slotHoldings > 0 ? y.slotHoldingsAtCap / y.slotHoldings : 0)), 1),
    pct(decadeMean(runs, d, (y) => y.maxAirportSlotShare)),
  ]);
  return {
    title: 'Geld und Slots der KI je Jahr (Preise von 1960, Mittel je lebender KI, Haupt-Läufe)',
    header: ['Jahrzehnt', 'Erlös', 'Ergebnis', 'Zuschuss', 'Dividende', 'Kasse (Januar)', 'Slot-Haltungen an der eigenen Grenze', 'größter KI-Anteil an einem Flughafen'],
    rows,
    note: 'Slot-Haltung = eine KI mit Slots an einem Flughafen; Grenze = `rivalSlotCap` (25 % am Drehkreuz, sonst 10 %, 7.10).',
  };
}

function strengthTable(runs: readonly LongRunResult[], main: readonly LongRunResult[]): Table {
  const all = [...main, ...runs];
  const years = Math.min(...all.map((r) => r.years.length));
  const rows = (['easy', 'normal', 'hard'] as const).map((s) => {
    const list = all.filter((r) => r.settings.strength === s);
    const m = valueMedians(list, years);
    const last = list.map((r) => r.years[years - 1]);
    return [
      s,
      `${list.length}`,
      musd1960(m?.all ?? Number.NaN),
      num(mean(last.map((y) => mean(y.companies.filter((c) => c.founder && c.status !== 'liquidated').map((c) => c.planes)))), 0),
      `${list.reduce((n, r) => n + Object.keys(r.founderLiquidated).length, 0)}`,
    ];
  });
  return {
    title: `KI-Stärke: Gründer nach ${years} Jahren (mit Zuschuss)`,
    header: ['Stärke', 'Läufe', 'Median Unternehmenswert', 'Flugzeuge je Gründer', 'aufgelöste Gründer'],
    rows,
  };
}

function timeTable(runs: readonly LongRunResult[]): Table {
  const rows = decadesOf(runs).map((d) => [
    `${d}er`,
    num(decadeMean(runs, d, (y) => y.ms / 12), 0),
    num(decadeMean(runs, d, (y) => y.companies.reduce((s, c) => s + c.routes, 0)), 0),
  ]);
  rows.push(['ganzer Lauf', `${num(mean(runs.map((r) => r.ms / 60_000)), 1)} min`, '']);
  return {
    title: 'Rechenzeit (ein Prozess, alle Flughäfen der Daten)',
    header: ['Jahrzehnt', 'ms je Monat', 'KI-Strecken'],
    rows,
    note: 'Gemessen während mehrere Läufe gleichzeitig rechneten; ein einzelner Lauf ist etwas schneller.',
  };
}

// ---------------------------------------------------------------------------
// Prüfregeln
// ---------------------------------------------------------------------------

function similarCheck(id: string, runs: readonly LongRunResult[], label: string): Check {
  const at20 = valueMedians(runs, 20);
  const at40 = valueMedians(runs, 40);
  if (!at20 || !at40) return { id, spec: '7.4', rule: `Ähnlicher Erfolg (${label})`, value: 'Läufe zu kurz', verdict: 'info' };
  const f20 = spreadFactor(at20);
  const f40 = spreadFactor(at40);
  const ok = f20 <= SIMILAR_FACTOR && f40 <= SIMILAR_FACTOR;
  const weakest = (m: typeof at20) => PERSONALITY_ORDER.reduce((a, b) => (m.by[a] <= m.by[b] ? a : b));
  const strongest = (m: typeof at20) => PERSONALITY_ORDER.reduce((a, b) => (m.by[a] >= m.by[b] ? a : b));
  return {
    id,
    spec: '7.4',
    rule: `Ähnlicher Erfolg (${label}): Median des Unternehmenswerts je Persönlichkeit nach 20 und 40 Jahren innerhalb Faktor ${SIMILAR_FACTOR} des Medians aller`,
    value: `Faktor ${ratio(f20)} nach 20, ${ratio(f40)} nach 40 Jahren (schwächste: ${weakest(at40)}, stärkste: ${strongest(at40)}; ${runs.length} Läufe)`,
    verdict: ok ? 'ok' : 'abweichung',
  };
}

/** Die Abschnitte der Langläufe. */
export function competitionSections(runs: readonly LongRunResult[]): Section[] {
  const g = groupRuns(runs);
  const checks: Check[] = [];
  const tables: Table[] = [];

  if (g.main.length > 0) {
    checks.push(similarCheck('B7.1', g.main, 'mit Zuschuss'));
    tables.push(valueTable('Unternehmenswert der Gründer mit Zuschuss (Median, Preise von 1960; in Klammern ÷ Median aller)', g.main, '„Faktor“ = größtes Verhältnis einer Persönlichkeit zum Median aller, in beide Richtungen. Aufgelöste Gründer zählen mit 0.'));
    tables.push(founderTable(g.main));
  }
  if (g.noSubsidy.length > 0) {
    const years = PERSONALITY_ORDER.map((p) => liquidationMedian(g.noSubsidy, p));
    const longEnough = years.every((y) => y > SUBSIDY_YEARS);
    const similar = similarCheck('B7.2a', g.noSubsidy, 'ohne Zuschuss');
    checks.push(similar);
    checks.push({
      id: 'B7.2',
      spec: '7.14',
      rule: `Abschaffung des Zuschusses: ohne Zuschuss Median der Jahre bis zur Auflösung je Persönlichkeit über ${SUBSIDY_YEARS} (oder nie), und „ähnlicher Erfolg“ gilt`,
      value: `${PERSONALITY_ORDER.map((p, i) => `${p} ${yearsText(years[i])}`).join(', ')}; ähnlicher Erfolg: ${similar.verdict === 'ok' ? 'ja' : 'nein'}`,
      verdict: longEnough && similar.verdict === 'ok' ? 'ok' : 'abweichung',
    });
    tables.push(valueTable('Unternehmenswert der Gründer ohne Zuschuss (Median, Preise von 1960)', g.noSubsidy, 'Wie oben, Läufe mit `subsidized = false` für jede KI.'));
    tables.push(liquidationTable(g.noSubsidy));
  }

  const main = g.main;
  if (main.length > 0) {
    const allYears = main.flatMap((r) => r.years);
    const fareP10 = mean(allYears.map((y) => y.fareEconomy.p10));
    checks.push({
      id: 'B7.3',
      spec: '7.6',
      rule: 'Preise und Preiskampf im laufenden Spiel (Nachweis zu O60)',
      value: `Preisniveau Y Median ${ratio(mean(allYears.map((y) => y.fareEconomy.median)))}, p10 ${ratio(fareP10)}; Preiskampf ${pct(mean(allYears.map((y) => y.priceWarShare)), 1)} der Strecken; ${ratio(mean(allYears.map((y) => y.offersPerPair.mean)))} Gesellschaften je Paar; Auslastung ${pct(mean(allYears.map((y) => y.loadFactor.median)))}; Marge ${pct(mean(allYears.map((y) => y.margin.median)))}`,
      verdict: 'info',
    });
    checks.push({
      id: 'B7.4',
      spec: '7.6, E65',
      rule: `Störende Sprünge der Optimizer-Preise (Schritte ≥ ${num(BIG_STEP, 2)} je Monat)`,
      value: `Optimizer ${pct(mean(allYears.map((y) => y.optimizerBigSteps)), 1)} der Strecken-Monate (p90 ${ratio(mean(allYears.map((y) => y.optimizerStep.p90)))}), andere ${pct(mean(allYears.map((y) => y.otherBigSteps)), 1)}`,
      verdict: 'info',
    });
    const loadMedian = mean(allYears.map((y) => y.loadFactor.median));
    const marginMedian = mean(allYears.map((y) => y.margin.median));
    const inRange = (v: number, [lo, hi]: readonly [number, number]) => v >= lo && v <= hi;
    checks.push({
      id: 'B7.10',
      spec: '3.6, E67',
      rule: `Marktgröße: typische KI-Strecke ${pct(LOAD_TARGET[0])}–${pct(LOAD_TARGET[1])} Auslastung, Marge ${pct(MARGIN_TARGET[0])}–${pct(MARGIN_TARGET[1])} (Median, Mittel der Jahre)`,
      value: `Auslastung ${pct(loadMedian)}, Marge ${pct(marginMedian)}`,
      verdict: inRange(loadMedian, LOAD_TARGET) && inRange(marginMedian, MARGIN_TARGET) ? 'ok' : 'abweichung',
    });
    const transferYears = allYears.filter((y) => y.transfers).map((y) => y.transfers as NonNullable<YearStats['transfers']>);
    if (transferYears.length > 0) {
      const typical = median(transferYears.map((t) => t.placedShare.median));
      checks.push({
        id: 'B3.13',
        spec: '3.13',
        rule: 'Umsteiger in Märkten mit Direktangebot typisch unter 25 %',
        value: `Median je Paar ${pct(typical, 1)}, p90 ${pct(mean(transferYears.map((t) => t.placedShare.p90)), 1)}; Paare über 25 %: ${pct(mean(transferYears.map((t) => t.over25)), 1)}`,
        verdict: typical < 0.25 ? 'ok' : 'abweichung',
      });
    }
    checks.push({
      id: 'B7.5',
      spec: '7.10',
      rule: 'Slot-Anteile der KI',
      value: `Haltungen an der eigenen Grenze ${pct(mean(allYears.map((y) => (y.slotHoldings > 0 ? y.slotHoldingsAtCap / y.slotHoldings : 0))), 1)}; größter KI-Anteil an einem Flughafen ${pct(Math.max(...allYears.map((y) => y.maxAirportSlotShare)))}`,
      verdict: 'info',
    });
    checks.push({
      id: 'B7.6',
      spec: '7.13',
      rule: 'Dividende und neue Drehkreuze (`NEW_HUB_MIN_SEATS`)',
      value: `Dividende je KI und Jahr ${musd1960(mean(allYears.map((y) => y.dividends1960 / Math.max(1, y.companies.filter((c) => c.status !== 'liquidated').length))))} (1960); neue Drehkreuze ${num(mean(main.map((r) => r.years.reduce((s, y) => s + (y.news.newHub ?? 0), 0))), 1)} je Lauf`,
      verdict: 'info',
    });
    checks.push({
      id: 'B7.7',
      spec: '7.9, 7.11',
      rule: 'Eröffnungen und Käufe je Jahr',
      value: `je KI und Jahr: ${num(mean(allYears.map((y) => newsPerCompany(y, 'routeOpened'))), 1)} Eröffnungen, ${num(mean(allYears.map((y) => newsPerCompany(y, 'planeBought'))), 1)} Käufe, ${num(mean(allYears.map((y) => newsPerCompany(y, 'routeClosed'))), 1)} Schließungen`,
      verdict: 'info',
    });
    const lastDecade = Math.max(...decadesOf(main));
    checks.push({
      id: 'B7.9',
      spec: '7.9',
      rule: 'Rechenzeit der KI-Planung mit allen Flughäfen',
      value: `${num(decadeMean(main, lastDecade, (y) => y.ms / 12), 0)} ms je Monat in den ${lastDecade}ern; ${num(mean(main.map((r) => r.ms / 60_000)), 1)} min je Lauf`,
      verdict: 'info',
    });
    tables.push(marketTable(main));
    if (main.some((r) => r.years.some((y) => y.byLength))) tables.push(lengthTable(main));
    tables.push(fareByPersonalityTable(main), stepTable(main), transferTable(main), growthTable(main), moneyTable(main));
  }
  if (g.strength.length > 0) {
    const t = strengthTable(g.strength, main);
    checks.push({ id: 'B7.8', spec: '7.3', rule: 'KI-Stärke-Werte: Easy < Normal < Hard im Erfolg', value: t.rows.map((r) => `${r[0]} ${r[2]}`).join(', '), verdict: 'info' });
    tables.push(t);
  }
  if (runs.length > 0) tables.push(timeTable(runs));
  return [{ title: '7 Konkurrenz und 3.13 Umsteiger: Langläufe ohne Spieler (Paket 3.9b)', checks, tables }];
}
