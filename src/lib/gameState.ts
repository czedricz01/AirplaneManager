/**
 * The per-game systems added with save version 3, and the one object through
 * which everything that applies only to the player reaches the economy.
 *
 * Marketing, staff morale, strikes, disruptions and connecting passengers all
 * change what a player route earns, but must never touch the AI airlines,
 * which price their routes with the same engine. Rather than grow
 * calculateRouteFinancials by a parameter per system, each of them contributes
 * to one PlayerModifiers object, built here by a pure function. The route
 * list, the planner's preview and the monthly report all pass that same
 * object, so a forecast and the month it forecasts cannot disagree.
 */
import { MAP_YELLOW } from './theme';
import { getActiveEvents, eventKey } from './eventSystem';
import { regionOf } from './geoUtils';
import { ffpLoyaltyBonus, regionDemandFactors } from './marketing';

/** The coarse regions of the world the game tells apart. See regionOf. */
export type RegionId = 'EU' | 'NA' | 'SA' | 'AF' | 'AS' | 'OC';

export const REGION_IDS: readonly RegionId[] = ['EU', 'NA', 'SA', 'AF', 'AS', 'OC'];

// --- Per-game state -----------------------------------------------------------

/** How the player's airline looks on the map and in the interface. */
export interface Branding {
  /** A #RRGGBB colour. */
  color: string;
  /** 'initials' for the airline code, otherwise the name of a Lucide icon. */
  icon: string;
}

/** The yellow every airline was drawn in before it could choose a colour. */
export const DEFAULT_BRANDING: Branding = { color: MAP_YELLOW, icon: 'initials' };

export type CampaignTier = 'local' | 'national' | 'global';

export const CAMPAIGN_TIERS: readonly CampaignTier[] = ['local', 'national', 'global'];

/** One advertising campaign. See marketing.ts for what each tier does. */
export interface Campaign {
  id: string;
  tier: CampaignTier;
  /** The region it runs in; a global campaign runs in all of them and keeps this only for the record. */
  region: RegionId;
  /** Month offset it started. */
  startOffset: number;
  /** How many months it runs; it ends by itself after that. */
  duration: number;
}

export interface Marketing {
  campaigns: Campaign[];
  /** Whether the frequent-flyer programme is running. */
  ffpActive: boolean;
  /** Month offset the programme started, null while it is not running. */
  ffpSinceOffset: number | null;
}

export const DEFAULT_MARKETING: Marketing = { campaigns: [], ffpActive: false, ffpSinceOffset: null };

export interface Strike {
  /** Month offset the strike was called. */
  startOffset: number;
  /** Share of the player's flights it cancels, 0-1. */
  cancelShare: number;
}

export interface Staff {
  /** Pay as a percentage of the market wage; 100 is the market rate. */
  salaryPct: number;
  /** 0-100. Moves slowly towards what the pay and the airline's fortunes justify. */
  morale: number;
  strike: Strike | null;
}

export const DEFAULT_STAFF: Staff = { salaryPct: 100, morale: 70, strike: null };

/** The range pay can be set in, as a percentage of the market wage. */
export const SALARY_PCT_MIN = 80;
export const SALARY_PCT_MAX = 130;

export type DisruptionKind = 'technical' | 'birdstrike' | 'airport-strike' | 'weather';

export const DISRUPTION_KINDS: readonly DisruptionKind[] = ['technical', 'birdstrike', 'airport-strike', 'weather'];

/** Something that cancels part of the player's flights for one month. */
export interface Disruption {
  id: string;
  kind: DisruptionKind;
  /** The month offset whose flights it cancels. */
  offset: number;
  /** The player routes it hits. */
  routeIds: string[];
  /** Share of each hit route's flights cancelled, 0-1. */
  cancelShare: number;
  /** What it is attached to, for messages: an airport id or a region. */
  ref?: string;
}

export type GameDecisionKind = 'strike' | 'disruption';

export const GAME_DECISION_KINDS: readonly GameDecisionKind[] = ['strike', 'disruption'];

export interface GameDecisionOption {
  id: string;
  label: string;
  detail: string;
  /** Charged once, when the option is taken. */
  cost: number;
}

/**
 * A question put to the player in a dialog, for anything that is not a world
 * event (those carry their own EventChoice list). Queued in pendingDecisions,
 * answered one at a time, and dispatched on `kind` once answered.
 *
 * At least one option costs nothing, so a player short of cash is never left
 * with a dialog they cannot answer; ensureFreeOption sees to that.
 */
export interface GameDecision {
  id: string;
  kind: GameDecisionKind;
  title: string;
  description: string;
  options: GameDecisionOption[];
  /** What the decision is about -- a route, a disruption -- for its handler. */
  ref?: string;
}

/**
 * The id of the option ensureFreeOption adds. A decision handler receiving it
 * applies whatever doing nothing means for its kind.
 */
export const FREE_OPTION_ID = 'no-action';

/**
 * The decision with an option that costs nothing, adding "Take no action" when
 * every option has a price. The dialog disables what the player cannot pay
 * for and cannot be closed, so a question with only paid answers would lock a
 * player short of cash out of the game. Every decision passes through here
 * when it is queued and when it is loaded.
 */
export function ensureFreeOption(decision: GameDecision): GameDecision {
  if (decision.options.some(o => !(o.cost > 0))) return decision;
  const taken = new Set(decision.options.map(o => o.id));
  let id = FREE_OPTION_ID;
  for (let n = 2; taken.has(id); n++) id = `${FREE_OPTION_ID}-${n}`;
  return {
    ...decision,
    options: [
      ...decision.options,
      { id, label: 'Take no action', detail: 'Spend nothing and let events run their course.', cost: 0 }
    ]
  };
}

/** The scenario a game was started from. Null for a free game. */
export interface ScenarioState {
  id: string;
}

export type ChronicleKind = 'milestone' | 'goal' | 'crisis' | 'strike' | 'disruption' | 'record';

/** One line in the airline's history. */
export interface ChronicleEntry {
  offset: number;
  kind: ChronicleKind;
  text: string;
}

export const CHRONICLE_KINDS: readonly ChronicleKind[] = ['milestone', 'goal', 'crisis', 'strike', 'disruption', 'record'];

/** Oldest entries go first; sixty years of history fit comfortably. */
export const CHRONICLE_LIMIT = 300;

/** Everything above, as it is saved, loaded and reset together. */
export interface GameSystems {
  branding: Branding;
  marketing: Marketing;
  staff: Staff;
  disruptions: Disruption[];
  pendingDecisions: GameDecision[];
  scenario: ScenarioState | null;
  chronicle: ChronicleEntry[];
  /** Index of the tutorial step on screen, null once it is finished or skipped. */
  tutorialStep: number | null;
}

/** A fresh set, sharing no objects with any other. */
export function createGameSystems(): GameSystems {
  return {
    branding: { ...DEFAULT_BRANDING },
    marketing: { ...DEFAULT_MARKETING, campaigns: [] },
    staff: { ...DEFAULT_STAFF },
    disruptions: [],
    pendingDecisions: [],
    scenario: null,
    chronicle: [],
    tutorialStep: null
  };
}

// --- Per-browser settings -----------------------------------------------------

/** Kept across games in this browser, like the autosave settings. */
export interface GameSettings {
  /** Show the newspaper after each month closes. */
  newspaper: boolean;
  /** Offer the tutorial when a new game starts. */
  tutorial: boolean;
  /** Colour the player's routes on the map by profit. */
  heatmap: boolean;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = { newspaper: true, tutorial: true, heatmap: false };

/** Stored settings with anything missing or not a boolean replaced by its default. */
export function normalizeGameSettings(raw: unknown): GameSettings {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const pick = (key: keyof GameSettings) =>
    typeof src[key] === 'boolean' ? (src[key] as boolean) : DEFAULT_GAME_SETTINGS[key];
  return { newspaper: pick('newspaper'), tutorial: pick('tutorial'), heatmap: pick('heatmap') };
}

// --- Player modifiers ---------------------------------------------------------

/**
 * Everything that applies to the player's routes and not to the AI airlines.
 * Every optional field is neutral when absent: a PlayerModifiers holding only
 * a demandFactor prices a route exactly as passing that factor on its own.
 */
export interface PlayerModifiers {
  /** Multiplies all of the player's demand: reputation times any crisis relief bought. */
  demandFactor: number;
  /** Extra demand per region, 1 = neutral. A route gets the mean of its two ends. */
  regionDemand?: Partial<Record<RegionId, number>>;
  /** Raises the player's appeal against rivals on a shared city pair: 0.1 = 10% more. */
  loyaltyBonus?: number;
  /** Satisfaction points added to every cabin class. */
  satDelta?: number;
  /** Multiplies crew and ground staff cost. */
  crewCostFactor?: number;
  /** Share of each route's flights that do not operate this month, by route id, 0-1. */
  cancelShare?: Record<string, number>;
  /** Connecting passengers and their revenue per week, by route id. */
  transfer?: Record<string, { pax: number; revenue: number }>;
}

/** A stable neutral default, so a missing prop does not invalidate memos on every render. */
export const NEUTRAL_PLAYER_MODIFIERS: PlayerModifiers = { demandFactor: 1 };

/**
 * What buildPlayerModifiers reads. An object, so each system adds its own
 * field here without touching the call sites of the others.
 */
export interface PlayerModifierState {
  reputation: number;
  /** Which choice was taken for each world event, keyed by eventKey. */
  eventChoices: Record<string, string>;
  /** Campaigns and the frequent-flyer programme; none when absent. */
  marketing?: Marketing;
}

/**
 * What reputation does to demand: a tenth either way. Small enough that a good
 * network still beats a good reputation, large enough to be worth protecting.
 */
export function reputationDemandFactor(reputation: number): number {
  return 0.85 + (Math.max(0, Math.min(100, reputation)) / 100) * 0.2;
}

/**
 * The correction that turns a crisis's raw demand hit into the softened one the
 * player paid for.
 *
 * calculateDemand has already applied the event's own multiplier via
 * getEventMultipliers, and that path is shared with the AI airlines. Rather
 * than fork it, the player's demand factor carries the ratio between the
 * softened multiplier and the raw one, so only the player sees the relief.
 */
export function eventReliefFactor(
  offset: number,
  choicesTaken: Record<string, string>
): number {
  let factor = 1;
  for (const ev of getActiveEvents(offset)) {
    const chosenId = choicesTaken[eventKey(ev)];
    if (!chosenId) continue;
    const choice = ev.choices?.find(c => c.id === chosenId);
    if (!choice?.softensDemand) continue;
    const raw = ev.demandMultiplier;
    if (raw >= 1) continue;
    const softened = raw + (1 - raw) * choice.softensDemand;
    factor *= softened / raw;
  }
  return factor;
}

/**
 * The player's modifiers for the month at `offset`. Pure: the same state and
 * month always give the same object contents.
 */
export function buildPlayerModifiers(state: PlayerModifierState, offset: number): PlayerModifiers {
  const mods: PlayerModifiers = {
    demandFactor: reputationDemandFactor(state.reputation) * eventReliefFactor(offset, state.eventChoices)
  };
  // Fields are only set when they do something, so an airline without any
  // marketing prices its routes exactly as before marketing existed.
  if (state.marketing) {
    const regionDemand = regionDemandFactors(state.marketing, offset);
    if (regionDemand) mods.regionDemand = regionDemand;
    const loyalty = ffpLoyaltyBonus(state.marketing, offset);
    if (loyalty > 0) mods.loyaltyBonus = loyalty;
  }
  return mods;
}

/**
 * The demand factor for one route: the airline-wide one times the mean of the
 * regional factors at its two ends.
 */
export function routeDemandFactor(
  mods: PlayerModifiers,
  origin?: { coords: [number, number] } | null,
  dest?: { coords: [number, number] } | null
): number {
  const regional = mods.regionDemand;
  if (!regional) return mods.demandFactor;
  const at = (airport?: { coords: [number, number] } | null) =>
    airport ? regional[regionOf(airport.coords)] ?? 1 : 1;
  return mods.demandFactor * ((at(origin) + at(dest)) / 2);
}
