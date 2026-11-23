/**
 * Regeltests Paket 4.7a (F67): Kopfzeile, Firma und Monatsbericht nach dem Modell – Unternehmenswert und
 * Karriere-Punkte (6.12, E48), Kreditlinie (8.14), Krisen-Antwort im Ereignis-Band (8.5), Ruf-Wirkung (3.9, E36),
 * Flotten-Mischung (5.12), Strafe des Jahresziels (6.11, E58), Bericht mit Posten aus 5.16 und Kassen-Weg (8.2).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { OwnedAircraft } from '../components/MyFleetView';
import { aircraftList } from '../data/aircraft';
import {
  COMMONALITY_DISCOUNTS,
  CREDIT_LIMIT_SHARE,
  FREE_FAMILIES,
  GOAL_MISS_PENALTY_SHARE,
  OVERDRAWN_TO_FORCED_SALE,
  VARIETY_PENALTY_PER_FAMILY,
} from '../model/constants';
import { aircraftValue, fleetCommonalityFactors } from '../model/fleet';
import { fleetValue } from '../model/monthClose';
import { careerScore, companyValue } from '../model/progress';
import { companyValueOf } from '../model/rivalMonth';
import { createOwnedAircraft, defaultCabin } from './fleet';
import { createGameSystems } from './gameState';
import type { AirportInfrastructure, MonthlyReport, SimulatedRoute } from './gameTypes';
import { aircraftState } from './modelBridge';
import {
  companyWorth,
  creditStatus,
  eventEffect,
  fleetMix,
  fleetMixText,
  goalMissPenalty,
  playerCompany,
  playerScore,
  playerWorth,
  reputationEffect,
} from './modelCompany';
import { PLAYER_ID, defaultModelEnv, modelGame, runModelMonth, type AppGame } from './modelMonth';
import { isModelReport, reportView } from './modelReport';

const M = (1995 - 1960) * 12 + 5; // Juni 1995
const ENV = defaultModelEnv();
const type = (id: string) => aircraftList.find((a) => a.id === id)!;

function plane(reg: string, id = 'a320ceo', month = M - 24): OwnedAircraft {
  const t = type(id);
  const { config, baseInteriorPop } = defaultCabin(t);
  const [p] = createOwnedAircraft(t, 1, { config, baseInteriorPop, hub: 'FRA', existingRegistrations: [], purchasedAt: month });
  return { ...p, registration: reg };
}

const infra = (level: 1 | 2 | 3, narrowbody: number): AirportInfrastructure => ({
  level,
  slots: { regional: 0, narrowbody, widebody: 0 },
  stands: { narrowbody: 2, widebody: 0 },
  desks: { normal: 2, self: 0 },
});

const ROUTE: SimulatedRoute = {
  id: 'r1', airline: 'Player', origin: 'FRA', destination: 'MAD', distance: 1420, aircraft: 'D-AAAA', weeklyFlights: 7, paxPerWeek: 0,
  classConfigs: { economy: { catering: [['b15']], extras: [], service: [] } },
  ticketPrices: { economy: 150 },
};

function game(over: Partial<AppGame> = {}): AppGame {
  const sys = createGameSystems();
  return {
    month: M, startMonth: M - 60, airlineCode: 'XA', brandingColor: '#ffcc00', selectedHub: 'FRA', difficulty: 'Normal',
    aiDifficulty: 'Normal', aiAirlinesCount: 0, capital: 150e6, monthlyCapex: [], fleet: [plane('D-AAAA')], routes: [ROUTE],
    airportManagement: { FRA: infra(2, 20), MAD: infra(1, 10) }, reputation: 55, profitStreak: 0,
    staff: { salaryPct: 100, morale: 70, strike: null }, marketing: sys.marketing, eventChoices: {}, career: sys.career,
    milestones: [], annualGoal: null, scenario: null, reportHistory: [], aiAirlines: [], randomEvents: [], disruptions: [],
    ...over,
  };
}

const fixedIds = () => {
  let n = 0;
  return () => ++n;
};

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

describe('Unternehmenswert und Kreditlinie (6.12, 8.14)', () => {
  const { state } = modelGame(game(), ENV);
  const player = playerCompany(state);

  it('Unternehmenswert = Wert der Übernahme (companyValueOf), Flottenwert = Σ aircraftValue', () => {
    const w = companyWorth(player, state.month);
    assert.equal(w.companyValue, companyValue(companyValueOf(player, state.month)));
    close(w.fleetValue, fleetValue(player.aircraft, state.month));
    assert.ok(w.slotValue > 0, 'eigene Slots zählen');
    close(w.companyValue, w.cash + w.fleetValue + w.slotValue + w.deposits);
    assert.deepEqual(playerWorth(state, { cash: 0, fleet: [], month: 0 }), w);
  });

  it('Ohne Modell-Spielstand: Kasse + Flugzeuge zum Wert', () => {
    const fleet = [plane('D-AAAA')];
    const w = playerWorth(null, { cash: 5e6, fleet, month: M });
    close(w.fleetValue, aircraftValue(aircraftState(fleet[0]), M));
    assert.equal(w.companyValue, 5e6 + w.fleetValue);
  });

  it('Kreditlinie: Grenze aus dem Flottenwert, Zustand, Abschlüsse bis zum Zwangsverkauf', () => {
    const healthy = creditStatus(1e6, 40e6, 0);
    assert.deepEqual([healthy.state, healthy.used, healthy.closesToForcedSale], ['healthy', 0, null]);
    assert.equal(healthy.limit, CREDIT_LIMIT_SHARE * 40e6);
    const credit = creditStatus(-5e6, 40e6, 0);
    assert.deepEqual([credit.state, credit.used, credit.closesToForcedSale], ['credit', 5e6, null]);
    assert.equal(creditStatus(-25e6, 40e6, 0).closesToForcedSale, OVERDRAWN_TO_FORCED_SALE);
    assert.equal(creditStatus(-25e6, 40e6, OVERDRAWN_TO_FORCED_SALE - 1).closesToForcedSale, 1);
    assert.equal(creditStatus(-25e6, 40e6, OVERDRAWN_TO_FORCED_SALE + 3).closesToForcedSale, 1);
    assert.equal(creditStatus(-1, 0, 0).state, 'overdrawn', 'ohne Flugzeuge ist die Grenze 0');
  });
});

describe('Karriere-Punkte nach dem Modell (6.12)', () => {
  const base = { companyValue: 80e6, month: M, rank: 4, free: false, milestones: 3, reputation: 60, takeovers: 1, researchDone: [] as string[], years: 12 };

  it('= careerScore des Modells, Teile gerundet', () => {
    const s = playerScore(base);
    const m = careerScore({ ...base, mode: 'normal', bonusResearch: 0 });
    assert.equal(s.total, Math.round(m.total));
    assert.equal(s.wealth, Math.round(m.wealth));
    assert.equal(s.longevity, Math.round(m.years));
  });

  it('Mehr Unternehmenswert, höherer Rang → nie weniger Punkte; Free Mode ohne Rang-Punkte', () => {
    assert.ok(playerScore({ ...base, companyValue: 200e6 }).total >= playerScore(base).total);
    assert.ok(playerScore({ ...base, rank: 5 }).total >= playerScore(base).total);
    assert.equal(playerScore({ ...base, free: true }).rank, 0);
  });

  it('Klassen-Projekte zählen nicht, unbekannte auch nicht', () => {
    assert.equal(playerScore({ ...base, researchDone: ['class-widebody', 'no-such-project'] }).development, 0);
  });
});

describe('Ereignis-Band: Krisen-Antwort (8.5)', () => {
  it('Ohne Antwort der Markt-Faktor, mit Rückgewinnung f + (1 − f) × r', () => {
    const none = eventEffect('Global Financial Crisis', 0.75, []);
    assert.deepEqual(none, { market: 0.75, player: 0.75 });
    const bought = eventEffect('Global Financial Crisis', 0.75, ['Global Financial Crisis']);
    close(bought.player, 0.75 + 0.25 * 0.33);
    assert.equal(bought.market, 0.75);
  });

  it('Zufallsereignis: kein Modell-Ereignis, keine Antwort, Faktor wie übergeben', () => {
    assert.deepEqual(eventEffect('Volcanic ash cloud', 0.9, ['Volcanic ash cloud']), { market: 0.9, player: 0.9 });
  });
});

describe('Firma: Ruf, Flotten-Mischung, Jahresziel', () => {
  it('Ruf 50 wirkt neutral (E36)', () => {
    assert.equal(reputationEffect(50), 1);
    assert.ok(reputationEffect(80) > 1 && reputationEffect(20) < 1);
  });

  it('Flotten-Mischung = Mittel von fleetCommonalityFactors des Modells', () => {
    const fleet = [plane('A'), plane('B'), plane('C'), plane('D', 'a220-100'), plane('E', 'a300b2'), plane('F', 'a310-200'), plane('G', 'a330-200')];
    const mix = fleetMix(fleet);
    const factors = fleetCommonalityFactors(fleet.map((p) => ({ family: aircraftState(p).family })));
    close(mix.meanFactor, factors.reduce((s, f) => s + f, 0) / factors.length);
    assert.equal(mix.families[0].count, 3);
    assert.equal(mix.penalty, (mix.families.length - FREE_FAMILIES) * VARIETY_PENALTY_PER_FAMILY);
    assert.equal(fleetMix([]).meanFactor, 1);
  });

  it('Erklärtext aus den Konstanten', () => {
    const text = fleetMixText();
    for (const d of COMMONALITY_DISCOUNTS) assert.ok(new RegExp(`${d.from} (of a kind save )?${Math.round(d.discount * 100)}%`).test(text), text);
  });

  it('Strafe des Jahresziels = Anteil der Prämie (E58)', () => {
    assert.equal(goalMissPenalty(1e6), GOAL_MISS_PENALTY_SHARE * 1e6);
  });
});

describe('Monatsbericht nach dem Modell (5.16, 8.2)', () => {
  const sumCosts = (r: MonthlyReport) =>
    reportView(r).expenses.reduce((s, c) => s + (c.variant === 'net' ? -c.total : c.total), 0);

  it('Σ Posten = Erlös − Ergebnis; Kassen-Zeilen = Kassen-Änderung; ohne Lieferung kein Rest', () => {
    const out = runModelMonth(game(), ENV, fixedIds());
    const r = out.report;
    assert.ok(isModelReport(r));
    close(sumCosts(r), out.modelReport.revenue - out.modelReport.result);
    const view = reportView(r);
    close(view.cash.total, out.modelReport.cashEnd - out.modelReport.cashStart);
    assert.equal(view.cash.items[0].label, 'Operating profit');
    assert.ok(!view.cash.items.some((i) => i.label.startsWith('Deliveries')), JSON.stringify(view.cash.items));
    assert.equal(view.credit?.state, 'healthy');
  });

  it('Einmalausgaben des Monats stehen im Bericht; Kauf zum Wert ohne Rest-Zeile', () => {
    const buy = plane('D-BBBB', 'a320ceo', M);
    const price = aircraftValue(aircraftState(buy), M);
    const g = game({ capital: 150e6 - price - 2e6, fleet: [plane('D-AAAA'), buy], monthlyCapex: [{ label: 'Aircraft Purchases', amount: price }, { label: 'Research', amount: 2e6 }] });
    const out = runModelMonth(g, ENV, fixedIds());
    assert.deepEqual(out.report.capexItems, [{ label: 'Aircraft Purchases', amount: price }, { label: 'Research', amount: 2e6 }]);
    const view = reportView(out.report);
    close(view.cash.total, out.modelReport.cashEnd - out.modelReport.cashStart);
    assert.ok(view.cash.items.some((i) => i.label === 'Aircraft Purchases' && i.amount === -price));
    const rest = view.cash.items.find((i) => i.label.startsWith('Deliveries'));
    assert.equal(rest, undefined, `Rest ${rest?.amount}`);
    assert.equal(out.report.cash?.start, out.modelReport.cashStart);
    assert.equal(out.report.cash?.fleetValue, out.modelReport.fleetValueEnd);
  });

  it('Lieferung einer Vorbestellung: Restzahlung als eigene Zeile', () => {
    const sys = createGameSystems();
    const order = { id: 'ord1', aircraftId: 'a320ceo', quantity: 1, placedOffset: M - 6, deliveryOffset: M, unitPrice: 1, deposit: 9e6, postponed: 0 };
    const out = runModelMonth(game({ career: { ...sys.career, orders: [order] } }), ENV, fixedIds());
    const view = reportView(out.report);
    close(view.cash.total, out.modelReport.cashEnd - out.modelReport.cashStart);
    const rest = view.cash.items.find((i) => i.label.startsWith('Deliveries'));
    assert.ok(rest && rest.amount < 0, JSON.stringify(view.cash.items));
  });

  it('Bericht vor dem Modell: gespeicherte Posten und Rest-Zeile, Summe = Erlös − Ergebnis', () => {
    const old: MonthlyReport = {
      month: 3, year: 1980, routeRevenues: 1_000_000, routeCosts: 600_000, airportUpkeep: 100_000, totalProfit: 150_000,
      breakdown: { fuel: 300_000, staff: 100_000, routeInfra: 120_000, catering: 80_000, mgt: 60_000, desks: 40_000, fleetOwnership: 100_000, hubIncome: 0 },
    };
    assert.equal(isModelReport(old), false);
    assert.equal(sumCosts(old), 850_000);
    const view = reportView(old);
    assert.ok(view.expenses.some((c) => c.id === 'other' && c.total === 50_000));
    assert.equal(view.cash.total, 150_000);
    assert.equal(view.credit, null);
  });
});

describe('Spielende und Jubiläum: Unternehmenswert nach dem Abschluss', () => {
  it('runModelMonth liefert den Unternehmenswert des Spielers im neuen Monat', () => {
    const out = runModelMonth(game(), ENV, fixedIds());
    const next = modelGame({ ...game(), month: out.month, capital: out.capital, fleet: [...out.fleet], routes: [...out.routes], airportManagement: out.airportManagement, career: out.career, ledgerValues: out.ledgerValues, monthlyCapex: [] }, ENV);
    const p = next.state.companies.find((c) => c.id === PLAYER_ID)!;
    close(out.companyValue, companyWorth(p, out.month).companyValue);
  });
});
