/**
 * Tests für `src/lib/modelStaff.ts` (Paket 4.8): Lohn, Moral und Streik in der Personal-Ansicht nach dem Modell (8.7,
 * 2.6.4). Die Vorschau muss rechnen wie der Übergang zu X+1 im Abschluss (R2).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PROFIT_STREAK_MORALE,
  SALARY_PCT_MAX,
  SALARY_PCT_MIN,
  STRIKE_FULL_CANCEL_SHARE,
  STRIKE_PAY_RAISE,
  STRIKE_SETTLED_CANCEL_SHARE,
} from '../model/constants';
import { NO_DECISIONS, closeMonth } from '../model/monthClose';
import { strikeChance } from '../model/monthEvents';
import { createGameSystems, type Staff } from './gameState';
import { PLAYER_ID, defaultModelEnv, modelGame, type AppGame } from './modelMonth';
import {
  STRIKE_OPTION_RAISE,
  STRIKE_OPTION_SIT_OUT,
  isStrikeMonth,
  salaryFloor,
  setSalary,
  settleStrike,
  staffOutlook,
  strikeCancelShare,
  strikeQuestion,
} from './modelStaff';

const M = (1995 - 1960) * 12 + 5; // Juni 1995 (Arbeitsmarkt 1995: 0)

const staff = (over: Partial<Staff> = {}): Staff => ({ salaryPct: 100, morale: 70, strike: null, ...over });

const base = { month: M, profitStreak: 0, routes: 3, completedResearch: [] as string[], capOpen: true };

describe('Paket 4.8: Vorschau = Übergang im Abschluss (8.7, R2)', () => {
  it('Moral im nächsten Monat wie closeMonth', () => {
    const s = staff({ salaryPct: 90, morale: 40 });
    const g = gameWith(s);
    const next = closeMonth(modelGame(g, defaultModelEnv()).state, NO_DECISIONS).state;
    const player = next.companies.find((c) => c.id === PLAYER_ID)!;
    const outlook = staffOutlook({ ...base, staff: s, routes: 0 });
    assert.ok(Math.abs(outlook.nextMorale - player.inputs.morale) < 1e-9, `${outlook.nextMorale} ≠ ${player.inputs.morale}`);
  });

  it('Lohn 100 %, keine Serie, kein Streik, keine Forschung → Ziel 50; Moral 70 → 66', () => {
    const o = staffOutlook({ ...base, staff: staff() });
    assert.equal(o.target, 50);
    assert.ok(Math.abs(o.nextMorale - 66) < 1e-9);
    assert.equal(o.strikeChance, 0);
    assert.equal(o.satisfactionNow, 2);
    assert.equal(o.satisfactionAtTarget, 0);
  });

  it('Gewinnserie: angenommen, sie läuft weiter; ohne Strecken wächst sie nicht', () => {
    const withRoutes = staffOutlook({ ...base, staff: staff(), profitStreak: 6 });
    const noRoutes = staffOutlook({ ...base, staff: staff(), profitStreak: 6, routes: 0 });
    assert.equal(withRoutes.target - noRoutes.target, PROFIT_STREAK_MORALE);
  });

  it('Forschung „Crew academy“ hebt das Ziel um ihre Moral-Punkte', () => {
    const o = staffOutlook({ ...base, staff: staff(), completedResearch: ['academy'] });
    assert.equal(o.researchMorale, 5);
    assert.equal(o.target, 55);
  });

  it('Streik-Chance aus der neuen Moral; bei geschlossenem Pech-Deckel 0', () => {
    const s = staff({ morale: 20, salaryPct: 80 });
    const open = staffOutlook({ ...base, staff: s });
    assert.ok(open.strikeChance > 0);
    assert.equal(open.strikeChance, strikeChance(open.nextMorale));
    const closed = staffOutlook({ ...base, staff: s, capOpen: false });
    assert.equal(closed.strikeChance, 0);
    assert.equal(closed.capOpen, false);
  });

  it('ohne Strecken keine Streik-Chance (8.7, E74), wie im Abschluss', () => {
    const s = staff({ morale: 20, salaryPct: 80 });
    assert.equal(staffOutlook({ ...base, staff: s, routes: 0 }).strikeChance, 0);
  });
});

describe('Paket 4.8: Lohn-Grenzen und Streik (8.7)', () => {
  it('setSalary: in den Grenzen; nicht unter dem vereinbarten Lohn, solange der Streik nachwirkt', () => {
    assert.equal(setSalary(staff(), 200, M).salaryPct, SALARY_PCT_MAX);
    assert.equal(setSalary(staff(), 10, M).salaryPct, SALARY_PCT_MIN);
    const agreed = staff({ salaryPct: 110, strike: { startOffset: M - 2, cancelShare: 0.5, agreedPct: 110 } });
    assert.equal(salaryFloor(agreed, M), 110);
    assert.equal(setSalary(agreed, 90, M).salaryPct, 110);
    assert.equal(salaryFloor(agreed, M - 2 + 7), SALARY_PCT_MIN, 'nach 6 Monaten frei');
    const same = staff();
    assert.equal(setSalary(same, 100, M), same, 'unverändert = dasselbe Objekt');
  });

  it('Streik im Monat: ohne Antwort alle Flüge, nach „Raise pay“ die Hälfte; sonst 0', () => {
    const s = staff({ strike: { startOffset: M, cancelShare: 1 } });
    assert.equal(isStrikeMonth(s, M), true);
    assert.equal(strikeCancelShare(s, M), STRIKE_FULL_CANCEL_SHARE);
    assert.equal(strikeCancelShare(s, M + 1), 0);
    const settled = settleStrike(s, M);
    assert.equal(settled.salaryPct, 100 + STRIKE_PAY_RAISE);
    assert.equal(settled.strike?.agreedPct, 100 + STRIKE_PAY_RAISE);
    assert.equal(strikeCancelShare(settled, M), STRIKE_SETTLED_CANCEL_SHARE);
    assert.equal(settleStrike(s, M + 1), s, 'anderer Streik: unverändert');
    assert.equal(settleStrike(staff({ salaryPct: 125, strike: { startOffset: M, cancelShare: 1 } }), M).salaryPct, SALARY_PCT_MAX);
  });

  it('Streik-Frage: zwei kostenlose Antworten, kein eigener Ruf-Abzug (E38)', () => {
    const q = strikeQuestion(staff({ morale: 30 }), M, '06/1995', 2_000_000);
    assert.equal(q.kind, 'strike');
    assert.equal(q.ref, String(M));
    assert.deepEqual(q.options.map((o) => o.id), [STRIKE_OPTION_RAISE, STRIKE_OPTION_SIT_OUT]);
    assert.ok(q.options.every((o) => o.cost === 0));
    assert.match(q.options[0].label, /110%/);
    assert.ok(!/\d+ reputation/.test(q.options[1].detail ?? ''), 'kein fester Ruf-Abzug');
    assert.ok(!/ground staff/i.test(q.options[0].detail ?? ''), 'nur Besatzung (5.4)');
  });
});

function gameWith(s: Staff): AppGame {
  const sys = createGameSystems();
  return {
    month: M, startMonth: M - 60, airlineCode: 'XA', selectedHub: 'FRA', difficulty: 'Normal', aiDifficulty: 'Normal', aiAirlinesCount: 0,
    capital: 150e6, monthlyCapex: [], fleet: [], routes: [], airportManagement: {},
    reputation: 50, profitStreak: 0, staff: s, marketing: sys.marketing, eventChoices: {},
    career: sys.career, milestones: [], annualGoal: null, scenario: null, reportHistory: [], aiAirlines: [], randomEvents: [], disruptions: [],
  };
}
