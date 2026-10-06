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
