/**
 * Scenarios: a start, a deadline and a goal.
 *
 * A free game has no end; a scenario sets the date, the hub, the money and the
 * aircraft, and asks for one thing by a deadline. scenarioEval.ts judges a
 * game against it at every month's close. There is no loan system in the
 * game, so an airline "in debt" is simply one that starts short of cash.
 *
 * The numbers were checked against the finance engine itself, with a greedy
 * simulated player flying the starting fleet (see the notes on each). They
 * assume a player who fits a proper cabin -- the aircraft arrive with the
 * all-economy layout the purchase screen offers by default, and a refit costs
 * about $1,000 a seat -- and who picks good routes. A player who does neither
 * falls well short, which is the point.
 */

/** The game's and the rivals' difficulty settings. */
export type Difficulty = 'Easy' | 'Normal' | 'Hard';

/** Months are offsets from January 1960, as everywhere in the game. */
const at = (year: number, month: number) => (year - 1960) * 12 + (month - 1);

/** What a goal measures, as scenarioEval reads it from the month's close. */
export type GoalMetric =
  /** Cash at the month's end, as the top bar shows it. */
  | 'capital'
  /** Routes flown, optionally only those with at least `minWeeklyFlights` departures a week. */
  | 'routes'
  | 'reputation'
  /** World regions the network touches, the hub's own included. */
  | 'regions'
  /** Passengers who changed planes at one of the player's airports in the month, each counted once. */
  | 'transferPax'
  /** The month's operating profit. */
  | 'monthlyProfit';

/**
 * Something to reach. By default it is met at the first month's close that
 * reaches it; `atDeadline` goals only count at the deadline's close, so a
 * scenario with one cannot be won early.
 */
export interface TargetGoal {
  id: string;
  kind: 'target';
  metric: GoalMetric;
  target: number;
  label: string;
  atDeadline?: boolean;
  /** For 'routes': only routes with at least this many departures a week count. */
  minWeeklyFlights?: number;
}

/**
 * Bankruptcy: capital below `threshold` at `months` month-ends in a row loses
 * the scenario at once. `months: 1` means capital may never drop below it.
 */
export interface CapitalFloorGoal {
  id: string;
  kind: 'capitalFloor';
  threshold: number;
  months: number;
  label: string;
}

export type WinGoal = TargetGoal;
export type LoseGoal = CapitalFloorGoal;

export type ScenarioRating = 'Moderate' | 'Hard' | 'Expert';

export interface ScenarioFleetEntry {
  /** An id from aircraftList. */
  model: string;
  count: number;
  /** How long the airline has had them, in months; 0 for new aircraft. */
  ageMonths?: number;
  /** Airframe and cabin condition, 0-100; 100 when new. */
  condition?: number;
}

export interface Scenario {
  id: string;
  title: string;
  /** One line under the title. */
  tagline: string;
  /** A short paragraph setting the scene, for the card and the briefing. */
  blurb: string;
  rating: ScenarioRating;
  /** The first month, as an offset from 01/1960. */
  startOffset: number;
  /** The last month whose close counts: the scenario is decided at its close at the latest. */
  deadlineOffset: number;
  hub: string;
  capital: number;
  fleet: ScenarioFleetEntry[];
  /** The game's own difficulty (fuel prices, demand). */
  difficulty: Difficulty;
  rivals: { count: number; difficulty: Difficulty };
  win: WinGoal[];
  lose: LoseGoal[];
}

/** The usual way to lose: three month-ends in a row more than $5M in the red. */
const BANKRUPTCY: CapitalFloorGoal = {
  id: 'bankruptcy',
  kind: 'capitalFloor',
  threshold: -5_000_000,
  months: 3,
  label: 'Capital below -$5M at three month-ends in a row means bankruptcy'
};

export const SCENARIOS: readonly Scenario[] = [
  {
    // Simulated: the three aircraft refitted and put on the best routes from
    // Frankfurt earn about $2.5M a month and pass $100M in early 1963, with
    // no aircraft bought. Left in the all-economy cabin, the same fleet ends
    // 1964 near $25M.
    id: 'jet-age',
    title: 'Jet Age',
    tagline: 'Frankfurt, 1960',
    blurb:
      'The first jets are arriving and the board has bet the company on them: one Boeing 707 and two Caravelles, ' +
      'and not much cash besides. Turn them into a fortune before the decade is half over.',
    rating: 'Moderate',
    startOffset: at(1960, 1),
    deadlineOffset: at(1964, 12),
    hub: 'FRA',
    capital: 12_000_000,
    fleet: [
      { model: '707-420', count: 1 },
      { model: 'caravelle-iii', count: 2 }
    ],
    difficulty: 'Normal',
    rivals: { count: 5, difficulty: 'Normal' },
    win: [
      { id: 'capital', kind: 'target', metric: 'capital', target: 100_000_000, label: 'Capital of $100M' }
    ],
    lose: [BANKRUPTCY]
  },
  {
    // The 1973 oil crisis is on from the first month: fuel doubles and demand
    // drops by a tenth for 18 months. Simulated, the four ageing jets in an
    // all-economy cabin find no profitable route at all while it lasts; with
    // a refitted cabin two of them earn about $0.3M a month through the
    // crisis and $0.75M after it, and cash never drops below about $5.7M.
    id: 'oil-shock',
    title: 'Oil Shock',
    tagline: 'London, October 1973',
    blurb:
      'The embargo has begun and fuel is about to double. Your fleet of thirsty, ageing jets was bought for cheap oil. ' +
      'Keep the airline solvent every single month and come out of the crisis with a name people trust.',
    rating: 'Hard',
    startOffset: at(1973, 10),
    deadlineOffset: at(1976, 12),
    hub: 'LHR',
    capital: 8_000_000,
    fleet: [
      { model: '707-320b', count: 2, ageMonths: 96, condition: 60 },
      { model: 'trident-2e', count: 2, ageMonths: 60, condition: 65 }
    ],
    difficulty: 'Normal',
    rivals: { count: 6, difficulty: 'Normal' },
    win: [
      { id: 'reputation', kind: 'target', metric: 'reputation', target: 60, atDeadline: true, label: 'Reputation of 60 or more at the deadline' }
    ],
    lose: [
      { id: 'solvent', kind: 'capitalFloor', threshold: 0, months: 1, label: 'Capital must never be below $0 at a month-end' }
    ]
  },
  {
    // From New York in 1978 a narrowbody with a proper cabin finds 40 or more
    // profitable destinations; 30 daily routes need roughly a dozen aircraft
    // and about $20M of slots, so the airline has to keep reinvesting through
    // the 1979 energy crisis. Only daily routes count: a weekly flight to
    // everywhere would otherwise meet the goal in a month.
    id: 'deregulation',
    title: 'Deregulation',
    tagline: 'New York, 1978',
    blurb:
      'Washington has thrown the skies open: any airline may now fly any route at any fare. ' +
      'Grab the map before the incumbents do, and stay profitable while you are at it.',
    rating: 'Hard',
    startOffset: at(1978, 1),
    deadlineOffset: at(1982, 12),
    hub: 'JFK',
    capital: 40_000_000,
    fleet: [
      { model: '727-200', count: 2 },
      { model: 'dc-9-30', count: 1 }
    ],
    difficulty: 'Normal',
    rivals: { count: 8, difficulty: 'Normal' },
    win: [
      { id: 'routes', kind: 'target', metric: 'routes', target: 30, minWeeklyFlights: 7, label: '30 routes with daily service' },
      { id: 'profit', kind: 'target', metric: 'monthlyProfit', target: 0, label: 'An operating profit in that same month' }
    ],
    lose: [BANKRUPTCY]
  },
  {
    // Measured on the transfer engine at Amsterdam in 1993 against six rivals:
    // nine spokes with banked timetables carry about 17,000 connecting
    // passengers a month, twelve about 23,000. Local passengers take the
    // seats first, so transfers also need spare capacity. 15,000 asks for a
    // real hub, not the whole of Europe.
    id: 'hub-builder',
    title: 'Hub Builder',
    tagline: 'Amsterdam, 1990',
    blurb:
      'Amsterdam wants to be the crossroads of Europe and has chosen you to make it happen. ' +
      'Time the waves of arrivals and departures so passengers change planes here instead of anywhere else.',
    rating: 'Expert',
    startOffset: at(1990, 1),
    deadlineOffset: at(1994, 12),
    hub: 'AMS',
    capital: 80_000_000,
    fleet: [
      { model: '737-400', count: 2 },
      { model: '767-300er', count: 1 }
    ],
    difficulty: 'Normal',
    rivals: { count: 6, difficulty: 'Normal' },
    win: [
      { id: 'transfer', kind: 'target', metric: 'transferPax', target: 15_000, label: '15,000 connecting passengers in a month' }
    ],
    lose: [BANKRUPTCY]
  }
];

export function scenarioById(id: string | null | undefined): Scenario | undefined {
  return id ? SCENARIOS.find(s => s.id === id) : undefined;
}
