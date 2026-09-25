/**
 * The airline's history: the figures each month adds to the report for the
 * history charts, and the lines it adds to the chronicle.
 *
 * The chronicle is written once a month, at the close, from what the close
 * has just worked out. It is meant to read like a company history, not like
 * the inbox, so it only takes what is worth remembering:
 *
 *   milestone   every milestone earned
 *   goal        the board's annual target, met or missed
 *   crisis      every world event starting and ending, good news included
 *   strike      a strike called by the staff
 *   disruption  disruptions that cancel MAJOR_DISRUPTION_SHARE or more
 *   record      the first month in profit, then a best month only once it
 *               beats the last record written by RECORD_PROFIT_MARGIN, at
 *               least RECORD_MIN_GAP_MONTHS later; a reputation high only
 *               every RECORD_REPUTATION_STEP points
 *   network     the first route into a region beyond the hub's own, and the
 *               first month each airport sees connecting passengers
 *   finance     capital at a month end below zero, the first time only
 *
 * Firsts and records carry a `key`. The chronicle remembers what it has said
 * through those keys (trimChronicle never drops the newest entry of a key),
 * so no other state is needed to keep them from repeating.
 *
 * Everything here is pure.
 */
import { CHRONICLE_LIMIT, type ChronicleEntry, type RegionId } from './gameState';
import { marketKey, type RouteOffer } from './financeUtils';
import { MAJOR_DISRUPTION_SHARE } from './disruptions';
import { REGION_LABELS } from './marketing';
import { regionOf } from './geoUtils';
import { formatCurrency, formatMonthOffset, formatNumber } from './format';

// --- What a report adds for the charts ----------------------------------------

/**
 * The figures each monthly report carries for the history charts. Reports
 * closed before they existed have none of them, and the charts leave those
 * months out.
 */
export interface ReportMetrics {
  /** Reputation at the month's end, after every bonus and penalty. */
  reputation?: number;
  /** Staff morale at the month's end. */
  morale?: number;
  /** Passengers flown in the month, every leg counted: a connecting passenger twice. */
  paxTotal?: number;
  /** Passengers who changed planes at one of the player's airports in the month, each counted once. */
  transferPax?: number;
  fleetSize?: number;
  routeCount?: number;
  /** See departureMarketShare. Null when the airline flew nothing. */
  marketShare?: number | null;
  /** Regions the network touched, for the chronicle's "first route to" entries. */
  regions?: RegionId[];
  /** Airports where passengers changed planes, for the chronicle's "transfer hub" entries. */
  transferHubs?: string[];
}

/** The parts of a report the chronicle compares against. */
export interface ChronicleHistoryReport extends ReportMetrics {
  totalProfit?: number;
  capitalAfter?: number;
}

/**
 * The player's share of departures on the city pairs it flies: its weekly
 * departures over everyone's, rivals included, summed across those pairs.
 * A pair the player flies twice counts both routes. Pairs only rivals fly do
 * not count: this is how much of its own markets the airline holds, not of
 * the world's. Null without a single departure of its own.
 */
export function departureMarketShare(
  routes: { origin: string; destination: string; schedule?: unknown[]; weeklyFlights?: number }[],
  rivalOffers: RouteOffer[]
): number | null {
  const own = new Map<string, number>();
  for (const r of routes) {
    const departures = r.schedule?.length || r.weeklyFlights || 0;
    if (departures > 0) {
      const key = marketKey(r.origin, r.destination);
      own.set(key, (own.get(key) || 0) + departures);
    }
  }
  if (own.size === 0) return null;
  let mine = 0;
  for (const d of own.values()) mine += d;
  let rivals = 0;
  for (const offer of rivalOffers) {
    if (own.has(marketKey(offer.origin, offer.destination))) rivals += Math.max(0, offer.departures || 0);
  }
  return mine / (mine + rivals);
}

/**
 * Every region the routes touch, each with the first route (in list order)
 * that reaches it, for the chronicle to name.
 */
export function regionsServed(
  routes: { origin: string; destination: string }[],
  airportsMap: Map<string, { coords: [number, number] }>
): Map<RegionId, string> {
  const served = new Map<RegionId, string>();
  for (const r of routes) {
    for (const id of [r.origin, r.destination]) {
      const airport = airportsMap.get(id);
      if (!airport) continue;
      const region = regionOf(airport.coords);
      if (!served.has(region)) served.set(region, `${r.origin}-${r.destination}`);
    }
  }
  return served;
}

// --- Keeping the chronicle -----------------------------------------------------

/**
 * The chronicle cut to `limit` entries, oldest first to go. The newest entry
 * of every key is kept as long as anything else can go instead: it is how the
 * chronicle knows a first has been written, and the value the next record has
 * to beat.
 */
export function trimChronicle(list: ChronicleEntry[], limit = CHRONICLE_LIMIT): ChronicleEntry[] {
  if (list.length <= limit) return list;
  const protectedIdx = new Set<number>();
  const seen = new Set<string>();
  for (let i = list.length - 1; i >= 0; i--) {
    const key = list[i].key;
    if (key && !seen.has(key)) {
      seen.add(key);
      protectedIdx.add(i);
    }
  }
  let excess = list.length - limit;
  const kept: ChronicleEntry[] = [];
  list.forEach((entry, i) => {
    if (excess > 0 && !protectedIdx.has(i)) {
      excess--;
      return;
    }
    kept.push(entry);
  });
  // Only protected entries were left to drop: the oldest of those go too.
  return kept.length > limit ? kept.slice(kept.length - limit) : kept;
}

/** The chronicle with a month's entries added, trimmed to its limit. */
export function appendChronicle(list: ChronicleEntry[], entries: ChronicleEntry[]): ChronicleEntry[] {
  return entries.length === 0 ? list : trimChronicle([...list, ...entries]);
}

/** The newest entry with this key, if any. */
function lastKeyed(list: ChronicleEntry[], key: string): ChronicleEntry | undefined {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].key === key) return list[i];
  return undefined;
}

// --- The month's entries --------------------------------------------------------

/** A best month is a record worth writing down once it beats the last one written by this factor... */
export const RECORD_PROFIT_MARGIN = 1.25;
/** ...and at least this many months after it: a young airline beats its record every month for a while. */
export const RECORD_MIN_GAP_MONTHS = 6;
/** A reputation high is written down once it is this many points above the last one written. */
export const RECORD_REPUTATION_STEP = 5;

export interface ChronicleMonth {
  /** The month just closed. */
  offset: number;
  /** Its operating profit. */
  profit: number;
  /** Capital at its end. */
  capitalAfter: number;
  /** Reputation at its end, and before the close, the baseline for an airline with no reputation on record. */
  reputation: number;
  reputationBefore: number;
  /** Reports closed before this one, oldest first. */
  history: ChronicleHistoryReport[];
  /** Milestones earned at this close. */
  milestones?: { title: string; detail?: string }[];
  /** The annual target settled at this close, in December. */
  goal?: { year: number; target: number; achieved: number; met: boolean } | null;
  /** World events that start with the coming month. */
  eventsStarted?: { title: string; startOffset: number; duration: number; demandMultiplier: number; fuelMultiplier: number }[];
  /** World events whose last month this was; `endOffset` is the first month without them. */
  eventsEnded?: { title: string; endOffset: number }[];
  /** A strike called at this close for the month at `offset`. */
  strike?: { offset: number; morale: number } | null;
  /** Disruptions rolled at this close; only the major ones are written down. */
  disruptions?: { offset: number; cancelShare: number; text: string }[];
  /** Every region the network touches now, with a route that reaches it. */
  regions?: Map<RegionId, string>;
  /** The hub's region: flying there is no news. */
  homeRegion?: RegionId;
  /** Connecting passengers this month by airport. */
  hubs?: { id: string; name: string; pax: number }[];
}

const signedPct = (multiplier: number) => {
  const pct = Math.round((multiplier - 1) * 100);
  return `${pct > 0 ? '+' : pct < 0 ? '−' : '±'}${Math.abs(pct)}%`;
};

/** What an event does, in a few words: "demand −20%, fuel +80%". */
function eventEffects(ev: { demandMultiplier: number; fuelMultiplier: number }): string {
  const parts: string[] = [];
  if (Math.round((ev.demandMultiplier - 1) * 100) !== 0) parts.push(`demand ${signedPct(ev.demandMultiplier)}`);
  if (Math.round((ev.fuelMultiplier - 1) * 100) !== 0) parts.push(`fuel ${signedPct(ev.fuelMultiplier)}`);
  return parts.join(', ');
}

/**
 * Whether a first may be written from a set the previous report recorded.
 * A report closed before those sets existed says nothing about what was new
 * then: its month is skipped, rather than dating the whole existing network
 * to the day the save was loaded. The first month of a game has no previous
 * report and everything in it is new.
 */
function previousSet<T>(history: ChronicleHistoryReport[], pick: (r: ChronicleHistoryReport) => T[] | undefined): Set<T> | null {
  if (history.length === 0) return new Set();
  const list = pick(history[history.length - 1]);
  return Array.isArray(list) ? new Set(list) : null;
}

/**
 * The entries one month close adds to the chronicle, in reading order.
 * `chronicle` is the chronicle so far, which the firsts and records consult.
 */
export function chronicleEntriesForMonth(chronicle: ChronicleEntry[], m: ChronicleMonth): ChronicleEntry[] {
  const out: ChronicleEntry[] = [];
  const at = m.offset;

  for (const ms of m.milestones || []) {
    out.push({ offset: at, kind: 'milestone', text: ms.detail ? `${ms.title}. ${ms.detail}` : `${ms.title}.` });
  }

  if (m.goal) {
    const g = m.goal;
    out.push({
      offset: at,
      kind: 'goal',
      text: g.met
        ? `${g.year} target met: ${formatCurrency(g.achieved)} operating profit against ${formatCurrency(g.target)}.`
        : `${g.year} target missed: ${formatCurrency(g.achieved)} of the ${formatCurrency(g.target)} the board expected.`
    });
  }

  // --- Records ---
  const profits = m.history.map(r => r.totalProfit).filter((v): v is number => Number.isFinite(v));
  const prevBest = profits.length > 0 ? Math.max(...profits) : -Infinity;
  // The bar is the last record written, never the best month so far: a
  // result creeping up a few percent a month would otherwise never clear it.
  // Without a record written yet (a save from before the chronicle), the
  // first profitable month on record stands in.
  const lastProfitRecord = lastKeyed(chronicle, 'record:profit');
  if (Number.isFinite(m.profit) && m.profit > 0 && m.profit > prevBest) {
    const baseline = lastProfitRecord?.value ?? profits.find(p => p > 0);
    if (baseline === undefined) {
      out.push({ offset: at, kind: 'record', key: 'record:profit', value: m.profit, text: `First month in profit: ${formatCurrency(m.profit)}.` });
    } else if (m.profit >= baseline * RECORD_PROFIT_MARGIN && (!lastProfitRecord || at - lastProfitRecord.offset >= RECORD_MIN_GAP_MONTHS)) {
      const since = lastProfitRecord
        ? ` ${formatNumber((m.profit / baseline - 1) * 100)}% above the record set in ${formatMonthOffset(lastProfitRecord.offset)}.`
        : '';
      out.push({
        offset: at,
        kind: 'record',
        key: 'record:profit',
        value: m.profit,
        text: `Best month yet: ${formatCurrency(m.profit)} operating profit.${since}`
      });
    }
  }

  // The same for reputation, which moves a little every month: the bar is
  // the last high written, or the earliest reputation on record.
  const reps = m.history.map(r => r.reputation).filter((v): v is number => Number.isFinite(v));
  const prevHigh = Math.max(m.reputationBefore, ...reps);
  if (Number.isFinite(m.reputation) && m.reputation > prevHigh) {
    const baseline = lastKeyed(chronicle, 'record:reputation')?.value ?? (reps.length > 0 ? reps[0] : m.reputationBefore);
    if (m.reputation >= baseline + RECORD_REPUTATION_STEP) {
      out.push({
        offset: at,
        kind: 'record',
        key: 'record:reputation',
        value: m.reputation,
        text: `Reputation reaches a new high of ${Math.round(m.reputation)}.`
      });
    }
  }

  // --- Network firsts ---
  const hasKey = (key: string) => chronicle.some(e => e.key === key) || out.some(e => e.key === key);
  const prevRegions = previousSet(m.history, r => r.regions);
  if (m.regions && prevRegions) {
    for (const [region, route] of m.regions) {
      const key = `region:${region}`;
      if (region === m.homeRegion || prevRegions.has(region) || hasKey(key)) continue;
      out.push({ offset: at, kind: 'network', key, text: `First route to ${REGION_LABELS[region]}: ${route}.` });
    }
  }
  const prevHubs = previousSet(m.history, r => r.transferHubs);
  if (m.hubs && prevHubs) {
    const firstEver = !chronicle.some(e => e.key?.startsWith('hub:'));
    const fresh = m.hubs
      .filter(h => Math.round(h.pax) > 0 && !prevHubs.has(h.id) && !hasKey(`hub:${h.id}`))
      .sort((a, b) => b.pax - a.pax || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    fresh.forEach((h, i) => {
      const pax = formatNumber(Math.round(h.pax));
      out.push({
        offset: at,
        kind: 'network',
        key: `hub:${h.id}`,
        text: firstEver && i === 0
          ? `First transfer hub: ${pax} passengers changed planes at ${h.name} (${h.id}).`
          : `${h.name} (${h.id}) becomes a transfer hub: ${pax} passengers changed planes there.`
      });
    });
  }

  // --- Lows ---
  const prevCapital = m.history.length > 0 ? m.history[m.history.length - 1].capitalAfter : undefined;
  if (m.capitalAfter < 0 && !(Number.isFinite(prevCapital) && prevCapital! < 0) && !hasKey('capital-negative')) {
    out.push({
      offset: at,
      kind: 'finance',
      key: 'capital-negative',
      text: `Capital falls below zero for the first time: ${formatCurrency(m.capitalAfter)} at the month's end.`
    });
  }

  // --- What the coming month brings ---
  if (m.strike) {
    out.push({
      offset: m.strike.offset,
      kind: 'strike',
      text: `Staff strike called for ${formatMonthOffset(m.strike.offset)}, with morale at ${Math.round(m.strike.morale)}.`
    });
  }
  for (const d of m.disruptions || []) {
    if (d.cancelShare >= MAJOR_DISRUPTION_SHARE) out.push({ offset: d.offset, kind: 'disruption', text: d.text });
  }
  for (const ev of m.eventsStarted || []) {
    const effects = eventEffects(ev);
    out.push({
      offset: ev.startOffset,
      kind: 'crisis',
      text: `${ev.title} begins${effects ? `: ${effects}` : ''}, for ${ev.duration} month${ev.duration === 1 ? '' : 's'}.`
    });
  }
  for (const ev of m.eventsEnded || []) {
    out.push({ offset: ev.endOffset, kind: 'crisis', text: `${ev.title} is over.` });
  }

  return out;
}
