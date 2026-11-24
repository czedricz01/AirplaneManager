/**
 * Regeltests zu SPEZIFIKATION 2.1 (Flugzeit-Index), 2.2 (Type appeal), 2.5 (Service points),
 * 2.6 (Teile der Satisfaction), 2.7 (Satisfaction je Klasse), 2.8 (Offer satisfaction),
 * 2.9 (Route und Airline satisfaction) und 2.10 (Satisfaction factor).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aircraftList } from '../data/aircraft';
import { EXTRAS_OPTIONS, MEAL_DATA, SERVICE_OPTIONS } from '../data/catering';
import {
  CABIN_CLASSES,
  CABIN_EXPECTATION,
  CABIN_LIMIT,
  DESK_CAPACITY,
  DESK_OVERLOAD_MAX,
  DESK_TYPE_PENALTY,
  FLIGHT_TIME_INDEX_ANCHORS,
  LAUNCH_BONUS,
  LAUNCH_BONUS_MONTHS,
  MEAL_CATEGORIES,
  MEALS_MAX,
  RESEARCH_PROJECTS,
  SERVICE_DELIGHT,
  TYPE_APPEAL_DECAY_FROM,
  TYPE_APPEAL_DECAY_MAX,
  type AircraftClass,
  type CabinClass,
  type MealCategory,
} from './constants';
import {
  airlineSatisfaction,
  cabinPart,
  cabinWeight,
  classSatisfactionBreakdown,
  connectionOfferSatisfaction,
  deskLoad,
  deskOverloadPoints,
  directOfferSatisfaction,
  expectedServicePoints,
  flightTimeIndex,
  groundPart,
  groundPartParts,
  groundSidePoints,
  groundWeight,
  maxServiceShortfall,
  mealCount,
  mealWeight,
  menuPoints,
  researchPart,
  routeSatisfaction,
  satisfaction,
  satisfactionBreakdown,
  satisfactionFactor,
  serviceCapability,
  servicePart,
  servicePoints,
  servicePointsParts,
  staffPart,
  typeAppeal,
  type GroundSide,
  type RouteSatisfactionInput,
  type ServiceCapability,
  type ServiceSelection,
} from './satisfaction';

function assertClose(actual: number, expected: number, tolerance = 1e-9, message?: string) {
  assert.ok(Math.abs(actual - expected) <= tolerance, message ?? `${actual} ≉ ${expected}`);
}

/** Alles erlaubt: Großraumflugzeug mit Bordküche, WLAN und Catering-Einrichtung. */
const FULL: ServiceCapability = {
  mealCategories: ['Basic', 'Standard', 'Premium', 'Luxury'],
  hasWifi: true,
  hasPremiumGalley: true,
};

/** Id eines Gerichts nach Name. */
function mealId(label: string): string {
  for (const items of Object.values(MEAL_DATA)) {
    const item = items.find((m) => m.label === label);
    if (item) return item.id;
  }
  throw new Error(`Gericht fehlt: ${label}`);
}

const WAGYU = mealId('Wagyu Beef with Asparagus');
const COOKIE = mealId('Butter Cookie (Single)');
const HAM = mealId('Ham Sandwich');

const empty: ServiceSelection = { meals: [], extras: [], onboardService: [] };

// ---------------------------------------------------------------------------

describe('Abschnitt 2.1 Flugzeit-Index', () => {
  it('2.1: an den Stützpunkten genau die Werte der Liste', () => {
    for (const [minutes, index] of FLIGHT_TIME_INDEX_ANCHORS) {
      assert.equal(flightTimeIndex(minutes), index, `${minutes} min`);
    }
  });

  it('2.1: darunter 1, darüber 8', () => {
    assert.equal(flightTimeIndex(0), 1);
    assert.equal(flightTimeIndex(29), 1);
    assert.equal(flightTimeIndex(811), 8);
    assert.equal(flightTimeIndex(2000), 8);
  });

  it('2.1: steigt nie mit kürzerer Flugzeit; 1 Minute mehr ändert ihn um höchstens 1/60', () => {
    for (let minutes = 0; minutes <= 1000; minutes += 0.5) {
      const step = flightTimeIndex(minutes + 1) - flightTimeIndex(minutes);
      assert.ok(step >= 0, `fällt bei ${minutes} min`);
      assert.ok(step <= 1 / 60 + 1e-12, `Sprung ${step} bei ${minutes} min`);
    }
  });

  it('2.1: zwischen den Stützpunkten gerade Linie (330 min → 5,2)', () => {
    assertClose(flightTimeIndex(330), 5.2);
  });

  it('2.1: ungültige Flugzeit bleibt ungültig (NaN, F2)', () => {
    assert.ok(Number.isNaN(flightTimeIndex(Number.NaN)));
  });
});

// ---------------------------------------------------------------------------

describe('Abschnitt 2.2 Type appeal', () => {
  const at = (ageMonths: number, launchCustomer = false, catalogAppeal = 80) =>
    typeAppeal({ catalogAppeal, builtMonth: 100, month: 100 + ageMonths, launchCustomer });

  it('2.2: ein älteres Flugzeug desselben Typs hat nie mehr Type appeal (ohne Erstkunden-Bonus)', () => {
    for (let months = 0; months < 40 * 12; months++) {
      assert.ok(at(months + 1) <= at(months), `steigt mit ${months + 1} Monaten`);
    }
  });

  it('2.2: bis 8 Jahre kein Verlust; ab 23 Jahren genau −15', () => {
    assert.equal(at(0), 80);
    assert.equal(at(TYPE_APPEAL_DECAY_FROM * 12), 80);
    assert.equal(at((TYPE_APPEAL_DECAY_FROM + TYPE_APPEAL_DECAY_MAX) * 12), 80 - TYPE_APPEAL_DECAY_MAX);
    assert.equal(at(40 * 12), 80 - TYPE_APPEAL_DECAY_MAX);
  });

  it('2.2: Alter mit Bruchteil, kein Sprung am Jahrestag (R5)', () => {
    // 10,5 Jahre → 2,5 Punkte Verlust.
    assertClose(at(126), 80 - 2.5);
    for (let months = 0; months < 30 * 12; months++) {
      assert.ok(at(months) - at(months + 1) <= 1 / 12 + 1e-12, `Sprung nach ${months} Monaten`);
    }
  });

  it('2.2: Erstkunden-Bonus +5 in den ersten 24 Monaten, danach 0', () => {
    assert.equal(at(0, true), 80 + LAUNCH_BONUS);
    assert.equal(at(LAUNCH_BONUS_MONTHS - 1, true), 80 + LAUNCH_BONUS);
    assert.equal(at(LAUNCH_BONUS_MONTHS, true), 80);
  });

  it('2.2: Wert liegt immer in 0 … 100', () => {
    assert.equal(at(0, true, 99), 100);
    assert.equal(at(40 * 12, false, 5), 0);
  });

  it('2.2: gleicher Typ, gleiches Alter: gleicher Wert für Spieler und KI (kein Eigentümer in der Eingabe)', () => {
    const input = { catalogAppeal: 70, builtMonth: 50, month: 200 };
    assert.equal(typeAppeal(input), typeAppeal({ ...input }));
    assert.equal(typeAppeal.length, 1);
  });
});

// ---------------------------------------------------------------------------

describe('Abschnitt 2.5 Service points: Menü', () => {
  it('2.5: Wagyu (60) allein = 60; Wagyu + Butterkeks (5) = 62,5 (Spezifikations-Beispiel)', () => {
    assert.equal(menuPoints([60]), 60);
    assert.equal(menuPoints([5, 60]), 62.5);
    const meal = (ids: string[]) => servicePoints({ ...empty, meals: [ids] }, 60, FULL);
    assert.equal(meal([WAGYU]), 60);
    assert.equal(meal([COOKIE, WAGYU]), 62.5);
  });

  it('2.5: Wagyu + Butterkeks > Wagyu allein', () => {
    const meal = (ids: string[]) => servicePoints({ ...empty, meals: [ids] }, 60, FULL);
    assert.ok(meal([WAGYU, COOKIE]) > meal([WAGYU]));
  });

  it('2.5: ein weiteres Gericht senkt menuPoints nie (Zufallsmenüs)', () => {
    let state = 12345;
    const next = () => (state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let n = 0; n < 500; n++) {
      const menu = Array.from({ length: Math.floor(next() * 6) }, () => Math.floor(next() * 60));
      const added = Math.floor(next() * 60);
      assert.ok(menuPoints([...menu, added]) >= menuPoints(menu), `${menu} + ${added}`);
    }
  });
});

describe('Abschnitt 2.5 Service points: Mahlzeiten', () => {
  it('2.5: Mahlzeit 1 zählt immer voll; 1 Mahlzeit bis 300 min, 3 ab 720 min', () => {
    for (const minutes of [0, 60, 300, 500, 720, 900]) {
      assert.equal(mealWeight(1, flightTimeIndex(minutes)), 1);
    }
    assert.equal(mealCount(flightTimeIndex(300)), 1);
    assert.equal(mealCount(flightTimeIndex(720)), MEALS_MAX);
    assert.equal(mealWeight(MEALS_MAX + 1, flightTimeIndex(900)), 0);
  });

  it('2.5: 2 Schinkenbrote bei 359 und 360 min ≈ 10,5 Punkte (kein Sprung von 8 auf 16)', () => {
    const selection = { ...empty, meals: [[HAM], [HAM]] };
    const at359 = servicePoints(selection, 359, FULL);
    const at360 = servicePoints(selection, 360, FULL);
    assertClose(at359, 10.5, 0.1);
    assertClose(at360, 10.5, 0.1);
  });

  it('2.5: eine Mahlzeit ohne Menü zählt 0 (keine Kopie von Mahlzeit 1, W15)', () => {
    const parts = servicePointsParts({ ...empty, meals: [[WAGYU]] }, 800, FULL);
    assert.equal(parts.meals[1].points, 0);
    assert.equal(parts.meals[2].points, 0);
    assert.equal(parts.total, 60);
  });

  it('2.5: 1 Minute mehr Flugzeit ändert servicePoints um weniger als 1 % (kein Sprung bei 360 oder 720 min)', () => {
    const selection: ServiceSelection = {
      meals: [[HAM], [HAM], [HAM]],
      extras: [],
      onboardService: [],
    };
    for (let minutes = 0; minutes <= 1000; minutes++) {
      const now = servicePoints(selection, minutes, FULL);
      const later = servicePoints(selection, minutes + 1, FULL);
      assert.ok(Math.abs(later - now) < 0.01 * now, `${now} → ${later} bei ${minutes} min`);
    }
  });

  it('2.5: Mahlzeiten-Gewichte für Satisfaction und Catering-Kosten sind dieselben Zahlen (mealWeight)', () => {
    for (const minutes of [100, 400, 600, 900]) {
      const parts = servicePointsParts({ ...empty, meals: [[HAM], [HAM], [HAM]] }, minutes, FULL);
      parts.meals.forEach((meal, i) => assert.equal(meal.weight, mealWeight(i + 1, flightTimeIndex(minutes))));
    }
  });
});

describe('Abschnitt 2.5 Service points: Extras, Bordservice, Lieferbarkeit', () => {
  it('2.5: ein weiteres Gericht, Extra oder Bordservice senkt servicePoints nie', () => {
    const base: ServiceSelection = { meals: [[HAM]], extras: ['wifi_limited'], onboardService: ['drinks'] };
    const before = servicePoints(base, 500, FULL);
    for (const id of Object.keys(EXTRAS_OPTIONS)) {
      assert.ok(servicePoints({ ...base, extras: [...base.extras, id] }, 500, FULL) >= before, `Extra ${id}`);
    }
    for (const id of Object.keys(SERVICE_OPTIONS)) {
      const more = { ...base, onboardService: [...base.onboardService, id] };
      assert.ok(servicePoints(more, 500, FULL) >= before, `Service ${id}`);
    }
    for (const items of Object.values(MEAL_DATA)) {
      for (const item of items) {
        for (let k = 0; k < MEALS_MAX; k++) {
          const meals = [[HAM], [], []].map((m, i) => (i === k ? [...m, item.id] : m));
          assert.ok(servicePoints({ ...base, meals }, 500, FULL) >= before, `${item.id} in Mahlzeit ${k + 1}`);
        }
      }
    }
  });

  it('2.5: je Gruppe zählt nur die beste gewählte Stufe', () => {
    const parts = servicePointsParts({ ...empty, extras: ['wifi_limited', 'wifi_unlimited'] }, 100, FULL);
    assert.deepEqual(parts.extraIds, ['wifi_unlimited']);
    assert.equal(parts.extrasPoints, EXTRAS_OPTIONS.wifi_unlimited.sat);
  });

  it('2.5: was das Flugzeug nicht liefern kann, zählt nicht (WLAN, Premium-Alkohol)', () => {
    const plain: ServiceCapability = { ...FULL, hasWifi: false, hasPremiumGalley: false };
    const parts = servicePointsParts({ ...empty, extras: ['wifi_unlimited', 'premium_alcohol', 'alcohol'] }, 100, plain);
    assert.deepEqual(parts.extraIds, ['alcohol']);
  });

  it('2.5: Gerichte einer nicht erlaubten Stufe zählen nicht', () => {
    const regional = serviceCapability({
      aircraftClass: 'Regional',
      hasWifi: false,
      hasPremiumGalley: false,
      cateringFacility: false,
    });
    assert.equal(servicePoints({ ...empty, meals: [[WAGYU, COOKIE]] }, 100, regional), 5);
  });

  it('2.5: eine Stufe mehr nur mit Premium-Bordküche und Catering-Einrichtung', () => {
    const capability = (hasPremiumGalley: boolean, cateringFacility: boolean) =>
      serviceCapability({ aircraftClass: 'Narrowbody', hasWifi: false, hasPremiumGalley, cateringFacility })
        .mealCategories;
    assert.deepEqual(capability(false, false), ['Basic', 'Standard']);
    assert.deepEqual(capability(true, false), ['Basic', 'Standard']);
    assert.deepEqual(capability(false, true), ['Basic', 'Standard']);
    assert.deepEqual(capability(true, true), ['Basic', 'Standard', 'Premium']);
  });

  it('2.5: unbekannte Ids und „none“ zählen 0', () => {
    const selection = { meals: [['none', 'gibt-es-nicht']], extras: ['none', 'x'], onboardService: ['none'] };
    assert.equal(servicePoints(selection, 100, FULL), 0);
  });
});

describe('Abschnitt 2.5 Daten', () => {
  it('2.5: jede Flugzeugklasse in den Daten hat Gerichte-Stufen', () => {
    for (const aircraft of aircraftList) {
      assert.ok(aircraft.class in MEAL_CATEGORIES, `${aircraft.id}: ${aircraft.class}`);
      assert.doesNotThrow(() =>
        serviceCapability({
          aircraftClass: aircraft.class as AircraftClass,
          hasWifi: false,
          hasPremiumGalley: false,
          cateringFacility: false,
        }),
      );
    }
  });

  it('2.5: jede Stufe in MEAL_CATEGORIES gibt es in MEAL_DATA; alle Punkte ≥ 0', () => {
    const known = new Set(Object.keys(MEAL_DATA));
    for (const { base, upgraded } of Object.values(MEAL_CATEGORIES)) {
      for (const category of [...base, ...upgraded] as MealCategory[]) assert.ok(known.has(category), category);
    }
    for (const items of Object.values(MEAL_DATA)) for (const item of items) assert.ok(item.sat >= 0, item.id);
    for (const option of [...Object.values(EXTRAS_OPTIONS), ...Object.values(SERVICE_OPTIONS)]) {
      assert.ok(option.sat >= 0, option.label);
    }
  });
});

// ---------------------------------------------------------------------------
// 2.6–2.10
// ---------------------------------------------------------------------------

/** Ein Ende ohne Lounge und Stellplätze, mit einem bedienten Schalter ohne Überlast. */
const PLAIN_SIDE: GroundSide = {
  lounge: false,
  stands: 0,
  occupiedSlots: 14,
  desks: { normal: 1, self: 0 },
  departingSeatsPerWeek: 1000,
};

/** Strecke mit zwei schlichten Enden, Moral 50, ohne Forschung. */
function plainRoute(blockMinutes: number): RouteSatisfactionInput {
  return { blockMinutes, origin: PLAIN_SIDE, destination: PLAIN_SIDE };
}

/** Klasse genau auf Erwartung (Kabine und Service). */
function onExpectation(cabinClass: CabinClass, blockMinutes: number) {
  return {
    cabinRating: CABIN_EXPECTATION[cabinClass],
    servicePoints: expectedServicePoints(cabinClass, flightTimeIndex(blockMinutes)),
  };
}

const MINUTES = [20, 30, 45, 90, 150, 240, 360, 500, 720, 810, 1000];

describe('Abschnitt 2.6.1 Kabinen-Teil', () => {
  it('2.6.1: 0 bei Erwartung; steigt mit dem Cabin rating; nie über ±30', () => {
    for (const c of CABIN_CLASSES) {
      for (const minutes of MINUTES) {
        const fti = flightTimeIndex(minutes);
        assertClose(cabinPart(c, CABIN_EXPECTATION[c], fti), 0);
        let previous = -Infinity;
        for (let rating = 0; rating <= 100; rating += 0.5) {
          const part = cabinPart(c, rating, fti);
          assert.ok(part >= previous, `${c} ${minutes} min, Rating ${rating}`);
          assert.ok(Math.abs(part) <= CABIN_LIMIT);
          previous = part;
        }
      }
    }
  });

  it('2.6.1: auf Langstrecke stärker als auf Kurzstrecke; Gewicht 0,5 bei 30 min, 1,2 ab 810 min', () => {
    assertClose(cabinWeight(flightTimeIndex(30)), 0.5);
    assertClose(cabinWeight(flightTimeIndex(810)), 1.2);
    for (const c of CABIN_CLASSES) {
      assert.ok(cabinPart(c, 90, flightTimeIndex(810)) > cabinPart(c, 90, flightTimeIndex(45)));
      assert.ok(cabinPart(c, 20, flightTimeIndex(810)) < cabinPart(c, 20, flightTimeIndex(45)));
    }
  });
});

describe('Abschnitt 2.6.2 Service-Teil', () => {
  it('2.6.2: 0 genau bei Erwartung; steigt mit Service points; nie unter −maxShortfall, nie über 25', () => {
    for (const c of CABIN_CLASSES) {
      for (const minutes of MINUTES) {
        const fti = flightTimeIndex(minutes);
        const expected = expectedServicePoints(c, fti);
        assertClose(servicePart(c, expected, fti), 0);
        assertClose(servicePart(c, 0, fti), -maxServiceShortfall(c, fti));
        let previous = -Infinity;
        for (let points = 0; points <= 5 * expected; points += expected / 40) {
          const part = servicePart(c, points, fti);
          assert.ok(part >= previous, `${c} ${minutes} min, ${points} Punkte`);
          assert.ok(part >= -maxServiceShortfall(c, fti) - 1e-9 && part <= SERVICE_DELIGHT);
          previous = part;
        }
      }
    }
  });

  it('2.6.2: doppelte Erwartung bringt ≈ 63 % von SERVICE_DELIGHT', () => {
    const fti = flightTimeIndex(240);
    assertClose(servicePart('business', 2 * expectedServicePoints('business', fti), fti), 25 * (1 - Math.exp(-1)));
  });
});

describe('Abschnitt 2.6.3 Boden-Teil', () => {
  const lounge: GroundSide = { ...PLAIN_SIDE, lounge: true };
  const stands: GroundSide = { ...PLAIN_SIDE, stands: 14 };
  const selfOnly: GroundSide = { ...PLAIN_SIDE, desks: { normal: 0, self: 1 } };

  it('2.6.3: Bodengewicht 1,2 bei 30 min, 0,5 ab 810 min', () => {
    assertClose(groundWeight(flightTimeIndex(30)), 1.2);
    assertClose(groundWeight(flightTimeIndex(810)), 0.5);
  });

  it('2.6.3: gleiche Ausstattung an beiden Enden: Teil = Teil eines Endes × groundWeight', () => {
    const fti = flightTimeIndex(240);
    for (const c of CABIN_CLASSES) {
      for (const side of [PLAIN_SIDE, lounge, stands, selfOnly]) {
        const one = groundSidePoints(c, side);
        const sum = one.lounge + one.stands + one.deskType + one.deskOverload;
        assertClose(groundPart(c, side, side, fti), sum * groundWeight(fti));
      }
    }
  });

  it('2.6.3: Lounge an einem Ende = 4, an beiden = 8 (Business, vor Gewicht, wie im Alt-Code)', () => {
    const fti = flightTimeIndex(240);
    const w = groundWeight(fti);
    assertClose(groundPartParts('business', lounge, PLAIN_SIDE, fti).lounge, 4 * w);
    assertClose(groundPartParts('business', lounge, lounge, fti).lounge, 8 * w);
    assertClose(groundPartParts('economy', lounge, lounge, fti).lounge, 0);
  });

  it('2.6.3: Lounge, Stellplatz oder ein weiterer Schalter senken groundPart nie', () => {
    const busy: GroundSide = { ...PLAIN_SIDE, departingSeatsPerWeek: 6000 };
    for (const c of CABIN_CLASSES) {
      for (const minutes of MINUTES) {
        const fti = flightTimeIndex(minutes);
        const base = groundPart(c, busy, PLAIN_SIDE, fti);
        assert.ok(groundPart(c, { ...busy, lounge: true }, PLAIN_SIDE, fti) >= base);
        assert.ok(groundPart(c, { ...busy, stands: 7 }, PLAIN_SIDE, fti) >= base);
        assert.ok(groundPart(c, { ...busy, desks: { normal: 2, self: 0 } }, PLAIN_SIDE, fti) >= base);
        assert.ok(groundPart(c, { ...busy, desks: { normal: 1, self: 1 } }, PLAIN_SIDE, fti) >= base);
        // Selbstbedienung zu einem bedienten Schalter dazu senkt nie.
        assert.ok(groundPart(c, { ...selfOnly, desks: { normal: 1, self: 1 } }, PLAIN_SIDE, fti) >=
          groundPart(c, selfOnly, PLAIN_SIDE, fti));
      }
    }
  });

  it('2.6.3: Stellplätze anteilig bis +2; ohne belegte Slots 0', () => {
    assertClose(groundSidePoints('economy', { ...PLAIN_SIDE, stands: 7 }).stands, 1);
    assertClose(groundSidePoints('economy', { ...PLAIN_SIDE, stands: 30 }).stands, 2);
    assertClose(groundSidePoints('economy', { ...PLAIN_SIDE, stands: 5, occupiedSlots: 0 }).stands, 0);
  });

  it('2.6.3 (E55): Premium-Klassen −10 an einem Ende nur mit Selbstbedienung; Economy hängt nicht von der Schalter-Art ab', () => {
    for (const c of CABIN_CLASSES) {
      const expected = c === 'economy' ? 0 : DESK_TYPE_PENALTY;
      assert.equal(groundSidePoints(c, selfOnly).deskType, expected);
      assert.equal(groundSidePoints(c, PLAIN_SIDE).deskType, 0);
    }
    const fti = flightTimeIndex(240);
    assertClose(groundPart('economy', selfOnly, selfOnly, fti), groundPart('economy', PLAIN_SIDE, PLAIN_SIDE, fti));
    assertClose(groundPartParts('first', selfOnly, PLAIN_SIDE, fti).deskType, (DESK_TYPE_PENALTY / 2) * groundWeight(fti));
  });

  it('2.6.3: Schalter-Auslastung zählt Sitze je Woche / Kapazität (5 000 bedient, 10 000 Selbstbedienung)', () => {
    assertClose(deskLoad(5000, { normal: 1, self: 0 }), 1);
    assertClose(deskLoad(7500, { normal: 1, self: 1 }), 0.5);
    assert.equal(DESK_CAPACITY.self, 2 * DESK_CAPACITY.normal);
    assert.equal(deskLoad(0, { normal: 0, self: 0 }), 0);
  });

  it('2.6.3: Überlast-Kurve: bis 80 % 0, −4 bei 100 %, −20 ab 110 %, stetig, in −20 … 0', () => {
    assert.equal(deskOverloadPoints(0.8), 0);
    assertClose(deskOverloadPoints(0.9), -2);
    assertClose(deskOverloadPoints(1), -4);
    assertClose(deskOverloadPoints(1.1), -20);
    assert.equal(deskOverloadPoints(Number.POSITIVE_INFINITY), -DESK_OVERLOAD_MAX);
    let previous = 0;
    for (let load = 0; load <= 1.5; load += 0.001) {
      const points = deskOverloadPoints(load);
      assert.ok(points <= previous + 1e-12 && points >= -DESK_OVERLOAD_MAX);
      // Schritt 0,1 Prozentpunkt: höchstens 1,6 × 0,1 = 0,16 Punkte, kein Sprung.
      assert.ok(previous - points <= 0.16 + 1e-9, `Sprung bei ${load}`);
      previous = points;
    }
  });

  it('2.6.3: Überlast als Mittel beider Enden mit Bodengewicht: ≥ −20 × groundWeight (W3)', () => {
    const jammed: GroundSide = { ...PLAIN_SIDE, departingSeatsPerWeek: 50000 };
    for (const minutes of MINUTES) {
      const fti = flightTimeIndex(minutes);
      const parts = groundPartParts('economy', jammed, jammed, fti);
      assertClose(parts.deskOverload, -DESK_OVERLOAD_MAX * groundWeight(fti));
    }
  });

  it('F21: Sitze ohne jeden Schalter (Pflicht verletzt) = volle Überlast, kein eigener Abzug', () => {
    const none: GroundSide = { ...PLAIN_SIDE, desks: { normal: 0, self: 0 } };
    assert.equal(deskLoad(1000, none.desks), Number.POSITIVE_INFINITY);
    assert.equal(groundSidePoints('economy', none).deskOverload, -DESK_OVERLOAD_MAX);
  });
});

describe('Abschnitt 2.6.4 und 2.6.5 Personal und Forschung', () => {
  it('2.6.4: (Moral − 50) × 0,1: −5 … +5, 0 bei 50', () => {
    assertClose(staffPart(0), -5);
    assertClose(staffPart(50), 0);
    assertClose(staffPart(100), 5);
  });

  it('2.6.5: Cabin design studio +2, sat-1 … sat-6 je +1, höchstens +8; jede Id einmal, andere 0', () => {
    assert.equal(researchPart([]), 0);
    assert.equal(researchPart(['cabin']), 2);
    assert.equal(researchPart(['sat-1', 'sat-1', 'fuel-1']), 1);
    assert.equal(researchPart(RESEARCH_PROJECTS.map((p) => p.id)), 8);
  });
});

describe('Abschnitt 2.7 Satisfaction je Klasse', () => {
  it('2.7: Neutralpunkt: alles auf Erwartung, ohne Lounge, Stellplätze, Überlast, Moral 50, keine Forschung → genau 100', () => {
    for (const c of CABIN_CLASSES) {
      for (const minutes of MINUTES) {
        assertClose(satisfaction(c, onExpectation(c, minutes), plainRoute(minutes)), 100, 1e-9, `${c} ${minutes} min`);
      }
    }
  });

  it('2.7: Wert immer in 0 … 160; einmal gekappt, ungerundet', () => {
    const worst: RouteSatisfactionInput = {
      blockMinutes: 900,
      origin: { ...PLAIN_SIDE, desks: { normal: 0, self: 1 }, departingSeatsPerWeek: 1e6 },
      destination: { ...PLAIN_SIDE, desks: { normal: 0, self: 1 }, departingSeatsPerWeek: 1e6 },
      morale: 0,
    };
    const best: RouteSatisfactionInput = {
      blockMinutes: 30,
      origin: { ...PLAIN_SIDE, lounge: true, stands: 99 },
      destination: { ...PLAIN_SIDE, lounge: true, stands: 99 },
      morale: 100,
      completedResearch: RESEARCH_PROJECTS.map((p) => p.id),
    };
    const low = classSatisfactionBreakdown('first', { cabinRating: 0, servicePoints: 0 }, worst);
    assert.ok(low.unclamped < 0);
    assert.equal(low.satisfaction, 0);
    const high = classSatisfactionBreakdown('business', { cabinRating: 100, servicePoints: 1000 }, best);
    assert.ok(high.unclamped > 160);
    assert.equal(high.satisfaction, 160);
    const mid = satisfaction('economy', { cabinRating: 57.3, servicePoints: 13.7 }, plainRoute(123));
    assert.notEqual(mid, Math.round(mid));
  });

  it('2.7: mehr bieten (Kabine, Service, Lounge, Stellplatz, Schalter, Moral, Forschung) senkt sie nie', () => {
    const base: RouteSatisfactionInput = {
      blockMinutes: 300,
      origin: { ...PLAIN_SIDE, desks: { normal: 0, self: 1 }, departingSeatsPerWeek: 9500 },
      destination: PLAIN_SIDE,
      morale: 40,
    };
    for (const c of CABIN_CLASSES) {
      const cls = { cabinRating: 50, servicePoints: 20 };
      const s0 = satisfaction(c, cls, base);
      const better: [string, number][] = [
        ['Kabine', satisfaction(c, { ...cls, cabinRating: 60 }, base)],
        ['Service', satisfaction(c, { ...cls, servicePoints: 30 }, base)],
        ['Lounge', satisfaction(c, cls, { ...base, origin: { ...base.origin, lounge: true } })],
        ['Stellplatz', satisfaction(c, cls, { ...base, destination: { ...PLAIN_SIDE, stands: 5 } })],
        ['Schalter', satisfaction(c, cls, { ...base, origin: { ...base.origin, desks: { normal: 1, self: 1 } } })],
        ['Moral', satisfaction(c, cls, { ...base, morale: 60 })],
        ['Forschung', satisfaction(c, cls, { ...base, completedResearch: ['sat-1'] })],
      ];
      for (const [what, value] of better) assert.ok(value >= s0, `${c}: ${what}`);
    }
  });

  it('2.7: +0,3 Punkte in einem Teil ändern das Ergebnis (Moral +3)', () => {
    const route = plainRoute(240);
    const a = satisfaction('economy', onExpectation('economy', 240), route);
    const b = satisfaction('economy', onExpectation('economy', 240), { ...route, morale: 53 });
    assertClose(b - a, 0.3);
  });

  it('2.7: kein Sprung in der Flugzeit: 1 Minute mehr ändert sie um weniger als 0,5 Punkte', () => {
    const selection: ServiceSelection = { meals: [[WAGYU, COOKIE], [HAM], [HAM]], extras: [], onboardService: [] };
    for (const c of CABIN_CLASSES) {
      let previous: number | undefined;
      for (let minutes = 20; minutes <= 1000; minutes++) {
        const value = satisfaction(c, { cabinRating: 62, servicePoints: servicePoints(selection, minutes, FULL) }, plainRoute(minutes));
        if (previous !== undefined) assert.ok(Math.abs(value - previous) < 0.5, `${c} bei ${minutes} min`);
        previous = value;
      }
    }
  });

  it('2.7: gleiche Eingaben → gleiche Satisfaction (kein Eigentümer, keine Schwierigkeit, keine gestrichenen Flüge in der Eingabe)', () => {
    const cls = { cabinRating: 70, servicePoints: 40 };
    const a = classSatisfactionBreakdown('business', cls, plainRoute(400));
    const b = classSatisfactionBreakdown('business', { ...cls }, { ...plainRoute(400) });
    assert.deepEqual(a, b);
    // Die Summe besteht genau aus den fünf Teilen; einen Ausfall- oder Schwierigkeits-Teil gibt es nicht.
    assertClose(a.unclamped, 100 + a.cabinPart + a.servicePart + a.groundPart.total + a.staffPart + a.researchPart);
  });

  it('2.7: satisfactionBreakdown liefert nur Klassen mit Sitzen, je Klasse dieselben Werte wie satisfaction', () => {
    const route = plainRoute(500);
    const result = satisfactionBreakdown(
      { economy: { cabinRating: 60, servicePoints: 50 }, business: { cabinRating: 75, servicePoints: 120 } },
      route,
    );
    assert.deepEqual(Object.keys(result), ['economy', 'business']);
    assert.equal(result.economy?.satisfaction, satisfaction('economy', { cabinRating: 60, servicePoints: 50 }, route));
  });
});

describe('Abschnitt 2.8 Offer satisfaction', () => {
  it('2.8: eine Strecke allein → ihre Satisfaction; mehrere: nach Sitzen, zwischen kleinster und größter', () => {
    assert.equal(directOfferSatisfaction([{ satisfaction: 104, seatsPerWeek: 1000 }]), 104);
    const value = directOfferSatisfaction([
      { satisfaction: 90, seatsPerWeek: 3000 },
      { satisfaction: 130, seatsPerWeek: 1000 },
      { satisfaction: 10, seatsPerWeek: 0 },
    ]);
    assertClose(value ?? NaN, 100);
  });

  it('2.8: ohne Sitze in der Klasse kein Wert (Angebot nimmt am Markt nicht teil)', () => {
    assert.equal(directOfferSatisfaction([]), undefined);
    assert.equal(directOfferSatisfaction([{ satisfaction: 100, seatsPerWeek: 0 }]), undefined);
  });

  it('2.8: Umsteige-Verbindung: Mittel der Teilstrecken nach blockMinutes', () => {
    const value = connectionOfferSatisfaction([
      { offerSatisfaction: 80, blockMinutes: 60 },
      { offerSatisfaction: 120, blockMinutes: 180 },
    ]);
    assertClose(value ?? NaN, 110);
  });
});

describe('Abschnitt 2.9 Route und Airline satisfaction', () => {
  it('2.9: Route satisfaction nach Fluggästen; ohne Fluggäste nach Sitzen', () => {
    assertClose(
      routeSatisfaction([
        { satisfaction: 90, passengers: 300, seats: 100 },
        { satisfaction: 150, passengers: 100, seats: 300 },
      ]),
      105,
    );
    assertClose(
      routeSatisfaction([
        { satisfaction: 90, passengers: 0, seats: 100 },
        { satisfaction: 150, passengers: 0, seats: 300 },
      ]),
      135,
    );
  });

  it('2.9: Airline satisfaction nach beförderten Fluggästen; ohne Fluggäste 100; ganze Skala bis 160', () => {
    assert.equal(airlineSatisfaction([]), 100);
    assert.equal(airlineSatisfaction([{ satisfaction: 40, passengers: 0 }]), 100);
    assertClose(
      airlineSatisfaction([
        { satisfaction: 160, passengers: 1000 },
        { satisfaction: 160, passengers: 50 },
      ]),
      160,
    );
    assertClose(
      airlineSatisfaction([
        { satisfaction: 80, passengers: 100 },
        { satisfaction: 120, passengers: 300 },
      ]),
      110,
    );
  });
});

describe('Abschnitt 2.10 Satisfaction factor', () => {
  it('2.10: satisfactionFactor(100) = 1; 0 → 0,5; 50 → 0,75; 160 ≈ 1,35', () => {
    assert.equal(satisfactionFactor(100), 1);
    assertClose(satisfactionFactor(0), 0.5);
    assertClose(satisfactionFactor(50), 0.75);
    assertClose(satisfactionFactor(160), 1.354, 1e-9);
  });

  it('2.10: steigt mit s auf 0 … 160 (nie fallend); stetig bei 100', () => {
    let previous = -Infinity;
    for (let s = 0; s <= 160; s += 0.25) {
      const f = satisfactionFactor(s);
      assert.ok(f > previous, `fällt bei ${s}`);
      previous = f;
    }
    assertClose(satisfactionFactor(100 - 1e-9), satisfactionFactor(100 + 1e-9), 1e-9);
  });
});
