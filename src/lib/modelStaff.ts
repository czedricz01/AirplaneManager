/**
 * Personal nach dem Modell (Paket 4.8, SPEZIFIKATION 8.7, 2.6.4, 5.4): Lohn-Grenzen, Moral-Ziel, Moral im nächsten
 * Monat, Streik-Chance unter dem Pech-Deckel und die Streik-Frage. Ersetzt in der Personal-Ansicht und in `App.tsx`
 * die alte Rechnung `src/lib/staff.ts` (die nur noch der alte Abschluss nutzt).
 *
 * Die Vorschau rechnet genau wie der Übergang zu X+1 im Abschluss (`transition`, `src/model/monthClose.ts`):
 * `moraleTarget` mit dem Monat X+1, `nextMorale`, dann `strikeChance` mit der neuen Moral, nur mit mindestens einer
 * Strecke (8.7, E74) und bei offenem Pech-Deckel (8.8). Einzige Annahme: Die Gewinnserie läuft weiter (das Ergebnis des Monats steht erst am Ende fest).
 *
 * Rein: liest nur seine Eingabe (R12).
 */
import { STRIKE_SETTLED_CANCEL_SHARE } from '../model/constants';
import {
  labourMarketPremium,
  moraleTarget,
  nextMorale,
  salaryFloor as modelSalaryFloor,
  setSalary as modelSetSalary,
  settledSalary,
  strikeCancelShare as modelStrikeCancelShare,
  strikeChance,
} from '../model/monthEvents';
import { nextProfitStreak, researchEffects } from '../model/progress';
import { staffPart } from '../model/satisfaction';
import { formatCurrency } from './format';
import type { GameDecision, Staff } from './gameState';
import { staffStrike } from './modelBridgeCompany';
import { STRIKE_OPTION_RAISE, STRIKE_OPTION_SIT_OUT } from './staff';

export { STRIKE_OPTION_RAISE, STRIKE_OPTION_SIT_OUT };

/** Schrittweite des Lohn-Reglers (nur Oberfläche; Spielstand und Streik-Einigung dürfen andere Werte haben). */
export const SALARY_PCT_STEP = 5;

/** Ein Wort für den Arbeitsmarkt (Personal-Ansicht), aus `labourMarketPremium` (8.7). */
export function labourMarketLabel(points: number): string {
  if (points >= 8) return 'Very tight: crews are scarce';
  if (points >= 4) return 'Tight: airlines are hiring';
  if (points <= -4) return 'Slack: jobs are scarce';
  return 'Balanced';
}

/** Trifft der Streik im Spielstand den Monat `month` (er gilt einen ganzen Monat)? */
export function isStrikeMonth(staff: Pick<Staff, 'strike'>, month: number): boolean {
  return staff.strike?.startOffset === month;
}

/** Gestrichener Anteil aller Flüge durch den Personalstreik im Monat `month` (8.7: 0,5 nach „Raise pay“, sonst 1). */
export function strikeCancelShare(staff: Pick<Staff, 'strike'>, month: number): number {
  return modelStrikeCancelShare(staffStrike(staff.strike), month);
}

/** Niedrigster einstellbarer Lohn im Monat `month`: der vereinbarte, solange der Streik nachwirkt (8.7). */
export function salaryFloor(staff: Pick<Staff, 'strike'>, month: number): number {
  return modelSalaryFloor(staffStrike(staff.strike), month);
}

/** Lohn, wie der Spieler ihn im Monat `month` einstellt: in den Grenzen, nicht unter `salaryFloor` (8.7). */
export function setSalary(staff: Staff, salaryPct: number, month: number): Staff {
  const next = modelSetSalary(salaryPct, staffStrike(staff.strike), month);
  return next === staff.salaryPct ? staff : { ...staff, salaryPct: next };
}

/**
 * Antwort „Raise pay“ auf den Streik im Monat `strikeMonth`: Lohn + `STRIKE_PAY_RAISE` (in den Grenzen), als
 * vereinbart vermerkt; die Hälfte der Flüge fällt aus (8.7). Unverändert, wenn dieser Streik nicht mehr der letzte ist.
 */
export function settleStrike(staff: Staff, strikeMonth: number): Staff {
  if (!staff.strike || staff.strike.startOffset !== strikeMonth) return staff;
  const salaryPct = settledSalary(staff.salaryPct);
  return { ...staff, salaryPct, strike: { ...staff.strike, cancelShare: STRIKE_SETTLED_CANCEL_SHARE, agreedPct: salaryPct } };
}

/** Eingaben der Vorschau. */
export interface StaffOutlookInput {
  readonly staff: Staff;
  /** Laufender Monat X. */
  readonly month: number;
  /** Gewinnserie bis zum letzten Abschluss. */
  readonly profitStreak: number;
  /** Strecken des Spielers (ohne Strecken wächst die Serie nicht, 6.10, und es gibt keinen Streik-Wurf, 8.7). */
  readonly routes: number;
  /** Fertige Forschungen (Σ `moralePoints`, 6.9). */
  readonly completedResearch: readonly string[];
  /** Pech-Deckel offen für X+1 (`badLuckCapOpen`, 8.8); zu = kein Streik-Wurf. */
  readonly capOpen: boolean;
}

/** Was der nächste Abschluss mit der Moral macht, beim Lohn von jetzt. */
export interface StaffOutlook {
  /** Moral-Ziel für X+1 (`moraleTarget`). */
  readonly target: number;
  /** Moral im Monat X+1 (`nextMorale`). */
  readonly nextMorale: number;
  /** Streik-Chance am Monatsende (`strikeChance` der neuen Moral; 0 ohne Strecken oder bei geschlossenem Pech-Deckel). */
  readonly strikeChance: number;
  /** Pech-Deckel offen. */
  readonly capOpen: boolean;
  /** Arbeitsmarkt-Zuschlag im Monat X+1 (Lohn-Punkte). */
  readonly labourMarket: number;
  /** Moral-Punkte aus Forschung. */
  readonly researchMorale: number;
  /** Personal-Teil der Satisfaction jetzt und beim Ziel (`staffPart`, 2.6.4). */
  readonly satisfactionNow: number;
  readonly satisfactionAtTarget: number;
}

/**
 * Vorschau auf den nächsten Abschluss (8.7): dieselben Funktionen wie der Übergang zu X+1. Die Gewinnserie wird als
 * fortgesetzt angenommen (`nextProfitStreak` mit Gewinn).
 */
export function staffOutlook(input: StaffOutlookInput): StaffOutlook {
  const next = input.month + 1;
  const researchMorale = researchEffects(input.completedResearch).moralePoints;
  const target = moraleTarget({
    salaryPct: input.staff.salaryPct,
    month: next,
    moralePoints: researchMorale,
    profitStreak: nextProfitStreak(input.profitStreak, 1, input.routes),
    strike: staffStrike(input.staff.strike),
  });
  const morale = nextMorale(input.staff.morale, target);
  return {
    target,
    nextMorale: morale,
    strikeChance: input.capOpen && input.routes > 0 ? strikeChance(morale) : 0,
    capOpen: input.capOpen,
    labourMarket: labourMarketPremium(next),
    researchMorale,
    satisfactionNow: staffPart(input.staff.morale),
    satisfactionAtTarget: staffPart(target),
  };
}

/**
 * Die Frage an den Spieler, wenn für den Monat `strikeMonth` gestreikt wird (8.7). Beide Antworten kosten vorab
 * nichts. Kein eigener Ruf-Abzug (E38): Gestrichene Flüge senken das Ruf-Ziel wie jede Streichung (6.2).
 * `monthlyRevenue` = Ticket-Erlös des eben abgeschlossenen Monats, um zu zeigen, was auf dem Spiel steht.
 */
export function strikeQuestion(staff: Staff, strikeMonth: number, monthLabel: string, monthlyRevenue: number): GameDecision {
  const raisedTo = settledSalary(staff.salaryPct);
  const atStake = monthlyRevenue > 0 ? ` Last month's tickets brought in ${formatCurrency(monthlyRevenue)}.` : '';
  return {
    id: `strike_${strikeMonth}`,
    kind: 'strike',
    ref: String(strikeMonth),
    title: `Staff strike in ${monthLabel}`,
    description:
      `Morale has fallen to ${Math.round(staff.morale)} and the unions have called a strike for ${monthLabel}. ` +
      `Until you answer, every flight that month is grounded.${atStake}`,
    options: [
      {
        id: STRIKE_OPTION_RAISE,
        label: `Raise pay to ${Math.round(raisedTo)}%`,
        detail:
          `Crews cost ${Math.round(raisedTo)}% of the market wage from now on, and morale recovers faster. ` +
          `${Math.round(STRIKE_SETTLED_CANCEL_SHARE * 100)}% of the month's flights still do not operate while the deal is worked out.`,
        cost: 0,
      },
      {
        id: STRIKE_OPTION_SIT_OUT,
        label: 'Sit it out',
        detail:
          `Pay stays at ${Math.round(staff.salaryPct)}%. Nothing flies in ${monthLabel}; ` +
          `like any cancellation, that weighs on reputation. Morale stays low, and another strike may follow.`,
        cost: 0,
      },
    ],
  };
}
