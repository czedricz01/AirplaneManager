/**
 * Regeltests zu SPEZIFIKATION 3.13 (Umsteige-Verbindungen).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONNECTION_APPEAL,
  HUB_QUALITY_RESEARCH_FACTOR,
  MAX_CONNECTION,
  MAX_DETOUR,
  MINUTES_PER_WEEK,
  MIN_CONNECTION,
  TRANSFER_FARE_SHARE,
} from './constants';
import { marketSize, worldScale, type MarketAirport } from './demand';
import { classPotential, marketSplit, noFlyAppeal, offerAppeal } from './marketSplit';
import {
  allocateTransferSeats,
  connectionFactor,
  connections,
  connectionWait,
  detourRatio,
  hubQuality,
  isFeasibleConnection,
  transferClasses,
  transferFare,
  transferOffer,
  type TransferDemand,
  type TransferOfferInput,
} from './transfers';

function assertClose(actual: number, expected: number, tolerance = 1e-9, message?: string) {
  assert.ok(Math.abs(actual - expected) <= tolerance, message ?? `${actual} ≉ ${expected}`);
}

/** Montag 08:00 + `days` Tage, in Minuten der Woche. */
const at = (days: number, hour: number, minute = 0) => days * 1440 + hour * 60 + minute;

/** Täglich eine Ankunft um 08:00 und ein Abflug um 09:30 in beide Richtungen. */
const DAILY: TransferOfferInput = {
  kmOriginHub: 600,
  kmHubDestination: 900,
  kmOriginDestination: 1300,
  blockMinutesOriginHub: 90,
  blockMinutesHubDestination: 120,
  outbound: { arrivals: [0, 1, 2, 3, 4, 5, 6].map((d) => at(d, 8)), departures: [0, 1, 2, 3, 4, 5, 6].map((d) => at(d, 9, 30)) },
  inbound: { arrivals: [0, 1, 2, 3, 4, 5, 6].map((d) => at(d, 17)), departures: [0, 1, 2, 3, 4, 5, 6].map((d) => at(d, 18)) },
};

describe('Abschnitt 3.13 Umsteige-Verbindungen', () => {
  it('3.13: Umsteigezeit MIN_CONNECTION … MAX_CONNECTION ist machbar, auch über das Wochenende', () => {
    assert.ok(isFeasibleConnection(100, 100 + MIN_CONNECTION));
    assert.ok(isFeasibleConnection(100, 100 + MAX_CONNECTION));
    assert.ok(!isFeasibleConnection(100, 100 + MIN_CONNECTION - 1));
    assert.ok(!isFeasibleConnection(100, 100 + MAX_CONNECTION + 1));
    // Ankunft Sonntag 23:30, Abflug Montag 01:00.
    assert.equal(connectionWait(MINUTES_PER_WEEK - 30, 60), 90);
    assert.ok(isFeasibleConnection(MINUTES_PER_WEEK - 30, 60));
  });

  it('3.13: jede Ankunft mit Anschluss zählt einmal, mit ihrer kürzesten machbaren Wartezeit', () => {
    const result = connections([at(0, 8), at(0, 12), at(1, 8)], [at(0, 9), at(0, 10), at(1, 15)]);
    // 08:00 → 09:00 (60), 12:00 → nichts (nächster Abflug Tag 1 15:00 = 27 h), Tag 1 08:00 → 15:00 (420 > 360) nichts.
    assert.equal(result.count, 1);
    assert.equal(result.waitMinutesSum, 60);
    // Zwei Ankünfte zu einem Abflug: beide zählen.
    assert.equal(connections([at(0, 8), at(0, 8, 30)], [at(0, 10)]).count, 2);
  });

  it('3.13: Kennzahlen: Abflüge je Richtung = Mittel beider Richtungen, Flugzeit = Teilstrecken + mittlere Wartezeit', () => {
    const offer = transferOffer(DAILY);
    assert.ok(offer);
    assert.equal(offer.frequency, 7);
    assertClose(offer.meanWaitMinutes, (7 * 90 + 7 * 60) / 14);
    assertClose(offer.blockMinutes, 90 + 120 + 75);
    assertClose(offer.detour, 1500 / 1300);
    // Nur eine Richtung machbar: halb so viele Abflüge je Richtung.
    const oneWay = transferOffer({ ...DAILY, inbound: { arrivals: [], departures: [] } });
    assert.ok(oneWay);
    assert.equal(oneWay.frequency, 3.5);
  });

  it('3.13: Umweg über MAX_DETOUR → keine Verbindung; genau MAX_DETOUR geht noch', () => {
    assert.equal(transferOffer({ ...DAILY, kmOriginDestination: 1500 / (MAX_DETOUR + 0.01) }), null);
    assert.ok(transferOffer({ ...DAILY, kmOriginHub: 800, kmHubDestination: 800, kmOriginDestination: 1000 }));
    assertClose(detourRatio(800, 800, 1000), MAX_DETOUR);
  });

  it('3.13: ohne machbaren Anschluss keine Verbindung', () => {
    assert.equal(transferOffer({ ...DAILY, outbound: { arrivals: [at(0, 8)], departures: [at(0, 8, 10)] }, inbound: { arrivals: [], departures: [] } }), null);
  });

  it('3.13: Klassen nur, wenn beide Teilstrecken Sitze darin haben', () => {
    assert.deepEqual(transferClasses({ economy: 150, business: 12 }, { economy: 180, first: 8 }), ['economy']);
  });

  it('3.13: Drehkreuz-Güte 0,4 + 0,15 je Stufe + 0,05 je Extra, höchstens 1, × Alliance', () => {
    assertClose(hubQuality({ level: 0 }), 0.4);
    assertClose(hubQuality({ level: 2, lounge: true }), 0.75);
    assertClose(hubQuality({ level: 3 }), 0.9);
    assertClose(hubQuality({ level: 3, lounge: true, catering: true }), 1);
    assertClose(hubQuality({ level: 3, lounge: true, catering: true }, HUB_QUALITY_RESEARCH_FACTOR), 1.1);
    assertClose(connectionFactor(1), CONNECTION_APPEAL);
  });

  it('3.13/4.8: Preis der Verbindung = TRANSFER_FARE_SHARE × Marktpreis O–D', () => {
    assertClose(transferFare(200), TRANSFER_FARE_SHARE * 200);
  });

  it('3.13: Umsteiger-Markt O–D hat dieselbe Marktgröße wie die Direktrechnung und teilt mit ihr (W9)', () => {
    const o: MarketAirport = { coords: [50, 8], stats: [20, 30] };
    const d: MarketAirport = { coords: [40, -3], stats: [25, 15] };
    const month = 120;
    const world = worldScale(month);
    const size = marketSize({ a: o, b: d, month, world });
    const potential = classPotential('economy', size, 0.85);
    const transfer = transferOffer(DAILY)!;
    const appeal = offerAppeal('economy', {
      frequency: transfer.frequency,
      fare: transferFare(100),
      marketFare: 100,
      blockMinutes: transfer.blockMinutes,
      referenceBlockMinutes: 180,
      connectionFactor: connectionFactor(hubQuality({ level: 2 })),
    });
    const result = marketSplit({
      potential,
      noFlyAppeal: noFlyAppeal('economy'),
      offers: [{ id: 'direct', appeal: 1, seats: 5000 }, { id: 'transfer', appeal, seats: Infinity }],
    });
    // Ein Topf: Direkt, Verbindung und „Nicht fliegen“ teilen dasselbe Potenzial.
    assertClose(result.passengers.direct + result.passengers.transfer + result.notFlying, potential, 1e-6);
    assert.ok(result.passengers.transfer < result.passengers.direct);
  });

  it('3.13: Umsteiger belegen nie mehr als die freien Sitze; höchster Tarif zuerst; Rest fliegt nicht', () => {
    const demands: TransferDemand[] = [
      { id: 'cheap', legs: ['A|economy', 'B|economy'], passengers: 80, fare: 150 },
      { id: 'dear', legs: ['A|economy', 'C|economy'], passengers: 70, fare: 300 },
      { id: 'other', legs: ['C|economy', 'D|economy'], passengers: 40, fare: 200 },
    ];
    const free = { 'A|economy': 100, 'B|economy': 500, 'C|economy': 90, 'D|economy': 10 };
    const result = allocateTransferSeats(demands, free);
    assert.equal(result.placed.dear, 70);
    assert.equal(result.placed.other, 10);
    assert.equal(result.placed.cheap, 30);
    for (const [leg, seats] of Object.entries(result.freeSeats)) assert.ok(seats >= 0, leg);
    // Unabhängig von der Reihenfolge der Eingabe.
    assert.deepEqual(allocateTransferSeats([...demands].reverse(), free), result);
    // Eingabe bleibt unverändert.
    assert.equal(free['A|economy'], 100);
  });

  it('3.13: ohne Eintrag für eine Teilstrecke gibt es keinen freien Sitz', () => {
    const result = allocateTransferSeats([{ id: 'x', legs: ['A|first', 'B|first'], passengers: 5, fare: 900 }], { 'A|first': 10 });
    assert.equal(result.placed.x, 0);
  });
});
