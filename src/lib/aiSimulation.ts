/**
 * The rival airlines of a new game: who they are and how they start.
 *
 * Only the founding is left here (`generateAiAirlines`, `pickRivalIdentities`,
 * `cabinConfigFor`). How rivals play a month is the model's
 * (`src/model/rivalMonth.ts`, run by `runModelMonth`); the old monthly turn was
 * removed in 5.2a.
 */
import { getAirportStats } from '../data/airports';
import { airports as eraAirports, airportsMapAdjusted } from '../data/airportRegistry';
import type { Airport } from '../data/airportTypes';
import { aircraftList, type Aircraft } from '../data/aircraft';
import { REAL_AIRLINES, FICTIONAL_AIRLINES, isActiveIn, type RivalPersonality } from '../data/rivalAirlines';
import type { AiAirline } from '../components/CompetitorsView';
import { assignRivalColors, MAP_YELLOW } from './theme';
import { yearOf } from './format';

type Personality = RivalPersonality;
type Difficulty = 'Easy' | 'Normal' | 'Hard';
type AiPlane = AiAirline['fleet'][number];
type AiRoute = AiAirline['routes'][number];

const PERSONALITIES: Personality[] = ['flag', 'lcc', 'expansionist', 'optimizer', 'boutique'];
const AGGRESSION: Record<Personality, number> = { expansionist: 9, lcc: 8, flag: 6, optimizer: 4, boutique: 5 };

/**
 * Seat split per strategy: [economy, premium, business, first], where a
 * first share of -1 means "whatever is left". This used to be written out
 * three times, once each for starting, replacement and purchased aircraft.
 */
const CABIN_SHARES: Record<Personality, [number, number, number, number]> = {
  lcc: [0.96, 0.04, 0, 0],
  flag: [0.65, 0.15, 0.12, -1],
  boutique: [0.45, 0.25, 0.20, -1],
  optimizer: [0.76, 0.14, 0.07, -1],
  expansionist: [0.88, 0.08, 0.04, 0]
};

export function cabinConfigFor(personality: Personality, capacity: number) {
  const [e, p, b, f] = CABIN_SHARES[personality] ?? CABIN_SHARES.optimizer;
  const config = {
    economy: Math.floor(capacity * e),
    premium: Math.floor(capacity * p),
    business: Math.floor(capacity * b),
    first: 0
  };
  if (f < 0) config.first = capacity - config.economy - config.premium - config.business;
  // Rounding leftovers go to economy, so the seats always add up to capacity.
  config.economy += capacity - (config.economy + config.premium + config.business + config.first);
  return config;
}

function toFleetEntry(spec: Aircraft, reg: string, offset: number, config: AiPlane['config']): AiPlane {
  return {
    id: spec.id,
    manufacturer: spec.manufacturer,
    family: spec.family,
    type: spec.type,
    class: spec.class.toLowerCase() as AiPlane['class'],
    reg,
    maxRange: spec.maxRange,
    capacity: spec.capacity,
    basePrice: spec.basePrice,
    popularity: spec.popularity,
    efficiency: spec.efficiency,
    cruiseSpeed: spec.cruiseSpeed,
    purchasedAt: offset,
    conditionInterior: 100,
    conditionGeneral: 100,
    config
  };
}

/** Aircraft a customer can take delivery of in this month. */
function aircraftOnMarket(offset: number): Aircraft[] {
  return aircraftList.filter(a =>
    offset >= a.firstDeliveryOffset && (a.lastDeliveryOffset === null || offset <= a.lastDeliveryOffset)
  );
}

/** Random pick, weighted. Returns -1 for an empty or all-zero list. */
function weightedIndex(weights: number[]): number {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0) return -1;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

const airportDemand = (a: Airport | undefined, year: number) => {
  const s = getAirportStats(a, year);
  return s.business + s.tourism;
};

interface RivalIdentity {
  name: string;
  code: string;
  hub: string;
  personality: Personality;
  isReal: boolean;
}

/**
 * Who competes: a mix of real and fictional airlines.
 *
 * Real airlines only appear in years they actually flew and always start at
 * their real hub. A real airline whose hub is the player's hub is left out
 * altogether (a Frankfurt player gets no Lufthansa), rather than being moved
 * somewhere it never was. No two rivals share a hub, and none starts at the
 * player's hub. Fictional airlines take the busiest free airports.
 */
export function pickRivalIdentities(
  count: number,
  playerHubId: string,
  year: number,
  playerCode = '',
  /** Rivals already in the game: their hubs and codes are taken. */
  existing: ReadonlyArray<{ code: string; hub: string; secondHub?: string }> = []
): RivalIdentity[] {
  if (count <= 0) return [];
  const usedHubs = new Set<string>([playerHubId, ...existing.flatMap(e => [e.hub, e.secondHub]).filter((h): h is string => !!h)]);
  const usedCodes = new Set<string>([...(playerCode ? [playerCode.toUpperCase()] : []), ...existing.map(e => e.code.toUpperCase())]);
  const out: RivalIdentity[] = [];

  let fictionalWanted = count === 1
    ? (Math.random() < 0.4 ? 1 : 0)
    : Math.max(1, Math.round(count * (0.3 + Math.random() * 0.2)));
  const realWanted = count - fictionalWanted;

  const realPool = REAL_AIRLINES.filter(a =>
    isActiveIn(a, year) && a.hub !== playerHubId && airportsMapAdjusted.has(a.hub)
  );
  while (out.length < realWanted) {
    const open = realPool.filter(a => !usedHubs.has(a.hub) && !usedCodes.has(a.code));
    // Big hubs come up more often, so the familiar names are usually there.
    const i = weightedIndex(open.map(a => Math.sqrt(airportDemand(airportsMapAdjusted.get(a.hub), year))));
    if (i < 0) break;
    const a = open[i];
    usedHubs.add(a.hub);
    usedCodes.add(a.code);
    out.push({ name: a.name, code: a.code, hub: a.hub, personality: a.personality, isReal: true });
  }
  // Not enough real airlines for this year: fictional ones fill the gap.
  fictionalWanted = count - out.length;

  const realCodes = new Set(REAL_AIRLINES.map(a => a.code));
  const names = [...FICTIONAL_AIRLINES]
    .filter(f => !realCodes.has(f.code) && !usedCodes.has(f.code))
    .sort(() => Math.random() - 0.5);
  const personalities = [...PERSONALITIES].sort(() => Math.random() - 0.5);
  for (let n = 0; n < fictionalWanted && n < names.length; n++) {
    let hubs = eraAirports.filter(a => a.level >= 4 && !usedHubs.has(a.id));
    if (hubs.length === 0) hubs = eraAirports.filter(a => a.level >= 2 && !usedHubs.has(a.id));
    const i = weightedIndex(hubs.map(a => airportDemand(a, year)));
    if (i < 0) break;
    const hub = hubs[i];
    usedHubs.add(hub.id);
    usedCodes.add(names[n].code);
    out.push({ name: names[n].name, code: names[n].code, hub: hub.id, personality: personalities[n % personalities.length], isReal: false });
  }

  return out.sort(() => Math.random() - 0.5);
}

/** A starting aircraft of the wanted class, chosen the way this strategy would. */
function pickStartingAircraft(personality: Personality, wantedClass: string, offset: number): Aircraft {
  const options = aircraftOnMarket(offset).filter(a => a.class.toLowerCase() === wantedClass);
  const score = (a: Aircraft) => {
    let s = a.popularity - (offset - a.firstDeliveryOffset) * 0.2;
    if (personality === 'lcc') s += (a.capacity || 100) * 0.15 + (a.efficiency || 50) * 0.6;
    else if (personality === 'flag') s += (a.popularity || 50) * 1.5;
    else if (personality === 'boutique') s += (a.maxRange || 1000) * 0.02;
    else if (personality === 'optimizer') s += (a.efficiency || 50) * 1.2;
    // Some variation so rivals do not all fly the same type.
    return s + (Math.random() - 0.5) * 15;
  };
  const scored = options.map(a => ({ a, s: score(a) })).sort((x, y) => y.s - x.s);
  return scored[0]?.a
    || aircraftOnMarket(offset)[0]
    || aircraftList.find(a => a.class.toLowerCase() === wantedClass)
    || aircraftList[0];
}

export const generateAiAirlines = (
  count: number,
  difficultyVal: string,
  playerHubId: string,
  startDateOffset: number = 0,
  /** The player's airline code, which no rival may carry. */
  playerCode: string = '',
  /** The player's brand colour, which no rival is drawn in. */
  playerColor: string = MAP_YELLOW,
  /** Rivals already flying, when a new one is founded in a running game: their hubs, codes and colours are taken. */
  existing: AiAirline[] = []
): AiAirline[] => {
  const difficulty = (['Easy', 'Normal', 'Hard'].includes(difficultyVal) ? difficultyVal : 'Normal') as Difficulty;
  const identities = pickRivalIdentities(count, playerHubId, yearOf(startDateOffset), playerCode, existing);

  const result: AiAirline[] = [];

  for (const who of identities) {
    const { personality } = who;

    // Capital Reserves Variation based on personality + realistic small random noise
    const baseCapitalScale = difficulty === 'Hard' ? 120000000 : difficulty === 'Normal' ? 80000000 : 50000000;
    let prestigeMultiplier = 1.0;
    if (personality === 'flag') prestigeMultiplier = 1.25;
    else if (personality === 'boutique') prestigeMultiplier = 1.12;
    else if (personality === 'lcc') prestigeMultiplier = 0.88;
    else if (personality === 'expansionist') prestigeMultiplier = 0.94;
    const noise = Math.floor((Math.random() - 0.5) * 6000000); // ±3,000,000
    const capital = Math.floor(baseCapitalScale * prestigeMultiplier + noise);

    const fleet: AiPlane[] = [];
    const numInitialPlanes = difficulty === 'Hard' ? 4 : difficulty === 'Normal' ? 3 : 2;
    for (let i = 0; i < numInitialPlanes; i++) {
      const wantedClass = i > 0 || difficulty === 'Easy' ? 'regional' : 'narrowbody';
      const spec = pickStartingAircraft(personality, wantedClass, startDateOffset);
      fleet.push(toFleetEntry(spec, `${who.code}-A${100 + i}`, startDateOffset, cabinConfigFor(personality, spec.capacity || 131)));
    }

    // No starting routes: rivals begin exactly like the player, with a fleet
    // but nothing scheduled. simulateAiAirlinesTurn's "idle aircraft" step
    // gives them their first routes during the next monthly turn.
    const routes: AiRoute[] = [];

    result.push({
      id: `ai_${who.code.toLowerCase()}`,
      name: who.name,
      code: who.code,
      hub: who.hub,
      isReal: who.isReal,
      capital,
      aiDifficulty: difficulty,
      fleet,
      routes,
      // Empty until a month has closed. It used to open with 5% of the
      // starting capital, a "profit" no month had produced.
      monthlyProfitsHistory: [],
      personality,
      aggression: AGGRESSION[personality]
    });
  }

  // Each rival its own colour on the map, clear of the player's.
  const colors = assignRivalColors([...existing, ...result], playerColor).slice(existing.length);
  result.forEach((ai, i) => { ai.color = colors[i]; });
  return result;
};
