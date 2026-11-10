import { useCallback, useRef } from 'react';

/**
 * A function that keeps one identity for the life of the component and always
 * runs the latest version of `fn`.
 *
 * For handlers handed to memoised views: a handler that reads state (cash, the
 * fleet, the date) is a new function on every render, which makes React.memo
 * re-render the view each time anything in the parent changes. Listing every
 * piece of state it reads as a useCallback dependency has the same effect.
 * This keeps the view's props equal and still never runs a stale handler.
 */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const latest = useRef(fn);
  latest.current = fn;
  return useCallback((...args: A) => latest.current(...args), []);
}
