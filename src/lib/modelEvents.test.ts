/**
 * Regeltests Paket 4.7c (F69): Ereignis-Band der Kopfzeile und Krisen-Frage nach dem Modell (8.4, 8.5, E6, E35).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { HEDGE_PRICE_SHARE, HISTORICAL_EVENTS, RANDOM_EVENT_TEMPLATES, RECOVERY_PRICE_SHARE } from '../model/constants';
import type { WorldEvent } from '../model/monthEvents';
import { eventKey, historicalEvents } from './eventSystem';
import { crisisBase, eventBand, isPaidChoice, pricedChoices, pricedEvent } from './modelEvents';

const OIL_1973 = (1973 - 1960) * 12 + 9;
const DOWNTURN_2001 = (2001 - 1960) * 12 + 8;
const BASE = { fuelBill: 1_000_000, revenue: 5_000_000 };
const oil = historicalEvents.find((e) => e.title === '1973 Oil Crisis')!;
const downturn = historicalEvents.find((e) => e.title === 'Aviation Downturn')!;

describe('Paket 4.7c: Preis der Krisen-Antwort aus dem Modell (8.5, E6, E35)', () => {
  it('Bezugsgrößen aus dem letzten Bericht; ohne Bericht keine', () => {
    assert.deepEqual(crisisBase({ breakdown: { fuel: 1234 }, routeRevenues: 9999 }), { fuelBill: 1234, revenue: 9999 });
    assert.equal(crisisBase(undefined), null);
  });

  it('ohne Bericht ist die kaufende Antwort nicht wählbar statt kostenlos (O69); „nichts tun“ bleibt', () => {
    const choices = pricedChoices(oil.title, oil.choices, null, oil.startOffset)!;
    const paid = choices.find(isPaidChoice)!;
    assert.equal(paid.unpriced, true);
    for (const c of choices.filter((x) => !isPaidChoice(x))) assert.equal(c.unpriced, undefined);
    assert.equal(pricedChoices(oil.title, oil.choices, BASE, oil.startOffset)!.some((c) => c.unpriced), false);
  });

  it('Monat ohne Flüge (Treibstoff-Rechnung 0): kaufende Antwort ebenfalls nicht wählbar (O69)', () => {
    const paid = pricedChoices(oil.title, oil.choices, { fuelBill: 0, revenue: 0 }, oil.startOffset)!.find(isPaidChoice)!;
    assert.equal(paid.unpriced, true);
  });

  it('Preis-Absicherung = HEDGE_PRICE_SHARE × Treibstoff-Rechnung × Dauer; „Ride it out“ kostet nichts', () => {
    const choices = pricedChoices(oil.title, oil.choices, BASE, oil.startOffset)!;
    const hedge = choices.find((c) => c.hedgesFuel)!;
    assert.equal(hedge.cost, Math.round(HEDGE_PRICE_SHARE * BASE.fuelBill * 18));
    for (const c of choices.filter((x) => !isPaidChoice(x))) assert.equal(c.cost, 0);
  });

  it('Rückgewinnung = RECOVERY_PRICE_SHARE × r × (1 − f) × Dauer × Monatserlös', () => {
    const def = HISTORICAL_EVENTS.find((e) => e.title === 'Aviation Downturn')!;
    const paid = pricedChoices(downturn.title, downturn.choices, BASE, downturn.startOffset)!.find(isPaidChoice)!;
    const expected = RECOVERY_PRICE_SHARE * def.response!.recoveryShare! * (1 - def.demandMultiplier) * def.months * BASE.revenue;
    assert.equal(paid.cost, Math.round(expected));
  });

  it('doppelte Bezugsgröße → doppelter Preis; kein fester Betrag mehr (E6)', () => {
    const one = pricedChoices(oil.title, oil.choices, BASE, oil.startOffset)!.find(isPaidChoice)!.cost;
    const two = pricedChoices(oil.title, oil.choices, { ...BASE, fuelBill: 2 * BASE.fuelBill }, oil.startOffset)!.find(isPaidChoice)!.cost;
    assert.equal(two, 2 * one);
    assert.notEqual(one, oil.choices!.find(isPaidChoice)!.cost);
  });

  it('E73 (O69 = A): später in der Krise kaufen kostet Preis × Restdauer; Band und Frage rechnen gleich', () => {
    const later = OIL_1973 + 6;
    const hedge = pricedChoices(oil.title, oil.choices, BASE, later)!.find((c) => c.hedgesFuel)!;
    assert.equal(hedge.cost, Math.round(HEDGE_PRICE_SHARE * BASE.fuelBill * 12));
    assert.equal(pricedEvent(oil, BASE, later).choices!.find((c) => c.hedgesFuel)!.cost, hedge.cost);
    const band = eventBand(later, [], {}, BASE).find((e) => e.title === oil.title)!;
    assert.equal(band.monthsLeft, 12);
    assert.equal(band.choices!.find(isPaidChoice)!.cost, hedge.cost);
    const def = HISTORICAL_EVENTS.find((e) => e.title === 'Aviation Downturn')!;
    const rec = pricedChoices(downturn.title, downturn.choices, BASE, DOWNTURN_2001 + 2)!.find(isPaidChoice)!;
    const expected = RECOVERY_PRICE_SHARE * def.response!.recoveryShare! * (1 - def.demandMultiplier) * (def.months - 2) * BASE.revenue;
    assert.equal(rec.cost, Math.round(expected));
  });

  it('pricedEvent ändert nur die Preise; Texte und Kennungen bleiben', () => {
    const priced = pricedEvent(oil, BASE, OIL_1973);
    assert.equal(priced.title, oil.title);
    assert.deepEqual(priced.choices!.map((c) => [c.id, c.label]), oil.choices!.map((c) => [c.id, c.label]));
  });
});

describe('Paket 4.7c: Ereignis-Band aus dem Modell (8.4)', () => {
  it('geschichtliches Ereignis: Text aus den Modell-Daten, Restdauer, Antworten zum Modell-Preis', () => {
    const band = eventBand(OIL_1973, [], {}, BASE);
    const ev = band.find((e) => e.title === '1973 Oil Crisis')!;
    assert.ok(ev);
    assert.equal(ev.description, HISTORICAL_EVENTS.find((e) => e.title === ev.title)!.description);
    assert.equal(ev.monthsLeft, 18);
    assert.equal(ev.choices!.find(isPaidChoice)!.cost, Math.round(HEDGE_PRICE_SHARE * BASE.fuelBill * 18));
    assert.equal(ev.chosen, undefined);
  });

  it('gewählte Antwort über eventKey; ein Monat später ein Monat weniger', () => {
    const key = eventKey(oil);
    const hedgeId = oil.choices!.find((c) => c.hedgesFuel)!.id;
    const ev = eventBand(OIL_1973 + 1, [], { [key]: hedgeId }, BASE).find((e) => e.title === oil.title)!;
    assert.equal(ev.chosen?.id, hedgeId);
    assert.equal(ev.monthsLeft, 17);
  });

  it('gewürfeltes Ereignis aus dem Spielstand: Text der Vorlage, Regionen, keine Antworten', () => {
    const template = RANDOM_EVENT_TEMPLATES.find((t) => t.regional)!;
    const rolled: WorldEvent = { title: template.title, startMonth: OIL_1973 - 1, months: 3, demandMultiplier: 0.8, regions: ['EU'] };
    const ev = eventBand(OIL_1973, [rolled], {}, BASE).find((e) => e.title === template.title)!;
    assert.equal(ev.description, template.description);
    assert.deepEqual(ev.regions, ['EU']);
    assert.equal(ev.monthsLeft, 2);
    assert.equal(ev.choices, undefined);
  });

  it('nur laufende Ereignisse; das Modell entscheidet (Ende nach `months`)', () => {
    assert.equal(eventBand(OIL_1973 + 18, [], {}, BASE).some((e) => e.title === oil.title), false);
    assert.equal(eventBand(DOWNTURN_2001, [], {}, BASE).some((e) => e.title === 'Aviation Downturn'), true);
  });
});
