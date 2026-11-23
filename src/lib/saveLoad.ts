import { finiteOr } from './invariants';
import { capMessages, createWelcomeMessage } from './messages';
import { trimChronicle } from './chronicle';
import { isHexColor } from './theme';
import { scenarioById } from '../data/scenarios';
import { clampRank, effectiveRank, normalizeMode } from './airlineRank';
import { normalizeGoal, normalizeOffer } from './annualGoals';
import { normalizeOrders } from './preorders';
import { normalizeResearch } from './research';
import { logWarn } from './debugLog';
import { aircraftList } from '../data/aircraft';
import {
  CAMPAIGN_TIERS,
  CHRONICLE_KINDS,
  CHRONICLE_LIMIT,
  DEFAULT_BRANDING,
  DEFAULT_STAFF,
  DISRUPTION_KINDS,
  GAME_DECISION_KINDS,
  REGION_IDS,
  SCENARIO_STATUSES,
  SALARY_PCT_MAX,
  SALARY_PCT_MIN,
  decisionTargetExists,
  ensureFreeOption,
  type Branding,
  type Career,
  type ChronicleEntry,
  type Disruption,
  type GameDecision,
  type Marketing,
  type ScenarioState,
  type Staff
} from './gameState';

/**
 * Loading a savegame.
 *
 * Only saves of the current version are loaded (E75): the rebuilt model keeps
 * its own state (`rivals`, `modelWorld`, `ledgerValues`) that older saves do not
 * have, and converting them was not worth it. An older save is refused with
 * `OutdatedSaveError`; the game then deletes it.
 *
 * A save of the current version is still checked field by field, because a
 * missing or broken number (`undefined`, NaN) would spread through every sum of
 * the economy. Every check here keeps the value when it is usable and puts in a
 * neutral one when it is not.
 */

/** Written into every new save. Raise it whenever the shape changes; older saves are then deleted on load. */
export const SAVE_VERSION = 8;

/** Thrown for a save written by an older version of the game. */
export class OutdatedSaveError extends Error {
  constructor(readonly version: number) {
    super(`Savegame version ${version} is older than ${SAVE_VERSION}`);
    this.name = 'OutdatedSaveError';
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const asObject = <T extends object>(v: unknown, fallback: T): T =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : fallback;
const isString = (v: unknown): v is string => typeof v === 'string';

function loadPlane(plane: any): any {
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
    generalChecksDone: finiteOr(plane?.generalChecksDone, 0),
    refitsDone: finiteOr(plane?.refitsDone, 0)
  };
}

function loadTrip(s: any) {
  return {
    ...s,
    startHour: finiteOr(s?.startHour, 12),
    startMin: finiteOr(s?.startMin, 0),
    dayId: clamp(Math.round(finiteOr(s?.dayId, 1)), 1, 7),
    durMin: finiteOr(s?.durMin, 0),
    turnoverMin: finiteOr(s?.turnoverMin, 0)
  };
}

function loadRoutes(routes: unknown): any[] {
  return asArray<any>(routes)
    .filter(r => r && typeof r === 'object' && r.id && r.origin && r.destination)
    .map(r => ({
      ...r,
      distance: finiteOr(r.distance, 0),
      paxPerWeek: finiteOr(r.paxPerWeek, 0),
      weeklyFlights: finiteOr(r.weeklyFlights, Array.isArray(r.schedule) ? r.schedule.length : 0),
      durMin: finiteOr(r.durMin, 0),
      turnoverMin: finiteOr(r.turnoverMin, 0),
      schedule: asArray<any>(r.schedule).map(loadTrip)
    }));
}

function loadInfrastructure(mgt: unknown): Record<string, any> {
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

function loadBranding(b: unknown): Branding {
  const src = asObject<any>(b, {});
  return {
    color: isHexColor(src.color) ? src.color : DEFAULT_BRANDING.color,
    icon: isString(src.icon) && src.icon ? src.icon : DEFAULT_BRANDING.icon
  };
}

/** Longest campaign a save may hold, in months; the game books at most 12. */
const MAX_CAMPAIGN_MONTHS = 120;

function loadMarketing(m: unknown, currentDateOffset: number): Marketing {
  const src = asObject<any>(m, {});
  const seen = new Set<string>();
  const campaigns = asArray<any>(src.campaigns)
    .filter(c => c && isString(c.id) && CAMPAIGN_TIERS.includes(c.tier) && REGION_IDS.includes(c.region))
    .map(c => ({
      ...c,
      startOffset: clamp(Math.round(finiteOr(c.startOffset, currentDateOffset)), 0, currentDateOffset),
      duration: clamp(Math.round(finiteOr(c.duration, 0)), 0, MAX_CAMPAIGN_MONTHS)
    }))
    // Over already: the month close would drop them.
    .filter(c => c.duration > 0 && c.startOffset + c.duration > currentDateOffset)
    // Cancelling works by id, so two with one id would go together.
    .filter(c => !seen.has(c.id) && !!seen.add(c.id));
  const ffpActive = src.ffpActive === true;
  const since = typeof src.ffpSinceOffset === 'number' ? src.ffpSinceOffset : NaN;
  return {
    campaigns,
    ffpActive,
    ffpSinceOffset: ffpActive ? clamp(Math.round(finiteOr(since, currentDateOffset)), 0, currentDateOffset) : null
  };
}

/**
 * Strikes and disruptions are rolled at a month's close for the month about to
 * start: a save never holds one dated after its current month. One that does
 * would block every strike until then, so it is dropped.
 */
function loadStaff(s: unknown, currentDateOffset: number): Staff {
  const src = asObject<any>(s, {});
  const raw = src.strike;
  const strike = raw && typeof raw === 'object' && Number.isFinite(raw.startOffset) && Math.round(raw.startOffset) <= currentDateOffset
    ? {
        ...raw,
        startOffset: Math.max(0, Math.round(raw.startOffset)),
        cancelShare: clamp(finiteOr(raw.cancelShare, 0), 0, 1),
        agreedPct: Number.isFinite(raw.agreedPct) ? clamp(raw.agreedPct, SALARY_PCT_MIN, SALARY_PCT_MAX) : undefined
      }
    : null;
  if (strike && strike.agreedPct === undefined) delete strike.agreedPct;
  return {
    salaryPct: clamp(finiteOr(src.salaryPct, DEFAULT_STAFF.salaryPct), SALARY_PCT_MIN, SALARY_PCT_MAX),
    morale: clamp(finiteOr(src.morale, DEFAULT_STAFF.morale), 0, 100),
    strike
  };
}

function loadDisruptions(list: unknown, currentDateOffset: number): Disruption[] {
  return asArray<any>(list)
    .filter(d => d && isString(d.id) && DISRUPTION_KINDS.includes(d.kind) && Number.isFinite(d.offset))
    .filter(d => Math.round(d.offset) <= currentDateOffset)
    .map(d => {
      const { mitigated, ...rest } = d;
      return {
        ...rest,
        offset: Math.round(d.offset),
        routeIds: asArray<unknown>(d.routeIds).filter(isString),
        cancelShare: clamp(finiteOr(d.cancelShare, 0), 0, 1),
        ...(mitigated === true ? { mitigated: true } : {})
      };
    });
}

function loadDecisions(list: unknown): GameDecision[] {
  return asArray<any>(list)
    .filter(d => d && isString(d.id) && GAME_DECISION_KINDS.includes(d.kind) && isString(d.title))
    .map(d => ({
      ...d,
      description: isString(d.description) ? d.description : '',
      options: asArray<any>(d.options)
        .filter(o => o && isString(o.id) && isString(o.label))
        .map(o => ({ ...o, detail: isString(o.detail) ? o.detail : '', cost: Math.max(0, finiteOr(o.cost, 0)) }))
    }))
    // A question with nothing to answer would block the game, and so would
    // one whose every answer costs more than the player has.
    .filter(d => d.options.length > 0)
    .map(ensureFreeOption);
}

function loadChronicle(list: unknown): ChronicleEntry[] {
  const entries: ChronicleEntry[] = asArray<any>(list)
    .filter(e => e && Number.isFinite(e.offset) && CHRONICLE_KINDS.includes(e.kind) && isString(e.text))
    .map(e => ({
      offset: e.offset,
      kind: e.kind,
      text: e.text,
      ...(isString(e.key) && e.key ? { key: e.key } : {}),
      ...(Number.isFinite(e.value) ? { value: e.value } : {})
    }));
  return trimChronicle(entries, CHRONICLE_LIMIT);
}

const KNOWN_AIRCRAFT = new Set(aircraftList.map(a => a.id));

function loadCareer(raw: unknown): Career {
  const src = asObject<any>(raw, {});
  const usedSold = asObject<any>(src.usedSold, {});
  const mode = normalizeMode(src.mode);
  return {
    mode,
    rank: effectiveRank(mode, clampRank(src.rank)),
    careerPax: Math.max(0, finiteOr(src.careerPax, 0)),
    goalOffer: normalizeOffer(src.goalOffer),
    takeovers: Math.max(0, Math.round(finiteOr(src.takeovers, 0))),
    orders: normalizeOrders(src.orders, id => KNOWN_AIRCRAFT.has(id)),
    research: normalizeResearch(src.research),
    usedSold: {
      offset: Number.isFinite(usedSold.offset) ? Math.round(usedSold.offset) : -1,
      ids: asArray<unknown>(usedSold.ids).filter(isString)
    }
  };
}

/** A scenario game's state. One whose scenario the game no longer knows is played on as a free game. */
function loadScenario(s: unknown, startDateOffset: number, currentDateOffset: number): ScenarioState | null {
  const src = asObject<any>(s, {});
  if (!isString(src.id) || !src.id) return null;
  if (!scenarioById(src.id)) {
    logWarn('saves', `Unknown scenario "${src.id}"; the game continues as free play`);
    return null;
  }
  const status = SCENARIO_STATUSES.includes(src.status) ? src.status : 'running';
  const startedOffset = clamp(Math.round(finiteOr(src.startedOffset, startDateOffset)), 0, currentDateOffset);
  const rawResult = asObject<any>(src.result, {});
  const result = status !== 'running' && Number.isFinite(rawResult.offset)
    ? { offset: Math.round(rawResult.offset), reason: isString(rawResult.reason) ? rawResult.reason : '' }
    : undefined;
  const floorStreak = Number.isFinite(src.floorStreak) ? Math.max(0, Math.round(src.floorStreak)) : undefined;
  const met = Array.isArray(src.met) ? src.met.filter(isString) : undefined;
  return {
    id: src.id,
    startedOffset,
    status,
    ...(result ? { result } : {}),
    ...(floorStreak !== undefined ? { floorStreak } : {}),
    ...(met ? { met } : {}),
  };
}

function loadMessages(messages: unknown): any[] {
  const list = asArray<any>(messages).filter(m => m && typeof m.text === 'string' && Number.isFinite(m.id));
  return list.length === 0 ? [createWelcomeMessage()] : capMessages(list);
}

/**
 * Returns a checked copy of a savegame of the current version. The input is
 * never modified. Throws `OutdatedSaveError` for a save of an older version and
 * a plain error for anything else that cannot be loaded.
 */
export function loadSave(raw: any): any {
  if (!raw || typeof raw !== 'object') throw new Error('Savegame is empty or not an object');
  const version = Number.isFinite(raw.saveVersion) ? raw.saveVersion : 1;
  if (version < SAVE_VERSION) throw new OutdatedSaveError(version);
  if (version > SAVE_VERSION) throw new Error(`Savegame version ${version} is newer than this game (${SAVE_VERSION})`);

  const fleet = asArray<any>(raw.fleet).filter(p => p && p.registration).map(loadPlane);
  const routes = loadRoutes(raw.routes);
  const droppedRoutes = asArray(raw.routes).length - routes.length;
  if (droppedRoutes > 0) logWarn('saves', `Dropped ${droppedRoutes} unusable route(s) while loading`);

  const startDateOffset = Math.max(0, Math.round(finiteOr(raw.startDateOffset, 0)));
  const currentDateOffset = Math.max(startDateOffset, Math.round(finiteOr(raw.currentDateOffset, startDateOffset)));
  const staff = loadStaff(raw.staff, currentDateOffset);
  const disruptions = loadDisruptions(raw.disruptions, currentDateOffset);
  return {
    ...raw,
    saveVersion: SAVE_VERSION,
    airlineName: isString(raw.airlineName) ? raw.airlineName : '',
    airlineCode: isString(raw.airlineCode) ? raw.airlineCode : '',
    selectedHub: isString(raw.selectedHub) && raw.selectedHub ? raw.selectedHub : 'FRA',
    difficulty: ['Easy', 'Normal', 'Hard'].includes(raw.difficulty) ? raw.difficulty : 'Normal',
    aiDifficulty: ['Easy', 'Normal', 'Hard'].includes(raw.aiDifficulty) ? raw.aiDifficulty : 'Normal',
    capital: finiteOr(raw.capital, 0),
    fleet,
    routes,
    aiAirlinesCount: finiteOr(raw.aiAirlinesCount, 6),
    aiAirlines: asArray<any>(raw.aiAirlines),
    monthlyCapex: asArray<any>(raw.monthlyCapex).filter(c => c && Number.isFinite(c.amount)),
    reportHistory: asArray<any>(raw.reportHistory).filter(r => r && typeof r === 'object'),
    eventChoices: asObject<Record<string, string>>(raw.eventChoices, {}),
    reputation: clamp(finiteOr(raw.reputation, 50), 0, 100),
    milestones: asArray<unknown>(raw.milestones).filter(isString),
    profitStreak: Math.max(0, finiteOr(raw.profitStreak, 0)),
    annualGoal: normalizeGoal(raw.annualGoal),
    startDateOffset,
    currentDateOffset,
    airportManagement: loadInfrastructure(raw.airportManagement),
    messages: loadMessages(raw.messages),
    randomEvents: asArray<any>(raw.randomEvents).filter(ev =>
      ev && Number.isFinite(ev.startOffset) && Number.isFinite(ev.duration) &&
      Number.isFinite(ev.demandMultiplier) && Number.isFinite(ev.fuelMultiplier)
    ),
    branding: loadBranding(raw.branding),
    marketing: loadMarketing(raw.marketing, currentDateOffset),
    staff,
    disruptions,
    // A question about a strike or disruption the save no longer holds would charge for nothing.
    pendingDecisions: loadDecisions(raw.pendingDecisions).filter(d => decisionTargetExists(d, { staff, disruptions })),
    scenario: loadScenario(raw.scenario, startDateOffset, currentDateOffset),
    career: loadCareer(raw.career),
    chronicle: loadChronicle(raw.chronicle),
    tutorialStep: Number.isFinite(raw.tutorialStep) ? Math.max(0, Math.round(raw.tutorialStep)) : null
  };
}
