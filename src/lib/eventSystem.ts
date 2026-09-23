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
}

export interface HistoricalEvent {
  startOffset: number; // calculated from 1960
  duration: number; // months
  title: string;
  description: string;
  demandMultiplier: number; // 1.0 = normal
  fuelMultiplier: number; // 1.0 = normal
  choices?: EventChoice[];
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
    description: "Global passenger demand has plummeted dramatically.",
    demandMultiplier: 0.65,
    fuelMultiplier: 1.0,
  },
  {
    startOffset: (2008 - 1960) * 12 + 8, // Sep 2008
    duration: 24,
    title: "Global Financial Crisis",
    description: "A severe worldwide economic crisis resulting in depressed passenger demand and volatile fuel prices.",
    demandMultiplier: 0.75,
    fuelMultiplier: 1.2,
  },
  {
    startOffset: (2020 - 1960) * 12 + 2, // Mar 2020
    duration: 24,
    title: "Global Pandemic",
    description: "International borders close and aviation demand nearly vanishes.",
    demandMultiplier: 0.20,
    fuelMultiplier: 0.7,
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

export function getEventMultipliers(currentOffset: number) {
  const activeEvents = getActiveEvents(currentOffset);
  let demandMult = 1.0;
  let fuelMult = 1.0;
  for (const ev of activeEvents) {
    demandMult *= ev.demandMultiplier;
    fuelMult *= ev.fuelMultiplier;
  }
  return { demandMult, fuelMult, activeEvents };
}
