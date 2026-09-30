import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { HOVER_CLOSE_DELAY_MS, createHoverCloser } from '../../lib/hoverClose';

/**
 * Closes a dropdown by itself once the mouse has been off it for two seconds.
 *
 * Put the two returned handlers on the element that holds the button and the
 * dropdown together, so moving from one to the other does not count as
 * leaving. Touch screens have no hover, so a tap never starts the countdown
 * there: a dropdown opened by touch stays until it is closed.
 */
export function useHoverAutoClose(open: boolean, onClose: () => void, delayMs = HOVER_CLOSE_DELAY_MS) {
  // The countdown is built once; this ref lets it call the latest onClose.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const closer = useRef<ReturnType<typeof createHoverCloser> | null>(null);
  if (closer.current === null) closer.current = createHoverCloser(() => onCloseRef.current(), delayMs);

  // Closed some other way (a click, a menu entry): nothing is left to count down.
  useEffect(() => {
    if (!open) closer.current?.cancel();
  }, [open]);
  useEffect(() => () => closer.current?.cancel(), []);

  const onPointerEnter = useCallback((e: ReactPointerEvent) => {
    if (e.pointerType !== 'touch') closer.current?.enter();
  }, []);

  const onPointerLeave = useCallback((e: ReactPointerEvent) => {
    if (e.pointerType !== 'touch' && open) closer.current?.leave();
  }, [open]);

  return { onPointerEnter, onPointerLeave };
}
