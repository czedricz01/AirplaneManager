/**
 * Taking over a rival airline.
 *
 * A rival in distress is put up for sale (see aiSimulation.ts) and is wound up
 * a year later if nobody buys it. From the rank International on, the player
 * can buy one: its aircraft join the fleet, its slots at its home airport
 * become the player's, and the competitor is gone. Its routes are not taken
 * over -- they are the previous owner's timetables -- and its debts stay with
 * the bankrupt estate. From the rank Global Player the player can also bid for
 * a healthy rival, at a premium.
 *
 * Everything here is pure.
 */
import { aircraftList } from '../data/aircraft';
import { createOwnedAircraft, defaultCabin } from './fleet';
import { getAircraftResaleValue } from './financeUtils';
import { RANK_NEEDED, rankGateMessage } from './airlineRank';
import type { AiAirline } from '../components/CompetitorsView';
import type { OwnedAircraft } from '../components/MyFleetView';

/** What a distressed carrier fetches: this share of what its fleet would sell for, plus a sum per route. */
export const DISTRESS_PRICE_FACTOR = 0.8;
/** A healthy rival costs this many times as much. */
export const HEALTHY_PREMIUM = 2.5;
export const PRICE_PER_ROUTE = 250_000;
export const MIN_PRICE = 1_000_000;

export interface TakeoverQuote {
  price: number;
  aircraft: number;
  routes: number;
  /** Why the player cannot buy it, or null when they can (cash aside). */
  blocked: string | null;
}

/** The price of an airline and whether the player's rank allows the purchase. */
export function takeoverQuote(ai: Pick<AiAirline, 'fleet' | 'routes' | 'forSale' | 'name'>, rank: number): TakeoverQuote {
  const fleetValue = ai.fleet.reduce((sum, p) => sum + getAircraftResaleValue({
    basePrice: p.basePrice,
    conditionGeneral: p.conditionGeneral,
    conditionInterior: p.conditionInterior
  }), 0);
  const base = fleetValue * DISTRESS_PRICE_FACTOR + ai.routes.length * PRICE_PER_ROUTE;
  const price = Math.max(MIN_PRICE, Math.round((ai.forSale ? base : base * HEALTHY_PREMIUM) / 50_000) * 50_000);
  const blocked = rankGateMessage(
    rank,
    ai.forSale ? RANK_NEEDED.takeoverDistressed : RANK_NEEDED.takeoverHealthy,
    ai.forSale ? `Buying ${ai.name}` : `A takeover bid for ${ai.name}, which is not for sale,`
  );
  return { price, aircraft: ai.fleet.length, routes: ai.routes.length, blocked };
}

export interface TakeoverDeal {
  aircraft: OwnedAircraft[];
  /** Weekly departures the rival flew from its home airport, per aircraft class: the slots the player is given there. */
  slots: { regional: number; narrowbody: number; widebody: number };
  hub: string;
}

/**
 * The aircraft and slots a takeover brings. Aircraft keep their age and
 * condition and come with a plain economy cabin, as a new purchase does.
 */
export function buildTakeover(ai: AiAirline, existingRegistrations: string[]): TakeoverDeal {
  const taken = [...existingRegistrations];
  const aircraft: OwnedAircraft[] = [];
  for (const plane of ai.fleet) {
    const spec = aircraftList.find(a => a.id === plane.id);
    if (!spec) continue;
    const { config, baseInteriorPop } = defaultCabin(spec);
    const [bought] = createOwnedAircraft(spec, 1, {
      config,
      baseInteriorPop,
      hub: ai.hub,
      existingRegistrations: taken,
      purchasedAt: plane.purchasedAt ?? 0
    });
    taken.push(bought.registration);
    aircraft.push({
      ...bought,
      hubId: ai.hub,
      conditionInterior: plane.conditionInterior ?? 100,
      conditionGeneral: plane.conditionGeneral ?? 100
    });
  }
  const slots = { regional: 0, narrowbody: 0, widebody: 0 };
  for (const r of ai.routes) {
    if (r.origin !== ai.hub && r.origin !== ai.secondHub) continue;
    const cls = (r.aircraftClass || 'narrowbody') as keyof typeof slots;
    if (cls in slots) slots[cls] += Math.max(0, r.departures || 0);
  }
  return { aircraft, slots, hub: ai.hub };
}

/** Infrastructure at the rival's home airport after the takeover: tier 1 at least, and the slots added. */
export function withTakenSlots(
  infra: any | undefined,
  slots: { regional: number; narrowbody: number; widebody: number }
): any {
  const base = infra || {
    level: 1,
    slots: { regional: 0, narrowbody: 0, widebody: 0 },
    stands: { regional: 0, narrowbody: 0, widebody: 0 },
    desks: { normal: 1, self: 0 }
  };
  const held = base.slots || { regional: 0, narrowbody: 0, widebody: 0 };
  return {
    ...base,
    level: Math.max(1, Number(base.level) || 0),
    slots: {
      regional: (held.regional || 0) + slots.regional,
      narrowbody: (held.narrowbody || 0) + slots.narrowbody,
      widebody: (held.widebody || 0) + slots.widebody
    },
    desks: { normal: Math.max(1, base.desks?.normal || 0), self: base.desks?.self || 0 }
  };
}
