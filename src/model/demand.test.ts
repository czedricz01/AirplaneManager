/**
 * Regeltests zu SPEZIFIKATION 3.1–3.7 (Marktgröße und Klassen-Anteil).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { airportsData, getAirportStats } from '../data/airports';
import {
  CABIN_CLASSES,
  DEMAND_GROWTH_1960_2019,
  DEMAND_SCALE,
  DISTANCE_MIN,
  LINK_EXP,
  REFERENCE_SPEED,
  SEASON_BY_MONTH,
} from './constants';
import {
  blockMinutes,
  businessLinkage,
  businessShare,
  citySize,
  classShare,
  classShares,
  demandGrowth,
  distanceFactor,
  distanceKm,
  eventDemandFactor,
  marketSize,
  marketSizeParts,
  pairLinkage,
  referenceBlockMinutes,
  relativeSize,
  seasonFactor,
  southernShare,
  tourismLinkage,
  worldCitySize,
  worldScale,
  type CitySize,
  type Coords,
  type MarketAirport,
} from './demand';

function assertClose(actual: number, expected: number, tolerance = 1e-9, message?: string) {
  assert.ok(Math.abs(actual - expected) <= tolerance, message ?? `${actual} ≉ ${expected}`);
}

/** Spielmonat im Januar eines Jahres. */
const jan = (year: number) => (year - 1960) * 12;

/** Erfundener Flughafen: Tabelle mit festen Werten je Jahr ab 1960 (Tourismus, Geschäft abwechselnd). */
function fakeAirport(coords: Coords, rows: readonly (readonly [tourism: number, business: number])[]): MarketAirport {
  return { coords, stats: rows.flatMap(([t, b]) => [t, b]) };
}

const FRANKFURT: Coords = [50.03, 8.57];
const LONDON: Coords = [51.47, -0.45];
const SYDNEY: Coords = [-33.95, 151.18];

describe('Abschnitt 3.1 Bezugs-Flugzeit', () => {
  it('3.1: Großkreis-Entfernung – 1 Grad am Äquator ≈ 111,19 km, gleich in beide Richtungen', () => {
    assertClose(distanceKm([0, 0], [0, 1]), 111.19, 0.01);
    assertClose(distanceKm(FRANKFURT, SYDNEY), distanceKm(SYDNEY, FRANKFURT));
  });

  it('3.1: blockMinutes – 1 000 km mit 800 km/h = 86,5 min (Großkreis × 1,02, Beschleunigen und Bremsen)', () => {
    // 8 min Beschleunigen (53,3 km), 12 min Bremsen (80 km), 886,7 km Reiseflug = 66,5 min.
    assertClose(blockMinutes(1000, 800), 86.5);
  });

  it('3.1: blockMinutes ist ungerundet', () => {
    assert.notEqual(blockMinutes(1001, 800), Math.round(blockMinutes(1001, 800)));
  });

  it('3.1: Beschleunigen und Bremsen dauern auch auf sehr kurzen Strecken gleich lang (wie im Alt-Code)', () => {
    assertClose(blockMinutes(0, 800), 20);
    assertClose(blockMinutes(50, 800), 20);
  });

  it('3.1: referenceBlockMinutes = blockMinutes mit REFERENCE_SPEED, gleich für A → B und B → A', () => {
    const km = distanceKm(FRANKFURT, LONDON);
    assertClose(referenceBlockMinutes(FRANKFURT, LONDON), blockMinutes(km, REFERENCE_SPEED));
    assertClose(referenceBlockMinutes(FRANKFURT, LONDON), referenceBlockMinutes(LONDON, FRANKFURT));
  });

  it('3.1: schnellere Flugzeuge ändern die Flugzeit ihrer Strecke, nie die Bezugs-Flugzeit', () => {
    const km = distanceKm(FRANKFURT, SYDNEY);
    assert.ok(blockMinutes(km, 2100) < blockMinutes(km, REFERENCE_SPEED));
    // referenceBlockMinutes nimmt nur die zwei Orte entgegen.
    assert.equal(referenceBlockMinutes.length, 2);
  });
});

describe('Abschnitt 3.2 Stadtgrößen und Verflechtung', () => {
  const airport = airportsData.find((a) => a.id === 'ATL')!;

  it('3.2: im Januar eines Jahres gilt der Tabellenwert dieses Jahres', () => {
    for (const year of [1960, 1985, 2010]) {
      const table = getAirportStats(airport, year);
      const size = citySize(airport, jan(year));
      assert.equal(size.business, table.business);
      assert.equal(size.tourism, table.tourism);
    }
  });

  it('3.2: zwischen zwei Tabellenjahren gerade Linie, ohne Sprung am Jahreswechsel (R5)', () => {
    const a = getAirportStats(airport, 1990);
    const b = getAirportStats(airport, 1991);
    assertClose(citySize(airport, jan(1990) + 6).business, (a.business + b.business) / 2);
    // Jeder Monat bringt 1/12 des Jahresunterschieds, auch von Dezember auf Januar.
    const step = (b.business - a.business) / 12;
    assertClose(citySize(airport, jan(1991)).business - citySize(airport, jan(1991) - 1).business, step);
    assertClose(citySize(airport, jan(1990) + 1).business - citySize(airport, jan(1990)).business, step);
  });

  it('3.2: nach dem Tabellenende fortgeschrieben wie im Alt-Code, weiter stetig', () => {
    const late = jan(2060) + 3;
    const size = citySize(airport, late);
    assert.ok(Number.isFinite(size.business) && size.business > 0);
    assert.ok(size.business >= getAirportStats(airport, 2060).business);
    assert.ok(size.business <= getAirportStats(airport, 2061).business);
  });

  it('3.2: Weltanteil – im Januar 1960 gilt Grel = G und Trel = T', () => {
    const world = worldScale(0);
    assert.equal(world.business, 1);
    assert.equal(world.tourism, 1);
    const rel = relativeSize(airport, 0, world);
    const size = citySize(airport, 0);
    assert.equal(rel.business, size.business);
    assert.equal(rel.tourism, size.tourism);
  });

  it('3.2: Weltanteil – die Summe aller Grel und Trel bleibt auf dem Stand von 1960 (die Welt wächst nur über 3.3)', () => {
    const start = worldCitySize(0);
    for (const month of [jan(1990) + 4, jan(2019), jan(2070) + 7]) {
      const world = worldScale(month);
      let business = 0;
      let tourism = 0;
      for (const a of airportsData) {
        const rel = relativeSize(a, month, world);
        business += rel.business;
        tourism += rel.tourism;
      }
      assertClose(business / start.business, 1, 1e-9);
      assertClose(tourism / start.tourism, 1, 1e-9);
    }
  });

  it('3.2: Weltanteil – wachsen alle Städte gleich schnell, bleibt jeder Weltanteil gleich', () => {
    const grow = (coords: Coords, t: number, b: number) =>
      fakeAirport(coords, [[t, b], [t * 2, b * 2], [t * 4, b * 4]]);
    const world = [grow(FRANKFURT, 10, 20), grow(LONDON, 30, 5)];
    const month = jan(1961) + 5;
    const scale = worldScale(month, world);
    assertClose(relativeSize(world[0], month, scale).business, 20);
    assertClose(relativeSize(world[1], month, scale).tourism, 30);
  });

  it('3.2: pair – die kleinere Stadt zählt stärker (min^1,4 × max^0,6)', () => {
    assertClose(pairLinkage(2, 8), 2 ** 1.4 * 8 ** 0.6);
    assertClose(pairLinkage(8, 2), pairLinkage(2, 8));
    // Gleiche Summe, ausgeglichener ist mehr.
    assert.ok(pairLinkage(5, 5) > pairLinkage(2, 8));
  });

  it('3.2: linkage hängt nicht von der Reihenfolge A, B ab', () => {
    const a: CitySize = { business: 40, tourism: 120 };
    const b: CitySize = { business: 300, tourism: 15 };
    assertClose(businessLinkage(a, b), businessLinkage(b, a));
    assertClose(tourismLinkage(a, b, 1.1), tourismLinkage(b, a, 1.1));
    assertClose(businessShare(a, b), businessShare(b, a));
    assert.equal(southernShare(FRANKFURT, SYDNEY), southernShare(SYDNEY, FRANKFURT));
  });

  it('3.2: größere Städte ergeben nie weniger Verflechtung', () => {
    const base: CitySize = { business: 50, tourism: 80 };
    const other: CitySize = { business: 200, tourism: 30 };
    const total = (a: CitySize, b: CitySize) => businessLinkage(a, b) + tourismLinkage(a, b);
    for (const bigger of [
      { business: 60, tourism: 80 },
      { business: 50, tourism: 90 },
      { business: 500, tourism: 800 },
    ]) {
      assert.ok(total(bigger, other) >= total(base, other));
    }
  });

  it('3.2: Saison – Monat 0 ist Januar; Werte 0,88 … 1,15, Mittel ≈ 1, jedes Jahr gleich', () => {
    assert.equal(seasonFactor(0), SEASON_BY_MONTH[0]);
    assert.equal(seasonFactor(6), 1.15);
    assert.equal(seasonFactor(jan(2001) + 6), seasonFactor(6));
    const values = Array.from({ length: 12 }, (_, m) => seasonFactor(m));
    assert.equal(Math.min(...values), 0.88);
    assert.equal(Math.max(...values), 1.15);
    assertClose(values.reduce((s, v) => s + v, 0) / 12, 1, 0.005);
  });

  it('3.2: Saison – Südhalbkugel um 6 Monate versetzt, anteilig je Ende', () => {
    assert.equal(southernShare(FRANKFURT, LONDON), 0);
    assert.equal(southernShare(FRANKFURT, SYDNEY), 0.5);
    assert.equal(southernShare(SYDNEY, SYDNEY), 1);
    assert.equal(seasonFactor(0, 1), seasonFactor(6, 0));
    assertClose(seasonFactor(0, 0.5), (seasonFactor(0, 0) + seasonFactor(6, 0)) / 2);
  });

  it('3.2: Saison wirkt nur auf den Tourismus', () => {
    const a: CitySize = { business: 40, tourism: 120 };
    const b: CitySize = { business: 300, tourism: 15 };
    assertClose(tourismLinkage(a, b, 1.15), tourismLinkage(a, b) * 1.15);
    // businessLinkage und businessShare nehmen keine Saison entgegen.
    assert.equal(businessLinkage.length, 2);
    assert.equal(businessShare.length, 2);
  });

  it('3.2: Geschäftsanteil 0 … 1; reines Geschäft 1, reiner Tourismus 0; ohne Verflechtung 0,5', () => {
    assert.equal(businessShare({ business: 100, tourism: 0 }, { business: 50, tourism: 0 }), 1);
    assert.equal(businessShare({ business: 0, tourism: 100 }, { business: 0, tourism: 50 }), 0.5);
    const share = businessShare({ business: 40, tourism: 120 }, { business: 300, tourism: 15 });
    assert.ok(share > 0 && share < 1);
  });
});

describe('Abschnitt 3.3 Nachfrage-Wachstum', () => {
  it('3.3: 1 im Januar 1960, 1,97 im Januar 2019 (E64, E107)', () => {
    assert.equal(demandGrowth(0), 1);
    assertClose(demandGrowth(jan(2019)), 1.97);
  });

  it('3.3: steigt stetig mit jedem Monat', () => {
    for (let month = 1; month <= jan(2100); month += 7) {
      assert.ok(demandGrowth(month) > demandGrowth(month - 1));
    }
  });

  it('3.3: Zeit begrenzt auf 1960 … 2100', () => {
    assert.equal(demandGrowth(-24), 1);
    assert.equal(demandGrowth(jan(2130)), demandGrowth(jan(2100)));
  });
});

describe('Abschnitt 3.4 Entfernungs-Faktor', () => {
  it('3.4: Werte der Spezifikation (45 min 2,00 … 1 200 min 0,75; 1 bei 450 min)', () => {
    const expected: [number, number][] = [
      [45, 2.0], [90, 1.62], [150, 1.39], [300, 1.13], [450, 1], [810, 0.84], [1200, 0.75],
    ];
    for (const [minutes, factor] of expected) assertClose(distanceFactor(minutes), factor, 0.005);
    assertClose(distanceFactor(45) / distanceFactor(1200), 2.68, 0.01);
  });

  it('3.4: unter DISTANCE_MIN gleich, darüber streng fallend, ohne Untergrenze', () => {
    assert.equal(distanceFactor(10), distanceFactor(DISTANCE_MIN));
    for (let minutes = DISTANCE_MIN + 10; minutes <= 1500; minutes += 10) {
      assert.ok(distanceFactor(minutes) < distanceFactor(minutes - 10));
    }
    assert.ok(distanceFactor(20 * 60) < distanceFactor(13 * 60));
  });
});

describe('Abschnitt 3.5 Ereignis-Faktor', () => {
  it('3.5: ohne Ereignis 1', () => {
    assert.equal(eventDemandFactor([], 'EU', 'NA'), 1);
  });

  it('3.5: ein Ereignis an beiden Enden wirkt voll, an einem Ende halb, sonst nicht', () => {
    const crisis = { demandMultiplier: 0.7, regions: ['EU'] as const };
    assertClose(eventDemandFactor([crisis], 'EU', 'EU'), 0.7);
    assertClose(eventDemandFactor([crisis], 'EU', 'NA'), 0.85);
    assertClose(eventDemandFactor([crisis], 'NA', 'EU'), 0.85);
    assert.equal(eventDemandFactor([crisis], 'AS', 'NA'), 1);
  });

  it('3.5: ein weltweites Ereignis betrifft jedes Ende; mehrere Ereignisse multiplizieren sich', () => {
    const pandemic = { demandMultiplier: 0.4 };
    const boom = { demandMultiplier: 1.2, regions: [] };
    const cup = { demandMultiplier: 1.15, regions: ['SA'] as const };
    assertClose(eventDemandFactor([pandemic], 'AF', 'OC'), 0.4);
    assertClose(eventDemandFactor([boom], 'AF', 'OC'), 1.2);
    assertClose(eventDemandFactor([pandemic, cup], 'SA', 'EU'), 0.4 * 1.075);
  });
});

describe('Abschnitt 3.6 Marktgröße', () => {
  const world = worldScale(jan(2005) + 3);
  const month = jan(2005) + 3;
  const atl = airportsData.find((a) => a.id === 'ATL')!;
  const other = airportsData.find((a) => a.id !== 'ATL' && a.stats && a.coords[0] > 0)!;

  it('3.6: Formel DEMAND_SCALE × linkage^LINK_EXP × distanceFactor × demandGrowth × eventDemandFactor', () => {
    const parts = marketSizeParts({ a: atl, b: other, month, world, eventFactor: 0.9 });
    assertClose(parts.linkage, parts.businessLinkage + parts.tourismLinkage);
    assertClose(
      parts.marketSize,
      DEMAND_SCALE * parts.linkage ** LINK_EXP * parts.distanceFactor * parts.demandGrowth * 0.9,
    );
    assert.ok(Number.isFinite(parts.marketSize) && parts.marketSize > 0);
    assert.equal(marketSize({ a: atl, b: other, month, world, eventFactor: 0.9 }), parts.marketSize);
  });

  it('3.6: ohne Ereignis-Faktor gilt 1', () => {
    assert.equal(
      marketSize({ a: atl, b: other, month, world }),
      marketSize({ a: atl, b: other, month, world, eventFactor: 1 }),
    );
  });

  it('3.6: gleich für A → B und B → A', () => {
    assertClose(
      marketSize({ a: atl, b: other, month, world }),
      marketSize({ a: other, b: atl, month, world }),
      1e-9,
    );
  });

  it('3.6: größere Städte → nie kleiner; kürzere Bezugs-Flugzeit → nie kleiner', () => {
    const small = fakeAirport(LONDON, [[40, 60]]);
    const big = fakeAirport(LONDON, [[45, 90]]);
    const far = fakeAirport(SYDNEY, [[200, 150]]);
    const near = fakeAirport(FRANKFURT, [[200, 150]]);
    const scale = { business: 1, tourism: 1 };
    const size = (a: MarketAirport, b: MarketAirport) => marketSize({ a, b, month: 6, world: scale });
    assert.ok(size(big, far) >= size(small, far));
    assert.ok(size(small, near) >= size(small, far));
  });

  it('3.6: wachsen alle Städte wie die Welt, wächst die Marktgröße 1960 → 2019 genau um demandGrowth (× 2,25)', () => {
    const rows = (t: number, b: number) =>
      Array.from({ length: 70 }, (_, i) => [t * 1.03 ** i, b * 1.03 ** i] as const);
    const pair = [fakeAirport(FRANKFURT, rows(30, 50)), fakeAirport(LONDON, rows(80, 40))];
    const size = (m: number) => marketSize({ a: pair[0], b: pair[1], month: m, world: worldScale(m, pair) });
    assertClose(size(jan(2019)) / size(0), DEMAND_GROWTH_1960_2019, 1e-9);
  });

  it('3.6: Marktgröße nimmt nur Städte, Zeit, Weltanteil und Ereignis-Faktor (kein Flugzeug, keine Schwierigkeit)', () => {
    const parts = marketSizeParts({ a: atl, b: other, month, world });
    assert.deepEqual(
      Object.keys(parts).sort(),
      [
        'businessLinkage', 'businessShare', 'demandGrowth', 'distanceFactor', 'eventFactor', 'linkage',
        'marketSize', 'referenceBlockMinutes', 'season', 'tourismLinkage',
      ],
    );
    assertClose(parts.referenceBlockMinutes, referenceBlockMinutes(atl.coords, other.coords));
  });
});

describe('Abschnitt 3.7 Klassen-Anteil', () => {
  const SHORT = 30;
  const LONG = 800;

  it('3.7: Beispielwerte der Spezifikation (Premium / Business / First / Economy)', () => {
    const cases: [bs: number, minutes: number, expected: [number, number, number, number]][] = [
      [0, SHORT, [0.0574, 0.026, 0.00624, 0.91036]],
      [0.3, SHORT, [0.07, 0.05, 0.012, 0.868]],
      [0.3, LONG, [0.105, 0.08, 0.03, 0.785]],
      [1, LONG, [0.1491, 0.1696, 0.0636, 0.6177]],
    ];
    for (const [bs, minutes, [premium, business, first, economy]] of cases) {
      const shares = classShares(bs, minutes);
      assertClose(shares.premium, premium);
      assertClose(shares.business, business);
      assertClose(shares.first, first);
      assertClose(shares.economy, economy);
      assert.equal(classShare('business', bs, minutes), shares.business);
    }
  });

  it('3.7: Summe = 1, Economy ≥ 0,5 bei allen Eingaben', () => {
    for (let bs = 0; bs <= 1; bs += 0.1) {
      for (let minutes = 0; minutes <= 1500; minutes += 50) {
        const shares = classShares(bs, minutes);
        assertClose(CABIN_CLASSES.reduce((sum, c) => sum + shares[c], 0), 1);
        assert.ok(shares.economy >= 0.5);
        for (const c of CABIN_CLASSES) assert.ok(shares[c] >= 0);
      }
    }
  });

  it('3.7: mehr Geschäft → Business und First steigen, Economy steigt nie (E21)', () => {
    for (const minutes of [SHORT, 300, LONG]) {
      for (let bs = 0.1; bs <= 1; bs += 0.1) {
        const lower = classShares(bs - 0.1, minutes);
        const higher = classShares(bs, minutes);
        assert.ok(higher.business > lower.business);
        assert.ok(higher.first > lower.first);
        assert.ok(higher.economy <= lower.economy);
      }
    }
  });

  it('3.7: längere Flugzeit → alle höheren Klassen steigen zwischen 60 und 720 min, danach gleich', () => {
    const at = (minutes: number) => classShares(0.5, minutes);
    for (const c of ['premium', 'business', 'first'] as const) {
      assert.ok(at(400)[c] > at(100)[c]);
      assert.equal(at(30)[c], at(60)[c]);
      assert.equal(at(720)[c], at(1200)[c]);
    }
  });
});
