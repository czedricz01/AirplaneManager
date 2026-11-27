/**
 * Regeltests Paket 4.3 (F60): Flughafen und Infrastruktur nach dem Modell – Slot-Grenze aller Gesellschaften (E50),
 * Preise mit Kostenindex (W1, W3), Schalter-Pflicht (E18, E55), Mieten und Unterhalt wie im Abschluss (R2).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { AiAirline } from '../components/CompetitorsView';
import type { OwnedAircraft } from '../components/MyFleetView';
import { aircraftList } from '../data/aircraft';
import {
  DESK_OVERLOAD_MAX,
  DESK_TYPE_PENALTY,
  HUB_FEE_FACTOR_TIER3,
  LANDING_REFERENCE_SEATS,
  SLOT_RESALE_SHARE,
  SLOTS_PER_AIRPORT_LEVEL,
} from '../model/constants';
import { facilityPrice, managementTierPrice, slotPrice } from '../model/airportCosts';
import { landingFee } from '../model/costs';
import { managementTierFeatures } from '../model/glossary';
import { NO_DECISIONS, closeMonth, monthOperations } from '../model/monthClose';
import { hubQuality } from '../model/transfers';
import { applyInfrastructureChange } from './financeUtils';
import { createOwnedAircraft, defaultCabin } from './fleet';
import { createGameSystems } from './gameState';
import type { AirportInfrastructure, SimulatedRoute } from './gameTypes';
import { rivalRecord } from './modelBridgeWorld';
import { defaultModelEnv, modelGame, PLAYER_ID, type AppGame } from './modelMonth';
import { airportCosts, departingSeatsAt, deskSellLimit, deskState, facilityBuyPrice, NO_INFRASTRUCTURE, playerHubQuality, rivalSlotsByAirport, slotBuyPrice, slotCapacity, slotSalePrice, slotTradeCost, tierPrice, type AirportPricing } from './modelAirport';

const M = (1995 - 1960) * 12 + 5; // Juni 1995
const ENV = defaultModelEnv();
const A320 = aircraftList.find((a) => a.id === 'a320ceo')!;

function plane(reg: string): OwnedAircraft {
  const { config, baseInteriorPop } = defaultCabin(A320);
  const [p] = createOwnedAircraft(A320, 1, { config, baseInteriorPop, hub: 'FRA', existingRegistrations: [], purchasedAt: M - 24 });
  return { ...p, registration: reg };
}

const infra = (level: 0 | 1 | 2 | 3, over: Partial<AirportInfrastructure> = {}): AirportInfrastructure => ({
  level,
  slots: { regional: 0, narrowbody: 20, widebody: 0 },
  stands: { regional: 0, narrowbody: 4, widebody: 0 },
  desks: { normal: 2, self: 0 },
  ...over,
});

const ROUTE: SimulatedRoute = {
  id: 'r1', airline: 'Player', origin: 'FRA', destination: 'MAD', distance: 1420, aircraft: 'D-AAAA', weeklyFlights: 7, paxPerWeek: 0,
  classConfigs: { economy: { catering: [['b15']], extras: [], service: [] } },
  ticketPrices: { economy: 150 },
};

const PRICING: AirportPricing = { month: M, completedResearch: [], milestoneSlotFactor: 1, rivalSlots: {} };

function oldRival(): AiAirline {
  return {
    id: 'ai_lh', name: 'Lufthansa', code: 'LH', hub: 'FRA', capital: 300e6, aiDifficulty: 'Normal',
    fleet: [{
      id: A320.id, manufacturer: A320.manufacturer, family: A320.family, type: A320.type, class: 'narrowbody', reg: 'LH-A100',
      capacity: A320.capacity, purchasedAt: M - 30, conditionGeneral: 81, conditionInterior: 64, config: { economy: 150, premium: 0, business: 0, first: 0 },
    }],
    routes: [{ origin: 'FRA', destination: 'MAD', aircraftClass: 'narrowbody', departures: 7, monthlyProfit: 1e5, aircraftReg: 'LH-A100', aircraft: A320.id, openedAt: M - 20 }],
    monthlyProfitsHistory: [1e5, 2e5],
    personality: 'flag',
    isReal: true,
    color: '#123456',
  };
}

function game(over: Partial<AppGame> = {}): AppGame {
  const sys = createGameSystems();
  return {
    month: M,
    startMonth: M - 60,
    airlineCode: 'XA',
    brandingColor: '#ffcc00',
    selectedHub: 'FRA',
    difficulty: 'Normal',
    aiDifficulty: 'Normal',
    aiAirlinesCount: 3,
    capital: 150e6,
    monthlyCapex: [],
    fleet: [plane('D-AAAA')],
    routes: [ROUTE],
    airportManagement: {
      FRA: infra(2, { hubFacilities: { hangar: true, vipLounge: true, catering: false } }),
      MAD: infra(1, { desks: { normal: 1, self: 1 } }),
      LHR: infra(3, { desks: { normal: 0, self: 2 } }),
    },
    reputation: 55,
    profitStreak: 0,
    staff: { salaryPct: 100, morale: 70, strike: null },
    marketing: sys.marketing,
    eventChoices: {},
    career: sys.career,
    milestones: [],
    annualGoal: null,
    scenario: null,
    reportHistory: [],
    aiAirlines: [oldRival()],
    randomEvents: [],
    disruptions: [],
    ...over,
  };
}

const sizeOf = (id: string) => ENV.airports[id].size;

describe('4.3 Slots: eine Grenze für alle Gesellschaften (5.10, E50)', () => {
  it('Grenze = SLOTS_PER_AIRPORT_LEVEL × Größe; frei = Grenze − eigene − die der KI, nie unter 0', () => {
    const cap = slotCapacity('FRA', 5, infra(1), { rivalSlots: { FRA: 100 } });
    assert.equal(cap.total, SLOTS_PER_AIRPORT_LEVEL * 5);
    assert.equal(cap.own, 20);
    assert.equal(cap.rivals, 100);
    assert.equal(cap.free, SLOTS_PER_AIRPORT_LEVEL * 5 - 120);
    assert.equal(slotCapacity('FRA', 1, infra(1), { rivalSlots: { FRA: 10_000 } }).free, 0);
    assert.equal(slotCapacity('XXX', 2, undefined, { rivalSlots: {} }).free, SLOTS_PER_AIRPORT_LEVEL * 2);
  });

  it('Slots der KI = ihre gekauften Slots im Modell (nicht ihre Abflüge); aufgelöste KI zählt nicht', () => {
    const rival = rivalRecord(oldRival(), { month: M, airports: ENV.airports });
    const bought = (id: string) => Object.values(rival.company.airports[id]?.slots ?? {}).reduce((s, n) => s + (n ?? 0), 0);
    const slots = rivalSlotsByAirport([rival]);
    assert.ok(slots.FRA > 0);
    assert.equal(slots.FRA, bought('FRA'));
    assert.equal(slots.MAD, bought('MAD'));
    const agent = rival.company.agent as { distress: { status: string } };
    const gone = { ...rival, company: { ...rival.company, agent: { ...agent, distress: { ...agent.distress, status: 'liquidated' } } } };
    assert.deepEqual(rivalSlotsByAirport([gone]), {});
  });

  it('Kaufpreis = slotPrice des Modells mit Kostenindex, Forschung und Meilensteinen; Verkauf = SLOT_RESALE_SHARE davon', () => {
    assert.equal(slotBuyPrice('narrowbody', PRICING), slotPrice('Narrowbody', M));
    assert.ok(slotBuyPrice('narrowbody', { ...PRICING, month: (2020 - 1960) * 12 }) > slotBuyPrice('narrowbody', { ...PRICING, month: 0 }));
    assert.equal(slotBuyPrice('widebody', { ...PRICING, milestoneSlotFactor: 0.8 }), slotPrice('Widebody', M) * 0.8);
    assert.equal(slotSalePrice('regional', PRICING), SLOT_RESALE_SHARE * slotBuyPrice('regional', PRICING));
    assert.equal(slotTradeCost('narrowbody', 3, PRICING), 3 * slotBuyPrice('narrowbody', PRICING));
    assert.equal(slotTradeCost('narrowbody', -2, PRICING), -2 * slotSalePrice('narrowbody', PRICING));
    assert.equal(slotTradeCost('narrowbody', 0, PRICING), 0);
  });

  it('applyInfrastructureChange zahlt beim Verkauf den Verkaufspreis des Modells aus', () => {
    const r = applyInfrastructureChange({
      infra: infra(1), type: 'slots', subType: 'narrowbody', requestedAmount: -4, hubAutoUpgrade: false, autoBuyStands: false,
      availableSlots: 0, utilizedSlots: 0, costPerUnit: slotBuyPrice('narrowbody', PRICING), refundPerUnit: slotSalePrice('narrowbody', PRICING),
    });
    assert.equal(r.cost, slotTradeCost('narrowbody', -4, PRICING));
  });
});

describe('4.3 Einmalpreise mit Kostenindex (5.11, W3)', () => {
  it('Verwaltungsstufe und Einrichtungen = Preise des Modells, 2020 teurer als 1960', () => {
    for (const tier of [1, 2, 3]) assert.equal(tierPrice(tier, 4, M), managementTierPrice(tier, 4, M));
    assert.ok(tierPrice(2, 4, (2020 - 1960) * 12) > tierPrice(2, 4, 0));
    for (const kind of ['hangar', 'vipLounge', 'catering'] as const) assert.equal(facilityBuyPrice(kind, M), facilityPrice(kind, M));
    assert.ok(facilityBuyPrice('vipLounge', (2020 - 1960) * 12) > facilityBuyPrice('vipLounge', 0));
  });
});

describe('4.3 Schalter: Pflicht und Last (E18, E55, 2.6.3)', () => {
  it('an einem verwalteten Flughafen bleibt mindestens ein Schalter, gleich welcher Art', () => {
    assert.equal(deskSellLimit(infra(1, { desks: { normal: 1, self: 0 } }), 'normal'), 0);
    assert.equal(deskSellLimit(infra(1, { desks: { normal: 1, self: 1 } }), 'normal'), 1);
    assert.equal(deskSellLimit(infra(1, { desks: { normal: 1, self: 1 } }), 'self'), 1);
    assert.equal(deskSellLimit(infra(2, { desks: { normal: 3, self: 0 } }), 'normal'), 2);
    assert.equal(deskSellLimit(infra(1, { desks: { normal: 0, self: 0 } }), 'self'), 0);
    // Ohne Verwaltungsstufe gibt es keine Pflicht.
    assert.equal(deskSellLimit(infra(0, { desks: { normal: 1, self: 0 } }), 'normal'), 1);
  });

  it('ohne Schalter volle Überlast, nur Selbstbedienung kostet die Premium-Klassen DESK_TYPE_PENALTY, Economy-Regel im Glossar', () => {
    const none = deskState({ normal: 0, self: 0 }, 1000);
    assert.equal(none.missing, true);
    assert.equal(none.overloadPoints, -DESK_OVERLOAD_MAX);
    const selfOnly = deskState({ normal: 0, self: 1 }, 1000);
    assert.equal(selfOnly.premiumPenalty, DESK_TYPE_PENALTY);
    assert.equal(selfOnly.missing, false);
    assert.equal(deskState({ normal: 1, self: 0 }, 1000).premiumPenalty, 0);
    // Ohne Abflüge kein Abzug.
    assert.equal(deskState({ normal: 0, self: 0 }, 0).overloadPoints, 0);
    assert.equal(deskState({ normal: 0, self: 1 }, 0).premiumPenalty, 0);
  });

  it('Sitze der Abflüge wie der Abschluss: Sitze × Flugabschnitte / 2; die geplante Strecke zählt im Planer mit', () => {
    const fleet = [plane('D-AAAA')];
    const one = departingSeatsAt('FRA', [ROUTE], fleet);
    assert.ok(one > 0);
    assert.equal(departingSeatsAt('MAD', [ROUTE], fleet), one);
    assert.equal(departingSeatsAt('LHR', [ROUTE], fleet), 0);
    const draft = { ...ROUTE, id: '__draft' };
    assert.equal(departingSeatsAt('FRA', [ROUTE, draft], fleet), 2 * one);
    assert.equal(departingSeatsAt('FRA', [ROUTE, draft], fleet, aircraftList, 'r1'), one);
  });
});

describe('4.3 Laufende Kosten = Abschluss (R2, 5.10, 5.11)', () => {
  it('Wochen-Unterhalt je Flughafen der Ansicht = airportUpkeep im Monatsabschluss des Modells', () => {
    const g = game();
    const ops = monthOperations(modelGame(g).state)[PLAYER_ID];
    const ids = Object.keys(g.airportManagement).sort();
    ids.forEach((id, i) => {
      const view = airportCosts(id, sizeOf(id), g.airportManagement[id], g.routes, g.fleet, PRICING);
      assert.ok(Math.abs(view.upkeep.total - ops.airportUpkeep[i]) < 1e-6, `${id}: ${view.upkeep.total} vs ${ops.airportUpkeep[i]}`);
    });
  });

  it('Aufschlüsselung je Art ergibt die Posten des Modells; Stufe 2 → Stände ohne Miete; Stufe 3 → Gebühren × 0,85', () => {
    const g = game();
    for (const id of Object.keys(g.airportManagement)) {
      const c = airportCosts(id, sizeOf(id), g.airportManagement[id], g.routes, g.fleet, PRICING);
      const sum = (o: Readonly<Record<string, number>>) => Object.values(o).reduce((s, n) => s + n, 0);
      assert.ok(Math.abs(sum(c.breakdown.slots) - c.upkeep.slots) < 1e-6, id);
      assert.ok(Math.abs(sum(c.breakdown.stands) - c.upkeep.stands) < 1e-6, id);
      assert.ok(Math.abs(sum(c.breakdown.desks) - c.upkeep.desks) < 1e-6, id);
      assert.ok(Math.abs(sum(c.breakdown.facilities) - c.upkeep.facilities) < 1e-6, id);
    }
    const fra = airportCosts('FRA', sizeOf('FRA'), g.airportManagement.FRA, g.routes, g.fleet, PRICING);
    assert.equal(fra.standRent.narrowbody, 0);
    assert.ok(fra.upkeep.facilities > 0);
    const lhr = airportCosts('LHR', sizeOf('LHR'), g.airportManagement.LHR, g.routes, g.fleet, PRICING);
    assert.equal(lhr.feeFactor, HUB_FEE_FACTOR_TIER3);
    // Schalter-Miete: leer = Grundanteil, voll = ganze Miete, heute dazwischen.
    assert.ok(fra.deskRent.normal.idle <= fra.deskRent.normal.now && fra.deskRent.normal.now <= fra.deskRent.normal.full);
  });

  it('Landegebühr je Sitz und Abfertigung kommen aus den Funktionen des Modells, 2020 höher als 1960 (W1)', () => {
    const at = (month: number) => airportCosts('FRA', sizeOf('FRA'), infra(1), [], [], { month, completedResearch: [] });
    const c = at(M);
    const ref = { aircraftClass: 'Narrowbody' as const, capacity: LANDING_REFERENCE_SEATS.Narrowbody, cruiseSpeed: 800 };
    assert.ok(Math.abs(c.landingPerSeat - landingFee(ref, sizeOf('FRA'), M, c.feeFactor) / ref.capacity) < 1e-9);
    assert.ok(at((2020 - 1960) * 12).handlingPerPassenger > at(0).handlingPerPassenger);
    assert.ok(at((2020 - 1960) * 12).deskRent.normal.full > at(0).deskRent.normal.full);
    assert.ok(at((2020 - 1960) * 12).standRent.narrowbody > at(0).standRent.narrowbody);
  });

  it('ein leerer Bestand kostet nichts', () => {
    const c = airportCosts('FRA', sizeOf('FRA'), NO_INFRASTRUCTURE, [], [], PRICING);
    assert.equal(c.upkeep.total, 0);
  });
});

describe('4.3 Drehkreuz-Güte und Texte', () => {
  it('Drehkreuz-Güte = hubQuality des Modells mit Lounge, Catering und Forschung', () => {
    const i = infra(3, { hubFacilities: { vipLounge: true, catering: true } });
    assert.equal(playerHubQuality(i, []), hubQuality({ level: 3, lounge: true, catering: true }));
    assert.equal(playerHubQuality(infra(1), []), hubQuality({ level: 1, lounge: false, catering: false }));
  });

  it('jede Verwaltungsstufe hat ihre Wirkungen als Text, ohne feste Zahlen in der Ansicht', () => {
    for (const tier of [1, 2, 3]) assert.ok(managementTierFeatures(tier).length > 0, String(tier));
    assert.deepEqual(managementTierFeatures(4), []);
  });
});

describe('Fehler „Forecast fehlt nach weiteren Strecken“: keine Stands an kleinen Flughäfen (5.10)', () => {
  it('Slot-Kauf am Hub eines Flughafens ohne Stands bringt keinen Stand mit; mit Stands wie bisher', () => {
    const base = infra(2, { stands: { regional: 0, narrowbody: 0, widebody: 0 } });
    const args = { infra: base, type: 'slots' as const, subType: 'narrowbody', requestedAmount: 5, hubAutoUpgrade: true, autoBuyStands: true,
      availableSlots: 100, utilizedSlots: 0, costPerUnit: 1 };
    assert.equal(applyInfrastructureChange({ ...args, standsAvailable: false }).infra.stands.narrowbody, 0);
    assert.equal(applyInfrastructureChange({ ...args, standsAvailable: true }).infra.stands.narrowbody, 5);
    const direct = applyInfrastructureChange({ ...args, type: 'stands', standsAvailable: false });
    assert.equal(direct.actualAmount, 0);
  });

  it('ein Spielstand mit Stands an einem Flughafen der Größe 2 (AAL) bleibt rechenbar; die Stands zählen nicht', () => {
    const route: SimulatedRoute = {
      id: 'r1', airline: 'Player', origin: 'AAL', destination: 'CPH', distance: 230, aircraft: 'D-AAAA', weeklyFlights: 7, paxPerWeek: 0,
      classConfigs: { economy: { catering: [['b15']], extras: [], service: [] } }, ticketPrices: { economy: 80 }, openedOffset: M,
    };
    const sys = createGameSystems();
    const g: AppGame = {
      month: M, startMonth: M, airlineCode: 'XA', selectedHub: 'AAL', difficulty: 'Normal', aiDifficulty: 'Normal', aiAirlinesCount: 0,
      capital: 150e6, monthlyCapex: [], fleet: [plane('D-AAAA')], routes: [route],
      airportManagement: { AAL: infra(2, { stands: { regional: 0, narrowbody: 20, widebody: 0 } }), CPH: infra(1, { stands: { regional: 0, narrowbody: 0, widebody: 0 } }) },
      reputation: 55, profitStreak: 0, staff: { salaryPct: 100, morale: 70, strike: null }, marketing: sys.marketing, eventChoices: {},
      career: sys.career, milestones: [], annualGoal: null, scenario: null, reportHistory: [], aiAirlines: [], randomEvents: [], disruptions: [],
    };
    const { state } = modelGame(g, ENV);
    const holding = state.companies.find((c) => c.id === PLAYER_ID)!.airports.AAL;
    assert.equal(holding.stands.Narrowbody ?? 0, 0);
    assert.doesNotThrow(() => closeMonth(state, NO_DECISIONS));
  });
});
