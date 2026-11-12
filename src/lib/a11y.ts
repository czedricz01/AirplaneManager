import type { KeyboardEvent } from 'react';

/**
 * Lets a clickable area that is not a <button> work from the keyboard: Enter
 * or Space does what a click does. Use it together with `tabIndex={0}` and,
 * outside tables, `role="button"`.
 *
 * Keys pressed inside a control within the area (a field, a nested button)
 * are left alone.
 */
export function clickOnKey(e: KeyboardEvent<HTMLElement>): void {
  if (e.target !== e.currentTarget) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.currentTarget.click();
  }
}
