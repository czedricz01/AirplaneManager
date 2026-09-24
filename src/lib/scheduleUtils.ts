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

  // blocked[m] = 1 when minute m of the week is taken. Duplicated over two
  // weeks so a block crossing Sunday midnight is a plain range.
  const blocked = new Uint8Array(WEEK_MIN);
  for (const occ of occupied) {
    const len = Math.max(0, Math.ceil(occ.end) - Math.floor(occ.start));
    if (len >= WEEK_MIN) { blocked.fill(1); break; }
    const s = ((Math.floor(occ.start) % WEEK_MIN) + WEEK_MIN) % WEEK_MIN;
    for (let k = 0; k < len; k++) blocked[(s + k) % WEEK_MIN] = 1;
  }
  const prefix = new Int32Array(2 * WEEK_MIN + 1);
  for (let m = 0; m < 2 * WEEK_MIN; m++) prefix[m + 1] = prefix[m] + blocked[m % WEEK_MIN];
  const takenBetween = (s: number, e: number) => prefix[e] - prefix[s];

  let bestCount = -1;
  let bestStartTimes: number[] = [];

  for (let testStart = 0; testStart < WEEK_MIN; testStart += 5) {
    let searchTime = testStart;
    let added = 0;
    let firstPlaced = -1;
    let i = 0;

    while (added < remainingSlots && i < 2100) {
      i++;
      const candidateStart = searchTime % WEEK_MIN;
      let conflict = cyc >= WEEK_MIN || takenBetween(candidateStart, candidateStart + cyc) > 0;
      if (!conflict && firstPlaced >= 0 && searchTime + cyc > firstPlaced + WEEK_MIN) conflict = true;

      if (!conflict) {
        if (firstPlaced < 0) firstPlaced = searchTime;
        added++;
        searchTime += cyc;
      } else {
        searchTime += 5;
      }
      if (searchTime >= testStart + WEEK_MIN) break;
    }

    if (added > bestCount) {
      bestCount = added;
      bestStartTimes = [testStart];
    } else if (added === bestCount) {
      bestStartTimes.push(testStart);
    }
  }

  return { bestCount, bestStartTimes };
}
