/** How long the mouse may stay away from a dropdown before it closes itself. */
export const HOVER_CLOSE_DELAY_MS = 2000;

/**
 * The countdown behind the dropdowns in the top bar (Messages, Map, Menu).
 *
 * `leave` starts it when the mouse moves off the dropdown, `enter` stops it
 * again when the mouse comes back, and once it has run out `onClose` is called.
 * Leaving again starts a fresh two seconds rather than adding to a running
 * count.
 */
export function createHoverCloser(onClose: () => void, delayMs = HOVER_CLOSE_DELAY_MS) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  return {
    /** The mouse is over the dropdown (again): nothing is closed. */
    enter: cancel,
    /** The mouse left the dropdown: it closes after `delayMs` unless the mouse returns. */
    leave() {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        onClose();
      }, delayMs);
    },
    /** Drops a running countdown, e.g. because the dropdown was closed another way. */
    cancel
  };
}
