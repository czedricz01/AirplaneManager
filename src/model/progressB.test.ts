/**
 * Regeltests zu SPEZIFIKATION 6.9–6.13 (Forschung, Meilensteine, Jahresziel, Karriere-Punkte, Startwerte) und dem
 * Karriere-Teil des Beispiels 6.14. Paket 3.6b.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PROJECTS as OLD_PROJECTS } from '../lib/research';
import { MILESTONES as OLD_MILESTONES } from '../lib/milestones';
import { costIndex } from './basics';
import { slotPrice } from './airportCosts';
import {
  CLASS_RESEARCH,
  COST_RESEARCH_KINDS,
  GOAL_MIN_REWARD_1960,
  GOAL_PROFIT_FLOOR_1960,
  HALL_SIZE,
  MAX_RANK,
  MILESTONE_TIER_REWARD,
  MILESTONES,
  RESEARCH_COST_FLOOR,
  RESEARCH_PROJECTS,
  START_REPUTATION,
  type MilestoneMetric,
  type ResearchEffect,
} from './constants';
import {
  advanceResearch,
  annualGoalOffers,
  careerScore,
  chosenGoal,
  companyValue,
  completedBonusResearch,
  effectiveRank,
  fileCareer,
  goalBase,
  goalFraction,
  goalMet,
  goalReward,
  isDecember,
  milestoneDef,
  milestoneHubs,
  milestonePrize,
  milestonePrizeTotal,
  milestoneRequirementText,
  milestoneSlotFactor,
  newMilestones,
  nextProfitStreak,
  openSizeClasses,
  researchEffectLines,
  researchEffects,
  researchPrice,
  researchProject,
  researchProgress,
  researchStartBlocker,
  settleGoal,
  splitHall,
  startResearch,
  startingResearch,
  yearSnapshot,
  type AnnualGoal,
  type CareerInput,
  type GoalOfferInput,
  type HallEntry,
  type HallsOfFame,
  type MilestoneContext,
  type ResearchState,
  type YearSnapshot,
} from './progress';

const close = (actual: number, expected: number, tolerance = 1e-9, what = '') =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what} ${actual} ≠ ${expected} ± ${tolerance}`);

/** Spielmonat Januar des Jahres. */
const jan = (year: number) => (year - 1960) * 12;

const ALL_IDS = RESEARCH_PROJECTS.map((p) => p.id);

// ---------------------------------------------------------------------------
// 6.9 Forschung
// ---------------------------------------------------------------------------

/** Wirkung eines alten Projekts (`src/lib/research.ts`) in den neuen Feldern (6.9). */
function oldEffectAsFields(effect: Record<string, number> = {}): ResearchEffect {
  const out: Record<string, unknown> = {};
  const costSaving: Record<string, number> = {};
  for (const [key, value] of Object.entries(effect)) {
    if ((COST_RESEARCH_KINDS as readonly string[]).includes(key)) costSaving[key] = value;
    else if (key === 'efficiency') out.efficiencyPoints = Math.round(value * 100);
    else if (key === 'popularity') out.satisfactionPoints = Math.round(value * 100);
    else if (key === 'sat') out.satisfactionPoints = value;
    else if (key === 'demand') out.demandFactor = 1 + value;
    else if (key === 'transfer') out.hubQualityFactor = 1 + value;
    else if (key === 'ramp') out.rampBonus = value;
    else if (key === 'defects') out.defectSaving = value;
    else if (key === 'wear') out.wearSaving = value;
    else if (key === 'resale') out.resaleBonus = value;
    else if (key === 'morale') out.moralePoints = value;
    else throw new Error(`unbekanntes altes Feld ${key}`);
  }
  if (Object.keys(costSaving).length > 0) out.costSaving = costSaving;
  return out as ResearchEffect;
}

describe('Abschnitt 6.9 Forschung', () => {
  it('6.9: 45 Projekte (5 Klassen, 40 Bonus), Ids eindeutig', () => {
    assert.equal(RESEARCH_PROJECTS.length, 45);
    assert.equal(RESEARCH_PROJECTS.filter((p) => p.kind === 'class').length, 5);
    assert.equal(RESEARCH_PROJECTS.filter((p) => p.kind === 'bonus').length, 40);
    assert.equal(new Set(ALL_IDS).size, 45);
  });

  it('6.9: Bonus-Projekte wie heute: Id, Rang, Kette, Dauer, Preis von 1960 und Wirkung', () => {
    const oldBonus = OLD_PROJECTS.filter((p) => p.kind === 'bonus');
    assert.deepEqual(
      RESEARCH_PROJECTS.filter((p) => p.kind === 'bonus').map((p) => p.id).sort(),
      oldBonus.map((p) => p.id).sort(),
    );
    for (const old of oldBonus) {
      const project = researchProject(old.id);
      assert.equal(project.rank, old.rank, old.id);
      assert.equal(project.requires, old.requires ?? null, old.id);
      assert.equal(project.months, old.months, old.id);
      assert.equal(project.price1960, old.baseCost, old.id);
      assert.deepEqual(project.effect, oldEffectAsFields(old.effect as Record<string, number>), old.id);
    }
  });

  it('6.9: Klassen-Projekte aus CLASS_RESEARCH (6.8), Vorgänger als Projekt-Id', () => {
    for (const [sizeClass, cls] of Object.entries(CLASS_RESEARCH)) {
      const project = researchProject(cls.id);
      assert.equal(project.kind, 'class');
      assert.equal(project.opens, sizeClass);
      assert.equal(project.rank, cls.rank);
      assert.equal(project.months, cls.months);
      assert.equal(project.price1960, cls.price1960);
    }
    assert.equal(researchProject('class-supersonic').requires, 'class-widebody');
    assert.equal(researchProject('class-regional').requires, null);
  });

  it('6.9: Preis ohne eigenen Preis = (1,2 + 1,3 × Rang) Mio. $, ungerundet; Dauer 3 + aufrunden(Rang / 2)', () => {
    assert.equal(researchProject('crew-1').price1960, 1_200_000);
    assert.equal(researchProject('maint-1').price1960, 2_500_000);
    assert.equal(researchProject('eff-3').price1960, 6_400_000);
    assert.equal(researchProject('sat-6').price1960, 12_900_000);
    assert.equal(researchProject('crew-1').months, 3);
    assert.equal(researchProject('maint-1').months, 4);
    assert.equal(researchProject('sat-6').months, 8);
  });

  it('6.9: jeder Vorgänger steht in der Tabelle und erscheint nicht später', () => {
    for (const p of RESEARCH_PROJECTS) {
      if (p.requires === null) continue;
      const before = researchProject(p.requires);
      assert.ok(before.rank <= p.rank, `${p.id} vor ${before.id}`);
    }
  });

  it('6.9: ohne fertige Projekte ist jede Wirkung neutral', () => {
    const fx = researchEffects([]);
    for (const kind of COST_RESEARCH_KINDS) assert.equal(fx.costFactor[kind], 1);
    assert.equal(fx.efficiencyPoints, 0);
    assert.equal(fx.satisfactionPoints, 0);
    assert.equal(fx.demandFactor, 1);
    assert.equal(fx.hubQualityFactor, 1);
    assert.equal(fx.rampBonus, 0);
    assert.equal(fx.defectFactor, 1);
    assert.equal(fx.wearFactor, 1);
    assert.equal(fx.resaleBonus, 0);
    assert.equal(fx.moralePoints, 0);
  });

  it('6.9: ein weiteres fertiges Projekt verschlechtert nie etwas', () => {
    const done: string[] = [];
    let before = researchEffects(done);
    for (const id of ALL_IDS) {
      done.push(id);
      const after = researchEffects(done);
      for (const kind of COST_RESEARCH_KINDS) assert.ok(after.costFactor[kind] <= before.costFactor[kind], `${id} ${kind}`);
      assert.ok(after.efficiencyPoints >= before.efficiencyPoints, id);
      assert.ok(after.satisfactionPoints >= before.satisfactionPoints, id);
      assert.ok(after.demandFactor >= before.demandFactor, id);
      assert.ok(after.hubQualityFactor >= before.hubQualityFactor, id);
      assert.ok(after.rampBonus >= before.rampBonus, id);
      assert.ok(after.defectFactor <= before.defectFactor, id);
      assert.ok(after.wearFactor <= before.wearFactor, id);
      assert.ok(after.resaleBonus >= before.resaleBonus, id);
      assert.ok(after.moralePoints >= before.moralePoints, id);
      before = after;
    }
  });

  it('6.9: alle Projekte fertig: Summen wie in der Tabelle, jeder Kostenfaktor ≥ 0,4', () => {
    const fx = researchEffects(ALL_IDS);
    for (const kind of COST_RESEARCH_KINDS) assert.ok(fx.costFactor[kind] >= RESEARCH_COST_FLOOR);
    close(fx.costFactor.fuel, 0.93);
    close(fx.costFactor.crew, 0.97);
    close(fx.costFactor.fees, 0.97);
    close(fx.costFactor.catering, 0.96);
    close(fx.costFactor.maintenance, 0.96);
    close(fx.costFactor.slots, 0.92);
    assert.equal(fx.efficiencyPoints, 6);
    assert.equal(fx.satisfactionPoints, 8);
    close(fx.demandFactor, 1.015 * 1.025 * 1.01);
    close(fx.hubQualityFactor, 1.1);
    close(fx.rampBonus, 0.15);
    close(fx.defectFactor, 0.7);
    close(fx.wearFactor, 0.94);
    close(fx.resaleBonus, 0.025);
    assert.equal(fx.moralePoints, 5);
  });

  it('6.9: unbekannte Ids zählen nicht, doppelte einmal; unbekanntes Projekt nachschlagen ist ein Fehler', () => {
    assert.equal(researchEffects(['gibt-es-nicht']).efficiencyPoints, 0);
    assert.equal(researchEffects(['eff-1', 'eff-1']).efficiencyPoints, 1);
    assert.throws(() => researchProject('gibt-es-nicht'));
  });

  it('6.9: Preis 2020 = Preis 1960 × costIndex 2020 (W9)', () => {
    close(researchPrice('fuel-1', jan(2020)), 4_000_000 * costIndex(jan(2020)), 1e-3);
    assert.equal(researchPrice('fuel-1', 0), 4_000_000);
    close(researchPrice('class-supersonic', jan(1975)), 60_000_000 * costIndex(jan(1975)), 1e-3);
  });

  it('6.9: jeder Projekt-Text enthält die Zahl aus seinem Feld (E52)', () => {
    const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
    for (const p of RESEARCH_PROJECTS) {
      const text = researchEffectLines(p.id).join(' | ');
      assert.ok(text.length > 0, p.id);
      const e = p.effect;
      for (const kind of COST_RESEARCH_KINDS) if (e.costSaving?.[kind]) assert.ok(text.includes(pct(e.costSaving[kind] ?? 0)), `${p.id}: ${text}`);
      if (e.efficiencyPoints) assert.ok(text.includes(`+${e.efficiencyPoints} point`), `${p.id}: ${text}`);
      if (e.satisfactionPoints) assert.ok(text.includes(`+${e.satisfactionPoints} in every cabin class`), `${p.id}: ${text}`);
      if (e.demandFactor) assert.ok(text.includes(pct(e.demandFactor - 1)), `${p.id}: ${text}`);
      if (e.hubQualityFactor) assert.ok(text.includes(pct(e.hubQualityFactor - 1)), `${p.id}: ${text}`);
      if (e.defectSaving) assert.ok(text.includes(pct(e.defectSaving)), `${p.id}: ${text}`);
      if (e.wearSaving) assert.ok(text.includes(pct(e.wearSaving)), `${p.id}: ${text}`);
      if (e.resaleBonus) assert.ok(text.includes(pct(e.resaleBonus)), `${p.id}: ${text}`);
      if (e.moralePoints) assert.ok(text.includes(`+${e.moralePoints} point`), `${p.id}: ${text}`);
    }
  });

  it('6.9: Texte: „+1 point“ statt „+1%“ (W12), Satisfaction statt Plane type satisfaction (E19)', () => {
    assert.deepEqual(researchEffectLines('eff-1'), ['Aircraft efficiency +1 point']);
    assert.deepEqual(researchEffectLines('sat-1'), ['Satisfaction +1 in every cabin class']);
    assert.deepEqual(researchEffectLines('yield-1'), ['Demand +1.5% on every route']);
    assert.deepEqual(researchEffectLines('planning'), ['New routes start at 75% of their demand instead of 60%']);
    assert.match(researchEffectLines('class-supersonic')[0], /1000 km\/h/);
  });

  it('6.9: Start-Sperre in der Reihenfolge fertig, läuft, Rang, Vorgänger, Plätze, Geld', () => {
    const rich = 1e12;
    const state: ResearchState = { done: ['eff-1'], active: [{ id: 'sat-1', startMonth: 0 }] };
    assert.equal(researchStartBlocker(state, 'eff-1', 0, rich, 0), 'done');
    assert.equal(researchStartBlocker(state, 'sat-1', 0, rich, 0), 'running');
    assert.equal(researchStartBlocker(state, 'eff-2', 0, rich, 0), 'rank');
    assert.equal(researchStartBlocker(state, 'sat-2', 2, rich, 0), 'requires');
    const full: ResearchState = { done: [], active: [{ id: 'sat-1', startMonth: 0 }, { id: 'crew-1', startMonth: 0 }] };
    assert.equal(researchStartBlocker(full, 'eff-1', 0, rich, 0), 'slots');
    assert.equal(researchStartBlocker(full, 'eff-1', 4, rich, 0), null, 'Rang 4: 3 Plätze');
    assert.equal(researchStartBlocker(state, 'crew-1', 0, 1_199_999, 0), 'cash');
    assert.equal(researchStartBlocker(state, 'crew-1', 0, 1_200_000, 0), null);
  });

  it('6.9: Geld-Sperre mit dem Preis des aktuellen Monats', () => {
    const empty = startingResearch(0);
    const price = researchPrice('crew-1', jan(1990));
    assert.equal(researchStartBlocker(empty, 'crew-1', 0, price - 1, jan(1990)), 'cash');
    assert.equal(researchStartBlocker(empty, 'crew-1', 0, price, jan(1990)), null);
  });

  it('6.9: Start zahlt den Preis und belegt einen Platz; gesperrter Start ist ein Fehler', () => {
    const { state, price } = startResearch(startingResearch(0), 'eff-1', 0, 1e9, 5);
    assert.deepEqual(state.active, [{ id: 'eff-1', startMonth: 5 }]);
    assert.equal(price, researchPrice('eff-1', 5));
    assert.throws(() => startResearch(state, 'eff-1', 0, 1e9, 6));
  });

  it('6.9: fertig, wenn zu Monatsbeginn die Monate seit Start ≥ Dauer', () => {
    const state: ResearchState = { done: [], active: [{ id: 'eff-1', startMonth: 10 }] };
    assert.equal(researchProject('eff-1').months, 3);
    const early = advanceResearch(state, 12);
    assert.deepEqual(early.completed, []);
    assert.equal(early.state, state);
    const later = advanceResearch(state, 13);
    assert.deepEqual(later.completed, ['eff-1']);
    assert.deepEqual(later.state, { done: ['eff-1'], active: [] });
    assert.deepEqual(researchProgress({ id: 'eff-1', startMonth: 10 }, 11), { monthsDone: 1, fraction: 1 / 3 });
    assert.equal(researchProgress({ id: 'eff-1', startMonth: 10 }, 20).fraction, 1);
  });

  it('6.9: Free Mode: Rang 9 gilt, alle Projekte erscheinen', () => {
    const rank = effectiveRank('free', 0);
    for (const p of RESEARCH_PROJECTS) {
      const blocker = researchStartBlocker({ done: ALL_IDS.filter((id) => id !== p.id), active: [] }, p.id, rank, 1e15, 0);
      assert.equal(blocker, null, p.id);
    }
  });

  it('6.9: wirkt in Satisfaction, Effizienz, Kosten und Slot-Preis über dieselben Felder', () => {
    close(slotPrice('Narrowbody', 0, ['slots']), 0.92 * slotPrice('Narrowbody', 0));
  });

  it('6.12: Bonus-Projekte zählen, Klassen-Projekte nicht', () => {
    assert.equal(completedBonusResearch(['class-regional', 'eff-1', 'eff-1', 'gibt-es-nicht']), 1);
    assert.equal(completedBonusResearch(ALL_IDS), 40);
  });
});

// ---------------------------------------------------------------------------
// 6.10 Meilensteine
// ---------------------------------------------------------------------------

const ZERO_CONTEXT: MilestoneContext = {
  routes: 0,
  fleet: 0,
  careerPax: 0,
  regions: 0,
  longestRouteKm: 0,
  cash: 0,
  profitStreak: 0,
  reputation: 0,
  monthTransferPax: 0,
  widebodies: 0,
  supersonics: 0,
  takeovers: 0,
};

const HUGE_CONTEXT: MilestoneContext = Object.fromEntries(
  Object.keys(ZERO_CONTEXT).map((k) => [k, 1e15]),
) as Record<MilestoneMetric, number>;

describe('Abschnitt 6.10 Meilensteine', () => {
  it('6.10: 31 Meilensteine, Ids eindeutig; dieselben Spuren und Stufen wie heute', () => {
    assert.equal(MILESTONES.length, 31);
    assert.equal(new Set(MILESTONES.map((m) => m.id)).size, 31);
    assert.deepEqual(
      MILESTONES.map((m) => `${m.track}/${m.tier}`),
      OLD_MILESTONES.map((m) => `${m.track}/${m.tier}`),
    );
    assert.deepEqual(
      MILESTONES.map((m) => m.extraHubs),
      OLD_MILESTONES.map((m) => m.reward.extraHubs),
    );
  });

  it('6.10: Prämien und Slot-Nachlässe je Stufe; keine Ruf-Punkte (E38)', () => {
    assert.deepEqual(MILESTONE_TIER_REWARD, {
      bronze: { prize1960: 500_000, slotDiscount: 0 },
      silver: { prize1960: 3_000_000, slotDiscount: 0.02 },
      gold: { prize1960: 15_000_000, slotDiscount: 0.03 },
      feat: { prize1960: 2_000_000, slotDiscount: 0.01 },
    });
    for (const m of MILESTONES) assert.ok(!('reputation' in m), m.id);
  });

  it('6.10: Ruf 60 / 70 / 80, Regionen 2 / 4 / 6', () => {
    assert.deepEqual(
      MILESTONES.filter((m) => m.metric === 'reputation').map((m) => m.threshold),
      [60, 70, 80],
    );
    assert.deepEqual(
      MILESTONES.filter((m) => m.metric === 'regions').map((m) => m.threshold),
      [2, 4, 6],
    );
  });

  it('6.10: erreicht bei Wert ≥ Schwelle; jeder Meilenstein höchstens einmal', () => {
    const ctx = { ...ZERO_CONTEXT, routes: 10, reputation: 60 };
    const first = newMilestones([], ctx, 0).map((m) => m.id);
    assert.deepEqual(first, ['first-route', 'routes-10', 'reputation-bronze']);
    assert.deepEqual(newMilestones(first, ctx, 0), []);
    assert.equal(newMilestones([], HUGE_CONTEXT, 0).length, 31);
  });

  it('6.10: Kassen-Schwelle über atCost (W9)', () => {
    const m = jan(2000);
    const nominal = { ...ZERO_CONTEXT, cash: 100_000_000 };
    assert.ok(costIndex(m) > 1);
    assert.deepEqual(newMilestones([], nominal, m), []);
    const enough = { ...ZERO_CONTEXT, cash: 100_000_000 * costIndex(m) };
    assert.deepEqual(newMilestones([], enough, m).map((x) => x.id), ['capital-100m']);
  });

  it('6.10: Prämie 2020 = Wert 1960 × costIndex 2020; in Summe', () => {
    const gold = milestoneDef('routes-150');
    close(milestonePrize(gold, jan(2020)), 15_000_000 * costIndex(jan(2020)), 1e-3);
    close(milestonePrizeTotal([gold, milestoneDef('first-route')], 0), 15_500_000);
  });

  it('6.10: milestoneSlotFactor in 0,7 … 1; alle zusammen gekappt bei 0,7', () => {
    assert.equal(milestoneSlotFactor([]), 1);
    close(milestoneSlotFactor(['routes-50']), 0.98);
    close(milestoneSlotFactor(['routes-50', 'routes-150', 'widebody']), 0.94);
    close(milestoneSlotFactor(MILESTONES.map((m) => m.id)), 0.7);
    assert.equal(milestoneSlotFactor(['gibt-es-nicht']), 1);
  });

  it('6.10: Slot-Nachlass wirkt im Slot-Kaufpreis (5.10)', () => {
    const factor = milestoneSlotFactor(MILESTONES.map((m) => m.id));
    close(slotPrice('Widebody', jan(1980), [], factor), 0.7 * slotPrice('Widebody', jan(1980)), 1e-6);
  });

  it('6.10: Drehkreuze: 150 routes, 100 Mio. Fluggäste, Empire builder je +1', () => {
    assert.equal(milestoneHubs(MILESTONES.map((m) => m.id)), 3);
    assert.equal(milestoneHubs(['takeover-3', 'takeover-3']), 1);
  });

  it('6.10: Gewinnserie: Verlust → 0, ohne Strecken unverändert, Gewinn → +1', () => {
    assert.equal(nextProfitStreak(5, -1, 3), 0);
    assert.equal(nextProfitStreak(5, -1, 0), 0);
    assert.equal(nextProfitStreak(5, 100, 0), 5);
    assert.equal(nextProfitStreak(5, 100, 3), 6);
    assert.equal(nextProfitStreak(5, 0, 3), 5);
  });

  it('6.10: Texte aus Metrik und Schwelle, „or more“ (W12, E52)', () => {
    assert.equal(milestoneRequirementText(milestoneDef('reputation-bronze'), 0), 'Reputation 60 or more');
    assert.equal(milestoneRequirementText(milestoneDef('capital-100m'), 0), '$100,000,000 or more in the bank');
    assert.equal(milestoneRequirementText(milestoneDef('first-route'), 0), '1 route or more');
    assert.equal(milestoneRequirementText(milestoneDef('takeover-3'), 0), '3 rival airlines bought');
    for (const m of MILESTONES) assert.ok(milestoneRequirementText(m, jan(1990)).length > 0, m.id);
  });
});

// ---------------------------------------------------------------------------
// 6.11 Jahresziel
// ---------------------------------------------------------------------------

const DEC_1979 = jan(1980) - 1;

const OFFER: GoalOfferInput = {
  year: 1980,
  month: DEC_1979,
  lastYearProfit: 40_000_000,
  lastYearRevenue: 300_000_000,
  lastYearPax: 2_000_000,
  routes: 30,
  regions: 2,
  reputation: 55,
};

function snapshot(over: Partial<YearSnapshot> = {}): YearSnapshot {
  return { profit: 0, revenue: 0, pax: 0, lossMonths: 0, routes: 0, regions: 0, reputation: 0, ...over };
}

describe('Abschnitt 6.11 Jahresziel', () => {
  it('6.11: Bezugsgröße = max(Vorjahresergebnis, 5 % des Erlöses, atCost(2 Mio. $))', () => {
    assert.equal(goalBase(40e6, 300e6, DEC_1979), 40e6);
    close(goalBase(-5e6, 400e6, DEC_1979), 20e6);
    close(goalBase(-5e6, 0, DEC_1979), GOAL_PROFIT_FLOOR_1960 * costIndex(DEC_1979));
  });

  it('6.11: nach einem Verlustjahr hängt das Ziel vom Vorjahreserlös ab (W10)', () => {
    const small = annualGoalOffers({ ...OFFER, lastYearProfit: -10e6, lastYearRevenue: 200e6 });
    const large = annualGoalOffers({ ...OFFER, lastYearProfit: -10e6, lastYearRevenue: 800e6 });
    assert.ok(large[0].target > small[0].target);
    assert.equal(small[0].target, 11_000_000);
    assert.equal(large[0].target, 44_000_000);
  });

  it('6.11: drei Ziele: sicher, andere Art, hoch; hoch ≥ sicher in Ziel und Prämie', () => {
    const offers = annualGoalOffers(OFFER);
    assert.deepEqual(offers.map((g) => g.tag), ['steady', 'focus', 'stretch']);
    assert.equal(offers[0].kind, 'profit');
    assert.equal(offers[2].kind, 'profit');
    assert.equal(offers[0].target, 44_000_000);
    assert.equal(offers[2].target, 54_000_000);
    assert.ok(offers[2].target >= offers[0].target);
    assert.ok(offers[2].reward >= offers[0].reward);
    close(offers[0].reward, 0.02 * 40e6);
    close(offers[1].reward, 0.03 * 40e6);
    close(offers[2].reward, 0.05 * 40e6);
  });

  it('6.11: andere Art reihum nach Jahreszahl', () => {
    const kinds = [1980, 1981, 1982, 1983, 1984].map((year) => annualGoalOffers({ ...OFFER, year })[1].kind);
    assert.deepEqual(kinds, ['routes', 'regions', 'reputation', 'pax', 'noLoss']);
    const routes = annualGoalOffers({ ...OFFER, year: 1980 })[1];
    assert.equal(routes.target, 36);
  });

  it('6.11: Ruf-Ziel höchstens 90; ohne Strecken und Fluggäste nur Gewinnziele', () => {
    const rep = annualGoalOffers({ ...OFFER, year: 1982, reputation: 87 })[1];
    assert.equal(rep.kind, 'reputation');
    assert.equal(rep.target, 90);
    const none = annualGoalOffers({ ...OFFER, routes: 0, lastYearPax: 0 });
    assert.deepEqual(none.map((g) => g.tag), ['steady', 'stretch']);
  });

  it('6.11: Prämie nie unter dem Mindestbetrag; Strafe = halbe Prämie (E58)', () => {
    const offers = annualGoalOffers({ ...OFFER, lastYearProfit: 0, lastYearRevenue: 0 });
    for (const g of offers) {
      assert.ok(g.reward >= GOAL_MIN_REWARD_1960 * costIndex(DEC_1979) - 1e-6, g.tag);
      close(g.penalty, g.reward / 2);
    }
    close(goalReward('steady', 0, 0), GOAL_MIN_REWARD_1960);
  });

  it('6.11: hohes Ziel kostet beim Verfehlen 2,5 % statt 1 % der Bezugsgröße', () => {
    const offers = annualGoalOffers(OFFER);
    close(offers[0].penalty, 0.01 * 40e6);
    close(offers[2].penalty, 0.025 * 40e6);
  });

  it('6.11: ohne Wahl gilt das sichere Ziel', () => {
    const offers = annualGoalOffers(OFFER);
    assert.equal(chosenGoal(offers), offers[0]);
    assert.equal(chosenGoal(offers, 2), offers[2]);
  });

  it('6.11: Jahresstand nur aus Berichten des Jahres', () => {
    const snap = yearSnapshot(
      [
        { year: 1979, result: 99, revenue: 99, passengers: 99 },
        { year: 1980, result: 10, revenue: 100, passengers: 5 },
        { year: 1980, result: -4, revenue: 50, passengers: 3 },
      ],
      1980,
      { routes: 7, regions: 2, reputation: 52 },
    );
    assert.deepEqual(snap, { profit: 6, revenue: 150, pax: 8, lossMonths: 1, routes: 7, regions: 2, reputation: 52 });
  });

  it('6.11: erreicht → +Prämie; verfehlt → −halbe Prämie; nur Kasse, kein Ruf (E38, E58)', () => {
    const goal: AnnualGoal = annualGoalOffers(OFFER)[0];
    const hit = settleGoal(goal, snapshot({ profit: goal.target }));
    assert.deepEqual(hit, { met: true, cash: goal.reward, achieved: goal.target });
    const miss = settleGoal(goal, snapshot({ profit: goal.target - 1 }));
    assert.equal(miss.met, false);
    close(miss.cash, -goal.reward / 2);
    assert.deepEqual(Object.keys(miss).sort(), ['achieved', 'cash', 'met']);
  });

  it('6.11: kein Verlustmonat; Fortschritt 0 … 1', () => {
    const noLoss: AnnualGoal = { year: 1980, kind: 'noLoss', tag: 'focus', target: 0, reward: 1, penalty: 0.5 };
    assert.equal(goalMet(noLoss, snapshot()), true);
    assert.equal(goalMet(noLoss, snapshot({ lossMonths: 1 })), false);
    assert.equal(goalFraction(noLoss, snapshot({ lossMonths: 1 })), 0);
    const profit = annualGoalOffers(OFFER)[0];
    assert.equal(goalFraction(profit, snapshot({ profit: profit.target / 2 })), 0.5);
    assert.equal(goalFraction(profit, snapshot({ profit: -1 })), 0);
    assert.equal(goalFraction(profit, snapshot({ profit: 2 * profit.target })), 1);
  });

  it('6.11: Angebot und Messung im Dezember', () => {
    assert.equal(isDecember(11), true);
    assert.equal(isDecember(DEC_1979), true);
    assert.equal(isDecember(0), false);
    assert.equal(isDecember(12), false);
  });
});

// ---------------------------------------------------------------------------
// 6.12 Karriere-Punkte und Ruhmeshallen
// ---------------------------------------------------------------------------

const EXAMPLE_MONTH = jan(2020);

const EXAMPLE_CAREER: CareerInput = {
  companyValue: 5_000_000_000 * costIndex(EXAMPLE_MONTH),
  month: EXAMPLE_MONTH,
  rank: 9,
  mode: 'normal',
  milestones: 25,
  reputation: 70,
  takeovers: 2,
  bonusResearch: 40,
  years: 60,
};

describe('Abschnitt 6.12 Karriere-Punkte', () => {
  it('6.12: Unternehmenswert = Kasse + Flugzeuge + Slots + Anzahlungen (E48)', () => {
    assert.equal(companyValue({ cash: 10, aircraftValues: [1, 2, 3], slotResaleValue: 4, preorderDeposits: 5 }), 25);
    assert.equal(companyValue({ cash: -10, aircraftValues: [], slotResaleValue: 0 }), -10);
  });

  it('6.14: Beispiel: 555 + 720 + 250 + 140 + 50 + 200 + 300 = 2 215', () => {
    const s = careerScore(EXAMPLE_CAREER);
    assert.equal(Math.round(s.wealth), 555);
    assert.equal(s.rank, 720);
    assert.equal(s.milestones, 250);
    assert.equal(s.reputation, 140);
    assert.equal(s.takeovers, 50);
    assert.equal(s.research, 200);
    assert.equal(s.years, 300);
    assert.equal(Math.round(s.total), 2215);
    close(s.research / s.total, 0.09, 0.005, 'Forschungs-Anteil');
  });

  it('6.12: mehr Vermögen, höherer Rang, mehr Meilensteine → nie weniger Punkte', () => {
    const base = careerScore(EXAMPLE_CAREER).total;
    assert.ok(careerScore({ ...EXAMPLE_CAREER, companyValue: EXAMPLE_CAREER.companyValue * 2 }).total > base);
    assert.ok(careerScore({ ...EXAMPLE_CAREER, rank: 8 }).total < base);
    assert.ok(careerScore({ ...EXAMPLE_CAREER, milestones: 26 }).total > base);
  });

  it('6.12: Forschung höchstens 200 Punkte; Jahre höchstens 60; Ruf in 0 … 100', () => {
    assert.equal(careerScore({ ...EXAMPLE_CAREER, bonusResearch: completedBonusResearch(ALL_IDS) }).research, 200);
    assert.equal(careerScore({ ...EXAMPLE_CAREER, years: 85.7 }).years, 300);
    assert.equal(careerScore({ ...EXAMPLE_CAREER, years: 12.9 }).years, 60);
    assert.equal(careerScore({ ...EXAMPLE_CAREER, reputation: 120 }).reputation, 200);
  });

  it('6.12: gleiche Leistung 1960 und 1990 gestartet → gleiche Vermögens-Punkte (W9)', () => {
    const a = careerScore({ ...EXAMPLE_CAREER, month: jan(2000), companyValue: 3e8 * costIndex(jan(2000)) });
    const b = careerScore({ ...EXAMPLE_CAREER, month: jan(2030), companyValue: 3e8 * costIndex(jan(2030)) });
    close(a.wealth, b.wealth, 1e-9);
  });

  it('6.12: Vermögen unter 1 Mio. $ von 1960 → 0; Free Mode ohne Rang-Punkte', () => {
    assert.equal(careerScore({ ...EXAMPLE_CAREER, companyValue: -5 }).wealth, 0);
    assert.equal(careerScore({ ...EXAMPLE_CAREER, mode: 'free' }).rank, 0);
  });

  it('6.12: zwei Ruhmeshallen; ein Free-Eintrag erscheint nie in der Normal-Halle', () => {
    const entry = (id: string, score: number, mode?: 'normal' | 'free'): HallEntry => ({
      id,
      airline: id,
      score,
      filed: `2026-01-${String(10 + score % 10).padStart(2, '0')}`,
      mode,
    });
    let halls: HallsOfFame = { normal: [], free: [] };
    halls = fileCareer(halls, entry('a', 100));
    halls = fileCareer(halls, entry('b', 300, 'free'));
    halls = fileCareer(halls, entry('c', 200, 'normal'));
    halls = fileCareer(halls, entry('a', 150));
    assert.deepEqual(halls.normal.map((e) => e.id), ['c', 'a']);
    assert.deepEqual(halls.free.map((e) => e.id), ['b']);
    for (let i = 0; i < 20; i++) halls = fileCareer(halls, entry(`n${i}`, i));
    assert.equal(halls.normal.length, HALL_SIZE);
    assert.ok(halls.normal.every((e) => e.mode !== 'free'));
  });

  it('6.12: alte gemeinsame Halle nach Spielart teilen; ohne Angabe Normal', () => {
    const halls = splitHall([
      { id: 'x', airline: 'x', score: 5, filed: '2026-01-01' },
      { id: 'y', airline: 'y', score: 9, filed: '2026-01-01', mode: 'free' },
    ]);
    assert.deepEqual(halls.normal.map((e) => e.id), ['x']);
    assert.deepEqual(halls.free.map((e) => e.id), ['y']);
  });
});

// ---------------------------------------------------------------------------
// 6.13 Startwerte
// ---------------------------------------------------------------------------

describe('Abschnitt 6.13 Startwerte', () => {
  it('6.13: Ruf 50; Normal ohne Forschung; höherer Startrang mit Klassen-Projekten; Free Mode alle Klassen', () => {
    assert.equal(START_REPUTATION, 50);
    assert.deepEqual(startingResearch(0), { done: [], active: [] });
    assert.deepEqual(startingResearch(4).done, ['class-regional', 'class-narrowbody', 'class-widebody']);
    const free = startingResearch(MAX_RANK);
    assert.equal(openSizeClasses(free.done).size, 6);
    assert.equal(completedBonusResearch(free.done), 0);
  });
});
