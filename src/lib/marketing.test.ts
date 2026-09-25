import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAMPAIGN_SPECS,
  MAX_REGION_DEMAND,
  campaignBlocker,
  campaignMonthlyCost,
  campaignMonthsLeft,
  campaignTotalCost,
  createCampaign,
  dropExpiredCampaigns,
  ffpLoyaltyBonus,
  ffpMonthlyCost,
  isCampaignActive,
  marketingMonthCost,
  marketingReputation,
  regionDemandFactors,
  routesByRegion,
  startFfp,
  stopFfp
} from './marketing';
import { buildPlayerModifiers, routeDemandFactor, DEFAULT_MARKETING, type Marketing } from './gameState';
import { calculateRouteFinancials, getFlightDurationMinutes } from './financeUtils';
import { migrateSave } from './saveMigration';
import { airportsMapAdjusted } from '../data/airportRegistry';
import { calculateDistance } from '../data/airports';
import { aircraftList } from '../data/aircraft';

const marketingWith = (...campaigns: Marketing['campaigns']): Marketing => ({ ...DEFAULT_MARKETING, campaigns });

/** A 737 flying `origin`-`dest` daily, priced for June 1975 with the given modifiers. */
function price(origin: string, dest: string, mods: ReturnType<typeof buildPlayerModifiers>) {
  const spec = aircraftList.find(a => a.id === '737-100')!;
  const aircraft = {
    ...spec, registration: 'T-MKT', purchasedAt: 0, conditionInterior: 90, conditionGeneral: 90, baseInteriorPop: 60,
    config: { economy: 80, premium: 0, business: 20, first: 0, details: {} }
  };
  const o = airportsMapAdjusted.get(origin)!;
  const d = airportsMapAdjusted.get(dest)!;
  const durMin = getFlightDurationMinutes(o, d, aircraft);
  const route = {
    id: `${origin}-${dest}`, origin, destination: dest, aircraft: 'T-MKT',
    distance: Math.round(calculateDistance(o.coords[0], o.coords[1], d.coords[0], d.coords[1])), durMin,
    schedule: Array.from({ length: 7 }, (_, i) => ({ dayId: i + 1, startHour: 8, startMin: 0, durMin, turnoverMin: 60 })),
    classConfigs: { economy: { catering: [['b5']], extras: ['none'], service: ['none'] } }
  };
  return calculateRouteFinancials(
    route, aircraft, 1.2, {}, 1975, 6, 'Normal', airportsMapAdjusted, [route], [aircraft], false,
    mods.demandFactor, [], mods
  );
}

test('a campaign in a region lifts only the routes that touch it', () => {
  const offset = 180;
  const plain = buildPlayerModifiers({ reputation: 50, eventChoices: {} }, offset);
  const mods = buildPlayerModifiers({
    reputation: 50, eventChoices: {},
    marketing: marketingWith(createCampaign('national', 'EU', 6, offset, 'c1'))
  }, offset);
  const at = (id: string) => airportsMapAdjusted.get(id)!;

  assert.deepEqual(mods.regionDemand, { EU: 1.1 });
  assert.equal(routeDemandFactor(mods, at('FRA'), at('CDG')), plain.demandFactor * 1.1, 'both ends in Europe: the full boost');
  assert.equal(routeDemandFactor(mods, at('FRA'), at('JFK')), plain.demandFactor * 1.05, 'one end: half of it');
  assert.equal(routeDemandFactor(mods, at('JFK'), at('LAX')), plain.demandFactor, 'none: nothing');

  // Through the engine: more demand in Europe, the very same result elsewhere.
  const inside = price('FRA', 'CDG', mods);
  const insideBefore = price('FRA', 'CDG', plain);
  assert.ok(Math.abs(inside.demandData.total / insideBefore.demandData.total - 1.1) < 0.01);
  assert.ok(inside.paxPerWeek >= insideBefore.paxPerWeek);
  assert.deepStrictEqual(price('JFK', 'LAX', mods), price('JFK', 'LAX', plain));
});

test('a global campaign reaches every region, and one region tops out at +25%', () => {
  const offset = 24;
  const global = createCampaign('global', 'EU', 12, offset, 'g');
  const everywhere = regionDemandFactors(marketingWith(global), offset)!;
  assert.deepEqual(Object.keys(everywhere).sort(), ['AF', 'AS', 'EU', 'NA', 'OC', 'SA']);
  for (const f of Object.values(everywhere)) assert.equal(f, 1 + CAMPAIGN_SPECS.global.demandBoost);

  const stacked = regionDemandFactors(marketingWith(global, createCampaign('national', 'AS', 3, offset, 'n')), offset)!;
  assert.equal(stacked.AS, MAX_REGION_DEMAND, '1 + 0.18 + 0.10 is capped');
  assert.equal(stacked.EU, 1.18);
});

test('campaign costs rise 3% a year from 1960', () => {
  assert.equal(campaignMonthlyCost('local', 0), 150_000);
  assert.equal(campaignMonthlyCost('national', 0), 400_000);
  assert.equal(campaignMonthlyCost('global', 11), 1_000_000, 'the same all through 1960');
  assert.equal(campaignMonthlyCost('local', 12), 154_500);
  assert.equal(campaignMonthlyCost('global', 120), Math.round(1_000_000 * Math.pow(1.03, 10)));
  // A campaign running into a new year pays the new price from January.
  assert.equal(campaignTotalCost('local', 10, 4), 2 * 150_000 + 2 * 154_500);
});

test('frequent-flyer loyalty grows a point a month from 5% and stops at 20%', () => {
  const on = startFfp(DEFAULT_MARKETING, 10);
  assert.equal(ffpLoyaltyBonus(DEFAULT_MARKETING, 10), 0, 'nothing without the programme');
  assert.equal(ffpLoyaltyBonus(on, 10), 0.05);
  assert.equal(ffpLoyaltyBonus(on, 11), 0.06);
  assert.equal(ffpLoyaltyBonus(on, 24), 0.19);
  assert.equal(ffpLoyaltyBonus(on, 25), 0.2);
  assert.equal(ffpLoyaltyBonus(on, 200), 0.2);
  assert.equal(buildPlayerModifiers({ reputation: 50, eventChoices: {}, marketing: on }, 15).loyaltyBonus, 0.1);

  // Ending it throws the loyalty away; relaunching starts from 5% again.
  const off = stopFfp(on);
  assert.equal(off.ffpSinceOffset, null);
  assert.equal(ffpLoyaltyBonus(startFfp(off, 30), 30), 0.05);

  assert.equal(ffpMonthlyCost(100_000), 50_000 + 80_000);
  assert.equal(ffpMonthlyCost(0), 50_000);
});

test('a month of marketing is billed line by line and builds reputation', () => {
  const m = startFfp(marketingWith(
    createCampaign('national', 'EU', 6, 0, 'a'),
    createCampaign('local', 'AS', 3, 5, 'later')
  ), 0);
  const cost = marketingMonthCost(m, 0, 10_000);
  assert.equal(cost.campaigns, 400_000, 'a campaign not started yet is not billed');
  assert.equal(cost.ffp, 58_000);
  assert.equal(cost.total, 458_000);
  assert.deepEqual(cost.items.map(i => i.label), ['National campaign, Europe', 'Frequent flyer programme']);
  assert.equal(marketingReputation(m, 0), 1 + 0.3);
  assert.equal(marketingReputation(m, 5), 1 + 0.5 + 0.3);
  assert.equal(marketingReputation(DEFAULT_MARKETING, 5), 0);
  assert.deepEqual(marketingMonthCost(DEFAULT_MARKETING, 5, 1e6), { campaigns: 0, ffp: 0, total: 0, items: [] });
});

test('a campaign runs for its months and is then dropped', () => {
  const c = createCampaign('local', 'EU', 3, 5, 'c');
  assert.deepEqual([4, 5, 6, 7, 8].map(o => isCampaignActive(c, o)), [false, true, true, true, false]);
  assert.equal(campaignMonthsLeft(c, 5), 3);
  assert.equal(campaignMonthsLeft(c, 7), 1);

  const m = marketingWith(c);
  assert.equal(dropExpiredCampaigns(m, 7), m, 'still running in its last month: same object');
  assert.deepEqual(dropExpiredCampaigns(m, 8).campaigns, []);
  // Once it has run out, the modifiers are neutral again.
  assert.deepEqual(buildPlayerModifiers({ reputation: 60, eventChoices: {}, marketing: m }, 8), { demandFactor: buildPlayerModifiers({ reputation: 60, eventChoices: {} }, 8).demandFactor });
});

test('without marketing the player modifiers are exactly what they were', () => {
  for (const marketing of [undefined, DEFAULT_MARKETING, stopFfp(startFfp(DEFAULT_MARKETING, 3))]) {
    const mods = buildPlayerModifiers({ reputation: 70, eventChoices: {}, marketing }, 40);
    assert.deepEqual(Object.keys(mods), ['demandFactor']);
  }
});

test('one campaign per region, one worldwide', () => {
  const m = marketingWith(createCampaign('local', 'EU', 6, 10, 'a'), createCampaign('global', 'NA', 6, 10, 'g'));
  assert.match(campaignBlocker(m, 'national', 'EU', 12)!, /Europe/);
  assert.equal(campaignBlocker(m, 'national', 'AS', 12), null);
  assert.match(campaignBlocker(m, 'global', 'AS', 12)!, /global/);
  assert.equal(campaignBlocker(m, 'national', 'EU', 16), null, 'free again once it has run out');
});

test('campaign routes are counted per region they touch', () => {
  const counts = routesByRegion(
    [{ origin: 'FRA', destination: 'CDG' }, { origin: 'FRA', destination: 'JFK' }, { origin: 'XXX', destination: 'SYD' }],
    airportsMapAdjusted
  );
  assert.deepEqual(counts, { EU: 2, NA: 1, SA: 0, AF: 0, AS: 0, OC: 1 });
});

test('saved marketing is repaired: bad lengths clamped, finished campaigns and duplicates dropped', () => {
  const migrated = migrateSave({
    currentDateOffset: 50,
    marketing: {
      campaigns: [
        { id: 'a', tier: 'national', region: 'EU', startOffset: 48, duration: 6 },
        { id: 'a', tier: 'local', region: 'AS', startOffset: 49, duration: 6 },
        { id: 'old', tier: 'local', region: 'EU', startOffset: 10, duration: 3 },
        { id: 'long', tier: 'global', region: 'NA', startOffset: 50, duration: 1e9 },
        { id: 'zero', tier: 'local', region: 'SA', startOffset: 50, duration: 0 },
        { id: 'bad', tier: 'mega', region: 'EU', startOffset: 50, duration: 3 }
      ],
      ffpActive: true,
      ffpSinceOffset: 90
    }
  }).marketing;
  assert.deepEqual(migrated.campaigns.map((c: any) => c.id), ['a', 'long']);
  assert.equal(migrated.campaigns[0].tier, 'national', 'the first of two with one id is kept');
  assert.equal(migrated.campaigns[1].duration, 120);
  assert.equal(migrated.ffpSinceOffset, 50, 'a start in the future counts from now');
});
