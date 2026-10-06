/**
 * Prices that depend on how the player's airline has fared, read by code that
 * has no access to the game state -- the airport console, the route planner
 * and the purchase rules all ask getSlotPurchaseCost for a price.
 *
 * Passing the factor down through every one of those screens would touch a
 * dozen props for one number, so App publishes it here whenever the
 * milestones change and the pricing code reads it. It is set while rendering
 * from a pure value (see App.tsx), never from an event, so a screen can not
 * show a price the next purchase would not charge.
 */
let slotPriceFactor = 1;

/** Sets the multiplier on airport slot prices, 0.5-1. */
export function setSlotPriceFactor(factor: number): void {
  slotPriceFactor = Number.isFinite(factor) ? Math.max(0.5, Math.min(1, factor)) : 1;
}

export function getSlotPriceFactor(): number {
  return slotPriceFactor;
}

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
