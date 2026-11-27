/**
 * Regeltests Paket 4.5a (F62): Prognose einer Strecke für den Planer (`routeForecast`, `routeBestFares`,
 * `pricesAtLevel`) aus derselben Rechnung wie der Monatsabschluss (R2, 4.10–4.12).
 * Paket 4.5b (F63): Satisfaction je Klasse mit allen Teilen und Verpflegungskosten (`plannedSatisfaction`, 2.7, 5.7).
 * Paket 4.5c (F64): Zahlen aller Strecken im laufenden Monat für Streckenliste und Streckenansicht (`routesThisMonth`, 8.1).
 * Paket 4.7c (F69): Markt eines Städtepaars für Planer Schritt 1 (`routeMarket`, 3.6, 3.7, 4.3).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { OwnedAircraft } from '../components/MyFleetView';
import { aircraftList } from '../data/aircraft';
import { CABIN_CLASSES, DIFFICULTY_COST_FACTOR, RAMP_MONTHS, WEEKS_PER_MONTH } from '../model/constants';
import { NO_DECISIONS, closeMonth, monthOperations, type ModelState } from '../model/monthClose';
import { cateringCostParts } from '../model/costs';
import { classShares, eventDemandFactor, marketSizeParts, worldScale } from '../model/demand';
import { activeWorldEvents } from '../model/monthEvents';
import { SCALES } from '../model/constants';
import { createOwnedAircraft, defaultCabin } from './fleet';
import { createGameSystems } from './gameState';
import type { AirportInfrastructure, SimulatedRoute } from './gameTypes';
import { PLAYER_ID, defaultModelEnv, modelGame, type AppGame } from './modelMonth';
import { pricesAtLevel, routeBestFares, routeForecast, routeMarket, routeMarketFares, routesThisMonth, plannedSatisfaction, withPlannedRoute, type PlannedRoute } from './modelRoute';

const M = (1995 - 1960) * 12 + 5; // Juni 1995
const ENV = defaultModelEnv();
const A320 = aircraftList.find((a) => a.id === 'a320ceo')!;

function plane(reg: string): OwnedAircraft {
  const { config, baseInteriorPop } = defaultCabin(A320);
  const [p] = createOwnedAircraft(A320, 1, { config, baseInteriorPop, hub: 'FRA', existingRegistrations: [], purchasedAt: M - 24 });
  return { ...p, registration: reg };
}

const infra = (level: 1 | 2 | 3, narrowbody: number): AirportInfrastructure => ({
  level,
  slots: { regional: 0, narrowbody, widebody: 0 },
  stands: { narrowbody: 2, widebody: 0 },
  desks: { normal: 2, self: 0 },
});

const ROUTE: SimulatedRoute = {
  id: 'r1', airline: 'Player', origin: 'FRA', destination: 'MAD', distance: 1420, aircraft: 'D-AAAA', weeklyFlights: 7, paxPerWeek: 0,
  classConfigs: { economy: { catering: [['b15']], extras: [], service: [] } },
  ticketPrices: { economy: 150 },
  openedOffset: M - 24,
};

function game(over: Partial<AppGame> = {}): AppGame {
  const sys = createGameSystems();
  return {
    month: M, startMonth: M - 60, airlineCode: 'XA', selectedHub: 'FRA', difficulty: 'Normal', aiDifficulty: 'Normal', aiAirlinesCount: 0,
    capital: 150e6, monthlyCapex: [], fleet: [plane('D-AAAA'), plane('D-AAAB')], routes: [ROUTE],
    airportManagement: { FRA: infra(2, 40), MAD: infra(1, 20), LIS: infra(1, 20) },
    reputation: 55, profitStreak: 0, staff: { salaryPct: 100, morale: 70, strike: null }, marketing: sys.marketing, eventChoices: {},
    career: sys.career, milestones: [], annualGoal: null, scenario: null, reportHistory: [], aiAirlines: [], randomEvents: [], disruptions: [],
    ...over,
  };
}

const STATE: ModelState = modelGame(game(), ENV).state;
const EXISTING: PlannedRoute = { route: ROUTE, isNew: false, startMonth: M - 60 };
const NEW: PlannedRoute = {
  route: { ...ROUTE, id: 'draft', destination: 'LIS', aircraft: 'D-AAAB', openedOffset: undefined, ticketPrices: { economy: 200 } },
  isNew: true,
  startMonth: M - 60,
};

describe('Paket 4.5a: Prognose einer Strecke (4.11, 4.12)', () => {
  it('Hauptzahl = Ergebnis der Strecke im Monatsabschluss bei gleichem Stand nach dem Anlauf (4.12, R2)', () => {
    const f = routeForecast(STATE, EXISTING);
    assert.ok(f);
    const ops = monthOperations(STATE)[PLAYER_ID].routes.find((r) => r.routeId === 'r1')!;
    assert.ok(Math.abs(f.weeklyProfit - ops.result) < 1e-6, `${f.weeklyProfit} ≠ ${ops.result}`);
    assert.ok(Math.abs(f.figures.revenue - ops.revenue) < 1e-6);
  });

  it('E87: Schwierigkeit als Faktor auf Flugbetrieb und Kosten je Fluggast; Prognose = Abschluss; Slot- und Flugzeug-Anteil ohne Faktor', () => {
    const at = (difficulty: 'Easy' | 'Normal' | 'Hard') => {
      const state = modelGame(game({ difficulty }), ENV).state;
      return { f: routeForecast(state, EXISTING)!, ops: monthOperations(state)[PLAYER_ID].routes.find((r) => r.routeId === 'r1')! };
    };
    const n = at('Normal').f.figures;
    for (const d of ['Easy', 'Hard'] as const) {
      const { f, ops } = at(d);
      const k = DIFFICULTY_COST_FACTOR[d];
      for (const part of ['fuel', 'crew', 'landing'] as const) assert.ok(Math.abs(f.figures.fixed[part] - k * n.fixed[part]) < 1e-6, `${d} ${part}`);
      assert.ok(Math.abs(f.figures.fixed.slotShare - n.fixed.slotShare) < 1e-9);
      assert.ok(Math.abs(f.figures.fixed.aircraftShare - n.fixed.aircraftShare) < 1e-9);
      assert.ok(Math.abs((f.figures.costPerPassenger.economy ?? 0) - k * (n.costPerPassenger.economy ?? 0)) < 1e-9);
      assert.ok(Math.abs(f.weeklyProfit - ops.result) < 1e-6, 'Prognose = Abschluss (R2)');
    }
    assert.ok(at('Easy').f.weeklyProfit > at('Normal').f.weeklyProfit);
    assert.ok(at('Hard').f.weeklyProfit < at('Normal').f.weeklyProfit);
  });

  it('eine bestehende Strecke wird ersetzt, nicht doppelt gezählt', () => {
    const s = withPlannedRoute(STATE, EXISTING);
    const player = s.companies.find((c) => c.id === PLAYER_ID)!;
    assert.equal(player.routes.filter((r) => r.id === 'r1').length, 1);
    assert.equal(player.routes.length, 1);
  });

  it('neue Strecke: „First month“ mit Anlauf-Monat 0 bringt weniger als die Hauptzahl nach dem Anlauf (3.12, 4.12)', () => {
    const f = routeForecast(STATE, NEW);
    assert.ok(f);
    assert.ok(f.firstMonth.passengers.economy < f.figures.passengers.economy);
    assert.ok(f.firstMonthWeeklyProfit < f.weeklyProfit);
    const route = withPlannedRoute(STATE, NEW).companies.find((c) => c.id === PLAYER_ID)!.routes.find((r) => r.id === 'draft')!;
    assert.equal(route.ageMonths, 0);
    const later = withPlannedRoute(STATE, NEW, RAMP_MONTHS).companies.find((c) => c.id === PLAYER_ID)!.routes.find((r) => r.id === 'draft')!;
    assert.equal(later.ageMonths, RAMP_MONTHS);
  });

  it('Preis der Prognose = eingestellter Preis in $; Abstand zum Marktpreis (4.5)', () => {
    const f = routeForecast(STATE, NEW)!;
    const e = f.classes.economy!;
    assert.ok(Math.abs(e.fare - 200) < 1e-6);
    assert.ok(Math.abs(e.vsMarket - (200 / e.marketFare - 1)) < 1e-9);
    assert.equal(f.classes.premium, undefined, 'Klassen ohne Sitze fehlen');
  });

  it('Gewinnschwelle (4.11): bei voller Maschine Gewinn 0, erwartete Auslastung nie tiefer als voll', () => {
    const f = routeForecast(STATE, NEW)!;
    let profitAtFull = -f.figures.fixed.total;
    for (const c of CABIN_CLASSES) {
      const k = f.classes[c];
      if (!k) continue;
      profitAtFull += k.seatsPerWeek * (k.breakEvenFull - k.costPerPassenger);
      assert.ok(Math.abs(k.breakEvenFull - f.breakEvenLevel.full * k.marketFare) < 1e-9);
    }
    assert.ok(Math.abs(profitAtFull) < 1e-6, `Gewinn an der Schwelle ${profitAtFull}`);
    assert.ok(f.expectedLoad > 0 && f.expectedLoad <= 1);
    assert.ok(f.breakEvenLevel.expected! >= f.breakEvenLevel.full - 1e-12);
  });

  it('„Full aircraft at market fare“ hängt nicht vom eingestellten Preis ab (4.12, E26)', () => {
    const a = routeForecast(STATE, NEW)!;
    const b = routeForecast(STATE, { ...NEW, route: { ...NEW.route, ticketPrices: { economy: 90 } } })!;
    assert.ok(Math.abs(a.fullAircraft.profit - b.fullAircraft.profit) < 1e-6);
    assert.ok(Math.abs(a.fullAircraft.revenue - a.figures.offeredSeats.economy * a.marketFares.economy) < 1e-6);
  });

  it('„before aircraft costs“ = Ergebnis + Flugzeug-Anteil (E57)', () => {
    const f = routeForecast(STATE, EXISTING)!;
    assert.ok(f.figures.fixed.aircraftShare > 0);
    assert.ok(Math.abs(f.beforeAircraftWeeklyProfit - f.weeklyProfit - f.figures.fixed.aircraftShare) < 1e-9);
  });

  it('ohne Abflüge keine Prognose', () => {
    assert.equal(routeForecast(STATE, { ...NEW, route: { ...NEW.route, weeklyFlights: 0, schedule: [] } }), null);
    assert.deepEqual(routeBestFares(STATE, { ...NEW, route: { ...NEW.route, weeklyFlights: 0, schedule: [] } }), {});
  });
});

describe('Paket 4.5a: bester Preis und Preisniveau (4.5, 4.10)', () => {
  it('die Hauptzahl steigt nie allein dadurch, dass ein Preis über den besten Preis erhöht wird (4.12)', () => {
    const best = routeBestFares(STATE, NEW).economy!;
    assert.ok(best.fare > 0);
    const at = (fare: number) => routeForecast(STATE, { ...NEW, route: { ...NEW.route, ticketPrices: { economy: fare } } })!.weeklyProfit;
    const atBest = at(best.fare);
    assert.ok(atBest >= at(best.fare * 1.2) - 1e-6);
    assert.ok(atBest >= at(best.fare * 1.5) - 1e-6);
    assert.ok(atBest >= at(best.fare * 0.8) - 1e-6);
  });

  it('der beste Preis hängt nicht vom eingestellten Preis der Klasse ab', () => {
    const a = routeBestFares(STATE, NEW).economy!;
    const b = routeBestFares(STATE, { ...NEW, route: { ...NEW.route, ticketPrices: { economy: 400 } } }).economy!;
    assert.ok(Math.abs(a.fareRatio - b.fareRatio) < 1e-12);
  });

  it('Preisniveau 1 = Marktpreis je Klasse; ein Niveau hält die Klassen-Verhältnisse des Markts (E23)', () => {
    const fares = routeMarketFares(STATE, NEW.route);
    const p1 = pricesAtLevel(fares, 1, CABIN_CLASSES);
    for (const c of CABIN_CLASSES) assert.equal(p1[c], Math.round(fares[c]));
    const p = pricesAtLevel(fares, 1.3, ['economy', 'business']);
    assert.deepEqual(Object.keys(p), ['economy', 'business']);
    assert.ok(Math.abs(p.business / p.economy - fares.business / fares.economy) < 0.02);
  });
});

describe('Paket 4.5b: Satisfaction der Strecke im Planer (2.7, 5.7)', () => {
  it('Satisfaction je Klasse = Satisfaction der Strecke im Monatsabschluss (2.7, R2)', () => {
    const d = plannedSatisfaction(STATE, EXISTING)!;
    const ops = monthOperations(STATE)[PLAYER_ID].routes.find((r) => r.routeId === 'r1')!;
    for (const c of CABIN_CLASSES) {
      const k = d.classes[c];
      assert.equal(k === undefined, ops.satisfaction[c] === undefined, c);
      if (k) assert.ok(Math.abs(k.breakdown.satisfaction - (ops.satisfaction[c] as number)) < 1e-9, `${c}: ${k.breakdown.satisfaction}`);
    }
  });

  it('die Teile ergeben die Satisfaction; Boden-Teil = Bodengewicht × Mittel beider Enden (2.6.3, 2.7)', () => {
    const d = plannedSatisfaction(STATE, NEW)!;
    const k = d.classes.economy!;
    const b = k.breakdown;
    const sum = SCALES.satisfaction.neutral + b.cabinPart + b.servicePart + b.groundPart.total + b.staffPart + b.researchPart;
    assert.ok(Math.abs(sum - b.unclamped) < 1e-9);
    for (const part of ['lounge', 'stands', 'deskType', 'deskOverload'] as const) {
      const mean = (b.groundPart.weight * (k.originGround[part] + k.destinationGround[part])) / 2;
      assert.ok(Math.abs(b.groundPart[part] - mean) < 1e-9, part);
    }
    assert.ok(Math.abs(k.service.total - (k.service.meals.reduce((s, m) => s + m.points, 0) + k.service.extrasPoints + k.service.onboardServicePoints)) < 1e-9);
  });

  it('die geplante Strecke zählt bei der Schalter-Last am gemeinsamen Ende mit (2.6.3)', () => {
    const alone = plannedSatisfaction(STATE, EXISTING)!;
    const withDraft = plannedSatisfaction(STATE, NEW)!;
    const seats = (p: { seats: Partial<Record<string, number>> }) => Object.values(p.seats).reduce((a: number, b) => a + (b ?? 0), 0);
    const player = withPlannedRoute(STATE, NEW).companies.find((c) => c.id === PLAYER_ID)!;
    const draftPlane = player.aircraft.find((p) => p.id === 'D-AAAB')!;
    const draft = player.routes.find((r) => r.id === 'draft')!;
    assert.ok(draft.departuresPerWeek > 0);
    const added = (seats(draftPlane) * draft.departuresPerWeek) / 2;
    assert.ok(Math.abs(withDraft.origin.departingSeatsPerWeek - alone.origin.departingSeatsPerWeek - added) < 1e-9);
  });

  it('Verpflegung je Fluggast × Fluggäste = Verpflegungskosten der Prognose (5.7, R2)', () => {
    const d = plannedSatisfaction(STATE, NEW)!;
    const f = routeForecast(STATE, NEW)!;
    let catering = 0;
    for (const c of CABIN_CLASSES) catering += (d.classes[c]?.cateringCost ?? 0) * f.figures.passengers[c];
    assert.ok(catering > 0);
    assert.ok(Math.abs(catering - f.figures.passengerCost.catering) < 1e-6, `${catering} ≠ ${f.figures.passengerCost.catering}`);
    const parts = cateringCostParts({ meals: [['b15']], extras: [], onboardService: [] }, d.blockMinutes, d.capability);
    assert.ok(Math.abs(d.classes.economy!.cateringCost - parts.total1960 * d.cateringPriceFactor) < 1e-9);
  });

  it('ohne Abflüge keine Satisfaction', () => {
    assert.equal(plannedSatisfaction(STATE, { ...NEW, route: { ...NEW.route, weeklyFlights: 0, schedule: [] } }), null);
  });
});

describe('Paket 4.5c: Zahlen der Strecken im laufenden Monat (8.1, R2)', () => {
  it('Erlös und Fluggäste der Streckenliste = Bericht des Monatsabschlusses (R2)', () => {
    const months = routesThisMonth(STATE);
    const report = closeMonth(STATE, NO_DECISIONS).reports[PLAYER_ID];
    let revenue = 0;
    let passengers = 0;
    months.forEach((m) => {
      revenue += m.figures.revenue;
      passengers += m.passengers;
    });
    assert.ok(Math.abs(revenue * WEEKS_PER_MONTH - report.revenue) < 1e-6, `${revenue * WEEKS_PER_MONTH} ≠ ${report.revenue}`);
    assert.ok(Math.abs(passengers * WEEKS_PER_MONTH - report.passengers) < 1e-6, `${passengers * WEEKS_PER_MONTH} ≠ ${report.passengers}`);
  });

  it('Ergebnis je Strecke = Ergebnis in monthOperations; Erlös = Σ Direktgäste × Preis + Anteil der Umsteiger', () => {
    const m = routesThisMonth(STATE).get('r1');
    assert.ok(m);
    const ops = monthOperations(STATE)[PLAYER_ID].routes.find((r) => r.routeId === 'r1')!;
    assert.equal(m.figures.result, ops.result);
    let direct = 0;
    for (const c of CABIN_CLASSES) direct += m.classes[c]?.directRevenue ?? 0;
    assert.ok(Math.abs(direct + m.transferRevenue - m.figures.revenue) < 1e-6);
    const eco = m.classes.economy!;
    assert.ok(Math.abs(eco.loadFactor - (eco.passengers + eco.transferPassengers) / eco.seatsPerWeek) < 1e-12);
  });

  it('eine Klasse: Route satisfaction = Satisfaction der Klasse (2.9)', () => {
    const m = routesThisMonth(STATE).get('r1')!;
    assert.equal(m.satisfaction, m.classes.economy!.satisfaction);
  });

  it('Preisänderung gilt ab dem nächsten Monat: Fluggäste dieses Monats bleiben, die Planer-Prognose ändert sich (4.5)', () => {
    const repriced: SimulatedRoute = { ...ROUTE, activeTicketPrices: { economy: 150 }, ticketPrices: { economy: 300 } };
    const state = modelGame(game({ routes: [repriced] }), ENV).state;
    const before = routesThisMonth(STATE).get('r1')!;
    const after = routesThisMonth(state).get('r1')!;
    assert.equal(after.passengers, before.passengers);
    assert.equal(after.classes.economy!.fare, before.classes.economy!.fare);
    const forecast = routeForecast(state, { route: repriced, isNew: false, startMonth: M - 60 })!;
    assert.ok(Math.abs(forecast.classes.economy!.fare - 300) < 1);
  });

  it('Alter der Strecke aus dem Spielstand; neue Strecke im Anlauf (3.12)', () => {
    assert.equal(routesThisMonth(STATE).get('r1')!.ageMonths, 24);
    const fresh = modelGame(game({ routes: [{ ...ROUTE, openedOffset: M }] }), ENV).state;
    const m = routesThisMonth(fresh).get('r1')!;
    assert.equal(m.ageMonths, 0);
    assert.ok(m.passengers < routesThisMonth(STATE).get('r1')!.passengers);
  });
});

describe('Paket 4.7c: Markt eines Städtepaars im Planer (3.6, 3.7, 4.3)', () => {
  const PAIR = { origin: 'FRA', destination: 'MAD' };

  it('Marktgröße = marketSizeParts mit Weltgröße und Ereignissen des Monats, wie im Abschluss (3.6, R2)', () => {
    const market = routeMarket(STATE, PAIR);
    const a = STATE.airports.FRA;
    const b = STATE.airports.MAD;
    const expected = marketSizeParts({
      a, b, month: M, world: worldScale(M), eventFactor: eventDemandFactor(activeWorldEvents(M, STATE.randomEvents), a.region, b.region),
    });
    assert.deepEqual(market.size, expected);
    assert.deepEqual(market.share, classShares(expected.businessShare, expected.referenceBlockMinutes));
  });

  it('Fluggäste je Klasse = Marktgröße × Klassen-Anteil; Summe = Marktgröße (3.6, 3.7)', () => {
    const market = routeMarket(STATE, PAIR);
    let sum = 0;
    for (const c of CABIN_CLASSES) {
      assert.ok(Math.abs(market.passengers[c] - market.size.marketSize * market.share[c]) < 1e-9);
      sum += market.passengers[c];
    }
    assert.ok(Math.abs(sum - market.size.marketSize) < 1e-6);
  });

  it('Marktpreise = Marktpreise der Strecke (4.3); Richtung egal', () => {
    const market = routeMarket(STATE, PAIR);
    assert.deepEqual(market.fares, routeMarketFares(STATE, PAIR));
    assert.deepEqual(routeMarket(STATE, { origin: 'MAD', destination: 'FRA' }).size.marketSize, market.size.marketSize);
  });

  it('hängt nicht von Gesellschaften, Strecken oder Schwierigkeit ab (3.6, W1)', () => {
    const empty: ModelState = { ...STATE, companies: [] };
    assert.equal(routeMarket(empty, PAIR).size.marketSize, routeMarket(STATE, PAIR).size.marketSize);
    const hard = modelGame(game({ difficulty: 'Hard' }), ENV).state;
    assert.equal(routeMarket(hard, PAIR).size.marketSize, routeMarket(STATE, PAIR).size.marketSize);
  });

  it('ein laufendes Weltereignis verkleinert den Markt (3.5): April 2020 × 0,2', () => {
    const april2020 = (2020 - 1960) * 12 + 3;
    const market = routeMarket({ ...STATE, month: april2020 }, PAIR);
    assert.ok(Math.abs(market.size.eventFactor - 0.2) < 1e-9, `${market.size.eventFactor}`);
  });

  it('unbekannter Flughafen: Fehler statt NaN', () => {
    assert.throws(() => routeMarket(STATE, { origin: 'FRA', destination: 'XXX' }));
  });
});
