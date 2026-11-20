/**
 * Regeltests zu SPEZIFIKATION Abschnitt 4 (Preis und Erlös) und dem Beispiel 4.13.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { costIndex } from './basics';
import {
  CABIN_CLASSES,
  FARE_RATIO_MAX,
  FARE_RATIO_MIN,
  REFERENCE_SPEED,
  START_YEAR,
  WEEKS_PER_MONTH,
  type CabinClass,
} from './constants';
import { blockMinutes, distanceKm, type Coords } from './demand';
import {
  baseFareEconomy,
  bestFare,
  bestFareRatio,
  breakEvenFareLevel,
  classFareRatio,
  clampFareRatio,
  fareRatioFromInput,
  fareRatioOrDefault,
  fareVsMarket,
  fullAircraftRevenue,
  loadFactor,
  marketFare,
  marketFares,
  monthlyRevenue,
  routeClassPassengers,
  routeFare,
  routeFares,
  routeRevenue,
  routeRevenueParts,
  fareTimeFactor,
  transferRevenueShare,
  uniformFareRatios,
  type RouteClassMarket,
} from './fare';
import { classPotential, directOffer, distributeToRoutes } from './marketSplit';
import { satisfactionFactor } from './satisfaction';
import { transferFare } from './transfers';

function assertClose(actual: number, expected: number, tolerance = 1e-9, message?: string) {
  assert.ok(Math.abs(actual - expected) <= tolerance, message ?? `${actual} ≉ ${expected}`);
}

const monthAt = (year: number, monthOfYear = 0) => (year - START_YEAR) * 12 + monthOfYear;

const PARIS: Coords = [49.01, 2.55];
const FRANKFURT: Coords = [50.03, 8.57];
const NEW_YORK: Coords = [40.64, -73.78];

/** Economy-Markt wie Beispiel 3.15 / 4.13: Marktgröße × Klassen-Anteil 1 000, Marktpreis 100 $. */
const MARKET_FARES: Record<CabinClass, number> = { economy: 100, premium: 130, business: 200, first: 300 };
const REF_MINUTES = 120;

/** Bezugsangebot (täglich je Richtung, Bezugs-Flugzeit) mit `weeklySeats` Economy-Sitzen. */
function referenceMarket(
  weeklySeats = 1e6,
  overrides: Partial<RouteClassMarket> = {},
): RouteClassMarket {
  return {
    cabinClass: 'economy',
    potential: classPotential('economy', 1000, 1),
    marketFares: MARKET_FARES,
    ownRoutes: [{ id: 'r', seatsPerFlight: { economy: weeklySeats / 14 }, departuresPerWeek: 14, blockMinutes: REF_MINUTES }],
    routeId: 'r',
    appeal: { referenceBlockMinutes: REF_MINUTES },
    otherOffers: [],
    ...overrides,
  };
}

const EQUAL_RIVAL = [{ id: 'rival', appeal: 1, seats: Infinity }];

// ---------------------------------------------------------------------------

describe('Abschnitt 4.1 Grundpreis Economy', () => {
  it('4.1: längere Entfernung → nie billiger', () => {
    let previous = 0;
    for (let km = 50; km <= 20000; km += 10) {
      const fare = baseFareEconomy(km, blockMinutes(km, REFERENCE_SPEED));
      assert.ok(fare >= previous - 1e-9, `${km} km: ${fare} < ${previous}`);
      previous = fare;
    }
  });

  it('4.1: Preis je km fällt mit der Entfernung (nie steigend)', () => {
    let previous = Infinity;
    for (let km = 50; km <= 20000; km += 10) {
      const perKm = baseFareEconomy(km, blockMinutes(km, REFERENCE_SPEED)) / km;
      assert.ok(perKm <= previous + 1e-12, `${km} km`);
      previous = perKm;
    }
  });

  it('4.1: 1 Minute mehr Bezugs-Flugzeit ändert den Preis stetig (kein Sprung)', () => {
    for (let minutes = 20; minutes <= 900; minutes += 1) {
      const step = Math.abs(baseFareEconomy(1000, minutes + 1) - baseFareEconomy(1000, minutes));
      assert.ok(step < 0.25, `${minutes} min: Sprung ${step}`);
    }
  });

  it('4.1: Preis-Faktor je Flugzeit-Index als gerade Linie zwischen den Tabellenwerten', () => {
    assertClose(fareTimeFactor(1), 1.04);
    assertClose(fareTimeFactor(4.5), 0.79);
    assertClose(fareTimeFactor(8), 0.5);
    assertClose(fareTimeFactor(0), 1.04);
    assertClose(fareTimeFactor(12), 0.5);
  });

  it('4.1: ungültige Eingabe wird nicht versteckt (F2)', () => {
    assert.ok(Number.isNaN(baseFareEconomy(Number.NaN, 100)));
  });
});

describe('Abschnitt 4.2 Klassen-Verhältnis', () => {
  it('4.2: Economy = 1 ≤ Premium ≤ Business ≤ First bei jeder Flugzeit', () => {
    for (let minutes = 0; minutes <= 1000; minutes += 5) {
      const ratios = CABIN_CLASSES.map((c) => classFareRatio(c, minutes));
      assert.equal(ratios[0], 1);
      for (let i = 1; i < ratios.length; i++) assert.ok(ratios[i] >= ratios[i - 1], `${minutes} min`);
    }
  });

  it('4.2: steigt nie mit kürzerer Flugzeit', () => {
    for (const c of CABIN_CLASSES) {
      for (let minutes = 0; minutes < 1000; minutes += 5) {
        assert.ok(classFareRatio(c, minutes + 5) >= classFareRatio(c, minutes) - 1e-12, `${c} ${minutes} min`);
      }
    }
  });

  it('4.2: Grenzwerte wie Spezifikation (Index 1 und 8)', () => {
    assertClose(classFareRatio('premium', 30), 1.3);
    assertClose(classFareRatio('business', 30), 2.0);
    assertClose(classFareRatio('first', 30), 3.0);
    assertClose(classFareRatio('premium', 810), 2.35);
    assertClose(classFareRatio('business', 810), 3.75);
    assertClose(classFareRatio('first', 810), 6.5);
  });

  it('4.2 (W2): fare.ts enthält keine festen Zahlen außer 0 und 1 (keine Klassen-Gewichte 1,6 / 3 / 5)', () => {
    const source = readFileSync(new URL('./fare.ts', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/'[^']*'|`[^`]*`/g, '');
    const numbers = source.match(/\b\d+(\.\d+)?\b/g) ?? [];
    assert.deepEqual(
      numbers.filter((n) => n !== '0' && n !== '1'),
      [],
    );
  });
});

describe('Abschnitt 4.3 Marktpreis', () => {
  it('4.3: unabhängig von der Reihenfolge A, B des Paars', () => {
    for (const c of CABIN_CLASSES) {
      assertClose(
        marketFare(c, distanceKm(FRANKFURT, NEW_YORK), 300),
        marketFare(c, distanceKm(NEW_YORK, FRANKFURT), 300),
      );
    }
  });

  it('4.3: marketFare 2020 = marketFare 1960 × costIndex 2020', () => {
    for (const c of CABIN_CLASSES) {
      assertClose(marketFare(c, 1420, monthAt(2020)), marketFare(c, 1420, 0) * costIndex(monthAt(2020)), 1e-9);
    }
  });

  it('4.3: = Grundpreis × Klassen-Verhältnis mit der Bezugs-Flugzeit (gleich für alle Angebote)', () => {
    const km = distanceKm(PARIS, NEW_YORK);
    const reference = blockMinutes(km, REFERENCE_SPEED);
    for (const c of CABIN_CLASSES) {
      assertClose(marketFare(c, km, 0), baseFareEconomy(km, reference) * classFareRatio(c, reference));
    }
    assert.deepEqual(marketFares(km, 0), Object.fromEntries(CABIN_CLASSES.map((c) => [c, marketFare(c, km, 0)])));
  });

  it('4.3, 4.4: mehr eigene Sitze, andere Satisfaction oder Fluggäste ändern den Marktpreis nicht', () => {
    // Der Marktpreis hat nur Entfernung und Monat als Eingabe; die Aufteilung liest ihn nur.
    assert.equal(marketFare.length, 3);
    const market = referenceMarket(800);
    const before = { ...market.marketFares };
    routeClassPassengers(market, 1.2);
    bestFare(market);
    assert.deepEqual(market.marketFares, before);
  });
});

describe('Abschnitt 4.5 Preis einer Strecke', () => {
  it('4.5 (R8): fehlender Preis = Marktpreis, an einer Stelle', () => {
    assert.equal(fareRatioOrDefault(undefined), 1);
    assert.equal(routeFare(undefined, 123), 123);
    const fares = routeFares({ business: 1.5 }, MARKET_FARES);
    assert.equal(fares.economy, MARKET_FARES.economy);
    assert.equal(fares.business, 1.5 * MARKET_FARES.business);
  });

  it('4.5: routeFare > 0 für jedes zulässige Preisniveau', () => {
    for (let r = FARE_RATIO_MIN; r <= FARE_RATIO_MAX; r += 0.05) assert.ok(routeFare(r, 0.01) > 0);
  });

  it('4.5 (E56): gleiches fareRatio → gleicher Abstand zum Marktpreis in jedem Jahr', () => {
    for (const year of [1960, 1990, 2020, 2050]) {
      const market = marketFare('economy', 1420, monthAt(year));
      assertClose(routeFare(1.1, market) / market - 1, 0.1, 1e-12);
    }
  });

  it('4.5: Eingabe in $ → Preisniveau, einmal begrenzt auf 0,25 … 4', () => {
    assertClose(fareRatioFromInput(110, 100), 1.1);
    assert.equal(fareRatioFromInput(1, 100), FARE_RATIO_MIN);
    assert.equal(fareRatioFromInput(1000, 100), FARE_RATIO_MAX);
    assert.equal(clampFareRatio(2), 2);
    assertClose(fareVsMarket(1.1), 0.1);
  });

  it('4.5: „Adjust All“ setzt ein Preisniveau für alle Klassen; Startpreis = Marktpreis', () => {
    assert.deepEqual(uniformFareRatios(), { economy: 1, premium: 1, business: 1, first: 1 });
    const ratios = uniformFareRatios(0.9);
    const fares = routeFares(ratios, MARKET_FARES);
    for (const c of CABIN_CLASSES) assertClose(fares[c], 0.9 * MARKET_FARES[c]);
    assert.equal(uniformFareRatios(10).first, FARE_RATIO_MAX);
  });
});

describe('Abschnitt 4.6 KI-Preise', () => {
  it('4.6 (R7): Spieler und KI mit gleichem fareRatio auf demselben Paar zahlen denselben Preis', () => {
    const km = distanceKm(FRANKFURT, PARIS);
    const month = monthAt(1985, 4);
    const player = routeFares({ economy: 0.95, business: 1.2 }, marketFares(km, month));
    const rival = routeFares({ economy: 0.95, business: 1.2 }, marketFares(km, month));
    assert.deepEqual(player, rival);
  });
});

describe('Abschnitt 4.7 Erlös je Strecke', () => {
  it('4.7: Erlös = 0 ohne Fluggäste', () => {
    assert.equal(routeRevenue({ directPassengers: {}, fares: MARKET_FARES }), 0);
  });

  it('4.7: Direktgäste × Preis je Klasse plus Umsteiger, getrennt ausgewiesen', () => {
    const parts = routeRevenueParts({
      directPassengers: { economy: 500, business: 20 },
      fares: MARKET_FARES,
      transfers: [
        { cabinClass: 'economy', passengers: 30, revenuePerPassenger: 44 },
        { cabinClass: 'economy', passengers: 10, revenuePerPassenger: 50 },
      ],
    });
    assert.equal(parts.direct.economy, 50000);
    assert.equal(parts.direct.business, 4000);
    assert.equal(parts.direct.first, 0);
    assert.equal(parts.transfer.economy, 30 * 44 + 10 * 50);
    assert.equal(parts.total, 50000 + 4000 + 1820);
  });

  it('4.7: höherer eigener Preis bei unveränderten Fluggästen → nie weniger Erlös', () => {
    const pax = { economy: 700, premium: 40 };
    let previous = -Infinity;
    for (let r = FARE_RATIO_MIN; r <= FARE_RATIO_MAX; r += 0.1) {
      const revenue = routeRevenue({ directPassengers: pax, fares: routeFares(uniformFareRatios(r), MARKET_FARES) });
      assert.ok(revenue >= previous);
      previous = revenue;
    }
  });

  it('4.7: mehrere Strecken auf einem Paar: Σ Strecken = Fluggäste des Angebots × offerFare', () => {
    const routes = [
      { id: 'a', seatsPerFlight: { economy: 150 }, departuresPerWeek: 14, fare: { economy: 90 }, blockMinutes: 100 },
      { id: 'b', seatsPerFlight: { economy: 50 }, departuresPerWeek: 7, fare: { economy: 120 }, blockMinutes: 110 },
    ];
    const offer = directOffer(routes, MARKET_FARES);
    const offerPassengers = 1800;
    const perRoute = distributeToRoutes(offerPassengers, { a: 150 * 14, b: 50 * 7 });
    const sum =
      routeRevenue({ directPassengers: { economy: perRoute.a }, fares: { ...MARKET_FARES, economy: 90 } }) +
      routeRevenue({ directPassengers: { economy: perRoute.b }, fares: { ...MARKET_FARES, economy: 120 } });
    assertClose(sum, offerPassengers * offer.fare.economy, 1e-6);
  });
});

describe('Abschnitt 4.8 Umsteiger-Tarif und Aufteilung', () => {
  it('4.8: transferFare (3.13) = TRANSFER_FARE_SHARE × marketFare Start–Ziel', () => {
    assertClose(transferFare(marketFare('economy', 5000, 0)), 0.9 * marketFare('economy', 5000, 0));
  });

  it('4.8: Summe der Anteile = Tarif; jeder Anteil 0 … Tarif; längere Teilstrecke nie weniger', () => {
    for (const [kmA, kmB] of [
      [449, 6189],
      [1000, 1000],
      [3000, 300],
      [12000, 9000],
    ]) {
      const fareA = marketFare('business', kmA, 0);
      const fareB = marketFare('business', kmB, 0);
      const tariff = transferFare(marketFare('business', kmA + kmB, 0));
      const shares = transferRevenueShare(tariff, fareA, fareB);
      assertClose(shares.originHub + shares.hubDestination, tariff, 1e-9);
      for (const share of [shares.originHub, shares.hubDestination]) assert.ok(share >= 0 && share <= tariff);
      if (kmA > kmB) assert.ok(shares.originHub >= shares.hubDestination);
      if (kmB > kmA) assert.ok(shares.hubDestination >= shares.originHub);
    }
  });

  it('4.8, 4.13: Paris–New York über Frankfurt, Economy', () => {
    const od = marketFare('economy', distanceKm(PARIS, NEW_YORK), 0);
    const tariff = transferFare(od);
    assertClose(od, 189, 0.5);
    assertClose(tariff, 170, 0.5);
    const shares = transferRevenueShare(
      tariff,
      marketFare('economy', distanceKm(PARIS, FRANKFURT), 0),
      marketFare('economy', distanceKm(FRANKFURT, NEW_YORK), 0),
    );
    assertClose(shares.originHub / tariff, 0.22, 0.005);
    assertClose(shares.originHub, 37, 0.5);
    assertClose(shares.hubDestination, 133, 0.5);
  });
});

describe('Abschnitt 4.9 Monatserlös', () => {
  it('4.9: Monatserlös = Σ Wochenerlös × WEEKS_PER_MONTH', () => {
    assertClose(monthlyRevenue([1000, 2500]), 3500 * WEEKS_PER_MONTH);
  });

  it('4.9: 12 Monate gleicher Wochenerlös = Wochenerlös × 52,18', () => {
    // 52,18 ist gerundet: 12 × 365,25 / 12 / 7 = 52,1786.
    assertClose(12 * monthlyRevenue([1000]), 1000 * 52.18, 2);
  });
});

describe('Abschnitt 4.10 Bester Preis', () => {
  it('4.10 (E24): Bezugsangebot allein, Sitze reichen, keine Kosten → bester Preis = Marktpreis', () => {
    const best = bestFare(referenceMarket());
    assertClose(best.fare, 100, 0.5);
    assertClose(best.passengers, 1000, 1e-6);
  });

  it('4.10: allein mit Satisfaction s → bester Preis = Marktpreis × satisfactionFactor (± 0,5 %)', () => {
    for (const s of [40, 80, 130, 160]) {
      const factor = satisfactionFactor(s);
      const best = bestFare(referenceMarket(1e6, { appeal: { referenceBlockMinutes: REF_MINUTES, satisfactionFactor: factor } }));
      assertClose(best.fare / (100 * factor), 1, 0.005, `Satisfaction ${s}`);
    }
  });

  it('4.10: Kosten je Fluggast > 0 → bester Preis höher', () => {
    assert.ok(bestFare(referenceMarket(), 20).fare > bestFare(referenceMarket()).fare);
  });

  it('4.10, 4.4: Sitze knapp → bester Preis höher', () => {
    assert.ok(bestFare(referenceMarket(800)).fare > bestFare(referenceMarket()).fare);
  });

  it('4.10: mehr Anziehung aus anderen Gründen (Abflüge, Ruf) → bester Preis höher', () => {
    const base = bestFare(referenceMarket()).fare;
    const reputation = bestFare(referenceMarket(1e6, { appeal: { referenceBlockMinutes: REF_MINUTES, reputation: 90 } }));
    assert.ok(reputation.fare > base);
    const twiceDaily = referenceMarket(1e6, {
      ownRoutes: [{ id: 'r', seatsPerFlight: { economy: 1e6 / 28 }, departuresPerWeek: 28, blockMinutes: REF_MINUTES }],
    });
    assert.ok(bestFare(twiceDaily).fare > base);
  });

  it('4.10: gleich starker Rivale → bester Preis niedriger', () => {
    assert.ok(bestFare(referenceMarket(1e6, { otherOffers: EQUAL_RIVAL })).fare < bestFare(referenceMarket()).fare);
  });

  it('4.10, 4.13: Beispiel-Tabelle', () => {
    const alone = bestFare(referenceMarket());
    assertClose(alone.profit, 100000, 1);

    const scarce = bestFare(referenceMarket(800));
    assertClose(scarce.fare, 122, 0.2);
    assertClose(scarce.passengers, 800, 1);
    assertClose(scarce.profit, 97633, 20);

    const costs = bestFare(referenceMarket(), 20);
    assertClose(costs.fare, 118, 0.5);
    assertClose(costs.passengers, 831, 2);
    assertClose(costs.profit, 81690, 5);

    const rival = bestFare(referenceMarket(1e6, { otherOffers: EQUAL_RIVAL }));
    assertClose(rival.fare, 70, 0.2);
    assertClose(rival.passengers, 1000, 1);
    assertClose(rival.profit, 69880, 5);
  });

  it('4.10: Ergebnis im zulässigen Bereich, auf 0,001 genau; bei Gleichstand der niedrigere Preis', () => {
    const flat = bestFareRatio(() => 0, 100);
    assert.equal(flat, FARE_RATIO_MIN);
    const capped = bestFareRatio((r) => 1000 * r ** -0.5, 100);
    assert.equal(capped, FARE_RATIO_MAX);
    const r = bestFare(referenceMarket(800)).fareRatio;
    assertClose(r * 1000, Math.round(r * 1000), 1e-6);
  });

  it('4.10: nur die gewählte Strecke ändert ihren Preis; Fluggäste nach Sitzen verteilt', () => {
    const market = referenceMarket(1e6, {
      ownRoutes: [
        { id: 'r', seatsPerFlight: { economy: 100 }, departuresPerWeek: 7, blockMinutes: REF_MINUTES },
        { id: 's', seatsPerFlight: { economy: 300 }, departuresPerWeek: 7, fare: { economy: 100 }, blockMinutes: REF_MINUTES },
      ],
    });
    const atMarket = routeClassPassengers(market, 1);
    const dearer = routeClassPassengers(market, 1.5);
    assert.ok(dearer < atMarket);
    // Strecke r hat 1/4 der Sitze des Angebots.
    assert.ok(atMarket > 0);
    assert.throws(() => routeClassPassengers({ ...market, routeId: 'x' }, 1));
  });
});

describe('Abschnitt 4.11 Gewinnschwelle', () => {
  const madrid = marketFares(1420, 0);
  const classes = {
    economy: { seatsPerWeek: 150 * 14, marketFare: madrid.economy, costPerPassenger: 15 },
    business: { seatsPerWeek: 12 * 14, marketFare: madrid.business, costPerPassenger: 15 },
  };

  it('4.11, 4.13: Frankfurt–Madrid bei L = 0,75 → Preisniveau 0,95, Economy 94 $, Business 222 $', () => {
    const level = breakEvenFareLevel(0.75, 150000, classes);
    assertClose(level, 0.95, 0.005);
    assertClose(level * madrid.economy, 94, 0.5);
    assertClose(level * madrid.business, 222, 0.5);
  });

  it('4.11: höhere Auslastung → nie höhere Schwelle', () => {
    let previous = Infinity;
    for (let l = 0.05; l <= 1; l += 0.05) {
      const level = breakEvenFareLevel(l, 150000, classes);
      assert.ok(level <= previous);
      previous = level;
    }
  });

  it('4.11: bei L und Preisniveau = Schwelle ist der Gewinn 0', () => {
    for (const l of [0.4, 0.75, 1]) {
      const level = breakEvenFareLevel(l, 150000, classes);
      let profit = -150000;
      for (const figures of Object.values(classes)) {
        const pax = l * figures.seatsPerWeek;
        profit += pax * (level * figures.marketFare - figures.costPerPassenger);
      }
      assertClose(profit, 0, 1e-6);
    }
  });
});

describe('Abschnitt 4.12 Planer-Zahlen (ohne Kosten)', () => {
  it('4.12: „Full aircraft at market fare“ hängt nicht vom eingestellten Preis ab', () => {
    assert.equal(fullAircraftRevenue({ economy: 2100, business: 168 }, MARKET_FARES), 2100 * 100 + 168 * 200);
  });

  it('4.12: Auslastung = Fluggäste / Sitze, ohne Sitze 0', () => {
    assert.equal(loadFactor(75, 100), 0.75);
    assert.equal(loadFactor(0, 0), 0);
  });
});

describe('Abschnitt 4.13 Beispiel: Grundpreise', () => {
  const rows: [km: number, minutes: number, eco: number, pre: number, bus: number, first: number, eco2020: number][] = [
    [449, 44, 55, 73, 112, 170, 112],
    [1420, 119, 98, 150, 233, 368, 201],
    [6189, 483, 197, 410, 650, 1103, 403],
    [17020, 1312, 441, 1035, 1652, 2863, 901],
  ];
  for (const [km, minutes, ...expected] of rows) {
    it(`4.13: ${km} km`, () => {
      assertClose(blockMinutes(km, REFERENCE_SPEED), minutes, 0.6);
      const fares = marketFares(km, 0);
      CABIN_CLASSES.forEach((c, i) => assertClose(fares[c], expected[i], 0.6, `${c}: ${fares[c]}`));
      assertClose(marketFare('economy', km, monthAt(2020)), expected[4], 0.6);
    });
  }
});
