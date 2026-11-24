/**
 * World events as the interface shows them, built from the model's data.
 *
 * Which events there are, when, for how long, how hard they hit and what a
 * crisis response does and costs are the model's (SPEZIFIKATION 8.4, 8.5:
 * `HISTORICAL_EVENTS`, `RANDOM_EVENT_TEMPLATES`, `FUEL_CRISES`,
 * `activeWorldEvents`, `crisisResponsePrice`). Only the wording of the crisis
 * responses lives here (`EVENT_CHOICE_TEXTS`). The old table of its own, with
 * fixed placeholder prices, and the module state of random events were
 * removed in 5.2b.
 */
import { FUEL_CRISES, HISTORICAL_EVENTS, RANDOM_EVENT_TEMPLATES } from '../model/constants';
import { activeWorldEvents, type WorldEvent } from '../model/monthEvents';

/**
 * Something the player can do about an event, offered once when it begins.
 * A choice costs money up front and changes how the event hits the player --
 * and only the player, never the AI airlines.
 */
export interface EventChoice {
  id: string;
  label: string;
  detail: string;
  /** Charged once, when the choice is taken: the model's price (`pricedChoices` in modelEvents.ts); 0 until priced. */
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
  /**
   * The model cannot price it yet: no month closed, or one without flights, so no fuel bill or revenue to take a share
   * of (docs/neubau 4.7c, 8.5). Not selectable until a month with flights has been closed.
   */
  unpriced?: boolean;
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
  /** Highest factor of the fuel table during the event (`FUEL_CRISES`, 5.2); 1 for every other event. For texts only. */
  fuelMultiplier: number;
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

/** A paid answer: hedge fuel. Priced by the model (8.5). */
const HEDGE: EventChoice = {
  id: 'hedge',
  label: 'Hedge fuel for the duration',
  detail: 'Lock your jet fuel price at last month\'s level until the crisis is over. Your rivals keep paying the market rate. If fuel gets cheaper instead, you still pay the locked price.',
  cost: 0,
  hedgesFuel: true
};

/** "Do nothing" for a fuel crisis. */
const RIDE_FUEL: EventChoice = {
  id: 'ride',
  label: 'Ride it out',
  detail: 'Pay the market price for fuel, whatever it does. Costs nothing now.',
  cost: 0
};

/**
 * The wording of the crisis responses, by event title: the six world events with a response in the model
 * (`HISTORICAL_EVENTS[].response`). `softensDemand` is the model's recovery share `r` (8.5). Prices: `pricedChoices`.
 */
export const EVENT_CHOICE_TEXTS: Readonly<Record<string, readonly EventChoice[]>> = {
  '1973 Oil Crisis': [HEDGE, RIDE_FUEL],
  '1979 Energy Crisis': [HEDGE, RIDE_FUEL],
  'Gulf War Oil Shock': [HEDGE, RIDE_FUEL],
  'Aviation Downturn': [
    {
      id: 'reassure',
      label: 'Campaign to win passengers back',
      detail: 'Advertising, refunds and flexible rebooking while confidence recovers. Recovers roughly 40% of the demand you would otherwise lose, for you alone.',
      cost: 0,
      softensDemand: recoveryShare('Aviation Downturn')
    },
    { id: 'ride', label: 'Wait for confidence to return', detail: 'Fly the schedule and absorb the empty seats. Costs nothing now.', cost: 0 }
  ],
  'Global Financial Crisis': [
    {
      id: 'yield',
      label: 'Chase volume with cut fares',
      detail: 'Discount aggressively and market hard for two years to keep the aircraft full. Recovers roughly a third of the lost demand, for you alone.',
      cost: 0,
      softensDemand: recoveryShare('Global Financial Crisis')
    },
    { id: 'ride', label: 'Hold your fares', detail: 'Protect yield and fly emptier. Costs nothing now.', cost: 0 }
  ],
  'Global Pandemic': [
    {
      id: 'cargo',
      label: 'Convert cabins to cargo',
      detail: 'Strip seats and fly freight while nobody is travelling. Expensive and slow to reverse, but recovers roughly 35% of a demand collapse that is otherwise near-total.',
      cost: 0,
      softensDemand: recoveryShare('Global Pandemic')
    },
    { id: 'ride', label: 'Park the aircraft and wait', detail: 'Fly the schedule into empty cabins for two years. Costs nothing now.', cost: 0 }
  ]
};

/** The model's recovery share `r` of a historical event (8.5); 0 when it has none. */
function recoveryShare(title: string): number {
  return HISTORICAL_EVENTS.find(e => e.title === title)?.response?.recoveryShare ?? 0;
}

/**
 * A model event as the interface shows it: text from the model's data (historical, else the random template), the
 * fuel table's peak for an oil crisis (texts only), and for a historical event with a response its answers (unpriced).
 */
export function appEvent(ev: WorldEvent): HistoricalEvent {
  const historical = HISTORICAL_EVENTS.find(e => e.title === ev.title && e.startMonth === ev.startMonth);
  const description = historical?.description ?? RANDOM_EVENT_TEMPLATES.find(t => t.title === ev.title)?.description ?? '';
  const fuel = historical ? FUEL_CRISES.find(c => c.name === ev.title && c.startMonth === ev.startMonth)?.factor : undefined;
  const choices = historical?.response ? EVENT_CHOICE_TEXTS[ev.title] : undefined;
  return {
    startOffset: ev.startMonth,
    duration: ev.months,
    title: ev.title,
    description,
    demandMultiplier: ev.demandMultiplier,
    fuelMultiplier: fuel ?? 1,
    ...(choices ? { choices: choices.map(c => ({ ...c })) } : {}),
    ...(ev.regions && ev.regions.length > 0 ? { regions: [...ev.regions] as EventRegion[] } : {})
  };
}

/** The 17 historical events of the model (`HISTORICAL_EVENTS`, 8.4) as the interface shows them. */
export const historicalEvents: readonly HistoricalEvent[] = HISTORICAL_EVENTS.map(appEvent);

/**
 * The events running in the month at `month`, historical ones and the rolled ones of the game's world
 * (`randomEvents`, `ModelState.randomEvents`), in the model's order (`activeWorldEvents`, 8.4).
 */
export function activeEvents(month: number, randomEvents: readonly WorldEvent[] = []): HistoricalEvent[] {
  return activeWorldEvents(month, randomEvents).map(appEvent);
}
