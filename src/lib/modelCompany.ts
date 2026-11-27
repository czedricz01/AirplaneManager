/**
 * Kennzahlen der Gesellschaft nach dem Modell (Paket 4.7a, docs/neubau F67): Kopfzeile, Firma und Karriere.
 *
 * Kopfzeile und Firma rechneten Werte selbst: Ereignis-Abschwächung als Kopie von `eventReliefFactor`, „Fleet value“
 * und „Net worth“ aus den Verkaufserlösen, Karriere-Punkte nach der alten Formel (`src/lib/careerScore.ts`), Ruf-Wirkung
 * aus `reputationDemandFactor`, Flotten-Mischung aus `fleetCosts.ts`. Hier kommt alles aus `src/model/`: Krisen-Antwort
 * (8.5), Ruf-Faktor (3.9, E36), Unternehmenswert und Karriere-Punkte (6.12, E48), Kreditlinie (8.14), Flotten-Mischung
 * (5.12), Strafe des Jahresziels (6.11, E58).
 *
 * Alles hier ist rein (keine Zustände, keine globalen Daten).
 */
import type { OwnedAircraft } from '../components/MyFleetView';
import type { Difficulty, HistoricalEventDef } from '../model/constants';
import { BANKRUPTCY_OVERDRAWN_MONTHS, COMMONALITY_DISCOUNTS, FREE_FAMILIES, OVERDRAWN_TO_FORCED_SALE, VARIETY_PENALTY_MAX, VARIETY_PENALTY_PER_FAMILY } from '../model/constants';
import { aircraftValue, commonalityFactor, familyDiscount, varietyPenalty } from '../model/fleet';
import { creditLimit, creditState, type CreditState } from '../model/fleetMarket';
import { reputationFactor } from '../model/marketSplit';
import { crisisResponseFactor, historicalEvent } from '../model/monthEvents';
import type { CompanyState, ModelState } from '../model/monthClose';
import { careerScore, companyValue, completedBonusResearch, type GameMode } from '../model/progress';
import { companyValueOf } from '../model/rivalMonth';
import type { ScoreBreakdown } from './careerScore';
import { aircraftState } from './modelBridge';
import { PLAYER_ID } from './modelMonth';

// ===========================================================================
// Unternehmenswert (6.12, E48) und Kreditlinie (8.14)
// ===========================================================================

/** Was die Gesellschaft wert ist, nach Teilen. */
export interface CompanyWorth {
  readonly cash: number;
  /** Σ `aircraftValue` der Flotte (5.13): Flottenwert des Kassenbuchs und der Kreditgrenze. */
  readonly fleetValue: number;
  /** Σ Verkaufswert der eigenen Slots (5.10). */
  readonly slotValue: number;
  /** Σ Anzahlungen auf Vorbestellungen (8.12). */
  readonly deposits: number;
  /** Kasse + Flotte + Slots + Anzahlungen: derselbe Wert wie für Übernahme und Karriere-Punkte (`companyValue`). */
  readonly companyValue: number;
}

/** Unternehmenswert einer Gesellschaft im Monat `month` (`companyValueOf`, `companyValue`). */
export function companyWorth(company: CompanyState, month: number): CompanyWorth {
  const input = companyValueOf(company, month);
  return {
    cash: input.cash,
    fleetValue: input.aircraftValues.reduce((s, v) => s + v, 0),
    slotValue: input.slotResaleValue,
    deposits: input.preorderDeposits ?? 0,
    companyValue: companyValue(input),
  };
}

/** Der Spieler im Modell-Spielstand; ohne Spieler ein Fehler. */
export function playerCompany(state: ModelState): CompanyState {
  const player = state.companies.find((c) => c.id === PLAYER_ID);
  if (!player) throw new Error('Kein Spieler im Modell-Spielstand');
  return player;
}

/**
 * Unternehmenswert des Spielers. Mit Modell-Spielstand aus dem Modell; ohne (Ansicht außerhalb des Spiels, Fehler beim
 * Lesen) nur Kasse und Flotte nach `aircraftValue` (Slots und Anzahlungen fehlen dann).
 */
export function playerWorth(state: ModelState | null | undefined, fallback: { readonly cash: number; readonly fleet: readonly OwnedAircraft[]; readonly month: number }): CompanyWorth {
  if (state) return companyWorth(playerCompany(state), state.month);
  const fleetValue = fallback.fleet.reduce((s, p) => s + aircraftValue(aircraftState(p), fallback.month), 0);
  return { cash: fallback.cash, fleetValue, slotValue: 0, deposits: 0, companyValue: fallback.cash + fleetValue };
}

/** Stand der Kreditlinie (8.14) für Kopfzeile und Firma. */
export interface CreditStatus {
  /** `CREDIT_LIMIT_SHARE × Flottenwert`. */
  readonly limit: number;
  /** Genutzter Kredit: max(0, −Kasse). */
  readonly used: number;
  readonly state: CreditState;
  /** Überzogene Monatsenden in Folge (Spielstand `overdrawnMonths`). */
  readonly overdrawnMonths: number;
  /**
   * Abschlüsse bis zum ersten Zwangsverkauf, wenn die Kasse so bleibt: 1 = der nächste. Nur bei `overdrawn`, sonst null.
   * Der nächste Abschluss zählt den Monat mit (`nextOverdrawnMonths`), verkauft wird ab `OVERDRAWN_TO_FORCED_SALE`.
   */
  readonly closesToForcedSale: number | null;
  /** Abschlüsse bis zum Spielende, wenn die Kasse so bleibt (E93); nur bei `overdrawn`, sonst null. */
  readonly closesToBankruptcy: number | null;
}

/** Kreditlinie aus Kasse, Flottenwert und überzogenen Monaten (`creditLimit`, `creditState`, `forcedSale`). */
export function creditStatus(cash: number, fleetValue: number, overdrawnMonths: number, difficulty: Difficulty = 'Normal'): CreditStatus {
  const limit = creditLimit(fleetValue);
  const state = creditState(cash, limit);
  return {
    limit,
    used: Math.max(0, -cash),
    state,
    overdrawnMonths,
    closesToForcedSale: state === 'overdrawn' ? Math.max(1, OVERDRAWN_TO_FORCED_SALE - overdrawnMonths) : null,
    closesToBankruptcy: state === 'overdrawn' ? Math.max(1, BANKRUPTCY_OVERDRAWN_MONTHS[difficulty] - overdrawnMonths) : null,
  };
}

// ===========================================================================
// Karriere-Punkte (6.12)
// ===========================================================================

/** Was die Karriere-Punkte aus dem Spielstand brauchen. */
export interface ScoreSource {
  readonly companyValue: number;
  readonly month: number;
  readonly rank: number;
  readonly free: boolean;
  readonly milestones: number;
  readonly reputation: number;
  readonly takeovers: number;
  /** Fertige Forschung (Kennungen); es zählen nur Bonus-Projekte (`completedBonusResearch`). */
  readonly researchDone: readonly string[];
  /** Gespielte Jahre (es zählen volle). */
  readonly years: number;
}

/**
 * Karriere-Punkte nach dem Modell (`careerScore`, 6.12) in der Form der Oberfläche (`ScoreBreakdown`): Teile auf ganze
 * Punkte gerundet, Summe aus den ungerundeten Teilen gerundet. „development“ = Bonus-Forschung, „longevity“ = Jahre.
 */
export function playerScore(src: ScoreSource): ScoreBreakdown {
  const mode: GameMode = src.free ? 'free' : 'normal';
  const s = careerScore({
    companyValue: src.companyValue,
    month: src.month,
    rank: src.rank,
    mode,
    milestones: src.milestones,
    reputation: src.reputation,
    takeovers: src.takeovers,
    bonusResearch: completedBonusResearch(src.researchDone),
    years: src.years,
  });
  return {
    wealth: Math.round(s.wealth),
    rank: Math.round(s.rank),
    milestones: Math.round(s.milestones),
    reputation: Math.round(s.reputation),
    takeovers: Math.round(s.takeovers),
    development: Math.round(s.research),
    longevity: Math.round(s.years),
    total: Math.round(s.total),
  };
}

// ===========================================================================
// Kopfzeile: Weltereignisse mit Krisen-Antwort (8.5)
// ===========================================================================

/** Das geschichtliche Ereignis des Modells zu einem Titel; ein Zufallsereignis hat keins (undefined). */
function modelEvent(title: string): HistoricalEventDef | undefined {
  try {
    return historicalEvent(title);
  } catch {
    return undefined;
  }
}

/** Wirkung eines laufenden Ereignisses auf die Fluggäste des Spielers. */
export interface EventEffect {
  /** Faktor des Ereignisses auf die Reiselust (Markt, für alle gleich). */
  readonly market: number;
  /** Faktor für den Spieler: mit gekaufter Rückgewinnung `market × crisisResponseFactor`, sonst `market`. */
  readonly player: number;
}

/**
 * Faktor eines Ereignisses für den Spieler (8.5): Hat er die Rückgewinnung gekauft (`recovered`, Titel aus
 * `crisisResponses(...).recovery`), wirkt `crisisResponseFactor(f, r)` auf seine Anziehung, also `f + (1 − f) × r`
 * statt `f`. Faktor und Anteil aus den Daten des Modells; ein Zufallsereignis hat keine Antwort.
 */
export function eventEffect(title: string, demandMultiplier: number, recovered: readonly string[]): EventEffect {
  const def = modelEvent(title);
  const market = def?.demandMultiplier ?? demandMultiplier;
  const share = def?.response?.kind === 'demandRecovery' && recovered.includes(title) ? def.response.recoveryShare ?? 0 : 0;
  return { market, player: share > 0 ? market * crisisResponseFactor(market, share) : market };
}

// ===========================================================================
// Firma: Ruf, Flotten-Mischung, Jahresziel
// ===========================================================================

/** Wirkung des Rufs auf die Anziehung der eigenen Angebote (3.9, E36): Ruf 50 = 1. */
export function reputationEffect(reputation: number): number {
  return reputationFactor(reputation);
}

/** Flotten-Mischung (5.12) für die Firma: Familien, Nachlass, Zuschlag, mittlerer Faktor. */
export interface FleetMix {
  /** Familien der Flotte, größte zuerst (gleich große nach Namen). */
  readonly families: readonly { readonly family: string; readonly count: number; readonly discount: number }[];
  /** Zuschlag auf jedes Flugzeug (`varietyPenalty`). */
  readonly penalty: number;
  /** Mittel von `commonalityFactor` über die Flotte; 1 ohne Flugzeuge. */
  readonly meanFactor: number;
}

/** Flotten-Mischung aus den Familien der Flugzeuge (Familie des Typs wie im Modell, `aircraftState`). */
export function fleetMix(fleet: readonly OwnedAircraft[]): FleetMix {
  const counts = new Map<string, number>();
  for (const p of fleet) {
    const family = aircraftState(p).family;
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  const families = [...counts.entries()]
    .map(([family, count]) => ({ family, count, discount: familyDiscount(count) }))
    .sort((a, b) => b.count - a.count || a.family.localeCompare(b.family));
  let sum = 0;
  for (const f of families) sum += f.count * commonalityFactor(f.count, counts.size);
  return { families, penalty: varietyPenalty(counts.size), meanFactor: fleet.length > 0 ? sum / fleet.length : 1 };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Erklärtext der Flotten-Mischung aus den Konstanten (5.12, E52). */
export function fleetMixText(): string {
  const steps = [...COMMONALITY_DISCOUNTS].sort((a, b) => a.from - b.from);
  const list = steps.map((d, i) => `${d.from} ${i === 0 ? `of a kind save ${pct(d.discount)}` : pct(d.discount)}`).join(', ');
  return (
    `Aircraft of one family share crews and spare parts: ${list} on their maintenance. ` +
    `Running more than ${FREE_FAMILIES} families costs ${pct(VARIETY_PENALTY_PER_FAMILY)} on every aircraft for each one beyond, ` +
    `at most ${pct(VARIETY_PENALTY_MAX)}.`
  );
}
