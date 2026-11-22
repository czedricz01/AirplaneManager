/**
 * Prices that depend on how the player's airline has fared, read by old code that has no access to the game state.
 * App publishes them while rendering, from pure values. Slot prices no longer come from here: the airport screens
 * read the model's `slotPrice` with research and milestones (`src/lib/modelAirport.ts`, package 4.3); the resale bonus
 * comes from the model's research effects (`src/lib/modelFleet.ts`, package 4.6b).
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
