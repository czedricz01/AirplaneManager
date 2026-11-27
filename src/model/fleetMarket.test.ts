/**
 * Regeltests zu SPEZIFIKATION 8.11–8.14 (Händler-Spanne, Gebrauchtmarkt, Vorbestellung, Überholung, Umbau,
 * Kreditlinie) und den passenden Teilen von Beispiel 8.17; dazu die in 3.7b offenen Tests „Verkaufserlös KI =
 * Spieler“ und „verkaufte KI-Flugzeuge im Gebrauchtmarkt“ (7.11, F39). Paket 3.8a.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aircraftList as AIRCRAFT } from '../data/aircraft';
import { atCost } from './basics';
import { aircraftValue, newAircraftPrice, newPrice, valueBase, type ValuedAircraft } from './fleet';
import { researchEffects } from './progress';
import { RIVAL_INPUTS } from './rivals';
import { emergencySaleCandidate, liquidate } from './rivalMonth';
import {
  DEALER_SPREAD_SELL,
  BANKRUPTCY_OVERDRAWN_MONTHS,
  OVERDRAWN_TO_FORCED_SALE,
  OVERHAUL_PRICE_SHARE,
  PREORDER_DISCOUNT_MAX,
  PREORDER_MAX,
  RESEARCH_PROJECTS,
  START_YEAR,
  USED_AGE_MAX,
  USED_AGE_MIN,
  USED_OFFERS_PER_MONTH,
  USED_RESOLD_MAX,
} from './constants';
import {
  canPay,
  creditInterest,
  creditLimit,
  creditState,
  forcedSale,
  isBankrupt,
  isLaunchCustomer,
  isPreorderable,
  nextOverdrawnMonths,
  overhaulPoints,
  overhaulQuote,
  preorderBalance,
  preorderDelivery,
  preorderDeliveryMonth,
  preorderDeposit,
  preorderDiscount,
  preorderRefund,
  preorderUnitPrice,
  refitCabinCondition,
  refitLabour,
  refitPrice,
  resoldInMarket,
  saleCandidate,
  saleProceeds,
  usedMarketPrice,
  usedOffers,
  usedPrice,
} from './fleetMarket';

const m = (year: number, calendarMonth = 1) => (year - START_YEAR) * 12 + calendarMonth - 1;
const near = (actual: number, expected: number, tol: number, msg?: string) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ''} ${actual} ≠ ${expected} ± ${tol}`);

/** Größter `resaleBonus` aus der Forschungs-Tabelle (alle Projekte). */
const MAX_RESALE_BONUS = researchEffects(RESEARCH_PROJECTS.map((p) => p.id)).resaleBonus;

/** A320ceo aus Beispiel 8.17: Liste 40 Mio. $, gebaut 1990, Kabine ohne Preis. */
const a320 = (over: Partial<ValuedAircraft> = {}): ValuedAircraft => ({
  listPrice1960: 40e6,
  builtMonth: m(1990),
  cabinListPrice1960: 0,
  cabinInstalledMonth: m(1990),
  airframeCondition: 100,
  cabinCondition: 100,
  ...over,
});

describe('Abschnitt 8.11 Händler-Spanne und Verkauf', () => {
  it('8.17: A320ceo 1990 neu gekauft, sofort verkauft: −15 % (mit Forschung 49,8 Mio. $)', () => {
    near(valueBase(a320()), 57.2e6, 0.02e6);
    near(saleProceeds(aircraftValue(a320(), m(1990))), 48.6e6, 0.05e6);
    near(saleProceeds(aircraftValue(a320(), m(1990)), MAX_RESALE_BONUS), 49.8e6, 0.05e6);
  });

  it('8.17: 2010, Alter 20, Zelle 60 / Kabine 40: Wert 15,0, Gebrauchtpreis 15,8, Erlös 12,8 (13,1) Mio. $', () => {
    const plane = a320({ airframeCondition: 60, cabinCondition: 40 });
    const value = aircraftValue(plane, m(2010));
    near(value, 15.0e6, 0.05e6);
    near(usedPrice(value), 15.8e6, 0.05e6);
    near(usedMarketPrice(plane, m(2010)), usedPrice(value), 1e-6);
    near(saleProceeds(value), 12.8e6, 0.05e6);
    near(saleProceeds(value, MAX_RESALE_BONUS), 13.1e6, 0.05e6);
  });

  it('8.11: gebraucht kaufen und im selben Monat verkaufen bringt höchstens 83 % zurück; Gebrauchtpreis > Erlös', () => {
    assert.equal(MAX_RESALE_BONUS, 0.025);
    for (const value of [1, 1e6, 3.3e7, 2e8]) {
      assert.ok(saleProceeds(value, MAX_RESALE_BONUS) / usedPrice(value) <= 0.83);
      assert.ok(usedPrice(value) > saleProceeds(value, MAX_RESALE_BONUS));
    }
  });

  it('7.11: Verkaufserlös KI = Spieler ohne Forschung (dasselbe Flugzeug, dieselbe Funktion)', () => {
    const plane = a320({ airframeCondition: 70, cabinCondition: 55 });
    const value = aircraftValue(plane, m(2005));
    assert.equal(saleProceeds(value, researchEffects(RIVAL_INPUTS.completedResearch).resaleBonus), saleProceeds(value));
    near(saleProceeds(value), value * (1 - DEALER_SPREAD_SELL), 1e-6);
  });

  it('8.14 / 7.11: Not- und Zwangsverkauf wählen dasselbe Flugzeug (abgestellt zuerst, sonst schlechteste Strecke)', () => {
    const planes = [
      { flying: true, routeResult: 5 },
      { flying: true, routeResult: -3 },
      { flying: true, routeResult: 1 },
    ];
    assert.equal(saleCandidate(planes), 1);
    assert.equal(saleCandidate([...planes, { flying: false, routeResult: 99 }]), 3);
    assert.equal(saleCandidate([]), -1);
    const view = planes.map((p, i) => ({ ...p, id: `r${i}`, builtMonth: 0, typeLastDeliveryOffset: null, airframeCondition: 80, cabinCondition: 80, idleMonths: 0 }));
    assert.equal(emergencySaleCandidate(view, -1), saleCandidate(planes));
  });
});

describe('Abschnitt 8.11 Gebrauchtmarkt', () => {
  it('8.11: Angebote nur nach Monat gewürfelt, 6 je Monat, Baumonat zwischen Erstauslieferung und Bauende, Alter 4 … 24', () => {
    const byId = new Map(AIRCRAFT.map((a) => [a.id, a]));
    for (let month = m(1966); month <= m(2030); month += 7) {
      const offers = usedOffers(AIRCRAFT, month);
      assert.deepEqual(usedOffers(AIRCRAFT, month), offers);
      assert.equal(offers.length, USED_OFFERS_PER_MONTH);
      for (const o of offers) {
        const type = byId.get(o.typeId)!;
        assert.ok(o.builtMonth >= type.firstDeliveryOffset, o.typeId);
        assert.ok(type.lastDeliveryOffset === null || o.builtMonth <= type.lastDeliveryOffset, `${o.typeId} nach Bauende`);
        assert.ok(month - type.firstDeliveryOffset >= 60);
        const age = (month - o.builtMonth) / 12;
        assert.ok(age >= USED_AGE_MIN && age <= USED_AGE_MAX, `Alter ${age}`);
        for (const c of [o.airframeCondition, o.cabinCondition]) assert.ok(c >= 20 && c <= 95);
      }
    }
  });

  it('8.11: vor 1965 gibt es kein Angebot (kein Typ 5 Jahre im Dienst ab 1960, falls keiner älter ist)', () => {
    const tooYoung = AIRCRAFT.filter((a) => a.firstDeliveryOffset > -60);
    assert.deepEqual(usedOffers(tooYoung, 0), []);
  });

  it('7.11: jedes verkaufte KI-Flugzeug erscheint im Markt (auch bei Auflösung)', () => {
    const planes = Array.from({ length: 3 }, (_, i) => ({ id: `r${i}`, soldMonth: 500 }));
    const gone = liquidate(planes, [], -1e6).toUsedMarket;
    const market = resoldInMarket([{ id: 'old', soldMonth: 490 }, ...gone], 500);
    for (const p of planes) assert.ok(market.some((x) => x.id === p.id));
    assert.ok(!market.some((x) => x.id === 'old'), 'älter als 6 Monate');
  });

  it('8.11: weiterverkaufte Flugzeuge 6 Monate im Markt, die neuesten 12', () => {
    const list = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, soldMonth: 100 + (i % 6) }));
    const shown = resoldInMarket(list, 105);
    assert.equal(shown.length, USED_RESOLD_MAX);
    assert.ok(shown.every((p, i) => i === 0 || shown[i - 1].soldMonth >= p.soldMonth));
    assert.equal(resoldInMarket(list, 106).every((p) => p.soldMonth >= 101), true);
    assert.equal(resoldInMarket(list, 99).length, 0);
  });
});

describe('Abschnitt 8.12 Neukauf und Vorbestellung', () => {
  it('8.12: Neukauf zum Wert, sofort verkauft −15 %', () => {
    const price = newAircraftPrice(40e6, 2e6, m(2000));
    const plane = a320({ builtMonth: m(2000), cabinListPrice1960: 2e6, cabinInstalledMonth: m(2000) });
    near(aircraftValue(plane, m(2000)), price, 1e-6);
    near(saleProceeds(aircraftValue(plane, m(2000))) / price, 0.85, 1e-12);
  });

  it('8.12: Rabatt-Bedingung: PREORDER_DISCOUNT_MAX < 1 − (1 − Spanne) × (1 + größter resaleBonus) = 0,129', () => {
    const bound = 1 - (1 - DEALER_SPREAD_SELL) * (1 + MAX_RESALE_BONUS);
    near(bound, 0.129, 0.001);
    assert.ok(PREORDER_DISCOUNT_MAX < bound);
  });

  it('8.12: mehr Stück → nie kleinerer Rabatt; 1 Stück 5 %, ab 8 Stück 12 %', () => {
    near(preorderDiscount(1), 0.05, 1e-12);
    near(preorderDiscount(8), 0.12, 1e-12);
    for (let n = 2; n <= PREORDER_MAX; n++) assert.ok(preorderDiscount(n) >= preorderDiscount(n - 1));
    assert.equal(preorderDiscount(50), preorderDiscount(PREORDER_MAX));
  });

  it('8.12: Vorbestellen und bei Lieferung verkaufen bringt nie Gewinn (Alt-Code: bis +120 Mio. $, W2)', () => {
    for (let n = 1; n <= PREORDER_MAX; n++) {
      for (const value of [1e7, 1e8]) {
        assert.ok(saleProceeds(value, MAX_RESALE_BONUS) < preorderUnitPrice(value, n));
      }
    }
  });

  it('8.17: 12 Stück, Wert bei Lieferung je 100 Mio. $: Preis 88, Ertrag 12, sofort verkauft 85 (87,1) Mio. $', () => {
    near(preorderUnitPrice(100e6, 12), 88e6, 1);
    near(100e6 - preorderUnitPrice(100e6, 12), 12e6, 1);
    near(saleProceeds(100e6), 85e6, 1);
    near(saleProceeds(100e6, MAX_RESALE_BONUS), 87.125e6, 1);
  });

  it('8.12: Anzahlung 20 % des geschätzten Preises (Bestellmonat), Rest bei Lieferung', () => {
    const atOrder = 90e6;
    const atDelivery = 100e6;
    const deposit = preorderDeposit(atOrder, 4);
    near(deposit, 0.2 * (1 - preorderDiscount(4)) * atOrder * 4, 1e-6);
    near(deposit + preorderBalance(atDelivery, 4, deposit), preorderUnitPrice(atDelivery, 4) * 4, 1e-6);
    near(preorderRefund(deposit), deposit / 2, 1e-9);
  });

  it('8.12: Angebot, Liefermonat, Erstkunde', () => {
    assert.equal(isPreorderable({ firstDeliveryOffset: 112 }, 100), true);
    assert.equal(isPreorderable({ firstDeliveryOffset: 113 }, 100), false);
    assert.equal(isPreorderable({ firstDeliveryOffset: 100 }, 100), false);
    assert.equal(preorderDeliveryMonth(200, 1), 201);
    assert.equal(preorderDeliveryMonth(200, 12), 205);
    assert.equal(isLaunchCustomer(212, 200), true);
    assert.equal(isLaunchCustomer(213, 200), false);
  });

  it('8.12: ohne Geld dreimal verschoben, dann storniert', () => {
    assert.equal(preorderDelivery(10, 10, 0), 'deliver');
    assert.equal(preorderDelivery(9, 10, 0), 'delay');
    assert.equal(preorderDelivery(9, 10, 2), 'delay');
    assert.equal(preorderDelivery(9, 10, 3), 'cancel');
    assert.equal(preorderDelivery(-5, 10, 0), 'delay', 'keine Kreditlinie für Käufe');
  });
});

describe('Abschnitt 8.13 Grundüberholung und Kabinen-Umbau', () => {
  it('8.17: Überholung 2010, Alter 20, Zelle 50 → 100 (Kabine 40): Wertgewinn 4,63, Preis 4,63 (fremde Werft 5,79) Mio. $', () => {
    const plane = a320({ airframeCondition: 50, cabinCondition: 40 });
    const own = overhaulQuote(plane, m(2010), 0, true)!;
    near(own.valueGain, 4.63e6, 0.01e6);
    near(OVERHAUL_PRICE_SHARE * newPrice(40e6, m(2010)), 2.9e6, 0.01e6);
    near(own.price, own.valueGain, 1e-6);
    near(overhaulQuote(plane, m(2010), 0, false)!.price, 5.79e6, 0.01e6);
    assert.equal(own.airframeAfter, 100);
  });

  it('8.17: Überholung 1995, Alter 5, Zelle 85 → 100 (Kabine 80): Wertgewinn 3,24, Anteil 2,43 → Preis 3,24 Mio. $', () => {
    const q = overhaulQuote(a320({ airframeCondition: 85, cabinCondition: 80 }), m(1995), 0, true)!;
    near(q.valueGain, 3.24e6, 0.01e6);
    near(OVERHAUL_PRICE_SHARE * newPrice(40e6, m(1995)), 2.43e6, 0.01e6);
    near(q.price, 3.24e6, 0.01e6);
  });

  it('8.13: eine Überholung hebt den Wert nie über ihren Preis (alle Typen, Jahre, Zustände, Orte)', () => {
    for (const type of AIRCRAFT) {
      for (const year of [1965, 1990, 2020]) {
        const month = m(year);
        if (type.firstDeliveryOffset > month) continue;
        for (const airframe of [0, 40, 80, 99]) {
          for (const done of [0, 1, 2, 3]) {
            for (const hangar of [true, false]) {
              const plane = a320({ listPrice1960: type.basePrice, builtMonth: Math.max(type.firstDeliveryOffset, month - 120), airframeCondition: airframe, cabinCondition: 50 });
              const q = overhaulQuote(plane, month, done, hangar)!;
              assert.ok(q.valueGain <= q.price + 1e-6, type.id);
            }
          }
        }
      }
    }
  });

  it('8.13: 747 und CRJ zahlen denselben Anteil ihres Neupreises; 2020 = Anteil × newPrice 2020', () => {
    const month = m(2020);
    for (const id of ['747-400', 'crj200']) {
      const type = AIRCRAFT.find((a) => a.id === id);
      assert.ok(type, id);
      const plane = a320({ listPrice1960: type.basePrice, builtMonth: m(2010), airframeCondition: 95, cabinCondition: 95 });
      const q = overhaulQuote(plane, month, 0, true)!;
      near(q.price / newPrice(type.basePrice, month), OVERHAUL_PRICE_SHARE, 1e-12, id);
    }
  });

  it('8.13: Punkte 50 / 50 / 40 / 30, danach keine Überholung mehr', () => {
    assert.deepEqual([0, 1, 2, 3, 4].map(overhaulPoints), [50, 50, 40, 30, 0]);
    assert.equal(overhaulQuote(a320({ airframeCondition: 10 }), m(2000), 4, true), null);
    assert.equal(overhaulQuote(a320({ airframeCondition: 10 }), m(2000), 2, true)!.airframeAfter, 50);
  });

  it('8.13: Umbau mit Kostenindex; Zustand danach max(jetzt, 90 − 10 × Umbauten, 30)', () => {
    near(refitLabour(180, m(2000)), atCost(180_000, m(2000)), 1e-6);
    near(refitPrice(1e6, 180, m(2000)), atCost(1e6, m(2000)) + atCost(180_000, m(2000)), 1e-6);
    assert.equal(refitCabinCondition(40, 0), 90);
    assert.equal(refitCabinCondition(40, 3), 60);
    assert.equal(refitCabinCondition(40, 9), 40);
    assert.equal(refitCabinCondition(20, 9), 30);
    assert.equal(refitCabinCondition(95, 0), 95);
  });
});

describe('Abschnitt 8.14 Kreditlinie, Zwangsverkauf, Spielende', () => {
  it('8.17: 10 × A320ceo zu je 20,6 Mio. $ → Grenze 103 Mio. $; Kasse −50 Mio. $ → Zinsen 333 333 $', () => {
    near(creditLimit(10 * 20.6e6), 103e6, 1);
    near(creditInterest(-50e6), 333_333.33, 0.01);
  });

  it('8.14: ohne Flugzeuge Grenze 0; Zinsen 0 bei Kasse ≥ 0', () => {
    assert.equal(creditLimit(0), 0);
    assert.equal(creditInterest(0), 0);
    assert.equal(creditInterest(1e9), 0);
    assert.equal(creditState(-1, 0), 'overdrawn');
    assert.equal(creditState(0, 0), 'healthy');
    assert.equal(creditState(-5, 10), 'credit');
  });

  it('8.14: ein Monat über der Grenze zwischen überzogenen setzt den Zähler zurück', () => {
    let months = 0;
    for (const cash of [-200, -200, -50, -200]) months = nextOverdrawnMonths(months, creditState(cash, 100));
    assert.equal(months, 1);
  });

  it('8.14: nach 6 überzogenen Monaten in Folge sinkt die Flugzeugzahl um 1 je Monat; ohne Flugzeuge Pleite', () => {
    const value = 10e6;
    let planes = Array.from({ length: 4 }, (_, i) => ({ flying: true, routeResult: i }));
    let cash = -1e9;
    let overdrawn = 0;
    const counts: number[] = [];
    let bankrupt = false;
    for (let month = 0; month < 12 && !bankrupt; month++) {
      const state = creditState(cash, creditLimit(value * planes.length));
      overdrawn = nextOverdrawnMonths(overdrawn, state);
      const i = forcedSale(planes, overdrawn, state);
      if (i >= 0) {
        cash += saleProceeds(value);
        planes = planes.filter((_, k) => k !== i);
      }
      counts.push(planes.length);
      bankrupt = isBankrupt(creditState(cash, creditLimit(value * planes.length)), planes.length);
    }
    assert.deepEqual(counts.slice(0, OVERDRAWN_TO_FORCED_SALE - 1), [4, 4, 4, 4, 4]);
    assert.deepEqual(counts.slice(OVERDRAWN_TO_FORCED_SALE - 1), [3, 2, 1, 0]);
    assert.equal(bankrupt, true);
  });

  it('8.14 (E93): Spielende auch nach N überzogenen Monaten in Folge, mit Flugzeugen', () => {
    assert.equal(isBankrupt('overdrawn', 3, 2, BANKRUPTCY_OVERDRAWN_MONTHS.Hard), false);
    assert.equal(isBankrupt('overdrawn', 3, 3, BANKRUPTCY_OVERDRAWN_MONTHS.Hard), true);
    assert.equal(isBankrupt('overdrawn', 3, 5, BANKRUPTCY_OVERDRAWN_MONTHS.Normal), false);
    assert.equal(isBankrupt('overdrawn', 3, 6, BANKRUPTCY_OVERDRAWN_MONTHS.Normal), true);
    assert.equal(isBankrupt('overdrawn', 3, 11, BANKRUPTCY_OVERDRAWN_MONTHS.Easy), false);
    assert.equal(isBankrupt('credit', 3, 20, BANKRUPTCY_OVERDRAWN_MONTHS.Hard), false, 'nur überzogen zählt');
    assert.equal(isBankrupt('overdrawn', 3, 20), false, 'ohne Frist (KI) nur ohne Flugzeuge');
    assert.ok(BANKRUPTCY_OVERDRAWN_MONTHS.Hard < BANKRUPTCY_OVERDRAWN_MONTHS.Normal && BANKRUPTCY_OVERDRAWN_MONTHS.Normal < BANKRUPTCY_OVERDRAWN_MONTHS.Easy);
  });

  it('8.14: Zwangsverkauf endet, wenn die Kasse wieder über −Grenze liegt', () => {
    const planes = [{ flying: true, routeResult: 0 }];
    assert.equal(forcedSale(planes, 10, creditState(-50, 100)), -1);
    assert.equal(forcedSale(planes, 5, creditState(-500, 100)), -1);
    assert.equal(forcedSale(planes, 6, creditState(-500, 100)), 0);
  });

  it('8.14: kein Kauf lässt die Kasse unter 0 fallen', () => {
    assert.equal(canPay(100, 100), true);
    assert.equal(canPay(100, 100.01), false);
    assert.equal(canPay(-10, 0), false);
  });
});
