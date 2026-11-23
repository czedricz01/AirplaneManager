/**
 * Das Netz des Spielers im laufenden Monat nach dem Modell (Paket 4.7b): ersetzt die alte Netz-Rechnung
 * `computeNetworkFinancials` (`src/lib/transferUtils.ts`) in `App.tsx`.
 *
 * - `playerMonth` rechnet `monthOperations` einmal (dieselbe Rechnung wie der Abschluss, 8.1, R2) und gibt daraus
 *   die Zahlen je Strecke (`routeMonthsOf`), die Umsteige-Ströme je Drehkreuz und je Strecke (3.13), die Fluggäste
 *   im Monat (Reisen, Grundlage der Frequent-flyer-Kosten, 5.8) und die Besatzungskosten im Monat (5.4, mit Lohn).
 * - `ffpForecast` rechnet die Kosten des Frequent-flyer-Programms im Monat, wie der Abschluss sie bucht.
 * - `hubTransfers` fasst die Umsteige-Ströme nach Drehkreuz zusammen (Flughafen-Ansicht, Chronik, Bericht).
 *
 * Rein: liest nur seine Eingabe (R12).
 */
import { WEEKS_PER_MONTH } from '../model/constants';
import { ffpBaseCost } from '../model/costTotals';
import { ffpCostPerPassenger } from '../model/costs';
import { monthOperations, type ModelState, type TransferFlowFigures } from '../model/monthClose';
import { PLAYER_ID } from './modelMonth';
import { routeMonthsOf, type RouteMonth } from './modelRoute';

/** Ein Umsteige-Strom O → H → D je Woche, beide Richtungen (Format der Flughafen-Ansicht). */
export interface TransferFlowView {
  readonly o: string;
  readonly d: string;
  readonly hub: string;
  /** Umsteiger je Woche (am Drehkreuz: jede Reise einmal; an einer Strecke: die auf dieser Strecke). */
  readonly pax: number;
}

/** Umsteiger an einem Drehkreuz je Woche, jede Reise einmal, mit ihren Strömen (größter zuerst). */
export interface HubTransferView {
  readonly pax: number;
  readonly flows: readonly TransferFlowView[];
}

/** Was die Ansichten vom Netz des Spielers im laufenden Monat brauchen. */
export interface PlayerMonth {
  /** Zahlen je Strecke (Streckenliste, Streckenansicht, Karte, Live-Karte). */
  readonly routes: ReadonlyMap<string, RouteMonth>;
  /** Umsteiger je Drehkreuz (Flughafen-Ansicht). */
  readonly hubs: Readonly<Record<string, HubTransferView>>;
  /** Umsteige-Ströme je Strecke; `pax` = Umsteiger des Stroms auf dieser Strecke (Streckenansicht). */
  readonly flowsByRoute: Readonly<Record<string, readonly TransferFlowView[]>>;
  /**
   * Reisen im Monat, jede einmal gezählt (Direktgäste je Strecke + Umsteiger-Reisen): `passengers − transferPassengers`
   * von `monthOperations`. Danach rechnet der Abschluss die Frequent-flyer-Kosten je Fluggast (5.8: ein Umsteiger zahlt
   * je Teilstrecke `TRANSFER_CHECKIN_SHARE`).
   */
  readonly monthlyPassengers: number;
  /** Besatzung im Monat: Σ Besatzung je Woche aller Strecken × `WEEKS_PER_MONTH` (5.4, mit Lohn und Forschung). */
  readonly monthlyCrewCost: number;
}

export const EMPTY_PLAYER_MONTH: PlayerMonth = { routes: new Map(), hubs: {}, flowsByRoute: {}, monthlyPassengers: 0, monthlyCrewCost: 0 };

const byPaxThenName = (a: TransferFlowView, b: TransferFlowView) =>
  b.pax - a.pax || (`${a.hub}${a.o}${a.d}` < `${b.hub}${b.o}${b.d}` ? -1 : 1);

/** Umsteiger je Drehkreuz aus den Umsteige-Verbindungen des Modells; Drehkreuze ohne Umsteiger fehlen. */
export function hubTransfers(flows: readonly TransferFlowFigures[]): Record<string, HubTransferView> {
  const out: Record<string, { pax: number; flows: TransferFlowView[] }> = {};
  for (const f of flows) {
    if (!(f.passengers > 0)) continue;
    const hub = (out[f.hubId] ??= { pax: 0, flows: [] });
    hub.pax += f.passengers;
    hub.flows.push({ o: f.origin, d: f.destination, hub: f.hubId, pax: f.passengers });
  }
  for (const h of Object.values(out)) h.flows.sort(byPaxThenName);
  return out;
}

/** Umsteige-Ströme je Strecke: jede Verbindung mit den Umsteigern, die sie auf dieser Strecke hat. */
function flowsPerRoute(flows: readonly TransferFlowFigures[]): Record<string, TransferFlowView[]> {
  const out: Record<string, TransferFlowView[]> = {};
  for (const f of flows) {
    for (const [routeId, pax] of Object.entries(f.routes)) {
      if (!(pax > 0)) continue;
      (out[routeId] ??= []).push({ o: f.origin, d: f.destination, hub: f.hubId, pax });
    }
  }
  for (const list of Object.values(out)) list.sort(byPaxThenName);
  return out;
}

/**
 * Das Netz des Spielers im Monat des Spielstands: eine Rechnung `monthOperations` für Strecken, Umsteiger, Fluggäste
 * und Besatzung. Ohne Spieler im Spielstand leer.
 */
export function playerMonth(state: ModelState): PlayerMonth {
  const ops = monthOperations(state)[PLAYER_ID];
  const player = state.companies.find((c) => c.id === PLAYER_ID);
  if (!ops || !player) return EMPTY_PLAYER_MONTH;
  let crewPerWeek = 0;
  for (const r of ops.routes) crewPerWeek += r.fixed.crew;
  return {
    routes: routeMonthsOf(ops.routes, player),
    hubs: hubTransfers(ops.transferFlows),
    flowsByRoute: flowsPerRoute(ops.transferFlows),
    monthlyPassengers: ops.passengers - ops.transferPassengers,
    monthlyCrewCost: crewPerWeek * WEEKS_PER_MONTH,
  };
}

/** Kosten des Frequent-flyer-Programms im Monat (5.7, 5.16): Grundbetrag + Satz je Fluggast × Fluggäste. */
export interface FfpForecast {
  /** Grundbetrag im Monat (`ffpBaseCost`). */
  readonly base: number;
  /** Satz je Fluggast (`ffpCostPerPassenger`). */
  readonly perPassenger: number;
  /** Reisen im Monat, jede einmal gezählt (`PlayerMonth.monthlyPassengers`). */
  readonly passengers: number;
  readonly total: number;
}

/**
 * Was das Programm im Monat `month` kostet, wenn es läuft, bei `monthlyPassengers` Reisen (`PlayerMonth`). Gleiche Sätze wie der Abschluss; die Fluggäste mit Programm sind etwas mehr (Treue hebt die Anziehung, 3.9).
 */
export function ffpForecast(month: number, monthlyPassengers: number): FfpForecast {
  const base = ffpBaseCost(true, month);
  const perPassenger = ffpCostPerPassenger(true, month);
  const passengers = Math.max(0, monthlyPassengers);
  return { base, perPassenger, passengers, total: base + perPassenger * passengers };
}
