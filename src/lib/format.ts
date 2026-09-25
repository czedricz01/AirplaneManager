/**
 * Number and money formatting for the whole interface.
 *
 * There were nine separate formatters. Each built a new Intl.NumberFormat on
 * every call -- measured at ~40 µs per call against under 1 µs for a reused
 * instance, which adds up in tables that format several figures per row -- and
 * they disagreed with each other: some were hard-wired to de-DE, some to en-US,
 * and only one honoured the decimal-separator setting.
 */

export type DecimalSymbol = '.' | ',';

let locale = 'en-US';
const cache = new Map<string, Intl.NumberFormat>();

function formatter(kind: 'currency' | 'number', minDigits: number, maxDigits: number): Intl.NumberFormat {
  const key = `${locale}|${kind}|${minDigits}|${maxDigits}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, kind === 'currency'
      ? { style: 'currency', currency: 'USD', minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits }
      : { minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits });
    cache.set(key, f);
  }
  return f;
}

/** Follows the "Number Format" setting: "," selects 1.234,5 and "." 1,234.5. */
export function setDecimalSymbol(symbol: DecimalSymbol) {
  locale = symbol === ',' ? 'de-DE' : 'en-US';
}

export function getNumberLocale(): string {
  return locale;
}

const safe = (value: number) => (Number.isFinite(value) ? value : 0);

/** $1,235 -- whole dollars unless `fractionDigits` asks for more. */
export function formatCurrency(value: number, fractionDigits = 0): string {
  return formatter('currency', fractionDigits, fractionDigits).format(safe(value));
}

export function formatNumber(value: number, decimals = 0): string {
  return formatter('number', decimals, decimals).format(safe(value));
}

/** Always carries its sign: +$1,200 / -$300. */
export function formatSignedCurrency(value: number): string {
  const v = safe(value);
  return `${v >= 0 ? '+' : '-'}${formatCurrency(Math.abs(v))}`;
}

/** Compact money for tables and axis labels: $1.2B, $3.4M, $840K, -$45K. */
export function formatMoneyCompact(value: number): string {
  const v = safe(value);
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${formatNumber(abs / 1_000_000_000, 1)}B`;
  if (abs >= 1_000_000) return `${sign}$${formatNumber(abs / 1_000_000, 1)}M`;
  if (abs >= 1_000) return `${sign}$${formatNumber(abs / 1_000, 0)}K`;
  return `${sign}$${formatNumber(abs, 0)}`;
}

/** Compact counts for axis labels: 1.2M, 34K, 950. */
export function formatNumberCompact(value: number): string {
  const v = safe(value);
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${formatNumber(abs / 1_000_000_000, 1)}B`;
  if (abs >= 1_000_000) return `${sign}${formatNumber(abs / 1_000_000, 1)}M`;
  if (abs >= 10_000) return `${sign}${formatNumber(abs / 1_000, 0)}K`;
  if (abs >= 1_000) return `${sign}${formatNumber(abs / 1_000, 1)}K`;
  return `${sign}${formatNumber(abs, 0)}`;
}

/** The game's calendar starts in January 1960: month offset 0. */
export const CALENDAR_START_YEAR = 1960;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/** "03/1965" for a month offset, as the date is shown everywhere else in the game. */
export function formatMonthOffset(offset: number): string {
  const o = Math.max(0, Math.floor(safe(offset)));
  return `${String(1 + (o % 12)).padStart(2, '0')}/${CALENDAR_START_YEAR + Math.floor(o / 12)}`;
}

/** "March 1965" for a month offset, for a masthead or a headline. */
export function formatMonthLong(offset: number): string {
  const o = Math.max(0, Math.floor(safe(offset)));
  return `${MONTH_NAMES[o % 12]} ${CALENDAR_START_YEAR + Math.floor(o / 12)}`;
}

/**
 * "LH1234" -- the airline's own code, not a fixed "NE". Routes created before
 * they stored `airlineCode` fall back to the current one. A route without a
 * timetable shows its airline name.
 */
export function routeFlightNumber(
  route: { schedule?: any[]; airline?: string; airlineCode?: string },
  fallbackCode = ''
): string {
  const num = route.schedule?.[0]?.flightNumOut;
  if (!num) return route.airline || '-';
  return `${route.airlineCode || fallbackCode}${num}`;
}
