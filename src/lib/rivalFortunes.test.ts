import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AI_MONTHLY_SUBSIDY, AI_SUBSIDY_FLOOR, DISTRESS_TO_SALE_MONTHS, PRICE_WAR_CUT, SALE_TO_LIQUIDATION_MONTHS,
  aiMonthlySubsidy, generateAiAirlines, simulateAiAirlinesTurn
} from './aiSimulation';
import { airports } from '../data/airportRegistry';
import { buildTakeover, takeoverQuote, withTakenSlots, HEALTHY_PREMIUM } from './takeover';
import { RANK_NEEDED } from './airlineRank';
import { offerAttractiveness } from './financeUtils';
import type { AiAirline } from '../components/CompetitorsView';

const offsetFor = (year: number) => (year - 1960) * 12;

/** Runs the rivals for some months from a year, on a fixed hub for the player. */
function run(ais: AiAirline[], startYear: number, months: number, playerRoutes: any[] = [], blocked?: Set<string>) {
  let current = ais;
  const messages: string[] = [];
  for (let m = 0; m < months; m++) {
    const out = simulateAiAirlinesTurn(current, airports, offsetFor(startYear) + m, 'FRA', playerRoutes, { blocked });
    current = out.updatedAis;
    messages.push(...out.newMessages.map(x => x.text));
  }
  return { ais: current, messages };
}

test('the subsidy is full until 1985, fades to a third by 2005 and stays there', () => {
  assert.equal(aiMonthlySubsidy(offsetFor(1970)), AI_MONTHLY_SUBSIDY);
  assert.equal(aiMonthlySubsidy(offsetFor(1985)), AI_MONTHLY_SUBSIDY);
  const mid = aiMonthlySubsidy(offsetFor(1995));
  assert.ok(mid < AI_MONTHLY_SUBSIDY && mid > AI_SUBSIDY_FLOOR);
  assert.equal(aiMonthlySubsidy(offsetFor(2005)), AI_SUBSIDY_FLOOR);
  assert.equal(aiMonthlySubsidy(offsetFor(2040)), AI_SUBSIDY_FLOOR);
});

test('a price war makes a rival more attractive and costs it fares', () => {
  const normal = offerAttractiveness(10, 1);
  const war = offerAttractiveness(10, 1 / (1 - PRICE_WAR_CUT));
  assert.ok(war > normal * 1.1);
});

test('rivals never open a route into an airport the player owns', () => {
  const open = new Set(['AMS', 'LHR', 'CDG', 'MAD', 'FCO', 'VIE', 'ZRH', 'BRU', 'CPH', 'MUC', 'BCN', 'ATH', 'DUB', 'LIS', 'OSL', 'ARN']);
  // Rivals are drawn at random, and one may find nothing it can fly to the few
  // airports left open: draw again rather than let luck decide the test.
  for (let attempt = 0; attempt < 5; attempt++) {
    const ais = generateAiAirlines(4, 'Hard', 'FRA', offsetFor(1990));
    const blockedIds = new Set(airports.filter(a => !open.has(a.id)).map(a => a.id));
    // The rivals' own hubs are fine as origins; only destinations are closed.
    ais.forEach(ai => blockedIds.delete(ai.hub));
    const { ais: after } = run(ais, 1990, 18, [], blockedIds);
    const dests = after.flatMap(ai => ai.routes.map(r => r.destination));
    for (const d of dests) assert.ok(!blockedIds.has(d), `${d} is closed to rivals`);
    if (dests.length > 0) return;
  }
  assert.fail('no rival flew anything in five attempts');
});

test('a rival sinking into debt is put up for sale after six months and wound up a year later', () => {
  const [base] = generateAiAirlines(1, 'Normal', 'FRA', offsetFor(2010));
  let ai: AiAirline = { ...base, capital: -900_000_000 };
  let sale: number | null = null;
  let gone: number | null = null;
  let current = [ai];
  for (let m = 0; m < 24 && gone === null; m++) {
    const out = simulateAiAirlinesTurn(current, airports, offsetFor(2010) + m, 'FRA', []);
    current = out.updatedAis;
    if (current.length === 0) { gone = m; break; }
    if (sale === null && current[0].forSale) sale = m;
  }
  assert.equal(sale, DISTRESS_TO_SALE_MONTHS - 1, 'for sale at the sixth month of debt');
  assert.ok(gone !== null && gone >= (sale ?? 0) + SALE_TO_LIQUIDATION_MONTHS, 'gone a year after it went on sale');
});

test('a rival that recovers is taken off the market', () => {
  const [base] = generateAiAirlines(1, 'Normal', 'FRA', offsetFor(2010));
  const ai: AiAirline = { ...base, capital: 50_000_000, forSale: true, forSaleSince: offsetFor(2010) - 3, distressMonths: 1 };
  const out = simulateAiAirlinesTurn([ai], airports, offsetFor(2010), 'FRA', []);
  assert.equal(out.updatedAis.length, 1);
  assert.equal(out.updatedAis[0].forSale, false);
  assert.ok(out.newMessages.some(m => /RECOVERY/.test(m.text)));
});

test('a big, rich, combative rival opens a second hub, away from the closed airports', () => {
  const [base] = generateAiAirlines(1, 'Hard', 'FRA', offsetFor(2000));
  const plane = base.fleet[0];
  const fleet = Array.from({ length: 9 }, (_, i) => ({ ...plane, reg: `${base.code}-A${200 + i}` }));
  const ai: AiAirline = { ...base, aggression: 9, capital: 900_000_000, fleet: [...fleet] };
  const realRandom = Math.random;
  Math.random = () => 0.01;
  try {
    const out = simulateAiAirlinesTurn([ai], airports, offsetFor(2000), 'FRA', []);
    assert.ok(out.updatedAis[0].secondHub, 'a second hub was opened');
    assert.notEqual(out.updatedAis[0].secondHub, ai.hub);
  } finally {
    Math.random = realRandom;
  }
});

// --- Takeovers -------------------------------------------------------------------

function rivalWithAssets(): AiAirline {
  const [base] = generateAiAirlines(1, 'Normal', 'FRA', offsetFor(2000));
  const plane = { ...base.fleet[0], purchasedAt: offsetFor(1995), conditionGeneral: 55, conditionInterior: 40 };
  const route = (dest: string, departures: number) => ({
    origin: base.hub, destination: dest, aircraftClass: 'narrowbody' as const, departures, monthlyProfit: 0
  });
  return { ...base, fleet: [plane], routes: [route('CDG', 14), route('LHR', 7)] };
}

test('a distressed rival is cheaper than a healthy one and needs a lower rank', () => {
  const ai = rivalWithAssets();
  const distressed = takeoverQuote({ ...ai, forSale: true }, 0);
  const healthy = takeoverQuote({ ...ai, forSale: false }, 0);
  assert.ok(healthy.price >= distressed.price * (HEALTHY_PREMIUM - 0.2));
  assert.match(distressed.blocked ?? '', /International/);
  assert.match(healthy.blocked ?? '', /Global Player/);
  assert.equal(takeoverQuote({ ...ai, forSale: true }, RANK_NEEDED.takeoverDistressed).blocked, null);
  assert.ok(takeoverQuote({ ...ai, forSale: true }, RANK_NEEDED.takeoverDistressed).blocked === null && takeoverQuote({ ...ai, forSale: false }, RANK_NEEDED.takeoverDistressed).blocked !== null);
  assert.equal(takeoverQuote({ ...ai, forSale: true }, RANK_NEEDED.takeoverDistressed - 1).blocked !== null, true);
  assert.equal(takeoverQuote({ ...ai, forSale: false }, RANK_NEEDED.takeoverHealthy).blocked, null);
  assert.equal(takeoverQuote({ ...ai, forSale: false }, RANK_NEEDED.takeoverHealthy).blocked, null);
  assert.ok(distressed.price >= 1_000_000);
});

test('a takeover brings the aircraft with their age and wear, and the slots at the home airport', () => {
  const ai = rivalWithAssets();
  const deal = buildTakeover(ai, ['D-EXIST']);
  assert.equal(deal.aircraft.length, 1);
  assert.equal(deal.aircraft[0].purchasedAt, offsetFor(1995));
  assert.equal(deal.aircraft[0].conditionGeneral, 55);
  assert.equal(deal.aircraft[0].conditionInterior, 40);
  assert.notEqual(deal.aircraft[0].registration, 'D-EXIST');
  assert.deepEqual(deal.slots, { regional: 0, narrowbody: 21, widebody: 0 });
  assert.equal(deal.hub, ai.hub);
});

test('slots taken over add to what the airline holds and make it at least a tier-1 airport', () => {
  const infra = withTakenSlots(undefined, { regional: 2, narrowbody: 21, widebody: 0 });
  assert.equal(infra.level, 1);
  assert.equal(infra.slots.narrowbody, 21);
  const more = withTakenSlots({ level: 2, slots: { regional: 5, narrowbody: 10, widebody: 1 }, desks: { normal: 3, self: 0 } }, { regional: 0, narrowbody: 5, widebody: 0 });
  assert.equal(more.level, 2);
  assert.deepEqual(more.slots, { regional: 5, narrowbody: 15, widebody: 1 });
  assert.equal(more.desks.normal, 3);
});

test('a new rival founded in a running game takes no hub or code that is in use', () => {
  const existing = generateAiAirlines(6, 'Normal', 'FRA', offsetFor(1990));
  for (let n = 0; n < 5; n++) {
    const [fresh] = generateAiAirlines(1, 'Normal', 'FRA', offsetFor(1990), '', '#facc15', existing);
    if (!fresh) continue;
    assert.ok(!existing.some(e => e.code === fresh.code || e.hub === fresh.hub), `${fresh.code} at ${fresh.hub} clashes`);
    assert.ok(!existing.some(e => e.color === fresh.color), 'its own colour');
  }
});
