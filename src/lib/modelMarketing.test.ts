/**
 * Tests für `src/lib/modelMarketing.ts` (Paket 4.8): Werbung und Frequent flyer in der Werbe-Ansicht nach dem Modell
 * (3.9.4, 3.9.5, 5.14, 6.3). Jede Zahl muss die sein, die der Abschluss rechnet (R2).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { atCost } from '../model/basics';
import { ADVERTISING_MAX, ADVERTISING_REPUTATION_MAX, CAMPAIGN_COST_1960 } from '../model/constants';
import { monthOperations } from '../model/monthClose';
import { campaignMonthlyCost, ffpLoyaltyBonus } from './marketing';
import type { Campaign, Marketing } from './gameState';
import { createGameSystems } from './gameState';
import { PLAYER_ID, defaultModelEnv, modelGame, type AppGame } from './modelMonth';
import {
  campaignMonthCost,
  campaignMonthsLeft,
  campaignRunCost,
  campaignsMonthCost,
  loyaltyBonus,
  marketingReputation,
  regionAdvertising,
  runningCampaigns,
} from './modelMarketing';

const M = (1995 - 1960) * 12 + 5; // Juni 1995

const camp = (id: string, tier: Campaign['tier'], region: Campaign['region'], startOffset = M, duration = 6): Campaign =>
  ({ id, tier, region, startOffset, duration });

const marketing = (campaigns: Campaign[], ffp: { since: number } | null = null): Marketing => ({
  ...createGameSystems().marketing,
  campaigns,
  ffpActive: ffp !== null,
  ffpSinceOffset: ffp?.since ?? null,
});

describe('Paket 4.8: Kampagnenpreis mit dem Kostenindex (5.14)', () => {
  it('Preis je Monat = atCost(CAMPAIGN_COST_1960, Monat); die eigene Teuerung von 3 %/Jahr entfällt', () => {
    for (const tier of ['local', 'national', 'global'] as const) {
      assert.equal(campaignMonthCost(tier, M), atCost(CAMPAIGN_COST_1960[tier], M));
    }
    assert.notEqual(Math.round(campaignMonthCost('national', M)), campaignMonthlyCost('national', M), 'alter Preis weicht ab');
    assert.equal(campaignMonthCost('local', 0), 150_000);
  });

  it('Laufzeit-Preis = Summe der Monatspreise, jeder zum Index seines Monats', () => {
    const total = campaignRunCost('global', M, 12);
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += campaignMonthCost('global', M + i);
    assert.ok(Math.abs(total - sum) < 1e-6);
    assert.ok(total > 12 * campaignMonthCost('global', M), 'Index steigt im Jahr');
  });

  it('Kosten der laufenden Kampagnen = was der Abschluss bucht (R2)', () => {
    const g = gameWith(marketing([camp('a', 'national', 'EU'), camp('b', 'global', 'EU'), camp('old', 'local', 'NA', M - 12, 3)]));
    const ops = monthOperations(modelGame(g, defaultModelEnv()).state)[PLAYER_ID];
    const booked = ops.campaigns.reduce((s, x) => s + x, 0);
    assert.ok(Math.abs(campaignsMonthCost(g.marketing, M) - booked) < 1e-6);
    assert.equal(ops.campaigns.length, 2);
  });
});

describe('Paket 4.8: Werbe-Faktor je Region (3.9.5)', () => {
  it('ohne Kampagne überall 1', () => {
    const f = regionAdvertising(marketing([]), M);
    assert.deepEqual(Object.values(f), [1, 1, 1, 1, 1, 1]);
  });

  it('national + global in Europa: gekappt bei ADVERTISING_MAX; andere Regionen nur global', () => {
    const f = regionAdvertising(marketing([camp('a', 'national', 'EU'), camp('b', 'global', 'NA')]), M);
    assert.equal(f.EU, ADVERTISING_MAX);
    assert.ok(Math.abs(f.NA - 1.18) < 1e-12);
    assert.ok(Math.abs(f.OC - 1.18) < 1e-12);
  });

  it('abgelaufene und noch nicht begonnene Kampagnen wirken nicht', () => {
    const m = marketing([camp('old', 'national', 'EU', M - 6, 6), camp('new', 'national', 'AS', M + 1, 6)]);
    assert.equal(runningCampaigns(m, M).length, 0);
    assert.equal(regionAdvertising(m, M).EU, 1);
    assert.equal(campaignMonthsLeft(camp('x', 'local', 'EU', M - 2, 6), M), 4);
  });
});

describe('Paket 4.8: Ruf aus Werbung (6.3, E37)', () => {
  it('Punkte im Ruf-Ziel, höchstens ADVERTISING_REPUTATION_MAX; das Programm bringt keinen Ruf', () => {
    assert.equal(marketingReputation(marketing([]), M), 0);
    assert.equal(marketingReputation(marketing([camp('a', 'national', 'EU')]), M), 1);
    assert.equal(marketingReputation(marketing([camp('a', 'national', 'EU'), camp('b', 'global', 'EU'), camp('c', 'local', 'NA')]), M), ADVERTISING_REPUTATION_MAX);
    assert.equal(marketingReputation(marketing([], { since: M - 5 }), M), 0);
  });
});

describe('Paket 4.8: Treue-Zuschlag des Frequent-flyer-Programms (3.9.4)', () => {
  it('5 % im ersten Monat, +1 Punkt je Monat, höchstens 20 %; 0 ohne Programm', () => {
    assert.equal(loyaltyBonus(marketing([]), M), 0);
    assert.ok(Math.abs(loyaltyBonus(marketing([], { since: M }), M) - 0.05) < 1e-12);
    assert.ok(Math.abs(loyaltyBonus(marketing([], { since: M - 3 }), M) - 0.08) < 1e-12);
    assert.ok(Math.abs(loyaltyBonus(marketing([], { since: M - 40 }), M) - 0.2) < 1e-12);
  });

  it('gleiche Werte wie die alte Anzeige (nur die Wirkung gilt jetzt für alle Flüge)', () => {
    for (const since of [M, M - 1, M - 7, M - 20]) {
      const m = marketing([], { since });
      assert.ok(Math.abs(loyaltyBonus(m, M) - ffpLoyaltyBonus(m, M)) < 1e-9, `seit ${since}`);
    }
  });
});

function gameWith(m: Marketing): AppGame {
  const sys = createGameSystems();
  return {
    month: M, startMonth: M - 60, airlineCode: 'XA', selectedHub: 'FRA', difficulty: 'Normal', aiDifficulty: 'Normal', aiAirlinesCount: 0,
    capital: 150e6, monthlyCapex: [], fleet: [], routes: [], airportManagement: {},
    reputation: 50, profitStreak: 0, staff: { salaryPct: 100, morale: 70, strike: null }, marketing: m, eventChoices: {},
    career: sys.career, milestones: [], annualGoal: null, scenario: null, reportHistory: [], aiAirlines: [], randomEvents: [], disruptions: [],
  };
}
