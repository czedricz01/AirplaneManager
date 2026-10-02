/**
 * Delayed actions that can all be dropped at once.
 *
 * The route planner pauses for a moment after a save (1.5 to 2 seconds) before
 * it closes itself. A bare `setTimeout` for that keeps running after the
 * planner has gone, and then closes whatever the player opened in the
 * meantime: save a route, click New Route again, and the new planner vanished
 * as soon as the old timer ran out.
 *
 * Collecting the timers here lets the screen cancel every one of them when it
 * unmounts. The bag stays usable afterwards, because React may unmount and
 * mount a screen again with the same instance (Strict Mode does so on purpose).
 */
export function createTimerBag() {
  const pending = new Set<ReturnType<typeof setTimeout>>();

  return {
    /** Runs `action` after `delayMs`, like `setTimeout`, unless `cancelAll` comes first. */
    after(action: () => void, delayMs: number) {
      const id = setTimeout(() => {
        pending.delete(id);
        action();
      }, delayMs);
      pending.add(id);
    },
    /** Drops every action that has not run yet. */
    cancelAll() {
      for (const id of pending) clearTimeout(id);
      pending.clear();
    },
    /** How many actions are still waiting. */
    get size() {
      return pending.size;
    }
  };
}
