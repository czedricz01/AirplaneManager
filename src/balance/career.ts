/**
 * Balance-Skript (Paket 3.9c): Abschnitt 6 der Spezifikation – Ruf, Rang, Forschung, Jahresziel – ohne Langlauf.
 *
 * Alle Zahlen kommen aus `src/model/` (Ruf-Funktionen aus `progress.ts`, Satisfaction und Ergebnis aus
 * `monthOperations` über die Beispiel-Welten in `world.ts`). Das Skript ändert keine Konstante.
 */

import {
  ADVERTISING_REPUTATION_MAX,
  AIRPORT_STRIKE_CANCEL_SHARE,
  AIRPORT_STRIKE_CHANCE,
  CAMPAIGN_REPUTATION,
  CANCELLED_REPUTATION_WEIGHT,
  CLASS_RESEARCH,
  DEFECT_CANCEL_SHARE,
  GOAL_MIN_REWARD_1960,
  GOAL_MISS_PENALTY_SHARE,
  GOAL_REWARD_SHARE,
  GOAL_STEADY_FACTOR,
  GOAL_STRETCH_FACTOR,
  PERSONALITY_IDS,
  RANKS,
  REPUTATION_NEUTRAL,
  REPUTATION_STEP,
  SCALES,
  USED_CONDITION,
  WINTER_CANCEL_SHARE,
  WINTER_CHANCE,
  WINTER_MONTHS,
  type CampaignTier,
  WEEKS_PER_MONTH,
  type GoalTag,
  type RivalPersonality,
} from '../model/constants';
import { atCost } from '../model/basics';
import { reputationFactor } from '../model/marketSplit';
import { defectChance } from '../model/monthEvents';
import { goalBase, goalReward, milestoneDef, reputationChange, reputationTarget, researchPrice } from '../model/progress';
import { musd, num, pct, usd, type Check, type Section, type Table } from './report';
import { bestDeparturesCase, caseMarket, ROUTE_CASES, runCase, type CaseResult, type RouteCase } from './routes';
import { modelAirport, monthOf, NEUTRAL_INPUTS, runMarket, sampleMonth, seatsTotal, type MarketSpec } from './world';
import { campaignCost } from '../model/costTotals';

// ---------------------------------------------------------------------------
// Ruf aus Satisfaction (6.1) und Ausstattung
// ---------------------------------------------------------------------------

/** Forschung, die Satisfaction-Punkte bringt (6.9): sat-1 … sat-6 je 1, cabin 2 = 8 Punkte. */
export const SATISFACTION_RESEARCH: readonly string[] = ['sat-1', 'sat-2', 'sat-3', 'sat-4', 'sat-5', 'sat-6', 'cabin'];

/** Satisfaction, die ein Ruf-Ziel braucht (Umkehrung von `satisfactionReputation`, 6.1). */
export function satisfactionForReputation(reputation: number): number {
  const neutral = SCALES.satisfaction.neutral;
  if (reputation <= REPUTATION_NEUTRAL) return (neutral * reputation) / REPUTATION_NEUTRAL;
  return neutral + ((SCALES.satisfaction.max - neutral) * (reputation - REPUTATION_NEUTRAL)) / (SCALES.reputation.max - REPUTATION_NEUTRAL);
}

/** Eine Strecke für die Ausstattungs-Vergleiche. */
interface SatisfactionRoute {
  readonly label: string;
  readonly from: string;
  readonly to: string;
  readonly typeId: string;
  readonly year: number;
  readonly departures: number;
}

const EQUIPMENT_ROUTES: readonly SatisfactionRoute[] = [
  { label: 'A320ceo FRA–MAD 1990', from: 'FRA', to: 'MAD', typeId: 'a320ceo', year: 1990, departures: 14 },
  { label: 'A330-300 FRA–JFK 1995', from: 'FRA', to: 'JFK', typeId: 'a330-300', year: 1995, departures: 14 },
];

/** Airline satisfaction einer Ausstattung allein auf einer Strecke. */
export interface EquipmentResult {
  readonly route: string;
  readonly personality: RivalPersonality;
  /** Ohne Forschung. */
  readonly satisfaction: number;
  /** Mit allen Satisfaction-Projekten (+8 Punkte, 6.9). */
  readonly satisfactionResearch: number;
}

/** Airline satisfaction (2.9) jeder Ausstattung (Persönlichkeit, 7.5) auf den Vergleichs-Strecken. */
export function equipmentResults(): EquipmentResult[] {
  const out: EquipmentResult[] = [];
  for (const r of EQUIPMENT_ROUTES) {
    for (const p of PERSONALITY_IDS) {
      const sat = (research: readonly string[]) =>
        runMarket({
          from: r.from,
          to: r.to,
          month: sampleMonth(r.year),
          offers: [{ company: 'a', typeId: r.typeId, personality: p, departures: r.departures, inputs: { ...NEUTRAL_INPUTS, completedResearch: research } }],
        }).a.airlineSatisfaction;
      out.push({ route: r.label, personality: p, satisfaction: sat([]), satisfactionResearch: sat(SATISFACTION_RESEARCH) });
    }
  }
  return out;
}

/** Ruf-Ziel ohne Ausfälle und Werbung. */
const targetOf = (satisfaction: number) => reputationTarget({ airlineSatisfaction: satisfaction });

/** Höchster Rang, dessen Ruf-Schwelle ein Ruf-Ziel erfüllt (nur die Ruf-Spalte, 6.7). */
export function highestRankByReputation(reputation: number): number {
  let rank = 0;
  for (const r of RANKS) if (reputation >= r.requires.reputation) rank = r.index;
  return rank;
}

/** Ruf nach `months` Monaten mit gleichem Ruf-Ziel-Eingang (6.5). */
export function reputationAfter(start: number, months: number, input: Parameters<typeof reputationChange>[1]): number {
  let rep = start;
  for (let i = 0; i < months; i++) rep = reputationChange(rep, input).reputation;
  return rep;
}

// ---------------------------------------------------------------------------
// Gestrichene Flüge (6.2): erwarteter Anteil und Wirkung eines Ausfalls
// ---------------------------------------------------------------------------

/**
 * Erwarteter Anteil gestrichener Sitze je Monat für ein Flugzeug auf einer Strecke mit beiden Enden in einer
 * Winter-Region (z. B. FRA–MAD), ohne Charter, ohne Hangar (8.6): Defekt, Flughafen-Streik an zwei Enden,
 * Winterwetter im Jahresmittel.
 */
export function expectedCancelledShare(airframe: number, ageYears: number, month = sampleMonth(1990)): number {
  const defect = defectChance({ airframeCondition: airframe, builtMonth: month - ageYears * 12, month, hasHangar: false, defectFactor: 1 }) * DEFECT_CANCEL_SHARE;
  const strike = 1 - (1 - AIRPORT_STRIKE_CHANCE * AIRPORT_STRIKE_CANCEL_SHARE) ** 2;
  const weather = (WINTER_CHANCE * WINTER_CANCEL_SHARE * WINTER_MONTHS.length) / 12;
  return 1 - (1 - defect) * (1 - strike) * (1 - weather);
}

/** Zellen-Zustand nach Alter wie im Gebrauchtmarkt (8.11, Mitte ohne Streuung). */
export const typicalAirframe = (age: number) => Math.min(100, USED_CONDITION.airframe.start - USED_CONDITION.airframe.perYear * age);

/** Monate, bis ein Ruf-Abstand auf unter `gap` Punkte geschrumpft ist (6.5: je Monat × (1 − REPUTATION_STEP)). */
export function monthsToRecover(drop: number, gap = 1): number {
  if (drop <= gap) return 0;
  return Math.ceil(Math.log(gap / drop) / Math.log(1 - REPUTATION_STEP));
}

// ---------------------------------------------------------------------------
// Rang-Beispiele: Klassen-Forschung (6.8) und Jahresziel (6.11)
// ---------------------------------------------------------------------------

/** Eine Gesellschaft, die die Bedingungen eines Rangs gerade erfüllt, mit einer typischen Strecke ihrer Zeit. */
export interface RankCase {
  readonly rank: number;
  /** Frühester Monat des Rangs (Tabelle „Prüfung der Erreichbarkeit“, 6.8). */
  readonly reachedMonth: number;
  readonly reachedLabel: string;
  /** Typische Strecke mit einem Flugzeug der Klassen, die bis dahin offen sind. */
  readonly route: RouteCase;
}

export const RANK_CASES: readonly RankCase[] = [
  { rank: 1, reachedMonth: monthOf(1960, 4), reachedLabel: 'April 1960', route: { label: 'F27-200 HAM–NUE 1960 (Commuter)', from: 'HAM', to: 'NUE', typeId: 'f27-200', year: 1960, departures: 14, personality: 'flag', short: true } },
  { rank: 2, reachedMonth: monthOf(1961, 1), reachedLabel: 'Jan. 1961', route: { label: 'Caravelle III FRA–CDG 1961 (Regional)', from: 'FRA', to: 'CDG', typeId: 'caravelle-iii', year: 1961, departures: 14, personality: 'flag', short: true } },
  { rank: 4, reachedMonth: monthOf(1966, 1), reachedLabel: 'Jan. 1966', route: { label: '727-100 FRA–MAD 1966 (Narrowbody)', from: 'FRA', to: 'MAD', typeId: '727-100', year: 1966, departures: 14, personality: 'flag' } },
  { rank: 5, reachedMonth: monthOf(1970, 1), reachedLabel: 'Jan. 1970', route: { label: '727-200 FRA–MAD 1970 (Narrowbody)', from: 'FRA', to: 'MAD', typeId: '727-200', year: 1970, departures: 14, personality: 'flag' } },
];

/** Marge für die Vergleichs-Spalte „bei kleinerer Marktgröße“ (Ziel nach E67: 10–25 %). */
export const LOW_MARGIN = 0.1;

/** Ergebnis eines Rang-Beispiels. */
export interface RankCaseResult {
  readonly rc: RankCase;
  readonly result: CaseResult;
  /** Ids und Preis (im Monat des Rangs) der Klassen-Forschung, die mit diesem Rang erscheint. */
  readonly projects: readonly { readonly id: string; readonly title: string; readonly price: number }[];
  readonly resultPerPax: number;
  readonly revenuePerPax: number;
  /** Monatsergebnis der Strecken bei genau `monthlyPax` des Rangs. */
  readonly monthlyResult: number;
  readonly monthlyRevenue: number;
  /** Monatsergebnisse für die ganze Klassen-Forschung des Rangs. */
  readonly monthsToPay: number;
  /** … bei einer Marge von `LOW_MARGIN`. */
  readonly monthsToPayLowMargin: number;
}

export function runRankCase(rc: RankCase): RankCaseResult {
  const result = runCase(bestDeparturesCase(rc.route));
  const pax = seatsTotal(result.route.passengers) + seatsTotal(result.route.transferPassengers);
  const resultPerPax = result.route.result / pax;
  const revenuePerPax = result.route.revenue / pax;
  const monthlyPax = RANKS[rc.rank].requires.monthlyPax;
  const projects = Object.values(CLASS_RESEARCH)
    .filter((p) => p.rank === rc.rank)
    .map((p) => ({ id: p.id, title: p.title, price: researchPrice(p.id, rc.reachedMonth) }));
  const price = projects.reduce((s, p) => s + p.price, 0);
  const monthlyResult = monthlyPax * resultPerPax;
  const monthlyRevenue = monthlyPax * revenuePerPax;
  return {
    rc,
    result,
    projects,
    resultPerPax,
    revenuePerPax,
    monthlyResult,
    monthlyRevenue,
    monthsToPay: monthlyResult > 0 ? price / monthlyResult : Number.POSITIVE_INFINITY,
    monthsToPayLowMargin: price / (monthlyRevenue * LOW_MARGIN),
  };
}

/** Jahresziel eines Rang-Beispiels (6.11): Bezugsgröße, Prämien, Mindest-Wahrscheinlichkeit für das hohe Ziel. */
export interface GoalCase {
  readonly label: string;
  readonly month: number;
  readonly yearProfit: number;
  readonly yearRevenue: number;
  readonly base: number;
  readonly reward: Readonly<Record<GoalTag, number>>;
  /** Prämie gleich dem Mindestbetrag. */
  readonly minBinds: Readonly<Record<GoalTag, boolean>>;
  /**
   * Chance, die das hohe Ziel mindestens braucht, damit es im Mittel mehr bringt als ein sicher erreichtes sicheres Ziel:
   * `(R_sicher / R_hoch + k) / (1 + k)` mit `k = GOAL_MISS_PENALTY_SHARE`.
   */
  readonly stretchBreakEven: number;
}

export function goalCase(label: string, yearProfit: number, yearRevenue: number, month: number): GoalCase {
  const base = goalBase(yearProfit, yearRevenue, month);
  const tags: GoalTag[] = ['steady', 'focus', 'stretch'];
  const reward = Object.fromEntries(tags.map((t) => [t, goalReward(t, base, month)])) as Record<GoalTag, number>;
  const minimum = atCost(GOAL_MIN_REWARD_1960, month);
  const minBinds = Object.fromEntries(tags.map((t) => [t, Math.abs(reward[t] - minimum) < 1e-6])) as Record<GoalTag, boolean>;
  const k = GOAL_MISS_PENALTY_SHARE;
  return { label, month, yearProfit, yearRevenue, base, reward, minBinds, stretchBreakEven: (reward.steady / reward.stretch + k) / (1 + k) };
}

// ---------------------------------------------------------------------------
// Abschnitt
// ---------------------------------------------------------------------------

const PERSONALITY_NAME: Readonly<Record<RivalPersonality, string>> = {
  lcc: 'LCC',
  expansionist: 'Expansionist',
  optimizer: 'Optimizer',
  flag: 'Flag',
  boutique: 'Boutique',
};

/** Strecken für die Werbe-Rechnung (B6.9). */
export const ADVERTISING_ROUTES = ['A320ceo FRA–MAD 1990', 'A320ceo FRA–MAD 2019'];

/** Werbung auf einer typischen Strecke (B6.9). */
export interface AdvertisingCase {
  readonly label: string;
  readonly tier: CampaignTier;
  readonly cost: number;
  readonly paxRatio: number;
  readonly gain: number;
  readonly breakEvenRoutes: number;
}

export function advertisingCase(label: string, tier: CampaignTier): AdvertisingCase {
  const c = bestDeparturesCase(ROUTE_CASES.find((x) => x.label === label) as RouteCase);
  const r = runCase(c);
  const plain = caseMarket(c, r.best, c.departures);
  const month = plain.month;
  const regions = tier === 'global' ? [] : [modelAirport(c.from).region];
  const withAd: MarketSpec = { ...plain, offers: plain.offers.map((o) => ({ ...o, inputs: { ...NEUTRAL_INPUTS, campaigns: [{ tier, regions, endMonth: month }] } })) };
  const a = runMarket(plain).a;
  const b = runMarket(withAd).a;
  const gain = (b.routes[0].result - a.routes[0].result) * WEEKS_PER_MONTH;
  const cost = campaignCost(tier, month);
  return { label, tier, cost, paxRatio: b.passengers / a.passengers, gain, breakEvenRoutes: gain > 0 ? cost / gain : Number.POSITIVE_INFINITY };
}

export function careerSection(
  equipment: readonly EquipmentResult[] = equipmentResults(),
  rankCases: readonly RankCaseResult[] = RANK_CASES.map(runRankCase),
): Section {
  const checks: Check[] = [];
  const tables: Table[] = [];

  // ---- 6.1 Ruf-Steigungen ----
  const flag = equipment.filter((e) => e.personality === 'flag');
  const flagTargets = flag.map((e) => targetOf(e.satisfaction));
  const sortedTargets = equipment.map((e) => targetOf(e.satisfaction)).sort((a, b) => a - b);
  const mid = sortedTargets.length / 2;
  const medianTarget = sortedTargets.length % 2 === 0 ? (sortedTargets[mid - 1] + sortedTargets[mid]) / 2 : sortedTargets[Math.floor(mid)];
  checks.push({
    id: 'B6.1',
    spec: '6.1, E36',
    rule: 'Ruf-Ziel bei üblicher Satisfaction um 50: Median der Ruf-Ziele aller Ausstattungen (5 Persönlichkeiten × 2 Strecken, ohne Forschung) in 40 … 60',
    value: `Median ${num(medianTarget, 1)}; Flag: ${flag.map((e, i) => `${e.route} Satisfaction ${num(e.satisfaction, 0)} → ${num(flagTargets[i], 1)}`).join(', ')}`,
    verdict: Math.abs(medianTarget - REPUTATION_NEUTRAL) <= 10 ? 'ok' : 'abweichung',
  });
  const all = equipment.flatMap((e) => [targetOf(e.satisfaction), targetOf(e.satisfactionResearch)]);
  checks.push({
    id: 'B6.2',
    spec: '6.1',
    rule: 'Steigungen 0,5 (unter 100) und 0,83 (über 100): Spanne der Ruf-Ziele aller Ausstattungen, mit und ohne Forschung',
    value: `${num(Math.min(...all), 1)} … ${num(Math.max(...all), 1)} (Satisfaction ${num(Math.min(...equipment.map((e) => e.satisfaction)), 0)} … ${num(Math.max(...equipment.map((e) => e.satisfactionResearch)), 0)})`,
    verdict: 'info',
  });
  tables.push({
    title: 'Satisfaction und Ruf-Ziel je Ausstattung (allein auf der Strecke, Mai)',
    header: ['Strecke', 'Ausstattung', 'Airline satisfaction', 'Ruf-Ziel', 'Rang nach Ruf', 'mit Forschung (+8)', 'Ruf-Ziel', 'Rang nach Ruf'],
    rows: equipment.map((e) => {
      const t = targetOf(e.satisfaction);
      const tr = targetOf(e.satisfactionResearch);
      return [e.route, PERSONALITY_NAME[e.personality], num(e.satisfaction, 1), num(t, 1), String(highestRankByReputation(t)), num(e.satisfactionResearch, 1), num(tr, 1), String(highestRankByReputation(tr))];
    }),
    note: 'Kabine und Service nach `rivalCabin` / `rivalService` (7.5), neues Flugzeug, Lohn 100 %, keine Ausfälle, keine Werbung. „Mit Forschung“: sat-1 … sat-6 und cabin (6.9). „Rang nach Ruf“: höchster Rang, dessen Ruf-Schwelle das Ziel erfüllt (nur diese Spalte der Rang-Tabelle).',
  });

  // ---- 6.2 Gestrichene Flüge ----
  const ages = [0, 10, 20];
  const expected = ages.map((a) => expectedCancelledShare(typicalAirframe(a), a));
  const singleDrop = REPUTATION_STEP * CANCELLED_REPUTATION_WEIGHT * DEFECT_CANCEL_SHARE;
  checks.push({
    id: 'B6.3',
    spec: '6.2, 8.6',
    rule: '`CANCELLED_REPUTATION_WEIGHT` = 100: erwarteter Abzug im Ruf-Ziel und Wirkung eines Defekts (ohne Charter)',
    value: `erwartet ${ages.map((a, i) => `Alter ${a}: ${num(CANCELLED_REPUTATION_WEIGHT * expected[i], 2)}`).join(', ')} Punkte; ein Defekt bei 1 Flugzeug: Ruf −${num(singleDrop, 1)} im Monat, ${monthsToRecover(singleDrop)} Monate bis < 1 Punkt; bei 10 Flugzeugen −${num(singleDrop / 10, 2)}`,
    verdict: 'info',
  });
  const shares = [0.01, 0.05, 0.1, 0.25, 0.5];
  tables.push({
    title: 'Gestrichene Sitze in einem Monat: Ruf-Verlust (Ruf im Gleichgewicht, danach keine Ausfälle)',
    header: ['Anteil gestrichen', 'Abzug im Ziel', 'Ruf-Verlust im Monat', 'Monate bis < 1 Punkt', 'entspricht Satisfaction-Punkten (unter 100)'],
    rows: shares.map((s) => {
      const drop = REPUTATION_STEP * CANCELLED_REPUTATION_WEIGHT * s;
      return [pct(s), num(CANCELLED_REPUTATION_WEIGHT * s, 1), num(drop, 2), String(monthsToRecover(drop)), num((CANCELLED_REPUTATION_WEIGHT * s * SCALES.satisfaction.neutral) / REPUTATION_NEUTRAL, 0)];
    }),
    note: `Ein Defekt streicht ${pct(DEFECT_CANCEL_SHARE)} der Flüge eines Flugzeugs (8.6); bei einer Gesellschaft mit einem Flugzeug ist das ein Anteil von ${pct(DEFECT_CANCEL_SHARE)}. Erwarteter Anteil je Monat (Defekt, Flughafen-Streik an zwei Enden, Winter im Jahresmittel; Zelle nach Alter wie im Gebrauchtmarkt): ${ages.map((a, i) => `Alter ${a} ${pct(expected[i], 2)}`).join(', ')}. Gecharterte Flüge zählen nicht (E32).`,
  });

  // ---- 6.3 Werbe-Beitrag ----
  const tiers: CampaignTier[] = ['local', 'national', 'global'];
  const campaignRows = [...tiers.map((t) => [t]), tiers].map((set) => {
    const input = { airlineSatisfaction: SCALES.satisfaction.neutral, campaigns: set };
    const after12 = reputationAfter(REPUTATION_NEUTRAL, 12, input);
    const eq = reputationAfter(REPUTATION_NEUTRAL, 240, input);
    const off6 = reputationAfter(after12, 6, { airlineSatisfaction: SCALES.satisfaction.neutral });
    return { set, after12, eq, off6 };
  });
  const maxRise = Math.max(...campaignRows.map((r) => r.eq - REPUTATION_NEUTRAL));
  checks.push({
    id: 'B6.4',
    spec: '6.3, E37',
    rule: `Werbung hebt den Ruf im Gleichgewicht um höchstens ${num(ADVERTISING_REPUTATION_MAX)} Punkte und klingt nach dem Ende ab`,
    value: `größter Anstieg ${num(maxRise, 2)} (alle drei Kampagnen); Nachfrage-Wirkung über den Ruf ${pct(reputationFactor(REPUTATION_NEUTRAL + maxRise) - 1, 1)}`,
    verdict: maxRise <= ADVERTISING_REPUTATION_MAX + 1e-9 ? 'ok' : 'abweichung',
  });
  tables.push({
    title: 'Werbe-Beitrag: Satisfaction 100, Start Ruf 50',
    header: ['Kampagnen', 'Beitrag', 'Ruf nach 12 Monaten', 'Gleichgewicht', '6 Monate nach dem Ende'],
    rows: campaignRows.map((r) => [r.set.join(' + '), num(Math.min(ADVERTISING_REPUTATION_MAX, r.set.reduce((s, t) => s + CAMPAIGN_REPUTATION[t], 0)), 1), num(r.after12, 2), num(r.eq, 2), num(r.off6, 2)]),
    note: 'Der Beitrag steht im Ruf-Ziel (6.4); die Hauptwirkung der Werbung ist die Anziehung (3.9.5), nicht der Ruf.',
  });

  // ---- 3.9.5, 5.14 Werbung: Kosten gegen Mehr-Ergebnis (5.3a) ----
  const ads = ADVERTISING_ROUTES.flatMap((label) => tiers.map((tier) => advertisingCase(label, tier)));
  checks.push({
    id: 'B6.9',
    spec: '3.9.5, 5.14',
    rule: 'Werbung: Kosten je Monat ÷ Mehr-Ergebnis je Strecke (Strecken, ab denen eine Kampagne sich trägt)',
    value: ads.map((a) => `${a.label.split(' ').pop()} ${a.tier} ${num(a.breakEvenRoutes, 1)}`).join('; '),
    verdict: 'info',
  });
  tables.push({
    title: 'Werbung: eine Kampagne in der Region der Strecke (global: weltweit), Strecke allein beim besten Preis ohne Werbung',
    header: ['Strecke', 'Kampagne', 'Kosten je Monat', 'Fluggäste mit ÷ ohne', 'Mehr-Ergebnis je Monat', 'Strecken bis zur Deckung'],
    rows: ads.map((a) => [a.label, a.tier, usd(a.cost), num(a.paxRatio, 3), usd(a.gain), num(a.breakEvenRoutes, 1)]),
    note: 'Preis fest (bester Preis ohne Werbung). Mehr-Ergebnis = (Strecken-Ergebnis mit − ohne Kampagne) × `WEEKS_PER_MONTH`. Eine regionale Kampagne wirkt auf alle Strecken mit einem Ende in der Region (3.9.5); „Strecken bis zur Deckung“ zählt gleich große Strecken.',
  });

  // ---- 6.7 Ruf-Schwellen der Ränge, 6.10 Ruf-Meilensteine ----
  const best = Math.max(...equipment.map((e) => targetOf(e.satisfactionResearch)));
  const bestNoResearch = Math.max(...equipment.map((e) => targetOf(e.satisfaction)));
  const flagBest = Math.min(...flagTargets);
  const reach = (rep: number) => {
    const w = equipment.filter((e) => targetOf(e.satisfaction) >= rep).map((e) => `${PERSONALITY_NAME[e.personality]} (${e.route.split(' ')[1]})`);
    const r = equipment.filter((e) => targetOf(e.satisfaction) < rep && targetOf(e.satisfactionResearch) >= rep).map((e) => `${PERSONALITY_NAME[e.personality]} (${e.route.split(' ')[1]})`);
    return { w, r };
  };
  const thresholdRows: string[][] = [];
  for (const r of RANKS.slice(1)) {
    const { w, r: withR } = reach(r.requires.reputation);
    thresholdRows.push([`Rang ${r.index} ${r.title}`, num(r.requires.reputation), num(satisfactionForReputation(r.requires.reputation), 0), w.join(', ') || '–', withR.join(', ') || '–']);
  }
  for (const id of ['reputation-bronze', 'reputation-silver', 'reputation-gold']) {
    const def = milestoneDef(id);
    const { w, r: withR } = reach(def.threshold);
    thresholdRows.push([`Meilenstein ${def.title}`, num(def.threshold), num(satisfactionForReputation(def.threshold), 0), w.join(', ') || '–', withR.join(', ') || '–']);
  }
  const top = RANKS[RANKS.length - 1].requires.reputation;
  checks.push({
    id: 'B6.5',
    spec: '6.7, E36',
    rule: `Ruf-Schwellen der Ränge: Rang 9 (Ruf ${num(top)}) ist mit der besten Ausstattung und Forschung erreichbar; Rang 5 (Ruf ${num(RANKS[5].requires.reputation)}) mit üblicher (Flag) Ausstattung`,
    value: `bestes Ziel ${num(best, 1)} (ohne Forschung ${num(bestNoResearch, 1)}); Flag ohne Forschung ≥ ${num(flagBest, 1)}`,
    verdict: best >= top && flagBest >= RANKS[5].requires.reputation ? 'ok' : 'abweichung',
  });
  const milestoneGold = milestoneDef('reputation-gold').threshold;
  checks.push({
    id: 'B6.6',
    spec: '6.10',
    rule: 'Ruf-Meilensteine 60 / 70 / 80: Satisfaction, die sie brauchen, und ob eine Ausstattung sie erreicht',
    value: `${['reputation-bronze', 'reputation-silver', 'reputation-gold'].map((id) => `${num(milestoneDef(id).threshold)} → Satisfaction ${num(satisfactionForReputation(milestoneDef(id).threshold), 0)}`).join(', ')}; Gold ${best >= milestoneGold ? 'erreichbar' : 'mit keiner Ausstattung erreichbar'}`,
    verdict: 'info',
  });
  tables.push({
    title: 'Ruf-Schwellen: nötige Satisfaction und Ausstattungen, die sie erreichen',
    header: ['Stufe', 'Ruf', 'Satisfaction nötig', 'erreicht ohne Forschung', 'erreicht erst mit Forschung'],
    rows: thresholdRows,
    note: 'Ausstattungen aus der Tabelle oben (allein auf der Strecke, keine Ausfälle). Das Ruf-Ziel wird nach rund einem Jahr fast erreicht (Halbwertszeit 4,3 Monate, 6.5).',
  });

  // ---- 6.8 Klassen-Forschung ----
  const worst = Math.max(...rankCases.map((r) => r.monthsToPay));
  checks.push({
    id: 'B6.7',
    spec: '6.8',
    rule: 'Eine Gesellschaft, die die Bedingungen eines Rangs gerade erfüllt, bezahlt die Klassen-Forschung dieses Rangs aus höchstens 12 Monatsergebnissen',
    value: rankCases.map((r) => `Rang ${r.rc.rank}: ${num(r.monthsToPay, 1)} (bei Marge ${pct(LOW_MARGIN)}: ${num(r.monthsToPayLowMargin, 1)})`).join('; '),
    verdict: worst <= 12 ? 'ok' : 'abweichung',
  });
  tables.push({
    title: 'Klassen-Forschung gegen das Monatsergebnis einer Gesellschaft an der Rang-Schwelle',
    header: ['Rang (frühestens)', 'Strecke (bester Preis)', 'Fluggäste je Monat (Schwelle)', 'Ergebnis je Fluggast', 'Marge', 'Monatsergebnis', 'Klassen-Forschung', 'Preis', 'Monatsergebnisse', `… bei Marge ${pct(LOW_MARGIN)}`],
    rows: rankCases.map((r) => [
      `${r.rc.rank} (${r.rc.reachedLabel})`,
      r.rc.route.label,
      num(RANKS[r.rc.rank].requires.monthlyPax),
      `${num(r.resultPerPax, 1)} $`,
      pct(r.result.margin),
      musd(r.monthlyResult, 2),
      r.projects.map((p) => p.title).join(' + '),
      musd(r.projects.reduce((s, p) => s + p.price, 0), 2),
      num(r.monthsToPay, 1),
      num(r.monthsToPayLowMargin, 1),
    ]),
    note: 'Monatsergebnis = Fluggäste der Rang-Schwelle × Ergebnis je Fluggast der typischen Strecke beim besten Preis (Strecken-Ergebnis 5.9, ohne Kosten der Gesellschaft wie Flughäfen und Verwaltung). Preis im Monat des Rangs (`atCost`). Die letzte Spalte rechnet mit 10 % Marge auf denselben Erlös (Ziel nach E67: 10–25 %).',
  });

  // ---- 6.11 Jahresziel ----
  const goals = [
    ...rankCases.map((r) => goalCase(`Rang ${r.rc.rank}, ${r.rc.route.year}`, 12 * r.monthlyResult, 12 * r.monthlyRevenue, r.rc.reachedMonth)),
    ...rankCases.slice(-1).map((r) => goalCase(`Rang ${r.rc.rank}, ${r.rc.route.year}, Marge ${pct(LOW_MARGIN)}`, 12 * r.monthlyRevenue * LOW_MARGIN, 12 * r.monthlyRevenue, r.rc.reachedMonth)),
    ...rankCases.slice(-1).map((r) => goalCase(`Rang ${r.rc.rank}, ${r.rc.route.year}, Verlustjahr (−5 %)`, -0.05 * 12 * r.monthlyRevenue, 12 * r.monthlyRevenue, r.rc.reachedMonth)),
  ];
  const big = goals.filter((g) => !g.minBinds.stretch);
  checks.push({
    id: 'B6.8',
    spec: '6.11, E58',
    rule: 'Ziel-, Prämien- und Straf-Anteile: Prämie in Monatsergebnissen und nötige Chance, damit das hohe Ziel mehr bringt als das sichere',
    value: `Prämie sicher / hoch = ${num(12 * GOAL_REWARD_SHARE.steady, 2)} / ${num(12 * GOAL_REWARD_SHARE.stretch, 2)} Monatsergebnisse (ohne Mindestbetrag); hohes Ziel lohnt ab Chance ${big.length > 0 ? pct(Math.min(...big.map((g) => g.stretchBreakEven))) : '–'}; Mindestprämie bindet bei ${goals.filter((g) => g.minBinds.stretch).length} von ${goals.length} Beispielen (dann lohnt das hohe Ziel nie)`,
    verdict: 'info',
  });
  tables.push({
    title: 'Jahresziel der Rang-Beispiele (Angebot im Monat des Rangs)',
    header: ['Beispiel', 'Vorjahr: Ergebnis', 'Vorjahr: Erlös', 'Bezugsgröße', `sicher (× ${num(GOAL_STEADY_FACTOR, 2)})`, `hoch (× ${num(GOAL_STRETCH_FACTOR, 2)})`, 'Prämie sicher / andere Art / hoch', 'Strafe hoch', 'hohes Ziel lohnt ab Chance'],
    rows: goals.map((g) => [
      g.label,
      musd(g.yearProfit, 2),
      musd(g.yearRevenue, 2),
      musd(g.base, 2),
      musd(GOAL_STEADY_FACTOR * g.base, 2),
      musd(GOAL_STRETCH_FACTOR * g.base, 2),
      (['steady', 'focus', 'stretch'] as const).map((t) => `${musd(g.reward[t], 2)}${g.minBinds[t] ? '*' : ''}`).join(' / '),
      musd(GOAL_MISS_PENALTY_SHARE * g.reward.stretch, 2),
      g.stretchBreakEven >= 1 ? 'nie' : pct(g.stretchBreakEven),
    ]),
    note: `* = Mindestprämie (${musd(GOAL_MIN_REWARD_1960, 2)} von 1960 über \`atCost\`). „Lohnt ab Chance“: Das hohe Ziel bringt im Mittel mehr als ein sicher erreichtes sicheres Ziel, wenn es mit dieser Wahrscheinlichkeit erreicht wird (Strafe = ${pct(GOAL_MISS_PENALTY_SHARE)} der Prämie, E58). Das sichere Ziel selbst lohnt ab einer Chance von ${pct(GOAL_MISS_PENALTY_SHARE / (1 + GOAL_MISS_PENALTY_SHARE))}.`,
  });

  return { title: 'Abschnitt 6: Ruf, Rang, Fortschritt', checks, tables };
}
