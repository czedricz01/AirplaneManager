/**
 * Regeltests zu Paket 3.8d (Monatsabschluss Teil 4): KI-Eröffnungen (7.9), Slots, Schalter, Lounge und Sperre durch
 * Spieler-Stufe 3 (7.10, E50, E63), Flotte mit Kauf, Modernisierung und Kabinen-Erneuerung (7.11), neues Drehkreuz
 * (7.13), Zuschuss als Zeile im Monatsergebnis (7.14), Fahrpläne der KI (3.13) und Nachrücken (7.7).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aircraftList } from '../data/aircraft';
import { airportsData } from '../data/airports';
import { atCost } from './basics';
import { deskCapacity } from './satisfaction';
import { slotLimit, slotResalePrice } from './airportCosts';
import { subsidyIncome } from './costTotals';
import { DESK_OVERLOAD_FROM, MINUTES_PER_WEEK, RIVAL_STRENGTH, RIVAL_TURN_MINUTES, type RivalPersonality, type RivalStrength, type WorldRegion } from './constants';
import { aircraftValue, newAircraftPrice } from './fleet';
import { refitCabinCondition, refitPrice, saleProceeds } from './fleetMarket';
import {
  closeMonth,
  fleetValue,
  newLedger,
  NO_DECISIONS,
  type AircraftState,
  type CatalogType,
  type CompanyInputs,
  type CompanyState,
  type HoldingState,
  type ModelAirport,
  type ModelState,
  type RouteState,
} from './monthClose';
import { RIVAL_INPUTS, rivalAircraft, rivalCashReserve, rivalService } from './rivals';
import {
  foundRivalCompany,
  newRivalAgent,
  rivalAgentOf,
  rivalBuyableSlots,
  rivalDecisions,
  rivalRefill,
  rivalSchedule,
  rivalSlotCap,
  rivalSubsidy,
  type RivalAgent,
} from './rivalMonth';
import { blockMinutes, distanceKm } from './demand';

const M = (1990 - 1960) * 12; // Januar 1990
const CATALOG: readonly CatalogType[] = aircraftList.filter((a) => ['a320ceo', '737-400', '737-200'].includes(a.id));
const A320 = CATALOG.find((t) => t.id === 'a320ceo') as CatalogType;
const B737_200 = CATALOG.find((t) => t.id === '737-200') as CatalogType;

function airport(id: string, region: WorldRegion): ModelAirport {
  const a = airportsData.find((x) => x.id === id);
  if (!a) throw new Error(id);
  return { id, coords: a.coords, stats: a.stats, size: a.level, region, maxIcaoCode: a.maxIcaoCode };
}
const AIRPORTS = { FRA: airport('FRA', 'EU'), MAD: airport('MAD', 'EU'), CDG: airport('CDG', 'EU'), FCO: airport('FCO', 'EU') };

const NEUTRAL: CompanyInputs = { ...RIVAL_INPUTS, campaigns: [] };
const PLAYER: CompanyInputs = { ...NEUTRAL, badLuckCap: true, charter: true, staffModel: true, forcedSale: true };

const hubHolding = (extra: Partial<HoldingState> = {}): HoldingState => ({
  managementTier: 2,
  slots: {},
  stands: {},
  desks: { normal: 1, self: 0 },
  facilities: [],
  ...extra,
});

/** Eine KI am Drehkreuz FRA ohne Strecken, mit neuen Flugzeugen nach 7.5. */
function rival(id: string, opts: Partial<CompanyState> = {}, personality: RivalPersonality = 'flag', strength: RivalStrength = 'hard', agent: Partial<RivalAgent> = {}): CompanyState {
  const aircraft = opts.aircraft ?? [rivalAircraft(personality, A320, M, `${id}-p1`)];
  const cash = opts.cash ?? 200_000_000;
  return {
    id,
    cash,
    reputation: 50,
    inputs: { ...NEUTRAL, subsidized: true },
    aircraft,
    routes: [],
    airports: { FRA: hubHolding() },
    preorders: [],
    overdrawnMonths: 0,
    profitStreak: 0,
    ledger: newLedger(cash, fleetValue(aircraft, M), 0),
    reports: [],
    hubs: ['FRA'],
    agent: { ...newRivalAgent(personality, strength), ...agent },
    ...opts,
  };
}

function route(id: string, plane: AircraftState, from: string, to: string, departuresPerWeek: number, personality: RivalPersonality = 'flag'): RouteState {
  const minutes = blockMinutes(distanceKm(AIRPORTS[from as keyof typeof AIRPORTS].coords, AIRPORTS[to as keyof typeof AIRPORTS].coords), plane.cruiseSpeed);
  const service: RouteState['service'] = {};
  for (const c of ['economy', 'premium', 'business', 'first'] as const) {
    if ((plane.seats[c] ?? 0) > 0) (service as Record<string, unknown>)[c] = rivalService(personality, c, minutes);
  }
  return { id, aircraftId: plane.id, from, to, departuresPerWeek, ageMonths: 24, service };
}

function player(opts: Partial<CompanyState> = {}): CompanyState {
  const plane = rivalAircraft('flag', A320, M, 'me-p1');
  const cash = 50_000_000;
  return {
    id: 'me',
    cash,
    reputation: 50,
    inputs: PLAYER,
    aircraft: [plane],
    routes: [],
    airports: { CDG: hubHolding() },
    preorders: [],
    overdrawnMonths: 0,
    profitStreak: 0,
    ledger: newLedger(cash, fleetValue([plane], M), 0),
    reports: [],
    hubs: ['CDG'],
    ...opts,
  };
}

function world(companies: CompanyState[], extra: Partial<ModelState> = {}): ModelState {
  return { month: M, seed: 7, airports: AIRPORTS, randomEvents: [], disruptions: [], badLuck: false, resold: [], companies, catalog: CATALOG, ...extra };
}

const after = (state: ModelState, id: string) => state.companies.find((c) => c.id === id) as CompanyState;
const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
const slotsAt = (c: CompanyState, id: string) => sum(Object.values(c.airports[id]?.slots ?? {}).map((v) => v ?? 0));
const departuresAt = (c: CompanyState, id: string) => sum(c.routes.filter((r) => r.from === id || r.to === id).map((r) => r.departuresPerWeek / 2));

describe('Abschnitt 7.14 Zuschuss als Zeile im Monatsergebnis', () => {
  it('7.14: die KI bekommt atCost(subsidy1960) als Zeile „Subsidy“; das Ergebnis steigt um genau diesen Betrag', () => {
    const plane = rivalAircraft('flag', A320, M, 'k-p1');
    const routes = [route('k-r1', plane, 'FRA', 'MAD', 14)];
    const withSubsidy = rival('k', { aircraft: [plane], routes });
    const without = { ...withSubsidy, inputs: { ...withSubsidy.inputs, subsidized: false } };
    const a = closeMonth(world([withSubsidy]), NO_DECISIONS).reports.k;
    const b = closeMonth(world([without]), NO_DECISIONS).reports.k;
    assert.equal(a.costs.subsidy, rivalSubsidy(M));
    assert.equal(b.costs.subsidy, 0);
    assert.ok(Math.abs(a.result - b.result - rivalSubsidy(M)) < 1e-6);
    assert.ok(Math.abs(a.cashEnd - b.cashEnd - rivalSubsidy(M)) < 1e-6);
  });

  it('7.14: ausgeschaltet oder ohne Merkmal kein Dollar Zuschuss; der Spieler bekommt keinen', () => {
    for (let m = 0; m < 12 * 80; m += 7) {
      assert.equal(subsidyIncome(m, true, false), 0);
      assert.equal(subsidyIncome(m, false), 0);
    }
    const report = closeMonth(world([player()]), NO_DECISIONS).reports.me;
    assert.equal(report.costs.subsidy, 0);
  });
});

describe('Fahrpläne der KI (3.13, 7.9, F43)', () => {
  it('jeder Umlauf hat einen Abflug an beiden Enden; Rückflug nach Blockzeit + Bodenzeit; Minuten der Woche', () => {
    for (const n of [1, 3, 7, 10, 14, 21]) {
      const s = rivalSchedule(n, 125);
      assert.equal(s.fromDepartures.length, n);
      assert.equal(s.toDepartures.length, n);
      for (const t of [...s.fromDepartures, ...s.toDepartures]) assert.ok(t >= 0 && t < MINUTES_PER_WEEK);
      const back = new Set(s.toDepartures);
      for (const t of s.fromDepartures) assert.ok(back.has(Math.round(t + 125 + RIVAL_TURN_MINUTES) % MINUTES_PER_WEEK));
    }
  });

  it('nach den Entscheidungen hat jede KI-Strecke einen Fahrplan mit so vielen Abflügen wie Umläufen', () => {
    const plane = rivalAircraft('flag', A320, M, 'k-p1');
    const k = rival('k', { aircraft: [plane], routes: [route('k-r1', plane, 'FRA', 'MAD', 14)], airports: { FRA: hubHolding({ slots: { Narrowbody: 7 } }), MAD: hubHolding({ managementTier: 0, slots: { Narrowbody: 7 } }) } });
    const next = after(closeMonth(world([k]), rivalDecisions).state, 'k');
    for (const r of next.routes) {
      assert.ok(r.schedule);
      assert.equal(r.schedule.fromDepartures.length, r.departuresPerWeek / 2);
    }
  });
});

describe('Abschnitt 7.9, 7.10 Eröffnungen mit Slots und Schaltern', () => {
  const opened = () => {
    const k = rival('k');
    const close = closeMonth(world([k, player()]), rivalDecisions);
    return { before: k, close, k: after(close.state, 'k') };
  };

  it('7.9: ein freies Flugzeug fliegt ab X+1 eine neue Strecke vom Drehkreuz; Slots an beiden Enden gekauft und bezahlt', () => {
    const { before, close, k } = opened();
    const r = k.routes.find((x) => x.aircraftId === 'k-p1') as RouteState;
    assert.ok(r, 'das freie Flugzeug fliegt');
    assert.equal(r.from, 'FRA');
    assert.equal(r.ageMonths, 0, 'die Strecke beginnt im ersten Flugmonat mit Alter 0');
    assert.ok(r.fareRatios && (r.fareRatios.economy ?? 0) > 0, 'Preise ab X+1 aus 7.6');
    for (const end of [r.from, r.to]) assert.ok(slotsAt(k, end) >= departuresAt(k, end), `${end}: belegt ≤ gekauft`);
    const report = close.reports.k;
    assert.ok(report.decisionsCash < 0, 'Slot-Kauf aus der Kasse');
    assert.ok(close.news.some((n) => n.companyId === 'k' && n.kind === 'routeOpened'));
    assert.ok(report.cashEnd >= rivalCashReserve('flag', M + 1), 'Kasse nach der Eröffnung ≥ Reserve');
    assert.ok(before.cash > 0);
  });

  it('7.10: jede KI-Strecke hat an beiden Enden Schalter mit deskLoad ≤ 0,8 (E55)', () => {
    const { k } = opened();
    for (const r of k.routes) {
      for (const end of [r.from, r.to]) {
        const seats = sum(
          k.routes.filter((x) => x.from === end || x.to === end).map((x) => sum(Object.values(k.aircraft.find((p) => p.id === x.aircraftId)?.seats ?? {}).map((v) => v ?? 0)) * (x.departuresPerWeek / 2)),
        );
        const desks = k.airports[end].desks;
        assert.ok(desks.normal + desks.self >= 1);
        assert.ok(seats <= DESK_OVERLOAD_FROM * deskCapacity(desks) + 1e-9);
      }
    }
  });

  it('7.10: Σ Slots aller ≤ Grenze; eine KI überschreitet ihren Anteil nie; zwei KI teilen die freien Slots (E50, F43)', () => {
    // MAD fast voll: der Spieler hält alle Slots bis auf 10.
    const size = AIRPORTS.MAD.size;
    const me = player({ airports: { CDG: hubHolding(), MAD: hubHolding({ managementTier: 0, slots: { Narrowbody: slotLimit(size) - 10 } }) } });
    const a = rival('ka', { aircraft: [rivalAircraft('flag', A320, M, 'ka-p1')] });
    const b = rival('kb', { aircraft: [rivalAircraft('flag', A320, M, 'kb-p1')] });
    const state = closeMonth(world([a, b, me]), rivalDecisions).state;
    for (const id of Object.keys(AIRPORTS)) {
      const all = sum(state.companies.map((c) => slotsAt(c, id)));
      assert.ok(all <= slotLimit(AIRPORTS[id as keyof typeof AIRPORTS].size), `${id}: ${all}`);
      for (const c of state.companies.filter((x) => rivalAgentOf(x))) {
        assert.ok(slotsAt(c, id) <= rivalSlotCap(AIRPORTS[id as keyof typeof AIRPORTS].size, (c.hubs ?? []).includes(id)));
        assert.ok(departuresAt(c, id) <= slotsAt(c, id));
      }
    }
    assert.equal(rivalBuyableSlots(size, false, 0, 10, 2, 0), 5);
    assert.equal(rivalBuyableSlots(size, false, 0, 10, 2, 5), 0);
  });

  it('7.10 (E63): an Flughäfen mit Spieler-Stufe 3 eröffnet keine KI eine neue Strecke', () => {
    const tier3 = hubHolding({ managementTier: 3 });
    const me = player({ airports: { CDG: tier3, MAD: { ...tier3 }, FCO: { ...tier3 } } });
    const k = after(closeMonth(world([rival('k'), me]), rivalDecisions).state, 'k');
    assert.equal(k.routes.length, 0);
  });

  it('7.9: ein Ziel ohne freie Slots wird nie gewählt', () => {
    const full = (id: keyof typeof AIRPORTS) => hubHolding({ managementTier: 0, slots: { Narrowbody: slotLimit(AIRPORTS[id].size) } });
    const me = player({ airports: { CDG: full('CDG'), MAD: full('MAD') } });
    const k = after(closeMonth(world([rival('k'), me]), rivalDecisions).state, 'k');
    for (const r of k.routes) assert.ok(!['CDG', 'MAD'].includes(r.to));
  });

  it('7.8: die Entscheidungen hängen nicht von der Reihenfolge der KI ab (mit Eröffnungen und Slot-Käufen)', () => {
    const a = rival('ka', { aircraft: [rivalAircraft('flag', A320, M, 'ka-p1')] });
    const b = rival('kb', { aircraft: [rivalAircraft('lcc', A320, M, 'kb-p1')] }, 'lcc');
    const one = closeMonth(world([a, b, player()]), rivalDecisions).state;
    const two = closeMonth(world([b, a, player()]), rivalDecisions).state;
    for (const id of ['ka', 'kb']) assert.deepEqual(after(one, id), after(two, id));
  });
});

describe('Abschnitt 7.10 VIP-Lounge und Verkauf freier Slots', () => {
  it('7.10: Flag baut an seinem Drehkreuz eine Lounge, sobald es dort Business- oder First-Sitze anbietet und die Kasse reicht', () => {
    const plane = rivalAircraft('flag', A320, M, 'k-p1');
    assert.ok((plane.seats.business ?? 0) > 0);
    const holdings = { FRA: hubHolding({ slots: { Narrowbody: 7 } }), MAD: hubHolding({ managementTier: 0, slots: { Narrowbody: 7 } }) };
    const k = rival('k', { aircraft: [plane], routes: [route('k-r1', plane, 'FRA', 'MAD', 14)], airports: holdings });
    const close = closeMonth(world([k]), rivalDecisions);
    assert.ok(after(close.state, 'k').airports.FRA.facilities.includes('vipLounge'));
    assert.ok(close.news.some((n) => n.kind === 'loungeBuilt'));
    // Die LCC baut keine.
    const lccPlane = rivalAircraft('lcc', A320, M, 'l-p1');
    const l = rival('l', { aircraft: [lccPlane], routes: [route('l-r1', lccPlane, 'FRA', 'MAD', 14, 'lcc')], airports: holdings }, 'lcc');
    assert.ok(!after(closeMonth(world([l]), rivalDecisions).state, 'l').airports.FRA.facilities.includes('vipLounge'));
  });

  it('7.10: Slots, die 6 Monate frei sind, verkauft die KI zum Verkaufswert (5.10)', () => {
    const plane = rivalAircraft('flag', A320, M, 'k-p1');
    const holdings = { FRA: hubHolding({ slots: { Narrowbody: 20 } }), MAD: hubHolding({ managementTier: 0, slots: { Narrowbody: 7 } }) };
    const free = [13, 13, 13, 13, 13];
    // Wenig Kasse: kein Kauf, der die freien Slots mit einer neuen Strecke belegt.
    let k = rival('k', { aircraft: [plane], routes: [route('k-r1', plane, 'FRA', 'MAD', 14)], airports: holdings, cash: 15_000_000 }, 'flag', 'hard', {
      slotFree: { 'FRA|Narrowbody': free, 'MAD|Narrowbody': [0, 0, 0, 0, 0] },
    });
    const close = closeMonth(world([k]), rivalDecisions);
    k = after(close.state, 'k');
    const sale = close.news.find((n) => n.kind === 'slotsSold' && n.subject === 'FRA|Narrowbody');
    assert.ok(sale, 'Verkauf gemeldet');
    const used = departuresAt(k, 'FRA');
    assert.ok((k.airports.FRA.slots.Narrowbody ?? 0) >= used);
    const sold = 20 - (k.airports.FRA.slots.Narrowbody ?? 0);
    assert.equal(sold, 13, 'die ganze Zeit frei: 13');
    assert.ok(Math.abs((sale.amount ?? 0) - sold * slotResalePrice('Narrowbody', M + 1, [])) < 1e-6);
    // Mit kürzerer Geschichte wird nichts verkauft.
    const fresh = rival('f', { aircraft: [rivalAircraft('flag', A320, M, 'f-p1')], routes: [], airports: holdings }, 'flag', 'hard', { slotFree: {} });
    const f = closeMonth(world([{ ...fresh, routes: [route('f-r1', fresh.aircraft[0], 'FRA', 'MAD', 14)] }]), rivalDecisions);
    assert.ok(!f.news.some((n) => n.kind === 'slotsSold'));
  });
});

describe('Abschnitt 7.11 Flotte: Modernisierung, Kabinen-Erneuerung, Kauf', () => {
  it('7.11: ein Flugzeug älter als 20 Jahre wird ersetzt; das alte kommt in den Gebrauchtmarkt, die Strecke fliegt mit dem neuen', () => {
    const old = rivalAircraft('flag', B737_200, 100, 'k-old');
    const holdings = { FRA: hubHolding({ slots: { Narrowbody: 7 } }), MAD: hubHolding({ managementTier: 0, slots: { Narrowbody: 7 } }) };
    const k = rival('k', { aircraft: [old], routes: [route('k-r1', old, 'FRA', 'MAD', 14)], airports: holdings });
    const close = closeMonth(world([k]), rivalDecisions);
    const next = after(close.state, 'k');
    assert.ok(!next.aircraft.some((p) => p.id === 'k-old'));
    assert.ok(close.state.resold.some((p) => p.id === 'k-old'), 'im Gebrauchtmarkt (R13)');
    const plane = next.aircraft.find((p) => next.routes.some((r) => r.id === 'k-r1' && r.aircraftId === p.id));
    assert.ok(plane && plane.builtMonth === M + 1 && plane.aircraftClass === 'Narrowbody');
    assert.ok(close.news.some((n) => n.kind === 'modernized'));
    const price = newAircraftPrice(plane.listPrice1960, plane.cabinListPrice1960, M + 1);
    const proceeds = saleProceeds(aircraftValue(close.state.resold.find((p) => p.id === 'k-old') as AircraftState, M + 1));
    assert.ok(close.reports.k.decisionsCash <= -price + proceeds + 1e-6);
  });

  it('7.11 (F43): Kabinenzustand unter 60 → dieselbe Kabine neu zum Umbau-Preis, Zustand nach 8.13', () => {
    const worn = { ...rivalAircraft('flag', A320, M - 60, 'k-p1'), cabinCondition: 50 };
    const holdings = { FRA: hubHolding({ slots: { Narrowbody: 7 } }), MAD: hubHolding({ managementTier: 0, slots: { Narrowbody: 7 } }) };
    const k = rival('k', { aircraft: [worn], routes: [route('k-r1', worn, 'FRA', 'MAD', 14)], airports: holdings });
    const close = closeMonth(world([k]), rivalDecisions);
    const plane = after(close.state, 'k').aircraft.find((p) => p.id === 'k-p1') as AircraftState;
    assert.equal(plane.cabinCondition, refitCabinCondition(50, 0));
    assert.equal(plane.cabinInstalledMonth, M + 1);
    assert.deepEqual(plane.seats, worn.seats, 'gleiche Kabine (7.5)');
    const news = close.news.find((n) => n.kind === 'cabinRenewed');
    assert.ok(news);
    assert.ok(Math.abs((news.amount ?? 0) - refitPrice(worn.cabinListPrice1960, sum(Object.values(worn.seats).map((v) => v ?? 0)), M + 1)) < 1e-6);
  });

  it('7.11: die KI kauft (mit Strecke) nie unter die Reserve; das gekaufte Flugzeug fliegt ab X+1', () => {
    let buys = 0;
    for (let seed = 1; seed <= 40 && buys < 2; seed++) {
      const plane = rivalAircraft('flag', A320, M, 'k-p1');
      const holdings = { FRA: hubHolding({ slots: { Narrowbody: 7 } }), MAD: hubHolding({ managementTier: 0, slots: { Narrowbody: 7 } }) };
      const k = rival('k', { aircraft: [plane], routes: [route('k-r1', plane, 'FRA', 'MAD', 14)], airports: holdings, cash: 120_000_000 }, 'expansionist');
      const close = closeMonth(world([k], { seed }), rivalDecisions);
      const bought = close.news.find((n) => n.companyId === 'k' && n.kind === 'planeBought');
      if (!bought) continue;
      buys++;
      const next = after(close.state, 'k');
      const newPlane = next.aircraft.find((p) => p.id === bought.subject) as AircraftState;
      assert.ok(next.routes.some((r) => r.aircraftId === newPlane.id), 'fliegt eine Strecke');
      assert.ok(Math.abs((bought.amount ?? 0) - newAircraftPrice(newPlane.listPrice1960, newPlane.cabinListPrice1960, M + 1)) < 1e-6);
      assert.ok(close.reports.k.cashEnd >= rivalCashReserve('expansionist', M + 1), 'Kasse nach Kauf und Slots ≥ Reserve');
    }
    assert.ok(buys > 0, 'mindestens ein Kauf in 40 Läufen');
  });

  it('7.11: ohne Typen-Katalog kauft und modernisiert die KI nicht', () => {
    const old = rivalAircraft('flag', B737_200, 100, 'k-old');
    const holdings = { FRA: hubHolding({ slots: { Narrowbody: 7 } }), MAD: hubHolding({ managementTier: 0, slots: { Narrowbody: 7 } }) };
    const k = rival('k', { aircraft: [old], routes: [route('k-r1', old, 'FRA', 'MAD', 14)], airports: holdings });
    const close = closeMonth(world([k], { catalog: undefined }), rivalDecisions);
    assert.ok(!close.news.some((n) => n.kind === 'modernized' || n.kind === 'planeBought'));
  });
});

describe('Abschnitt 7.13 Neues Drehkreuz', () => {
  it('7.13: nur an Flughäfen ab Größe 5, nie am Drehkreuz einer anderen Gesellschaft mit Stufe 3, mit Stufe 2 und bezahlt', () => {
    let opened = 0;
    for (let seed = 1; seed <= 150 && opened < 2; seed++) {
      const planes = [0, 1, 2].map((i) => rivalAircraft('expansionist', A320, M, `k-p${i}`));
      const routes = planes.map((p, i) => route(`k-r${i}`, p, 'FRA', ['MAD', 'CDG', 'FCO'][i], 42, 'expansionist'));
      const holdings: Record<string, HoldingState> = { FRA: hubHolding({ slots: { Narrowbody: 63 } }) };
      for (const id of ['MAD', 'CDG', 'FCO']) holdings[id] = hubHolding({ managementTier: 0, slots: { Narrowbody: 21 } });
      const k = rival('k', { aircraft: planes, routes, airports: holdings }, 'expansionist', 'hard', { hubNoProfit: { FRA: 5 } });
      const close = closeMonth(world([k], { seed }), rivalDecisions);
      const hubNews = close.news.find((n) => n.companyId === 'k' && n.kind === 'newHub');
      if (!hubNews) continue;
      opened++;
      const next = after(close.state, 'k');
      const id = hubNews.subject as keyof typeof AIRPORTS;
      assert.ok(AIRPORTS[id].size >= 5);
      assert.ok(next.hubs?.includes(id));
      assert.equal(next.airports[id].managementTier, 2);
    }
    assert.ok(opened > 0, 'mindestens ein neues Drehkreuz in 150 Läufen');
  });
});

describe('Abschnitt 7.7 Gründung und Nachrücken', () => {
  it('7.7: die neue KI hat Startkasse nach Stärke, Startflotte mit Kabine, Stufe 2 und einen bedienten Schalter am Drehkreuz, Ruf 50, Zuschuss', () => {
    const state = world([player()]);
    for (const strength of ['easy', 'normal', 'hard'] as const) {
      const k = foundRivalCompany(state, strength, []);
      assert.ok(k);
      const start = atCost(RIVAL_STRENGTH[strength].startCash1960, M);
      assert.ok(Math.abs(k.cash - start) <= atCost(3_000_000, M) + 1e-6);
      assert.equal(k.aircraft.length, RIVAL_STRENGTH[strength].startFleet);
      for (const p of k.aircraft) assert.ok((p.seats.economy ?? 0) > 0 && p.builtMonth === M);
      const hub = (k.hubs ?? [])[0];
      assert.notEqual(hub, 'CDG', 'nie am Spieler-Drehkreuz');
      assert.equal(k.airports[hub].managementTier, 2);
      assert.deepEqual(k.airports[hub].desks, { normal: 1, self: 0 });
      assert.equal(sum(Object.values(k.airports[hub].slots).map((v) => v ?? 0)), 0);
      assert.equal(k.reputation, 50);
      assert.equal(k.inputs.subsidized, true);
      assert.ok(rivalAgentOf(k));
    }
  });

  it('7.7: echte Gesellschaften nur im aktiven Jahr an ihrem Drehkreuz; nie am Drehkreuz einer anderen Gesellschaft', () => {
    const real = [
      { code: 'LH', hub: 'FRA', founded: 1955, personality: 'flag' as const },
      { code: 'XX', hub: 'MAD', founded: 2000, personality: 'lcc' as const },
    ];
    let reals = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const k = foundRivalCompany(world([player()], { seed }), 'normal', real);
      assert.ok(k);
      assert.notEqual(k.id, 'rival-XX');
      if (k.id === 'rival-LH') {
        reals++;
        assert.deepEqual(k.hubs, ['FRA']);
      }
    }
    assert.ok(reals > 0);
    const taken = player({ hubs: ['FRA'], airports: { FRA: hubHolding() } });
    for (let seed = 1; seed <= 10; seed++) {
      const k = foundRivalCompany(world([taken], { seed }), 'normal', real);
      assert.ok(!k || !(k.hubs ?? []).includes('FRA'));
    }
  });

  it('7.7: fehlen KI zur gewählten Zahl, rückt am Ende des Abschlusses mit RIVAL_REFILL_CHANCE eine nach (im Monat X+1)', () => {
    let refills = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const close = closeMonth(world([player()], { seed }), rivalDecisions, rivalRefill({ wanted: 1, strength: 'normal', realAirlines: [] }));
      const added = close.state.companies.filter((c) => rivalAgentOf(c));
      if (added.length === 0) continue;
      refills++;
      assert.equal(added.length, 1);
      assert.equal(added[0].aircraft[0].builtMonth, M + 1);
      assert.ok(close.news.some((n) => n.kind === 'newRival'));
    }
    assert.ok(refills > 0 && refills < 30, `${refills} von 60`);
    // Volle Zahl: nie.
    const full = closeMonth(world([player(), rival('k')]), NO_DECISIONS, rivalRefill({ wanted: 1, strength: 'normal', realAirlines: [] }));
    assert.equal(full.state.companies.length, 2);
  });
});

describe('Dauerlauf (7.8, 7.10, 8.16)', () => {
  it('24 Monate mit zwei KI und Nachrücken: Prüfung ohne Fehler, Slots ≤ Grenze und ≥ belegt, jede Strecke mit Fahrplan', () => {
    let state = world([
      rival('ka', { aircraft: [rivalAircraft('flag', A320, M, 'ka-p1'), rivalAircraft('flag', A320, M, 'ka-p2')] }),
      rival('kb', { aircraft: [rivalAircraft('lcc', A320, M, 'kb-p1')], hubs: ['MAD'], airports: { MAD: hubHolding() } }, 'lcc', 'normal'),
      player(),
    ]);
    const refill = rivalRefill({ wanted: 3, strength: 'normal', realAirlines: [] });
    for (let i = 0; i < 24; i++) {
      const close = closeMonth(state, rivalDecisions, refill);
      assert.deepEqual(close.log, [], `Monat ${i}`);
      state = close.state;
      for (const id of Object.keys(AIRPORTS)) {
        assert.ok(sum(state.companies.map((c) => slotsAt(c, id))) <= slotLimit(AIRPORTS[id as keyof typeof AIRPORTS].size));
        for (const c of state.companies.filter((x) => rivalAgentOf(x))) assert.ok(departuresAt(c, id) <= slotsAt(c, id), `${c.id} ${id}`);
      }
      for (const c of state.companies.filter((x) => rivalAgentOf(x))) {
        assert.ok(Number.isFinite(c.cash));
        for (const r of c.routes) assert.ok(r.schedule && r.schedule.fromDepartures.length === r.departuresPerWeek / 2);
      }
    }
    assert.ok(state.companies.some((c) => rivalAgentOf(c) && c.routes.length > 0));
  });
});
