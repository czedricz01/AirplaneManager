import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { CHART_COLORS } from '../../lib/theme';
import { formatMonthOffset } from '../../lib/format';
import { extentOf, isValue, nearestIndex, niceTicks, scaleLinear, segmentsOf, timeTicks, type ChartValue } from './chartMath';

export interface LineSeries {
  id: string;
  label: string;
  /** One of CHART_COLORS.series, in order. */
  color: string;
  /** One value per month in `offsets`; null or undefined leaves a gap. */
  values: ChartValue[];
}

export interface LineChartProps {
  /** One or two series on the same scale. Two measures of different scale belong in two charts. */
  series: LineSeries[];
  /** The month offset of each point, consecutive, oldest first. */
  offsets: number[];
  /** A value as the tooltip shows it. */
  formatValue: (v: number) => string;
  /** A value as the axis shows it; defaults to formatValue. */
  formatTick?: (v: number) => string;
  /** A fixed vertical scale, e.g. [0, 100] for reputation. Otherwise it fits the data. */
  domain?: [number, number];
  /** Keep zero on the scale when fitting the data. Default true: magnitudes read honestly from zero. */
  includeZero?: boolean;
  /** Thresholds drawn as labelled hairlines, e.g. the strike line on morale. */
  references?: { value: number; label: string }[];
  /** Height of the whole chart, axes included, in px. */
  height?: number;
  /** What the chart shows, for screen readers. */
  ariaLabel: string;
  /** An extra line for the tooltip at a month, e.g. a share. */
  note?: (index: number) => string | null;
}

const MARGIN = { top: 12, right: 12, bottom: 24 };
/** Roughly the width of one axis character at 10px mono, for sizing the left margin. */
const CHAR_PX = 6.2;

/**
 * A line chart in plain SVG, drawn at the width it is given so its text stays
 * at text size. Thin lines, hairline grid, a ringed dot on each series' latest
 * value, and a crosshair that snaps to the nearest month with one tooltip for
 * every series. Months without a value are gaps, not zeros. The arrow keys
 * move the crosshair when the chart has focus.
 */
export function LineChart({
  series, offsets, formatValue, formatTick = formatValue, domain, includeZero = true, references = [], height = 220, ariaLabel, note
}: LineChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  const n = offsets.length;
  const extent = useMemo(() => extentOf(series.map(s => s.values)), [series]);
  const empty = n === 0 || extent === null;

  // Measured before the first paint, so the chart never shows at a guessed width.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(240, Math.round(el.clientWidth)));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
    // Re-attached when the chart switches between its empty state and a plot: they are different elements.
  }, [empty]);

  const layout = useMemo(() => {
    const innerH = height - MARGIN.top - MARGIN.bottom;
    let lo: number;
    let hi: number;
    if (domain) {
      [lo, hi] = domain;
    } else {
      [lo, hi] = extent ?? [0, 1];
      for (const r of references) {
        lo = Math.min(lo, r.value);
        hi = Math.max(hi, r.value);
      }
      if (includeZero) {
        lo = Math.min(0, lo);
        hi = Math.max(0, hi);
      }
    }
    const yTicks = niceTicks(lo, hi, Math.max(3, Math.floor(innerH / 36)));
    const left = Math.ceil(Math.max(...yTicks.ticks.map(t => formatTick(t).length)) * CHAR_PX) + 12;
    const innerW = Math.max(40, width - left - MARGIN.right);
    const x = (i: number) => (n <= 1 ? left + innerW / 2 : left + (i / (n - 1)) * innerW);
    const y = scaleLinear(yTicks.min, yTicks.max, MARGIN.top + innerH, MARGIN.top);
    return { innerH, innerW, left, x, y, yTicks, xTicks: timeTicks(offsets, Math.floor(innerW / 84)) };
  }, [height, domain, extent, references, includeZero, formatTick, width, n, offsets]);

  const { innerH, innerW, left, x, y, yTicks, xTicks } = layout;
  const bottom = MARGIN.top + innerH;

  const pointAt = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    // The page may be scaled (UI scale setting): convert screen pixels to the chart's own.
    const px = (e.clientX - rect.left) * (width / rect.width);
    setHover(nearestIndex(px, left, innerW, n));
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (n === 0) return;
    const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : e.key === 'Home' ? -n : e.key === 'End' ? n : 0;
    if (step === 0) return;
    e.preventDefault();
    setHover(prev => Math.max(0, Math.min(n - 1, (prev ?? n - 1) + step)));
  };

  if (empty) {
    return (
      <div ref={wrapRef} className="w-full flex items-center justify-center text-2xs font-mono text-white/40 border border-white/5 bg-black/20" style={{ height }}>
        No data for this period
      </div>
    );
  }

  const zeroInside = yTicks.min < 0 && yTicks.max > 0;
  const hoverX = hover !== null ? x(hover) : 0;
  const tooltipOnLeft = hover !== null && hoverX > left + innerW * 0.6;
  const noteText = hover !== null && note ? note(hover) : null;

  return (
    <div ref={wrapRef} className="w-full">
      {series.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-2xs font-mono text-white/60">
          {series.map(s => (
            <span key={s.id} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div className="relative select-none" style={{ height }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onKeyDown={onKey}
          onFocus={() => setHover(prev => prev ?? n - 1)}
          onBlur={() => setHover(null)}
          className="block outline-none focus-visible:ring-1 focus-visible:ring-aero-yellow/60"
        >
          {/* Grid and value axis */}
          {yTicks.ticks.map(t => (
            <g key={t}>
              <line x1={left} x2={left + innerW} y1={y(t)} y2={y(t)} stroke={CHART_COLORS.grid} strokeWidth={1} shapeRendering="crispEdges" />
              <text x={left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={CHART_COLORS.muted} className="font-mono tabular-nums">
                {formatTick(t)}
              </text>
            </g>
          ))}
          <line
            x1={left}
            x2={left + innerW}
            y1={zeroInside ? y(0) : bottom}
            y2={zeroInside ? y(0) : bottom}
            stroke={CHART_COLORS.axis}
            strokeWidth={1}
            shapeRendering="crispEdges"
          />

          {/* Time axis */}
          {xTicks.map(t => {
            const tx = x(t.index);
            const anchor = tx - left < 24 ? 'start' : left + innerW - tx < 24 ? 'end' : 'middle';
            return (
              <text key={t.index} x={tx} y={bottom + 16} textAnchor={anchor} fontSize={10} fill={CHART_COLORS.muted} className="font-mono tabular-nums">
                {t.label}
              </text>
            );
          })}

          {/* Thresholds */}
          {references.map(r => (
            <g key={r.label}>
              <line x1={left} x2={left + innerW} y1={y(r.value)} y2={y(r.value)} stroke={CHART_COLORS.muted} strokeOpacity={0.6} strokeWidth={1} shapeRendering="crispEdges" />
              <text x={left + innerW - 4} y={y(r.value) - 4} textAnchor="end" fontSize={10} fill={CHART_COLORS.muted} className="font-mono">
                {r.label}
              </text>
            </g>
          ))}

          {/* Series: one path per run of months with data, a dot for a month on its own. */}
          {series.map(s =>
            segmentsOf(s.values).map(run =>
              run.length === 1 ? (
                <circle key={`${s.id}-${run[0]}`} cx={x(run[0])} cy={y(s.values[run[0]] as number)} r={2.5} fill={s.color} />
              ) : (
                <path
                  key={`${s.id}-${run[0]}`}
                  d={run.map((i, k) => `${k === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(s.values[i] as number).toFixed(1)}`).join('')}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )
            )
          )}

          {/* The latest value of each series, ringed in the surface colour. */}
          {hover === null && series.map(s => {
            let last = -1;
            for (let i = s.values.length - 1; i >= 0; i--) if (isValue(s.values[i])) { last = i; break; }
            return last >= 0 ? (
              <circle key={`${s.id}-end`} cx={x(last)} cy={y(s.values[last] as number)} r={4} fill={s.color} stroke={CHART_COLORS.surface} strokeWidth={2} />
            ) : null;
          })}

          {/* Crosshair */}
          {hover !== null && (
            <g pointerEvents="none">
              <line x1={hoverX} x2={hoverX} y1={MARGIN.top} y2={bottom} stroke={CHART_COLORS.crosshair} strokeWidth={1} shapeRendering="crispEdges" />
              {series.map(s => {
                const v = s.values[hover];
                return isValue(v) ? (
                  <circle key={s.id} cx={hoverX} cy={y(v)} r={4} fill={s.color} stroke={CHART_COLORS.surface} strokeWidth={2} />
                ) : null;
              })}
            </g>
          )}

          {/* The hover target: the whole plot, so the pointer only has to find the month. */}
          <rect
            x={left}
            y={MARGIN.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerMove={pointAt}
            onPointerDown={pointAt}
            onPointerLeave={() => setHover(null)}
          />
        </svg>

        {hover !== null && (
          <div
            className="absolute pointer-events-none z-10 bg-aero-panel-2 border border-white/15 shadow-xl px-2.5 py-2 text-2xs font-mono min-w-[9rem]"
            style={{
              left: hoverX,
              top: MARGIN.top,
              transform: tooltipOnLeft ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)'
            }}
          >
            <div className="text-white/50 mb-1">{formatMonthOffset(offsets[hover])}</div>
            {series.map(s => {
              const v = s.values[hover];
              return (
                <div key={s.id} className="flex items-center gap-2 whitespace-nowrap">
                  <span className="inline-block w-2.5 h-0.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-white font-bold">{isValue(v) ? formatValue(v) : 'no data'}</span>
                  {series.length > 1 && <span className="text-white/50">{s.label}</span>}
                </div>
              );
            })}
            {noteText && <div className="text-white/50 mt-1 whitespace-nowrap">{noteText}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
