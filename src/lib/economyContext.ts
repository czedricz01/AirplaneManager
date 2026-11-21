/**
 * Prices that depend on how the player's airline has fared, read by old code that has no access to the game state.
 * App publishes them while rendering, from pure values. Slot prices no longer come from here: the airport screens
 * read the model's `slotPrice` with research and milestones (`src/lib/modelAirport.ts`, package 4.3).
 */

/**
 * What the airline's development projects take off airport charges: the
 * multiplier on the upkeep of the airports it manages, 0.4-1. Published the
 * same way as the slot price, for the airport console and the month close.
 */
let feeFactor = 1;

export function setFeeFactor(factor: number): void {
  feeFactor = Number.isFinite(factor) ? Math.max(0.4, Math.min(1, factor)) : 1;
}

export function getFeeFactor(): number {
  return feeFactor;
}

/**
 * What the airline's development projects add to the resale value of its
 * aircraft: 0.02 = 2% more. Published for the aircraft screen, which shows the
 * sale price without being handed the game state.
 */
let resaleBonus = 0;

export function setResaleBonus(bonus: number): void {
  resaleBonus = Number.isFinite(bonus) ? Math.max(0, Math.min(0.5, bonus)) : 0;
}

export function getResaleBonus(): number {
  return resaleBonus;
}
