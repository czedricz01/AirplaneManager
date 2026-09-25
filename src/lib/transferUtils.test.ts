import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeNetworkFinancials,
  computeTransferFlows,
  connectionGap,
  countConnections,
  hubQuality,
  isFeasibleConnection,
  legTimes,
  type NetworkEnv
} from './transferUtils';
import { calculateRouteFinancials, getFlightDurationMinutes } from './financeUtils';
import { WEEK_MIN } from './scheduleUtils';
import { airportsMapAdjusted } from '../data/airportRegistry';
import { calculateDistance } from '../data/airports';
import { aircraftList } from '../data/aircraft';

// --- Fixture -------------------------------------------------------------------

/**
 * A hub with a spoke to each of `spokes`, one aircraft per route. Two round
 * trips a day, starting 06:00 and 13:00: the morning return lands at the hub
 * in time for the afternoon departures, which is what makes connections.
 */
function hubNetwork(hub: string, spokes: string[], opts: { aircraftId?: string; perDay?: number; hubLevel?: number } = {}) {
  const spec = aircraftList.find(a => a.id === (opts.aircraftId || '727-200'))!;
  const perDay = opts.perDay ?? 2;
  const fleet: any[] = [];
  const routes: any[] = [];
  spokes.forEach((spoke, i) => {
    const economy = Math.round(spec.capacity * 0.85);
    const aircraft = {
      ...spec, registration: `T-${spoke}`, purchasedAt: 0, conditionInterior: 90, conditionGeneral: 90, baseInteriorPop: 60,
      config: { economy, premium: 0, business: spec.capacity - economy, first: 0, details: {} }
    };
    fleet.push(aircraft);
    const o = airportsMapAdjusted.get(hub)!;
    const d = airportsMapAdjusted.get(spoke)!;
    const durMin = getFlightDurationMinutes(o, d, aircraft);
    const schedule: any[] = [];
    for (let day = 1; day <= 7; day++) {
      for (let k = 0; k < perDay; k++) schedule.push({ dayId: day, startHour: 6 + k * 7, startMin: 0, durMin, turnoverMin: 60 });
    }
    routes.push({
      id: `r${i}-${spoke}`, airline: 'My Airline', origin: hub, destination: spoke, aircraft: aircraft.registration,
      distance: Math.round(calculateDistance(o.coords[0], o.coords[1], d.coords[0], d.coords[1])), durMin, schedule,
      classConfigs: { economy: { catering: [['b5']], extras: ['none'], service: ['none'] } }
    });
  });
  const infra = (level: number) => ({
    level, slots: { regional: 0, narrowbody: 200, widebody: 50 }, stands: { narrowbody: 0 }, desks: { normal: 5, self: 0 }
  });
  const airportManagement: Record<string, any> = { [hub]: infra(opts.hubLevel ?? 2) };
  for (const s of spokes) airportManagement[s] = infra(1);
  const env: NetworkEnv = {
    fuelPrice: 1, airportManagement, year: 1975, month: 6, difficulty: 'Normal', airportsMap: airportsMapAdjusted
  };
  return { routes, fleet, env };
}

const seatsOf = (fin: { paxByClass: Record<string, { max: number }> }) =>
  Object.values(fin.paxByClass).reduce((a, c) => a + c.max, 0);
const localPaxOf = (fin: { paxByClass: Record<string, { actual: number }> }) =>
  Object.values(fin.paxByClass).reduce((a, c) => a + c.actual, 0);

// --- Timetable -------------------------------------------------------------------

test('legTimes follows the timetable conventions: boarding, then out, turnaround, back', () => {
  const route = {
    id: 'x', origin: 'AAA', destination: 'BBB', durMin: 100,
    schedule: [{ dayId: 2, startHour: 10, startMin: 0, durMin: 100, turnoverMin: 60 }]
  };
  const start = 1440 + 600;
  assert.deepEqual(legTimes(route), [
    { from: 'AAA', to: 'BBB', dep: start + 30, arr: start + 130 },
    { from: 'BBB', to: 'AAA', dep: start + 190, arr: start + 290 }
  ]);
  const oneWay = { ...route, schedule: [{ ...route.schedule[0], isOneWay: true }] };
  assert.equal(legTimes(oneWay).length, 1, 'a one-way trip has no return leg');
});

test('a connection across the end of the week is found', () => {
  // Lands Sunday 22:30 + 60 min = 23:30; the onward flight leaves Monday 01:00.
  const feeder = { id: 'a', origin: 'OOO', destination: 'HUB', durMin: 60, schedule: [{ dayId: 7, startHour: 22, startMin: 0, durMin: 60, turnoverMin: 60, isOneWay: true }] };
  const onward = { id: 'b', origin: 'HUB', destination: 'DDD', durMin: 60, schedule: [{ dayId: 1, startHour: 0, startMin: 30, durMin: 60, turnoverMin: 60, isOneWay: true }] };
  const [arrival] = legTimes(feeder);
  const [departure] = legTimes(onward);
  assert.equal(arrival.arr, WEEK_MIN - 30);
  assert.equal(departure.dep, 60);
  assert.equal(connectionGap(arrival.arr, departure.dep), 90);
  assert.equal(countConnections([arrival.arr], [departure.dep]), 1);
});

test('30 minutes is too short to change planes, 60 is enough, 7 hours too long', () => {
  assert.equal(isFeasibleConnection(600, 630), false);
  assert.equal(isFeasibleConnection(600, 660), true);
  assert.equal(isFeasibleConnection(600, 600 + 7 * 60), false);
  assert.equal(countConnections([600], [630]), 0);
  assert.equal(countConnections([600], [660]), 1);
});

test('connections are counted by the scarcer side, not per pair', () => {
  // One daily feeder, seven departures in its window: still one connection.
  assert.equal(countConnections([600], [660, 700, 740, 780, 820, 860, 900]), 1);
  assert.equal(countConnections([600, 620, 640], [700]), 1);
});

test('hub quality grows with management and facilities, capped at 1', () => {
  assert.equal(hubQuality(undefined), 0.4);
  assert.ok(Math.abs(hubQuality({ level: 2 }) - 0.7) < 1e-9);
  assert.ok(Math.abs(hubQuality({ level: 3, hubFacilities: { vipLounge: true, catering: true } }) - 0.95) < 1e-9);
  assert.equal(hubQuality({ level: 9 }), 1);
});

// --- Flows ---------------------------------------------------------------------

test('a small hub sells connections worth a real but modest share of its traffic', () => {
  const { routes, fleet, env } = hubNetwork('FRA', ['MAD', 'VIE', 'ATH']);
  const net = computeNetworkFinancials(routes, fleet, { demandFactor: 1 }, env);
  let local = 0;
  let transfer = 0;
  for (const r of routes) {
    const fin = net.finById.get(r.id)!;
    local += localPaxOf(fin);
    transfer += fin.transferPax;
  }
  assert.ok(net.hubStats.FRA.pax > 0, 'passengers change planes at the hub');
  // Every connecting passenger sits on two routes.
  assert.equal(transfer, 2 * net.hubStats.FRA.pax);
  const share = transfer / local;
  // Measured at the time of writing: 1,396 transfer seats on 12,491 local pax (11%).
  assert.ok(share > 0.03 && share < 0.4, `transfer share ${(share * 100).toFixed(1)}%`);
  for (const f of net.hubStats.FRA.flows) assert.equal(f.hub, 'FRA');
});

test('a detour of more than 60% sells no connections', () => {
  // CDG -> FRA -> LHR flies about three times the direct distance.
  const { routes, fleet, env } = hubNetwork('FRA', ['CDG', 'LHR']);
  const net = computeNetworkFinancials(routes, fleet, { demandFactor: 1 }, env);
  assert.deepEqual(net.transfer, {});
  assert.deepEqual(net.hubStats, {});
});

test('city pairs the player already flies direct are left out', () => {
  const { routes, fleet, env } = hubNetwork('FRA', ['MAD', 'VIE']);
  const before = computeNetworkFinancials(routes, fleet, { demandFactor: 1 }, env);
  assert.ok(before.hubStats.FRA?.flows.some(f => f.o === 'MAD' && f.d === 'VIE'));

  const direct = { ...routes[0], id: 'direct', origin: 'MAD', destination: 'VIE', aircraft: 'T-DIRECT' };
  const net = computeNetworkFinancials([...routes, direct], [...fleet, { ...fleet[0], registration: 'T-DIRECT' }], { demandFactor: 1 }, env);
  assert.ok(!(net.hubStats.FRA?.flows || []).some(f => (f.o === 'MAD' && f.d === 'VIE') || (f.o === 'VIE' && f.d === 'MAD')));
});

test('a rival flying the city pair direct takes most of its connecting market', () => {
  const { routes, fleet, env } = hubNetwork('FRA', ['MAD', 'VIE']);
  const flowOf = (net: ReturnType<typeof computeNetworkFinancials>) =>
    net.hubStats.FRA?.flows.find(f => f.o === 'MAD' && f.d === 'VIE')?.pax ?? 0;
  const alone = flowOf(computeNetworkFinancials(routes, fleet, { demandFactor: 1 }, env));
  const rivalled = flowOf(computeNetworkFinancials(routes, fleet, { demandFactor: 1 }, {
    ...env, rivalOffers: [{ origin: 'VIE', destination: 'MAD', departures: 28, airline: 'Rival' }]
  }));
  assert.ok(alone > 0);
  assert.ok(rivalled < alone / 2, `${rivalled} vs ${alone}`);
});

test('connecting passengers never take more seats than the local traffic left empty', () => {
  // One trip a day: fewer seats, so the flows run into capacity.
  for (const spokes of [['MAD', 'VIE', 'ATH', 'LIS', 'WAW'], ['MAD', 'VIE']]) {
    const { routes, fleet, env } = hubNetwork('FRA', spokes, { perDay: 2, aircraftId: '737-100' });
    const local = new Map(routes.map(r => [r.id, calculateRouteFinancials(
      r, fleet.find(f => f.registration === r.aircraft), env.fuelPrice, env.airportManagement, env.year, env.month,
      env.difficulty, env.airportsMap, routes, fleet, false, 1, [], { demandFactor: 1 }
    )]));
    const flows = computeTransferFlows(routes, local, { ...env, mods: { demandFactor: 1 }, fleet });
    const net = computeNetworkFinancials(routes, fleet, { demandFactor: 1 }, env);
    for (const r of routes) {
      const fin = local.get(r.id)!;
      const free = seatsOf(fin) - localPaxOf(fin);
      const taken = flows.transfer[r.id]?.pax || 0;
      assert.ok(taken <= free, `${r.destination}: ${taken} transfer pax on ${free} free seats`);
      // Per direction too: on round trips half the empty seats fly each way.
      const routeFlows = flows.flowsByRoute[r.id]?.flows || [];
      const sum = (fs: typeof routeFlows) => fs.reduce((a, f) => a + f.pax, 0);
      const outbound = sum(routeFlows.filter(f => f.d === r.destination));
      const inbound = sum(routeFlows.filter(f => f.o === r.destination));
      assert.equal(outbound + inbound, taken);
      assert.ok(outbound <= Math.floor(free / 2), `${r.destination}: ${outbound} outbound on ${free / 2} free seats`);
      assert.ok(inbound <= Math.floor(free / 2), `${r.destination}: ${inbound} inbound on ${free / 2} free seats`);
      const priced = net.finById.get(r.id)!;
      assert.ok(priced.paxPerWeek <= seatsOf(priced), 'the aircraft is never over-full');
    }
  }
});

test('the result is deterministic, whatever order the routes come in', () => {
  const { routes, fleet, env } = hubNetwork('FRA', ['MAD', 'VIE', 'ATH', 'LIS']);
  const first = computeNetworkFinancials(routes, fleet, { demandFactor: 1 }, env);
  const second = computeNetworkFinancials(routes, fleet, { demandFactor: 1 }, env);
  assert.deepStrictEqual(second, first);
  const shuffled = computeNetworkFinancials([routes[2], routes[0], routes[3], routes[1]], fleet, { demandFactor: 1 }, env);
  assert.deepStrictEqual(shuffled.transfer, first.transfer);
  assert.deepStrictEqual(shuffled.hubStats, first.hubStats);
});

// --- The engine ------------------------------------------------------------------

test('the network result adds exactly the transfer revenue to what a route earns', () => {
  const { routes, fleet, env } = hubNetwork('FRA', ['MAD', 'VIE', 'ATH']);
  const net = computeNetworkFinancials(routes, fleet, { demandFactor: 1 }, env);
  const price = (route: any, mods: any) => calculateRouteFinancials(
    route, fleet.find(f => f.registration === route.aircraft), env.fuelPrice, env.airportManagement, env.year, env.month,
    env.difficulty, env.airportsMap, routes, fleet, false, mods.demandFactor, [], mods
  );
  let checked = 0;
  for (const r of routes) {
    const t = net.transfer[r.id];
    if (!t) continue;
    checked++;
    const alone = price(r, { demandFactor: 1 });
    const withTransfer = net.finById.get(r.id)!;
    assert.deepStrictEqual(withTransfer, price(r, { demandFactor: 1, transfer: net.transfer }), 'the network reads back through the one engine');
    assert.equal(withTransfer.transferPax, t.pax);
    assert.equal(withTransfer.transferRev, t.revenue);
    assert.equal(withTransfer.estWeeklyRev - alone.estWeeklyRev, t.revenue);
    assert.equal(withTransfer.paxPerWeek - alone.paxPerWeek, t.pax);
    assert.deepStrictEqual(withTransfer.paxByClass, alone.paxByClass, 'local passengers are untouched');
    assert.ok(withTransfer.costsBreakdown.catering > alone.costsBreakdown.catering, 'connecting passengers are fed');
    assert.ok(withTransfer.costsBreakdown.paxFees > alone.costsBreakdown.paxFees, 'and pay passenger fees');
  }
  assert.ok(checked > 0);
});

test('without connections the network prices each route exactly as before', () => {
  const { routes, fleet, env } = hubNetwork('FRA', ['CDG', 'LHR']);
  const mods = { demandFactor: 1.05 };
  const net = computeNetworkFinancials(routes, fleet, mods, env);
  for (const r of routes) {
    const plain = calculateRouteFinancials(
      r, fleet.find(f => f.registration === r.aircraft), env.fuelPrice, env.airportManagement, env.year, env.month,
      env.difficulty, env.airportsMap, routes, fleet, false, mods.demandFactor, [], mods
    );
    assert.deepStrictEqual(net.finById.get(r.id), plain);
    assert.equal(plain.transferPax, 0);
    assert.equal(plain.transferRev, 0);
  }
});

test('a full-load preview has no empty seat for connecting passengers', () => {
  const { routes, fleet, env } = hubNetwork('FRA', ['MAD', 'VIE']);
  const r = routes[0];
  const ac = fleet[0];
  const full = (mods: any) => calculateRouteFinancials(
    r, ac, env.fuelPrice, env.airportManagement, env.year, env.month, env.difficulty, env.airportsMap,
    routes, fleet, true, 1, [], mods
  );
  assert.deepStrictEqual(full({ demandFactor: 1, transfer: { [r.id]: { pax: 100, revenue: 9000 } } }), full({ demandFactor: 1 }));
});
