/**
 * Regeltests zu SPEZIFIKATION 2.1 (Flugzeit-Index), 2.2 (Type appeal) und 2.5 (Service points).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aircraftList } from '../data/aircraft';
import { EXTRAS_OPTIONS, MEAL_DATA, SERVICE_OPTIONS } from '../data/catering';
import {
  FLIGHT_TIME_INDEX_ANCHORS,
  LAUNCH_BONUS,
  LAUNCH_BONUS_MONTHS,
  MEAL_CATEGORIES,
  MEALS_MAX,
  TYPE_APPEAL_DECAY_FROM,
  TYPE_APPEAL_DECAY_MAX,
  type AircraftClass,
  type MealCategory,
} from './constants';
import {
  flightTimeIndex,
  mealCount,
  mealWeight,
  menuPoints,
  serviceCapability,
  servicePoints,
  servicePointsParts,
  typeAppeal,
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
