/**
 * Small helpers around the month's close: dates of reports, inbox messages for
 * events, the month's one-off items, scenario figures and the rivals' offers.
 *
 * The close itself is `runModelMonth` in `src/lib/modelMonth.ts`, which runs
 * the model's `closeMonth` (`src/model/monthClose.ts`). The old close that
 * lived here was removed in 5.2a.
 */
import { monthOf, yearOf } from './format';
import { HistoricalEvent, eventScope } from './eventSystem';
import { GameMessage, SimulatedRoute } from './gameTypes';
import { ScenarioContext } from './scenarioEval';

export const offsetToDateStr = (offset: number) =>
  `${(monthOf(offset)).toString().padStart(2, '0')}/${yearOf(offset)}`;

export const signedPercent = (multiplier: number) => {
  const pct = Math.round((multiplier - 1.0) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
};

/**
 * Turns an event into the inbox message announcing it.
 *
 * The six scripted historical events used to fire in complete silence: in March
 * 2020 the game multiplied demand by 0.20 and told the player nothing, so an
 * 80% revenue collapse looked like a bug. Only the random events were ever
 * announced, and they had their own copy of this code.
 */
export function buildEventStartMessage(ev: HistoricalEvent, idSeed: number): GameMessage {
  const dateStr = offsetToDateStr(ev.startOffset);
  const demand = signedPercent(ev.demandMultiplier);
  const fuel = signedPercent(ev.fuelMultiplier);
  return {
    id: idSeed,
    text: ev.regions?.length
      ? `${ev.demandMultiplier < 1 ? 'REGIONAL CRISIS' : 'REGIONAL EVENT'}: "${ev.title}" begins${eventScope(ev)}. Demand ${demand} there, for ${ev.duration} months.`
      : `GLOBAL EVENT: "${ev.title}" begins. Demand ${demand}, fuel ${fuel}, for ${ev.duration} months.`,
    isRead: false,
    dateStr,
    details: {
      title: ev.title,
      source: "Global Intelligence Agency",
      content:
        `${ev.description}\n\nActive from ${dateStr} for ${ev.duration} months, ` +
        `through ${offsetToDateStr(ev.startOffset + ev.duration - 1)}.\n\n` +
        `Projected impact:\n` +
        (ev.regions?.length
          ? `\u2022 Passenger demand${eventScope(ev)}: ${demand}, on routes inside the region; a route with one end there feels half of it\n` +
            `\u2022 Everywhere else: no change\n\n`
          : `\u2022 Global passenger demand: ${demand}\n` +
            `\u2022 Jet fuel market index: ${fuel}\n\n`) +
        `These multiply with any other event running at the same time.`
    }
  };
}

export function buildEventEndMessage(ev: HistoricalEvent, idSeed: number, endOffset: number): GameMessage {
  return {
    id: idSeed,
    text: ev.regions?.length ? `"${ev.title}" has ended${eventScope(ev)}. Demand there returns to normal.` : `"${ev.title}" has ended. Demand and fuel return to normal.`,
    isRead: false,
    dateStr: offsetToDateStr(endOffset),
    details: {
      title: `${ev.title} - over`,
      source: "Global Intelligence Agency",
      content:
        `${ev.title} ran for ${ev.duration} months and is no longer in effect.\n\n` +
        `Its ${signedPercent(ev.demandMultiplier)} demand and ${signedPercent(ev.fuelMultiplier)} fuel ` +
        `adjustments have been lifted.`
    }
  };
}

/** Adds a one-off amount to the month's list, merging items with the same label. */
export function addCapexItem(list: { label: string; amount: number }[], label: string, amount: number) {
  return list.some(c => c.label === label)
    ? list.map(c => (c.label === label ? { ...c, amount: c.amount + amount } : c))
    : [...list, { label, amount }];
}

/** The month a saved report closed, as an offset from 01/1960. */
export const reportOffset = (r: { year: number; month: number }) => (r.year - 1960) * 12 + (r.month - 1);

/** The player's routes as a scenario's goals count them: by city pair, with their weekly departures. */
export const scenarioRoutes = (routes: SimulatedRoute[]): ScenarioContext['routes'] =>
  routes.map(r => ({ origin: r.origin, destination: r.destination, weeklyFlights: r.schedule?.length || r.weeklyFlights || 0 }));

/** Seats per departure of a rival route, when its aircraft is known. */
function rivalSeats(ai: any, route: any): { seats?: number } {
  const plane = (ai.fleet || []).find((f: any) => f.reg === route.aircraftReg);
  return Number(plane?.capacity) > 0 ? { seats: Number(plane.capacity) } : {};
}

/** Every rival departure, as offers the finance engine can split demand by. */
export function buildRivalOffers(ais: any[] | null | undefined) {
  return (ais || []).flatMap((ai: any) =>
    (ai.routes || []).map((r: any) => ({
      origin: r.origin,
      destination: r.destination,
      departures: r.departures || 0,
      airline: ai.name,
      // What its aircraft can carry; without it the rival would win passengers it has no seat for.
      ...rivalSeats(ai, r),
      // A rival cutting fares in a price war is that much more attractive.
      ...(r.priceCut > 0 ? { priceAppeal: 1 / (1 - Math.min(0.5, r.priceCut)) } : {})
    }))
  );
}
