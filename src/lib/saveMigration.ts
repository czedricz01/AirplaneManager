import { airportsMapAdjusted } from '../data/airportRegistry';
import { getFlightDurationMinutes, TRANSIENT_ROUTE_FIELDS } from './financeUtils';
import { finiteOr } from './invariants';
import { capMessages, createWelcomeMessage } from './messages';
import { logWarn } from './debugLog';

/**
 * Brings any savegame, however old, into the shape the current game expects.
 *
 * Loading used to copy fields straight into state. A save written before a
 * field existed then fed `undefined` into the economy -- `conditionGeneral -
 * decay` is NaN, and NaN spreads to everything it touches. A save without an
 * inbox left the previous game's messages on screen. Everything is normalised
 * here, in one place that can be tested without a browser, and every repair is
 * reported to the diagnostic log.
 */

/** Written into every new save. Bump it whenever the shape changes. */
export const SAVE_VERSION = 2;

const PERSONALITIES = ['flag', 'lcc', 'expansionist', 'optimizer', 'boutique'] as const;
const AGGRESSION: Record<string, number> = { expansionist: 9, lcc: 8, flag: 6, optimizer: 4, boutique: 5 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const asObject = <T extends object>(v: unknown, fallback: T): T =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : fallback;

export function migratePlane(plane: any): any {
  const capacity = finiteOr(plane?.capacity, 100);
  const config = plane?.config && typeof plane.config === 'object'
    ? {
        ...plane.config,
        economy: finiteOr(plane.config.economy, 0),
        premium: finiteOr(plane.config.premium, 0),
        business: finiteOr(plane.config.business, 0),
        first: finiteOr(plane.config.first, 0)
      }
    : { economy: capacity, premium: 0, business: 0, first: 0, details: {} };

  return {
    ...plane,
    capacity,
    config,
    purchasedAt: finiteOr(plane?.purchasedAt, 0),
    conditionInterior: clamp(finiteOr(plane?.conditionInterior, 100), 0, 100),
    conditionGeneral: clamp(finiteOr(plane?.conditionGeneral, 100), 0, 100),
    baseInteriorPop: finiteOr(plane?.baseInteriorPop, 50),
    popularity: finiteOr(plane?.popularity, 50),
    generalChecksDone: finiteOr(plane?.generalChecksDone, 0),
    refitsDone: finiteOr(plane?.refitsDone, 0)
  };
}

function cleanTrip(s: any) {
  return {
    ...s,
    startHour: finiteOr(s?.startHour, 12),
    startMin: finiteOr(s?.startMin, 0),
    dayId: clamp(Math.round(finiteOr(s?.dayId, 1)), 1, 7),
    // Left as-is when unusable: repairRouteDurations below recomputes it from
    // the airports and the aircraft, which is better than a zero.
    durMin: Number.isFinite(Number(s?.durMin)) ? Number(s.durMin) : s?.durMin,
    turnoverMin: finiteOr(s?.turnoverMin, 0)
  };
}

/**
 * Recomputes any schedule leg whose duration is not a usable number.
 *
 * The schedule editor used to divide by `aircraft.speed`, a field that does not
 * exist, so every leg added there was stored as NaN. NaN then reached
 * getFlightTimeClass, which classified the route as ultra-long-haul and cut its
 * demand to 40%. The code path is fixed, but saves written before that still
 * carry the bad legs, so they are repaired on load rather than left to rot.
 */
export function repairRouteDurations(loadedRoutes: any[], loadedFleet: any[]): any[] {
  if (!Array.isArray(loadedRoutes)) return [];
  const byRegistration = new Map<string, any>();
  (loadedFleet || []).forEach(p => byRegistration.set(p.registration, p));

  return loadedRoutes.map(route => {
    if (!Array.isArray(route?.schedule)) return route;
    const broken = route.schedule.some((s: any) => !Number.isFinite(Number(s?.durMin)));
    if (!broken) return route;

    const plane = byRegistration.get(route.aircraft);
    const repaired = getFlightDurationMinutes(
      airportsMapAdjusted.get(route.origin),
      airportsMapAdjusted.get(route.destination),
      plane
    );

    return {
      ...route,
      durMin: Number.isFinite(Number(route.durMin)) ? route.durMin : repaired,
      schedule: route.schedule.map((s: any) =>
        Number.isFinite(Number(s?.durMin)) ? s : { ...s, durMin: repaired }
      )
    };
  });
}

export function migrateRoutes(routes: unknown, fleet: any[]): any[] {
  const cleaned = asArray<any>(routes)
    .filter(r => r && typeof r === 'object' && r.id && r.origin && r.destination)
    .map(r => {
      // Older versions stored the whole engine result on each route.
      const slim = { ...r };
      for (const key of TRANSIENT_ROUTE_FIELDS) delete slim[key];
      return slim;
    })
    .map(r => ({
      ...r,
      distance: finiteOr(r.distance, 0),
      paxPerWeek: finiteOr(r.paxPerWeek, 0),
      weeklyFlights: finiteOr(r.weeklyFlights, Array.isArray(r.schedule) ? r.schedule.length : 0),
      durMin: Number.isFinite(Number(r.durMin)) ? Number(r.durMin) : r.durMin,
      turnoverMin: finiteOr(r.turnoverMin, 0),
      schedule: asArray<any>(r.schedule).map(cleanTrip)
    }));
  return repairRouteDurations(cleaned, fleet);
}

function migrateInfrastructure(mgt: unknown): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [id, infra] of Object.entries(asObject<Record<string, any>>(mgt, {}))) {
    if (!infra || typeof infra !== 'object') continue;
    const slots = asObject<any>(infra.slots, {});
    const stands = asObject<any>(infra.stands, {});
    const desks = asObject<any>(infra.desks, {});
    out[id] = {
      ...infra,
      level: clamp(Math.round(finiteOr(infra.level, 0)), 0, 3),
      slots: {
        regional: finiteOr(slots.regional, 0),
        narrowbody: finiteOr(slots.narrowbody, 0),
        widebody: finiteOr(slots.widebody, 0)
      },
      stands: {
        ...stands,
        regional: finiteOr(stands.regional, 0),
        narrowbody: finiteOr(stands.narrowbody, 0),
        widebody: finiteOr(stands.widebody, 0)
      },
      desks: { normal: finiteOr(desks.normal, 0), self: finiteOr(desks.self, 0) }
    };
  }
  return out;
}

function migrateAiAirlines(ais: unknown): any[] | null {
  if (!Array.isArray(ais)) return null;
  return ais.map((ai: any, idx: number) => {
    const personality = ai?.personality || PERSONALITIES[idx % PERSONALITIES.length];
    return {
      ...ai,
      personality,
      aggression: ai?.aggression ?? AGGRESSION[personality] ?? 5,
      capital: finiteOr(ai?.capital, 0),
      fleet: asArray<any>(ai?.fleet),
      routes: asArray<any>(ai?.routes).map((r: any) => ({ ...r, monthlyProfit: finiteOr(r?.monthlyProfit, 0) })),
      monthlyProfitsHistory: asArray<number>(ai?.monthlyProfitsHistory).filter(v => Number.isFinite(v))
    };
  });
}

function migrateMessages(messages: unknown): any[] {
  const list = asArray<any>(messages).filter(m => m && typeof m.text === 'string');
  if (list.length === 0) return [createWelcomeMessage()];
  // Duplicate ids came from the old id scheme; give later duplicates fresh ones.
  const seen = new Set<number>();
  let maxId = list.reduce((m, x) => (Number.isFinite(x.id) ? Math.max(m, x.id) : m), 0);
  const unique = list.map(m => {
    if (!Number.isFinite(m.id) || seen.has(m.id)) {
      maxId += 1;
      seen.add(maxId);
      return { ...m, id: maxId };
    }
    seen.add(m.id);
    return m;
  });
  return capMessages(unique);
}

/**
 * Returns a normalised copy of a savegame. The input is never modified.
 * `aiAirlines` is null when the save predates rival airlines, so the caller can
 * generate them.
 */
export function migrateSave(raw: any): any {
  if (!raw || typeof raw !== 'object') throw new Error('Savegame is empty or not an object');

  const fleet = asArray<any>(raw.fleet).filter(p => p && p.registration).map(migratePlane);
  const routes = migrateRoutes(raw.routes, fleet);
  const droppedRoutes = asArray(raw.routes).length - routes.length;
  if (droppedRoutes > 0) logWarn('saves', `Dropped ${droppedRoutes} unusable route(s) while loading`);

  const startDateOffset = Math.max(0, Math.round(finiteOr(raw.startDateOffset, 0)));
  const migrated = {
    ...raw,
    saveVersion: SAVE_VERSION,
    airlineName: typeof raw.airlineName === 'string' ? raw.airlineName : '',
    airlineCode: typeof raw.airlineCode === 'string' ? raw.airlineCode : '',
    selectedHub: typeof raw.selectedHub === 'string' && raw.selectedHub ? raw.selectedHub : 'FRA',
    difficulty: ['Easy', 'Normal', 'Hard'].includes(raw.difficulty) ? raw.difficulty : 'Normal',
    aiDifficulty: ['Easy', 'Normal', 'Hard'].includes(raw.aiDifficulty) ? raw.aiDifficulty : 'Normal',
    capital: finiteOr(raw.capital, 0),
    fleet,
    routes,
    aiAirlinesCount: finiteOr(raw.aiAirlinesCount, 6),
    aiAirlines: migrateAiAirlines(raw.aiAirlines),
    pendingSlotBills: finiteOr(raw.pendingSlotBills, 0),
    monthlyCapex: asArray<any>(raw.monthlyCapex).filter(c => c && Number.isFinite(c.amount)),
    reportHistory: asArray<any>(raw.reportHistory).filter(r => r && typeof r === 'object'),
    eventChoices: asObject<Record<string, string>>(raw.eventChoices, {}),
    reputation: clamp(finiteOr(raw.reputation, 50), 0, 100),
    milestones: asArray<string>(raw.milestones).filter(m => typeof m === 'string'),
    profitStreak: Math.max(0, finiteOr(raw.profitStreak, 0)),
    annualGoal: raw.annualGoal && Number.isFinite(raw.annualGoal.year) && Number.isFinite(raw.annualGoal.targetProfit)
      ? raw.annualGoal
      : null,
    startDateOffset,
    currentDateOffset: Math.max(startDateOffset, Math.round(finiteOr(raw.currentDateOffset, startDateOffset))),
    airportManagement: migrateInfrastructure(raw.airportManagement),
    messages: migrateMessages(raw.messages),
    randomEvents: asArray<any>(raw.randomEvents).filter(ev =>
      ev && Number.isFinite(ev.startOffset) && Number.isFinite(ev.duration) &&
      Number.isFinite(ev.demandMultiplier) && Number.isFinite(ev.fuelMultiplier)
    )
  };

  if ((raw.saveVersion ?? 1) < SAVE_VERSION) {
    logWarn('saves', `Migrated savegame from version ${raw.saveVersion ?? 1} to ${SAVE_VERSION}`);
  }
  return migrated;
}
