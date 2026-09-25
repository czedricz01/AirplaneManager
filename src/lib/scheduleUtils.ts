/**
 * Weekly timetable arithmetic, shared by the route planner, the schedule
 * editor and the airport console.
 *
 * Each of those used to carry its own copy of these rules, and the copies had
 * drifted: the editor counted slots of every aircraft class against one class,
 * used a fixed 45-minute turnaround where the planner used 30/60/90, ignored
 * one-way legs, and read `startHour` as the departure time while everything
 * else reads it as the start of the block.
 *
 * Conventions, fixed here:
 *   - The week has WEEK_MIN minutes; Monday 00:00 is minute 0.
 *   - A trip's `dayId/startHour/startMin` is the START OF ITS BLOCK. The
 *     aircraft is boarded for BOARDING_MIN minutes, then departs.
 *   - A round trip blocks boarding + leg + turnaround + leg + deboarding;
 *     a one-way trip boarding + leg + deboarding. Blocks are rounded up to
 *     5 minutes, the granularity of every schedule control.
 */

export const WEEK_MIN = 10080;
export const DAY_MIN = 1440;
export const BOARDING_MIN = 30;

export interface TripLike {
  dayId: number;
  startHour: number;
  startMin: number;
  durMin: number;
  turnoverMin: number;
  isOneWay?: boolean;
}

export interface Interval {
  start: number;
  end: number;
}

/** Turnaround at the outstation, by aircraft class. */
export function getTurnoverMinutes(aircraftClass: string | undefined | null): number {
  const c = String(aircraftClass || '').toLowerCase();
  if (c === 'regional') return 30;
  if (c === 'widebody') return 90;
  return 60;
}

/** Minutes the aircraft is committed to one trip, before rounding. */
export function rawBlockMinutes(trip: Pick<TripLike, 'durMin' | 'turnoverMin' | 'isOneWay'>): number {
  const dur = Number(trip.durMin) || 0;
  const turn = Number(trip.turnoverMin) || 0;
  return trip.isOneWay
    ? BOARDING_MIN + dur + BOARDING_MIN
    : BOARDING_MIN + dur + turn + dur + BOARDING_MIN;
}

/** Minutes the aircraft is committed to one trip, rounded up to 5. */
export function blockMinutes(trip: Pick<TripLike, 'durMin' | 'turnoverMin' | 'isOneWay'>): number {
  return Math.ceil(rawBlockMinutes(trip) / 5) * 5;
}

/** Minute of the week at which a trip's block starts. */
export function tripStartMinute(trip: Pick<TripLike, 'dayId' | 'startHour' | 'startMin'>): number {
  return ((Number(trip.dayId) || 1) - 1) * DAY_MIN + (Number(trip.startHour) || 0) * 60 + (Number(trip.startMin) || 0);
}

/** The block a trip occupies, in minutes of the week (the end may pass WEEK_MIN). */
export function tripInterval(trip: TripLike): Interval {
  const start = tripStartMinute(trip);
  return { start, end: start + blockMinutes(trip) };
}

/** Turns a minute of the week back into dayId/startHour/startMin. */
export function minuteToTripStart(weekMinute: number): { dayId: number; startHour: number; startMin: number } {
  const m = ((Math.round(weekMinute) % WEEK_MIN) + WEEK_MIN) % WEEK_MIN;
  return {
    dayId: Math.floor(m / DAY_MIN) + 1,
    startHour: Math.floor((m % DAY_MIN) / 60),
    startMin: m % 60
  };
}

/**
 * Whether two blocks overlap on the weekly cycle. A block that runs past the
 * end of Sunday continues on Monday.
 */
export function checkOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
  if (s1 < e2 && e1 > s2) return true;
  if (s1 + WEEK_MIN < e2 && e1 + WEEK_MIN > s2) return true;
  if (s1 - WEEK_MIN < e2 && e1 - WEEK_MIN > s2) return true;
  return false;
}

/** Every block an aircraft already flies, except those of `excludeRouteId`. */
export function occupiedIntervals(
  routes: { id: string; aircraft: string; schedule?: TripLike[] }[],
  registration: string,
  excludeRouteId?: string | null
): Interval[] {
  const out: Interval[] = [];
  for (const r of routes) {
    if (r.aircraft !== registration || r.id === excludeRouteId) continue;
    for (const s of r.schedule || []) out.push(tripInterval(s));
  }
  return out;
}

/**
 * Weekly departures scheduled at an airport by aircraft of one class. Slots
 * are rented per class, so only aircraft of that class count against them.
 */
export function getUsedWeeklySlots(
  routes: { id: string; origin: string; destination: string; aircraft: string; schedule?: unknown[] }[],
  fleetByRegistration: Map<string, { class: string }>,
  airportId: string | null | undefined,
  aircraftClass: string,
  excludeRouteId?: string | null
): number {
  if (!airportId) return 0;
  const wanted = String(aircraftClass || '').toLowerCase();
  let count = 0;
  for (const r of routes) {
    if (r.id === excludeRouteId) continue;
    if (r.origin !== airportId && r.destination !== airportId) continue;
    const ac = fleetByRegistration.get(r.aircraft);
    if (!ac || String(ac.class).toLowerCase() !== wanted) continue;
    count += r.schedule?.length || 0;
  }
  return count;
}

/**
 * The "Max Flights" search: for every 5-minute start in the week, greedily
 * pack blocks of `cycleMin` forward (retrying 5 minutes later on a conflict)
 * and keep the start times that fit the most flights.
 *
 * This is the planner's original algorithm, same inputs, same outputs. The
 * original checked each candidate against every occupied block, so a busy
 * aircraft cost 2016 starts x up to 2100 steps x N blocks. Here the occupied
 * minutes are a prefix sum, so each check is O(1), and a candidate can only
 * collide with blocks placed in the same pass by wrapping round onto the
 * first of them -- a single comparison.
 */
export function findMaxFlightStarts(
  occupied: Interval[],
  cycleMin: number,
  remainingSlots: number
): { bestCount: number; bestStartTimes: number[] } {
  const cyc = Math.max(1, Math.round(cycleMin));
  const takenBetween = blockedMinutes(occupied);

  let bestCount = -1;
  let bestStartTimes: number[] = [];

  for (let testStart = 0; testStart < WEEK_MIN; testStart += 5) {
    const added = greedyPack(takenBetween, cyc, remainingSlots, testStart).length;
    if (added > bestCount) {
      bestCount = added;
      bestStartTimes = [testStart];
    } else if (added === bestCount) {
      bestStartTimes.push(testStart);
    }
  }

  return { bestCount, bestStartTimes };
}

/**
 * Counts taken minutes in a range of the week. The minutes are a prefix sum
 * duplicated over two weeks, so a block crossing Sunday midnight is a plain
 * range and every check is O(1).
 */
function blockedMinutes(occupied: Interval[]): (start: number, end: number) => number {
  const blocked = new Uint8Array(WEEK_MIN);
  for (const occ of occupied) {
    const len = Math.max(0, Math.ceil(occ.end) - Math.floor(occ.start));
    if (len >= WEEK_MIN) { blocked.fill(1); break; }
    const s = ((Math.floor(occ.start) % WEEK_MIN) + WEEK_MIN) % WEEK_MIN;
    for (let k = 0; k < len; k++) blocked[(s + k) % WEEK_MIN] = 1;
  }
  const prefix = new Int32Array(2 * WEEK_MIN + 1);
  for (let m = 0; m < 2 * WEEK_MIN; m++) prefix[m + 1] = prefix[m] + blocked[m % WEEK_MIN];
  return (s, e) => prefix[e] - prefix[s];
}

/**
 * One pass of the "Max Flights" search from `testStart`: places blocks of
 * `cyc` minutes forward, retrying 5 minutes later on a conflict. Returns the
 * block starts (they may pass WEEK_MIN; reduce them with minuteToTripStart).
 */
function greedyPack(
  takenBetween: (start: number, end: number) => number,
  cyc: number,
  remainingSlots: number,
  testStart: number
): number[] {
  const placed: number[] = [];
  let searchTime = testStart;
  let i = 0;

  while (placed.length < remainingSlots && i < 2100) {
    i++;
    const candidateStart = searchTime % WEEK_MIN;
    let conflict = cyc >= WEEK_MIN || takenBetween(candidateStart, candidateStart + cyc) > 0;
    // A block placed in this pass can only be hit by wrapping round onto the first one.
    if (!conflict && placed.length > 0 && searchTime + cyc > placed[0] + WEEK_MIN) conflict = true;

    if (!conflict) {
      placed.push(searchTime);
      searchTime += cyc;
    } else {
      searchTime += 5;
    }
    if (searchTime >= testStart + WEEK_MIN) break;
  }
  return placed;
}

/**
 * "Max Flights" as a timetable: the most blocks of `cycleMin` the week can
 * hold next to `occupied`, capped by `remainingSlots`.
 *
 * The start is chosen as in the route planner: with other flights on the
 * aircraft, the best start closest after the end of its first block (so the
 * new flights pack against the existing ones); on an empty aircraft,
 * `preferredStart` (any start is equally good there).
 */
export function maxFlightStarts(
  occupied: Interval[],
  cycleMin: number,
  remainingSlots: number,
  preferredStart = 0
): number[] {
  if (remainingSlots <= 0) return [];
  const cyc = Math.max(1, Math.round(cycleMin));
  const takenBetween = blockedMinutes(occupied);

  let chosen = ((Math.round(preferredStart / 5) * 5) % WEEK_MIN + WEEK_MIN) % WEEK_MIN;
  if (occupied.length > 0) {
    const { bestCount, bestStartTimes } = findMaxFlightStarts(occupied, cyc, remainingSlots);
    if (bestCount <= 0 || bestStartTimes.length === 0) return [];
    const firstEnd = [...occupied].sort((a, b) => a.start - b.start)[0].end;
    let minDiff = Infinity;
    for (const st of bestStartTimes) {
      const diff = (((st - firstEnd) % WEEK_MIN) + WEEK_MIN) % WEEK_MIN;
      if (diff < minDiff) { minDiff = diff; chosen = st; }
    }
  }
  return greedyPack(takenBetween, cyc, remainingSlots, chosen).map(m => m % WEEK_MIN);
}

/**
 * "Multiple Ops" for one day: the block start (minute of the week) at which
 * `ops` round trips can fly back to back from `dayId` without touching `busy`.
 * `preferredStartInDay` is tried first, then every later 5-minute start of the
 * same day, wrapping round to the morning. Null when none fits.
 */
export function findDayRunStart(
  dayId: number,
  ops: number,
  cycleMin: number,
  busy: Interval[],
  preferredStartInDay: number
): number | null {
  const n = Math.max(1, Math.round(ops));
  const cyc = Math.max(5, Math.ceil(cycleMin / 5) * 5);
  if (n * cyc > WEEK_MIN) return null;
  const dayStart = (dayId - 1) * DAY_MIN;
  const pref = ((Math.round(preferredStartInDay / 5) * 5) % DAY_MIN + DAY_MIN) % DAY_MIN;
  for (let k = 0; k < DAY_MIN; k += 5) {
    const start = dayStart + ((pref + k) % DAY_MIN);
    let fits = true;
    for (let op = 0; op < n && fits; op++) {
      const s = start + op * cyc;
      for (const b of busy) {
        if (checkOverlap(s, s + cyc, b.start, b.end)) { fits = false; break; }
      }
    }
    if (fits) return start;
  }
  return null;
}

/**
 * "Select All" with Multiple Ops: one start time of day at which every day in
 * `days` can fly its `ops` round trips. Tries `preferredStartInDay` first,
 * then every later 5-minute start. Null when no single time fits every day.
 */
export function findCommonRunStart(
  days: number[],
  ops: number,
  cycleMin: number,
  busy: Interval[],
  preferredStartInDay: number
): number | null {
  const n = Math.max(1, Math.round(ops));
  const cyc = Math.max(5, Math.ceil(cycleMin / 5) * 5);
  const pref = ((Math.round(preferredStartInDay / 5) * 5) % DAY_MIN + DAY_MIN) % DAY_MIN;
  // The days' own runs must not overlap each other either.
  if (n * cyc > DAY_MIN && days.length > 1) return null;
  for (let k = 0; k < DAY_MIN; k += 5) {
    const t = (pref + k) % DAY_MIN;
    let fits = true;
    for (const d of days) {
      for (let op = 0; op < n && fits; op++) {
        const s = (d - 1) * DAY_MIN + t + op * cyc;
        for (const b of busy) {
          if (checkOverlap(s, s + cyc, b.start, b.end)) { fits = false; break; }
        }
      }
      if (!fits) break;
    }
    if (fits) return t;
  }
  return null;
}
