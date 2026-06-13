/**
 * Health check system for SEOCoach.
 *
 * Provides individual health-check functions for core dependencies (database,
 * Ollama, disk, memory) and an aggregate `runAllChecks()` that computes an
 * overall health status.
 *
 * @module observability/health
 */

import { execSync } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of a single health check. */
export interface HealthCheckResult {
  /** Status indicating the health of the checked component. */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Response time of the check in milliseconds. */
  responseTime: number;
  /** Optional human-readable details about the check outcome. */
  details?: string;
  /** Error message when the check fails. */
  error?: string;
}

/** Aggregate health report for the entire application. */
export interface OverallHealth {
  /** Overall status derived from individual checks. */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Process uptime in seconds. */
  uptime: number;
  /** Application version from package.json. */
  version: string;
  /** ISO-8601 timestamp of when the check was performed. */
  timestamp: string;
  /** Individual check results keyed by check name. */
  checks: Record<string, HealthCheckResult>;
}

// ---------------------------------------------------------------------------
// Version helper
// ---------------------------------------------------------------------------

let _cachedVersion: string | undefined;

/**
 * Read the application version from package.json (cached after first read).
 * Falls back to `"unknown"` when the file cannot be read.
 */
function getAppVersion(): string {
  if (_cachedVersion) return _cachedVersion;
  try {
    // Try multiple paths to find package.json
    const candidates = [
      path.join(process.cwd(), 'package.json'),
      path.join(__dirname, '..', '..', '..', 'package.json'),
    ];
    for (const pkgPath of candidates) {
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const version: string = pkg.version ?? 'unknown';
        _cachedVersion = version;
        return version;
      }
    }
  } catch {
    // Ignore read errors
  }
  _cachedVersion = 'unknown';
  return _cachedVersion;
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

/**
 * Check database connectivity by running a lightweight Prisma query.
 *
 * Resolves to `healthy` if the query succeeds, `unhealthy` otherwise.
 */
export async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    // Dynamic import to avoid circular dependency issues at module load time
    const { db } = await import('@/lib/db');
    await db.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - start;
    return {
      status: 'healthy',
      responseTime,
      details: 'Databaseverbinding succesvol',
    };
  } catch (err) {
    const responseTime = Date.now() - start;
    return {
      status: 'unhealthy',
      responseTime,
      error: err instanceof Error ? err.message : 'Onbekende databasefout',
      details: 'Kan geen verbinding maken met de database',
    };
  }
}

/**
 * Check Ollama availability by sending an HTTP request to its API endpoint.
 *
 * Resolves to `healthy` if Ollama responds, `degraded` if it responds
 * slowly (> 2 s), or `unhealthy` if it is unreachable.
 */
export async function checkOllama(): Promise<HealthCheckResult> {
  const start = Date.now();
  const ollamaUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - start;

    if (response.ok) {
      return {
        status: responseTime > 2000 ? 'degraded' : 'healthy',
        responseTime,
        details: responseTime > 2000
          ? 'Ollama reageert traag'
          : 'Ollama is beschikbaar',
      };
    }

    return {
      status: 'unhealthy',
      responseTime,
      error: `Ollama antwoordde met status ${response.status}`,
      details: 'Ollama service onbeschikbaar',
    };
  } catch (err) {
    const responseTime = Date.now() - start;
    return {
      status: 'unhealthy',
      responseTime,
      error: err instanceof Error ? err.message : 'Ollama onbereikbaar',
      details: 'Kan geen verbinding maken met Ollama',
    };
  }
}

/**
 * Check available disk space on the volume containing the project root.
 *
 * Marks as `degraded` when free space is below 1 GB, `unhealthy` below 100 MB.
 */
export async function checkDiskSpace(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    // Use df command on Unix-like systems
    const output = execSync('df -k .', { encoding: 'utf-8', timeout: 5000 });
    const lines = output.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('Kon schijfruimte niet bepalen');
    }

    // Parse the second line (values for the current mount)
    const parts = lines[1].split(/\s+/);
    // Columns: Filesystem 1K-blocks Used Available Use% Mounted-on
    const availableKB = parseInt(parts[3], 10);
    const totalKB = parseInt(parts[1], 10);
    const availableMB = availableKB / 1024;
    const availableGB = availableMB / 1024;
    const usedPercent = totalKB > 0 ? ((parseInt(parts[2], 10) / totalKB) * 100).toFixed(1) : '0';

    const responseTime = Date.now() - start;

    if (availableMB < 100) {
      return {
        status: 'unhealthy',
        responseTime,
        details: `Slechts ${availableMB.toFixed(0)} MB beschikbaar (${usedPercent}% gebruikt)`,
        error: 'Kritiek weinig schijfruimte',
      };
    }

    if (availableGB < 1) {
      return {
        status: 'degraded',
        responseTime,
        details: `${availableGB.toFixed(2)} GB beschikbaar (${usedPercent}% gebruikt)`,
      };
    }

    return {
      status: 'healthy',
      responseTime,
      details: `${availableGB.toFixed(1)} GB beschikbaar (${usedPercent}% gebruikt)`,
    };
  } catch (err) {
    const responseTime = Date.now() - start;

    // Fallback: try to estimate by writing a temp file
    try {
      const testPath = path.join(process.cwd(), '.health-disk-test');
      fs.writeFileSync(testPath, Buffer.alloc(1024));
      fs.unlinkSync(testPath);

      return {
        status: 'healthy',
        responseTime,
        details: 'Schijf beschrijfbaar (ruimtecontrole niet beschikbaar)',
      };
    } catch {
      return {
        status: 'unhealthy',
        responseTime,
        error: err instanceof Error ? err.message : 'Schijfcontrole mislukt',
        details: 'Kan schijfruimte niet controleren',
      };
    }
  }
}

/**
 * Check Node.js process memory usage.
 *
 * Marks as `degraded` when heap usage exceeds 80 % of the heap limit,
 * `unhealthy` when it exceeds 95 %.
 */
export async function checkMemory(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const mem = process.memoryUsage();
    const totalSystemMem = os.totalmem();
    const freeSystemMem = os.freemem();

    // Heap usage ratio
    const heapUsedMB = mem.heapUsed / (1024 * 1024);
    const heapTotalMB = mem.heapTotal / (1024 * 1024);
    const heapRatio = mem.heapUsed / mem.heapTotal;
    const rssMB = mem.rss / (1024 * 1024);

    // System memory ratio
    const systemUsedMB = (totalSystemMem - freeSystemMem) / (1024 * 1024);
    const systemTotalMB = totalSystemMem / (1024 * 1024);
    const systemRatio = (totalSystemMem - freeSystemMem) / totalSystemMem;

    const responseTime = Date.now() - start;

    const details = [
      `Heap: ${heapUsedMB.toFixed(0)}/${heapTotalMB.toFixed(0)} MB (${(heapRatio * 100).toFixed(1)}%)`,
      `RSS: ${rssMB.toFixed(0)} MB`,
      `Systeem: ${systemUsedMB.toFixed(0)}/${systemTotalMB.toFixed(0)} MB (${(systemRatio * 100).toFixed(1)}%)`,
    ].join(' | ');

    if (heapRatio > 0.95) {
      return {
        status: 'unhealthy',
        responseTime,
        details,
        error: 'Geheugengebruik kritiek',
      };
    }

    if (heapRatio > 0.8) {
      return {
        status: 'degraded',
        responseTime,
        details,
      };
    }

    return {
      status: 'healthy',
      responseTime,
      details,
    };
  } catch (err) {
    const responseTime = Date.now() - start;
    return {
      status: 'unhealthy',
      responseTime,
      error: err instanceof Error ? err.message : 'Geheugencontrole mislukt',
      details: 'Kan geheugengebruik niet controleren',
    };
  }
}

// ---------------------------------------------------------------------------
// Aggregate check
// ---------------------------------------------------------------------------

/**
 * Status priority for computing overall health.
 * Higher number = worse status.
 */
const STATUS_PRIORITY: Record<string, number> = {
  healthy: 0,
  degraded: 1,
  unhealthy: 2,
};

/**
 * Compute the overall status from a set of individual check results.
 *
 * The overall status is the worst individual status.
 */
function computeOverallStatus(checks: Record<string, HealthCheckResult>): 'healthy' | 'degraded' | 'unhealthy' {
  let worst: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  for (const result of Object.values(checks)) {
    if (STATUS_PRIORITY[result.status] > STATUS_PRIORITY[worst]) {
      worst = result.status;
    }
  }
  return worst;
}

/**
 * Run all health checks and return an aggregate report.
 *
 * Checks are executed in parallel for speed. The overall `status` is the
 * worst individual status.
 *
 * @example
 * ```ts
 * const health = await runAllChecks();
 * // {
 * //   status: 'healthy',
 * //   uptime: 86400,
 * //   version: '0.2.0',
 * //   timestamp: '2024-01-15T10:30:00.000Z',
 * //   checks: { database: {...}, ollama: {...}, diskSpace: {...}, memory: {...} }
 * // }
 * ```
 */
export async function runAllChecks(): Promise<OverallHealth> {
  const [database, ollama, diskSpace, memory] = await Promise.all([
    checkDatabase(),
    checkOllama(),
    checkDiskSpace(),
    checkMemory(),
  ]);

  const checks: Record<string, HealthCheckResult> = {
    database,
    ollama,
    diskSpace,
    memory,
  };

  return {
    status: computeOverallStatus(checks),
    uptime: process.uptime(),
    version: getAppVersion(),
    timestamp: new Date().toISOString(),
    checks,
  };
}
