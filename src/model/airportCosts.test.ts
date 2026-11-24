/**
 * Regeltests zu SPEZIFIKATION 5.10 (Slots, Abstellplätze, Schalter), 5.11 (Verwaltungsstufen und Einrichtungen)
 * und 5.15 (Einnahme eigener Flughäfen). Paket 3.5b.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { atCost, costIndex } from './basics';
import {
  airportUpkeep,
  airportUpkeepParts,
  deskRent,
  facilityPrice,
  facilityUpkeep,
  hasStands,
  slotClassAvailable,
  isDeskTypeAvailable,
  managementTierPrice,
  ownerFeeIncome,
  slotLimit,
  slotPrice,
  slotRent,
  slotResalePrice,
  standRent,
  type AirportHoldings,
} from './airportCosts';
import { START_YEAR, type AircraftClass } from './constants';
import { airportFeeFactor, landingFee, type LandingAircraft } from './costs';

const close = (actual: number, expected: number, tol = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} ≠ ${expected} (± ${tol})`);

const m = (year: number, calendarMonth = 1) => (year - START_YEAR) * 12 + calendarMonth - 1;

const HOLDINGS: AirportHoldings = {
  airportSize: 6,
  managementTier: 1,
  feeFactor: 1,
  slots: { Narrowbody: 14, Widebody: 7 },
  stands: { Narrowbody: 4, Widebody: 2 },
  desks: { normal: 2, self: 1 },
  deskLoad: 0.5,
  facilities: [],
};

describe('Abschnitt 5.10 Slots', () => {
  it('5.10: Grenze = 300 Slots je Größenstufe, alle Arten und Gesellschaften zusammen', () => {
    assert.equal(slotLimit(1), 300);
    assert.equal(slotLimit(7), 2100);
  });

  it('5.10: Slot-Preis 2020 = Preis 1960 × costIndex 2020 (ohne Forschung), ungerundet', () => {
    const month = m(2020);
    close(slotPrice('Regional', month), 25_000 * costIndex(month), 1e-6);
    close(slotPrice('Narrowbody', month), 50_000 * costIndex(month), 1e-6);
    close(slotPrice('Widebody', month), 100_000 * costIndex(month), 1e-6);
    assert.notEqual(slotPrice('Narrowbody', month) % 50, 0);
  });

  it('5.10: Forschung (−8 %) und Meilenstein-Nachlass wirken als Faktoren', () => {
    const month = m(1990);
    close(slotPrice('Narrowbody', month, ['slots'], 0.9), atCost(50_000, month) * 0.92 * 0.9, 1e-6);
  });

  it('5.10: Verkauf bringt die Hälfte des Preises im Verkaufsmonat', () => {
    const month = m(2005, 6);
    close(slotResalePrice('Widebody', month), 0.5 * slotPrice('Widebody', month), 1e-6);
  });

  it('5.10: Miete 125 / 250 / 250 $ (1960) je Woche, mit Gebühren-Faktor', () => {
    assert.equal(slotRent('Regional', 0, 1), 125);
    assert.equal(slotRent('Narrowbody', 0, 1), 250);
    assert.equal(slotRent('Widebody', 0, 1), 250);
    close(slotRent('Narrowbody', m(2000), airportFeeFactor(3)), atCost(250, m(2000)) * 0.85, 1e-9);
  });

  it('5.10: eine unbekannte Slot-Art ist ein Fehler', () => {
    assert.throws(() => slotRent('Jumbo' as AircraftClass, 0, 1));
  });
});

describe('Abschnitt 5.10 Abstellplätze', () => {
  it('5.10: nur an Flughäfen ab Größe 3', () => {
    assert.equal(hasStands(2), false);
    assert.equal(hasStands(3), true);
  });

  it('E78: Widebody-Slots erst ab Größe 3, für alle; Regional und Narrowbody überall', () => {
    for (const size of [1, 2]) assert.equal(slotClassAvailable('Widebody', size), false);
    for (const size of [3, 4, 5]) assert.equal(slotClassAvailable('Widebody', size), true);
    for (const size of [1, 2, 3, 5]) {
      assert.equal(slotClassAvailable('Regional', size), true);
      assert.equal(slotClassAvailable('Narrowbody', size), true);
    }
  });

  it('5.10 (E28): Stufe 0–1 zahlt Miete 150 / 300 / 600 $, ab Stufe 2 ist sie 0', () => {
    assert.equal(standRent('Regional', 0, 0, 1), 150);
    assert.equal(standRent('Narrowbody', 0, 1, 1), 300);
    assert.equal(standRent('Widebody', 0, 1, 1), 600);
    assert.equal(standRent('Widebody', m(2000), 2, 0.95), 0);
    assert.equal(standRent('Widebody', m(2000), 3, 0.85), 0);
  });

  it('5.10: Abstellplätze an einem kleinen Flughafen sind ein Fehler', () => {
    assert.throws(() => airportUpkeep({ ...HOLDINGS, airportSize: 2 }, 0));
  });
});

describe('Abschnitt 5.10 Check-in-Schalter', () => {
  it('5.10: Selbstbedienung erst ab 1995, bediente Schalter immer', () => {
    assert.equal(isDeskTypeAvailable('self', m(1994, 12)), false);
    assert.equal(isDeskTypeAvailable('self', m(1995)), true);
    assert.equal(isDeskTypeAvailable('normal', 0), true);
  });

  it('5.10: Miete = Satz × (0,2 + 0,8 × min(1, deskLoad)) × Gebühren-Faktor', () => {
    assert.equal(deskRent('normal', 0, 0, 1), 500);
    assert.equal(deskRent('normal', 0, 1, 1), 2500);
    assert.equal(deskRent('normal', 0, 3, 1), 2500);
    close(deskRent('self', 0, 0.5, 0.95), 1500 * 0.6 * 0.95);
  });
});

describe('Abschnitt 5.10 Laufende Kosten am Flughafen', () => {
  it('5.10: airportUpkeep = Slots + Stände + Schalter + Einrichtungen', () => {
    const parts = airportUpkeepParts({ ...HOLDINGS, facilities: ['hangar'] }, 0);
    close(parts.slots, 14 * 250 + 7 * 250);
    close(parts.stands, 4 * 300 + 2 * 600);
    close(parts.desks, 2 * 2500 * 0.6 + 1500 * 0.6);
    close(parts.facilities, 10_000);
    close(parts.total, parts.slots + parts.stands + parts.desks + parts.facilities);
  });

  it('5.10: airportUpkeep steigt nie mit weniger Slots, Ständen oder Schaltern', () => {
    const full = airportUpkeep(HOLDINGS, m(1990));
    assert.ok(airportUpkeep({ ...HOLDINGS, slots: { Narrowbody: 13, Widebody: 7 } }, m(1990)) <= full);
    assert.ok(airportUpkeep({ ...HOLDINGS, stands: { Narrowbody: 3, Widebody: 2 } }, m(1990)) <= full);
    assert.ok(airportUpkeep({ ...HOLDINGS, desks: { normal: 1, self: 1 } }, m(1990)) <= full);
  });

  it('5.10: im Geld des aktuellen Monats (nicht in Preisen von 1960)', () => {
    close(airportUpkeep(HOLDINGS, m(2020)), airportUpkeep(HOLDINGS, 0) * costIndex(m(2020)), 1e-6);
  });

  it('5.1 / 5.10: der Gebühren-Faktor wirkt auf Slot-, Stand- und Schalter-Miete, nicht auf Einrichtungen', () => {
    const plain = airportUpkeepParts({ ...HOLDINGS, facilities: ['vipLounge'] }, 0);
    const cheap = airportUpkeepParts({ ...HOLDINGS, feeFactor: 0.9, facilities: ['vipLounge'] }, 0);
    close(cheap.slots, plain.slots * 0.9);
    close(cheap.stands, plain.stands * 0.9);
    close(cheap.desks, plain.desks * 0.9);
    close(cheap.facilities, plain.facilities);
  });
});

describe('Abschnitt 5.11 Verwaltungsstufen und Einrichtungen', () => {
  it('5.11: Stufenpreis = atCost(Größe × 30 000 / 750 000 / 25 000 000)', () => {
    assert.equal(managementTierPrice(1, 4, 0), 120_000);
    assert.equal(managementTierPrice(2, 4, 0), 3_000_000);
    assert.equal(managementTierPrice(3, 4, 0), 100_000_000);
    close(managementTierPrice(2, 5, m(2020)), atCost(5 * 750_000, m(2020)), 1e-6);
  });

  it('5.11: eine Stufe außerhalb 1 … 3 hat keinen Preis', () => {
    assert.throws(() => managementTierPrice(0, 4, 0));
    assert.throws(() => managementTierPrice(4, 4, 0));
  });

  it('5.11: Einrichtungen: Preis 250 000 / 1 000 000 / 250 000, Unterhalt 10 000 / 12 500 / 10 000 $ (1960)', () => {
    assert.equal(facilityPrice('hangar', 0), 250_000);
    assert.equal(facilityPrice('vipLounge', 0), 1_000_000);
    assert.equal(facilityPrice('catering', 0), 250_000);
    assert.equal(facilityUpkeep('hangar', 0), 10_000);
    assert.equal(facilityUpkeep('vipLounge', 0), 12_500);
    assert.equal(facilityUpkeep('catering', 0), 10_000);
    close(facilityUpkeep('vipLounge', m(2020)), atCost(12_500, m(2020)), 1e-6);
  });
});

describe('Abschnitt 5.15 Einnahme eigener Flughäfen', () => {
  const a320: LandingAircraft = { aircraftClass: 'Narrowbody', capacity: 180, cruiseSpeed: 840 };
  const a321: LandingAircraft = { aircraftClass: 'Narrowbody', capacity: 236, cruiseSpeed: 840 };

  it('5.15: ohne Stufe 3 keine Einnahme', () => {
    for (const tier of [0, 1, 2]) assert.equal(ownerFeeIncome(tier, 100_000, 1), 0);
  });

  it('5.15: Hälfte der Landegebühren der anderen, mit derselben landingFee', () => {
    const month = m(2000);
    const fees = 10 * landingFee(a320, 6, month, 1);
    close(ownerFeeIncome(3, fees, 1), 0.5 * fees);
  });

  it('5.15: mehrere Inhaber teilen sich den Anteil zu gleichen Teilen', () => {
    close(ownerFeeIncome(3, 80_000, 2), 20_000);
  });

  it('5.15: eine größere Rivalen-Maschine bringt nie weniger', () => {
    const month = m(2000);
    assert.ok(ownerFeeIncome(3, landingFee(a321, 6, month, 1), 1) >= ownerFeeIncome(3, landingFee(a320, 6, month, 1), 1));
  });
});
