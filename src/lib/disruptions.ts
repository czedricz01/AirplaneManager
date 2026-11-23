/**
 * Operational disruptions (technical defect, airport strike, winter weather):
 * texts, the questions put to the player and the cancellation shares the views
 * show.
 *
 * Rolling them, the charter fee and the reputation cost are the model's
 * (SPEZIFIKATION 8.6, `src/model/monthEvents.ts`); the old rolls were removed
 * in 5.2a. A route hit twice loses flights to each cause independently
 * (`combineCancelShares`).
 */
import type { Disruption, DisruptionKind, GameDecision, RegionId, RouteCancellation } from './gameState';
import { REGION_LABELS } from './marketing';
import { formatCurrency } from './format';

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
/** A replacement aircraft costs this share of the revenue it saves. */
export const CHARTER_COST_SHARE = 0.9;
/** Reputation lost per route whose flights are cancelled rather than chartered... */
export const CANCEL_REPUTATION_PER_ROUTE = 1;
/** ...and at most this much for one disruption. */
export const CANCEL_REPUTATION_MAX = 4;

/** The option ids of a disruption question. Any other answer means cancelling. */
export const DISRUPTION_OPTION_CHARTER = 'charter';
export const DISRUPTION_OPTION_CANCEL = 'cancel';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * The share of flights lost to several independent causes, 0-1: each one
 * cancels its share of what the others left flying, 1 - (1 - a)(1 - b)...
 * Two 25% cancellations take 43.75% of the flights, not 50%.
 */
export function combineCancelShares(...shares: (number | undefined)[]): number {
  let flown = 1;
  let causes = 0;
  let only = 0;
  for (const s of shares) {
    const share = clamp01(Number(s) || 0);
    if (share <= 0) continue;
    causes++;
    only = share;
    flown *= 1 - share;
  }
  // A single cause is returned as it is, without the rounding of 1 - (1 - s).
  return causes === 0 ? 0 : causes === 1 ? only : 1 - flown;
}

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
 * The share of each route's flights disruptions cancel in the month at
 * `offset`, by route id, several causes combined. Chartered ones cancel
 * nothing. Undefined when nothing is cancelled.
 */
export function disruptionCancelShares(disruptions: Disruption[] | undefined, offset: number): Record<string, number> | undefined {
  const perRoute = new Map<string, number[]>();
  for (const d of disruptionsIn(disruptions, offset)) {
    if (d.mitigated || !(d.cancelShare > 0)) continue;
    for (const id of d.routeIds) {
      const list = perRoute.get(id);
      if (list) list.push(d.cancelShare);
      else perRoute.set(id, [d.cancelShare]);
    }
  }
  if (perRoute.size === 0) return undefined;
  const out: Record<string, number> = {};
  perRoute.forEach((shares, id) => { out[id] = combineCancelShares(...shares); });
  return out;
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
 * Why each route loses flights in the month these modifiers price: the
 * strike, if one runs, and every disruption that is not chartered away. The
 * share is the one the engine applies, via `shareOf`.
 */
export function describeRouteCancellations(
  routeIds: string[],
  shareOf: (routeId: string) => number,
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
    const share = shareOf(id);
    if (!(share > 0)) continue;
    const own = reasons.get(id) ?? [];
    out[id] = { share, reasons: strikeShare > 0 ? [`Staff strike (${Math.round(strikeShare * 100)}%)`, ...own] : own };
  }
  return out;
}

/** What a charter costs for the revenue it saves, in whole dollars. */
export function charterFee(lostRevenue: number): number {
  return Math.round(CHARTER_COST_SHARE * Math.max(0, Number(lostRevenue) || 0));
}

/**
 * Reputation lost by cancelling a disruption's flights instead of chartering:
 * a point per route hit, four at most, each route counted by the share of
 * its flights that would otherwise have flown. `otherShare` gives what other
 * causes, a strike above all, already cancel on a route; a route grounded
 * entirely strands nobody more. Rounded to a tenth.
 */
export function cancelReputationPenalty(d: Disruption, otherShare: (routeId: string) => number = () => 0): number {
  const raw = d.routeIds.reduce((sum, id) => sum + CANCEL_REPUTATION_PER_ROUTE * (1 - clamp01(otherShare(id) || 0)), 0);
  return Math.round(Math.min(CANCEL_REPUTATION_MAX, raw) * 10) / 10;
}

/**
 * The disruptions worth a question: 25% and more, with revenue at stake
 * (`lostOf`, see marginalLostRevenue), largest loss first, three at most.
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
 * The question for one disruption: charter a replacement or cancel. `ref` is
 * the disruption's id. `lost` is the revenue at stake as the forecast sees
 * it now. Neither answer costs anything up front: the charter is billed at
 * the month's close on what it actually saved, so a strike settled or sat
 * out in the meantime is priced in.
 */
export function buildDisruptionDecision(
  d: Disruption,
  monthLabel: string,
  lost: number,
  routeName: (routeId: string) => string
): GameDecision {
  const fee = charterFee(lost);
  const penalty = cancelReputationPenalty(d);
  const pct = Math.round(d.cancelShare * 100);
  const routes = d.routeIds.length === 1
    ? routeName(d.routeIds[0])
    : `${d.routeIds.length} routes`;
  const cause = d.kind === 'technical'
    ? `${d.ref ?? 'An aircraft'} needs unplanned repairs in ${monthLabel}.`
    : d.kind === 'airport-strike'
      ? `Ground staff at ${d.ref ?? 'an airport you serve'} walk out in ${monthLabel}.`
      : `${disruptionTitle(d)} in ${monthLabel}.`;
  return {
    id: `dec_${d.id}`,
    kind: 'disruption',
    ref: d.id,
    title: disruptionTitle(d),
    description:
      `${cause} ${pct}% of the flights on ${routes} would not operate, about ${formatCurrency(lost)} of ticket revenue. ` +
      `The forecast already leaves them out.`,
    options: [
      {
        id: DISRUPTION_OPTION_CHARTER,
        label: 'Charter a replacement aircraft',
        detail:
          `A leased aircraft flies every cancelled flight; passengers notice nothing. Billed with the month's costs at ` +
          `${Math.round(CHARTER_COST_SHARE * 100)}% of the ticket revenue it saves: about ${formatCurrency(fee)} at today's forecast.`,
        cost: 0
      },
      {
        id: DISRUPTION_OPTION_CANCEL,
        label: 'Cancel the flights',
        detail: `Nothing to pay, but stranded passengers cost up to ${penalty} reputation.`,
        cost: 0
      }
    ]
  };
}

/** "FRA-LHR, FRA-CDG and 3 more": the routes a disruption hits, the first `max` by name. */
export function disruptionRoutesLabel(d: Pick<Disruption, 'routeIds'>, routeName: (routeId: string) => string, max = 4): string {
  const names = d.routeIds.map(routeName);
  return names.length <= max ? names.join(', ') : `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

/** One line per disruption for the inbox. */
export function describeDisruption(d: Disruption, routeName: (routeId: string) => string): string {
  const pct = Math.round(d.cancelShare * 100);
  const where = disruptionRoutesLabel(d, routeName);
  return `• ${disruptionTitle(d)}: ${pct}% of flights cancelled on ${where}.`;
}
