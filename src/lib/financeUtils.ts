
import { MEAL_DATA, EXTRAS_OPTIONS } from '../data/catering';
import { REFERENCE_SPEED, distanceKm, timetableLegMinutes } from '../model';
import type { AirportInfrastructure, ManagementLevel } from './gameTypes';
/**
 * Block time for one leg, in minutes, as the timetable stores it: the model's
 * flight time (`timetableLegMinutes`, `blockMinutes` of section 3.1) rounded.
 * The planner, the schedule editor and the month close read the same figure.
 *
 * It used to exist twice, and the two copies disagreed: the schedule editor
 * once used `distance / aircraft.speed * 60 + 20`, and `speed` is not a field
 * on any aircraft, so it produced NaN.
 *
 * Returns 0 when the inputs are unusable, so callers never propagate NaN.
 */
export function getFlightDurationMinutes(
  origin: { coords: [number, number] } | null | undefined,
  dest: { coords: [number, number] } | null | undefined,
  aircraft: { cruiseSpeed?: number } | null | undefined
): number {
  if (!origin?.coords || !dest?.coords || !aircraft) return 0;
  const km = distanceKm(origin.coords, dest.coords);
  if (!Number.isFinite(km)) return 0;
  const total = timetableLegMinutes(km, Number(aircraft.cruiseSpeed) || REFERENCE_SPEED);
  return Number.isFinite(total) ? total : 0;
}

export function validateClassConfigs(classConfigs: any, selectedAircraft: any, airportManagement: any, selectedOrigin: any, selectedDest: any) {
  const baseAllowed = selectedAircraft.class === 'Regional' ? ['Basic'] : selectedAircraft.class === 'Narrowbody' ? ['Basic', 'Standard'] : ['Basic', 'Standard', 'Premium'];
  const allowedCategories = [...baseAllowed];
  const hasAdvancedCateringHub = airportManagement[selectedOrigin?.id]?.hubFacilities?.catering || airportManagement[selectedDest?.id]?.hubFacilities?.catering;
  const hasPremiumGalley = selectedAircraft.config?.details?.hasPremiumCatering;
  const isUpgradeActive = !!(hasAdvancedCateringHub && hasPremiumGalley);

  if (isUpgradeActive) {
    if (selectedAircraft.class === 'Regional') allowedCategories.push('Standard');
    else if (selectedAircraft.class === 'Narrowbody') allowedCategories.push('Premium');
    else allowedCategories.push('Luxury');
  }

  const allowedPrefixes: string[] = [];
  if (allowedCategories.includes('Basic')) allowedPrefixes.push('b');
  if (allowedCategories.includes('Standard')) allowedPrefixes.push('s');
  if (allowedCategories.includes('Premium')) allowedPrefixes.push('p');
  if (allowedCategories.includes('Luxury')) allowedPrefixes.push('l');

  const hasWifi = selectedAircraft.config?.details?.hasWifi;
  const newConfigs: any = { ...classConfigs };
  let changed = false;

  Object.keys(newConfigs).forEach(cls => {
    const current = newConfigs[cls];
    if (!current || !current.catering) return;

    let classChanged = false;

    const catArray = [...current.catering];
    for (let i = 0; i < catArray.length; i++) {
        const mealIds = catArray[i];
        if (Array.isArray(mealIds)) {
            const filtered = mealIds.filter((id: string) => id === 'none' || allowedPrefixes.some(pf => id.startsWith(pf)));
            if (filtered.length !== mealIds.length) {
                catArray[i] = filtered.length > 0 ? filtered : ['none'];
                classChanged = true;
            }
        }
    }

    const oldExtras = (current.extras || []).join(',');
    const capabilityFiltered = (current.extras || []).filter((ext: string) => {
        if (ext === 'wifi_limited' || ext === 'wifi_unlimited') return hasWifi;
        if (ext === 'premium_alcohol') return hasPremiumGalley;
        return true;
    });
    // Collapse any stale double-selection within a tiered family (e.g. a preset
    // saved before groups existed) down to the best remaining tier. Must run
    // AFTER the capability filter: collapsing first could keep a tier the
    // aircraft can no longer support, losing a still-valid lower tier.
    const filteredExtras = resolveExclusiveGroups(capabilityFiltered, EXTRAS_OPTIONS);
    const nextExtras = filteredExtras.length > 0 ? filteredExtras : ['none'];
    if (nextExtras.join(',') !== oldExtras) classChanged = true;

    // Replace the whole class object rather than writing into it: a shallow spread of
    // `classConfigs` still shares these nested objects with the caller's React state.
    if (classChanged) {
      newConfigs[cls] = { ...current, catering: catArray, extras: nextExtras };
      changed = true;
    }
  });

  return changed ? newConfigs : classConfigs;
}

export function getCateringOpt(ids: string | string[] | string[][], activeIndex?: number) {
  if (!ids) return { label: 'None', cost: 0, sat: 0 };
  
  let mealIds: string[] = [];
  if (Array.isArray(ids)) {
    if (typeof ids[0] === 'string') {
      mealIds = ids as string[];
    } else {
      mealIds = (ids as string[][])[activeIndex ?? 0] || ['none'];
    }
  } else {
    mealIds = [ids as string];
  }

  const activeMealIds = mealIds.filter(id => id !== 'none');
  if (activeMealIds.length === 0) return { label: 'None', cost: 0, sat: 0 };

  let totalCost = 0;
  let totalSat = 0;
  let labels: string[] = [];

  activeMealIds.forEach(id => {
    let found = null;
    for (const cat in MEAL_DATA) {
      found = MEAL_DATA[cat].find(m => m.id === id);
      if (found) break;
    }
    if (found) {
      totalCost += found.cost;
      totalSat += found.sat;
      labels.push(found.label);
    }
  });

  if (labels.length === 0) return { label: 'None', cost: 0, sat: 0 };

  const n = labels.length;
  // Cost is additive: serving N physical meal items costs what N items cost,
  // not an average of one. Sat stays average-based since perceived quality of
  // a combined meal tracks its average, not its sum.
  let sumCost = totalCost;
  let avgSat = totalSat / n;

  if (n > 1) {
    const extraCount = n - 1;
    sumCost = sumCost * (1 + (extraCount * 0.05));
    avgSat = avgSat * (1 + (extraCount * 0.075));
  }

  return {
    label: labels.join(', '),
    cost: Math.round(sumCost * 100) / 100,
    sat: Math.round(avgSat * 10) / 10
  };
}

// Tiered families (Wi-Fi, amenity kits, alcohol) are single-choice: if a stale
// selection somehow holds two tiers of the same family (e.g. a preset saved
// before groups existed), keep only the highest-sat tier so it's never
// double-counted. A no-op for option sets whose entries carry no `group`
// (e.g. SERVICE_OPTIONS).
function resolveExclusiveGroups(ids: string[], options: Record<string, { sat: number, group?: string }>): string[] {
  const bestOfGroup = new Map<string, string>();
  ids.forEach(id => {
    const group = options[id]?.group;
    if (group && (!bestOfGroup.has(group) || options[id].sat > options[bestOfGroup.get(group)!].sat)) {
      bestOfGroup.set(group, id);
    }
  });
  return ids.filter(id => {
    const group = options[id]?.group;
    return !group || bestOfGroup.get(group) === id;
  });
}

export function getMultiOptionSum(ids: string[], options: Record<string, { label: string, cost: number, sat: number, group?: string }>) {
  const activeIds = ids.filter(id => id !== 'none');
  if (activeIds.length === 0) return { label: 'None', cost: 0, sat: 0 };

  const resolvedIds = resolveExclusiveGroups(activeIds, options);

  let cost = 0;
  let sat = 0;
  let labels: string[] = [];

  resolvedIds.forEach(id => {
    if (options[id]) {
      cost += options[id].cost;
      sat += options[id].sat;
      labels.push(options[id].label);
    }
  });

  return {
    label: labels.join(', '),
    cost,
    sat
  };
}

export const CABIN_CLASSES = ['economy', 'premium', 'business', 'first'] as const;

/** A class's cabin set-up, falling back to "general" and then to nothing at all. */
export function classConfigFor(classConfigs: Record<string, any> | undefined, cabinClass: string) {
  const configs = classConfigs || {};
  return configs[cabinClass] || configs.general || { catering: [['none']], extras: ['none'], service: ['none'] };
}

/**
 * One airline's offer on a city pair, for the market-share split below.
 */
export interface RouteOffer {
  origin: string;
  destination: string;
  /** Departures per week. */
  departures: number;
  /** Who flies it, for display only. Never used in the share calculation. */
  airline?: string;
  /**
   * How much better than the going fare this offer is priced, 1 when it is
   * neither dearer nor cheaper: a rival that cuts fares by 12% has 1 / 0.88.
   * Feeds the share split like the player's own price does.
   */
  priceAppeal?: number;
  /**
   * Seats per departure, all cabins together. With it the offer can carry no
   * more than its aircraft hold, and passengers it has no seat for fly with
   * someone else. Left out, the offer is not limited.
   */
  seats?: number;
}

/** City pair, direction-insensitive: FRA-CDG and CDG-FRA are the same market. */
export const marketKey = (a: string, b: string) => [a, b].sort().join('>');

/**
 * Rival AI routes grouped by exact city pair, for an O(1) "how many rivals
 * fly this exact route" lookup per candidate. Keying by `marketKey` (both
 * endpoints) rather than by a single airport is what makes this exact --
 * grouping by destination alone would count every rival merely touching that
 * airport, on any origin, as "competition" on a route that hasn't been picked
 * yet.
 */
export function buildRivalRoutesByPair(aiAirlines: any[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const ai of aiAirlines || []) {
    for (const r of ai.routes || []) {
      const key = marketKey(r.origin, r.destination);
      m.set(key, (m.get(key) || 0) + 1);
    }
  }
  return m;
}

/**
 * Infrastructure after unlocking a management tier. Never lowers the tier.
 * Every tier brings at least one standard check-in desk (as the start hub,
 * `START_HUB_SETUP`, 7.7); tier 2 and above turn on the hub auto-upgrade,
 * which keeps a stand for every slot -- in the model those stands cost no
 * rent (`standRent`, E28, SPEZIFIKATION 5.10). No price here: the tier's
 * price is the model's `managementTierPrice` (`tierPrice` in modelAirport.ts).
 */
export function applyManagementUnlock(infra: AirportInfrastructure | undefined, tier: ManagementLevel): AirportInfrastructure {
  const base: AirportInfrastructure = infra || {
    level: 0,
    slots: { regional: 0, narrowbody: 0, widebody: 0 },
    stands: { regional: 0, narrowbody: 0, widebody: 0 },
    desks: { normal: 0, self: 0 }
  };
  const slots = base.slots || { regional: 0, narrowbody: 0, widebody: 0 };
  const level = Math.max(Number(base.level) || 0, tier) as ManagementLevel;
  const desks = { normal: base.desks?.normal ?? 0, self: base.desks?.self ?? 0 };
  if (desks.normal < 1) desks.normal = 1;
  return {
    ...base,
    slots,
    desks,
    level,
    hubAutoUpgrade: level >= 2,
    ...(level >= 2
      ? {
          stands: {
            ...base.stands,
            regional: slots.regional || 0,
            narrowbody: slots.narrowbody || 0,
            widebody: slots.widebody || 0
          }
        }
      : {})
  };
}

/** How buying and selling slots is listed among the month's one-off spending. */
export const SLOT_CAPEX_LABEL = 'Airport Slots';

export interface InfraChangeParams {
  /** Current infrastructure for one airport; never mutated. */
  infra: any;
  type: 'slots' | 'stands' | 'desks';
  subType: string;
  /** Signed delta requested, already multiplied for a shift-click. */
  requestedAmount: number;
  hubAutoUpgrade: boolean;
  autoBuyStands: boolean;
  /** Free purchasable slots at this airport; only consulted when buying slots. */
  availableSlots: number;
  /** Weekly slots this subType already has scheduled — the floor a sell cannot cross. */
  utilizedSlots: number;
  /** Purchase price of one slot (`slotBuyPrice`, model 5.10) for slots, 0 for stands/desks. */
  costPerUnit: number;
  /** What one slot sold back pays in (`slotSalePrice`, model 5.10); half of `costPerUnit` when left out. */
  refundPerUnit?: number;
  /** Desks of subType 'normal' can't be sold below this (0 unless the caller enforces a minimum). */
  minNormalDesks?: number;
}

export interface InfraChangeResult {
  /** New infra to persist, or the original object unchanged if actualAmount is 0. */
  infra: any;
  /** The delta actually applied, after every clamp below. */
  actualAmount: number;
  /** Signed amount to bill: positive charges, negative refunds. Always 0 for stands/desks. */
  cost: number;
  reason: 'ok' | 'no-availability' | 'sell-floor' | 'stands-need-slots' | 'noop';
}

/**
 * The single place that may change an airport's rented slots, stands or desks.
 * Both the Hub Management console and the New Route wizard call this so the two
 * screens can't drift apart: a slot sell here can never cross the utilized-slots
 * floor (which used to let free slots go negative), and stands are auto-shrunk
 * to stay within the new slot count (which used to leave stands > slots after a
 * sell made through the wizard).
 */
export function applyInfrastructureChange(params: InfraChangeParams): InfraChangeResult {
  const {
    infra, type, subType, requestedAmount, hubAutoUpgrade, autoBuyStands,
    availableSlots, utilizedSlots, costPerUnit, minNormalDesks = 0
  } = params;
  const refundPerUnit = params.refundPerUnit ?? costPerUnit * 0.5;

  const newInfra = JSON.parse(JSON.stringify(infra));
  if (!newInfra[type]) newInfra[type] = {};
  const currentCount = newInfra[type][subType] || 0;

  let actualAmount = requestedAmount;

  // Can only sell what we have.
  if (currentCount + actualAmount < 0) {
    actualAmount = -currentCount;
  }

  if (type === 'slots') {
    if (actualAmount > 0 && actualAmount > availableSlots) {
      actualAmount = availableSlots;
    }
    if (actualAmount < 0 && currentCount + actualAmount < utilizedSlots) {
      actualAmount = utilizedSlots - currentCount;
    }
  }

  if (type === 'stands' && actualAmount > 0) {
    const slotLimit = newInfra.slots?.[subType] || 0;
    if (currentCount + actualAmount > slotLimit) {
      actualAmount = slotLimit - currentCount;
    }
  }

  if (type === 'desks' && subType === 'normal' && currentCount + actualAmount < minNormalDesks) {
    actualAmount = minNormalDesks - currentCount;
  }

  if (actualAmount === 0) {
    let reason: InfraChangeResult['reason'] = 'noop';
    if (type === 'slots' && requestedAmount > 0) reason = 'no-availability';
    else if (type === 'slots' && requestedAmount < 0) reason = 'sell-floor';
    else if (type === 'stands' && requestedAmount > 0) reason = 'stands-need-slots';
    return { infra, actualAmount: 0, cost: 0, reason };
  }

  newInfra[type][subType] = currentCount + actualAmount;

  let cost = 0;
  if (type === 'slots') {
    // Selling pays in the resale price (model: SLOT_RESALE_SHARE of today's price).
    cost = actualAmount > 0 ? costPerUnit * actualAmount : refundPerUnit * actualAmount;

    if (actualAmount > 0 && (hubAutoUpgrade || autoBuyStands)) {
      newInfra.stands = { ...newInfra.stands };
      newInfra.stands[subType] = (newInfra.stands[subType] || 0) + actualAmount;
    }

    if (actualAmount < 0) {
      const newSlotCount = currentCount + actualAmount;
      if (newInfra.stands && (newInfra.stands[subType] || 0) > newSlotCount) {
        newInfra.stands = { ...newInfra.stands };
        newInfra.stands[subType] = newSlotCount;
      }
    }
  }

  return { infra: newInfra, actualAmount, cost, reason: 'ok' };
}
