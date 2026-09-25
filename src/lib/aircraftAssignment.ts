/**
 * Moving routes from one aircraft to another.
 *
 * Two screens do this: the aircraft swap on the aircraft page (every route of
 * one aircraft goes to an idle one, at the same times) and the "Change" dialog
 * on the route page (one route goes to any aircraft with room for it, at a
 * time the player picks). Both use the rules below, so they refuse the same
 * things for the same reasons.
 *
 * A timetable belongs to its aircraft: the leg time comes from the cruise
 * speed and the turnaround from the class (see scheduleUtils). Moving a route
 * therefore re-times every trip first -- same block start, new block length --
 * and only then checks it.
 */

import { calculateDistance } from '../data/airports';
import type { Airport } from '../data/airportTypes';
import { getFlightDurationMinutes, validateClassConfigs } from './financeUtils';
import {
  Interval,
  TripLike,
  WEEK_MIN,
  blockMinutes,
  checkOverlap,
  getTurnoverMinutes,
  getUsedWeeklySlots,
  minuteToTripStart,
  occupiedIntervals,
  tripInterval,
  tripStartMinute
} from './scheduleUtils';

export interface PlaneLike {
  registration: string;
  manufacturer: string;
  type: string;
  class: string;
  maxRange: number;
  cruiseSpeed: number;
  icaoCode: string;
  capacity?: number;
  hubId?: string;
  config?: { first?: number; business?: number; premium?: number; economy?: number; details?: unknown };
}

export interface TripRecord extends TripLike {
  id?: string;
  flightNumOut?: string | number;
  flightNumIn?: string | number;
}

export interface RouteLike {
  id: string;
  origin: string;
  destination: string;
  aircraft: string;
  distance?: number;
  schedule?: TripRecord[];
  classConfigs?: Record<string, unknown>;
  durMin?: number;
  turnoverMin?: number;
  airline?: string;
  airlineCode?: string;
}

export interface AssignmentContext {
  routes: RouteLike[];
  fleet: PlaneLike[];
  airports: ReadonlyMap<string, Airport>;
  airportManagement: Record<string, { slots?: Partial<Record<string, number>> } | undefined>;
  /** Flight-number prefix for routes saved before they carried their own. */
  airlineCode?: string;
}

/** Something that stops the move. */
export interface AssignmentIssue {
  kind: 'airport' | 'range' | 'runway' | 'hub' | 'timetable' | 'slots';
  message: string;
}

/** Something that changes with the move but does not stop it. */
export interface AssignmentNote {
  kind: 'seats' | 'cabin' | 'service' | 'flight-time';
  message: string;
}

/** The fields of a stored route that change when it moves to another aircraft. */
export interface RoutePatch {
  id: string;
  origin: string;
  aircraft: string;
  schedule: TripRecord[];
  weeklyFlights: number;
  durMin: number;
  turnoverMin: number;
  classConfigs?: Record<string, unknown>;
}

export interface AssignmentCheck {
  ok: boolean;
  issues: AssignmentIssue[];
  notes: AssignmentNote[];
  /** One per moved route, ready to merge onto the stored route. */
  patches: RoutePatch[];
  /**
   * Only with `allowShift`: every shift of the whole timetable, in minutes
   * (0 to WEEK_MIN - 5), at which it fits the aircraft's free time. The
   * patch is already moved to the one closest to the current times.
   */
  shifts?: number[];
  /** Only with `allowShift`: the shift the patch uses. */
  shift?: number;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** More conflicts than this are summed up in one line instead of listed. */
const MAX_LISTED_CONFLICTS = 6;

const pad2 = (n: number) => n.toString().padStart(2, '0');

/** "Mon 08:30" for a minute of the week. */
export function formatWeekMinute(weekMinute: number): string {
  const { dayId, startHour, startMin } = minuteToTripStart(weekMinute);
  return `${DAY_LABELS[dayId - 1]} ${pad2(startHour)}:${pad2(startMin)}`;
}

/** "2h 05m". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}h ${pad2(m % 60)}m`;
}

export function seatCount(plane: PlaneLike): number {
  const c = plane.config;
  const seats = c ? (c.first || 0) + (c.business || 0) + (c.premium || 0) + (c.economy || 0) : 0;
  return seats > 0 ? seats : plane.capacity || 0;
}

/** Share of the week the aircraft is already committed, 0..1. */
export function weeklyUtilisation(routes: RouteLike[], registration: string): number {
  let used = 0;
  for (const r of routes) {
    if (r.aircraft !== registration) continue;
    for (const s of r.schedule || []) used += blockMinutes(s);
  }
  return Math.min(1, used / WEEK_MIN);
}

function routeLabel(route: RouteLike, airlineCode = ''): string {
  const num = route.schedule?.[0]?.flightNumOut;
  const prefix = num ? `${route.airlineCode || airlineCode}${num} ` : '';
  return `${prefix}${route.origin}-${route.destination}`;
}

/** Moves every trip by `delta` minutes on the weekly cycle. */
export function shiftTrips<T extends TripRecord>(trips: T[], delta: number): T[] {
  if (!delta) return trips;
  return trips.map(t => ({ ...t, ...minuteToTripStart(tripStartMinute(t) + delta) }));
}

/**
 * Every shift (in 5-minute steps) at which all `trips` avoid the `occupied`
 * blocks. The minutes are a prefix sum, so each trip costs one subtraction
 * per shift.
 */
export function findOpenShifts(trips: TripLike[], occupied: Interval[]): number[] {
  const blocked = new Uint8Array(WEEK_MIN);
  for (const occ of occupied) {
    const len = Math.max(0, Math.ceil(occ.end) - Math.floor(occ.start));
    if (len >= WEEK_MIN) return [];
    const s = ((Math.floor(occ.start) % WEEK_MIN) + WEEK_MIN) % WEEK_MIN;
    for (let k = 0; k < len; k++) blocked[(s + k) % WEEK_MIN] = 1;
  }
  const prefix = new Int32Array(2 * WEEK_MIN + 1);
  for (let m = 0; m < 2 * WEEK_MIN; m++) prefix[m + 1] = prefix[m] + blocked[m % WEEK_MIN];

  const blocks = trips.map(t => ({ start: tripStartMinute(t), len: blockMinutes(t) }));
  if (blocks.some(b => b.len >= WEEK_MIN)) return [];

  const out: number[] = [];
  for (let delta = 0; delta < WEEK_MIN; delta += 5) {
    let fits = true;
    for (const b of blocks) {
      const s = (((b.start + delta) % WEEK_MIN) + WEEK_MIN) % WEEK_MIN;
      if (prefix[s + b.len] - prefix[s] > 0) { fits = false; break; }
    }
    if (fits) out.push(delta);
  }
  return out;
}

/**
 * The smallest shift that maps the timetable onto itself: a day for a daily
 * route, a week for a single weekly flight. Shifts beyond it only repeat
 * timetables already offered.
 */
export function timetablePeriod(trips: TripLike[]): number {
  if (trips.length === 0) return WEEK_MIN;
  const key = (start: number, t: TripLike) => `${((start % WEEK_MIN) + WEEK_MIN) % WEEK_MIN}|${t.isOneWay ? 1 : 0}`;
  const own = new Set(trips.map(t => key(tripStartMinute(t), t)));
  for (let d = 5; d < WEEK_MIN; d += 5) {
    if (trips.every(t => own.has(key(tripStartMinute(t) + d, t)))) return d;
  }
  return WEEK_MIN;
}

/**
 * The open shifts as ranges the player can pick from, limited to one period
 * of the timetable so a daily route is not offered the same time seven times.
 * `from`/`to` are shifts in minutes relative to the current timetable (both
 * open); the range that contains 0 -- where the timetable is now -- starts
 * below 0 when it wraps.
 */
export function openShiftWindows(trips: TripLike[], occupied: Interval[]): { from: number; to: number }[] {
  const period = timetablePeriod(trips);
  const shifts = findOpenShifts(trips, occupied).filter(s => s < period);
  const windows: { from: number; to: number }[] = [];
  for (const s of shifts) {
    const last = windows[windows.length - 1];
    if (last && s === last.to + 5) last.to = s;
    else windows.push({ from: s, to: s });
  }
  // A window touching both ends of the period is one window across the wrap.
  if (windows.length > 1 && windows[0].from === 0 && windows[windows.length - 1].to === period - 5) {
    const tail = windows.pop()!;
    windows[0] = { from: tail.from - period, to: windows[0].to };
  }
  return windows;
}

/** The shift that moves the timetable least, earlier or later. */
export function nearestShift(shifts: number[]): number | undefined {
  let best: number | undefined;
  let bestDist = Infinity;
  for (const d of shifts) {
    const dist = Math.min(d, WEEK_MIN - d);
    if (dist < bestDist) { best = d; bestDist = dist; }
  }
  return best;
}

/**
 * A route as it would be on `plane`: every trip keeps its block start and
 * gets the plane's leg time and turnaround, and cabin services the plane
 * cannot offer are dropped the same way the route planner drops them.
 */
function adaptRoute(route: RouteLike, plane: PlaneLike, ctx: AssignmentContext): RoutePatch {
  const origin = ctx.airports.get(route.origin);
  const dest = ctx.airports.get(route.destination);
  const durMin = origin && dest ? getFlightDurationMinutes(origin, dest, plane) : Number(route.durMin) || 0;
  const turnoverMin = getTurnoverMinutes(plane.class);
  const schedule = (route.schedule || []).map(t => ({
    ...t,
    dayId: Number(t.dayId) || 1,
    startHour: Number(t.startHour) || 0,
    startMin: Number(t.startMin) || 0,
    durMin,
    turnoverMin
  }));
  const classConfigs = route.classConfigs
    ? validateClassConfigs(route.classConfigs, plane, ctx.airportManagement, origin, dest)
    : undefined;
  return {
    id: route.id,
    origin: route.origin,
    aircraft: plane.registration,
    schedule,
    weeklyFlights: schedule.length,
    durMin,
    turnoverMin,
    ...(classConfigs ? { classConfigs } : {})
  };
}

interface LabelledTrip {
  label: string;
  trip: TripRecord;
  interval: Interval;
}

function tripText(t: LabelledTrip): string {
  return `${t.label} ${formatWeekMinute(t.interval.start)}-${formatWeekMinute(t.interval.end).slice(4)}`;
}

/**
 * Checks whether `plane` can take over `moving` (routes currently flown by
 * other aircraft) and builds the patches that do it.
 *
 * Blocks the move: an unknown airport, a leg longer than the plane's range,
 * an airport too small for the plane's ICAO code, a route starting away from
 * the plane's hub, flights that would overlap each other or the plane's other
 * flights, and too few rented slots when the plane's class needs different
 * slots than the aircraft it replaces.
 *
 * With `allowShift` (one route only) the timetable may move as a whole: the
 * check then looks for any time at which it fits instead of the current one.
 */
export function checkReassignment(
  moving: RouteLike[],
  plane: PlaneLike,
  ctx: AssignmentContext,
  options: { allowShift?: boolean } = {}
): AssignmentCheck {
  const issues: AssignmentIssue[] = [];
  const notes: AssignmentNote[] = [];
  const movingIds = new Set(moving.map(r => r.id));
  const fleetByReg = new Map(ctx.fleet.map(p => [p.registration, p]));
  const planeName = `${plane.registration} (${plane.manufacturer} ${plane.type})`;

  let patches = moving.map(r => adaptRoute(r, plane, ctx));

  // --- Per route: airports, range, runway, hub ---
  moving.forEach(route => {
    const label = routeLabel(route, ctx.airlineCode);
    const origin = ctx.airports.get(route.origin);
    const dest = ctx.airports.get(route.destination);
    if (!origin || !dest) {
      issues.push({ kind: 'airport', message: `${label}: airport ${!origin ? route.origin : route.destination} is unknown.` });
      return;
    }
    const dist = Math.round(calculateDistance(origin.coords[0], origin.coords[1], dest.coords[0], dest.coords[1]));
    if (plane.maxRange < dist) {
      issues.push({
        kind: 'range',
        message: `${label}: the route is ${dist.toLocaleString('en-US')} km, ${plane.registration} flies ${plane.maxRange.toLocaleString('en-US')} km at most.`
      });
    }
    for (const ap of [origin, dest]) {
      if (plane.icaoCode > ap.maxIcaoCode) {
        issues.push({
          kind: 'runway',
          message: `${label}: ${ap.id} takes aircraft up to ICAO code ${ap.maxIcaoCode}, the ${plane.type} is code ${plane.icaoCode}.`
        });
      }
    }
    if (plane.hubId && plane.hubId !== route.origin) {
      issues.push({
        kind: 'hub',
        message: `${label}: the route starts at ${route.origin}, ${plane.registration} is based at ${plane.hubId}.`
      });
    }
  });

  // --- Timetable ---
  const occupied = occupiedIntervals(
    ctx.routes.filter(r => !movingIds.has(r.id)),
    plane.registration
  );
  const labelled = (list: RoutePatch[]): LabelledTrip[] =>
    list.flatMap((p, i) =>
      p.schedule.map(trip => ({ label: routeLabel(moving[i], ctx.airlineCode), trip, interval: tripInterval(trip) }))
    );

  // Trips of the moved routes against each other. A slower aircraft lengthens
  // every block, so flights that fitted back to back may now overlap; no
  // shift can fix that, since all of them move together.
  const selfConflicts: string[] = [];
  const own = labelled(patches);
  for (let i = 0; i < own.length; i++) {
    for (let j = i + 1; j < own.length; j++) {
      const a = own[i].interval;
      const b = own[j].interval;
      if (checkOverlap(a.start, a.end, b.start, b.end)) selfConflicts.push(`${tripText(own[i])} overlaps ${tripText(own[j])}`);
    }
  }
  pushConflicts(issues, selfConflicts, `On ${plane.registration} these flights take longer and overlap`);

  let shifts: number[] | undefined;
  let shift: number | undefined;
  if (options.allowShift && moving.length === 1) {
    const trips = patches[0].schedule;
    shifts = selfConflicts.length > 0 ? [] : findOpenShifts(trips, occupied);
    shift = nearestShift(shifts);
    if (selfConflicts.length === 0 && shift === undefined) {
      const block = trips.length > 0 ? blockMinutes(trips[0]) : 0;
      issues.push({
        kind: 'timetable',
        message: `${plane.registration} has no free time for all ${trips.length} flights (${formatDuration(block)} each) at any start time.`
      });
    }
    if (shift) {
      patches = patches.map(p => ({ ...p, schedule: shiftTrips(p.schedule, shift!) }));
    }
  } else if (occupied.length > 0) {
    const busy: string[] = [];
    for (const t of labelled(patches)) {
      for (const occ of occupied) {
        if (checkOverlap(t.interval.start, t.interval.end, occ.start, occ.end)) {
          busy.push(`${tripText(t)} overlaps a flight ${plane.registration} already flies (${formatWeekMinute(occ.start)})`);
          break;
        }
      }
    }
    pushConflicts(issues, busy, `${plane.registration} is already busy`);
  }

  // --- Slots ---
  // Slots are rented per aircraft class. Only a change of class can need
  // slots the airline does not have yet, so a count that was already over
  // the limit before the move is not blamed on it.
  const slotKey = String(plane.class || '').toLowerCase();
  const airportsTouched = [...new Set(moving.flatMap(r => [r.origin, r.destination]))];
  for (const apId of airportsTouched) {
    const before = getUsedWeeklySlots(ctx.routes, fleetByReg, apId, plane.class);
    const others = getUsedWeeklySlots(ctx.routes.filter(r => !movingIds.has(r.id)), fleetByReg, apId, plane.class);
    const added = patches
      .filter(p => {
        const r = moving.find(m => m.id === p.id)!;
        return r.origin === apId || r.destination === apId;
      })
      .reduce((sum, p) => sum + p.schedule.length, 0);
    const after = others + added;
    const rented = ctx.airportManagement[apId]?.slots?.[slotKey] || 0;
    if (after > rented && after > before) {
      issues.push({
        kind: 'slots',
        message: `${apId}: ${after} ${slotKey} slots per week needed, ${rented} rented. Buy ${after - rented} more at the airport first.`
      });
    }
  }

  // --- Notes ---
  const replaced = [...new Set(moving.map(r => r.aircraft))]
    .map(reg => fleetByReg.get(reg))
    .filter((p): p is PlaneLike => !!p && p.registration !== plane.registration);
  for (const old of replaced) {
    const was = seatCount(old);
    const now = seatCount(plane);
    if (was !== now) {
      notes.push({
        kind: 'seats',
        message: `${now} seats instead of ${was} (${now > was ? '+' : ''}${now - was}) compared with ${old.registration}.`
      });
    }
    const lost = (['first', 'business', 'premium'] as const)
      .filter(c => (old.config?.[c] || 0) > 0 && !(plane.config?.[c] || 0));
    if (lost.length > 0) {
      notes.push({ kind: 'cabin', message: `No ${lost.join(', ')} seats on ${plane.registration}; those passengers are not carried.` });
    }
  }
  moving.forEach((route, i) => {
    const label = routeLabel(route, ctx.airlineCode);
    const was = Number(route.durMin) || 0;
    const now = patches[i].durMin;
    if (was > 0 && Math.abs(now - was) >= 5) {
      notes.push({ kind: 'flight-time', message: `${label}: flight time ${formatDuration(was)} becomes ${formatDuration(now)}.` });
    }
    if (route.classConfigs && patches[i].classConfigs !== route.classConfigs) {
      notes.push({ kind: 'service', message: `${label}: catering or extras the ${plane.type} cannot offer are removed.` });
    }
  });

  return { ok: issues.length === 0, issues, notes, patches, ...(shifts ? { shifts, shift } : {}) };
}

function pushConflicts(issues: AssignmentIssue[], lines: string[], heading: string) {
  if (lines.length === 0) return;
  const listed = lines.slice(0, MAX_LISTED_CONFLICTS);
  const more = lines.length - listed.length;
  issues.push({
    kind: 'timetable',
    message: `${heading}: ${listed.join('; ')}${more > 0 ? `; and ${more} more` : ''}.`
  });
}

/** Routes an aircraft flies. */
export function routesOf<R extends RouteLike>(routes: R[], registration: string): R[] {
  return routes.filter(r => r.aircraft === registration);
}

/** Aircraft that fly nothing, which a swap may hand routes to. */
export function idleAircraft<P extends PlaneLike>(fleet: P[], routes: RouteLike[], except?: string): P[] {
  const busy = new Set(routes.map(r => r.aircraft));
  return fleet.filter(p => p.registration !== except && !busy.has(p.registration));
}
