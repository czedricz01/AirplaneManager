/**
 * Viewport sizes the interface is laid out for. Kept in step with the `rail`,
 * `bar` and `short` variants in src/index.css.
 *
 * The desktop interface is designed for 1280px. Between PHONE_MAX_WIDTH and
 * DESIGN_WIDTH it is scaled down as a whole, which keeps a tablet or a small
 * laptop looking like the desktop. On a phone that stops working: at 390px
 * upright everything would shrink to 30%, and at 844x390 sideways to 66%,
 * both too small to read or tap. Phones therefore get their own layouts at
 * full size instead. PHONE_MAX_WIDTH is Tailwind's `md` breakpoint.
 */
export const PHONE_MAX_WIDTH = 768;
export const PHONE_LANDSCAPE_MAX_HEIGHT = 500;
export const DESIGN_WIDTH = 1280;

/** A phone held sideways: wider than tall, and short. */
export function isPhoneLandscape(width: number, height: number): boolean {
  return width > height && height <= PHONE_LANDSCAPE_MAX_HEIGHT;
}

/** The factor the whole interface is scaled by at a given viewport size. */
export function autoScaleFor(width: number, height: number): number {
  if (width < PHONE_MAX_WIDTH || width >= DESIGN_WIDTH) return 1;
  if (isPhoneLandscape(width, height)) return 1;
  return width / DESIGN_WIDTH;
}
