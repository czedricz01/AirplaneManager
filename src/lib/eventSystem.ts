/**
 * Something the player can do about an event, offered once when it begins.
 *
 * Until now a world event was two numbers the player could only absorb. A
 * choice costs money up front and changes how the event hits the player -- and
 * only the player, never the AI airlines, which keep paying the raw rates.
 */
export interface EventChoice {
  id: string;
  label: string;
  detail: string;
  /** Charged once, when the choice is taken. */
  cost: number;
  /**
   * Locks the player's jet fuel price at the level of the month before the
   * event started, for as long as the event runs. It locks both ways: if fuel
   * gets cheaper instead, the hedge costs money.
   */
  hedgesFuel?: boolean;
  /**
   * Recovers this fraction of the event's demand shortfall, for the player
   * only. 0.4 against a 0.65 multiplier leaves 0.65 + 0.35*0.4 = 0.79.
   */
  softensDemand?: number;
}

/** The coarse regions of the world; the same ids as RegionId in gameState. */
export type EventRegion = 'EU' | 'NA' | 'SA' | 'AF' | 'AS' | 'OC';

export const EVENT_REGION_NAMES: Record<EventRegion, string> = {
  EU: 'Europe', NA: 'North America', SA: 'South America', AF: 'Africa', AS: 'Asia', OC: 'Oceania'
};

export interface HistoricalEvent {
  startOffset: number; // calculated from 1960
  duration: number; // months
  title: string;
  description: string;
  demandMultiplier: number; // 1.0 = normal
  fuelMultiplier: number; // 1.0 = normal
  choices?: EventChoice[];
  /**
   * Set for a regional event: the demand multiplier then applies only to
   * routes with an end in one of these regions (a route with one end in the
   * region feels half of it), and only the fuel price stays global. Absent for
   * a world event.
   */
  regions?: EventRegion[];
}

/** "Europe", "Asia and Oceania": where a regional event happens, empty for a world event. */
export function eventRegionLabel(ev: Pick<HistoricalEvent, 'regions'>): string {
  const names = (ev.regions || []).map(r => EVENT_REGION_NAMES[r]);
  if (names.length === 0) return '';
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
}

/** " in Europe", " in Asia and Oceania": for a sentence; empty for a world event. */
export function eventScope(ev: Pick<HistoricalEvent, 'regions'>): string {
  const label = eventRegionLabel(ev);
  return label ? ` in ${label}` : '';
}

/** Stable identity for an event, used to remember which choice was taken. */
export const eventKey = (ev: Pick<HistoricalEvent, 'title' | 'startOffset'>) =>
  `${ev.title}@${ev.startOffset}`;

export const historicalEvents: HistoricalEvent[] = [
  {
    startOffset: (1973 - 1960) * 12 + 9, // Oct 1973
    duration: 18,
    title: "1973 Oil Crisis",
    choices: [
      {
        id: "hedge",
        label: "Hedge fuel for the duration",
        detail: "Lock your jet fuel price at last month's level until the crisis is over. Your rivals keep paying the market rate. If fuel gets cheaper instead, you still pay the locked price.",
        cost: 4000000,
        hedgesFuel: true
      },
      {
        id: "ride",
        label: "Ride it out",
        detail: "Pay the market price for fuel, whatever it does. Costs nothing now.",
        cost: 0
      }
    ],
    description: "An oil embargo has caused massive fuel shortages and skyrocketing prices.",
    demandMultiplier: 0.9,
    fuelMultiplier: 2.0,
  },
  {
    startOffset: (1979 - 1960) * 12 + 1, // Feb 1979
    duration: 24,
    title: "1979 Energy Crisis",
    choices: [
      {
        id: "hedge",
        label: "Hedge fuel for the duration",
        detail: "Lock your jet fuel price at last month's level until the crisis is over. Your rivals keep paying the market rate. If fuel gets cheaper instead, you still pay the locked price.",
        cost: 6000000,
        hedgesFuel: true
      },
      {
        id: "ride",
        label: "Ride it out",
        detail: "Pay the market price for fuel, whatever it does. Costs nothing now.",
        cost: 0
      }
    ],
    description: "A drop in oil production has triggered a severe energy crisis.",
    demandMultiplier: 0.85,
    fuelMultiplier: 1.8,
  },
  {
    startOffset: (1990 - 1960) * 12 + 7, // Aug 1990
    duration: 12,
    title: "Gulf War Oil Shock",
    choices: [
      {
        id: "hedge",
        label: "Hedge fuel for the duration",
        detail: "Lock your jet fuel price at last month's level until the crisis is over. Your rivals keep paying the market rate. If fuel gets cheaper instead, you still pay the locked price.",
        cost: 3000000,
        hedgesFuel: true
      },
      {
        id: "ride",
        label: "Ride it out",
        detail: "Pay the market price for fuel, whatever it does. Costs nothing now.",
        cost: 0
      }
    ],
    description: "Geopolitical tensions have caused a short-term spike in oil prices.",
    demandMultiplier: 0.95,
    fuelMultiplier: 1.5,
  },
  {
    startOffset: (2001 - 1960) * 12 + 8, // Sep 2001
    duration: 12,
    title: "Aviation Downturn",
    choices: [
      {
        id: "reassure",
        label: "Campaign to win passengers back",
        detail: "Advertising, refunds and flexible rebooking while confidence recovers. Recovers roughly 40% of the demand you would otherwise lose, for you alone.",
        cost: 5000000,
        softensDemand: 0.4
      },
      {
        id: "ride",
        label: "Wait for confidence to return",
        detail: "Fly the schedule and absorb the empty seats. Costs nothing now.",
        cost: 0
      }
    ],
    description: "Global passenger demand has plummeted dramatically.",
    demandMultiplier: 0.65,
    fuelMultiplier: 1.0,
  },
  {
    startOffset: (2008 - 1960) * 12 + 8, // Sep 2008
    duration: 24,
    title: "Global Financial Crisis",
    choices: [
      {
        id: "yield",
        label: "Chase volume with cut fares",
        detail: "Discount aggressively and market hard for two years to keep the aircraft full. Recovers roughly a third of the lost demand, for you alone.",
        cost: 8000000,
        softensDemand: 0.33
      },
      {
        id: "ride",
        label: "Hold your fares",
        detail: "Protect yield and fly emptier. Costs nothing now.",
        cost: 0
      }
    ],
    description: "A severe worldwide economic crisis resulting in depressed passenger demand and volatile fuel prices.",
    demandMultiplier: 0.75,
    fuelMultiplier: 1.2,
  },
  {
    startOffset: (2020 - 1960) * 12 + 2, // Mar 2020
    duration: 24,
    title: "Global Pandemic",
    choices: [
      {
        id: "cargo",
        label: "Convert cabins to cargo",
        detail: "Strip seats and fly freight while nobody is travelling. Expensive and slow to reverse, but recovers roughly 35% of a demand collapse that is otherwise near-total.",
        cost: 25000000,
        softensDemand: 0.35
      },
      {
        id: "ride",
        label: "Park the aircraft and wait",
        detail: "Fly the schedule into empty cabins for two years. Costs nothing now.",
        cost: 0
      }
    ],
    description: "International borders close and aviation demand nearly vanishes.",
    demandMultiplier: 0.20,
    fuelMultiplier: 0.7,
  },

  // --- Regional events: they hit one part of the world, not all of it. -------
  {
    startOffset: (1968 - 1960) * 12 + 4, // May 1968
    duration: 2,
    title: "French General Strike",
    description: "Strikes and unrest paralyse France; airports close and bookings across Western Europe collapse for weeks.",
    demandMultiplier: 0.85,
    fuelMultiplier: 1.0,
    regions: ['EU']
  },
  {
    startOffset: (1981 - 1960) * 12 + 7, // Aug 1981
    duration: 5,
    title: "Air Traffic Controllers' Strike",
    description: "American air traffic controllers walk out and the government grounds the strikers: flights across North America are cut for months.",
    demandMultiplier: 0.80,
    fuelMultiplier: 1.0,
    regions: ['NA']
  },
  {
    startOffset: (1992 - 1960) * 12 + 6, // Jul 1992
    duration: 2,
    title: "Barcelona Olympics",
    description: "The Games fill Spanish hotels and the flights into Europe.",
    demandMultiplier: 1.08,
    fuelMultiplier: 1.0,
    regions: ['EU']
  },
  {
    startOffset: (1993 - 1960) * 12, // Jan 1993
    duration: 36,
    title: "Pacific Rim Boom",
    description: "The Asian tigers grow at ten percent a year; business travel and tourism in Asia and Oceania take off.",
    demandMultiplier: 1.12,
    fuelMultiplier: 1.0,
    regions: ['AS', 'OC']
  },
  {
    startOffset: (1997 - 1960) * 12 + 6, // Jul 1997
    duration: 18,
    title: "Asian Financial Crisis",
    description: "Currencies collapse from Thailand to Korea; travel in Asia and Oceania falls sharply.",
    demandMultiplier: 0.78,
    fuelMultiplier: 1.0,
    regions: ['AS', 'OC']
  },
  {
    startOffset: (2000 - 1960) * 12 + 8, // Sep 2000
    duration: 2,
    title: "Sydney Olympics",
    description: "The Games bring the world to Australia for a fortnight, and a month of bookings with it.",
    demandMultiplier: 1.15,
    fuelMultiplier: 1.0,
    regions: ['OC']
  },
  {
    startOffset: (2003 - 1960) * 12 + 2, // Mar 2003
    duration: 5,
    title: "SARS Outbreak",
    description: "A new respiratory disease spreads from Hong Kong; travellers stay away from Asia.",
    demandMultiplier: 0.60,
    fuelMultiplier: 1.0,
    regions: ['AS']
  },
  {
    startOffset: (2008 - 1960) * 12 + 7, // Aug 2008
    duration: 2,
    title: "Beijing Olympics",
    description: "China shows itself to the world and crowds into its airports.",
    demandMultiplier: 1.12,
    fuelMultiplier: 1.0,
    regions: ['AS']
  },
  {
    startOffset: (2010 - 1960) * 12 + 3, // Apr 2010
    duration: 2,
    title: "Eyjafjallajökull Ash Cloud",
    description: "An Icelandic volcano closes European airspace for days; the backlog lingers for weeks.",
    demandMultiplier: 0.60,
    fuelMultiplier: 1.0,
    regions: ['EU']
  },
  {
    startOffset: (2011 - 1960) * 12 + 2, // Mar 2011
    duration: 3,
    title: "Tohoku Earthquake",
    description: "Earthquake, tsunami and nuclear accident in Japan: visitors cancel and flights across Asia thin out.",
    demandMultiplier: 0.85,
    fuelMultiplier: 1.0,
    regions: ['AS']
  },
  {
    startOffset: (2014 - 1960) * 12 + 5, // Jun 2014
    duration: 2,
    title: "Brazil World Cup",
    description: "Fans from every continent fly to South America for the tournament.",
    demandMultiplier: 1.15,
    fuelMultiplier: 1.0,
    regions: ['SA']
  }
];

export let randomEvents: HistoricalEvent[] = [];

export function setRuntimeRandomEvents(evs: HistoricalEvent[]) {
  randomEvents = evs;
}

export function getActiveEvents(currentOffset: number): HistoricalEvent[] {
  const fileEvents = historicalEvents.filter(ev => currentOffset >= ev.startOffset && currentOffset < ev.startOffset + ev.duration);
  const memoryEvents = randomEvents.filter(ev => currentOffset >= ev.startOffset && currentOffset < ev.startOffset + ev.duration);
  return [...fileEvents, ...memoryEvents];
}

/**
 * The world-wide effect of what is happening. A regional event is not in the
 * demand figure: it reaches only the routes it touches, see regionalDemandFactor.
 */
export function getEventMultipliers(currentOffset: number) {
  const activeEvents = getActiveEvents(currentOffset);
  let demandMult = 1.0;
  let fuelMult = 1.0;
  for (const ev of activeEvents) {
    if (!ev.regions || ev.regions.length === 0) demandMult *= ev.demandMultiplier;
    fuelMult *= ev.fuelMultiplier;
  }
  return { demandMult, fuelMult, activeEvents };
}

/**
 * What the regional events running in the month at `offset` do to the demand
 * on a route between two regions: each end feels an event that is in its
 * region fully, and the route the mean of its two ends, so a route with one
 * end in the region loses half of what a route within it does.
 */
export function regionalDemandFactor(offset: number, originRegion: EventRegion, destRegion: EventRegion): number {
  let factor = 1;
  for (const ev of getActiveEvents(offset)) {
    if (!ev.regions || ev.regions.length === 0) continue;
    const at = (region: EventRegion) => (ev.regions!.includes(region) ? ev.demandMultiplier : 1);
    factor *= (at(originRegion) + at(destRegion)) / 2;
  }
  return factor;
}
