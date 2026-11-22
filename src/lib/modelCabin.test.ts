/**
 * Regeltests Paket 4.6a (F65): Kauf- und Umbau-Dialog nach dem Modell – Platz-Regel (7.5), Interior score und Cabin
 * rating (2.3, 2.4), Lieferbarkeit, Preise in Geld des Monats (5.13), Kaufpreis (8.12) und Umbau-Preis (8.13).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { ConfigOutput } from '../components/ConfigurePurchaseView';
import { aircraftList } from '../data/aircraft';
import { atCost } from '../model/basics';
import { cabinRating, economySeatsLeft, interiorScoreParts } from '../model/cabin';
import { CABIN_CLASSES, CABIN_EXTRA_PRICE_1960, FEATURE_PRICE_1960, SEAT_TYPE_PRICE_1960, type CabinClass } from '../model/constants';
import { newAircraftPrice } from '../model/fleet';
import { refitCabinCondition, refitPrice } from '../model/fleetMarket';
import { createOwnedAircraft } from './fleet';
import { aircraftState, cabinExtras, classInterior } from './modelBridge';
import { cabinQuote, extraOffers, featureOffers, seatTypeOffers, type CabinChoice } from './modelCabin';
import { planesValue } from './modelMonth';

const M = (1995 - 1960) * 12 + 5; // Juni 1995
const A320 = aircraftList.find((a) => a.id === 'a320ceo')!;
const A300 = aircraftList.find((a) => a.id === 'a300-600')!;
const CONCORDE = aircraftList.find((a) => a.id === 'concorde')!;

/** Kabine wie der Dialog sie speichert: 8 First (Recliner, IFE), 24 Business, Economy mit Comfort-Sitzen. */
function details(extra: Partial<ConfigOutput['details']> = {}): ConfigOutput['details'] {
  return {
    first: { seats: 8, pitch: 180, seatType: 'Recliner', hasIFE: true, hasPower: false },
    business: { seats: 24, pitch: 120, seatType: 'Standard', hasIFE: false, hasPower: false, hasLumbarSupport: true },
    premium: { seats: 0, pitch: 90, seatType: 'Standard', hasIFE: false, hasPower: false },
    economy: { seats: 0, pitch: 78, seatType: 'Comfort', hasIFE: true, hasPower: false, hasHooks: true },
    hasPremiumCatering: true,
    ...extra,
  };
}

/** Auswahl des Dialogs aus den gespeicherten Feldern, wie `ConfigurePurchaseView.tsx` sie baut. */
function choiceOf(d: ConfigOutput['details']): CabinChoice {
  return {
    seats: { first: d.first.seats, business: d.business.seats, premium: d.premium.seats },
    interiors: {
      first: classInterior('first', d.first),
      business: classInterior('business', d.business),
      premium: classInterior('premium', d.premium),
      economy: classInterior('economy', d.economy),
    },
    extras: cabinExtras(d),
  };
}

/** Die Kabine, wie der Dialog sie an den Kauf übergibt (Economy-Sitze aus dem Modell). */
function configOf(d: ConfigOutput['details'], economy: number): ConfigOutput {
  return {
    first: d.first.seats,
    business: d.business.seats,
    premium: d.premium.seats,
    economy,
    details: { ...d, economy: { ...d.economy, seats: economy } },
  };
}

describe('Kaufdialog nach dem Modell (4.6a)', () => {
  it('Kaufdialog-Anzeige = Modellwert: Interior score und Kabinen-Listenpreis wie im Abschluss (2.3, R2)', () => {
    const d = details();
    const quote = cabinQuote(A320, choiceOf(d), M);
    const [plane] = createOwnedAircraft(A320, 1, {
      config: configOf(d, quote.seats.economy),
      baseInteriorPop: 0,
      hub: 'FRA',
      existingRegistrations: [],
      purchasedAt: M,
    });
    const state = aircraftState(plane);
    for (const c of CABIN_CLASSES) {
      if (quote.seats[c] === 0) continue;
      assert.equal(state.seats[c], quote.seats[c], c);
      assert.equal(state.interiorScore[c], quote.interior[c].total, c);
    }
    assert.equal(state.cabinListPrice1960, quote.cabinListPrice1960);
  });

  it('Aufschlüsselung = interiorScoreParts; Cabin rating neu = cabinRating bei Zustand 100 (2.3, 2.4)', () => {
    const d = details();
    const choice = choiceOf(d);
    const quote = cabinQuote(A320, choice, M);
    const fit = { installedMonth: M, capacity: A320.capacity, extras: choice.extras };
    for (const c of CABIN_CLASSES) {
      assert.deepEqual(quote.interior[c], interiorScoreParts(c, choice.interiors[c], fit), c);
      assert.equal(quote.cabinRating[c], cabinRating(A320.popularity, quote.interior[c].total, 100), c);
    }
    assert.equal(quote.typeAppeal, A320.popularity);
    assert.equal(quote.cabinCondition, 100);
  });

  it('Neukauf kostet so viel, wie das Flugzeug wert ist (8.12): Kaufpreis = Wert im Kaufmonat', () => {
    const d = details({ hasWifi: true, hasReducedGalley: true });
    const quote = cabinQuote(A320, choiceOf(d), M);
    assert.equal(quote.unitPrice, newAircraftPrice(A320.basePrice, quote.cabinListPrice1960, M));
    const [plane] = createOwnedAircraft(A320, 1, {
      config: configOf(d, quote.seats.economy),
      baseInteriorPop: 0,
      hub: 'FRA',
      existingRegistrations: [],
      purchasedAt: M,
    });
    assert.ok(Math.abs(planesValue([plane], M) - quote.unitPrice) < 1e-6);
    // Teile des Preises in Geld des Monats.
    const sum = quote.typePrice + CABIN_CLASSES.reduce((s, c) => s + quote.classPrice[c], 0) + quote.extrasPrice;
    assert.ok(Math.abs(sum - quote.unitPrice) < 1e-6);
    assert.equal(quote.typePrice, atCost(A320.basePrice, M));
  });

  it('Platz-Regel (7.5): Economy füllt den Rest; Schieberegler-Ende passt gerade noch', () => {
    const d = details();
    const choice = choiceOf(d);
    const quote = cabinQuote(A320, choice, M);
    assert.equal(
      quote.seats.economy,
      economySeatsLeft(
        quote.space,
        {
          first: { seats: 8, interior: choice.interiors.first },
          business: { seats: 24, interior: choice.interiors.business },
          premium: { seats: 0, interior: choice.interiors.premium },
        },
        choice.interiors.economy,
      ),
    );
    assert.ok(quote.usedSpace <= quote.space);
    assert.equal(quote.overbooked, false);
    const full = cabinQuote(A320, { ...choice, seats: { ...choice.seats, business: quote.maxSeats.business } }, M);
    assert.equal(full.overbooked, false);
    const over = cabinQuote(A320, { ...choice, seats: { ...choice.seats, business: quote.maxSeats.business + 1 } }, M);
    assert.equal(over.overbooked, true);
    assert.equal(over.seats.economy, 0);
  });

  it('Nicht lieferbare Teile: kein Platz, keine Punkte, kein Preis, nicht eingebaut', () => {
    // WLAN erst ab 2000, Dusche nur ab 300 Sitzen.
    const d = details({ hasWifi: true, hasShower: true });
    const quote = cabinQuote(CONCORDE, choiceOf(d), M);
    const plain = cabinQuote(CONCORDE, choiceOf(details()), M);
    assert.deepEqual(quote.fittedExtras, plain.fittedExtras);
    assert.equal(quote.unitPrice, plain.unitPrice);
    assert.equal(quote.space, plain.space);
    assert.equal(quote.interior.economy.total, plain.interior.economy.total);

    const later = (2010 - 1960) * 12;
    const offers = Object.fromEntries(extraOffers(later, CONCORDE.capacity).map((o) => [o.key, o]));
    assert.equal(offers.wifi.deliverable, true);
    assert.equal(offers.shower.deliverable, false);
    assert.equal(offers.shower.minCapacity, 300);
    const big = Object.fromEntries(extraOffers(later, A300.capacity).map((o) => [o.key, o]));
    assert.equal(big.shower.deliverable, true);
  });

  it('Preise der Teile in Geld des Monats (5.13), Sitztyp-Punkte wie sie zählen (× 2)', () => {
    const later = (2010 - 1960) * 12;
    for (const c of ['economy', 'first'] as CabinClass[]) {
      for (const o of seatTypeOffers(c, later, A320.capacity)) {
        assert.equal(o.price, atCost(SEAT_TYPE_PRICE_1960[c][o.key], later));
      }
      for (const o of featureOffers(c, later, A320.capacity)) {
        assert.equal(o.price, atCost(FEATURE_PRICE_1960[c][o.key], later));
      }
    }
    const recliner = seatTypeOffers('first', M, A320.capacity).find((o) => o.key === 'Recliner')!;
    assert.equal(recliner.points, 20);
    assert.equal(recliner.spaceFactor, 1.2);
    for (const o of extraOffers(later, A320.capacity)) assert.equal(o.price, atCost(CABIN_EXTRA_PRICE_1960[o.key], later));
  });

  it('Umbau (8.13): Preis = refitPrice, Lohn je Sitz, Zustand danach, Type appeal nach Alter', () => {
    const d = details();
    const built = M - 15 * 12;
    const refit = { builtMonth: built, cabinCondition: 40, refitsDone: 2 };
    const quote = cabinQuote(A320, choiceOf(d), M, refit);
    assert.equal(quote.unitPrice, refitPrice(quote.cabinListPrice1960, quote.totalSeats, M));
    assert.equal(quote.typePrice, 0);
    assert.equal(quote.labour, atCost(1_000 * quote.totalSeats, M));
    assert.equal(quote.cabinCondition, refitCabinCondition(40, 2));
    assert.ok(quote.typeAppeal < A320.popularity, 'ein 15 Jahre altes Flugzeug hat weniger Type appeal');
    const sum = CABIN_CLASSES.reduce((s, c) => s + quote.classPrice[c], 0) + quote.extrasPrice + quote.labour;
    assert.ok(Math.abs(sum - quote.unitPrice) < 1e-6);
  });

  it('Mehr Ausstattung senkt Interior score und Cabin rating nie (2.3)', () => {
    const base = cabinQuote(A320, choiceOf(details()), M);
    const more = cabinQuote(
      A320,
      choiceOf(details({ economy: { ...details().economy, hasPower: true, hasMovableArmrests: true } })),
      M,
    );
    assert.ok(more.interior.economy.total >= base.interior.economy.total);
    assert.ok(more.cabinRating.economy >= base.cabinRating.economy);
  });
});
