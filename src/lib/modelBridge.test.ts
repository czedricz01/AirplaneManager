/**
 * Regeltests zur Brücke Spielstand → `ModelState` (Paket 4.2b Teil 1, E72): Welt, Kabine, Flugzeuge, Bestand an
 * Flughäfen, Strecken; „Hin und zurück ändert nichts“ und „Zurückschreiben nach `closeMonth`“.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aircraftList } from '../data/aircraft';
import { airports as registryAirports } from '../data/airportRegistry';
import type { OwnedAircraft } from '../components/MyFleetView';
import type { ConfigOutput } from '../components/ConfigurePurchaseView';
import { createOwnedAircraft, defaultCabin } from './fleet';
import type { AirportInfrastructure, ScheduledTrip, SimulatedRoute } from './gameTypes';
import { regionOf } from './geoUtils';
import {
  CABIN_EXTRA_POINTS,
  FEATURE_POINTS,
  FARE_RATIO_MAX,
  RAMP_MONTHS,
  CABIN_CLASSES,
  type CabinExtra,
} from '../model/constants';
import { cabinListPrice, interiorScore } from '../model/cabin';
import { marketFare } from '../model/fare';
import { closeMonth, fleetValue, monthOperations, newLedger, NO_DECISIONS, type CompanyState, type ModelState } from '../model/monthClose';
import { RIVAL_INPUTS } from '../model/rivals';
import {
  applyHoldingState,
  applyModelOperations,
  departuresPerWeek,
  EXTRA_FLAGS,
  FEATURE_FLAGS,
  aircraftState,
  holdingState,
  modelAirports,
  modelCabin,
  modelCatalog,
  modelOperations,
  planeQuickTurn,
  routeKm,
  routeSchedule,
  routeState,
  serviceSelection,
  type PlayerOperations,
  type RouteContext,
} from './modelBridge';

const close = (actual: number, expected: number, tol = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected)), `${actual} ≠ ${expected}`);

const M = (1995 - 1960) * 12; // Januar 1995
const A320 = aircraftList.find((a) => a.id === 'a320ceo')!;
const AIRPORTS = modelAirports();

/** Ein neues A320 mit der Standard-Kabine, gekauft im Monat `month`. */
function plane(reg: string, month = M - 24): OwnedAircraft {
  const { config, baseInteriorPop } = defaultCabin(A320);
  const [p] = createOwnedAircraft(A320, 1, { config, baseInteriorPop, hub: 'FRA', existingRegistrations: [], purchasedAt: month });
  return { ...p, registration: reg };
}

/** Umlauf: Hinflug am Tag `day` um `hour` Uhr, 150 min Flug, 45 min Boden. */
function trip(id: string, day: number, hour: number, oneWay = false): ScheduledTrip {
  return { id, flightNumOut: `X${id}`, flightNumIn: `X${id}b`, dayId: day, startHour: hour, startMin: 0, durMin: 150, turnoverMin: 45, isOneWay: oneWay };
}

const ECO_SERVICE = { catering: [['b15']], extras: [], service: [] };

function route(id: string, reg: string, prices: Record<string, number>, extra: Partial<SimulatedRoute> = {}): SimulatedRoute {
  return {
    id,
    airline: 'Player',
    origin: 'FRA',
    destination: 'MAD',
    distance: 1420,
    aircraft: reg,
    weeklyFlights: 7,
    paxPerWeek: 0,
    schedule: [1, 2, 3, 4, 5, 6, 7].map((d) => trip(`${id}-${d}`, d, 8)),
    classConfigs: { economy: ECO_SERVICE } as SimulatedRoute['classConfigs'],
    ticketPrices: prices,
    activeTicketPrices: prices,
    openedOffset: M - 12,
    ...extra,
  };
}

const infra = (extra: Partial<AirportInfrastructure> = {}): AirportInfrastructure => ({
  level: 1,
  slots: { regional: 0, narrowbody: 14, widebody: 0 },
  stands: { narrowbody: 1, widebody: 0 },
  desks: { normal: 2, self: 0 },
  ...extra,
});

const CTX: RouteContext = { month: M, startMonth: M - 36, airports: AIRPORTS };
const km = routeKm({ origin: 'FRA', destination: 'MAD' }, AIRPORTS);
const ecoAt = (ratio: number, month = M) => ratio * marketFare('economy', km, month);

function ops(): PlayerOperations {
  return {
    fleet: [plane('D-AAAA'), plane('D-AAAB')],
    routes: [route('r1', 'D-AAAA', { economy: ecoAt(1.1) }), route('r2', 'D-AAAB', { economy: ecoAt(0.9) }, { origin: 'MAD', destination: 'FRA' })],
    airportManagement: { FRA: infra({ level: 2, hubFacilities: { hangar: true } }), MAD: infra() },
  };
}

describe('Welt (4.2b)', () => {
  it('alle Flughäfen der einen Liste, Größe = level, Region über regionOf (R15)', () => {
    assert.equal(Object.keys(AIRPORTS).length, registryAirports.length);
    for (const a of registryAirports) {
      const m = AIRPORTS[a.id];
      assert.equal(m.size, a.level);
      assert.equal(m.region, regionOf(a.coords));
      assert.deepEqual(m.coords, a.coords);
    }
  });

  it('Katalog = Flugzeugdaten', () => {
    const cat = modelCatalog();
    assert.equal(cat.length, aircraftList.length);
    const a = cat.find((t) => t.id === 'a320ceo')!;
    assert.equal(a.basePrice, A320.basePrice);
    assert.equal(a.class, A320.class);
  });
});

describe('Kabine (2.3, 5.13)', () => {
  it('jede Ausstattung und jedes Extra des Modells hat genau einen Schalter im Kaufdialog', () => {
    for (const c of CABIN_CLASSES) {
      assert.deepEqual(Object.keys(FEATURE_FLAGS[c]).sort(), Object.keys(FEATURE_POINTS[c]).sort(), c);
      const flags = Object.values(FEATURE_FLAGS[c]);
      assert.equal(new Set(flags).size, flags.length, c);
    }
    assert.deepEqual(Object.keys(EXTRA_FLAGS).sort(), Object.keys(CABIN_EXTRA_POINTS).sort());
  });

  it('Standard-Kabine: nur Economy, Interior score wie im Modell, Listenpreis 0', () => {
    const cab = modelCabin(defaultCabin(A320).config, { installedMonth: M, capacity: A320.capacity });
    assert.deepEqual(cab.seats, { economy: A320.capacity });
    close(cab.interiorScore.economy!, interiorScore('economy', { seatType: 'Standard', pitch: 74, features: [] }, { installedMonth: M, capacity: A320.capacity, extras: [] }));
    assert.equal(cab.cabinListPrice1960, 0);
    assert.equal(cab.hasWifi, false);
  });

  it('Schalter des Kaufdialogs = Schlüssel des Modells, nur lieferbare Teile zählen', () => {
    const base = defaultCabin(A320).config;
    const config: ConfigOutput = {
      ...base,
      economy: 120,
      business: 12,
      details: {
        ...base.details,
        economy: { seats: 120, pitch: 76, seatType: 'Comfort', hasIFE: true, hasPower: true },
        business: { seats: 12, pitch: 130, seatType: 'Recliner', hasIFE: true, hasPower: false, hasMassage: true, hasPrivacyDivider: true },
        hasWifi: true,
        hasPremiumCatering: true,
      },
    };
    const fit = { installedMonth: 400, capacity: A320.capacity };
    const extras: CabinExtra[] = ['wifi', 'catering'];
    const cab = modelCabin(config, fit);
    const eco = { seatType: 'Comfort', pitch: 76, features: ['ife', 'power'] };
    const biz = { seatType: 'Recliner', pitch: 130, features: ['ife', 'massage', 'divider'] };
    close(cab.interiorScore.economy!, interiorScore('economy', eco, { ...fit, extras }));
    close(cab.interiorScore.business!, interiorScore('business', biz, { ...fit, extras }));
    close(cab.cabinListPrice1960, cabinListPrice({ economy: { seats: 120, interior: eco }, business: { seats: 12, interior: biz } }, { ...fit, extras }));
    // 1993 (Monat 400): Power (ab 420), Massage (ab 420), Trennwand (ab 540), WLAN (ab 480) noch nicht lieferbar.
    const without = interiorScore('business', { seatType: 'Recliner', pitch: 130, features: ['ife'] }, { ...fit, extras: ['catering'] });
    close(cab.interiorScore.business!, without);
    assert.equal(cab.hasWifi, false); // WLAN erst ab Monat 480 lieferbar
    assert.equal(cab.hasPremiumGalley, true);
  });
});

describe('Flugzeuge', () => {
  it('Kennung = Kennzeichen, Typ-Werte aus dem Katalog, Baumonat = purchasedAt, Zustand', () => {
    const p = { ...plane('D-ABCD', M - 60), popularity: 12, efficiency: 1, conditionGeneral: 81, conditionInterior: 64 };
    const s = aircraftState(p);
    assert.equal(s.id, 'D-ABCD');
    assert.equal(s.typeId, 'a320ceo');
    assert.equal(s.catalogAppeal, A320.popularity);
    assert.equal(s.efficiency, A320.efficiency);
    assert.equal(s.aircraftClass, 'Narrowbody');
    assert.equal(s.builtMonth, M - 60);
    assert.equal(s.cabinInstalledMonth, M - 60);
    assert.equal(s.airframeCondition, 81);
    assert.equal(s.cabinCondition, 64);
    assert.equal(s.listPrice1960, A320.basePrice);
    assert.equal(s.launchCustomer, undefined);
  });

  it('Einbaumonat der Kabine aus cabinInstalledAt (Umbau); Erstkunde aus launchBonusUntil', () => {
    const s = aircraftState({ ...plane('D-ABCE', M - 60), cabinInstalledAt: M - 3, launchBonusUntil: M + 10 });
    assert.equal(s.cabinInstalledMonth, M - 3);
    assert.equal(s.launchCustomer, true);
  });
});

describe('Bestand an Flughäfen (5.10, 5.11)', () => {
  it('Zahlen je Klasse, Schalter, Stufe, Einrichtungen', () => {
    const h = holdingState(infra({ level: 2, hubFacilities: { hangar: true, vipLounge: false, catering: true } }));
    assert.equal(h.managementTier, 2);
    assert.deepEqual(h.slots, { Regional: 0, Narrowbody: 14, Widebody: 0 });
    assert.deepEqual(h.stands, { Regional: 0, Narrowbody: 1, Widebody: 0 });
    assert.deepEqual(h.desks, { normal: 2, self: 0 });
    assert.deepEqual(h.facilities, ['hangar', 'catering']);
  });

  it('Zurückschreiben behält Einstellungen der Oberfläche; gleicher Bestand = gleiches Objekt', () => {
    const before = infra({ autoBuyStands: true, hubAutoUpgrade: true });
    assert.equal(applyHoldingState(before, holdingState(before)), before);
    const after = applyHoldingState(before, { ...holdingState(before), desks: { normal: 3, self: 1 }, facilities: ['vipLounge'] });
    assert.equal(after.autoBuyStands, true);
    assert.equal(after.hubAutoUpgrade, true);
    assert.deepEqual(after.desks, { normal: 3, self: 1 });
    assert.deepEqual(after.hubFacilities, { hangar: false, vipLounge: true, catering: false });
  });
});

describe('Strecken', () => {
  it('Abflüge je Woche = Flugabschnitte: Umlauf 2, Einweg 1, ohne Fahrplan weeklyFlights × 2', () => {
    assert.equal(departuresPerWeek({ schedule: [trip('a', 1, 8), trip('b', 2, 8), trip('c', 3, 8, true)], weeklyFlights: 3 }), 5);
    assert.equal(departuresPerWeek({ weeklyFlights: 7 }), 14);
    assert.equal(departuresPerWeek({ schedule: [], weeklyFlights: 2 }), 4);
  });

  it('Fahrplan in Minuten der Woche; Rückflug nach Flug + Boden, über das Wochenende hinaus ab Montag', () => {
    const s = routeSchedule([trip('a', 1, 8), trip('b', 7, 23), trip('c', 3, 6, true)])!;
    assert.deepEqual(s.fromDepartures, [480, 2 * 1440 + 360, 6 * 1440 + 1380]);
    // Montag 08:00 + 195 min = 11:15; Sonntag 23:00 + 195 min = Montag 02:15.
    assert.deepEqual(s.toDepartures, [135, 675]);
    assert.equal(routeSchedule([]), undefined);
  });

  it('Service je Klasse; altes flaches Mahlzeiten-Format = nur Mahlzeit 1 (W15, 2.5)', () => {
    assert.deepEqual(serviceSelection({ catering: [['b15'], ['s1']], extras: ['x'], service: ['y'] }), { meals: [['b15'], ['s1']], extras: ['x'], onboardService: ['y'] });
    assert.deepEqual(serviceSelection({ catering: ['b15', 'b1'] }).meals, [['b15', 'b1']]);
    assert.deepEqual(serviceSelection(undefined), { meals: [], extras: [], onboardService: [] });
  });

  it('Preis in $ → Preisniveau (E56); neuer Preis nur als nextFareRatios, wenn anders (4.5)', () => {
    const same = routeState(route('r', 'D-AAAA', { economy: ecoAt(1.2) }), CTX);
    close(same.fareRatios!.economy!, 1.2);
    assert.equal(same.nextFareRatios, undefined);
    const changed = routeState(route('r', 'D-AAAA', { economy: ecoAt(0.8) }, { activeTicketPrices: { economy: ecoAt(1.2) } }), CTX);
    close(changed.fareRatios!.economy!, 1.2);
    close(changed.nextFareRatios!.economy!, 0.8);
    const high = routeState(route('r', 'D-AAAA', { economy: ecoAt(99) }), CTX);
    assert.equal(high.fareRatios!.economy, FARE_RATIO_MAX);
  });

  it('Alter aus openedOffset; ohne openedOffset seit Spielstart, mindestens RAMP_MONTHS', () => {
    assert.equal(routeState(route('r', 'D-AAAA', { economy: 100 }), CTX).ageMonths, 12);
    assert.equal(routeState(route('r', 'D-AAAA', { economy: 100 }, { openedOffset: undefined }), CTX).ageMonths, 36);
    assert.equal(routeState(route('r', 'D-AAAA', { economy: 100 }, { openedOffset: undefined }), { ...CTX, startMonth: M - 2 }).ageMonths, RAMP_MONTHS);
  });

  it('Strecke ohne Flugzeug in der Flotte ist ein Fehler', () => {
    assert.throws(() => modelOperations({ ...ops(), routes: [route('r', 'X-XXXX', { economy: 100 })] }, CTX), /fehlt in der Flotte/);
  });
});

describe('Hin und zurück (4.2b)', () => {
  it('Lesen und gleich wieder Zurückschreiben ändert nichts', () => {
    const o = ops();
    const out = applyModelOperations(o, modelOperations(o, CTX), CTX);
    assert.deepEqual(out.fleet, o.fleet);
    o.fleet.forEach((p, i) => assert.equal(out.fleet[i], p));
    o.routes.forEach((r, i) => assert.equal(out.routes[i], r));
    for (const id of Object.keys(o.airportManagement)) assert.equal(out.airportManagement[id], o.airportManagement[id]);
    assert.deepEqual(out.newAircraft, []);
  });

  it('verkauftes Flugzeug fällt mit seinen Strecken weg; unbekanntes Flugzeug wird gemeldet', () => {
    const o = ops();
    const m = modelOperations(o, CTX);
    const extra = aircraftState(plane('D-NEWW'));
    const out = applyModelOperations(o, { ...m, aircraft: [...m.aircraft.filter((p) => p.id !== 'D-AAAB'), extra] }, CTX);
    assert.deepEqual(out.fleet.map((p) => p.registration), ['D-AAAA']);
    assert.deepEqual(out.routes.map((r) => r.id), ['r1']);
    assert.deepEqual(out.newAircraft.map((p) => p.id), ['D-NEWW']);
  });
});

describe('Zurückschreiben nach closeMonth (4.2b)', () => {
  /** Ein Spielstand nur mit dem Spieler (neutrale Eingaben); Betrieb über die Brücke. */
  function stateOf(o: PlayerOperations): ModelState {
    const m = modelOperations(o, CTX);
    const cash = 50e6;
    const player: CompanyState = {
      id: 'player',
      cash,
      reputation: 50,
      inputs: { ...RIVAL_INPUTS, campaigns: [] },
      aircraft: m.aircraft,
      routes: m.routes,
      airports: m.airports,
      preorders: [],
      overdrawnMonths: 0,
      profitStreak: 0,
      ledger: newLedger(cash, fleetValue(m.aircraft, M), 0),
      reports: [],
    };
    return { month: M, seed: 7, airports: AIRPORTS, randomEvents: [], disruptions: [], badLuck: false, resold: [], companies: [player] };
  }

  it('der Abschluss rechnet die Strecken der Oberfläche (Fluggäste, Erlös)', () => {
    const ops0 = monthOperations(stateOf(ops())).player;
    assert.equal(ops0.routes.length, 2);
    for (const r of ops0.routes) {
      assert.equal(r.plannedLegs, 14);
      assert.ok(r.passengers.economy > 0, `${r.routeId}: keine Fluggäste`);
      assert.ok(r.revenue > 0);
    }
  });

  it('Zustand abgenutzt, Preisniveau bleibt, $ folgen dem Marktpreis von X+1, neuer Preis gilt ab X+1', () => {
    const o = ops();
    const withNext: PlayerOperations = {
      ...o,
      routes: [route('r1', 'D-AAAA', { economy: ecoAt(1.3) }, { activeTicketPrices: { economy: ecoAt(1.1) } }), o.routes[1]],
    };
    const { state } = closeMonth(stateOf(withNext), NO_DECISIONS);
    assert.equal(state.month, M + 1);
    const ctx1 = { ...CTX, month: state.month };
    const out = applyModelOperations(withNext, state.companies[0], ctx1);
    for (const p of out.fleet) {
      assert.ok(p.conditionGeneral < 100 && p.conditionInterior < 100, `${p.registration} nicht abgenutzt`);
    }
    const [r1, r2] = out.routes;
    close(r1.activeTicketPrices!.economy, ecoAt(1.3, M + 1));
    close(r1.ticketPrices!.economy, ecoAt(1.3, M + 1));
    close(r2.activeTicketPrices!.economy, ecoAt(0.9, M + 1));
    // Gelesen im Monat X+1 ergibt sich wieder das Preisniveau des Modells.
    close(routeState(r2, ctx1).fareRatios!.economy!, 0.9);
    assert.deepEqual(r1.schedule, withNext.routes[0].schedule);
    assert.equal(routeState(r1, ctx1).ageMonths, state.companies[0].routes[0].ageMonths);
  });
});

describe('planeQuickTurn (E98)', () => {
  it('Flotte: dieselbe Regel wie modelCabin (nur Economy und „Minimal services“)', () => {
    const lcc = { economy: 189, details: { hasMinimalServices: true } } as unknown as ConfigOutput;
    const mixed = { economy: 150, business: 12, details: { hasMinimalServices: true } } as unknown as ConfigOutput;
    const plain = { economy: 180, details: {} } as unknown as ConfigOutput;
    assert.equal(planeQuickTurn({ config: lcc, capacity: 180, purchasedAt: 400 }), true);
    assert.equal(planeQuickTurn({ config: mixed, capacity: 180, purchasedAt: 400 }), false);
    assert.equal(planeQuickTurn({ config: plain, capacity: 180, purchasedAt: 400 }), false);
    assert.equal(planeQuickTurn(undefined), false);
    for (const config of [lcc, mixed, plain]) {
      assert.equal(modelCabin(config, { installedMonth: 400, capacity: 180 }).quickTurn, planeQuickTurn({ config, capacity: 180, purchasedAt: 400 }));
    }
  });
});

