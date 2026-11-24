/**
 * The per-game systems added with save version 3 (marketing, staff,
 * disruptions, questions, scenario, career) as the interface stores them.
 *
 * What they do to the month is the model's (`src/model/`); the views reach it
 * through the bridges in `src/lib/model*.ts`. The old `buildPlayerModifiers`
 * was removed in 5.2b.
 */
import { MAP_YELLOW } from './theme';
import type { GoalOffer } from './annualGoals';
import type { PreOrder } from './preorders';
import type { ResearchState } from './research';
import type { GameMode } from './airlineRank';

export { SALARY_PCT_MIN, SALARY_PCT_MAX } from './staff';

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

/** A strike by the airline's staff. It grounds flights in one month only. See staff.ts. */
export interface Strike {
  /** Month offset whose flights it cancels; the month after the one it was called in. */
  startOffset: number;
  /** Share of every one of the player's flights it cancels, 0-1. */
  cancelShare: number;
  /**
   * The pay agreed to settle it, when the player raised pay. Pay may not
   * drop below it while the strike still weighs on morale (salaryFloor).
   */
  agreedPct?: number;
}

export interface Staff {
  /** Pay as a percentage of the market wage; 100 is the market rate. SALARY_PCT_MIN to SALARY_PCT_MAX. */
  salaryPct: number;
  /** 0-100. Moves slowly towards what the pay and the airline's fortunes justify. */
  morale: number;
  /**
   * The latest strike. Kept after its month is over, because it weighs on
   * morale for a while longer; only in its own month does it cancel flights.
   */
  strike: Strike | null;
}

export const DEFAULT_STAFF: Staff = { salaryPct: 100, morale: 70, strike: null };

export type DisruptionKind = 'technical' | 'airport-strike' | 'weather';

export const DISRUPTION_KINDS: readonly DisruptionKind[] = ['technical', 'airport-strike', 'weather'];

/** Something that cancels part of the player's flights for one month. See disruptions.ts. */
export interface Disruption {
  id: string;
  kind: DisruptionKind;
  /** The month offset whose flights it cancels. */
  offset: number;
  /** The player routes it hits. */
  routeIds: string[];
  /** Share of each hit route's flights cancelled, 0-1. */
  cancelShare: number;
  /** What it is attached to, for messages: an aircraft registration, an airport id or a region. */
  ref?: string;
  /** A chartered replacement aircraft flies the cancelled flights: nothing is cancelled. */
  mitigated?: boolean;
}

/**
 * Something that cost the player flights or money in a closed month, as the
 * monthly report lists it under `incidents`.
 */
export interface ReportIncident {
  kind: 'strike' | DisruptionKind;
  title: string;
  /** Where it hit: routes, an airport, a region. */
  detail: string;
  /** Share of the hit routes' flights cancelled, 0-1; 0 when a replacement flew them. */
  cancelShare: number;
  /** How many of the player's routes it hit. */
  routeCount: number;
  /** A chartered replacement aircraft flew the cancelled flights. */
  mitigated?: boolean;
  /** For a chartered one the charter, charged in the month, in dollars. Older reports also list repair bills here. */
  cost?: number;
}

/** Why part of a route's flights do not operate in a month, for the route screens. */
export interface RouteCancellation {
  /** The combined share cancelled, 0-1, as the engine applies it. */
  share: number;
  /** One short line per cause, e.g. "Staff strike". */
  reasons: string[];
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
 * Whether what a decision asks about still exists: a strike question needs
 * that strike to be the current one, a disruption question its disruption
 * still on the books. Answering one that no longer does would charge for
 * nothing; a load drops them.
 */
export function decisionTargetExists(
  decision: Pick<GameDecision, 'kind' | 'ref'>,
  state: { staff: Pick<Staff, 'strike'>; disruptions: Pick<Disruption, 'id'>[] }
): boolean {
  switch (decision.kind) {
    case 'strike':
      return !!state.staff.strike && String(state.staff.strike.startOffset) === decision.ref;
    case 'disruption':
      return state.disruptions.some(d => d.id === decision.ref);
  }
  return true;
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

/** How a scenario stands; see scenarioEval.ts. */
export type ScenarioStatus = 'running' | 'won' | 'lost';

export const SCENARIO_STATUSES: readonly ScenarioStatus[] = ['running', 'won', 'lost'];

/**
 * The scenario a game was started from (src/data/scenarios.ts). Null for a
 * free game. Once won or lost it stays so: the game carries on as free play
 * and is no longer judged.
 */
export interface ScenarioState {
  id: string;
  /** The month the scenario started. */
  startedOffset: number;
  status: ScenarioStatus;
  /** When and why it was decided; absent while running. */
  result?: { offset: number; reason: string };
  /** Month-ends in a row below the credit line (model 8.15); absent = 0. Written by the model bridge. */
  floorStreak?: number;
  /** Ids of the win goals already met (model 8.15); absent = none. Written by the model bridge. */
  met?: string[];
}

/**
 * What a chronicle entry is about. 'crisis' covers every world event, good
 * news as well as bad; 'network' the firsts of the route map (a new region, a
 * new transfer hub); 'finance' the lows (capital below zero); 'scenario' the
 * start and the result of a scenario.
 */
export type ChronicleKind = 'milestone' | 'goal' | 'crisis' | 'strike' | 'disruption' | 'record' | 'network' | 'finance' | 'scenario';

/** One line in the airline's history. See chronicle.ts for what is written when. */
export interface ChronicleEntry {
  offset: number;
  kind: ChronicleKind;
  text: string;
  /**
   * What the entry is about, for entries that must not repeat: 'region:NA'
   * is written once, 'record:profit' each time the record moves. The newest
   * entry of every key survives trimming, so the chronicle itself remembers
   * what it has already said.
   */
  key?: string;
  /** The figure behind a record entry, which the next record has to beat. */
  value?: number;
}

export const CHRONICLE_KINDS: readonly ChronicleKind[] = ['milestone', 'goal', 'crisis', 'strike', 'disruption', 'record', 'network', 'finance', 'scenario'];

/** Oldest entries go first; sixty years of history fit comfortably. */
export const CHRONICLE_LIMIT = 300;

/**
 * How the airline has grown: its rank (which never falls), the passengers it
 * has carried over its whole career, and the annual goals the board has put
 * to it but the player has not yet answered. See airlineRank.ts and
 * annualGoals.ts.
 */
export interface Career {
  /** Normal Mode climbs the rank ladder; Free Mode is a Global Player from the start. */
  mode: GameMode;
  /** Index into RANKS; the top one in Free Mode. */
  rank: number;
  /** Passengers carried since the first month, every leg counted. */
  careerPax: number;
  /** The goals on offer for the coming year, until one is chosen. */
  goalOffer: GoalOffer | null;
  /** Rival airlines bought so far. */
  takeovers: number;
  /** Aircraft ordered ahead of delivery; see preorders.ts. */
  orders: PreOrder[];
  /** Development projects finished and under way; see research.ts. */
  research: ResearchState;
  /** The used-market listings bought in the month `offset`, so a reload does not list them again. */
  usedSold: { offset: number; ids: string[] };
}

export const DEFAULT_CAREER: Career = { mode: 'normal', rank: 0, careerPax: 0, goalOffer: null, takeovers: 0, orders: [], research: { done: [], active: [] }, usedSold: { offset: -1, ids: [] } };

/** Everything above, as it is saved, loaded and reset together. */
export interface GameSystems {
  branding: Branding;
  marketing: Marketing;
  staff: Staff;
  disruptions: Disruption[];
  pendingDecisions: GameDecision[];
  scenario: ScenarioState | null;
  chronicle: ChronicleEntry[];
  career: Career;
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
    career: { ...DEFAULT_CAREER, orders: [], research: { done: [], active: [] }, usedSold: { offset: -1, ids: [] } },
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

