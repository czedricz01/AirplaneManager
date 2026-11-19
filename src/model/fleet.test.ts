/**
 * Regeltests zu SPEZIFIKATION 5.12 (Flugzeug-Unterhalt) und 5.13 (Wertmodell und Abschreibung). Paket 3.5b.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { atCost } from './basics';
import { DEPRECIATION_YEARS, RESIDUAL_SHARE, START_YEAR } from './constants';
import {
  ageDepreciation,
  ageFactor,
  aircraftUpkeep,
  aircraftUpkeepParts,
  aircraftValue,
  commonalityFactor,
  conditionFactor,
  familyDiscount,
  fleetCommonalityFactors,
  fleetValueResult,
  fleetValueResultParts,
  maintenanceRate,
  newAircraftPrice,
  newPrice,
  valueBase,
  varietyPenalty,
  type AircraftUpkeepInput,
  type ValuedAircraft,
} from './fleet';

const close = (actual: number, expected: number, tol = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} ≠ ${expected} (± ${tol})`);

const m = (year: number, calendarMonth = 1) => (year - START_YEAR) * 12 + calendarMonth - 1;

describe('Abschnitt 5.12 Flugzeug-Unterhalt', () => {
  const base: AircraftUpkeepInput = {
    listPrice1960: 40_000_000,
    builtMonth: m(1990),
    month: m(1990),
    commonalityFactor: 1,
    parked: false,
  };

  it('5.12: neu = Neupreis × (0,6 % + 3 %) / 12 im Geld des Monats', () => {
    close(aircraftUpkeep(base), (atCost(40_000_000, m(1990)) * 0.036) / 12);
    close(newPrice(40_000_000, m(1990)), atCost(40_000_000, m(1990)));
  });

  it('5.12: Wartung steigt gerade von 3 % auf 8 % bis 25 Jahre, danach fest', () => {
    assert.equal(maintenanceRate(0), 0.03);
    close(maintenanceRate(12.5), 0.055, 1e-12);
    assert.equal(maintenanceRate(25), 0.08);
    assert.equal(maintenanceRate(40), 0.08);
  });

  it('5.12: älter → nie billiger (Alter seit Baumonat)', () => {
    let previous = 0;
    for (let years = 0; years <= 40; years++) {
      const upkeep = aircraftUpkeep({ ...base, builtMonth: base.month - years * 12 });
      assert.ok(upkeep >= previous);
      previous = upkeep;
    }
  });

  it('5.12: geparkt = halb', () => {
    close(aircraftUpkeep({ ...base, parked: true }), aircraftUpkeep(base) / 2);
  });

  it('5.12 (W15): Jahreswert = Monatswert × 12 bei gleichem Alter', () => {
    const parts = aircraftUpkeepParts({ ...base, builtMonth: m(1980) });
    close(parts.total * 12, newPrice(40_000_000, m(1990)) * (0.006 + maintenanceRate(10)));
    close(parts.total, parts.insurance + parts.maintenance);
  });

  it('5.12: Forschung Wartung (4 × 1 %) senkt nur die Wartung, nicht die Versicherung', () => {
    const plain = aircraftUpkeepParts(base);
    const researched = aircraftUpkeepParts({ ...base, completedResearch: ['maint-1', 'maint-2', 'maint-3', 'maint-4'] });
    close(researched.insurance, plain.insurance);
    close(researched.maintenance, plain.maintenance * 0.96);
  });

  it('5.12: Flotten-Mischung: Nachlass 4 / 8 / 12 / 15 % ab 3 / 6 / 12 / 25, Zuschlag 3 % je Familie über 3, höchstens 30 %', () => {
    assert.equal(familyDiscount(2), 0);
    assert.equal(familyDiscount(3), 0.04);
    assert.equal(familyDiscount(11), 0.08);
    assert.equal(familyDiscount(25), 0.15);
    assert.equal(varietyPenalty(3), 0);
    close(varietyPenalty(5), 0.06, 1e-12);
    assert.equal(varietyPenalty(40), 0.3);
    close(commonalityFactor(10, 1), 0.92, 1e-12);
  });

  it('5.12: zehn Flugzeuge einer Familie warten billiger als zehn Familien', () => {
    const one = fleetCommonalityFactors(Array.from({ length: 10 }, () => ({ family: 'A320' })));
    const ten = fleetCommonalityFactors(Array.from({ length: 10 }, (_, i) => ({ family: `F${i}` })));
    one.forEach((f) => close(f, 0.92, 1e-12));
    ten.forEach((f) => close(f, 1.21, 1e-12));
  });

  it('5.12 / 5.17: gleiche Flotte → gleicher Unterhalt für Spieler und KI (ohne Forschung)', () => {
    const fleet = [{ family: 'A320' }, { family: 'A320' }, { family: 'A320' }, { family: 'B737' }];
    const factors = fleetCommonalityFactors(fleet);
    const player = factors.map((f) => aircraftUpkeep({ ...base, commonalityFactor: f, completedResearch: [] }));
    const ai = factors.map((f) => aircraftUpkeep({ ...base, commonalityFactor: f }));
    assert.deepEqual(player, ai);
  });
});

describe('Abschnitt 5.13 Wertmodell', () => {
  const bought = m(1990, 4);
  const plane: ValuedAircraft = {
    listPrice1960: 40_000_000,
    builtMonth: bought,
    cabinListPrice1960: 500_000,
    cabinInstalledMonth: bought,
    airframeCondition: 100,
    cabinCondition: 100,
  };

  it('5.13: ein neues Flugzeug ist genau seinen Kaufpreis wert (mit Kabine, kein Sofort-Verlust)', () => {
    const price = newAircraftPrice(40_000_000, 500_000, bought);
    close(price, atCost(40_500_000, bought));
    close(aircraftValue(plane, bought), price);
  });

  it('5.13: älter oder abgenutzter → nie mehr Wert', () => {
    let previous = Infinity;
    for (let k = 0; k <= 40 * 12; k += 6) {
      const value = aircraftValue(plane, bought + k);
      assert.ok(value <= previous);
      previous = value;
    }
    for (let c = 100; c >= 0; c -= 10) {
      assert.ok(aircraftValue({ ...plane, airframeCondition: c }, bought) <= aircraftValue({ ...plane, airframeCondition: c + 10 }, bought));
      assert.ok(aircraftValue({ ...plane, cabinCondition: c }, bought) <= aircraftValue({ ...plane, cabinCondition: c + 10 }, bought));
    }
  });

  it('5.13: nach 25 Jahren bei Zustand 100 genau 20 % von valueBase, danach nicht weniger', () => {
    close(aircraftValue(plane, bought + DEPRECIATION_YEARS * 12), RESIDUAL_SHARE * valueBase(plane));
    close(aircraftValue(plane, bought + 40 * 12), RESIDUAL_SHARE * valueBase(plane));
    close(ageFactor(12.5), 0.6, 1e-12);
  });

  it('5.13: Zustand 100 ist neutral, ganz abgenutzt 0,4; Zelle zählt 75 %', () => {
    assert.equal(conditionFactor(100, 100), 1);
    close(conditionFactor(0, 0), 0.4, 1e-12);
    close(conditionFactor(0, 100), 1 - 0.6 * 0.75, 1e-12);
  });

  it('5.13 (R13): ein Gebrauchtflugzeug hat dieselbe valueBase wie als Neuflugzeug (kein späterer Index)', () => {
    close(valueBase(plane), newAircraftPrice(40_000_000, 500_000, bought));
    // Zehn Jahre später ist der Neupreis gestiegen, der Grundwert des alten Flugzeugs nicht.
    assert.ok(newAircraftPrice(40_000_000, 500_000, bought + 120) > valueBase(plane));
  });

  it('5.13: gleiches Flugzeug → gleicher Wert für Spieler, KI und Gebrauchtmarkt', () => {
    const copy: ValuedAircraft = { ...plane };
    assert.equal(aircraftValue(copy, m(2001)), aircraftValue(plane, m(2001)));
  });

  it('5.13: planbare Abschreibung über 25 Jahre = 80 % von valueBase, danach 0', () => {
    let total = 0;
    for (let k = 0; k < DEPRECIATION_YEARS * 12; k++) total += ageDepreciation(plane, bought + k);
    close(total, (1 - RESIDUAL_SHARE) * valueBase(plane));
    close(total, valueBase(plane) - aircraftValue(plane, bought + DEPRECIATION_YEARS * 12));
    assert.equal(ageDepreciation(plane, bought + DEPRECIATION_YEARS * 12), 0);
  });

  it('5.13 (W13): ein Kauf zum Wert ändert das Monatsergebnis nicht', () => {
    const price = newAircraftPrice(40_000_000, 0, bought);
    const result = fleetValueResultParts({
      valueStart: 10e6,
      valueEnd: 10e6 + price,
      tradeValueChange: price,
      purchases: price,
      refits: 0,
      overhauls: 0,
      saleProceeds: 0,
    });
    close(result.trades, 0);
    close(result.depreciation, 0);
    close(result.total, 0);
  });

  it('5.13: über die ganze Haltezeit Σ fleetValueResult = Verkaufserlös − Kaufpreis − Umbauten − Überholungen', () => {
    const held = 7 * 12;
    const price = newAircraftPrice(plane.listPrice1960, plane.cabinListPrice1960, bought);
    const valueAt = (month: number) => aircraftValue(plane, month);
    const sale = 0.85 * valueAt(bought + held);
    let total = 0;
    for (let k = 0; k <= held; k++) {
      const month = bought + k;
      const isBuy = k === 0;
      const isSale = k === held;
      total += fleetValueResult({
        valueStart: isBuy ? 0 : valueAt(month),
        valueEnd: isSale ? 0 : valueAt(month + 1),
        tradeValueChange: (isBuy ? price : 0) - (isSale ? valueAt(month) : 0),
        purchases: isBuy ? price : 0,
        refits: 0,
        overhauls: 0,
        saleProceeds: isSale ? sale : 0,
      });
    }
    close(total, sale - price, 1e-3);
  });

  it('5.13 (E30): Kaufen und sofort unter Wert verkaufen bringt nie Gewinn', () => {
    const price = newAircraftPrice(40_000_000, 0, bought);
    const result = fleetValueResultParts({
      valueStart: 0,
      valueEnd: 0,
      tradeValueChange: 0,
      purchases: price,
      refits: 0,
      overhauls: 0,
      saleProceeds: 0.85 * price,
    });
    assert.ok(result.total < 0);
    close(result.depreciation, 0);
  });
});
