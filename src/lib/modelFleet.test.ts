/**
 * Regeltests Paket 4.6b (F66): Flotte, Verkauf, Gebrauchtmarkt, Übernahme-Kabine und Vorbestellung nach dem Modell –
 * Alter und Type appeal (2.2), Cabin rating (2.4), Unterhalt (5.12), Wert (5.13), Verkaufserlös und Gebrauchtmarkt
 * (8.11), Vorbestellung (8.12), Übernahme (7.16).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { AiAirline } from '../components/CompetitorsView';
import type { OwnedAircraft } from '../components/MyFleetView';
import { aircraftList } from '../data/aircraft';
import { cabinRating } from '../model/cabin';
import { DEALER_SPREAD_BUY, DEALER_SPREAD_SELL, PERSONALITY_IDS, PREORDER_DEPOSIT_SHARE, USED_OFFERS_PER_MONTH } from '../model/constants';
import { aircraftUpkeep, aircraftValue, fleetCommonalityFactors, newAircraftPrice } from '../model/fleet';
import { preorderBalance, preorderDiscount, saleProceeds, usedOffers } from '../model/fleetMarket';
import { sellAircraft } from '../model/monthClose';
import { researchEffects } from '../model/progress';
import { rivalAircraft } from '../model/rivals';
import { typeAppeal } from '../model/satisfaction';
import { createOwnedAircraft, defaultCabin } from './fleet';
import { aircraftState, catalogType, modelAirports } from './modelBridge';
import { preorderState } from './modelBridgeCompany';
import { rivalRecord } from './modelBridgeWorld';
import {
  ageLabel,
  planeFigures,
  planeUpkeep,
  preorderableTypes,
  preorderFigures,
  preorderOf,
  preorderQuote,
  resoldPlane,
  resoldSellerCode,
  stateCabin,
  takeoverFleet,
  usedMarket,
  usedPurchase,
  withoutResold,
} from './modelFleet';
import { planesValue, PLAYER_ID } from './modelMonth';

const M = (1995 - 1960) * 12 + 5; // Juni 1995
const A320 = aircraftList.find((a) => a.id === 'a320ceo')!;
const B747 = aircraftList.find((a) => a.id === '747-400') ?? aircraftList.find((a) => a.capacity > 350 && a.firstDeliveryOffset < M)!;
const RESALE = ['resale-1', 'resale-2'];

function plane(reg: string, over: Partial<OwnedAircraft> = {}): OwnedAircraft {
  const { config, baseInteriorPop } = defaultCabin(A320);
  const [p] = createOwnedAircraft(A320, 1, { config, baseInteriorPop, hub: 'FRA', existingRegistrations: [], purchasedAt: M - 130 });
  return { ...p, registration: reg, conditionGeneral: 70, conditionInterior: 60, ...over };
}

describe('Kennzahlen eines Flugzeugs (2.2, 2.4, 5.3, 5.13, 8.11)', () => {
  it('Alter seit dem Baumonat, Type appeal mit Alters-Abzug, Cabin rating wie der Abschluss', () => {
    const p = plane('D-AAAA');
    const f = planeFigures(p, M);
    const s = aircraftState(p);
    assert.equal(f.ageYears, 130 / 12);
    const appeal = typeAppeal({ catalogAppeal: A320.popularity, builtMonth: M - 130, month: M });
    assert.equal(f.typeAppeal, appeal);
    assert.ok(f.typeAppeal < A320.popularity, 'nach 10,8 Jahren zieht das Alter ab');
    assert.deepEqual(Object.keys(f.cabinRating), ['economy']);
    assert.equal(f.cabinRating.economy, cabinRating(appeal, s.interiorScore.economy!, 60));
    assert.equal(f.averageCabinRating, f.cabinRating.economy);
    assert.equal(f.value, aircraftValue(s, M));
  });

  it('Verkaufserlös = Erlös im Modell (`sellAircraft`, mit Forschung), immer unter dem Wert', () => {
    const p = plane('D-AAAA');
    const company = { id: PLAYER_ID, cash: 0, aircraft: [aircraftState(p)], routes: [], inputs: { completedResearch: RESALE }, ledger: { saleProceeds: 0, tradeValueChange: 0 } };
    const sold = sellAircraft(company as never, 'D-AAAA', M);
    const f = planeFigures(p, M, RESALE);
    assert.equal(f.saleProceeds, sold.company.cash);
    assert.equal(f.saleProceeds, saleProceeds(f.value, researchEffects(RESALE).resaleBonus));
    assert.ok(f.saleProceeds < f.value);
    assert.equal(planeFigures(p, M).saleProceeds, f.value * (1 - DEALER_SPREAD_SELL));
  });

  it('Effizienz mit Forschung, nicht das Feld am Flugzeug', () => {
    const p = plane('D-AAAA', { efficiency: 1 });
    assert.equal(planeFigures(p, M).efficiency, A320.efficiency);
  });

  it('Unterhalt wie im Abschluss: Flotten-Mischung, halber Satz geparkt', () => {
    const fleet = [plane('D-AAAA'), plane('D-AAAB')];
    const factors = fleetCommonalityFactors(fleet.map((p) => aircraftState(p)));
    const expected = aircraftUpkeep({ listPrice1960: A320.basePrice, builtMonth: M - 130, month: M, commonalityFactor: factors[0], parked: false });
    assert.equal(planeUpkeep(fleet[0], fleet, M, false).total, expected);
    assert.equal(planeUpkeep(fleet[0], fleet, M, true).total, expected / 2);
  });

  it('Alter als Text', () => {
    assert.deepEqual([ageLabel(0), ageLabel(5 / 12), ageLabel(130 / 12)], ['New', '5 mo', '10 y 10 mo']);
  });
});

describe('Kabine eines Modell-Flugzeugs (7.5, 7.16)', () => {
  it('jede Persönlichkeit: die Kabine der KI ergibt genau die Modell-Werte', () => {
    for (const type of [A320, B747]) {
      for (const p of PERSONALITY_IDS) {
        const s = rivalAircraft(p, catalogType(type), M - 40, 'x');
        const cabin = stateCabin(s, type);
        assert.equal(cabin.exact, true, `${type.id} ${p}`);
        const owned = { ...plane('D-AAAA'), ...type, registration: 'D-AAAA', config: cabin.config, purchasedAt: M - 40, cabinInstalledAt: M - 40 };
        const back = aircraftState(owned);
        assert.deepEqual(back.seats, s.seats);
        assert.equal(back.cabinListPrice1960, s.cabinListPrice1960);
      }
    }
  });

  it('ohne passende Persönlichkeit: Sitze des Flugzeugs mit Standard-Sitzen', () => {
    const s = { ...rivalAircraft('flag', catalogType(A320), M - 40, 'x'), interiorScore: { economy: 1 } };
    const cabin = stateCabin(s, A320);
    assert.equal(cabin.exact, false);
    assert.equal(cabin.config.economy + cabin.config.business + cabin.config.first + cabin.config.premium, Object.values(s.seats).reduce((a, b) => a + (b ?? 0), 0));
  });
});

describe('Übernahme (7.16): Flugzeuge mit der Kabine der KI', () => {
  const AIRPORTS = modelAirports();
  const ai: AiAirline = {
    id: 'ai_lh', name: 'Lufthansa', code: 'LH', hub: 'FRA', capital: 30e6, aiDifficulty: 'Normal',
    fleet: [{
      id: B747.id, manufacturer: B747.manufacturer, family: B747.family, type: B747.type, class: 'widebody', reg: 'LH-A100',
      capacity: B747.capacity, purchasedAt: M - 30, conditionGeneral: 81, conditionInterior: 64, config: { economy: 300, premium: 0, business: 0, first: 0 },
    }],
    routes: [],
    monthlyProfitsHistory: [],
    personality: 'flag',
    isReal: true,
  } as unknown as AiAirline;

  it('Wert der übernommenen Flotte = Wert der KI-Flugzeuge im Modell; Baumonat, Zustand, Kabine bleiben', () => {
    const rec = rivalRecord(ai, { month: M, airports: AIRPORTS });
    const planes = takeoverFleet(rec, 'FRA', []);
    assert.equal(planes.length, 1);
    const s = rec.company.aircraft[0];
    assert.ok(Math.abs(planesValue(planes, M) - aircraftValue(s, M)) < 1e-6);
    assert.equal(planes[0].purchasedAt, M - 30);
    assert.deepEqual([planes[0].conditionGeneral, planes[0].conditionInterior], [81, 64]);
    assert.deepEqual(aircraftState(planes[0]).seats, s.seats);
    assert.ok((planes[0].config.business ?? 0) > 0, 'ein Flag-Carrier hat Business auf dem Jumbo');
    assert.equal(planes[0].hubId, 'FRA');
  });
});

describe('Gebrauchtmarkt (8.11)', () => {
  it('neue Angebote = `usedOffers`, Preis = usedPrice(aircraftValue), Auslieferungs-Kabine', () => {
    const list = usedMarket(M, []);
    const offers = usedOffers(aircraftList, M);
    assert.equal(list.length, USED_OFFERS_PER_MONTH);
    assert.deepEqual(list.map((l) => l.id), offers.map((o) => o.id));
    for (const l of list) {
      assert.ok(Math.abs(l.price - l.figures.value * (1 + DEALER_SPREAD_BUY)) < 1e-6);
      assert.equal(l.config.first + l.config.business + l.config.premium, 0);
      assert.ok(l.price > l.figures.saleProceeds);
    }
  });

  it('Kauf: das Flugzeug hat genau den Wert, aus dem der Preis kommt; sofort verkauft ≤ 83 %', () => {
    for (const l of usedMarket(M, [])) {
      const bought = usedPurchase(l, { hub: 'FRA', existingRegistrations: [] })!;
      assert.equal(bought.purchasedAt, l.builtMonth);
      assert.ok(Math.abs(planesValue([bought], M) - l.figures.value) < 1e-6);
      const back = planeFigures(bought, M, RESALE).saleProceeds;
      assert.ok(back / l.price <= ((1 - DEALER_SPREAD_SELL) * (1 + researchEffects(RESALE).resaleBonus)) / (1 + DEALER_SPREAD_BUY) + 1e-9);
      assert.ok(back / l.price < 0.83);
    }
  });

  it('weiterverkaufte Flugzeuge stehen im Markt, mit Kabine; gekauft verlassen sie ihn', () => {
    const sold = resoldPlane(plane('D-AAAA'), M - 1);
    const rec = rivalRecord(
      { id: 'ai_ba', name: 'BA', code: 'BA', hub: 'LHR', capital: 1e6, aiDifficulty: 'Normal', personality: 'boutique', isReal: true, routes: [], monthlyProfitsHistory: [],
        fleet: [{ id: A320.id, manufacturer: A320.manufacturer, family: A320.family, type: A320.type, class: 'narrowbody', reg: 'BA-A1', capacity: A320.capacity, purchasedAt: M - 50, conditionGeneral: 80, conditionInterior: 70, config: { economy: 150, premium: 0, business: 0, first: 0 } }],
      } as unknown as AiAirline,
      { month: M, airports: modelAirports() },
    );
    const rivalSold = { ...rec.company.aircraft[0], soldMonth: M };
    const list = usedMarket(M, [sold, rivalSold]).filter((l) => l.source === 'resold');
    assert.equal(list.length, 2);
    const mine = list.find((l) => l.planeId === 'D-AAAA')!;
    assert.equal(mine.exactCabin, true, 'die Auslieferungs-Kabine passt genau');
    assert.ok(Math.abs(mine.figures.value - aircraftValue(sold, M)) < 1e-6);
    const theirs = list.find((l) => l.planeId === rivalSold.id)!;
    assert.equal(theirs.exactCabin, true);
    assert.equal(resoldSellerCode(theirs.planeId), 'BA');
    assert.equal(resoldSellerCode(mine.planeId), null);
    assert.ok(Math.abs(theirs.figures.value - aircraftValue(rivalSold, M)) < 1e-6);
    assert.equal(withoutResold([sold, rivalSold], theirs.id).length, 1);
    assert.equal(usedMarket(M + 5, [sold, rivalSold]).filter((l) => l.source === 'resold').length, 1, 'nach 6 Monaten weg');
  });

  it('5.2b: ein Flugzeug mit eigener Kabine kommt mit genau dieser Kabine in den Markt, auch nach dem Spielstand', () => {
    const base = plane('D-ABCD').config;
    const custom = { ...base, economy: base.economy - 30, business: 12, details: { ...base.details, hasWifi: true, business: { ...base.details.business, seats: 12 } } } as typeof base;
    const sold = resoldPlane(plane('D-ABCD', { config: custom }), M - 1);
    const stored = JSON.parse(JSON.stringify(sold));
    const [mine] = usedMarket(M, [stored]).filter((l) => l.source === 'resold');
    assert.equal(mine.exactCabin, true, 'keine „fittings reset to standard“');
    assert.deepEqual(mine.config, custom);
    assert.ok(Math.abs(mine.figures.value - aircraftValue(sold, M)) < 1e-6, 'Preis aus derselben Kabine (R2)');
    const { config: _c, ...withoutCabin } = stored;
    const [plain] = usedMarket(M, [withoutCabin]).filter((l) => l.source === 'resold');
    assert.notDeepEqual(plain.config, custom, 'ohne die Kabine der Oberfläche nur aus den Modell-Werten');
  });
});

describe('Vorbestellung (8.12)', () => {
  const type = aircraftList.find((a) => a.firstDeliveryOffset > M && a.firstDeliveryOffset <= M + 12) ?? aircraftList.find((a) => a.firstDeliveryOffset > 400)!;
  const month = Math.min(M, type.firstDeliveryOffset - 6);

  it('vorbestellbar: Erstauslieferung in den nächsten 12 Monaten', () => {
    for (const t of preorderableTypes(month)) assert.ok(t.firstDeliveryOffset > month && t.firstDeliveryOffset <= month + 12);
    assert.ok(preorderableTypes(month).some((t) => t.id === type.id));
  });

  it('Anzahlung und Rest wie im Abschluss: Rest = Preis im Liefermonat − Anzahlung', () => {
    const q = preorderQuote(type, 4, month);
    assert.equal(q.discount, preorderDiscount(4));
    const order = preorderOf(type, 4, month, 'o1');
    const state = preorderState(order);
    const base = newAircraftPrice(state.plane.listPrice1960, state.plane.cabinListPrice1960, order.deliveryOffset);
    assert.equal(q.balance, preorderBalance(base, 4, order.deposit));
    assert.ok(Math.abs(q.deposit + q.balance - q.total) < 1e-6);
    const atOrder = newAircraftPrice(state.plane.listPrice1960, state.plane.cabinListPrice1960, month);
    assert.ok(Math.abs(q.deposit - PREORDER_DEPOSIT_SHARE * (1 - q.discount) * atOrder * 4) < 1e-6);
    const fig = preorderFigures(order);
    assert.equal(fig.balance, q.balance);
    assert.equal(fig.refund, order.deposit / 2);
  });
});
