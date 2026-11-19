/**
 * Buchung eines Monats für alle Gesellschaften in EINER Rechnung (SPEZIFIKATION 8.0 Schritt 2, 8.1, 8.2; R1, E44).
 *
 * Diese Datei fragt nie „ist das eine KI?“: Spieler und KI unterscheiden sich nur über neutrale Eingaben (7.1, 7.2).
 * Die Entscheidungen der KI und die Schritte nur des Spielers setzt `monthClose.ts` zusammen (F41).
 *
 * Aufbau:
 * - `bookMonth`: Fluggäste (eine Marktaufteilung je Paar und Klasse), Erlös, gestrichene und gecharterte Flüge,
 *   Kosten, Verschleiß, Vogelschläge und die Kasse nach dem Betrieb.
 * - `finishMonth`: Wert der Flotte am Monatsende, Monatsergebnis mit allen Geschäften des Monats, Kasse am
 *   Monatsende und Bericht (8.2). Läuft nach den Schritten 3–6, weil Lieferungen, Zwangs- und KI-Verkäufe,
 *   Prämien und Dividende in denselben Bericht gehören (R11).
 *
 * Das Modell kennt den Spielstand des Spiels nicht (F14, F32, F39): Was aus vielen Einstellungen folgt (Kosten je
 * Abschnitt, Satisfaction je Klasse, Faktoren der Anziehung, Unterhalt der Flughäfen) bringt der Aufrufer als
 * `RouteUnits` und `CompanyWorld` mit; die Funktionen dafür stehen in den Abschnitts-Dateien.
 */

import { CABIN_CLASSES, WEEKS_PER_MONTH, type CabinClass, type CampaignLevel, type WorldRegion } from './constants';
import { campaignCost, ffpBaseCost, fixedWeeklyCost, monthlyCosts, monthlyResult, routePassengerCost, routeResult, type ClassPassengerCosts, type MonthlyCosts } from './costTotals';
import type { PassengerCostParts } from './costs';
import { classShare, eventDemandFactor, type DemandEvent } from './demand';
import { marketFares, monthlyRevenue, routeFare, routeRevenue, type ClassFigures, type PartialClassFigures } from './fare';
import { aircraftUpkeep, aircraftValue, fleetCommonalityFactors, fleetValueResultParts, type FleetValueResultParts, type ValuedAircraft } from './fleet';
import { creditInterest, creditLimit } from './fleetMarket';
import {
  birdStrikeCost,
  charterCost,
  companyCancelledShare,
  disruptionShares,
  flownHours,
  flownLegs,
  monthlyWear,
  offeredSeats,
  rollBirdStrike,
  routeCauses,
  wornCondition,
  type Disruption,
  type DisruptionShares,
} from './monthEvents';
import { classPotential, directOffer, distributeToRoutes, marketSplit, noFlyAppeal, offerAppeal, rampFactor, type OfferAppealInput, type SplitOffer } from './marketSplit';
import { researchEffects } from './progress';
import { airlineSatisfaction, directOfferSatisfaction, satisfactionFactor } from './satisfaction';

// ---------------------------------------------------------------------------
// Eingaben
// ---------------------------------------------------------------------------

/** Ein Städtepaar, wie die Buchung es braucht (Werte des Monats X, ohne Ereignisse). */
export interface BookingMarket {
  readonly id: string;
  /** Regionen beider Enden (`regionOf`, R15). */
  readonly regions: readonly [WorldRegion, WorldRegion];
  readonly greatCircleKm: number;
  /** `referenceBlockMinutes` (3.1). */
  readonly referenceBlockMinutes: number;
  /** `marketSize` (3.6) des Monats **ohne** Ereignis-Faktor (`eventFactor` 1); die Buchung setzt ihn ein. */
  readonly marketSize: number;
  /** `businessShare` (3.2) für die Klassen-Anteile (3.7). */
  readonly businessShare: number;
}

/** Ein Flugzeug einer Gesellschaft. */
export interface BookingPlane extends ValuedAircraft {
  readonly id: string;
  /** Familie für den Flotten-Mix (5.12). */
  readonly family: string;
}

/** Eine Strecke (ein Flugzeug, ein Paar). Was der Spieler einstellt bzw. die KI entscheidet. */
export interface BookingRoute {
  readonly id: string;
  readonly marketId: string;
  readonly planeId: string;
  readonly airportIds: readonly [string, string];
  /** Sitze je Flug je Klasse. */
  readonly seatsPerFlight: PartialClassFigures;
  /** Geplante Abflüge (= Flugabschnitte) je Woche, beide Richtungen. */
  readonly departuresPerWeek: number;
  /** Flugzeit eines Abschnitts in Minuten. */
  readonly blockMinutes: number;
  /** Gespeichertes Preisniveau je Klasse (E56); fehlt = `FARE_RATIO_DEFAULT` (R8). Vom Monatsbeginn (4.5). */
  readonly fareRatio?: PartialClassFigures;
  /** `offerAgeMonths` des Paars für diese Gesellschaft (3.9.6, 3.12). */
  readonly ageMonths: number;
}

/**
 * Abgeleitete Werte einer Strecke für den Monat X; baut der Aufrufer mit den Funktionen aus 2, 3 und 5 aus dem
 * Spielstand (Phase 4). Die KI bekommt neutrale Werte (`RIVAL_INPUTS`, 7.2).
 */
export interface RouteUnits {
  /** `fuelCost` je geflogenem Abschnitt (5.3, mit Absicherung 8.5). */
  readonly fuelPerLeg: number;
  /** `crewCost` je geflogenem Abschnitt (5.4). */
  readonly crewPerLeg: number;
  /** `landingCost` je geflogenem Abschnitt (5.5). */
  readonly landingPerLeg: number;
  /** `costPerPassengerParts` je Klasse und Abschnitt (5.8). */
  readonly passengerCost: Readonly<Partial<Record<CabinClass, PassengerCostParts>>>;
  /** `satisfaction(c)` der Strecke (2.7). */
  readonly satisfaction: PartialClassFigures;
  /** `slotShare` (5.9) je Woche; nur für das Strecken-Ergebnis (Zurechnung). */
  readonly slotShare: number;
  /** `aircraftShare` (5.9) je Woche; nur für das Strecken-Ergebnis (Zurechnung). */
  readonly aircraftShare: number;
  /** Weitere Faktoren der Anziehung (3.9); fehlend = 1. Gleich für alle Strecken einer Gesellschaft auf dem Paar. */
  readonly appeal?: Pick<
    OfferAppealInput,
    'advertisingFactor' | 'frequentFlyerFactor' | 'researchDemandFactor' | 'crisisResponseFactor' | 'difficultyFactor'
  >;
  /** Feld `rampBonus` der Forschung (6.9); Standard 0. */
  readonly rampBonus?: number;
}

/** Abgeleitete Werte einer Gesellschaft für den Monat X (Aufrufer, Phase 4). */
export interface CompanyWorld {
  /** `RouteUnits` je Strecken-Id. */
  readonly routes: Readonly<Record<string, RouteUnits>>;
  /** `airportUpkeep` je Flughafen, je Woche (5.11). */
  readonly airportUpkeepWeekly: readonly number[];
  /** `ownerFeeIncome` je Flughafen, je Woche (5.15). */
  readonly ownerFeeIncomeWeekly: readonly number[];
}

/** Art eines Geschäfts, das die Kasse ändert. */
export type TransactionKind =
  | 'purchase'
  | 'delivery'
  | 'sale'
  | 'refit'
  | 'overhaul'
  | 'deposit'
  | 'preorderCancel'
  | 'slots'
  | 'tier'
  | 'facility'
  | 'research'
  | 'crisisResponse'
  | 'takeover'
  | 'prize'
  | 'goalPenalty'
  | 'dividend';

/**
 * Ein Geschäft im Monat (8.2): während des Monats (Spieler) oder im Abschluss (Lieferung, Zwangs- und KI-Verkauf,
 * Prämien, Dividende). Die Kasse ist schon geändert, wenn das Geschäft im Spielstand steht.
 */
export interface MonthTransaction {
  readonly kind: TransactionKind;
  /** Änderung der Kasse (bezahlt negativ, erhalten positiv). */
  readonly cash: number;
  /** Änderung des Flottenwerts zum Zeitpunkt des Geschäfts (Kauf +Wert, Verkauf −Wert, Umbau Wert danach − davor). */
  readonly valueChange?: number;
  /** Änderung der Anzahlungen (8.12): Anzahlung +, Lieferung und Storno −. */
  readonly depositChange?: number;
  readonly planeId?: string;
}

/** Eine Gesellschaft, so weit die Buchung sie braucht (Bestand am Ende von Monat X vor dem Abschluss). */
export interface BookingCompany {
  readonly id: string;
  /** Kasse am Monatsanfang (= Kasse am Monatsende von X−1, 8.2). */
  readonly cashAtMonthStart: number;
  /** Kasse jetzt: Monatsanfang + Geschäfte des Monats. */
  readonly cash: number;
  /** Ruf vom Monatsanfang (3.9.4). */
  readonly reputation: number;
  readonly planes: readonly BookingPlane[];
  readonly routes: readonly BookingRoute[];
  /** Geschäfte des Monats bis jetzt. */
  readonly transactions: readonly MonthTransaction[];
  /** Fertige Forschung (KI: keine). */
  readonly completedResearch: readonly string[];
  /** Laufende Kampagnen dieses Monats (KI: keine). */
  readonly campaigns: readonly CampaignLevel[];
  /** Frequent-flyer-Programm läuft (KI: nein). */
  readonly ffpActive: boolean;
  /** Anteil gestrichener Flüge durch Personalstreik (`strikeCancelShare`, 8.7; KI 0). */
  readonly staffStrikeShare: number;
  /** Zuschuss im Monat (7.14; Spieler 0). Eigene Zeile im Ergebnis. */
  readonly subsidy: number;
  /** Σ Anzahlungen am Monatsanfang (8.12; KI 0). */
  readonly depositsAtMonthStart: number;
}

/** Alles, was `bookMonth` braucht. */
export interface BookingInput {
  readonly month: number;
  readonly seed: number;
  readonly markets: readonly BookingMarket[];
  /** Laufende Weltereignisse des Monats (8.4), für `eventDemandFactor`. */
  readonly events: readonly DemandEvent[];
  /** Störungen des Monats (8.6) mit Charter-Antworten. */
  readonly disruptions: readonly Disruption[];
  readonly companies: readonly { readonly company: BookingCompany; readonly world: CompanyWorld }[];
}

// ---------------------------------------------------------------------------
// Ergebnisse
// ---------------------------------------------------------------------------

/** Eine Strecke nach der Buchung (Wochenwerte). */
export interface RouteBooking {
  readonly id: string;
  readonly marketId: string;
  readonly planeId: string;
  /** Direktgäste je Woche je Klasse. */
  readonly passengers: ClassFigures;
  /** Σ Fluggäste je Woche. */
  readonly totalPassengers: number;
  /** Angebotene Sitze je Woche (nach gestrichenen Flügen). */
  readonly offeredSeats: number;
  readonly shares: DisruptionShares;
  /** Selbst geflogene Abschnitte je Woche. */
  readonly flownLegs: number;
  readonly revenue: number;
  readonly fuel: number;
  readonly crew: number;
  readonly landing: number;
  readonly passengerCost: PassengerCostParts;
  /** `fixedWeeklyCost` (5.9) mit den geflogenen Abschnitten. */
  readonly fixedWeeklyCost: number;
  /** `routeResult` (5.9) je Woche. */
  readonly result: number;
}

/** Ein Flugzeug nach dem Betrieb: Zustand am Monatsende. */
export interface PlaneBooking {
  readonly id: string;
  readonly flying: boolean;
  readonly flownHours: number;
  readonly airframeCondition: number;
  readonly cabinCondition: number;
  readonly upkeep: number;
  readonly birdStrike: boolean;
}

/** Eine Gesellschaft nach dem Betrieb (Schritt 2). */
export interface CompanyBooking {
  readonly companyId: string;
  readonly routes: readonly RouteBooking[];
  readonly planes: readonly PlaneBooking[];
  /** Monatserlös (4.9). */
  readonly revenue: number;
  /** Fluggäste im Monat (je Woche × `WEEKS_PER_MONTH`). */
  readonly passengers: number;
  /** Fluggäste je Woche (jede Teilstrecke). */
  readonly weeklyPassengers: number;
  /** `cancelledShare` der Gesellschaft (8.9). */
  readonly cancelledShare: number;
  /** `airlineSatisfaction` (2.9). */
  readonly airlineSatisfaction: number;
  /** Kosten aus Abschnitt 8. */
  readonly charter: number;
  readonly interest: number;
  readonly damages: number;
  /** Laufende Kosten ohne Flottenwert und ohne schon bezahlte Krisen-Antworten (alles Zahlungen im Abschluss). */
  readonly operatingCosts: MonthlyCosts;
  /** Kasse nach dem Betrieb: Kasse + Erlös + Zuschuss − laufende Kosten. */
  readonly cashAfterOperations: number;
  /** Σ `aircraftValue` am Monatsanfang (vor den Geschäften dieses Monats). */
  readonly fleetValueStart: number;
}

// ---------------------------------------------------------------------------
// Schritt 2: Betrieb
// ---------------------------------------------------------------------------

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

/** Sitze aller Klassen je Flug. */
export function seatsPerFlightTotal(route: Pick<BookingRoute, 'seatsPerFlight'>): number {
  return CABIN_CLASSES.reduce((s, c) => s + (route.seatsPerFlight[c] ?? 0), 0);
}

/** Die Störungs-Anteile einer Strecke im Monat (8.9). */
export function routeDisruptionShares(
  route: Pick<BookingRoute, 'planeId' | 'airportIds'>,
  market: Pick<BookingMarket, 'regions'>,
  disruptions: readonly Disruption[],
  staffStrikeShare: number,
): DisruptionShares {
  return disruptionShares(
    routeCauses({ planeId: route.planeId, airportIds: route.airportIds, regions: market.regions }, disruptions, staffStrikeShare),
  );
}

/** Ein Angebot einer Gesellschaft auf einem Paar, für die Aufteilung. */
interface MarketOffer {
  readonly companyId: string;
  readonly reputation: number;
  readonly routes: readonly { readonly route: BookingRoute; readonly units: RouteUnits; readonly cancelledShare: number }[];
}

/**
 * Fluggäste je Woche je Strecke und Klasse für alle Angebote eines Paars: eine `marketSplit` je Klasse (R1, 3.11),
 * dann nach Sitzen auf die Strecken (`distributeToRoutes`). Gestrichene Flüge bieten keine Sitze (8.9).
 * Planer, KI-Planung und Abschluss rechnen mit dieser Funktion (R2).
 */
export function splitMarket(
  market: BookingMarket,
  offers: readonly MarketOffer[],
  month: number,
  events: readonly DemandEvent[],
): Record<string, Record<CabinClass, number>> {
  const fares = marketFares(market.greatCircleKm, month);
  const size = market.marketSize * eventDemandFactor(events, market.regions[0], market.regions[1]);
  const byRoute: Record<string, Record<CabinClass, number>> = {};
  for (const offer of offers) {
    for (const r of offer.routes) {
      byRoute[r.route.id] = { economy: 0, premium: 0, business: 0, first: 0 };
    }
  }
  for (const c of CABIN_CLASSES) {
    const split: SplitOffer[] = [];
    const seatsByOffer: Record<string, Record<string, number>> = {};
    for (const offer of offers) {
      const flying = offer.routes.filter((r) => r.route.departuresPerWeek > 0);
      if (flying.length === 0) continue;
      const weeklySeats: Record<string, number> = {};
      for (const r of flying) {
        weeklySeats[r.route.id] = offeredSeats((r.route.seatsPerFlight[c] ?? 0) * r.route.departuresPerWeek, r.cancelledShare);
      }
      const seats = sum(Object.values(weeklySeats));
      if (!(seats > 0)) continue;
      seatsByOffer[offer.companyId] = weeklySeats;
      const figures = directOffer(
        flying.map((r) => ({
          id: r.route.id,
          seatsPerFlight: r.route.seatsPerFlight,
          departuresPerWeek: r.route.departuresPerWeek,
          blockMinutes: r.route.blockMinutes,
          fare: Object.fromEntries(CABIN_CLASSES.map((k) => [k, routeFare(r.route.fareRatio?.[k], fares[k])])),
        })),
        fares,
      );
      const offerSatisfaction = directOfferSatisfaction(
        flying
          .filter((r) => (r.route.seatsPerFlight[c] ?? 0) > 0)
          .map((r) => ({ satisfaction: r.units.satisfaction[c] ?? 100, seatsPerWeek: (r.route.seatsPerFlight[c] ?? 0) * r.route.departuresPerWeek })),
      );
      const age = Math.max(...flying.map((r) => r.route.ageMonths));
      const first = flying[0].units;
      split.push({
        id: offer.companyId,
        seats,
        ramp: rampFactor(age, first.rampBonus ?? 0),
        appeal: offerAppeal(c, {
          frequency: figures.frequency,
          fare: figures.fare[c],
          marketFare: fares[c],
          satisfactionFactor: satisfactionFactor(offerSatisfaction ?? 100),
          blockMinutes: figures.blockMinutes,
          referenceBlockMinutes: market.referenceBlockMinutes,
          reputation: offer.reputation,
          ageMonths: age,
          ...first.appeal,
        }),
      });
    }
    if (split.length === 0) continue;
    const result = marketSplit({
      potential: classPotential(c, size, classShare(c, market.businessShare, market.referenceBlockMinutes)),
      noFlyAppeal: noFlyAppeal(c),
      offers: split,
    });
    for (const o of split) {
      const perRoute = distributeToRoutes(result.passengers[o.id], seatsByOffer[o.id]);
      for (const [routeId, pax] of Object.entries(perRoute)) byRoute[routeId][c] = pax;
    }
  }
  return byRoute;
}

/**
 * Schritt 2 des Abschlusses für alle Gesellschaften (8.0, R1): Störungen je Strecke (8.9), eine Marktaufteilung je
 * Paar und Klasse mit allen Angeboten, Erlös (4.7, 4.9), geflogene Abschnitte, Kosten je Posten (5.16 und
 * Abschnitt 8: Charter, Zinsen, Vogelschläge), Verschleiß aus geflogenen Stunden (8.10), Unterhalt (5.12) und die
 * Kasse nach dem Betrieb. Das Ergebnis hängt nicht von der Reihenfolge der Gesellschaften ab (7.8).
 */
export function bookMonth(input: BookingInput): CompanyBooking[] {
  const { month, seed } = input;
  const markets = new Map(input.markets.map((m) => [m.id, m]));
  const marketOf = (id: string): BookingMarket => {
    const m = markets.get(id);
    if (!m) throw new Error(`bookMonth: Paar ${id} fehlt`);
    return m;
  };

  // Störungs-Anteile je Strecke.
  const shares = new Map<string, DisruptionShares>();
  for (const { company } of input.companies) {
    for (const route of company.routes) {
      shares.set(`${company.id}/${route.id}`, routeDisruptionShares(route, marketOf(route.marketId), input.disruptions, company.staffStrikeShare));
    }
  }

  // Eine Aufteilung je Paar mit allen Gesellschaften.
  const offersByMarket = new Map<string, MarketOffer[]>();
  for (const { company, world } of input.companies) {
    const byMarket = new Map<string, MarketOffer['routes'][number][]>();
    for (const route of company.routes) {
      const units = world.routes[route.id];
      if (!units) throw new Error(`bookMonth: Strecke ${route.id} ohne RouteUnits`);
      const list = byMarket.get(route.marketId) ?? [];
      list.push({ route, units, cancelledShare: shares.get(`${company.id}/${route.id}`)!.cancelledShare });
      byMarket.set(route.marketId, list);
    }
    for (const [marketId, routes] of byMarket) {
      const list = offersByMarket.get(marketId) ?? [];
      list.push({ companyId: company.id, reputation: company.reputation, routes });
      offersByMarket.set(marketId, list);
    }
  }
  const paxByRoute = new Map<string, Record<CabinClass, number>>();
  for (const [marketId, offers] of offersByMarket) {
    const split = splitMarket(marketOf(marketId), offers, month, input.events);
    for (const offer of offers) {
      for (const r of offer.routes) paxByRoute.set(`${offer.companyId}/${r.route.id}`, split[r.route.id]);
    }
  }

  return input.companies.map(({ company, world }) => {
    const research = researchEffects(company.completedResearch);
    const routes: RouteBooking[] = company.routes.map((route) => {
      const key = `${company.id}/${route.id}`;
      const units = world.routes[route.id];
      const market = marketOf(route.marketId);
      const share = shares.get(key)!;
      const passengers = paxByRoute.get(key)!;
      const fares = marketFares(market.greatCircleKm, month);
      const routeFares = Object.fromEntries(CABIN_CLASSES.map((c) => [c, routeFare(route.fareRatio?.[c], fares[c])])) as ClassFigures;
      const revenue = routeRevenue({ directPassengers: passengers, fares: routeFares });
      const legs = flownLegs(route.departuresPerWeek, share.flownShare);
      const fuel = units.fuelPerLeg * legs;
      const crew = units.crewPerLeg * legs;
      const landing = units.landingPerLeg * legs;
      const direct: Partial<Record<CabinClass, { passengers: number; cost: PassengerCostParts }>> = {};
      for (const c of CABIN_CLASSES) {
        const cost = units.passengerCost[c];
        if (passengers[c] > 0 && cost) direct[c] = { passengers: passengers[c], cost };
      }
      const passengerCost = routePassengerCost(direct as ClassPassengerCosts);
      const fixed = fixedWeeklyCost({ fuel, crew, landing, slotShare: units.slotShare, aircraftShare: units.aircraftShare });
      return {
        id: route.id,
        marketId: route.marketId,
        planeId: route.planeId,
        passengers,
        totalPassengers: sum(CABIN_CLASSES.map((c) => passengers[c])),
        offeredSeats: offeredSeats(seatsPerFlightTotal(route) * route.departuresPerWeek, share.cancelledShare),
        shares: share,
        flownLegs: legs,
        revenue,
        fuel,
        crew,
        landing,
        passengerCost,
        fixedWeeklyCost: fixed,
        result: routeResult({ revenue, passengerCost: passengerCost.total, fixedWeeklyCost: fixed }),
      };
    });

    // Flugzeuge: Verschleiß aus geflogenen Stunden (8.10), Unterhalt (5.12), Vogelschlag (8.6).
    const commonality = fleetCommonalityFactors(company.planes);
    let damages = 0;
    const planes: PlaneBooking[] = company.planes.map((plane, i) => {
      const own = company.routes.filter((r) => r.planeId === plane.id && r.departuresPerWeek > 0);
      const flying = own.length > 0;
      const hours = flownHours(
        own.map((r) => ({ blockMinutesPerWeek: r.blockMinutes * r.departuresPerWeek, flownShare: shares.get(`${company.id}/${r.id}`)!.flownShare })),
      );
      const wear = monthlyWear(hours, research.wearFactor);
      const birdStrike = flying && rollBirdStrike(seed, month, plane.id);
      if (birdStrike) damages += birdStrikeCost(plane.listPrice1960, month);
      return {
        id: plane.id,
        flying,
        flownHours: hours,
        airframeCondition: wornCondition(plane.airframeCondition, wear.airframe, 'airframeCondition'),
        cabinCondition: wornCondition(plane.cabinCondition, wear.cabin, 'cabinCondition'),
        upkeep: aircraftUpkeep({
          listPrice1960: plane.listPrice1960,
          builtMonth: plane.builtMonth,
          month,
          commonalityFactor: commonality[i],
          parked: !flying,
          completedResearch: company.completedResearch,
        }),
        birdStrike,
      };
    });

    const charter = charterCost(
      routes.map((r, i) => {
        const route = company.routes[i];
        const units = world.routes[route.id];
        return {
          flightOpsWeekly: (units.fuelPerLeg + units.crewPerLeg + units.landingPerLeg) * route.departuresPerWeek,
          plannedLegsPerWeek: route.departuresPerWeek,
          charteredShare: r.shares.charteredShare,
        };
      }),
    );
    const interest = creditInterest(company.cashAtMonthStart);
    const revenue = monthlyRevenue(routes.map((r) => r.revenue));
    const operatingCosts = monthlyCosts({
      routes: routes.map((r) => ({ fuel: r.fuel, crew: r.crew, landing: r.landing, passengers: r.passengerCost })),
      airportUpkeep: world.airportUpkeepWeekly,
      aircraftUpkeep: planes.map((p) => p.upkeep),
      fleetValue: { depreciation: 0, trades: 0, total: 0 },
      campaigns: company.campaigns.map((level) => campaignCost(level, month)),
      ffpBase: ffpBaseCost(company.ffpActive, month),
      events: { charter, crisisResponses: 0, interest, damages },
      ownerFeeIncome: world.ownerFeeIncomeWeekly,
    });

    const weeklyPassengers = sum(routes.map((r) => r.totalPassengers));
    const satisfactionEntries: { satisfaction: number; passengers: number }[] = [];
    routes.forEach((r, i) => {
      const units = world.routes[company.routes[i].id];
      for (const c of CABIN_CLASSES) {
        if (r.passengers[c] > 0) satisfactionEntries.push({ satisfaction: units.satisfaction[c] ?? 100, passengers: r.passengers[c] });
      }
    });

    const txValue = sum(company.transactions.map((t) => t.valueChange ?? 0));
    return {
      companyId: company.id,
      routes,
      planes,
      revenue,
      passengers: weeklyPassengers * WEEKS_PER_MONTH,
      weeklyPassengers,
      cancelledShare: companyCancelledShare(
        company.routes.map((route, i) => ({
          seats: seatsPerFlightTotal(route),
          plannedDepartures: route.departuresPerWeek * WEEKS_PER_MONTH,
          cancelledShare: routes[i].shares.cancelledShare,
        })),
      ),
      airlineSatisfaction: airlineSatisfaction(satisfactionEntries),
      charter,
      interest,
      damages,
      operatingCosts,
      cashAfterOperations: company.cash + revenue + company.subsidy - operatingCosts.total,
      fleetValueStart: sum(company.planes.map((p) => aircraftValue(p, month))) - txValue,
    };
  });
}

// ---------------------------------------------------------------------------
// Schritt 7: Kasse am Monatsende und Bericht (8.2)
// ---------------------------------------------------------------------------

/** Bericht eines Monats für eine Gesellschaft (8.2). Werte im Monat, ungerundet (R4). */
export interface MonthReport {
  readonly month: number;
  readonly companyId: string;
  /** Monatserlös (4.9). */
  readonly revenue: number;
  /** Zuschuss (KI, 7.14); eigene Zeile. */
  readonly subsidy: number;
  /** Kosten je Posten (5.16 mit Abschnitt 8). */
  readonly costs: MonthlyCosts;
  /** Monatsergebnis = Erlös + Zuschuss − Kosten (5.16). */
  readonly result: number;
  /** Einmalausgaben und -einnahmen je Art (Kassen-Änderung). */
  readonly transactions: Readonly<Partial<Record<TransactionKind, number>>>;
  readonly cashStart: number;
  /** Kasse am Monatsende nach allen Buchungen (R11). */
  readonly cashEnd: number;
  readonly fleetValueStart: number;
  /** Σ `aircraftValue` der Flotte am Monatsende (Monat X+1, Zustand nach dem Verschleiß). */
  readonly fleetValueEnd: number;
  readonly depositsStart: number;
  readonly depositsEnd: number;
  /** `creditLimit` (8.14) aus dem Flottenwert am Monatsende. */
  readonly creditLimit: number;
  /** In Anspruch genommener Kredit: `max(0, −Kasse am Monatsende)`. */
  readonly creditUsed: number;
  /** Fluggäste im Monat. */
  readonly passengers: number;
  readonly cancelledShare: number;
  readonly airlineSatisfaction: number;
  /** Wert der bei einer Übernahme (7.16) dazugekommenen Flugzeuge. */
  readonly takenOverFleetValue: number;
}

/** Was nach den Schritten 3–6 für den Bericht feststeht. */
export interface FinishInput {
  readonly month: number;
  readonly company: BookingCompany;
  readonly booking: CompanyBooking;
  /** Flotte am Monatsende (nach Verschleiß, Lieferungen und Verkäufen im Abschluss). */
  readonly planesAtEnd: readonly ValuedAircraft[];
  /** Geschäfte im Abschluss (Lieferung, Storno, Zwangs- und KI-Verkauf, Überholung der KI, Prämien, Dividende). */
  readonly closingTransactions: readonly MonthTransaction[];
}

const RESULT_PRICE: Readonly<Partial<Record<TransactionKind, 'purchases' | 'refits' | 'overhauls' | 'saleProceeds'>>> = {
  purchase: 'purchases',
  delivery: 'purchases',
  refit: 'refits',
  overhaul: 'overhauls',
  sale: 'saleProceeds',
};

/**
 * Flottenwert-Posten mit allen Geschäften des Monats (5.13): Käufe und Lieferungen zum Preis (Anzahlung + Rest),
 * Verkäufe zum Erlös; eine stornierte Vorbestellung verliert die Anzahlung − Erstattung in „Aircraft trades“ (8.12).
 */
export function monthFleetValueParts(
  fleetValueStart: number,
  fleetValueEnd: number,
  transactions: readonly MonthTransaction[],
): FleetValueResultParts {
  const paid = { purchases: 0, refits: 0, overhauls: 0, saleProceeds: 0 };
  let tradeValueChange = 0;
  let lostDeposits = 0;
  for (const t of transactions) {
    tradeValueChange += t.valueChange ?? 0;
    const field = RESULT_PRICE[t.kind];
    // Übernahme (7.16): Flugzeuge zum Wert wie ein Kauf zum Wert, also ohne Ergebnis-Wirkung (F41).
    if (t.kind === 'takeover') paid.purchases += t.valueChange ?? 0;
    else if (field === 'saleProceeds') paid.saleProceeds += t.cash;
    else if (field) paid[field] += -t.cash - (t.depositChange ?? 0);
    if (t.kind === 'preorderCancel') lostDeposits += -(t.depositChange ?? 0) - t.cash;
  }
  const parts = fleetValueResultParts({ valueStart: fleetValueStart, valueEnd: fleetValueEnd, tradeValueChange, ...paid });
  return { depreciation: parts.depreciation, trades: parts.trades - lostDeposits, total: parts.total - lostDeposits };
}

/**
 * Kasse am Monatsende und Bericht X (8.2, R11): Kasse nach dem Betrieb + Geschäfte im Abschluss; Monatsergebnis
 * mit „Depreciation“, „Aircraft trades“ und den bezahlten Krisen-Antworten. Es gilt die Kassen-Gleichung
 * (`cashEquationGap` = 0).
 */
export function finishMonth(input: FinishInput): MonthReport {
  const { month, company, booking } = input;
  const all = [...company.transactions, ...input.closingTransactions];
  const fleetValueEnd = sum(input.planesAtEnd.map((p) => aircraftValue(p, month + 1)));
  const fleetValue = monthFleetValueParts(booking.fleetValueStart, fleetValueEnd, all);
  const crisisResponses = -sum(all.filter((t) => t.kind === 'crisisResponse').map((t) => t.cash));
  const op = booking.operatingCosts;
  const depreciation = -fleetValue.depreciation;
  const aircraftTrades = -fleetValue.trades;
  const costs: MonthlyCosts = {
    ...op,
    depreciation,
    aircraftTrades,
    crisisResponses,
    total: op.total + depreciation + aircraftTrades + crisisResponses,
  };
  const byKind: Partial<Record<TransactionKind, number>> = {};
  for (const t of all) byKind[t.kind] = (byKind[t.kind] ?? 0) + t.cash;
  const cashEnd = booking.cashAfterOperations + sum(input.closingTransactions.map((t) => t.cash));
  const depositsEnd = company.depositsAtMonthStart + sum(all.map((t) => t.depositChange ?? 0));
  const limit = creditLimit(fleetValueEnd);
  return {
    month,
    companyId: company.id,
    revenue: booking.revenue,
    subsidy: company.subsidy,
    costs,
    result: monthlyResult(booking.revenue, costs) + company.subsidy,
    transactions: byKind,
    cashStart: company.cashAtMonthStart,
    cashEnd,
    fleetValueStart: booking.fleetValueStart,
    fleetValueEnd,
    depositsStart: company.depositsAtMonthStart,
    depositsEnd,
    creditLimit: limit,
    creditUsed: Math.max(0, -cashEnd),
    passengers: booking.passengers,
    cancelledShare: booking.cancelledShare,
    airlineSatisfaction: booking.airlineSatisfaction,
    takenOverFleetValue: sum(all.filter((t) => t.kind === 'takeover').map((t) => t.valueChange ?? 0)),
  };
}

/** Arten, die Einmalausgaben ohne Ergebnis-Wirkung sind (8.2: „übrige Einmalausgaben“). */
const OTHER_ONE_OFFS: readonly TransactionKind[] = ['slots', 'tier', 'facility', 'research'];

/**
 * Kassen-Gleichung (8.2) als Rest: 0, wenn
 * `Kasse Ende − Kasse Anfang = Ergebnis − ΔFlottenwert − ΔAnzahlungen − übrige Einmalausgaben + Prämien − Ziel-Strafe
 *  − Dividende − Übernahmepreis + übernommene Kasse`. Übernahme steht als eine Zeile `takeover` (Kasse = übernommene
 * Kasse − Preis); ihre Flugzeuge kommen zum Wert dazu und zählen daher nicht als Wertänderung (F41).
 */
export function cashEquationGap(report: MonthReport): number {
  const t = report.transactions;
  const oneOffs = sum(OTHER_ONE_OFFS.map((k) => t[k] ?? 0));
  const right =
    report.result -
    (report.fleetValueEnd - report.fleetValueStart) -
    (report.depositsEnd - report.depositsStart) +
    oneOffs +
    (t.prize ?? 0) +
    (t.goalPenalty ?? 0) +
    (t.dividend ?? 0) +
    (t.takeover ?? 0) +
    report.takenOverFleetValue;
  return report.cashEnd - report.cashStart - right;
}
