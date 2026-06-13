/**
 * Structured logging system for SEOCoach.
 *
 * Provides a factory-based logger with support for:
 * - Structured JSON output in production
 * - Pretty-printed colored output in development
 * - Automatic secret masking (passwords, tokens, API keys, secrets)
 * - Context propagation (requestId, tenantId, jobId, duration, custom fields)
 * - Child loggers via `withContext()`
 *
 * @module observability/logger
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Log severity levels supported by the logger. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Contextual metadata that can be attached to any log entry. */
export interface LogContext {
  requestId?: string;
  tenantId?: string;
  jobId?: string;
  duration?: number;
  /** Arbitrary custom key-value pairs. */
  [key: string]: unknown;
}

/** Internal shape of a structured log entry. */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  tenantId?: string;
  jobId?: string;
  duration?: number;
  error?: string;
  stack?: string;
  [key: string]: unknown;
}

/** Logger interface returned by `createLogger`. */
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, errorOrContext?: Error | LogContext, context?: LogContext): void;
  /** Create a child logger that merges additional context into every entry. */
  withContext(additionalContext: LogContext): Logger;
}

// ---------------------------------------------------------------------------
// Secret Masking
// ---------------------------------------------------------------------------

/**
 * Key patterns that indicate a value should be masked.
 * Matches common secret-related field names (case-insensitive).
 */
const SENSITIVE_KEY_PATTERNS = [
  /^password$/i,
  /^passwd$/i,
  /^secret$/i,
  /^token$/i,
  /^api[_-]?key$/i,
  /^access[_-]?key$/i,
  /^private[_-]?key$/i,
  /^auth$/i,
  /^authorization$/i,
  /^cookie$/i,
  /^session[_-]?id$/i,
  /^refresh[_-]?token$/i,
  /^client[_-]?secret$/i,
  /^db[_-]?password$/i,
  /^database[_-]?url$/i,
];

const MASK = '[REDACTED]';

/**
 * Check whether a key name looks like it holds a sensitive value.
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Recursively mask sensitive values inside an object.
 * Returns a shallow clone — the original object is never mutated.
 */
function maskSensitiveValues(obj: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      masked[key] = MASK;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      masked[key] = maskSensitiveValues(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
};
const RESET = '\x1b[0m';

/**
 * Format a log entry as a pretty-printed string (development mode).
 */
function prettyFormat(entry: LogEntry): string {
  const { timestamp, level, message, ...rest } = entry;
  const color = LEVEL_COLORS[level] ?? '';
  const levelStr = `${color}${level.toUpperCase().padEnd(5)}${RESET}`;
  const restStr = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
  return `${timestamp} ${levelStr} ${message}${restStr}`;
}

/**
 * Format a log entry as a JSON string (production mode).
 */
function jsonFormat(entry: LogEntry): string {
  return JSON.stringify(entry);
}

// ---------------------------------------------------------------------------
// Log level priority
// ---------------------------------------------------------------------------

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Resolve the minimum log level from the LOG_LEVEL environment variable.
 * Defaults to `info` when not set.
 */
function resolveMinLevel(): LogLevel {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  if (env && env in LEVEL_PRIORITY) return env as LogLevel;
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

const MIN_LEVEL = resolveMinLevel();

// ---------------------------------------------------------------------------
// Logger implementation
// ---------------------------------------------------------------------------

function createLogEntry(
  level: LogLevel,
  message: string,
  baseContext: LogContext,
  extraContext?: LogContext,
  error?: Error,
): LogEntry {
  const merged: LogContext = { ...baseContext, ...extraContext };

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...maskSensitiveValues(merged),
  };

  if (error) {
    entry.error = error.message;
    entry.stack = error.stack;
  }

  return entry;
}

function writeEntry(entry: LogEntry): void {
  if (LEVEL_PRIORITY[entry.level] < LEVEL_PRIORITY[MIN_LEVEL]) {
    return;
  }

  const output = process.env.NODE_ENV === 'production'
    ? jsonFormat(entry)
    : prettyFormat(entry);

  switch (entry.level) {
    case 'error':
      process.stderr.write(`${output}\n`);
      break;
    default:
      process.stdout.write(`${output}\n`);
      break;
  }
}

/**
 * Create a new Logger bound to the given context.
 *
 * @param context - Base context merged into every log entry produced by this logger.
 * @returns A `Logger` instance.
 *
 * @example
 * ```ts
 * const log = createLogger({ tenantId: 'org-123' });
 * log.info('Geplande taak gestart', { jobId: 'job-456' });
 * ```
 */
export function createLogger(context: LogContext = {}): Logger {
  const baseContext = context;

  const logger: Logger = {
    debug(message: string, ctx?: LogContext) {
      const entry = createLogEntry('debug', message, baseContext, ctx);
      writeEntry(entry);
    },

    info(message: string, ctx?: LogContext) {
      const entry = createLogEntry('info', message, baseContext, ctx);
      writeEntry(entry);
    },

    warn(message: string, ctx?: LogContext) {
      const entry = createLogEntry('warn', message, baseContext, ctx);
      writeEntry(entry);
    },

    error(message: string, errorOrContext?: Error | LogContext, ctx?: LogContext) {
      let error: Error | undefined;
      let extraCtx: LogContext | undefined;

      if (errorOrContext instanceof Error) {
        error = errorOrContext;
        extraCtx = ctx;
      } else if (errorOrContext && typeof errorOrContext === 'object') {
        extraCtx = errorOrContext as LogContext;
      }

      const entry = createLogEntry('error', message, baseContext, extraCtx, error);
      writeEntry(entry);
    },

    withContext(additionalContext: LogContext): Logger {
      return createLogger({ ...baseContext, ...additionalContext });
    },
  };

  return logger;
}

// ---------------------------------------------------------------------------
// Singleton application-wide logger
// ---------------------------------------------------------------------------

/**
 * Default application logger.
 *
 * Use this for general application logging. For request-scoped or
 * tenant-scoped logging, call `appLogger.withContext({ requestId, tenantId })`.
 *
 * @example
 * ```ts
 * import { appLogger } from '@/lib/observability';
 * appLogger.info('Server gestart');
 * ```
 */
export const appLogger = createLogger({ component: 'seocoach' });
