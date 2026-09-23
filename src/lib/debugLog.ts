/**
 * A small in-memory diagnostic log.
 *
 * Until now a fault surfaced, at best, as a console line nobody saw: the game
 * had no record of what happened before a crash, and a player reporting "the
 * numbers went wrong" had nothing to attach. This keeps the last few hundred
 * events in a ring buffer, catches uncaught errors and rejected promises
 * globally, and can export everything as one JSON blob for a bug report.
 *
 * It never throws. Logging is the last thing that should take the game down.
 */

export type LogLevel = 'debug' | 'warn' | 'error';

export interface LogEntry {
  time: string;
  level: LogLevel;
  scope: string;
  message: string;
  data?: unknown;
}

export const LOG_CAPACITY = 300;

const buffer: LogEntry[] = [];

function toSerialisable(data: unknown): unknown {
  if (data instanceof Error) {
    return { name: data.name, message: data.message, stack: data.stack };
  }
  return data;
}

function push(level: LogLevel, scope: string, message: string, data?: unknown) {
  try {
    buffer.push({
      time: new Date().toISOString(),
      level,
      scope,
      message,
      ...(data === undefined ? {} : { data: toSerialisable(data) })
    });
    if (buffer.length > LOG_CAPACITY) buffer.splice(0, buffer.length - LOG_CAPACITY);

    const line = `[${scope}] ${message}`;
    if (level === 'error') console.error(line, data ?? '');
    else if (level === 'warn') console.warn(line, data ?? '');
  } catch {
    // Nothing sensible left to do.
  }
}

export const logDebug = (scope: string, message: string, data?: unknown) => push('debug', scope, message, data);
export const logWarn = (scope: string, message: string, data?: unknown) => push('warn', scope, message, data);
export const logError = (scope: string, message: string, data?: unknown) => push('error', scope, message, data);

/** A copy of the buffer, oldest first. */
export function getLogEntries(): LogEntry[] {
  return buffer.slice();
}

export function clearLog() {
  buffer.length = 0;
}

let installed = false;

/**
 * Records every uncaught error and unhandled rejection. Safe to call more than
 * once; only the first call installs the listeners.
 */
export function installGlobalErrorCapture() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    logError('window', event.message || 'Uncaught error', event.error ?? {
      source: event.filename,
      line: event.lineno,
      column: event.colno
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    logError('promise', reason?.message || String(reason) || 'Unhandled rejection', reason);
  });
}

/** Called by the game so a diagnostics export can say what state it was in. */
let summaryProvider: (() => unknown) | null = null;
export function setDiagnosticsSummaryProvider(provider: (() => unknown) | null) {
  summaryProvider = provider;
}

/** Everything a bug report needs, as pretty-printed JSON. */
export function getDiagnostics(extra?: Record<string, unknown>): string {
  let game: unknown = null;
  try {
    game = summaryProvider ? summaryProvider() : null;
  } catch (e) {
    game = { error: String(e) };
  }
  const report = {
    generatedAt: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a',
    location: typeof window !== 'undefined' ? window.location.href : 'n/a',
    game,
    ...extra,
    log: getLogEntries()
  };
  try {
    return JSON.stringify(report, null, 2);
  } catch {
    return JSON.stringify({ ...report, game: '[unserialisable]', log: getLogEntries().map(e => ({ ...e, data: undefined })) }, null, 2);
  }
}

/** Copies the diagnostics to the clipboard; resolves to false when that is not allowed. */
export async function copyDiagnostics(extra?: Record<string, unknown>): Promise<boolean> {
  const text = getDiagnostics(extra);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    logWarn('diagnostics', 'Clipboard refused the diagnostics export', e);
    return false;
  }
}
