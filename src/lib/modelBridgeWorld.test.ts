/**
 * Regeltests Brücke Teil 3 (Paket 4.2d, F56): Welt-Zustand (Startwert, Zufallsereignisse, Störungen, Pech,
 * Weiterverkauf) und KI-Gesellschaften (Umwandlung der alten `AiAirline`, Ansicht, Namen neuer KI); „Hin und zurück
 * ändert nichts“ und ein ganzer Monat mit KI über die Brücke.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { AiAirline } from '../components/CompetitorsView';
import { RAMP_MONTHS, WEEKS_PER_MONTH } from '../model/constants';
import { closeMonth, type CompanyState, type ModelState } from '../model/monthClose';
import type { Disruption } from '../model/monthEvents';
import { rivalAircraft } from '../model/rivals';
import { newRivalAgent, rivalAgentOf, rivalDecisions, rivalRefill } from '../model/rivalMonth';
import { aircraftList } from '../data/aircraft';
import type { HistoricalEvent } from './eventSystem';
import type { Disruption as AppDisruption } from './gameState';
import { catalogType, modelAirports } from './modelBridge';
import {
  appWorldEvent,
  applyDisruptionAnswers,
  applyModelRivals,
  applyModelWorld,
  modelDisruptions,
  modelRivals,
  modelWorld,
  modelWorldEvent,
  playerDisruptions,
  renameDisruptions,
  rivalCompanyId,
  rivalRecord,
  rivalView,
  rivalViews,
  worldSeed,
  type RivalRecord,
  type WorldSource,
} from './modelBridgeWorld';

const M = (1995 - 1960) * 12 + 5; // Juni 1995
const AIRPORTS = modelAirports();
const A320 = aircraftList.find((a) => a.id === 'a320ceo')!;
const B737 = aircraftList.find((a) => a.id === 'b737-300') ?? aircraftList.find((a) => a.family === A320.family && a.id !== A320.id)!;

const ROUTES = [
  { id: 'r1', origin: 'FRA', destination: 'MAD', aircraft: 'D-AAAA' },
  { id: 'r2', origin: 'LHR', destination: 'JFK', aircraft: 'D-BBBB' },
];

const SURGE: HistoricalEvent = {
  startOffset: M - 1, duration: 3, title: 'Summer Vacation Surge', description: 'alt', demandMultiplier: 1.12, fuelMultiplier: 1.06,
};
const ASH: HistoricalEvent = {
  startOffset: M - 2, duration: 2, title: 'Volcanic Ash Disruption', description: 'alt', demandMultiplier: 0.9, fuelMultiplier: 1.03, regions: ['EU'],
};

function oldDisruptions(): AppDisruption[] {
  return [
    { id: `dis_${M}_technical_r1`, kind: 'technical', offset: M, routeIds: ['r1'], cancelShare: 0.5, ref: 'D-AAAA', mitigated: true },
    { id: `dis_${M}_airport-strike_LHR`, kind: 'airport-strike', offset: M, routeIds: ['r2'], cancelShare: 0.6, ref: 'LHR' },
    { id: `dis_${M - 1}_weather_EU`, kind: 'weather', offset: M - 1, routeIds: ['r1'], cancelShare: 0.15, ref: 'EU' },
  ];
}

function worldSource(over: Partial<WorldSource> = {}): WorldSource {
  return {
    world: null,
    randomEvents: [SURGE, ASH],
    disruptions: oldDisruptions(),
    staff: { strike: null },
    airlineCode: 'XA',
    startMonth: M - 60,
    ...over,
  };
}

describe('Welt-Zustand (4.2d)', () => {
  it('Startwert alter Spielstände: fest je Kürzel und Startmonat', () => {
    assert.equal(worldSeed('XA', 0), worldSeed('XA', 0));
    assert.notEqual(worldSeed('XA', 0), worldSeed('XA', 1));
    assert.notEqual(worldSeed('XA', 0), worldSeed('XB', 0));
    assert.ok(Number.isInteger(worldSeed('XA', 0)) && worldSeed('XA', 0) >= 0);
  });

  it('Zufallsereignis: Treibstoff-Faktor entfällt (E8), Regionen bleiben; zurück mit Text der Vorlage', () => {
    const e = modelWorldEvent(ASH);
    assert.deepEqual(e, { title: ASH.title, startMonth: M - 2, months: 2, demandMultiplier: 0.9, regions: ['EU'] });
    assert.equal(modelWorldEvent(SURGE).regions, undefined);
    const back = appWorldEvent(e);
    assert.equal(back.fuelMultiplier, 1);
    assert.ok(back.description.length > 0);
    assert.deepEqual(modelWorldEvent(back), e);
  });

  it('Störungen alter Spielstände: Arten, nur der laufende Monat, Defekt je Flugzeug', () => {
    const list = modelDisruptions(oldDisruptions(), M);
    assert.deepEqual(list, [
      { month: M, kind: 'defect', target: 'D-AAAA', share: 0.5, charter: true },
      { month: M, kind: 'airportStrike', target: 'LHR', share: 0.6 },
    ]);
    // Zwei alte Defekte desselben Flugzeugs: eine Störung, gechartert nur, wenn beide gechartert waren.
    const two: AppDisruption[] = [
      { id: 'a', kind: 'technical', offset: M, routeIds: ['r1'], cancelShare: 0.5, ref: 'D-AAAA', mitigated: true },
      { id: 'b', kind: 'technical', offset: M, routeIds: ['r3'], cancelShare: 0.5, ref: 'D-AAAA' },
    ];
    assert.deepEqual(modelDisruptions(two, M), [{ month: M, kind: 'defect', target: 'D-AAAA', share: 0.5 }]);
  });

  it('Alter Spielstand: Pech = Störung oder Personalstreik im Monat (8.8), kein Weiterverkauf; gespeichert bleibt gespeichert', () => {
    const w = modelWorld(worldSource(), M);
    assert.equal(w.badLuck, true);
    assert.deepEqual(w.resold, []);
    assert.equal(w.seed, worldSeed('XA', M - 60));
    assert.equal(modelWorld(worldSource({ disruptions: [] }), M).badLuck, false);
    assert.equal(modelWorld(worldSource({ disruptions: [], staff: { strike: { startOffset: M, ended: false } as never } }), M).badLuck, true);
    assert.equal(modelWorld(worldSource({ world: w }), M), w);
  });

  it('Ansicht der Störungen: nur Strecken des Spielers, Zuordnung wie 8.9', () => {
    const d: Disruption[] = [
      { month: M, kind: 'defect', target: 'D-AAAA', share: 0.5 },
      { month: M, kind: 'defect', target: 'rival-LH-A100', share: 0.5 },
      { month: M, kind: 'airportStrike', target: 'JFK', share: 0.6 },
      { month: M, kind: 'weather', target: 'EU', share: 0.15, charter: true },
      { month: M, kind: 'airportStrike', target: 'NRT', share: 0.6 },
    ];
    const view = playerDisruptions(d, ROUTES, AIRPORTS);
    assert.deepEqual(view.map((v) => [v.id, v.routeIds]), [
      [`dis_${M}_technical_D-AAAA`, ['r1']],
      [`dis_${M}_airport-strike_JFK`, ['r2']],
      [`dis_${M}_weather_EU`, ['r1', 'r2']],
    ]);
    assert.equal(view[2].mitigated, true);
    // Gleiche Störung aus der alten Liste bleibt dasselbe Objekt (alte Kennung für offene Fragen).
    const before: AppDisruption[] = [{ id: 'old-id', kind: 'technical', offset: M, routeIds: ['r1'], cancelShare: 0.5, ref: 'D-AAAA' }];
    assert.equal(playerDisruptions(d.slice(0, 1), ROUTES, AIRPORTS, before), before);
  });

  it('Antwort des Spielers (Charter) kommt ins Modell; ohne Änderung dieselbe Liste', () => {
    const d: Disruption[] = [
      { month: M, kind: 'defect', target: 'D-AAAA', share: 0.5 },
      { month: M, kind: 'weather', target: 'EU', share: 0.15 },
    ];
    const view = playerDisruptions(d, ROUTES, AIRPORTS);
    assert.equal(applyDisruptionAnswers(d, view), d);
    const answered = view.map((v) => (v.kind === 'technical' ? { ...v, mitigated: true } : v));
    const out = applyDisruptionAnswers(d, answered);
    assert.equal(out[0].charter, true);
    assert.equal(out[1], d[1]);
    const undone = applyDisruptionAnswers(out, view);
    assert.equal('charter' in undone[0], false);
  });

  it('Neue Kennungen gelieferter Flugzeuge in den Defekten (offen aus 4.2c)', () => {
    const d: Disruption[] = [
      { month: M + 1, kind: 'defect', target: 'ord1-1', share: 0.5 },
      { month: M + 1, kind: 'airportStrike', target: 'ord1-1', share: 0.6 },
    ];
    const out = renameDisruptions(d, { 'ord1-1': 'D-ANEW' });
    assert.equal(out[0].target, 'D-ANEW');
    assert.equal(out[1], d[1]);
    assert.equal(renameDisruptions(d, {}), d);
  });

  it('Hin und zurück ändert nichts (gespeichert und alt)', () => {
    const src = worldSource();
    const w = modelWorld(src, M);
    const stored = { ...src, world: w };
    const again = applyModelWorld(w, stored, { routes: ROUTES, airports: AIRPORTS });
    assert.equal(again.world, w);
    assert.equal(again.randomEvents, src.randomEvents);
    // Alter Spielstand: alte Ereignisse (mit Treibstoff-Faktor) und die Störungen des Monats bleiben dieselben Objekte.
    const old = applyModelWorld(w, src, { routes: ROUTES, airports: AIRPORTS });
    assert.equal(old.randomEvents, src.randomEvents);
    assert.equal(old.disruptions[0], src.disruptions[0]);
    assert.equal(old.disruptions[1], src.disruptions[1]);
    assert.equal(old.disruptions.length, 2);
  });

  it('Zurückschreiben: neue Ereignisse mit Text, Defekte mit neuen Kennungen', () => {
    const w = modelWorld(worldSource(), M);
    const rolled = { month: M + 1, title: 'Global Commerce Summit', startMonth: M + 1, months: 2, demandMultiplier: 1.07 };
    const next = {
      seed: w.seed,
      randomEvents: [...w.randomEvents, { title: rolled.title, startMonth: rolled.startMonth, months: rolled.months, demandMultiplier: rolled.demandMultiplier }],
      disruptions: [{ month: M + 1, kind: 'defect' as const, target: 'ord1-1', share: 0.5 }],
      badLuck: true,
      resold: [],
    };
    const routes = [...ROUTES, { id: 'r3', origin: 'FRA', destination: 'CDG', aircraft: 'D-ANEW' }];
    const out = applyModelWorld(next, { ...worldSource(), world: w }, { routes, airports: AIRPORTS, renamed: { 'ord1-1': 'D-ANEW' } });
    assert.equal(out.world.disruptions[0].target, 'D-ANEW');
    assert.deepEqual(out.disruptions.map((d) => d.routeIds), [['r3']]);
    assert.equal(out.randomEvents.length, 3);
    assert.equal(out.randomEvents[0], SURGE);
    assert.ok(out.randomEvents[2].description.length > 0);
  });
});

// ===========================================================================
// KI
// ===========================================================================

function oldRival(over: Partial<AiAirline> = {}): AiAirline {
  const entry = (spec: typeof A320, reg: string, purchasedAt: number) => ({
    id: spec.id, manufacturer: spec.manufacturer, family: spec.family, type: spec.type,
    class: spec.class.toLowerCase() as 'narrowbody', reg, capacity: spec.capacity, purchasedAt,
    conditionGeneral: 81, conditionInterior: 64, config: { economy: 150, premium: 0, business: 0, first: 0 },
  });
  return {
    id: 'ai_lh', name: 'Lufthansa', code: 'LH', hub: 'FRA', capital: 42e6, aiDifficulty: 'Hard',
    fleet: [entry(A320, 'LH-A100', M - 30), { ...entry(B737, 'LH-A101', M - 10), idleSince: M - 3 }, entry({ ...A320, id: 'nope' }, 'LH-A102', M - 5)],
    routes: [
      { origin: 'FRA', destination: 'MAD', aircraftClass: 'narrowbody', departures: 7, monthlyProfit: 1e5, aircraftReg: 'LH-A100', aircraft: A320.id, openedAt: M - 4, avgProfit: 80_000, fullDepartures: 10 },
      { origin: 'FRA', destination: 'CDG', aircraftClass: 'narrowbody', departures: 3, monthlyProfit: 0, aircraft: 'nope' },
    ],
    monthlyProfitsHistory: [1e5, -2e5, 3e5],
    distressMonths: 2,
    forSale: true,
    forSaleSince: M - 4,
    personality: 'flag',
    isReal: true,
    color: '#123456',
    ...over,
  };
}

const RCTX = { month: M, airports: AIRPORTS };

describe('KI umwandeln und anzeigen (4.2d)', () => {
  it('Alte KI → CompanyState mit agent', () => {
    const rec = rivalRecord(oldRival(), RCTX);
    const c = rec.company;
    assert.equal(c.id, rivalCompanyId('LH'));
    assert.equal(c.id, 'rival-LH');
    assert.deepEqual([rec.name, rec.code, rec.isReal, rec.color], ['Lufthansa', 'LH', true, '#123456']);
    assert.equal(c.cash, 42e6);
    assert.deepEqual(c.hubs, ['FRA']);
    // Unbekannter Typ fällt weg; Kabine nach rivalCabin, eingebaut im Kaufmonat; Zustand aus dem Spielstand.
    assert.deepEqual(c.aircraft.map((p) => p.id), ['rival-LH-A100', 'rival-LH-A101']);
    const expected = rivalAircraft('flag', catalogType(A320), M - 30, 'rival-LH-A100');
    assert.deepEqual(c.aircraft[0].seats, expected.seats);
    assert.equal(c.aircraft[0].cabinInstalledMonth, M - 30);
    assert.deepEqual([c.aircraft[0].airframeCondition, c.aircraft[0].cabinCondition], [81, 64]);
    // Strecke: 2 × Umläufe, Alter, Fahrplan; die Strecke ohne Kennzeichen und mit unbekanntem Typ fällt weg.
    assert.equal(c.routes.length, 1);
    const r = c.routes[0];
    assert.deepEqual([r.from, r.to, r.departuresPerWeek, r.ageMonths, r.aircraftId], ['FRA', 'MAD', 14, 4, 'rival-LH-A100']);
    assert.equal(r.schedule?.fromDepartures.length, 7);
    assert.equal(r.fareRatios, undefined);
    assert.ok(r.service.economy);
    // Bestand: Slots = Abflüge je Ende, Drehkreuz Stufe 2.
    assert.equal(c.airports.FRA.managementTier, 2);
    assert.equal(c.airports.MAD.managementTier, 0);
    assert.equal(c.airports.FRA.slots.Narrowbody, 7);
    assert.equal(c.airports.MAD.slots.Narrowbody, 7);
    assert.ok(c.airports.MAD.desks.normal + c.airports.MAD.desks.self >= 1);
    // Entscheidungs-Zustand
    const agent = rivalAgentOf(c)!;
    assert.deepEqual([agent.personality, agent.strength], ['flag', 'hard']);
    assert.deepEqual(agent.distress, { status: 'forSale', distressMonths: 2, forSaleMonths: 4 });
    assert.deepEqual(agent.routes[r.id], { avgProfit: 80_000, fullFrequency: 10 });
    assert.deepEqual(agent.idleMonths, { 'rival-LH-A101': 3 });
    // Berichte der Vormonate
    assert.deepEqual(c.reports.map((x) => [x.month, x.result]), [[M - 3, 1e5], [M - 2, -2e5], [M - 1, 3e5]]);
    assert.equal(c.ledger.cashAtStart, 42e6);
  });

  it('Ältere Spielstände: Strecke ohne Kennzeichen nimmt das erste freie Flugzeug des Typs; Strecke ohne openedAt gilt als eingeführt', () => {
    const ai = oldRival();
    const rec = rivalRecord({ ...ai, routes: [{ ...ai.routes[0], aircraftReg: undefined, openedAt: undefined }] }, RCTX);
    assert.equal(rec.company.routes[0].aircraftId, 'rival-LH-A100');
    assert.equal(rec.company.routes[0].ageMonths, RAMP_MONTHS);
  });

  it('Alt → Modell → Ansicht: angezeigte Werte bleiben', () => {
    const ai = oldRival();
    const view = rivalView(rivalRecord(ai, RCTX), RCTX);
    assert.deepEqual(
      [view.id, view.name, view.code, view.hub, view.capital, view.aiDifficulty, view.personality, view.isReal, view.color],
      ['rival-LH', 'Lufthansa', 'LH', 'FRA', 42e6, 'Hard', 'flag', true, '#123456'],
    );
    assert.deepEqual(view.fleet.map((p) => p.reg), ['LH-A100', 'LH-A101']);
    assert.deepEqual([view.fleet[0].conditionGeneral, view.fleet[0].conditionInterior, view.fleet[0].purchasedAt], [81, 64, M - 30]);
    assert.equal(view.fleet[1].idleSince, M - 3);
    const r = view.routes[0];
    assert.deepEqual(
      [r.origin, r.destination, r.departures, r.aircraftReg, r.openedAt, r.avgProfit, r.fullDepartures],
      ['FRA', 'MAD', 7, 'LH-A100', M - 4, 80_000, 10],
    );
    assert.deepEqual(view.monthlyProfitsHistory, ai.monthlyProfitsHistory);
    assert.deepEqual([view.forSale, view.forSaleSince, view.distressMonths], [true, M - 4, 2]);
  });

  it('Gespeicherte KI bleibt; aufgelöste fehlen in der Ansicht', () => {
    const rec = rivalRecord(oldRival(), RCTX);
    const stored = [rec];
    assert.equal(modelRivals({ rivals: stored, aiAirlines: [] }, RCTX), stored);
    const agent = rivalAgentOf(rec.company)!;
    const gone: RivalRecord = { ...rec, company: { ...rec.company, agent: { ...agent, distress: { ...agent.distress, status: 'liquidated' } } } };
    assert.deepEqual(rivalViews([rec, gone], RCTX).length, 1);
  });

  it('Zurückschreiben: bekannte behalten Name und Farbe, neue bekommen beides, übernommene fallen weg', () => {
    const lh = rivalRecord(oldRival(), RCTX);
    const af = rivalRecord(oldRival({ id: 'ai_af', name: 'Air France', code: 'AF', hub: 'CDG', color: '#654321' }), RCTX);
    const before = [lh, af];
    const player = { id: 'player' } as CompanyState;
    assert.equal(applyModelRivals(before, [player, lh.company, af.company], { seed: 1, month: M }), before);

    const fresh = (id: string, hub: string): CompanyState => ({ ...lh.company, id, hubs: [hub], agent: newRivalAgent('lcc', 'normal') });
    const ctx = { seed: 7, month: M, playerCode: 'R7', playerColor: '#FFCC00' };
    const out = applyModelRivals(before, [player, lh.company, fresh('rival-BA', 'LHR'), fresh(`rival-f${M}-NRT`, 'NRT')], ctx);
    assert.deepEqual(out.map((r) => r.company.id), ['rival-LH', 'rival-BA', `rival-f${M}-NRT`]);
    assert.equal(out[0], lh);
    // Kürzel BA zweimal in den Daten: im Gründungsjahr 1995 aktiv ist British Airways (nicht BOAC).
    assert.deepEqual([out[1].name, out[1].code, out[1].isReal], ['British Airways', 'BA', true]);
    assert.equal(applyModelRivals(before, [lh.company, fresh('rival-BA', 'LHR')], { ...ctx, month: 12 * 10 })[1].name, 'BOAC');
    assert.equal(out[2].isReal, false);
    assert.notEqual(out[2].code, 'R7');
    assert.ok(!['LH', 'BA'].includes(out[2].code));
    const colors = out.map((r) => r.color);
    assert.equal(new Set(colors).size, 3);
    // Gleicher Spielstand, gleicher Name (8.3).
    assert.deepEqual(applyModelRivals(before, [player, lh.company, fresh('rival-BA', 'LHR'), fresh(`rival-f${M}-NRT`, 'NRT')], ctx)[2].name, out[2].name);
  });
});

describe('Ein Monat mit KI über die Brücke (4.2d)', () => {
  it('closeMonth mit rivalDecisions und rivalRefill; KI und Welt zurück', () => {
    const rivals = modelRivals({ aiAirlines: [oldRival({ forSale: false, forSaleSince: undefined, distressMonths: 0, capital: 300e6 })] }, RCTX);
    const src = worldSource({ disruptions: [] });
    const world = modelWorld(src, M);
    const player: CompanyState = {
      ...rivals[0].company,
      id: 'player',
      cash: 100e6,
      aircraft: [],
      routes: [],
      airports: {},
      reports: [],
      hubs: ['LHR'],
      agent: undefined,
    };
    const state: ModelState = {
      month: M,
      ...world,
      airports: AIRPORTS,
      companies: [player, ...rivals.map((r) => r.company)],
      catalog: aircraftList.map(catalogType),
    };
    const { state: next, reports } = closeMonth(state, rivalDecisions, rivalRefill({ wanted: 3, strength: 'normal' }));
    const outRivals = applyModelRivals(rivals, next.companies, { seed: next.seed, month: next.month });
    assert.equal(outRivals[0].name, 'Lufthansa');
    for (const r of outRivals) assert.ok(r.name.length > 0 && r.code.length > 0 && r.color);
    const view = rivalView(outRivals[0], { month: next.month, airports: AIRPORTS });
    assert.equal(view.monthlyProfitsHistory.length, 4);
    assert.equal(view.monthlyProfitsHistory[3], reports['rival-LH'].result);
    const company = outRivals[0].company;
    assert.equal(view.routes.length, company.routes.length);
    assert.equal(view.fleet.length, company.aircraft.length);
    // Gewinn der umgewandelten Strecke im Bericht = Ansicht (× 4,348 Wochen).
    const f = reports['rival-LH'].routes.find((x) => x.routeId === 'rival-LH-old1')!;
    const shown = view.routes.find((r) => r.aircraftReg === 'LH-A100' && r.destination === 'MAD');
    if (shown && company.routes.some((r) => r.id === 'rival-LH-old1')) assert.equal(shown.monthlyProfit, f.result * WEEKS_PER_MONTH);

    const w = applyModelWorld(next, { ...src, world }, { routes: [], airports: AIRPORTS });
    assert.equal(w.world.seed, world.seed);
    assert.equal(w.world.disruptions, next.disruptions);
    assert.deepEqual(w.disruptions, []);
  });
});
