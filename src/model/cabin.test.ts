/**
 * Regeltests zu SPEZIFIKATION 2.3 (Interior score), 2.4 (Cabin rating) und 5.13 (Listenpreis der Kabine).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CABIN_CLASSES,
  CABIN_EXTRA_POINTS,
  CABIN_EXTRA_PRICE_1960,
  FEATURE_POINTS,
  FEATURE_PRICE_1960,
  PITCH_NORM,
  SEAT_TYPE_POINTS,
  SEAT_TYPE_PRICE_1960,
  type CabinClass,
  type CabinExtra,
} from './constants';
import {
  averageCabinRating,
  cabinExtrasPoints,
  cabinListPrice,
  cabinListPriceParts,
  cabinRating,
  interiorScore,
  interiorScoreParts,
  type CabinFit,
  type ClassInterior,
} from './cabin';

function assertClose(actual: number, expected: number, tolerance = 1e-9, message?: string) {
  assert.ok(Math.abs(actual - expected) <= tolerance, message ?? `${actual} ≉ ${expected}`);
}

/** Ein Einbau, bei dem alles lieferbar ist (Jahr 2020, großes Flugzeug). */
const LATE: CabinFit = { installedMonth: 720, capacity: 400, extras: [] };

const plain = (cabinClass: CabinClass): ClassInterior => ({
  seatType: 'Standard',
  pitch: PITCH_NORM[cabinClass],
  features: [],
});

/** Ausstattung, die mehr bringt (ohne die Platz-Abzüge „reduced“ und „minimal“). */
const POSITIVE_EXTRAS = (Object.keys(CABIN_EXTRA_POINTS) as CabinExtra[]).filter(
  (extra) => CABIN_EXTRA_POINTS[extra].points > 0,
);

// ---------------------------------------------------------------------------

describe('Abschnitt 2.3 Interior score', () => {
  it('2.3: heutige Formel aus dem Kaufdialog, ungerundet (Beispiel Economy)', () => {
    // 50 + 2 × 5 (Comfort) + (76 − 74) × 4 + 5 (IFE) + 5 (WLAN) = 78.
    const score = interiorScore(
      'economy',
      { seatType: 'Comfort', pitch: 76, features: ['ife'] },
      { installedMonth: 500, capacity: 180, extras: ['wifi'] },
    );
    assert.equal(score, 78);
  });

  it('2.3: Grundwerte je Klasse 50 / 55 / 60 / 70', () => {
    const scores = CABIN_CLASSES.map((c) => interiorScore(c, plain(c), LATE));
    assert.deepEqual(scores, [50, 55, 60, 70]);
  });

  it('2.3: Sitzabstand ungerundet (Business 101,5 cm → 60 + 1,5 × 2,4)', () => {
    assertClose(interiorScore('business', { ...plain('business'), pitch: 101.5 }, LATE), 63.6);
  });

  it('2.3: mehr Ausstattung oder mehr Sitzabstand senkt den Interior score nie', () => {
    for (const c of CABIN_CLASSES) {
      const keys = Object.keys(FEATURE_POINTS[c]);
      let features: string[] = [];
      let previous = interiorScore(c, plain(c), LATE);
      for (const key of keys) {
        features = [...features, key];
        const now = interiorScore(c, { ...plain(c), features }, LATE);
        assert.ok(now >= previous, `${c} + ${key}`);
        previous = now;
      }
      for (let pitch = 50; pitch < 250; pitch++) {
        const shorter = interiorScore(c, { ...plain(c), pitch }, LATE);
        const longer = interiorScore(c, { ...plain(c), pitch: pitch + 1 }, LATE);
        assert.ok(longer >= shorter, `${c} ${pitch} cm`);
      }
      let extras: CabinExtra[] = [];
      previous = interiorScore(c, plain(c), LATE);
      for (const extra of POSITIVE_EXTRAS) {
        extras = [...extras, extra];
        const now = interiorScore(c, plain(c), { ...LATE, extras });
        assert.ok(now >= previous, `${c} + ${extra}`);
        previous = now;
      }
    }
  });

  it('2.3: ein besserer Sitztyp senkt den Interior score nie', () => {
    for (const c of CABIN_CLASSES) {
      const types = Object.entries(SEAT_TYPE_POINTS[c]).sort(([, a], [, b]) => a.points - b.points);
      for (let i = 1; i < types.length; i++) {
        const lower = interiorScore(c, { ...plain(c), seatType: types[i - 1][0] }, LATE);
        const higher = interiorScore(c, { ...plain(c), seatType: types[i][0] }, LATE);
        assert.ok(higher >= lower, `${c}: ${types[i][0]}`);
      }
    }
  });

  it('2.3: eine kabinenweite Extra-Ausstattung wirkt in jeder Klasse gleich stark', () => {
    for (const extra of Object.keys(CABIN_EXTRA_POINTS) as CabinExtra[]) {
      const gains = CABIN_CLASSES.map(
        (c) => interiorScore(c, plain(c), { ...LATE, extras: [extra] }) - interiorScore(c, plain(c), LATE),
      );
      for (const gain of gains) assert.equal(gain, gains[0], extra);
    }
  });

  it('2.3: Ausstattung zählt nur, wenn sie im Einbaumonat lieferbar war', () => {
    const early: CabinFit = { installedMonth: 100, capacity: 400, extras: ['wifi'] };
    const withIfe = { ...plain('economy'), features: ['ife'] };
    assert.equal(interiorScore('economy', withIfe, early), 50, 'IFE erst ab Monat 240, WLAN ab 480');
    const lieFlat = { ...plain('business'), seatType: 'Lie-Flat' };
    assert.equal(interiorScore('business', lieFlat, early), 60, 'Lie-Flat erst ab Monat 540');
    assert.equal(interiorScore('business', lieFlat, LATE), 60 + 2 * 35);
  });

  it('2.3: Bar und Dusche nur in großen Flugzeugen', () => {
    const small: CabinFit = { installedMonth: 720, capacity: 150, extras: ['bar', 'shower'] };
    assert.equal(cabinExtrasPoints(small), 0);
    assert.equal(cabinExtrasPoints({ ...small, capacity: 400 }), 7.5 + 10);
  });

  it('2.3: doppelte Einträge zählen einmal; nie unter 0', () => {
    const twice = interiorScore('first', { ...plain('first'), features: ['minibar', 'minibar'] }, LATE);
    assert.equal(twice, 70 + 15);
    assert.equal(interiorScore('economy', { ...plain('economy'), pitch: 40 }, LATE), 0);
  });

  it('2.3: die Aufschlüsselung ergibt die Summe', () => {
    const parts = interiorScoreParts(
      'premium',
      { seatType: 'Recliner', pitch: 90, features: ['ife', 'calf'] },
      { ...LATE, extras: ['wifi', 'minimal'] },
    );
    assert.equal(parts.total, parts.base + parts.seatType + parts.pitch + parts.features + parts.cabinExtras);
    assert.deepEqual(
      [parts.base, parts.seatType, parts.pitch, parts.features, parts.cabinExtras],
      [55, 40, 15, 10, -2.5],
    );
  });
});

// ---------------------------------------------------------------------------

describe('Abschnitt 2.4 Cabin rating', () => {
  it('2.4: neue Kabine: 0,33 × Type appeal + 0,67 × Interior score', () => {
    assertClose(cabinRating(80, 70, 100), 0.33 * 80 + 0.67 * 70);
  });

  it('2.4: ganz abgenutzte Kabine behält 40 % des Interior score', () => {
    assertClose(cabinRating(0, 100, 0), 0.67 * 100 * 0.4);
  });

  it('2.4: besserer Kabinenzustand, höherer Type appeal oder höherer Interior score senken den Wert nie', () => {
    // Raster über alle drei Eingaben; je Eingabe ein Schritt nach oben.
    const appeals = [0, 25, 50, 75, 100];
    const interiors = [0, 30, 60, 90, 120, 150];
    const conditions = [0, 25, 50, 75, 100];
    for (const a of appeals) {
      for (const i of interiors) {
        for (const c of conditions) {
          const now = cabinRating(a, i, c);
          if (c < 100) assert.ok(cabinRating(a, i, c + 25) >= now, `Zustand ${a}/${i}/${c}`);
          if (a < 100) assert.ok(cabinRating(a + 25, i, c) >= now, `Type appeal ${a}/${i}/${c}`);
          assert.ok(cabinRating(a, i + 30, c) >= now, `Interior ${a}/${i}/${c}`);
        }
      }
    }
  });

  it('2.4: Wert liegt immer in 0 … 100 (einmal gekappt, ungerundet)', () => {
    assert.equal(cabinRating(100, 300, 100), 100);
    assert.equal(cabinRating(0, 0, 0), 0);
    const value = cabinRating(77, 61, 83);
    assert.ok(value > 0 && value < 100);
    assert.notEqual(value, Math.round(value));
  });

  it('2.4: Cabin rating (avg.) ist das Mittel nach Sitzen', () => {
    assert.equal(
      averageCabinRating([
        { rating: 60, seats: 150 },
        { rating: 90, seats: 50 },
      ]),
      67.5,
    );
    assert.ok(Number.isNaN(averageCabinRating([])), 'ohne Sitze kein Ersatzwert');
  });
});

describe('Abschnitt 5.13 Listenpreis der Kabine (cabinListPrice)', () => {
  it('5.13: Preise gibt es für genau die Sitztypen, Ausstattungen und Extras mit Punkten', () => {
    for (const c of CABIN_CLASSES) {
      assert.deepEqual(Object.keys(SEAT_TYPE_PRICE_1960[c]).sort(), Object.keys(SEAT_TYPE_POINTS[c]).sort());
      assert.deepEqual(Object.keys(FEATURE_PRICE_1960[c]).sort(), Object.keys(FEATURE_POINTS[c]).sort());
    }
    assert.deepEqual(Object.keys(CABIN_EXTRA_PRICE_1960).sort(), Object.keys(CABIN_EXTRA_POINTS).sort());
  });

  it('5.13: Standard-Sitze ohne Ausstattung kosten nichts', () => {
    assert.equal(cabinListPrice({ economy: { seats: 150, interior: plain('economy') }, business: { seats: 12, interior: plain('business') } }, LATE), 0);
  });

  it('5.13: je Klasse Sitze × (Sitztyp + Ausstattung), dazu kabinenweite Extras', () => {
    const fit: CabinFit = { ...LATE, extras: ['wifi', 'reduced'] };
    const parts = cabinListPriceParts(
      {
        economy: { seats: 100, interior: { seatType: 'Comfort', pitch: 74, features: ['ife', 'power'] } },
        business: { seats: 10, interior: { seatType: 'Lie-Flat', pitch: 100, features: ['massage'] } },
      },
      fit,
    );
    assert.equal(parts.classes.economy, 100 * (80 + 300 + 100));
    assert.equal(parts.classes.business, 10 * (2500 + 1200));
    assert.equal(parts.classes.first, 0);
    assert.equal(parts.cabinExtras, 150_000 - 25_000);
    assert.equal(parts.total, 48_000 + 37_000 + 125_000);
  });

  it('5.13: was im Einbaumonat nicht lieferbar war, kostet nichts (wie 2.3)', () => {
    const early: CabinFit = { installedMonth: 0, capacity: 150, extras: ['wifi', 'bar'] };
    const price = cabinListPrice(
      { business: { seats: 10, interior: { seatType: 'Suites', pitch: 100, features: ['ife', 'lumbar'] } } },
      early,
    );
    assert.equal(price, 0);
    assert.equal(cabinListPrice({ economy: { seats: 10, interior: { seatType: 'Unbekannt', pitch: 74, features: [] } } }, LATE), 0);
  });

  it('5.13: mehr Sitze oder mehr Ausstattung kosten nie weniger', () => {
    const one = cabinListPrice({ first: { seats: 8, interior: { seatType: 'Recliner', pitch: 150, features: ['wood'] } } }, LATE);
    const more = cabinListPrice({ first: { seats: 9, interior: { seatType: 'Recliner', pitch: 150, features: ['wood', 'mirror'] } } }, LATE);
    assert.ok(more >= one);
  });
});
