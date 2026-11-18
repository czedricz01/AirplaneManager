/**
 * Regeltests zu SPEZIFIKATION Abschnitt 5.1–5.8 (Kosten, Paket 3.5a) und den Teilen des Beispiels 5.18,
 * die ohne feste Kosten der Strecke prüfbar sind.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aircraftList } from '../data/aircraft';
import { jetFuelPrices } from '../data/fuelPrices';
import { atCost, costIndex } from './basics';
import {
  FUEL_CRISES,
  LITRES_PER_GALLON,
  RESEARCH_COST_FLOOR,
  RESEARCH_COST_SAVINGS,
  START_YEAR,
  type AircraftClass,
  type CabinClass,
} from './constants';
import {
  aircraftEfficiency,
  airportFeeFactor,
  cabinCrew,
  cateringCost,
  cateringCostParts,
  checkInFee,
  costPerPassenger,
  crewCost,
  crewHourlyRate,
  crisisFuelShape,
  departureShares,
  ffpCostPerPassenger,
  fuelCost,
  fuelLitresPerSeat100km,
  fuelPrice,
  fuelTable,
  handlingFee,
  hubFeeFactor,
  landingCost,
  landingFee,
  payFactor,
  researchCostFactor,
  transferCostPerPassenger,
  type EndFees,
  type LandingAircraft,
} from './costs';
import { blockMinutes, distanceKm, type Coords } from './demand';
import { serviceCapability, servicePointsParts, type ServiceSelection } from './satisfaction';

const close = (actual: number, expected: number, tol = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} ≠ ${expected} (± ${tol})`);

/** Spielmonat aus Jahr und Kalendermonat (1 = Januar). */
const m = (year: number, calendarMonth = 1) => (year - START_YEAR) * 12 + calendarMonth - 1;

/** Rohwert der Tabelle ohne Krisen-Form. */
const raw = (month: number) => {
  const y = START_YEAR + Math.floor(month / 12);
  return jetFuelPrices[`${y}-${String((month % 12) + 1).padStart(2, '0')}`];
};

const typeOf = (name: string) => {
  const t = aircraftList.find((a) => a.type === name);
  if (!t) throw new Error(name);
  return t;
};
const landingAircraft = (name: string): LandingAircraft => {
  const t = typeOf(name);
  return { aircraftClass: t.class as AircraftClass, capacity: t.capacity, cruiseSpeed: t.cruiseSpeed };
};

const FRANKFURT: Coords = [50.03, 8.57];
const PARIS: Coords = [49.01, 2.55];
const MADRID: Coords = [40.47, -3.56];
const NEW_YORK: Coords = [40.64, -73.78];

const NARROW_CAPABILITY = serviceCapability({
  aircraftClass: 'Narrowbody',
  hasWifi: false,
  hasPremiumGalley: false,
  cateringFacility: false,
});
const WIDE_CAPABILITY = serviceCapability({
  aircraftClass: 'Widebody',
  hasWifi: false,
  hasPremiumGalley: false,
  cateringFacility: false,
});
const PEANUTS: ServiceSelection = { meals: [['b5'], ['b5'], ['b5']], extras: [], onboardService: [] };

describe('Abschnitt 5.1 Kosten-Faktoren', () => {
  it('5.1: ohne Forschung ist jeder Faktor 1 (KI)', () => {
    for (const kind of ['fuel', 'crew', 'fees', 'catering', 'maintenance', 'slots'] as const) {
      assert.equal(researchCostFactor(kind), 1);
    }
  });

  it('5.1: Treibstoff 3 + 3 + 1 % → 0,93; Slots 8 % → 0,92', () => {
    close(researchCostFactor('fuel', ['fuel-1', 'fuel-2', 'fuel-3']), 0.93);
    close(researchCostFactor('slots', ['slots']), 0.92);
  });

  it('5.1: unbekannte Ids zählen nicht, doppelte einmal, andere Arten nicht', () => {
    assert.equal(researchCostFactor('crew', ['gibt-es-nicht', 'fuel-1']), 1);
    close(researchCostFactor('crew', ['crew-1', 'crew-1']), 0.99);
  });

  it('5.1: der Faktor sinkt nie unter RESEARCH_COST_FLOOR', () => {
    const all = Object.keys(RESEARCH_COST_SAVINGS);
    for (const kind of ['fuel', 'crew', 'fees', 'catering', 'maintenance', 'slots'] as const) {
      assert.ok(researchCostFactor(kind, all) >= RESEARCH_COST_FLOOR);
    }
  });

  it('5.1: Lohn-Faktor = Lohn / 100', () => {
    assert.equal(payFactor(100), 1);
    close(payFactor(80), 0.8);
    close(payFactor(130), 1.3);
  });

  it('5.1: Gebühren-Faktor ≤ 1, höhere Stufe nie teurer; Stufe 2 → 0,95, Stufe 3 → 0,85', () => {
    assert.equal(hubFeeFactor(0), 1);
    assert.equal(hubFeeFactor(1), 1);
    assert.equal(hubFeeFactor(2), 0.95);
    assert.equal(hubFeeFactor(3), 0.85);
    let previous = Infinity;
    for (let tier = 0; tier <= 3; tier++) {
      const f = airportFeeFactor(tier, ['fees-1']);
      assert.ok(f <= 1 && f <= previous);
      previous = f;
    }
  });

  it('5.1: Gebühren-Faktor = Stufe × Forschung', () => {
    close(airportFeeFactor(3, ['fees-1', 'fees-2', 'fees-3']), 0.85 * 0.97);
  });

  it('5.1: eine unbekannte Verwaltungsstufe ist ein Fehler', () => {
    assert.throws(() => hubFeeFactor(4));
    assert.throws(() => hubFeeFactor(-1));
    assert.throws(() => hubFeeFactor(1.5));
  });
});

describe('Abschnitt 5.2 Treibstoffpreis', () => {
  it('5.2: Januar 2031 = Dezember 2030 (letzter Tabellenwert, W3); vor 1960 der erste', () => {
    assert.equal(fuelTable(m(2031, 1)), fuelTable(m(2030, 12)));
    assert.equal(fuelTable(m(2050, 6)), fuelTable(m(2030, 12)));
    assert.equal(fuelTable(-5), jetFuelPrices['1960-01']);
  });

  it('5.2: ohne Krise gilt der Tabellenwert unverändert', () => {
    for (const month of [m(1960), m(1972, 6), m(2001, 9), m(2019, 12), m(2030, 12)]) {
      assert.equal(crisisFuelShape(month), 1);
      assert.equal(fuelTable(month), raw(month));
    }
  });

  it('5.2 (E61): Ölkrise 1973 hat die Form 1,25 / 1,5 / 1,75 / 12 × 2,0 / 1,75 / 1,5 / 1,25, im Mittel 1,83', () => {
    const start = m(1973, 10);
    const expected = [1.25, 1.5, 1.75, ...Array(12).fill(2), 1.75, 1.5, 1.25];
    const shape = expected.map((_, k) => crisisFuelShape(start + k));
    shape.forEach((s, k) => close(s, expected[k]));
    close(shape.reduce((a, b) => a + b, 0) / shape.length, 1 + 15 / 18);
    assert.equal(crisisFuelShape(start - 1), 1);
    assert.equal(crisisFuelShape(start + 18), 1);
  });

  it('5.2 (E61): Juni 1974 kostet der Treibstoff das Doppelte der Rohdaten; Pandemie 2021 × 0,7', () => {
    close(fuelTable(m(1974, 6)) / raw(m(1974, 6)), 2);
    close(fuelTable(m(2021, 1)) / raw(m(2021, 1)), 0.7);
  });

  it('5.2 (E61): die Krisen der Tabelle überschneiden sich nicht', () => {
    const sorted = [...FUEL_CRISES].sort((a, b) => a.startMonth - b.startMonth);
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(sorted[i].startMonth >= sorted[i - 1].startMonth + sorted[i - 1].months);
    }
  });

  it('5.2 / 7.12 (E61): Juni 1974 steigt der Preis so weit über das 24-Monats-Mittel, dass die KI-Krise auslöst', () => {
    const month = m(1974, 6);
    let sum = 0;
    for (let k = 0; k < 24; k++) sum += fuelTable(month - k);
    const severity = (fuelTable(month) / (sum / 24) - 1) / 2;
    assert.ok(severity >= 0.25, `${severity}`);
  });

  it('5.2: Preis je Liter = Tabelle / Gallone × Forschung', () => {
    const month = m(1990, 3);
    close(fuelPrice(month), fuelTable(month) / LITRES_PER_GALLON);
    close(fuelPrice(month, ['fuel-1']), (fuelTable(month) / LITRES_PER_GALLON) * 0.97);
  });

  it('5.2: eine laufende Absicherung ersetzt den Tabellenwert', () => {
    const month = m(1974, 6);
    close(fuelPrice(month, [], fuelTable(m(1973, 9))), fuelTable(m(1973, 9)) / LITRES_PER_GALLON);
  });

  it('5.2: kein Kostenindex: der Preis 2020 ist der Tabellenwert, nicht × costIndex', () => {
    close(fuelPrice(m(2020, 1)) * LITRES_PER_GALLON, raw(m(2020, 1)));
  });
});

describe('Abschnitt 5.3 Treibstoff je Strecke', () => {
  it('5.3: Liter je Sitz und 100 km: Effizienz 50 → 5,12; 72 → 4,22; 96 → 3,54', () => {
    close(fuelLitresPerSeat100km(50), 7.5 / (0.75 + 50 / 70));
    close(fuelLitresPerSeat100km(72), 4.217, 1e-3);
    close(fuelLitresPerSeat100km(96), 3.536, 1e-3);
  });

  it('5.3: mehr Effizienz → nie mehr Treibstoff', () => {
    let previous = Infinity;
    for (let e = 0; e <= 100; e += 5) {
      const l = fuelLitresPerSeat100km(e);
      assert.ok(l <= previous);
      previous = l;
    }
  });

  it('5.3: Effizienz-Forschung +1 je Stufe, höchstens 100, nie unter dem Typwert', () => {
    assert.equal(aircraftEfficiency(60, ['eff-1', 'eff-2', 'eff-3']), 63);
    assert.equal(aircraftEfficiency(98, ['eff-1', 'eff-2', 'eff-3']), 100);
    assert.equal(aircraftEfficiency(60, ['fuel-1']), 60);
  });

  it('5.3: gestrichene Flüge senken den Treibstoff anteilig; Fluggäste zählen nicht', () => {
    const base = { efficiency: 60, capacity: 180, greatCircleKm: 1000, fuelPrice: 0.5 };
    const full = fuelCost({ ...base, flownLegs: 14 });
    close(fuelCost({ ...base, flownLegs: 7 }), full / 2);
    close(full, fuelLitresPerSeat100km(60) * 180 * 10 * 14 * 0.5);
  });
});

describe('Abschnitt 5.4 Besatzung', () => {
  it('5.4: Flugbegleiter nach eingebauter Kabine, mindestens 1', () => {
    close(cabinCrew({ economy: 80 }), 1.6);
    close(cabinCrew({ economy: 150, business: 12 }), 3 + 0.6);
    assert.equal(cabinCrew({ economy: 10 }), 1);
    assert.equal(cabinCrew({}), 1);
  });

  it('5.4: mehr Sitze → nie weniger Besatzung; Business-Sitz teurer als Economy-Sitz', () => {
    const classes: CabinClass[] = ['economy', 'premium', 'business', 'first'];
    for (const c of classes) {
      assert.ok(cabinCrew({ economy: 100, [c]: 30 }) >= cabinCrew({ economy: 100, [c]: 20 }));
    }
    const month = m(1990);
    assert.ok(crewHourlyRate({ economy: 100, business: 1 }, month) > crewHourlyRate({ economy: 101 }, month));
  });

  it('5.4: Stundensatz = atCost(2 × 100 + Flugbegleiter × 40)', () => {
    close(crewHourlyRate({ economy: 80 }, m(1962)), atCost(200 + 1.6 * 40, m(1962)));
  });

  it('5.4: Lohn und Forschung wirken als Faktoren; KI (Lohn 100 %, ohne Forschung) zahlt wie der Spieler', () => {
    const input = { seats: { economy: 150, business: 12 }, blockMinutes: 120, flownLegs: 14, month: m(2000) };
    const neutral = crewCost({ ...input, payFactor: 1 });
    close(neutral, crewHourlyRate(input.seats, input.month) * (120 * 14) / 60);
    close(crewCost({ ...input, payFactor: 1.2, completedResearch: ['crew-1'] }), neutral * 1.2 * 0.99);
  });
});

describe('Abschnitt 5.5 Landegebühr', () => {
  const a320 = landingAircraft('A320ceo');

  it('5.5: Formel: atCost(Grund + je Stufe × Größe) × Sitze / Bezugssitze × Gebühren-Faktor', () => {
    const month = m(1990);
    close(landingFee(a320, 7, month, 0.9), atCost(2750 + 110 * 7, month) * (a320.capacity / 180) * 0.9);
    const wide: LandingAircraft = { aircraftClass: 'Widebody', capacity: 420, cruiseSpeed: 900 };
    close(landingFee(wide, 5, month, 1), atCost(3300 + 165 * 5, month));
  });

  it('5.5: größerer Flughafen → nie billiger; mehr Höchstsitze → nie billiger', () => {
    for (let size = 1; size < 7; size++) {
      assert.ok(landingFee(a320, size + 1, 0, 1) >= landingFee(a320, size, 0, 1));
    }
    assert.ok(landingFee({ ...a320, capacity: 200 }, 5, 0, 1) >= landingFee(a320, 5, 0, 1));
  });

  it('5.5: Propeller-Regional zahlt 85 %, Regional-Jet voll', () => {
    const prop: LandingAircraft = { aircraftClass: 'Regional', capacity: 70, cruiseSpeed: 510 };
    const jet: LandingAircraft = { aircraftClass: 'Regional', capacity: 70, cruiseSpeed: 800 };
    close(landingFee(prop, 4, 0, 1), landingFee(jet, 4, 0, 1) * 0.85);
  });

  it('5.5: je Flugabschnitt eine Landung am Ziel; Einweg zahlt genau eine', () => {
    const month = m(2000);
    const oneWay = landingCost(a320, [{ airportSize: 6, feeFactor: 1, landings: 1 }], month);
    close(oneWay, landingFee(a320, 6, month, 1));
    const roundTrips = landingCost(
      a320,
      [
        { airportSize: 6, feeFactor: 1, landings: 7 },
        { airportSize: 4, feeFactor: 0.95, landings: 7 },
      ],
      month,
    );
    close(roundTrips, 7 * landingFee(a320, 6, month, 1) + 7 * landingFee(a320, 4, month, 0.95));
  });

  it('5.5: eine unbekannte Flugzeugklasse ist ein Fehler (der Zweig „2 200 $“ entfällt)', () => {
    assert.throws(() => landingFee({ aircraftClass: 'Jumbo' as AircraftClass, capacity: 400, cruiseSpeed: 900 }, 5, 0, 1));
  });
});

describe('Abschnitt 5.6 Check-in und Abfertigung', () => {
  it('5.6: Abfertigung 6 / 8 / 10 $ (1960) nach Flughafengröße; Check-in 1 $', () => {
    assert.equal(handlingFee(1, 0, 1), 6);
    assert.equal(handlingFee(2, 0, 1), 6);
    assert.equal(handlingFee(3, 0, 1), 8);
    assert.equal(handlingFee(4, 0, 1), 8);
    assert.equal(handlingFee(5, 0, 1), 10);
    assert.equal(handlingFee(7, 0, 1), 10);
    assert.equal(checkInFee(0, 1), 1);
    close(handlingFee(5, m(2020), 1), 10 * costIndex(m(2020)));
  });

  it('5.6: Stufe 3 senkt Check-in, Abfertigung und Landung um denselben Anteil', () => {
    const month = m(1995);
    const f3 = airportFeeFactor(3);
    const a320 = landingAircraft('A320ceo');
    close(checkInFee(month, f3) / checkInFee(month, 1), 0.85);
    close(handlingFee(6, month, f3) / handlingFee(6, month, 1), 0.85);
    close(landingFee(a320, 6, month, f3) / landingFee(a320, 6, month, 1), 0.85);
  });

  it('5.6: ein Direktgast zahlt je Reise genau einen Check-in', () => {
    const end: EndFees = { checkInFee: 1, handlingFee: 0, departureShare: 0.5 };
    close(costPerPassenger({ cateringCost: 0, ends: [end, end], ffpCostPerPassenger: 0 }), 1);
  });

  it('5.6: ein Umsteiger zahlt über beide Teilstrecken einen Check-in und zwei Abfertigungen', () => {
    // Gleiche Gebühren überall: Check-in 1 $, Abfertigung `handling`; zwei Teilstrecken X1–H und H–X2.
    const fees = (handling: number): EndFees => ({ checkInFee: 1, handlingFee: handling, departureShare: 0.5 });
    const leg = (handling: number) =>
      transferCostPerPassenger({ cateringCost: 0, outer: fees(handling), hub: fees(handling), ffpCostPerPassenger: 0 });
    close(2 * leg(0), 1);
    close(2 * leg(8), 1 + 2 * 8);
  });
});

describe('Abschnitt 5.7 Verpflegung', () => {
  const SHORT = 90;
  const LONG = 600;

  it('5.7: Erdnüsse (0,44 $) auf Kurzstrecke: eine Mahlzeit, mit Kostenindex', () => {
    close(cateringCost(PEANUTS, SHORT, NARROW_CAPABILITY, 0), 0.44);
    close(cateringCost(PEANUTS, SHORT, NARROW_CAPABILITY, m(2020)), atCost(0.44, m(2020)));
  });

  it('5.7: ein weiteres Gericht oder Extra senkt die Kosten nie; jedes Gericht kostet voll', () => {
    const one: ServiceSelection = { meals: [['s15']], extras: [], onboardService: [] };
    const two: ServiceSelection = { meals: [['s15', 'b1']], extras: [], onboardService: [] };
    const plusExtra: ServiceSelection = { meals: [['s15', 'b1']], extras: ['amenities'], onboardService: ['drinks'] };
    const c1 = cateringCost(one, SHORT, NARROW_CAPABILITY, 0);
    const c2 = cateringCost(two, SHORT, NARROW_CAPABILITY, 0);
    close(c2 - c1, 0.3);
    assert.ok(cateringCost(plusExtra, SHORT, NARROW_CAPABILITY, 0) >= c2);
  });

  it('5.7: Mahlzeiten-Gewichte für Punkte und Kosten sind dieselben Zahlen', () => {
    for (const minutes of [60, 300, 420, 600, 900]) {
      const points = servicePointsParts(PEANUTS, minutes, WIDE_CAPABILITY);
      const cost = cateringCostParts(PEANUTS, minutes, WIDE_CAPABILITY);
      points.meals.forEach((meal, i) => assert.equal(cost.meals[i].weight, meal.weight));
    }
  });

  it('5.7: 1 Minute mehr Flugzeit ändert die Kosten um weniger als 1 % (R5)', () => {
    for (let minutes = 60; minutes <= 900; minutes += 7) {
      const a = cateringCost(PEANUTS, minutes, WIDE_CAPABILITY, 0);
      const b = cateringCost(PEANUTS, minutes + 1, WIDE_CAPABILITY, 0);
      assert.ok(Math.abs(b - a) < 0.01 * a, `${minutes} min`);
    }
  });

  it('5.7: was nicht an Bord kommt, kostet nichts (Luxus-Gericht im Narrowbody, WLAN ohne WLAN)', () => {
    const luxury: ServiceSelection = { meals: [['l1']], extras: ['wifi_unlimited'], onboardService: [] };
    assert.equal(cateringCost(luxury, LONG, NARROW_CAPABILITY, 0), 0);
  });

  it('5.7: Forschung Verpflegung 2 + 2 % wirkt als Faktor', () => {
    close(
      cateringCost(PEANUTS, SHORT, NARROW_CAPABILITY, 0, ['catering-1', 'catering-2']),
      0.44 * 0.96,
    );
  });
});

describe('Abschnitt 5.8 Kosten je Fluggast', () => {
  it('5.8: Anteile der Abflüge: Hin und Zurück je 0,5; ohne Abflüge ein Fehler', () => {
    assert.deepEqual(departureShares(7, 7), [0.5, 0.5]);
    assert.deepEqual(departureShares(3, 1), [0.75, 0.25]);
    assert.throws(() => departureShares(0, 0));
  });

  it('5.8: Frequent flyer je Reise nur, solange das Programm läuft', () => {
    assert.equal(ffpCostPerPassenger(false, m(2000)), 0);
    close(ffpCostPerPassenger(true, m(2000)), atCost(0.8, m(2000)));
  });

  it('5.8: Summe über alle Fluggäste = Verpflegung + Check-in + Abfertigung + FFP', () => {
    const a: EndFees = { checkInFee: 1.1, handlingFee: 9, departureShare: 0.5 };
    const b: EndFees = { checkInFee: 0.9, handlingFee: 7, departureShare: 0.5 };
    const passengers = 200;
    const per = costPerPassenger({ cateringCost: 3, ends: [a, b], ffpCostPerPassenger: 0.8 });
    const fromA = passengers * 0.5;
    const fromB = passengers * 0.5;
    const total = passengers * 3 + fromA * (1.1 + 9 + 0.8) + fromB * (0.9 + 7 + 0.8);
    close(per * passengers, total);
  });

  it('5.8: Umsteiger: Verpflegung und Abfertigung auf jeder Teilstrecke, halber Check-in außen, FFP halb', () => {
    const outer: EndFees = { checkInFee: 1, handlingFee: 6, departureShare: 0.5 };
    const hub: EndFees = { checkInFee: 1, handlingFee: 10, departureShare: 0.5 };
    close(transferCostPerPassenger({ cateringCost: 2, outer, hub, ffpCostPerPassenger: 0.8 }), 2 + 3 + 5 + 0.5 * 1.8);
  });
});

describe('Beispiel 5.18 (Teil 3.5a): Kosten je Fluggast und Anteile des Flugbetriebs', () => {
  /** Fälle aus 5.18: Typ, Ziel, Jahr, Umläufe je Woche, Sitze, Kosten je Woche, Anteile Treibstoff / Landung / Besatzung, je Fluggast. */
  const CASES = [
    ['Caravelle III', PARIS, 1962, 14, { economy: 80 }, 118_610, 0.19, 0.38, 0.05, 11.72],
    ['ATR 72-200', PARIS, 1990, 14, { economy: 68 }, 131_298, 0.10, 0.40, 0.08, 16.36],
    ['A320ceo', MADRID, 1990, 7, { economy: 150, business: 12 }, 252_074, 0.20, 0.29, 0.05, 16.36],
    ['A320ceo', MADRID, 2020, 7, { economy: 150, business: 12 }, 399_516, 0.27, 0.26, 0.05, 23.40],
    ['A330-300', NEW_YORK, 1995, 7, { economy: 250, business: 30 }, 914_924, 0.53, 0.11, 0.08, 17.89],
    ['A330-300', NEW_YORK, 2020, 7, { economy: 250, business: 30 }, 1_707_833, 0.66, 0.08, 0.06, 24.10],
  ] as const;

  for (const [name, to, year, roundTrips, seats, totalCost, fuelShare, landingShare, crewShare, perPax] of CASES) {
    it(`5.18: ${name} FRA–${to === PARIS ? 'CDG' : to === MADRID ? 'MAD' : 'JFK'} ${year}`, () => {
      const t = typeOf(name);
      const month = m(year);
      const km = distanceKm(FRANKFURT, to);
      const minutes = blockMinutes(km, t.cruiseSpeed);
      const legs = 2 * roundTrips;

      // Je Fluggast: Erdnüsse je Mahlzeit, Größe 7 an beiden Enden, ohne Forschung und Frequent flyer.
      const end: EndFees = { checkInFee: checkInFee(month, 1), handlingFee: handlingFee(7, month, 1), departureShare: 0.5 };
      const capability = serviceCapability({
        aircraftClass: t.class as AircraftClass,
        hasWifi: false,
        hasPremiumGalley: false,
        cateringFacility: false,
      });
      const pax = costPerPassenger({
        cateringCost: cateringCost(PEANUTS, minutes, capability, month),
        ends: [end, end],
        ffpCostPerPassenger: 0,
      });
      close(pax, perPax, 0.005);

      // Anteile an den Kosten der Woche (ganze Prozent im Beispiel → ± 0,5 Prozentpunkte).
      const fuel = fuelCost({
        efficiency: t.efficiency,
        capacity: t.capacity,
        greatCircleKm: km,
        flownLegs: legs,
        fuelPrice: fuelPrice(month),
      });
      const landing = landingCost(
        landingAircraft(name),
        [
          { airportSize: 7, feeFactor: 1, landings: roundTrips },
          { airportSize: 7, feeFactor: 1, landings: roundTrips },
        ],
        month,
      );
      const crew = crewCost({ seats, blockMinutes: minutes, flownLegs: legs, month, payFactor: 1 });
      close(fuel / totalCost, fuelShare, 0.005);
      close(landing / totalCost, landingShare, 0.005);
      close(crew / totalCost, crewShare, 0.005);
    });
  }
});
