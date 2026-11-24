/**
 * Regeltests Paket 4.2g (F59): Geschäfte und Kennzahlen während des Monats nach dem Modell – Treibstoff des Spielers
 * mit Absicherung, Ereignis-Faktor der Kopfzeile, Preis der Grundüberholung, Übernahme (Preis, Rang, Bestand, Kasse).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { AiAirline } from '../components/CompetitorsView';
import type { OwnedAircraft } from '../components/MyFleetView';
import { aircraftList } from '../data/aircraft';
import { EXTERNAL_OVERHAUL_SURCHARGE, LITRES_PER_GALLON, RANK_UNLOCKS } from '../model/constants';
import { fuelPrice, fuelTable } from '../model/costs';
import { overhaulQuote } from '../model/fleetMarket';
import { activeWorldEvents, type WorldEvent } from '../model/monthEvents';
import { companyValueOf, takeoverPrice, worldEventDemandFactor } from '../model/rivalMonth';
import { createOwnedAircraft, defaultCabin } from './fleet';
import type { AirportInfrastructure } from './gameTypes';
import { aircraftState, holdingState, modelAirports } from './modelBridge';
import { CAPEX_LABELS, monthLedger, openLedgerValues, withTradeValue } from './modelBridgeCompany';
import { rivalRecord } from './modelBridgeWorld';
import { planesValue } from './modelMonth';
import { takeoverFleet } from './modelFleet';
import {
  hasHangarOnRoutes,
  playerFuelPerGallon,
  playerOverhaulQuote,
  takeoverAirports,
  takeoverOffer,
  takeoverPayments,
  takeoverRival,
  worldEventFactor,
} from './modelTrades';

const M = (1995 - 1960) * 12 + 5; // Juni 1995
const AIRPORTS = modelAirports();
const CTX = { month: M, airports: AIRPORTS };
const A320 = aircraftList.find((a) => a.id === 'a320ceo')!;

function plane(reg: string, over: Partial<OwnedAircraft> = {}): OwnedAircraft {
  const { config, baseInteriorPop } = defaultCabin(A320);
  const [p] = createOwnedAircraft(A320, 1, { config, baseInteriorPop, hub: 'FRA', existingRegistrations: [], purchasedAt: M - 120 });
  return { ...p, registration: reg, conditionGeneral: 55, ...over };
}

const infra = (level: 1 | 2 | 3, narrowbody: number, hangar = false): AirportInfrastructure => ({
  level,
  slots: { regional: 0, narrowbody, widebody: 0 },
  stands: { regional: 0, narrowbody: 2, widebody: 0 },
  desks: { normal: 2, self: 0 },
  ...(hangar ? { hubFacilities: { hangar: true, vipLounge: false, catering: false } } : {}),
});

const ROUTES = [
  { origin: 'FRA', destination: 'MAD', aircraft: 'D-AAAA' },
  { origin: 'LHR', destination: 'JFK', aircraft: 'D-BBBB' },
];

function oldRival(over: Partial<AiAirline> = {}): AiAirline {
  return {
    id: 'ai_lh', name: 'Lufthansa', code: 'LH', hub: 'FRA', capital: 30e6, aiDifficulty: 'Normal',
    fleet: [{
      id: A320.id, manufacturer: A320.manufacturer, family: A320.family, type: A320.type, class: 'narrowbody', reg: 'LH-A100',
      capacity: A320.capacity, purchasedAt: M - 30, conditionGeneral: 81, conditionInterior: 64, config: { economy: 150, premium: 0, business: 0, first: 0 },
    }],
    routes: [{ origin: 'FRA', destination: 'MAD', aircraftClass: 'narrowbody', departures: 7, monthlyProfit: 1e5, aircraftReg: 'LH-A100', aircraft: A320.id, openedAt: M - 20 }],
    monthlyProfitsHistory: [1e5, 2e5],
    personality: 'flag',
    isReal: true,
    color: '#123456',
    forSale: true,
    forSaleSince: M - 2,
    distressMonths: 8,
    ...over,
  };
}

describe('Treibstoff des Spielers (4.2g, 5.2, 8.5)', () => {
  const HEDGED = [{ startMonth: M - 2, months: 6 }];

  it('ohne Absicherung = Tabelle des Modells je Gallone, ohne Schwierigkeit und Ereignis-Faktor', () => {
    assert.ok(Math.abs(playerFuelPerGallon(M, [], []) - fuelTable(M)) < 1e-9);
    assert.equal(playerFuelPerGallon(M, ['fuel-1'], []), fuelPrice(M, ['fuel-1']) * LITRES_PER_GALLON);
  });

  it('während der Absicherung der Tabellenwert des Monats vor Beginn, danach wieder die Tabelle', () => {
    assert.ok(Math.abs(playerFuelPerGallon(M, [], HEDGED) - fuelTable(M - 3)) < 1e-9);
    assert.ok(Math.abs(playerFuelPerGallon(M + 3, [], HEDGED) - fuelTable(M - 3)) < 1e-9);
    assert.ok(Math.abs(playerFuelPerGallon(M + 4, [], HEDGED) - fuelTable(M + 4)) < 1e-9);
  });
});

describe('Ereignis-Faktor der Kopfzeile (4.2g, 7.12)', () => {
  const world: WorldEvent = { title: 'Summer Vacation Surge', startMonth: M, months: 2, demandMultiplier: 0.8 };
  const eu: WorldEvent = { title: 'Volcanic Ash Disruption', startMonth: M, months: 2, demandMultiplier: 0.9, regions: ['EU'] };

  it('= worldEventDemandFactor des Modells über die laufenden Ereignisse (geschichtliche und gewürfelte)', () => {
    assert.equal(worldEventFactor(M, [world, eu]), worldEventDemandFactor(activeWorldEvents(M, [world, eu])));
  });

  it('weltweites Ereignis zählt voll, regionales mit seinem Anteil', () => {
    const base = worldEventFactor(M, []);
    assert.ok(Math.abs(worldEventFactor(M, [world]) / base - 0.8) < 1e-9);
    assert.ok(worldEventFactor(M, [eu]) < base && worldEventFactor(M, [eu]) > base * 0.9);
    assert.equal(worldEventFactor(M + 2, [world, eu]), worldEventFactor(M + 2, []));
  });
});

describe('Grundüberholung (4.2g, 8.13, E62)', () => {
  const p = plane('D-AAAA');

  it('Hangar zählt nur an einem Flughafen der Strecken dieses Flugzeugs', () => {
    assert.equal(hasHangarOnRoutes('D-AAAA', ROUTES, { MAD: infra(1, 4, true) }), true);
    assert.equal(hasHangarOnRoutes('D-AAAA', ROUTES, { LHR: infra(1, 4, true) }), false);
    assert.equal(hasHangarOnRoutes('D-CCCC', ROUTES, { FRA: infra(1, 4, true) }), false);
  });

  it('Preis = overhaulQuote des Modells; ohne Hangar mit Werft-Zuschlag', () => {
    const withHangar = playerOverhaulQuote(p, ROUTES, { FRA: infra(2, 4, true) }, M)!;
    const without = playerOverhaulQuote(p, ROUTES, { FRA: infra(2, 4) }, M)!;
    assert.deepEqual(withHangar, overhaulQuote(aircraftState(p), M, 0, true));
    assert.ok(Math.abs(without.price - withHangar.price * (1 + EXTERNAL_OVERHAUL_SURCHARGE)) < 1e-6);
    assert.ok(withHangar.price >= withHangar.valueGain);
    assert.ok(withHangar.airframeAfter > p.conditionGeneral && withHangar.airframeAfter <= 100);
  });

  it('nach vier Überholungen kein Angebot', () => {
    assert.equal(playerOverhaulQuote({ ...p, generalChecksDone: 4 }, ROUTES, {}, M), null);
  });
});

describe('Übernahme (4.2g, 7.16, E48)', () => {
  it('KI hinter der Ansicht: gespeichert nach Kennung oder Kürzel, sonst umgewandelt', () => {
    const rec = rivalRecord(oldRival(), CTX);
    assert.deepEqual(takeoverRival(oldRival(), null, CTX), rec);
    assert.equal(takeoverRival(oldRival({ id: 'rival-LH' }), [rec], CTX), rec);
    assert.equal(takeoverRival(oldRival(), [rec], CTX), rec);
    assert.equal(takeoverRival(oldRival({ id: 'x', code: 'BA' }), [rec], CTX), undefined);
  });

  it('Preis = Unternehmenswert (takeoverPrice); der Spieler zahlt Preis − Kasse der KI', () => {
    const rec = rivalRecord(oldRival(), CTX);
    const offer = takeoverOffer(rec, 10, M);
    assert.equal(offer.price, takeoverPrice(companyValueOf(rec.company, M), M));
    assert.equal(offer.rivalCash, 30e6);
    assert.equal(offer.netPrice, offer.price - 30e6);
    assert.deepEqual([offer.aircraft, offer.routes], [1, 1]);
    assert.equal(offer.airports, 2);
    assert.equal(offer.blocked, null);
  });

  it('Rang und Status: zum Verkauf ab Rang 6, gesund ab Rang 9', () => {
    const forSale = rivalRecord(oldRival(), CTX);
    const healthy = rivalRecord(oldRival({ forSale: false, forSaleSince: undefined, distressMonths: 0 }), CTX);
    assert.notEqual(takeoverOffer(forSale, RANK_UNLOCKS.takeoverDistressed - 1, M).blocked, null);
    assert.equal(takeoverOffer(forSale, RANK_UNLOCKS.takeoverDistressed, M).blocked, null);
    assert.notEqual(takeoverOffer(healthy, RANK_UNLOCKS.takeoverHealthy - 1, M).blocked, null);
    assert.equal(takeoverOffer(healthy, RANK_UNLOCKS.takeoverHealthy, M).blocked, null);
  });

  it('Bestand: Slots und Schalter je Flughafen der KI dazu, Stufe 1, am Drehkreuz Stufe 2; andere Flughäfen bleiben', () => {
    const rec = rivalRecord(oldRival(), CTX);
    const mine = { MAD: infra(1, 10), LHR: infra(3, 40) };
    const after = takeoverAirports(mine, rec);
    assert.deepEqual(Object.keys(after).sort(), ['FRA', 'MAD']);
    const fra = rec.company.airports.FRA;
    const mad = rec.company.airports.MAD;
    assert.equal(after.FRA.level, 2);
    assert.equal(after.FRA.slots?.narrowbody, fra.slots.Narrowbody);
    assert.equal(after.MAD.level, 1);
    assert.equal(after.MAD.slots?.narrowbody, 10 + (mad.slots.Narrowbody ?? 0));
    assert.equal(after.MAD.desks?.normal, 2 + mad.desks.normal);
    assert.deepEqual(holdingState(after.MAD).stands, holdingState(mine.MAD).stands);
  });

  it('Buchung: Flugzeuge zum Wert als Kauf, Rest als Einmalausgabe – „Aircraft trades“ bleibt 0', () => {
    const rec = rivalRecord(oldRival(), CTX);
    const offer = takeoverOffer(rec, 10, M);
    const taken = takeoverFleet(rec, 'FRA', []);
    const value = planesValue(taken, M);
    const pay = takeoverPayments(offer, value);
    assert.equal(pay.aircraft + pay.rest, offer.netPrice);
    const values = withTradeValue(openLedgerValues([], [], M), value);
    const capex = [
      { label: CAPEX_LABELS.purchases[0], amount: pay.aircraft },
      { label: 'Airline Takeover', amount: pay.rest },
    ];
    const ledger = monthLedger(100e6 - offer.netPrice, capex, values, M, { aircraft: taken.map((p) => aircraftState(p)), preorders: [] });
    assert.equal(ledger.tradeValueChange - ledger.purchases, 0);
    assert.equal(ledger.otherSpending['Airline Takeover'], pay.rest);
    assert.equal(ledger.cashAtStart, 100e6);
  });
});
