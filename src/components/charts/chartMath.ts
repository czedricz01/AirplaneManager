/**
 * The arithmetic behind the history charts: scales, round axis ticks, gaps in
 * the data and the calendar ticks along the bottom. Pure, so it is tested on
 * its own; LineChart only draws what comes out of here.
 */
import { CALENDAR_START_YEAR, formatMonthOffset } from '../../lib/format';

/** A value on the chart, or a month without one (drawn as a gap). */
export type ChartValue = number | null | undefined;

export const isValue = (v: ChartValue): v is number => typeof v === 'number' && Number.isFinite(v);

/** The smallest and largest value across all series, null when there is none. */
export function extentOf(series: ChartValue[][]): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (const values of series) {
    for (const v of values) {
      if (!isValue(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return min <= max ? [min, max] : null;
}

/**
 * A round step for about `count` intervals over `span`: 1, 2 or 5 times a
 * power of ten, the steps a reader counts in without thinking.
 */
export function niceStep(span: number, count: number): number {
  if (!(span > 0) || !(count > 0)) return 1;
  const raw = span / count;
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

export interface NiceTicks {
  /** The axis runs from min to max, both on a tick. */
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

/**
 * Round ticks covering [min, max] in about `count` steps. The axis is widened
 * to the ticks either side. A flat series (min = max) still gets an axis
 * around its value.
 */
export function niceTicks(min: number, max: number, count = 5): NiceTicks {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, step: 1, ticks: [0, 1] };
  if (min > max) [min, max] = [max, min];
  if (min === max) {
    const pad = min === 0 ? 1 : Math.abs(min) * 0.1;
    min -= pad;
    max += pad;
  }
  const step = niceStep(max - min, count);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  // Rounded through the step's own precision so 0.1 + 0.2 never shows up as 0.30000000000000004.
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(decimals)));
  return { min: ticks[0], max: ticks[ticks.length - 1], step, ticks };
}

/** Maps [d0, d1] onto [r0, r1]; a zero-width domain maps to the middle of the range. */
export function scaleLinear(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  const span = d1 - d0;
  if (span === 0) return () => (r0 + r1) / 2;
  return v => r0 + ((v - d0) / span) * (r1 - r0);
}

/** Runs of consecutive indices that have a value. Each run is drawn as one line; the months between are gaps. */
export function segmentsOf(values: ChartValue[]): number[][] {
  const runs: number[][] = [];
  let run: number[] = [];
  values.forEach((v, i) => {
    if (isValue(v)) run.push(i);
    else if (run.length > 0) {
      runs.push(run);
      run = [];
    }
  });
  if (run.length > 0) runs.push(run);
  return runs;
}

/** The data index nearest to `x` on a plot `width` wide starting at `left`, for `n` evenly spaced points. */
export function nearestIndex(x: number, left: number, width: number, n: number): number {
  if (n <= 1 || !(width > 0)) return 0;
  const i = Math.round(((x - left) / width) * (n - 1));
  return Math.max(0, Math.min(n - 1, i));
}

/** Month steps the bottom axis may use, smallest first. */
const MONTH_STEPS = [1, 2, 3, 6, 12, 24, 60, 120];

export interface TimeTick {
  index: number;
  label: string;
}

/**
 * Calendar ticks for consecutive month offsets, at most `maxTicks` of them.
 * A step of a year or more puts a tick on each January it passes, labelled
 * with the year; shorter steps land on round months and show the month too.
 */
export function timeTicks(offsets: number[], maxTicks: number): TimeTick[] {
  const n = offsets.length;
  if (n === 0) return [];
  const limit = Math.max(1, Math.floor(maxTicks));
  const step = MONTH_STEPS.find(s => Math.ceil(n / s) <= limit) ?? MONTH_STEPS[MONTH_STEPS.length - 1];
  const ticks: TimeTick[] = [];
  offsets.forEach((offset, index) => {
    if (step >= 12) {
      const year = CALENDAR_START_YEAR + Math.floor(offset / 12);
      if (offset % 12 === 0 && year % (step / 12) === 0) ticks.push({ index, label: String(year) });
    } else if (offset % step === 0) {
      ticks.push({ index, label: formatMonthOffset(offset) });
    }
  });
  // A short window that holds none of the round months still gets its first month.
  return ticks.length > 0 ? ticks : [{ index: 0, label: formatMonthOffset(offsets[0]) }];
}
