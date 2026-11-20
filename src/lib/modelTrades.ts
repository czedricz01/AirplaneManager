/**
 * Geschäfte und Kennzahlen während des Monats nach dem Modell (Paket 4.2g, docs/neubau F59).
 *
 * Was die Oberfläche zwischen zwei Abschlüssen selbst bucht oder anzeigt, kommt hier aus `src/model/`, damit es zu
 * dem passt, was der Abschluss bucht (R2): Preis der Grundüberholung (8.13), Übernahme-Preis und -Bestand (7.16),
 * Treibstoffpreis des Spielers mit Absicherung (5.2, 8.5) und Ereignis-Faktor der Kopfzeile (7.12).
 *
 * Alles hier ist rein (keine Zustände, keine globalen Daten).
 */
import { aircraftList, type Aircraft } from '../data/aircraft';
import type { AiAirline } from '../components/CompetitorsView';
import type { OwnedAircraft } from '../components/MyFleetView';
import { LITRES_PER_GALLON, RANK_UNLOCKS } from '../model/constants';
import { fuelPrice } from '../model/costs';
import { overhaulQuote, type OverhaulQuote } from '../model/fleetMarket';
import { activeWorldEvents, hedgedFuelTable, type WorldEvent } from '../model/monthEvents';
import type { ModelAirport } from '../model/monthClose';
import { companyValueOf, mayTakeOver, rivalAgentOf, takeoverHoldings, takeoverPrice, worldEventDemandFactor } from '../model/rivalMonth';
import { rankGateMessage } from './airlineRank';
import type { AirportInfrastructure, SimulatedRoute } from './gameTypes';
import { aircraftState, applyHoldingState, holdingState } from './modelBridge';
import { rivalRecord, type RivalRecord } from './modelBridgeWorld';

// ===========================================================================
// Treibstoff und Reiselust der Kopfzeile
// ===========================================================================

/**
 * Treibstoffpreis des Spielers in $ je Gallone im Monat `month`: `fuelPrice` des Modells (Tabelle mit Krisen-Form,
 * Forschung) × Liter je Gallone; während einer gekauften Absicherung der gesicherte Tabellenwert (`hedgedFuelTable`).
 * Ohne Schwierigkeit und ohne Ereignis-Faktor (E8). Dieselbe Zahl, die der Abschluss bucht (5.2, 8.5).
 *
 * @param hedgedEvents Ereignisse, für die der Spieler die Absicherung gekauft hat.
 */
export function playerFuelPerGallon(
  month: number,
  completedResearch: readonly string[],
  hedgedEvents: readonly Pick<WorldEvent, 'startMonth' | 'months'>[],
): number {
  return fuelPrice(month, completedResearch, hedgedFuelTable(hedgedEvents, month)) * LITRES_PER_GALLON;
}

/**
 * Weltweiter Ereignis-Faktor auf die Reiselust im Monat `month` (Kopfzeile „Demand“): `worldEventDemandFactor` des
 * Modells (Mittel über die Regionen; ein weltweites Ereignis zählt voll, ein regionales mit seinem Anteil, 7.12) über
 * die laufenden Ereignisse, geschichtliche aus den Daten des Modells und gewürfelte aus dem Spielstand (8.4).
 */
export function worldEventFactor(month: number, randomEvents: readonly WorldEvent[]): number {
  return worldEventDemandFactor(activeWorldEvents(month, randomEvents));
}

// ===========================================================================
// Grundüberholung (8.13, E62)
// ===========================================================================

/**
 * Hat der Spieler einen eigenen Hangar an einem Flughafen der Strecken dieses Flugzeugs (wie der Abschluss beim
 * Defekt, `src/model/monthClose.ts`, und `overhaulQuote`, E62)?
 */
export function hasHangarOnRoutes(
  registration: string,
  routes: readonly Pick<SimulatedRoute, 'aircraft' | 'origin' | 'destination'>[],
  airportManagement: Readonly<Record<string, AirportInfrastructure | undefined>>,
): boolean {
  return routes
    .filter((r) => r.aircraft === registration)
    .some((r) => [r.origin, r.destination].some((id) => airportManagement[id]?.hubFacilities?.hangar === true));
}

/**
 * Angebot einer Grundüberholung für ein Flugzeug der Flotte im Monat `month`: Preis, Wertgewinn und Zelle danach aus
 * `overhaulQuote` (8.13); ohne Hangar an einem Flughafen seiner Strecken mit Werft-Zuschlag (E62). `null`, wenn keine
 * Überholung mehr etwas bringt.
 */
export function playerOverhaulQuote(
  plane: OwnedAircraft,
  routes: readonly Pick<SimulatedRoute, 'aircraft' | 'origin' | 'destination'>[],
  airportManagement: Readonly<Record<string, AirportInfrastructure | undefined>>,
  month: number,
  catalog: readonly Aircraft[] = aircraftList,
): OverhaulQuote | null {
  const hangar = hasHangarOnRoutes(plane.registration, routes, airportManagement);
  return overhaulQuote(aircraftState(plane, catalog), month, plane.generalChecksDone ?? 0, hangar);
}

// ===========================================================================
// Übernahme (7.16, E48)
// ===========================================================================

/** Was die Übernahme braucht: Monat, Flughäfen und Katalog des Modells. */
export interface TakeoverContext {
  readonly month: number;
  readonly airports: Readonly<Record<string, ModelAirport>>;
  readonly catalog?: readonly Aircraft[];
}

/**
 * Die KI hinter einer Ansicht: aus den gespeicherten `rivals` (Kennung der Ansicht = Kennung im Modell, F56), sonst
 * nach Kürzel; vor dem ersten Abschluss auf dem Modell (`rivals` fehlt) aus der alten `AiAirline` umgewandelt.
 */
export function takeoverRival(ai: AiAirline, rivals: readonly RivalRecord[] | null, ctx: TakeoverContext): RivalRecord | undefined {
  if (!rivals) return rivalRecord(ai, ctx);
  return rivals.find((r) => r.company.id === ai.id) ?? rivals.find((r) => r.code === ai.code);
}

/** Angebot einer Übernahme. */
export interface TakeoverOffer {
  /** Übernahme-Preis = Unternehmenswert der KI, mindestens die Untergrenze (`takeoverPrice`). */
  readonly price: number;
  /** Kasse der KI; sie geht an den Spieler (auch negativ: Schulden gehen mit). */
  readonly rivalCash: number;
  /** Was die Kasse des Spielers wirklich verlässt: Preis − Kasse der KI. */
  readonly netPrice: number;
  readonly aircraft: number;
  readonly routes: number;
  /** Flughäfen, an denen die KI Slots oder Schalter hat. */
  readonly airports: number;
  /** Warum der Spieler sie nicht kaufen darf (Rang oder Status), sonst `null` (die Kasse prüft der Aufrufer). */
  readonly blocked: string | null;
}

/** Angebot einer Übernahme der KI `rival` (Name aus der Ansicht) für einen Spieler mit Rang `rank`. SPEZIFIKATION 7.16. */
export function takeoverOffer(rival: RivalRecord, rank: number, month: number): TakeoverOffer {
  const company = rival.company;
  const price = takeoverPrice(companyValueOf(company, month), month);
  const status = rivalAgentOf(company)?.distress.status ?? 'healthy';
  let blocked: string | null = null;
  if (status === 'liquidated') blocked = `${rival.name} has been wound up.`;
  else if (!mayTakeOver(rank, status)) {
    blocked = status === 'forSale'
      ? rankGateMessage(rank, RANK_UNLOCKS.takeoverDistressed, `Buying ${rival.name}`)
      : rankGateMessage(rank, RANK_UNLOCKS.takeoverHealthy, `A takeover bid for ${rival.name}, which is not for sale,`);
  }
  const airports = Object.values(company.airports).filter((h) => Object.values(h.slots).some((n) => (n ?? 0) > 0) || h.desks.normal + h.desks.self > 0).length;
  return {
    price,
    rivalCash: company.cash,
    netPrice: price - company.cash,
    aircraft: company.aircraft.length,
    routes: company.routes.length,
    airports,
    blocked,
  };
}

/**
 * Bestand des Spielers nach der Übernahme (7.16): je Flughafen der KI Slots und Schalter dazu, mindestens Stufe 1,
 * an ihren Drehkreuzen Stufe 2 (`takeoverHoldings`). Nur die Flughäfen der KI ändern sich.
 */
export function takeoverAirports(
  airportManagement: Readonly<Record<string, AirportInfrastructure | undefined>>,
  rival: RivalRecord,
): Record<string, AirportInfrastructure> {
  const ids = Object.keys(rival.company.airports);
  const mine = Object.fromEntries(
    ids.flatMap((id) => {
      const infra = airportManagement[id];
      return infra ? [[id, holdingState(infra)] as const] : [];
    }),
  );
  const merged = takeoverHoldings(mine, rival.company);
  return Object.fromEntries(ids.map((id) => [id, applyHoldingState(airportManagement[id], merged[id])]));
}

/**
 * Wie die Übernahme in der Kasse steht (wie `takeOverCompany` im Modell, 5.16): die Flugzeuge zum Wert als Kauf
 * („Aircraft Purchases“, damit „Aircraft trades“ 0 bleibt), der Rest `netPrice − Wert der Flugzeuge` als Einmalausgabe
 * ohne Ergebnis-Wirkung. Die Übernahme ändert das Monatsergebnis nicht (7.16).
 *
 * @param planesValue Wert der Flugzeuge, die in die Flotte kommen (`planesValue`, dieselbe Zahl wie `withTradeValue`).
 */
export function takeoverPayments(offer: Pick<TakeoverOffer, 'netPrice'>, planesValue: number): { readonly aircraft: number; readonly rest: number } {
  return { aircraft: planesValue, rest: offer.netPrice - planesValue };
}
