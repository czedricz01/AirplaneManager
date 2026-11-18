/**
 * Regeltests zu SPEZIFIKATION 3.8–3.12, 3.14 und dem Beispiel 3.15 (Aufteilung eines Markts),
 * dazu der Anschluss von `satisfactionFactor` (2.10) an die Anziehung.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { difficultyFactor } from './basics';
import {
  ADVERTISING_MAX,
  CABIN_CLASSES,
  FLIGHT_TIME_EXP,
  PRICE_SENSITIVITY,
  RAMP_MONTHS,
  RAMP_RESEARCH_BONUS,
  RAMP_START,
  type CabinClass,
} from './constants';
import {
  advertisingFactor,
  advertisingRegionFactor,
  classPotential,
  departureShare,
  directOffer,
  distributeToRoutes,
  establishedRouteBonus,
  flightTimeFactor,
  frequencyFactor,
  frequentFlyerFactor,
  marketSplit,
  noFlyAppeal,
  offerAppeal,
  offerAppealParts,
  passengerShare,
  priceFactor,
  rampFactor,
  reputationFactor,
  type OfferAppealInput,
  type SplitOffer,
} from './marketSplit';
import { satisfactionFactor } from './satisfaction';

function assertClose(actual: number, expected: number, tolerance = 1e-9, message?: string) {
  assert.ok(Math.abs(actual - expected) <= tolerance, message ?? `${actual} ≉ ${expected}`);
}

const MARKET_FARE: Record<CabinClass, number> = { economy: 100, premium: 150, business: 250, first: 400 };

/** Bezugsangebot (3.9.0) in einem Paar mit Bezugs-Flugzeit 120 min. */
const REFERENCE: OfferAppealInput = {
  frequency: 7,
  fare: 100,
  marketFare: 100,
  blockMinutes: 120,
  referenceBlockMinutes: 120,
  ageMonths: 12,
};

/** Economy-Markt mit `marketSize × classShare = 1000` (wie Beispiel 3.15). */
const POTENTIAL = classPotential('economy', 1000, 1);
const NO_FLY = noFlyAppeal('economy');

function split(offers: SplitOffer[], potential = POTENTIAL, cabinClass: CabinClass = 'economy') {
  return marketSplit({ potential, noFlyAppeal: noFlyAppeal(cabinClass), offers });
}

/** Fluggäste des Spieler-Angebots allein im Economy-Markt, Sitze reichen. */
function alone(appeal: number, ramp = 1): number {
  return split([{ id: 'player', appeal, seats: Infinity, ramp }]).passengers.player;
}

/** Erlösbester Preis allein im Markt (Suche in Schritten von 0,01 $). */
function bestFareAlone(cabinClass: CabinClass, otherAppeal: number, satisfaction = 1): number {
  const potential = classPotential(cabinClass, 1000, 1);
  let best = 0;
  let bestFare = 0;
  for (let fare = 50; fare <= 250; fare += 0.01) {
    const appeal = otherAppeal * priceFactor(cabinClass, fare, 100, satisfaction);
    const passengers = split([{ id: 'p', appeal, seats: Infinity }], potential, cabinClass).passengers.p;
    if (passengers * fare > best) {
      best = passengers * fare;
      bestFare = fare;
    }
  }
  return bestFare;
}

/** Kleiner Zufallsgeber für Eigenschafts-Tests (fester Startwert, wiederholbar). */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('Abschnitt 3.8 Angebote eines Markts', () => {
  const routeA = { id: 'A', seatsPerFlight: { economy: 150, business: 12 }, departuresPerWeek: 14, blockMinutes: 100, fare: { economy: 90 } };
  const routeB = { id: 'B', seatsPerFlight: { economy: 50 }, departuresPerWeek: 7, blockMinutes: 160, fare: { economy: 120 } };

  it('3.8: Sitze = Sitze je Flug × Abflüge je Woche, über alle Strecken summiert', () => {
    const offer = directOffer([routeA, routeB], MARKET_FARE);
    assert.equal(offer.seats.economy, 150 * 14 + 50 * 7);
    assert.equal(offer.seats.business, 12 * 14);
    assert.equal(offer.seats.first, 0);
  });

  it('3.8: Abflüge je Richtung = Summe / 2; ein Einweg-Umlauf zählt halb so viel wie Hin und Zurück (W14)', () => {
    assert.equal(directOffer([routeA, routeB], MARKET_FARE).frequency, (14 + 7) / 2);
    const roundTrip = directOffer([{ ...routeB, departuresPerWeek: 14 }], MARKET_FARE).frequency;
    const oneWay = directOffer([{ ...routeB, departuresPerWeek: 7 }], MARKET_FARE).frequency;
    assert.equal(oneWay, roundTrip / 2);
  });

  it('3.8: Preis nach Sitzen in der Klasse gewichtet; fehlender Preis = Marktpreis (R8)', () => {
    const offer = directOffer([routeA, routeB], MARKET_FARE);
    assertClose(offer.fare.economy, (2100 * 90 + 350 * 120) / 2450);
    assert.equal(offer.fare.business, MARKET_FARE.business);
    assert.equal(offer.fare.first, MARKET_FARE.first);
  });

  it('3.8: Flugzeit nach Sitzen je Woche gewichtet', () => {
    const offer = directOffer([routeA, routeB], MARKET_FARE);
    const seatsA = 162 * 14;
    const seatsB = 50 * 7;
    assertClose(offer.blockMinutes, (seatsA * 100 + seatsB * 160) / (seatsA + seatsB));
  });

  it('3.8: Erlös mit gewichtetem Preis = Erlös, wenn jeder Gast den Preis seiner Strecke zahlt', () => {
    const offer = directOffer([routeA, routeB], MARKET_FARE);
    const passengers = 1800;
    const byRoute = distributeToRoutes(passengers, { A: 150 * 14, B: 50 * 7 });
    assertClose(passengers * offer.fare.economy, byRoute.A * 90 + byRoute.B * 120, 1e-6);
  });

  it('3.8: ohne Strecke kein Direktangebot (Fehler)', () => {
    assert.throws(() => directOffer([], MARKET_FARE));
  });
});

describe('Abschnitt 3.9 Anziehung', () => {
  it('3.9.0: Bezugsangebot hat Anziehung 1, jeder Faktor ist 1', () => {
    const parts = offerAppealParts('economy', REFERENCE);
    for (const [name, value] of Object.entries(parts)) assertClose(value, 1, 1e-12, `${name} = ${value}`);
    for (const cabinClass of CABIN_CLASSES) {
      assertClose(offerAppeal(cabinClass, { ...REFERENCE, fare: MARKET_FARE[cabinClass], marketFare: MARKET_FARE[cabinClass] }), 1);
    }
  });

  it('3.9: besser bieten senkt die Anziehung nie', () => {
    const base = offerAppeal('economy', REFERENCE);
    assert.ok(offerAppeal('economy', { ...REFERENCE, frequency: 14 }) > base);
    assert.ok(offerAppeal('economy', { ...REFERENCE, fare: 90 }) > base);
    assert.ok(offerAppeal('economy', { ...REFERENCE, satisfactionFactor: 1.2 }) > base);
    assert.ok(offerAppeal('economy', { ...REFERENCE, blockMinutes: 100 }) > base);
    assert.ok(offerAppeal('economy', { ...REFERENCE, reputation: 70 }) > base);
  });

  it('2.10: ein Angebot mit höherer Satisfaction ist bei gleichem Preis nie weniger anziehend', () => {
    for (const cabinClass of CABIN_CLASSES) {
      for (const fare of [0.5, 1, 1.5].map((f) => f * MARKET_FARE[cabinClass])) {
        let previous = -Infinity;
        for (let s = 0; s <= 160; s += 0.5) {
          const appeal = offerAppeal(cabinClass, {
            ...REFERENCE, fare, marketFare: MARKET_FARE[cabinClass], satisfactionFactor: satisfactionFactor(s),
          });
          assert.ok(appeal >= previous, `${cabinClass}, Preis ${fare}, Satisfaction ${s}`);
          previous = appeal;
        }
      }
    }
  });

  it('2.10: Satisfaction s und Preis p ziehen an wie Satisfaction 100 und Preis p / satisfactionFactor(s)', () => {
    for (const s of [0, 50, 80, 100, 130, 160]) {
      const withSatisfaction = offerAppeal('business', {
        ...REFERENCE, fare: 1200, marketFare: MARKET_FARE.business, satisfactionFactor: satisfactionFactor(s),
      });
      const atHundred = offerAppeal('business', {
        ...REFERENCE, fare: 1200 / satisfactionFactor(s), marketFare: MARKET_FARE.business, satisfactionFactor: satisfactionFactor(100),
      });
      assertClose(withSatisfaction, atHundred, 1e-12);
    }
  });

  it('3.9: gleiche Eingaben → gleiche Anziehung für Spieler und KI (Spieler-Faktoren neutral)', () => {
    const player = offerAppeal('business', { ...REFERENCE, reputation: 63, frequency: 10, difficultyFactor: difficultyFactor('Normal') });
    const rival = offerAppeal('business', { ...REFERENCE, reputation: 63, frequency: 10 });
    assert.equal(player, rival);
  });

  it('3.9: Anziehung ist das Produkt aller Faktoren', () => {
    const input: OfferAppealInput = {
      ...REFERENCE, frequency: 21, fare: 110, satisfactionFactor: 1.1, blockMinutes: 130, reputation: 80, ageMonths: 40,
      advertisingFactor: 1.1, frequentFlyerFactor: 1.08, researchDemandFactor: 1.05, crisisResponseFactor: 1.03,
      difficultyFactor: 0.9, connectionFactor: 0.4,
    };
    const parts = offerAppealParts('premium', input);
    const product =
      parts.frequencyFactor * parts.priceFactor * parts.flightTimeFactor * parts.reputationFactor *
      parts.establishedRouteBonus * parts.advertisingFactor * parts.frequentFlyerFactor * parts.researchDemandFactor *
      parts.crisisResponseFactor * parts.difficultyFactor * parts.connectionFactor;
    assertClose(parts.appeal, product, 1e-12);
  });

  it('3.9.1: täglich (7 je Richtung) = 1; Wurzel der Abflüge', () => {
    assert.equal(frequencyFactor(7), 1);
    assertClose(frequencyFactor(28), 2);
  });

  it('3.9.1: dieselben Abflüge auf eine oder mehrere Strecken → dieselben Abflüge je Richtung (W2)', () => {
    const one = directOffer([{ id: 'x', seatsPerFlight: { economy: 150 }, departuresPerWeek: 14, blockMinutes: 90 }], MARKET_FARE);
    const two = directOffer([
      { id: 'x', seatsPerFlight: { economy: 150 }, departuresPerWeek: 7, blockMinutes: 90 },
      { id: 'y', seatsPerFlight: { economy: 150 }, departuresPerWeek: 7, blockMinutes: 90 },
    ], MARKET_FARE);
    assert.equal(one.frequency, two.frequency);
    assert.equal(one.seats.economy, two.seats.economy);
  });

  it('3.9.2: Preis = Marktpreis × satisfactionFactor ergibt Faktor 1 (2.10)', () => {
    assertClose(priceFactor('economy', 120, 100, 1.2), 1);
    // Satisfaction s und Preis p ziehen an wie Satisfaction 100 und Preis p / satisfactionFactor.
    assertClose(priceFactor('first', 500, 400, 1.25), priceFactor('first', 400, 400, 1));
  });

  it('3.9.2: Bezugsangebot allein, Sitze reichen: erlösbester Preis = marketFare × satisfactionFactor (± 1 %)', () => {
    for (const cabinClass of CABIN_CLASSES) {
      assertClose(bestFareAlone(cabinClass, 1), 100, 1, cabinClass);
      assertClose(bestFareAlone(cabinClass, 1, 1.2085), 120.85, 1.2085, `${cabinClass}, Satisfaction 130`);
    }
  });

  it('3.9.2: allein bringen 10 % billiger und 10 % teurer weniger Erlös', () => {
    const revenue = (fare: number) => alone(priceFactor('economy', fare, 100, 1)) * fare;
    assert.ok(revenue(90) < revenue(100));
    assert.ok(revenue(110) < revenue(100));
  });

  it('3.9.2: gegen einen gleichen Rivalen bringt 10 % billiger mehr Erlös', () => {
    const revenue = (fare: number) =>
      split([
        { id: 'p', appeal: priceFactor('economy', fare, 100, 1), seats: Infinity },
        { id: 'r', appeal: 1, seats: Infinity },
      ]).passengers.p * fare;
    assert.ok(revenue(90) > revenue(100));
  });

  it('3.9.2: mehr übrige Anziehung (14 Abflüge) hebt den erlösbesten Preis um (Anziehung)^(1 / PRICE_SENSITIVITY)', () => {
    const expected = 100 * frequencyFactor(14) ** (1 / PRICE_SENSITIVITY.economy);
    assertClose(expected, 117.06, 0.01);
    assertClose(bestFareAlone('economy', frequencyFactor(14)), expected, 1);
  });

  it('3.9.3: halbe Flugzeit = 2 ^ FLIGHT_TIME_EXP; kürzer senkt nie', () => {
    assertClose(flightTimeFactor(60, 120), 2 ** FLIGHT_TIME_EXP);
    assertClose(flightTimeFactor(132, 120), 1 / 1.1);
    let previous = Number.POSITIVE_INFINITY;
    for (let minutes = 30; minutes <= 900; minutes += 10) {
      const factor = flightTimeFactor(minutes, 300);
      assert.ok(factor <= previous);
      previous = factor;
    }
  });

  it('3.9.4: Ruf 50 = 1, Ruf 0 = 0,9, Ruf 100 = 1,1', () => {
    assert.equal(reputationFactor(50), 1);
    assertClose(reputationFactor(0), 0.9);
    assertClose(reputationFactor(100), 1.1);
  });

  it('3.9.4: Frequent flyer: aus = 1, erster Monat 1,05, +0,01 je Monat, höchstens 1,20', () => {
    assert.equal(frequentFlyerFactor(0), 1);
    assertClose(frequentFlyerFactor(1), 1.05);
    assertClose(frequentFlyerFactor(6), 1.1);
    assertClose(frequentFlyerFactor(16), 1.2);
    assertClose(frequentFlyerFactor(40), 1.2);
  });

  it('3.9.5: Werbung: ohne Kampagne 1, Summe der Kampagnen, höchstens ADVERTISING_MAX, Mittel beider Enden', () => {
    assert.equal(advertisingRegionFactor([]), 1);
    assertClose(advertisingRegionFactor(['local', 'national']), 1.15);
    assert.equal(advertisingRegionFactor(['global', 'national', 'local']), ADVERTISING_MAX);
    assertClose(advertisingFactor(advertisingRegionFactor(['national']), advertisingRegionFactor([])), 1.05);
  });

  it('3.9.6: Established route bonus 1 bis 24 Monate, dann linear bis 1,05 bei 48', () => {
    assert.equal(establishedRouteBonus(0), 1);
    assert.equal(establishedRouteBonus(24), 1);
    assertClose(establishedRouteBonus(36), 1.025);
    assertClose(establishedRouteBonus(48), 1.05);
    assertClose(establishedRouteBonus(200), 1.05);
  });
});

describe('Abschnitt 3.10 Nicht fliegen und Potenzial', () => {
  it('3.10: noFlyAppeal = 1 / (PRICE_SENSITIVITY − 1): 0,83 · 1,0 · 1,25 · 1,43', () => {
    assertClose(noFlyAppeal('economy'), 0.8333, 1e-4);
    assertClose(noFlyAppeal('premium'), 1);
    assertClose(noFlyAppeal('business'), 1.25);
    assertClose(noFlyAppeal('first'), 1.4286, 1e-4);
  });

  it('3.10: Bezugsangebot allein, Sitze reichen → Fluggäste = marketSize × classShare', () => {
    for (const cabinClass of CABIN_CLASSES) {
      const potential = classPotential(cabinClass, 2400, 0.25);
      assertClose(split([{ id: 'p', appeal: 1, seats: Infinity }], potential, cabinClass).passengers.p, 600, 1e-9, cabinClass);
    }
  });
});

describe('Abschnitt 3.11 Aufteilung', () => {
  const random = seeded(311);
  const randomMarket = () => {
    const count = 1 + Math.floor(random() * 5);
    const offers: SplitOffer[] = [];
    for (let i = 0; i < count; i++) {
      offers.push({
        id: `o${i}`,
        appeal: 0.2 + 2 * random(),
        seats: random() < 0.2 ? Infinity : 50 + 900 * random(),
        ramp: random() < 0.3 ? 0.6 + 0.4 * random() : 1,
      });
    }
    return { offers, potential: 500 + 3000 * random() };
  };

  it('3.11: Summe aller Fluggäste ≤ Potenzial; kein Angebot über seinen Sitzen (300 Zufallsmärkte)', () => {
    for (let n = 0; n < 300; n++) {
      const { offers, potential } = randomMarket();
      const result = split(offers, potential);
      const total = Object.values(result.passengers).reduce((a, b) => a + b, 0);
      assert.ok(total <= potential + 1e-9);
      assertClose(total + result.notFlying, potential, 1e-6);
      for (const offer of offers) assert.ok(result.passengers[offer.id] <= offer.seats + 1e-9);
    }
  });

  it('3.11: Anteile vor Anlauf und Sitz-Grenze (mit „Nicht fliegen“) ergeben genau 1 (W3, W10)', () => {
    for (let n = 0; n < 100; n++) {
      const { offers, potential } = randomMarket();
      const result = split(offers, potential);
      const sum = Object.values(result.choiceShare).reduce((a, b) => a + b, 0) + result.noFlyShare;
      assertClose(sum, 1, 1e-12);
    }
  });

  it('3.11: gleiche Abflüge auf eine oder mehrere eigene Strecken → gleiche Fluggäste (W2)', () => {
    const appealOf = (routes: Parameters<typeof directOffer>[0]) => {
      const offer = directOffer(routes, MARKET_FARE);
      return {
        appeal: offerAppeal('economy', { ...REFERENCE, frequency: offer.frequency, fare: offer.fare.economy, blockMinutes: offer.blockMinutes }),
        seats: offer.seats.economy,
      };
    };
    const one = appealOf([{ id: 'x', seatsPerFlight: { economy: 30 }, departuresPerWeek: 14, blockMinutes: 120 }]);
    const two = appealOf([
      { id: 'x', seatsPerFlight: { economy: 30 }, departuresPerWeek: 7, blockMinutes: 120 },
      { id: 'y', seatsPerFlight: { economy: 30 }, departuresPerWeek: 7, blockMinutes: 120 },
    ]);
    const rival: SplitOffer = { id: 'r', appeal: 1.3, seats: 2000 };
    const a = split([{ id: 'p', ...one }, rival]);
    const b = split([{ id: 'p', ...two }, rival]);
    assertClose(a.passengers.p, b.passengers.p);
    assertClose(a.passengers.r, b.passengers.r);
  });

  it('3.11: ein weiteres Angebot senkt die Fluggäste der anderen nie über das hinaus, was es selbst bekommt', () => {
    for (let n = 0; n < 300; n++) {
      const { offers, potential } = randomMarket();
      const extra: SplitOffer = { id: 'extra', appeal: 0.2 + 2 * random(), seats: 50 + 900 * random() };
      const before = split(offers, potential);
      const after = split([...offers, extra], potential);
      const othersBefore = offers.reduce((sum, o) => sum + before.passengers[o.id], 0);
      const othersAfter = offers.reduce((sum, o) => sum + after.passengers[o.id], 0);
      assert.ok(othersBefore - othersAfter <= after.passengers.extra + 1e-9);
      for (const offer of offers) assert.ok(after.passengers[offer.id] <= before.passengers[offer.id] + 1e-9);
    }
  });

  it('3.11: Spieler und KI bekommen bei gleichen Eingaben gleich viele Fluggäste (Normal)', () => {
    const appeal = offerAppeal('economy', { ...REFERENCE, frequency: 10, reputation: 55 });
    const player = offerAppeal('economy', { ...REFERENCE, frequency: 10, reputation: 55, difficultyFactor: difficultyFactor('Normal') });
    const result = split([{ id: 'player', appeal: player, seats: 900 }, { id: 'rival', appeal, seats: 900 }]);
    assertClose(result.passengers.player, result.passengers.rival);
  });

  it('3.11: Ergebnis hängt nicht von der Reihenfolge der Angebote ab', () => {
    for (let n = 0; n < 100; n++) {
      const { offers, potential } = randomMarket();
      const forward = split(offers, potential);
      const backward = split([...offers].reverse(), potential);
      for (const offer of offers) assertClose(forward.passengers[offer.id], backward.passengers[offer.id], 1e-9);
      assert.deepEqual(forward.full, backward.full);
    }
  });

  it('3.11: ein voller Rivale gibt Gäste an Angebote mit freien Sitzen ab, nie an volle', () => {
    const offers: SplitOffer[] = [
      { id: 'player', appeal: 1, seats: Infinity },
      { id: 'fullOther', appeal: 1, seats: 100 },
      { id: 'rival', appeal: 1, seats: 300 },
    ];
    const withLimit = split(offers);
    const unlimited = split(offers.map((o) => ({ ...o, seats: Infinity })));
    assert.deepEqual(withLimit.full, ['fullOther', 'rival']);
    assert.equal(withLimit.passengers.fullOther, 100);
    assert.equal(withLimit.passengers.rival, 300);
    assert.ok(withLimit.passengers.player > unlimited.passengers.player);
  });

  it('3.11: Überlauf wie Beispiel 3.15: 80 von 147 übergelaufenen Gästen', () => {
    const result = split([{ id: 'p', appeal: 1, seats: Infinity }, { id: 'r', appeal: 1, seats: 500 }]);
    const overflow = result.wish.r - 500;
    assertClose(overflow, 147.06, 0.01);
    assertClose(result.passengers.p - result.wish.p, overflow * (1 / (1 + NO_FLY)), 1e-9);
  });

  it('3.7/3.11: ein Angebot ohne Sitze in der Klasse nimmt nicht teil', () => {
    const result = split([{ id: 'p', appeal: 1, seats: Infinity }, { id: 'none', appeal: 5, seats: 0 }]);
    assert.equal(result.passengers.none, 0);
    assert.equal(result.choiceShare.none, undefined);
    assertClose(result.passengers.p, 1000);
  });

  it('3.11: doppelte Angebots-Id ist ein Fehler', () => {
    assert.throws(() => split([{ id: 'p', appeal: 1, seats: 10 }, { id: 'p', appeal: 1, seats: 10 }]));
  });

  it('3.11 Schritt 4: nach Sitzen in der Klasse auf Strecken verteilt; jede Strecke dieselbe Auslastung', () => {
    const byRoute = distributeToRoutes(600, { a: 700, b: 300, c: 0 });
    assertClose(byRoute.a, 420);
    assertClose(byRoute.b, 180);
    assert.equal(byRoute.c, 0);
    assertClose(byRoute.a / 700, byRoute.b / 300);
    assert.deepEqual(distributeToRoutes(10, {}), {});
  });
});

describe('Abschnitt 3.12 Anlauf', () => {
  it('3.12: erster Monat RAMP_START, ab RAMP_MONTHS genau 1, steigt nie mit weniger Alter', () => {
    assert.equal(rampFactor(0), RAMP_START);
    assert.equal(rampFactor(RAMP_MONTHS), 1);
    assert.equal(rampFactor(100), 1);
    let previous = 0;
    for (let age = 0; age <= 12; age += 0.5) {
      const factor = rampFactor(age);
      assert.ok(factor >= previous);
      previous = factor;
    }
  });

  it('3.12: mit „Route planning suite“ Start bei RAMP_START + RAMP_RESEARCH_BONUS (0,75)', () => {
    assertClose(rampFactor(0, RAMP_RESEARCH_BONUS), 0.75);
    assert.equal(rampFactor(RAMP_MONTHS, RAMP_RESEARCH_BONUS), 1);
  });

  it('3.12: Anlauf nach der Wahl: erlösbester Preis bleibt gleich, Rivalen gewinnen nicht dazu', () => {
    const revenueAt = (fare: number) => alone(priceFactor('economy', fare, 100, 1), rampFactor(0)) * fare;
    assert.ok(revenueAt(100) > revenueAt(99) && revenueAt(100) > revenueAt(101));
    const ramping = split([{ id: 'p', appeal: 1, seats: Infinity, ramp: 0.6 }, { id: 'r', appeal: 1, seats: Infinity }]);
    const full = split([{ id: 'p', appeal: 1, seats: Infinity }, { id: 'r', appeal: 1, seats: Infinity }]);
    assertClose(ramping.passengers.r, full.passengers.r);
    assertClose(ramping.passengers.p, 0.6 * full.passengers.p);
  });
});

describe('Abschnitt 3.14 Passenger share und Departure share', () => {
  it('3.14: Anteile aller Gesellschaften eines Paars ergeben zusammen 1; ohne Fluggäste 0', () => {
    const passengers = [320, 1100, 45.5];
    const all = passengers.reduce((a, b) => a + b, 0);
    assertClose(passengers.reduce((sum, p) => sum + passengerShare(p, all), 0), 1);
    const departures = [14, 21, 7];
    const allDepartures = departures.reduce((a, b) => a + b, 0);
    assertClose(departures.reduce((sum, d) => sum + departureShare(d, allDepartures), 0), 1);
    assert.equal(passengerShare(0, 0), 0);
    assert.equal(departureShare(0, 0), 0);
  });
});

describe('Abschnitt 3.15 Beispiel', () => {
  // Economy, Marktgröße × Klassen-Anteil = 1 000, Marktpreis 100 $, PRICE_SENSITIVITY 2,2.
  const price = (fare: number, satisfaction = 1) => priceFactor('economy', fare, 100, satisfaction);
  const cases: readonly [string, number, number, number][] = [
    // Fall, Fluggäste, Preis, Erlös
    ['Bezugsangebot allein, 100 $', alone(1), 100, 100_000],
    ['allein, 90 $', alone(price(90)), 90, 99_342],
    ['allein, 110 $', alone(price(110)), 110, 99_454],
    ['allein, Satisfaction 130, 100 $', alone(price(100, 1.2085)), 100, 118_327],
    ['allein, Satisfaction 130, 120,85 $', alone(price(120.85, 1.2085)), 120.85, 120_850],
    ['allein, 14 Abflüge je Richtung', alone(frequencyFactor(14)), 100, 115_358],
    ['allein, 10 % längere Flugzeit', alone(flightTimeFactor(1.1, 1)), 100, 95_652],
    ['allein, erster Monat (Anlauf 0,6)', alone(1, rampFactor(0)), 100, 60_000],
  ];
  for (const [name, passengers, fare, revenue] of cases) {
    it(`3.15: ${name} → Erlös ${revenue} $`, () => {
      assertClose(passengers * fare, revenue, 1);
    });
  }

  it('3.15: mit gleichem Rivalen, beide 100 $ → je 647, Markt wächst auf 1 294', () => {
    const result = split([{ id: 'p', appeal: 1, seats: Infinity }, { id: 'r', appeal: 1, seats: Infinity }]);
    assertClose(result.passengers.p, 647.06, 0.01);
    assertClose(result.passengers.r, 647.06, 0.01);
    assertClose(result.passengers.p * 100, 64_706, 1);
  });

  it('3.15: mit gleichem Rivalen, Spieler 90 $ → 747 (Rivale 593), Erlös 67 236 $', () => {
    const result = split([{ id: 'p', appeal: price(90), seats: Infinity }, { id: 'r', appeal: 1, seats: Infinity }]);
    assertClose(result.passengers.p, 747.07, 0.01);
    assertClose(result.passengers.r, 592.51, 0.01);
    assertClose(result.passengers.p * 90, 67_236, 1);
  });

  it('3.15: mit gleichem Rivalen, Rivale nur 500 Sitze → 727 (Rivale 500), Erlös 72 727 $', () => {
    const result = split([{ id: 'p', appeal: 1, seats: Infinity }, { id: 'r', appeal: 1, seats: 500 }]);
    assertClose(result.passengers.p, 727.27, 0.01);
    assert.equal(result.passengers.r, 500);
    assertClose(result.passengers.p * 100, 72_727, 1);
  });
});
