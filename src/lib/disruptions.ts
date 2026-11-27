/**
 * Operational disruptions (technical defect, airport strike, winter weather):
 * texts, the questions put to the player and the cancellation shares the views
 * show.
 *
 * Rolling them, the charter fee and the reputation cost are the model's
 * (SPEZIFIKATION 8.6, `src/model/monthEvents.ts`); the old rolls were removed
 * in 5.2a. A route hit twice loses flights to each cause independently; the
 * share comes from the model's `disruptionShares` (8.9), see `routeCancelShare`.
 */
import type { Disruption, DisruptionKind, GameDecision, RegionId, RouteCancellation } from './gameState';
import { REGION_LABELS } from './marketing';
import { formatCurrency, formatNumber } from './format';
import { CHARTER_MARKUP } from '../model/constants';
import { disruptionShares } from '../model/monthEvents';

// --- What each kind does -------------------------------------------------------

export interface DisruptionSpec {
  label: string;
  /** Share of each hit route's flights cancelled, 0-1. */
  cancelShare: number;
}

export const DISRUPTION_SPECS: Record<DisruptionKind, DisruptionSpec> = {
  technical: { label: 'Technical defect', cancelShare: 0.50 },
  'airport-strike': { label: 'Airport strike', cancelShare: 0.60 },
  weather: { label: 'Winter weather', cancelShare: 0.15 }
};

/** From this share of flights cancelled up, the player is asked what to do. */
export const MAJOR_DISRUPTION_SHARE = 0.25;
/** No more questions than this per month; the rest just happen. */
export const MAX_DISRUPTION_DECISIONS = 3;
/** The option ids of a disruption question. Any other answer means cancelling. */
export const DISRUPTION_OPTION_CHARTER = 'charter';
export const DISRUPTION_OPTION_CANCEL = 'cancel';

/** A bird strike: paid for at once, nothing cancelled, nothing left open. */
export interface BirdStrike {
  /** Unique within a month and repeatable: `bird_<offset>_<route id>`. */
  id: string;
  /** The month it happens in. */
  offset: number;
  routeId: string;
  /** The aircraft that was hit. */
  registration: string;
  /** The repair bill in dollars, see birdStrikeCost. */
  cost: number;
}

// --- What they do to the month ---------------------------------------------------

/** Disruptions hitting the month at `offset`, whether or not a replacement flies. */
export function disruptionsIn(disruptions: Disruption[] | undefined, offset: number): Disruption[] {
  return (disruptions || []).filter(d => d.offset === offset);
}

/**
 * The share of one route's flights that do not operate in the month at
 * `month`, 0-1: every disruption hitting it and the staff strike
 * (`strikeShare`, see `strikeCancelShare` in modelStaff.ts), each an
 * independent cause, chartered ones cancelling nothing. The model's rule
 * (`disruptionShares`, SPEZIFIKATION 8.9), so the badge shows what the month
 * close books.
 */
export function routeCancelShare(
  routeId: string,
  disruptions: Disruption[] | undefined,
  month: number,
  strikeShare: number
): number {
  const causes = disruptionsIn(disruptions, month)
    .filter(d => d.routeIds.includes(routeId))
    .map(d => ({ share: d.cancelShare, chartered: d.mitigated === true }));
  if (strikeShare > 0) causes.push({ share: strikeShare, chartered: false });
  return disruptionShares(causes).cancelledShare;
}

/** A disruption's heading: what and where. */
export function disruptionTitle(d: Disruption): string {
  const label = DISRUPTION_SPECS[d.kind]?.label ?? 'Disruption';
  switch (d.kind) {
    case 'technical':
      return d.ref ? `${label}: ${d.ref}` : label;
    case 'airport-strike':
      return d.ref ? `${label} at ${d.ref}` : label;
    case 'weather':
      return d.ref && d.ref in REGION_LABELS ? `${label} in ${REGION_LABELS[d.ref as RegionId]}` : label;
  }
  return label;
}

/**
 * Why each route loses flights in the month at `offset`: the strike, if one
 * runs, and every disruption that is not chartered away, with the share
 * `routeCancelShare` gives.
 */
export function describeRouteCancellations(
  routeIds: string[],
  disruptions: Disruption[] | undefined,
  offset: number,
  strikeShare: number
): Record<string, RouteCancellation> {
  const reasons = new Map<string, string[]>();
  for (const d of disruptionsIn(disruptions, offset)) {
    if (d.mitigated || !(d.cancelShare > 0)) continue;
    for (const id of d.routeIds) {
      const list = reasons.get(id) ?? [];
      list.push(`${disruptionTitle(d)} (${Math.round(d.cancelShare * 100)}%)`);
      reasons.set(id, list);
    }
  }
  const out: Record<string, RouteCancellation> = {};
  for (const id of routeIds) {
    const share = routeCancelShare(id, disruptions, offset, strikeShare);
    if (!(share > 0)) continue;
    const own = reasons.get(id) ?? [];
    out[id] = { share, reasons: strikeShare > 0 ? [`Staff strike (${Math.round(strikeShare * 100)}%)`, ...own] : own };
  }
  return out;
}

/**
 * The disruptions worth a question: 25% and more, with revenue at stake
 * (`lostOf`, see `charterQuestionFigures`), largest loss first, three at most.
 * The rest are only reported.
 */
export function disruptionsToAsk(disruptions: Disruption[], lostOf: (d: Disruption) => number): Disruption[] {
  return disruptions
    .filter(d => !d.mitigated && d.cancelShare >= MAJOR_DISRUPTION_SHARE)
    .map(d => ({ d, lost: lostOf(d) }))
    .filter(x => x.lost > 0)
    .sort((a, b) => b.lost - a.lost || (a.d.id < b.d.id ? -1 : a.d.id > b.d.id ? 1 : 0))
    .slice(0, MAX_DISRUPTION_DECISIONS)
    .map(x => x.d);
}

/**
 * What charter would cost and bring for one disruption: the model works out the month it hits twice, once with the
 * flights cancelled and once chartered (`charterQuestionFigures` in modelMonthClose.ts, SPEZIFIKATION 8.9, E76).
 * All amounts in dollars for the month.
 */
export interface CharterEstimate {
  /** Flights the disruption takes out in the month. */
  flights: number;
  /** Ticket revenue lost when cancelling (some passengers move to the airline's other flights), kept with charter. */
  revenue: number;
  /** Costs per passenger (catering, fees, FFP) paid only with charter. */
  passengerCost: number;
  /** The airline's own fuel, crew and landing cost of these flights: saved either way. */
  ownFlightCost: number;
  /** Charter fee: `CHARTER_MARKUP` × own flight cost (`charterFee`), as the month close bills it. */
  fee: number;
  /** Month result with charter − with the flights cancelled. */
  advantage: number;
}

/**
 * The question for one disruption: charter a replacement or cancel. `ref` is the disruption's id. `estimate` gives
 * the amounts the model works out for the month (SPEZIFIKATION 8.9, E76: fee, revenue kept, own flight costs saved).
 * Neither answer costs anything up front: a charter is billed at the month's close at `CHARTER_MARKUP` times the
 * airline's own flight costs (fuel, crew, landing) of every chartered flight; cancelled flights are the only penalty,
 * through the reputation target of the month (cancelled seats), with no one-time loss (6.2, E32, E33, E38).
 */
export function buildDisruptionDecision(
  d: Disruption,
  monthLabel: string,
  estimate: CharterEstimate,
  routeName: (routeId: string) => string
): GameDecision {
  const pct = Math.round(d.cancelShare * 100);
  const routes = d.routeIds.length === 1
    ? routeName(d.routeIds[0])
    : `${d.routeIds.length} routes`;
  const cause = d.kind === 'technical'
    ? `${d.ref ?? 'An aircraft'} needs unplanned repairs in ${monthLabel}.`
    : d.kind === 'airport-strike'
      ? `Ground staff at ${d.ref ?? 'an airport you serve'} walk out in ${monthLabel}.`
      : `${disruptionTitle(d)} in ${monthLabel}.`;
  const flights = Math.max(1, Math.round(estimate.flights));
  const verdict = estimate.advantage >= 0
    ? `about ${formatCurrency(estimate.advantage)} better than cancelling`
    : `about ${formatCurrency(-estimate.advantage)} worse than cancelling`;
  return {
    id: `dec_${d.id}`,
    kind: 'disruption',
    ref: d.id,
    title: disruptionTitle(d),
    description:
      `${cause} ${pct}% of the flights on ${routes} would not operate: about ${formatNumber(flights)} ` +
      `flight${flights === 1 ? '' : 's'}. Cancelling them loses about ${formatCurrency(estimate.revenue)} of ticket ` +
      `revenue; some passengers move to your other flights. Your own aircraft stays on the ground either way, saving ` +
      `about ${formatCurrency(estimate.ownFlightCost)} of fuel, crew and landing cost. The forecast already leaves these ` +
      `flights out. Worked out for ${monthLabel} with your current schedule and prices.`,
    options: [
      {
        id: DISRUPTION_OPTION_CHARTER,
        label: 'Charter a replacement aircraft',
        detail:
          `A leased aircraft flies every cancelled flight; passengers notice nothing. Fee about ` +
          `${formatCurrency(estimate.fee)}, billed with the month's costs (${formatNumber(CHARTER_MARKUP, 1)} times your ` +
          `own fuel, crew and landing cost of each chartered flight). With ${formatCurrency(estimate.revenue)} of tickets ` +
          `kept and ${formatCurrency(estimate.passengerCost)} of passenger costs, the month ends ${verdict}.`,
        cost: 0,
        costNote: `Fee about ${formatCurrency(estimate.fee)} at month-end`
      },
      {
        id: DISRUPTION_OPTION_CANCEL,
        label: 'Cancel the flights',
        detail:
          `Nothing to pay, but about ${formatCurrency(estimate.revenue)} of ticket revenue is lost and the cancelled ` +
          `seats pull this month's reputation target down.`,
        cost: 0,
        costNote: 'No fee'
      }
    ]
  };
}

/**
 * "FRA-LHR, FRA-CDG and 3 more": the routes a disruption hits, the first `max` by name. Two routes on one city pair
 * (two aircraft) share a name; it is named once (Paket 5.3g).
 */
export function disruptionRoutesLabel(d: Pick<Disruption, 'routeIds'>, routeName: (routeId: string) => string, max = 4): string {
  const names = [...new Set(d.routeIds.map(routeName))];
  return names.length <= max ? names.join(', ') : `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

/** One line per disruption for the inbox. */
export function describeDisruption(d: Disruption, routeName: (routeId: string) => string): string {
  const pct = Math.round(d.cancelShare * 100);
  const where = disruptionRoutesLabel(d, routeName);
  return `• ${disruptionTitle(d)}: ${pct}% of flights cancelled on ${where}.`;
}
