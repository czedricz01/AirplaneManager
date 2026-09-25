/**
 * The Aviation Times: a newspaper page after every month close.
 *
 * It tells the month back as a story. The headline goes to the biggest news
 * in a fixed order,
 *
 *   scenario won or lost > world crisis > strike > disruption across routes
 *   (an airport strike, winter weather, anything hitting several routes) >
 *   milestone > record month (profit or loss) > disruption of one route (a
 *   technical defect) > rival expansion > good news from the world > filler
 *
 * and the columns underneath carry the airline's results, the markets, the
 * rivals and whatever else the month brought. A quiet month gets a filler
 * story from its era -- the jet age, jumbos, deregulation, alliances --
 * picked by the month, so the same month always prints the same paper.
 *
 * Everything here is pure and deterministic: no randomness, no clock. The
 * month close gathers the facts; buildEdition only writes them up.
 */
import type { ChronicleEntry, DisruptionKind, RegionId } from './gameState';
import { REGION_LABELS } from './marketing';
import { CALENDAR_START_YEAR, formatCurrency, formatMonthLong, formatNumber } from './format';

// --- Rivals ------------------------------------------------------------------------

/** What a rival did over one month close. */
export interface RivalMove {
  airline: string;
  code: string;
  hub: string;
  kind: 'founded' | 'expansion' | 'closure' | 'fleet' | 'folded';
  /** Destinations opened or closed, for expansions and closures. */
  destinations: string[];
  /** Routes opened or closed, or aircraft added. */
  count: number;
}

interface RivalLike {
  id: string;
  name: string;
  code: string;
  hub: string;
  fleet?: unknown[];
  routes?: { origin: string; destination: string }[];
}

const routeKey = (r: { origin: string; destination: string }) => `${r.origin}>${r.destination}`;

/**
 * The rivals' notable moves, comparing the airlines before and after their
 * turn: carriers founded or gone, routes opened and closed, fleets grown.
 * In the order of the list after the turn, so the result is stable.
 */
export function rivalMoves(before: RivalLike[], after: RivalLike[]): RivalMove[] {
  const moves: RivalMove[] = [];
  const prevById = new Map(before.map(a => [a.id, a]));
  const base = (a: RivalLike) => ({ airline: a.name, code: a.code, hub: a.hub });
  for (const a of after) {
    const prev = prevById.get(a.id);
    if (!prev) {
      moves.push({ ...base(a), kind: 'founded', destinations: (a.routes || []).map(r => r.destination), count: (a.routes || []).length });
      continue;
    }
    const was = new Set((prev.routes || []).map(routeKey));
    const now = new Set((a.routes || []).map(routeKey));
    const opened = (a.routes || []).filter(r => !was.has(routeKey(r)));
    const closed = (prev.routes || []).filter(r => !now.has(routeKey(r)));
    if (opened.length > 0) moves.push({ ...base(a), kind: 'expansion', destinations: opened.map(r => r.destination), count: opened.length });
    if (closed.length > 0) moves.push({ ...base(a), kind: 'closure', destinations: closed.map(r => r.destination), count: closed.length });
    const grown = (a.fleet || []).length - (prev.fleet || []).length;
    if (grown > 0) moves.push({ ...base(a), kind: 'fleet', destinations: [], count: grown });
  }
  const afterIds = new Set(after.map(a => a.id));
  for (const a of before) {
    if (!afterIds.has(a.id)) moves.push({ ...base(a), kind: 'folded', destinations: [], count: 0 });
  }
  return moves;
}

// --- The edition --------------------------------------------------------------------

export interface EditionEvent {
  title: string;
  description?: string;
  demandMultiplier: number;
  fuelMultiplier: number;
  duration: number;
}

/** A disruption rolled for the coming month. */
export interface EditionDisruption {
  kind: DisruptionKind;
  title: string;
  text: string;
  cancelShare: number;
  /** How many of the player's routes it hits; one when absent. */
  routeCount?: number;
  ref?: string;
}

export interface EditionReport {
  totalProfit: number;
  routeRevenues: number;
  capitalAfter?: number;
  paxTotal?: number;
  transferPax?: number;
  reputation?: number;
  routeCount?: number;
}

export interface EditionInput {
  /** The month just closed. The paper is dated the month after, the morning it lands. */
  offset: number;
  airlineName: string;
  report: EditionReport;
  prevReport?: EditionReport | null;
  /** Operating profits of the months before this one, oldest first, for a record loss. */
  profitHistory?: number[];
  /** What this close wrote into the chronicle. */
  chronicle?: ChronicleEntry[];
  /** Milestones earned at this close. */
  milestones?: { title: string; detail?: string }[];
  /** World events starting with the coming month, and those whose last month this was. */
  eventsStarted?: EditionEvent[];
  eventsEnded?: { title: string }[];
  /** World events still running in the coming month, the new ones included. */
  eventsRunning?: { title: string }[];
  /** A strike called for the coming month. */
  strike?: { morale: number } | null;
  /** Disruptions rolled for the coming month. */
  disruptions?: EditionDisruption[];
  rivalMoves?: RivalMove[];
  /** Campaigns launched and the frequent-flyer programme started in the month just closed. */
  launches?: { tier: string; region: RegionId | 'global' }[];
  ffpStarted?: boolean;
  /** A scenario decided at this close: nothing else that month is bigger news. */
  scenario?: { title: string; won: boolean; reason: string } | null;
  /** Names for airport codes in the rival column. */
  airportName?: (id: string) => string;
  ticker?: {
    /** Jet fuel in dollars per litre, and its change on the month before, e.g. "+4.2%". */
    fuelPerLitre: number;
    fuelTrend?: string;
    /** Global demand, 1 = normal. */
    demand: number;
    demandTrend?: string;
    /** The player's place by capital among all airlines, 1 = richest. */
    rank: number;
    airlines: number;
  };
}

export type HeadlineKind = 'scenario' | 'crisis' | 'strike' | 'disruption' | 'milestone' | 'record' | 'rival' | 'event' | 'filler';

export interface Edition {
  /** The month the paper is dated. */
  offset: number;
  masthead: string;
  /** "February 1975" */
  date: string;
  /** "Vol. 16 · No. 2" and the cover price of the day. */
  issue: string;
  price: string;
  kind: HeadlineKind;
  headline: string;
  subhead: string;
  lead: string;
  columns: { title: string; body: string }[];
  ticker: { label: string; value: string; trend?: string }[];
}

export const MASTHEAD = 'The Aviation Times';

/** A disruption this share of flights or more makes the front page. Matches the decision threshold. */
export const HEADLINE_DISRUPTION_SHARE = 0.25;

/** An event is a crisis when it costs demand or drives fuel up this much. */
const isAdverse = (ev: { demandMultiplier: number; fuelMultiplier: number }) => ev.demandMultiplier < 0.97 || ev.fuelMultiplier > 1.1;

const pct = (multiplier: number) => {
  const p = Math.round((multiplier - 1) * 100);
  return `${p > 0 ? '+' : p < 0 ? '−' : '±'}${Math.abs(p)}%`;
};

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** "two new routes", "18 months": small numbers in words, as a paper would print them. */
const plural = (n: number, one: string, many = `${one}s`) =>
  `${Number.isInteger(n) && n >= 0 && n <= 10 ? NUMBER_WORDS[n] : formatNumber(n)} ${n === 1 ? one : many}`;

/** "LHR, CDG and AMS" */
function listOf(items: string[], max = 3): string {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  if (rest > 0) return `${shown.join(', ')} and ${rest} more`;
  if (shown.length <= 1) return shown.join('');
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
}

/** The cover price, which follows the decades like everything else. */
function coverPrice(year: number): string {
  if (year < 1970) return '10¢';
  if (year < 1980) return '25¢';
  if (year < 1990) return '50¢';
  if (year < 2000) return '75¢';
  if (year < 2010) return '$1.00';
  return '$2.50';
}

// --- Filler ----------------------------------------------------------------------

interface Filler {
  from: number;
  to: number;
  headline: string;
  subhead: string;
  body: string;
}

/**
 * Stories for a month without news of its own, each for the years it would
 * have run in. A month picks among those of its year by its offset.
 */
export const FILLER_STORIES: readonly Filler[] = [
  { from: 1960, to: 1969, headline: 'The Jet Age Takes Hold', subhead: 'Travellers trade propellers for pure jets on every trunk route',
    body: 'Airlines that flew piston liners only a few years ago now advertise their jets above all else. Journey times have halved on the long routes, and passengers have noticed.' },
  { from: 1960, to: 1972, headline: 'Silver Service at Thirty Thousand Feet', subhead: 'Carving trolleys, cocktails and the golden age of flying',
    body: 'With fares fixed by agreement, the airlines compete on what happens on board. First class menus run to five courses, and even economy passengers eat from china.' },
  { from: 1962, to: 1976, headline: 'Supersonic Dreams on the Drawing Board', subhead: 'Concorde and its rivals promise the Atlantic in three hours',
    body: 'Engineers on both sides of the Atlantic are chasing a passenger aircraft faster than sound. Airline chiefs remain cautious about who will pay for the fuel.' },
  { from: 1966, to: 1971, headline: 'The Jumbo Is Coming', subhead: 'A twin-aisle giant for four hundred passengers takes shape in Seattle',
    body: 'The industry is preparing for an aircraft twice the size of anything flying today. Airports are already asking where they will park it.' },
  { from: 1970, to: 1979, headline: 'Widebodies Open the Skies to the Many', subhead: 'Jumbo jets bring long-haul holidays within reach',
    body: 'Cheaper seats on bigger aircraft are filling the sun routes with families who had never flown before. Charter operators are growing fastest of all.' },
  { from: 1974, to: 1979, headline: 'Deregulation Debate Reaches Washington', subhead: 'Economists ask why the government sets every fare',
    body: 'Hearings in the capital are questioning a system in which airlines may not choose their own routes or prices. Incumbents warn of chaos; newcomers smell opportunity.' },
  { from: 1978, to: 1989, headline: 'Hub and Spoke: The New Shape of the Map', subhead: 'Carriers funnel passengers through a few great interchange airports',
    body: 'Freed to fly where they like, airlines are building networks around their busiest airports. A passenger from a small town can now reach the world with a single change.' },
  { from: 1981, to: 1995, headline: 'Loyalty Pays: Frequent Flyer Schemes Spread', subhead: 'Every carrier now wants to know its best customers by name',
    body: 'Points for every mile flown are proving the cheapest way to keep a business traveller from switching airlines. Rivals have little choice but to follow.' },
  { from: 1985, to: 1999, headline: 'Two Engines Across the Ocean', subhead: 'Relaxed rules let twin jets fly the long overwater routes',
    body: 'Long-haul flying no longer needs three or four engines. The economics of thin intercontinental routes are changing fast.' },
  { from: 1990, to: 2005, headline: 'Upstarts Take On the Flag Carriers', subhead: 'No-frills airlines sell seats for the price of a train ticket',
    body: 'A new breed of airline flies one aircraft type, sells direct and charges for everything but the seat. The established carriers are watching their short-haul markets closely.' },
  { from: 1995, to: 2009, headline: 'Tickets Go Online', subhead: 'The web arrives at the booking counter',
    body: 'Passengers are buying seats from their own desks, and travel agents are feeling it. Airlines like the lower commissions even more than their customers like the convenience.' },
  { from: 1997, to: 2015, headline: 'Alliances Redraw the Route Map', subhead: 'Global partnerships share codes, lounges and loyalty points',
    body: 'Rather than merge across borders, the big carriers are joining forces. For the passenger, one ticket now reaches almost anywhere.' },
  { from: 2005, to: 2020, headline: 'The Superjumbo and the Dreamliner', subhead: 'Big hubs or direct flights? Two visions of long haul collide',
    body: 'One manufacturer bets on ever larger aircraft between the great hubs, the other on efficient twins flying point to point. Airline fleet planners are hedging their bets.' },
  { from: 2010, to: 2100, headline: 'Greener Skies on the Agenda', subhead: 'Sustainable fuel trials and quieter engines take off',
    body: 'Airlines are under pressure to cut their emissions, and the first flights on alternative fuels are drawing crowds. The cost remains the sticking point.' },
  { from: 2012, to: 2100, headline: 'Boarding Pass in Your Pocket', subhead: 'Phones replace paper at the gate',
    body: 'From check-in to boarding, the whole journey now fits on a phone. Airports are rebuilding their halls around fewer desks and more shops.' }
];

/** The filler story for a month: among those of its year, chosen by the offset. */
export function fillerFor(offset: number): Filler {
  const year = CALENDAR_START_YEAR + Math.floor(offset / 12);
  const fitting = FILLER_STORIES.filter(f => year >= f.from && year <= f.to);
  const pool = fitting.length > 0 ? fitting : FILLER_STORIES;
  return pool[((offset % pool.length) + pool.length) % pool.length];
}

// --- Writing it up ----------------------------------------------------------------------

interface Story {
  kind: HeadlineKind;
  headline: string;
  subhead: string;
  lead: string;
  /** The disruption the front page is about, so the brief does not repeat it. */
  disruption?: EditionDisruption;
}

/** Hits more than the one route: an airport strike, the weather, or anything else reaching several. */
const isWideDisruption = (d: EditionDisruption) => d.kind === 'airport-strike' || d.kind === 'weather' || (d.routeCount ?? 1) > 1;

const DISRUPTION_HEADLINES: Record<DisruptionKind, (name: string, ref: string) => string> = {
  technical: name => `Technical Fault Grounds ${name} Jet`,
  birdstrike: name => `Bird Strike Damages ${name} Aircraft`,
  'airport-strike': (name, ref) => `Airport Strike${ref ? ` at ${ref}` : ''} Snarls ${name} Schedule`,
  weather: (_name, ref) => `Winter Storms Batter Flights${ref && ref in REGION_LABELS ? ` Across ${REGION_LABELS[ref as RegionId]}` : ''}`
};

/** The front-page story: the biggest news of the month, in the fixed order. */
function pickStory(input: EditionInput, nextMonth: string, closedMonth: string): Story {
  const name = input.airlineName || 'Your airline';
  const profit = input.report.totalProfit;

  const scenario = input.scenario;
  if (scenario) {
    return scenario.won
      ? {
          kind: 'scenario',
          headline: `${name} Triumphs: ${scenario.title} Mission Accomplished`,
          subhead: scenario.reason,
          lead: `The board had set ${name} a target few thought it could meet, and in ${closedMonth} it met it. Shareholders are toasting the management; rivals are studying how it was done.`
        }
      : {
          kind: 'scenario',
          headline: `${name} Falls Short: ${scenario.title} Ends in Failure`,
          subhead: scenario.reason,
          lead: `The ${scenario.title} challenge is over for ${name}, and the target was not met. The airline flies on, but in the boardroom questions are being asked about what went wrong.`
        };
  }

  const crisis = (input.eventsStarted || []).find(isAdverse);
  if (crisis) {
    return {
      kind: 'crisis',
      headline: `${crisis.title} Rocks the Airline Industry`,
      subhead: `Demand ${pct(crisis.demandMultiplier)}, fuel ${pct(crisis.fuelMultiplier)}, and experts expect it to last ${plural(crisis.duration, 'month')}`,
      lead: `${crisis.description ? `${crisis.description} ` : ''}Carriers everywhere are rewriting their plans for ${nextMonth}, and ${name} is no exception.`
    };
  }

  if (input.strike) {
    return {
      kind: 'strike',
      headline: `${name} Grounded as Staff Walk Out`,
      subhead: `Unions call a strike for ${nextMonth}, with morale at ${Math.round(input.strike.morale)}`,
      lead: `Crew and ground staff at ${name} have had enough. Until management answers the unions, not a single ${name} aircraft will leave the gate in ${nextMonth}.`
    };
  }

  // Big enough for the front page; those across routes come before a
  // milestone, a single grounded aircraft only after the records.
  const frontPage = [...(input.disruptions || [])]
    .filter(d => d.cancelShare >= HEADLINE_DISRUPTION_SHARE)
    .sort((a, b) => b.cancelShare - a.cancelShare || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
  const disruptionStory = (d: EditionDisruption): Story => ({
    kind: 'disruption',
    headline: DISRUPTION_HEADLINES[d.kind](name, d.ref || ''),
    subhead: `${Math.round(d.cancelShare * 100)}% of affected flights in doubt for ${nextMonth}`,
    lead: `${d.text} Passengers are being rebooked while ${name} weighs its options.`,
    disruption: d
  });
  const wide = frontPage.find(isWideDisruption);
  if (wide) return disruptionStory(wide);

  const milestone = (input.milestones || [])[0];
  if (milestone) {
    return {
      kind: 'milestone',
      headline: `${name} Celebrates: ${milestone.title}`,
      subhead: milestone.detail || `A landmark month for ${name}`,
      lead: `Champagne at head office: ${name} reached a new milestone in ${closedMonth}. ${milestone.detail ? `${milestone.detail} ` : ''}The board called it proof the strategy is working.`
    };
  }

  const profitRecord = (input.chronicle || []).find(e => e.key === 'record:profit');
  if (profitRecord) {
    return {
      kind: 'record',
      headline: `Record Month for ${name}`,
      subhead: `Operating profit of ${formatCurrency(profit)} in ${closedMonth}`,
      lead: `${name} has never earned more in a single month. ${profitRecord.text}`
    };
  }
  const history = (input.profitHistory || []).filter(Number.isFinite);
  if (profit < 0 && history.length >= 6 && profit < Math.min(...history)) {
    return {
      kind: 'record',
      headline: `${name} Posts Its Worst Month Yet`,
      subhead: `An operating loss of ${formatCurrency(-profit)} in ${closedMonth}`,
      lead: `Never has ${name} lost more in a single month. Shareholders will want to know what the board intends to do about it.`
    };
  }

  const single = frontPage.find(d => !isWideDisruption(d));
  if (single) return disruptionStory(single);

  const expansion = (input.rivalMoves || [])
    .filter(m => m.kind === 'expansion' || m.kind === 'founded')
    .sort((a, b) => b.count - a.count || (a.airline < b.airline ? -1 : a.airline > b.airline ? 1 : 0))[0];
  if (expansion) {
    const where = (id: string) => input.airportName?.(id) || id;
    const dests = listOf(expansion.destinations.map(where));
    return {
      kind: 'rival',
      headline: expansion.kind === 'founded'
        ? `${expansion.airline} Takes to the Skies`
        : expansion.count === 1
          ? `${expansion.airline} Opens ${where(expansion.hub)} to ${where(expansion.destinations[0])}`
          : `${expansion.airline} Spreads Its Wings`,
      subhead: expansion.kind === 'founded'
        ? `A new carrier sets up at ${where(expansion.hub)}`
        : `${plural(expansion.count, 'new route')} from ${where(expansion.hub)}`,
      lead: expansion.kind === 'founded'
        ? `A new name joins the competition: ${expansion.airline} (${expansion.code}) begins flying from ${where(expansion.hub)}${dests ? ` to ${dests}` : ''}.`
        : `${expansion.airline} (${expansion.code}) is adding capacity: from ${where(expansion.hub)} it now also serves ${dests}. Competitors on those routes should expect a fight for passengers.`
    };
  }

  const boom = (input.eventsStarted || []).find(ev => !isAdverse(ev));
  if (boom) {
    return {
      kind: 'event',
      headline: `${boom.title} Lifts the Industry`,
      subhead: `Demand ${pct(boom.demandMultiplier)}, fuel ${pct(boom.fuelMultiplier)} for ${plural(boom.duration, 'month')}`,
      lead: `${boom.description ? `${boom.description} ` : ''}Booking offices report their busiest mornings in years.`
    };
  }
  const ended = (input.eventsEnded || [])[0];
  if (ended) {
    return {
      kind: 'event',
      headline: `${ended.title} Is Over`,
      subhead: 'Demand and fuel prices return to normal',
      lead: `The industry breathes out: ${ended.title} has run its course, and from ${nextMonth} the markets are back to business as usual.`
    };
  }

  const filler = fillerFor(input.offset);
  return { kind: 'filler', headline: filler.headline, subhead: filler.subhead, lead: filler.body };
}

/** The airline's own column: the month's figures against the month before. */
function resultsColumn(input: EditionInput, closedMonth: string): { title: string; body: string } {
  const r = input.report;
  const name = input.airlineName || 'Your airline';
  const parts: string[] = [];
  const prev = input.prevReport;
  const change = !prev || !Number.isFinite(prev.totalProfit)
    ? ''
    : prev.totalProfit < 0
      ? `, against a loss of ${formatCurrency(-prev.totalProfit)} the month before`
      : `, ${r.totalProfit >= prev.totalProfit ? 'up' : 'down'} from ${formatCurrency(prev.totalProfit)} the month before`;
  parts.push(
    `${name} closed ${closedMonth} with ${formatCurrency(r.routeRevenues)} in ticket revenue and ` +
    `${r.totalProfit >= 0 ? `an operating profit of ${formatCurrency(r.totalProfit)}` : `an operating loss of ${formatCurrency(-r.totalProfit)}`}${change}.`
  );
  if (Number.isFinite(r.paxTotal) && r.paxTotal! > 0) {
    const transfer = Number.isFinite(r.transferPax) && r.transferPax! > 0 ? `, ${formatNumber(r.transferPax!)} of them changing planes on the way` : '';
    parts.push(`${formatNumber(r.paxTotal!)} passengers flew with the airline${transfer}.`);
  } else if (r.routeCount === 0) {
    parts.push('Not a single aircraft has flown yet; the industry is waiting to see what the newcomer will do.');
  }
  if (Number.isFinite(r.reputation)) {
    const was = prev && Number.isFinite(prev.reputation) ? prev.reputation! : null;
    const trend = was === null || Math.round(r.reputation!) === Math.round(was)
      ? 'holds at'
      : r.reputation! > was ? 'rises to' : 'slips to';
    parts.push(`Its reputation ${trend} ${Math.round(r.reputation!)}.`);
  }
  return { title: `${name} results`, body: parts.join(' ') };
}

function marketsColumn(input: EditionInput, nextMonth: string): { title: string; body: string } {
  const parts: string[] = [];
  for (const ev of input.eventsStarted || []) {
    parts.push(`${ev.title} begins: demand ${pct(ev.demandMultiplier)}, fuel ${pct(ev.fuelMultiplier)} for ${plural(ev.duration, 'month')}.`);
  }
  for (const ev of input.eventsEnded || []) parts.push(`${ev.title} is over.`);
  const started = new Set((input.eventsStarted || []).map(e => e.title));
  const running = (input.eventsRunning || []).filter(e => !started.has(e.title));
  if (running.length > 0) parts.push(`Still weighing on the markets: ${listOf(running.map(e => e.title))}.`);
  const t = input.ticker;
  if (t) {
    parts.push(
      `Jet fuel trades at $${formatNumber(t.fuelPerLitre, 3)} a litre${t.fuelTrend && t.fuelTrend !== '0%' ? ` (${t.fuelTrend} on the month)` : ''}; ` +
      `passenger demand stands at ${Math.round(t.demand * 100)}% of normal going into ${nextMonth}.`
    );
  }
  if (parts.length === 0) parts.push(`A calm month on the markets. Analysts expect ${nextMonth} to follow the season.`);
  return { title: 'Markets', body: parts.join(' ') };
}

/** The rivals' moves, one sentence per airline: "Qantas adds Perth to its Sydney network and one aircraft to its fleet." */
function rivalsColumn(input: EditionInput, skip: RivalMove | undefined): { title: string; body: string } {
  const where = (id: string) => input.airportName?.(id) || id;
  const byAirline = new Map<string, string[]>();
  for (const m of input.rivalMoves || []) {
    if (m === skip) continue;
    const clause = (() => {
      switch (m.kind) {
        case 'founded': return `starts flying from ${where(m.hub)}`;
        case 'expansion': return `adds ${listOf(m.destinations.map(where))} to its ${where(m.hub)} network`;
        case 'closure': return `withdraws from ${listOf(m.destinations.map(where))}`;
        case 'fleet': return `takes delivery of ${plural(m.count, 'aircraft', 'aircraft')}`;
        case 'folded': return 'has ceased trading';
      }
    })();
    const clauses = byAirline.get(m.airline) || [];
    clauses.push(clause);
    byAirline.set(m.airline, clauses);
  }
  const lines = [...byAirline.entries()].slice(0, 4).map(([airline, clauses]) => `${airline} ${listOf(clauses, clauses.length)}.`);
  return {
    title: 'Rival watch',
    body: lines.length > 0 ? lines.join(' ') : 'A quiet month among the competition: no new routes, no new aircraft.'
  };
}

function briefColumn(input: EditionInput, story: Story): { title: string; body: string } | null {
  const name = input.airlineName || 'Your airline';
  const lines: string[] = [];
  // What the chronicle took from the month and the front page did not already tell.
  for (const e of input.chronicle || []) {
    if (e.kind === 'crisis' || e.kind === 'strike' || e.kind === 'disruption' || e.kind === 'milestone' || e.kind === 'scenario') continue;
    if (story.kind === 'record' && e.key === 'record:profit') continue;
    lines.push(e.text);
  }
  for (const m of (input.milestones || []).slice(story.kind === 'milestone' ? 1 : 0)) lines.push(`Milestone: ${m.title}.`);
  const minor = (input.disruptions || []).filter(d => d !== story.disruption);
  if (minor.length > 0) lines.push(`Operations: ${listOf(minor.map(d => d.title))} will cost flights next month.`);
  for (const l of input.launches || []) {
    const where = l.region === 'global' ? 'worldwide' : `in ${REGION_LABELS[l.region]}`;
    lines.push(`${name} launches a ${l.tier.toLowerCase()} advertising campaign ${where}.`);
  }
  if (input.ffpStarted) lines.push(`${name} starts a frequent flyer programme to keep its best customers.`);
  return lines.length > 0 ? { title: 'In brief', body: lines.join(' ') } : null;
}

/** The month's newspaper, written from what the month close found. Deterministic. */
export function buildEdition(input: EditionInput): Edition {
  const dated = input.offset + 1;
  const closedMonth = formatMonthLong(input.offset);
  const nextMonth = formatMonthLong(dated);
  const story = pickStory(input, nextMonth, closedMonth);

  const headlineRival = story.kind === 'rival'
    ? (input.rivalMoves || [])
      .filter(m => m.kind === 'expansion' || m.kind === 'founded')
      .sort((a, b) => b.count - a.count || (a.airline < b.airline ? -1 : a.airline > b.airline ? 1 : 0))[0]
    : undefined;

  const columns = [resultsColumn(input, closedMonth), marketsColumn(input, nextMonth), rivalsColumn(input, headlineRival)];
  const brief = briefColumn(input, story);
  if (brief) columns.push(brief);

  const ticker: Edition['ticker'] = [];
  if (input.ticker) {
    const t = input.ticker;
    ticker.push({ label: 'Jet fuel', value: `$${formatNumber(t.fuelPerLitre, 3)}/L`, trend: t.fuelTrend });
    ticker.push({ label: 'Demand index', value: String(Math.round(t.demand * 100)), trend: t.demandTrend });
    ticker.push({ label: `${input.airlineName || 'You'} by capital`, value: `#${t.rank} of ${t.airlines}` });
  }

  const year = CALENDAR_START_YEAR + Math.floor(dated / 12);
  return {
    offset: dated,
    masthead: MASTHEAD,
    date: nextMonth,
    issue: `Vol. ${year - CALENDAR_START_YEAR + 1} · No. ${(dated % 12) + 1}`,
    price: coverPrice(year),
    kind: story.kind,
    headline: story.headline,
    subhead: story.subhead,
    lead: story.lead,
    columns,
    ticker
  };
}
