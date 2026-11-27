/**
 * Regeltests zu SPEZIFIKATION 5.9 (feste Kosten und Ergebnis je Strecke), 5.14 (Werbung und Frequent flyer),
 * 5.16 (Kosten der Gesellschaft je Monat), 5.17 (gleiche Regeln für die KI) und dem ganzen Beispiel 5.18.
 * Paket 3.5b.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aircraftList } from '../data/aircraft';
import { airportUpkeepParts, slotRent, type AirportHoldings } from './airportCosts';
import { atCost } from './basics';
import { START_YEAR, WEEKS_PER_MONTH, type AircraftClass, type CabinClass } from './constants';
import {
  aircraftShare,
  campaignCost,
  ffpBaseCost,
  fixedWeeklyCost,
  fixedWeeklyCostParts,
  monthlyCosts,
  monthlyResult,
  routeBlockHours,
  routePassengerCost,
  routeResult,
  slotShare,
  unattributedWeeklyCost,
  type ClassPassengerCosts,
  type MonthlyCostsInput,
} from './costTotals';
import {
  airportFeeFactor,
  cateringCost,
  checkInFee,
  costPerPassengerParts,
  crewCost,
  ffpCostPerPassenger,
  fuelCost,
  fuelPrice,
  handlingFee,
  landingCost,
  payFactor,
  transferCostPerPassengerParts,
  type EndFees,
  type PassengerCostParts,
} from './costs';
import { blockMinutes, distanceKm, type Coords } from './demand';
import { breakEvenFareLevel, fullAircraftRevenue, marketFares, type PartialClassFigures } from './fare';
import { ageDepreciation, aircraftUpkeep, fleetCommonalityFactors, newAircraftPrice, type ValuedAircraft } from './fleet';
import { serviceCapability, type ServiceSelection } from './satisfaction';

const close = (actual: number, expected: number, tol = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} ≠ ${expected} (± ${tol})`);
const closeRel = (actual: number, expected: number, rel: number) =>
  assert.ok(Math.abs(actual - expected) <= rel * Math.abs(expected), `${actual} ≠ ${expected} (± ${rel * 100} %)`);

const m = (year: number, calendarMonth = 1) => (year - START_YEAR) * 12 + calendarMonth - 1;

const parts = (catering: number, fees: number, ffp: number): PassengerCostParts => ({
  catering,
  fees,
  ffp,
  total: catering + fees + ffp,
});

describe('Abschnitt 5.9 Feste Kosten und Ergebnis je Strecke', () => {
  it('5.9: fixedWeeklyCost = Flugbetrieb + Slot-Anteil + Flugzeug-Anteil; „before aircraft costs“ ohne Flugzeug', () => {
    const p = fixedWeeklyCostParts({ fuel: 100, crew: 20, landing: 50, slotShare: 7, aircraftShare: 30 });
    assert.equal(p.flightOps, 170);
    assert.equal(p.beforeAircraft, 177);
    assert.equal(p.total, 207);
    assert.equal(fixedWeeklyCost(p), 207);
  });

  it('5.9: Slot-Anteil = Abflüge je Woche × Slot-Miete an jedem Abflughafen', () => {
    const month = m(1990);
    const share = slotShare([
      { departures: 7, slotRent: slotRent('Narrowbody', month, 1) },
      { departures: 7, slotRent: slotRent('Narrowbody', month, 0.95) },
    ]);
    close(share, 7 * atCost(250, month) * 1.95);
  });

  it('5.9: Σ Strecken slotShare + nicht zugerechnete Slot-Miete = Slot-Miete der Gesellschaft', () => {
    const month = m(2000);
    // 20 Narrowbody-Slots gekauft; zwei Strecken belegen 7 und 10 davon, 3 bleiben frei.
    const holdings: AirportHoldings = {
      airportSize: 6,
      managementTier: 1,
      feeFactor: 1,
      slots: { Narrowbody: 20 },
      stands: {},
      desks: { normal: 1, self: 0 },
      deskLoad: 0.3,
      facilities: [],
    };
    const rent = slotRent('Narrowbody', month, 1);
    const routes = [slotShare([{ departures: 7, slotRent: rent }]), slotShare([{ departures: 10, slotRent: rent }])];
    const free = 3 * rent;
    close(routes[0] + routes[1] + free, airportUpkeepParts(holdings, month).slots);
  });

  it('5.9: Σ Strecken aircraftShare eines Flugzeugs = sein Unterhalt + ageDepreciation je Woche', () => {
    const upkeep = 300_000;
    const depreciation = 120_000;
    const hours = [10, 25, 5];
    const total = hours.reduce((a, b) => a + b, 0);
    const shares = hours.map((h) =>
      aircraftShare({ monthlyUpkeep: upkeep, monthlyAgeDepreciation: depreciation, routeBlockHours: h, aircraftBlockHours: total }),
    );
    close(shares.reduce((a, b) => a + b, 0), (upkeep + depreciation) / WEEKS_PER_MONTH);
  });

  it('5.9: fliegt ein Flugzeug nur diese Strecke, trägt sie seine ganzen Kosten', () => {
    close(
      aircraftShare({ monthlyUpkeep: 100, monthlyAgeDepreciation: 50, routeBlockHours: 8, aircraftBlockHours: 8 }),
      150 / WEEKS_PER_MONTH,
    );
    assert.throws(() => aircraftShare({ monthlyUpkeep: 1, monthlyAgeDepreciation: 1, routeBlockHours: 9, aircraftBlockHours: 8 }));
    assert.throws(() => aircraftShare({ monthlyUpkeep: 1, monthlyAgeDepreciation: 1, routeBlockHours: 0, aircraftBlockHours: 0 }));
  });

  it('5.9: Blockstunden nach Plan = Minuten × Abschnitte / 60', () => {
    close(routeBlockHours(90, 14), 21);
  });

  it('5.9: Ergebnis = Erlös − Kosten aller Fluggäste (Direkt und Umsteiger) − feste Kosten', () => {
    const direct: ClassPassengerCosts = {
      economy: { passengers: 1000, cost: parts(1, 10, 0) },
      business: { passengers: 50, cost: parts(4, 10, 0) },
    };
    const transfer: ClassPassengerCosts = { economy: { passengers: 100, cost: parts(1, 8, 0) } };
    const pax = routePassengerCost(direct, transfer);
    close(pax.catering, 1000 + 200 + 100);
    close(pax.fees, 10_000 + 500 + 800);
    close(pax.total, pax.catering + pax.fees + pax.ffp);
    close(routeResult({ revenue: 200_000, passengerCost: pax.total, fixedWeeklyCost: 150_000 }), 200_000 - pax.total - 150_000);
  });
});

describe('Abschnitt 5.14 Werbung und Frequent flyer', () => {
  it('5.14: Kampagnen 150 000 / 400 000 / 1 000 000 $ (1960) mit Kostenindex, ohne Jahresstufen', () => {
    assert.equal(campaignCost('local', 0), 75_000);
    assert.equal(campaignCost('national', 0), 200_000);
    assert.equal(campaignCost('global', 0), 500_000);
    close(campaignCost('global', m(2000, 7)), atCost(500_000, m(2000, 7)));
    // Stetig über den Jahreswechsel (keine 3-%-Stufe).
    assert.ok(campaignCost('local', m(2001)) / campaignCost('local', m(2000, 12)) < 1.002);
  });

  it('5.14: Frequent-flyer-Grundbetrag 50 000 $ (1960), nur solange das Programm läuft', () => {
    assert.equal(ffpBaseCost(false, m(1990)), 0);
    close(ffpBaseCost(true, m(1990)), atCost(50_000, m(1990)));
  });
});

describe('Abschnitt 5.16 Kosten der Gesellschaft je Monat', () => {
  const W = WEEKS_PER_MONTH;
  const route = {
    fuel: 30_000,
    crew: 5_000,
    landing: 20_000,
    passengers: parts(3_000, 15_000, 1_000),
  };
  const input: MonthlyCostsInput = {
    routes: [route, { ...route, fuel: 10_000 }],
    airportUpkeep: [8_000, 2_000],
    aircraftUpkeep: [100_000, 50_000],
    fleetValue: { depreciation: -200_000, trades: -10_000, total: -210_000 },
    campaigns: [150_000],
    ffpBase: 50_000,
    events: { charter: 1_000, crisisResponses: 2_000, interest: 3_000, damages: 4_000 },
    ownerFeeIncome: [5_000],
  };

  it('5.16: Posten nach dem Bericht; Wochenwerte × 4,348; Einnahme mindert', () => {
    const c = monthlyCosts(input);
    close(c.fuel, 40_000 * W);
    close(c.crew, 10_000 * W);
    close(c.landingFees, 40_000 * W);
    close(c.passengerFees, 30_000 * W);
    close(c.catering, 6_000 * W);
    close(c.airportUpkeep, 10_000 * W);
    close(c.aircraftUpkeep, 150_000);
    close(c.depreciation, 200_000);
    close(c.aircraftTrades, 10_000);
    close(c.marketing, 150_000 + 50_000 + 2_000 * W);
    close(c.airportIncome, 5_000 * W);
    const listed =
      c.fuel + c.crew + c.landingFees + c.passengerFees + c.catering + c.airportUpkeep + c.aircraftUpkeep +
      c.depreciation + c.aircraftTrades + c.marketing + c.charter + c.crisisResponses + c.interest + c.damages;
    close(c.total, listed - c.airportIncome);
    close(monthlyResult(5e6, c), 5e6 - c.total);
  });

  it('5.16 (W15): 12 Monate gleicher Wochenkosten = Wochenkosten × 52,18', () => {
    const weekly = { routes: [route], airportUpkeep: [], aircraftUpkeep: [], campaigns: [], ffpBase: 0, ownerFeeIncome: [] };
    const c = monthlyCosts({
      ...weekly,
      fleetValue: { depreciation: 0, trades: 0, total: 0 },
      events: { charter: 0, crisisResponses: 0, interest: 0, damages: 0 },
    });
    const perWeek = route.fuel + route.crew + route.landing + route.passengers.total;
    close(12 * c.total, perWeek * 52.18, perWeek * 0.01);
  });

  it('5.16: kein Dollar zählt zweimal: Σ Strecken-Ergebnisse − nicht zugerechnet = Monatsergebnis / Woche', () => {
    // Eine Gesellschaft: ein Flugzeug auf zwei Strecken, ein drittes Flugzeug geparkt, freie Slots, Werbung.
    const upkeepFlying = 120_000;
    const upkeepParked = 30_000;
    const plannedDepreciation = 80_000;
    const fleetValue = { depreciation: -95_000, trades: -5_000, total: -100_000 }; // Zustand und ein Verkauf unter Wert
    const rent = 300;
    const slotsBought = 30;
    const airport = slotsBought * rent + 4_000; // + Schalter
    const hours = [12, 8];
    const routes = hours.map((h, i) => {
      const departures = i === 0 ? 7 : 10;
      const fixed = fixedWeeklyCostParts({
        fuel: 20_000 + i,
        crew: 3_000,
        landing: 9_000,
        slotShare: slotShare([{ departures, slotRent: rent }]),
        aircraftShare: aircraftShare({
          monthlyUpkeep: upkeepFlying,
          monthlyAgeDepreciation: plannedDepreciation,
          routeBlockHours: h,
          aircraftBlockHours: 20,
        }),
      });
      const passengers = routePassengerCost({ economy: { passengers: 900, cost: parts(1, 12, 0.8) } });
      return { fixed, passengers, revenue: 80_000 };
    });
    const costs = monthlyCosts({
      routes: routes.map((r) => ({ fuel: r.fixed.fuel, crew: r.fixed.crew, landing: r.fixed.landing, passengers: r.passengers })),
      airportUpkeep: [airport],
      aircraftUpkeep: [upkeepFlying, upkeepParked],
      fleetValue,
      campaigns: [150_000],
      ffpBase: 50_000,
      events: { charter: 0, crisisResponses: 0, interest: 7_000, damages: 0 },
      ownerFeeIncome: [1_500],
    });
    const result = monthlyResult(160_000 * WEEKS_PER_MONTH, costs);
    const routeResults = routes.reduce(
      (sum, r) => sum + routeResult({ revenue: r.revenue, passengerCost: r.passengers.total, fixedWeeklyCost: r.fixed.total }),
      0,
    );
    // Nicht zugerechnet, Posten für Posten (5.16): freie Slots und Schalter, geparktes Flugzeug, Abschreibung über
    // die planbare hinaus, Werbung (ohne FFP je Fluggast, das in den Strecken steht), Zinsen, − Einnahme.
    const freeSlots = (slotsBought - 17) * rent + 4_000;
    const parked = upkeepParked / WEEKS_PER_MONTH;
    const extraDepreciation = (-fleetValue.total - plannedDepreciation) / WEEKS_PER_MONTH;
    const marketing = (150_000 + 50_000) / WEEKS_PER_MONTH;
    const unattributed = freeSlots + parked + extraDepreciation + marketing + 7_000 / WEEKS_PER_MONTH - 1_500;
    const attributed = routes.map((r) => ({ passengerCost: r.passengers.total, fixedWeeklyCost: r.fixed.total }));
    close(unattributedWeeklyCost(costs, attributed), unattributed, 1e-6);
    close(routeResults - unattributed, result / WEEKS_PER_MONTH, 1e-6);
  });
});

// ---------------------------------------------------------------------------
// Gemeinsame Rechnung einer Strecke für 5.17 und 5.18
// ---------------------------------------------------------------------------

const typeOf = (name: string) => {
  const t = aircraftList.find((a) => a.type === name);
  if (!t) throw new Error(name);
  return t;
};

const FRANKFURT: Coords = [50.03, 8.57];
const PARIS: Coords = [49.01, 2.55];
const MADRID: Coords = [40.47, -3.56];
const NEW_YORK: Coords = [40.64, -73.78];
const PEANUTS: ServiceSelection = { meals: [['b5'], ['b5'], ['b5']], extras: [], onboardService: [] };

interface Airline {
  readonly salaryPct: number;
  readonly research: readonly string[];
  readonly ffp: boolean;
}

/**
 * Eine Strecke A–B mit einem neuen Flugzeug, das nur sie fliegt, beide Flughäfen gleich groß, Hin und Zurück,
 * volle Maschine, Preis = Marktpreis. Rechnet nur mit den Modell-Funktionen.
 */
function weeklyRoute(name: string, to: Coords, year: number, roundTrips: number, seats: PartialClassFigures, airline: Airline, airportSize = 7, tier = 0) {
  const t = typeOf(name);
  const cls = t.class as AircraftClass;
  const month = m(year);
  const km = distanceKm(FRANKFURT, to);
  const minutes = blockMinutes(km, t.cruiseSpeed);
  const legs = 2 * roundTrips;
  const feeFactor = airportFeeFactor(tier, airline.research);

  const fuel = fuelCost({ efficiency: t.efficiency, capacity: t.capacity, greatCircleKm: km, flownLegs: legs, fuelPrice: fuelPrice(month, airline.research) });
  const crew = crewCost({ seats, blockMinutes: minutes, flownLegs: legs, month, payFactor: payFactor(airline.salaryPct), completedResearch: airline.research });
  const landingAircraft = { aircraftClass: cls, capacity: t.capacity, cruiseSpeed: t.cruiseSpeed };
  const landing = landingCost(
    landingAircraft,
    [
      { airportSize, feeFactor, landings: roundTrips },
      { airportSize, feeFactor, landings: roundTrips },
    ],
    month,
  );
  const rent = slotRent(cls, month, feeFactor);
  const slots = slotShare([
    { departures: roundTrips, slotRent: rent },
    { departures: roundTrips, slotRent: rent },
  ]);

  const plane: ValuedAircraft = {
    listPrice1960: t.basePrice,
    builtMonth: month,
    cabinListPrice1960: 0, // Standard-Sitze ohne Ausstattung
    cabinInstalledMonth: month,
    airframeCondition: 100,
    cabinCondition: 100,
  };
  const [commonality] = fleetCommonalityFactors([{ family: t.family }]);
  const upkeep = aircraftUpkeep({ listPrice1960: t.basePrice, builtMonth: month, month, commonalityFactor: commonality, parked: false, completedResearch: airline.research });
  const hours = routeBlockHours(minutes, legs);
  const share = aircraftShare({ monthlyUpkeep: upkeep, monthlyAgeDepreciation: ageDepreciation(plane, month), routeBlockHours: hours, aircraftBlockHours: hours });
  const fixed = fixedWeeklyCostParts({ fuel, crew, landing, slotShare: slots, aircraftShare: share });

  const capability = serviceCapability({ aircraftClass: cls, hasWifi: false, hasPremiumGalley: false, cateringFacility: false });
  const end: EndFees = { checkInFee: checkInFee(month, feeFactor), handlingFee: handlingFee(airportSize, month, feeFactor), departureShare: 0.5 };
  const perPax = costPerPassengerParts({
    cateringCost: cateringCost(PEANUTS, minutes, capability, month, airline.research),
    ends: [end, end],
    ffpCostPerPassenger: ffpCostPerPassenger(airline.ffp, month),
  });
  const direct: Partial<Record<CabinClass, { passengers: number; cost: PassengerCostParts }>> = {};
  const seatsPerWeek: Partial<Record<CabinClass, number>> = {};
  for (const [c, n] of Object.entries(seats) as [CabinClass, number][]) {
    direct[c] = { passengers: n * legs, cost: perPax };
    seatsPerWeek[c] = n * legs;
  }
  const passengers = routePassengerCost(direct);
  const fares = marketFares(km, month);
  const revenue = fullAircraftRevenue(seatsPerWeek, fares);
  const cost = passengers.total + fixed.total;
  return { month, fixed, passengers, perPax, revenue, cost, result: routeResult({ revenue, passengerCost: passengers.total, fixedWeeklyCost: fixed.total }), fares, seatsPerWeek, newPrice: newAircraftPrice(t.basePrice, 0, month) };
}

describe('Abschnitt 5.17 Gleiche Regeln für die KI', () => {
  const AI: Airline = { salaryPct: 100, research: [], ffp: false };

  it('5.17: Spieler mit Lohn 100 %, ohne Forschung, Werbung und Programm hat dieselben Kosten wie eine KI', () => {
    const player: Airline = { salaryPct: 100, research: [], ffp: false };
    for (const [name, to, year] of [['A320ceo', MADRID, 1990], ['A330-300', NEW_YORK, 2020]] as const) {
      const p = weeklyRoute(name, to, year, 7, { economy: 150 }, player, 6, 2);
      const a = weeklyRoute(name, to, year, 7, { economy: 150 }, AI, 6, 2);
      assert.equal(p.cost, a.cost);
      assert.equal(p.fixed.total, a.fixed.total);
    }
  });

  it('5.17: Lohn, Forschung und Frequent flyer machen nur den Spieler anders', () => {
    const base = weeklyRoute('A320ceo', MADRID, 1990, 7, { economy: 150 }, AI);
    const research = weeklyRoute('A320ceo', MADRID, 1990, 7, { economy: 150 }, { salaryPct: 100, research: ['fuel-1', 'maint-1'], ffp: false });
    const ffp = weeklyRoute('A320ceo', MADRID, 1990, 7, { economy: 150 }, { salaryPct: 100, research: [], ffp: true });
    assert.ok(research.cost < base.cost);
    assert.ok(ffp.cost > base.cost);
    close(ffp.passengers.ffp, 150 * 14 * atCost(0.8, m(1990)));
  });
});

describe('Beispiel 5.18 (ganz): Erlös, Kosten und Ergebnis je Woche', () => {
  const AI: Airline = { salaryPct: 100, research: [], ffp: false };
  /**
   * Fall, Umläufe, Sitze; dann aus der Spezifikation: Erlös, Kosten, Ergebnis, Anteile Treibstoff / Landung /
   * je Fluggast / Besatzung / Flugzeug-Anteil, je Fluggast in $.
   * Toleranz (F32): Erlös und Kosten ± 0,1 %, Ergebnis ± 0,25 %, Anteile ± 0,5 Prozentpunkte, je Fluggast ± 0,5 Cent.
   */
  const CASES = [
    ['Caravelle III', PARIS, 1962, 14, { economy: 80 }, 125_135, 118_610, 6_527, [0.19, 0.38, 0.22, 0.05, 0.11], 11.72],
    ['ATR 72-200', PARIS, 1990, 14, { economy: 68 }, 148_543, 131_298, 17_246, [0.10, 0.40, 0.24, 0.08, 0.16], 16.36],
    ['A320ceo', MADRID, 1990, 7, { economy: 150, business: 12 }, 351_396, 252_074, 99_244, [0.20, 0.29, 0.15, 0.05, 0.30], 16.36],
    ['A320ceo', MADRID, 2020, 7, { economy: 150, business: 12 }, 502_588, 399_516, 102_912, [0.27, 0.26, 0.13, 0.05, 0.27], 23.40],
    ['A330-300', NEW_YORK, 1995, 7, { economy: 250, business: 30 }, 1_461_853, 914_924, 546_873, [0.53, 0.11, 0.08, 0.08, 0.20], 17.89],
    ['A330-300', NEW_YORK, 2020, 7, { economy: 250, business: 30 }, 1_969_774, 1_707_833, 261_819, [0.66, 0.08, 0.06, 0.06, 0.14], 24.10],
  ] as const;

  for (const [name, to, year, roundTrips, seats, revenue, cost, result, shares, perPax] of CASES) {
    it(`5.18: ${name} ${year}: Erlös ${revenue}, Kosten ${cost}, Ergebnis ${result}`, () => {
      const r = weeklyRoute(name, to, year, roundTrips, seats, AI);
      closeRel(r.revenue, revenue, 0.001);
      closeRel(r.cost, cost, 0.001);
      closeRel(r.result, result, 0.0025);
      close(r.perPax.total, perPax, 0.005);
      const [fuel, landing, passengers, crew, aircraft] = shares;
      close(r.fixed.fuel / r.cost, fuel, 0.005);
      close(r.fixed.landing / r.cost, landing, 0.005);
      close(r.passengers.total / r.cost, passengers, 0.005);
      close(r.fixed.crew / r.cost, crew, 0.005);
      close(r.fixed.aircraftShare / r.cost, aircraft, 0.005);
      const slot = r.fixed.slotShare / r.cost;
      assert.ok(slot >= 0 && slot <= 0.065, `Slot-Anteil ${slot}`);
      assert.ok(r.result > 0, 'volle Maschine bringt Gewinn');
    });
  }

  it('5.18: Gewinnschwelle A320ceo FRA–MAD 1990: feste Kosten 214 965 $, Preisniveau 0,72 voll, 0,92 bei 75 %', () => {
    const r = weeklyRoute('A320ceo', MADRID, 1990, 7, { economy: 150, business: 12 }, AI);
    closeRel(r.fixed.total, 214_965, 0.001);
    const classes = {
      economy: { seatsPerWeek: r.seatsPerWeek.economy as number, marketFare: r.fares.economy, costPerPassenger: r.perPax.total },
      business: { seatsPerWeek: r.seatsPerWeek.business as number, marketFare: r.fares.business, costPerPassenger: r.perPax.total },
    };
    close(breakEvenFareLevel(1, r.fixed.total, classes), 0.72, 0.005);
    close(breakEvenFareLevel(0.75, r.fixed.total, classes), 0.92, 0.005);
  });

  it('5.18: Kaufpreis ohne Kabinen-Ausstattung = Listenpreis × Kostenindex (E54)', () => {
    const r = weeklyRoute('A320ceo', MADRID, 1990, 7, { economy: 150, business: 12 }, AI);
    close(r.newPrice, atCost(typeOf('A320ceo').basePrice, m(1990)));
  });
});

describe('Abschnitt 5.8 / 5.16 Posten der Kosten je Fluggast', () => {
  it('5.16: Verpflegung + Gebühren + FFP = costPerPassenger; Umsteiger ebenso', () => {
    const a: EndFees = { checkInFee: 1.2, handlingFee: 9, departureShare: 0.5 };
    const b: EndFees = { checkInFee: 1, handlingFee: 7, departureShare: 0.5 };
    const direct = costPerPassengerParts({ cateringCost: 3, ends: [a, b], ffpCostPerPassenger: 0.8 });
    close(direct.catering, 3);
    close(direct.fees, 0.5 * 10.2 + 0.5 * 8);
    close(direct.ffp, 0.8);
    close(direct.total, direct.catering + direct.fees + direct.ffp);
    const transfer = transferCostPerPassengerParts({ cateringCost: 2, outer: a, hub: b, ffpCostPerPassenger: 0.8 });
    close(transfer.fees, 0.5 * 9 + 0.5 * 7 + 0.5 * 1.2);
    close(transfer.ffp, 0.4);
    close(transfer.total, 2 + transfer.fees + 0.4);
  });
});
