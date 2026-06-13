// ============================================================================
// SEOCoach Alert Engine — Anomaly Detection
// ============================================================================
//
// Simple statistical anomaly detection for metric values.
// Two methods are supported:
//   - Z-score: measures how many standard deviations the latest value is
//     from the mean of the distribution.
//   - IQR: checks whether the latest value falls outside 1.5×IQR from the
//     first or third quartile.
//
// Both methods are standard statistical approaches, not ML.
// A minimum of 7 data points is required before anomaly detection is applied.
// ---------------------------------------------------------------------------

/**
 * Result of an anomaly detection pass.
 */
export interface AnomalyResult {
  /** 0–1 scale: 0 = no anomaly, 1 = extreme anomaly */
  score: number;
  /** Which detection method was used */
  method: 'zscore' | 'iqr';
  /** Whether the value was flagged as anomalous */
  isAnomaly: boolean;
}

/** Minimum number of data points required for anomaly detection */
const MINIMUM_DATA_POINTS = 7;

/** Z-score threshold above which a value is considered anomalous */
const ZSCORE_THRESHOLD = 2.0;

/** IQR multiplier for determining outlier boundaries */
const IQR_MULTIPLIER = 1.5;

/**
 * Detect whether the most recent value in a series is anomalous.
 *
 * @param values  - Time-ordered numeric values (most recent last)
 * @param method  - Which statistical method to use
 * @returns Anomaly result, or null if insufficient data
 */
export function detectAnomaly(
  values: number[],
  method: 'zscore' | 'iqr'
): AnomalyResult | null {
  if (values.length < MINIMUM_DATA_POINTS) {
    return null;
  }

  switch (method) {
    case 'zscore':
      return detectZScoreAnomaly(values);
    case 'iqr':
      return detectIQRAnomaly(values);
    default:
      return null;
  }
}

/**
 * Z-score anomaly detection.
 *
 * Calculates how many standard deviations the most recent value is from the
 * mean of all previous values. A z-score above the threshold indicates an
 * anomaly. The anomaly score is normalised to 0–1.
 */
function detectZScoreAnomaly(values: number[]): AnomalyResult {
  // Use all values except the last one as the baseline distribution
  const baseline = values.slice(0, -1);
  const latestValue = values[values.length - 1];

  const mean = calculateMean(baseline);
  const stdDev = calculateStdDev(baseline, mean);

  // If standard deviation is zero, all baseline values are identical
  // and the latest value is either the same (not anomalous) or different
  if (stdDev === 0) {
    const score = latestValue === mean ? 0 : 1;
    return {
      score,
      method: 'zscore',
      isAnomaly: score >= 0.5,
    };
  }

  const zScore = Math.abs((latestValue - mean) / stdDev);

  // Normalise z-score to 0–1 range: a z-score of 3+ is extreme
  const score = Math.min(zScore / 3, 1);

  return {
    score: Math.round(score * 1000) / 1000, // 3 decimal places
    method: 'zscore',
    isAnomaly: zScore >= ZSCORE_THRESHOLD,
  };
}

/**
 * IQR (Interquartile Range) anomaly detection.
 *
 * Checks whether the most recent value falls outside 1.5×IQR from the
 * first or third quartile. The anomaly score is based on how far outside
 * the bounds the value is, normalised to 0–1.
 */
function detectIQRAnomaly(values: number[]): AnomalyResult {
  const baseline = values.slice(0, -1);
  const latestValue = values[values.length - 1];

  const sorted = [...baseline].sort((a, b) => a - b);
  const q1 = calculatePercentile(sorted, 25);
  const q3 = calculatePercentile(sorted, 75);
  const iqr = q3 - q1;

  // If IQR is zero, all values between Q1 and Q3 are identical
  if (iqr === 0) {
    const score = latestValue < q1 || latestValue > q3 ? 1 : 0;
    return {
      score,
      method: 'iqr',
      isAnomaly: score >= 0.5,
    };
  }

  const lowerBound = q1 - IQR_MULTIPLIER * iqr;
  const upperBound = q3 + IQR_MULTIPLIER * iqr;

  const isBelow = latestValue < lowerBound;
  const isAbove = latestValue > upperBound;

  if (!isBelow && !isAbove) {
    return {
      score: 0,
      method: 'iqr',
      isAnomaly: false,
    };
  }

  // Calculate how far outside the bounds, normalised by IQR
  let distance: number;
  if (isBelow) {
    distance = lowerBound - latestValue;
  } else {
    distance = latestValue - upperBound;
  }

  // Normalise: distance / (2 * IQR) gives a reasonable 0–1 scale
  const score = Math.min(distance / (2 * iqr), 1);

  return {
    score: Math.round(score * 1000) / 1000,
    method: 'iqr',
    isAnomaly: true,
  };
}

// ---------------------------------------------------------------------------
// Statistical helpers
// ---------------------------------------------------------------------------

/**
 * Calculate the arithmetic mean of a numeric array.
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Calculate the population standard deviation.
 */
function calculateStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculate a percentile value from a sorted numeric array.
 * Uses linear interpolation between data points.
 */
function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];

  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const fraction = index - lower;

  if (lower === upper) {
    return sortedValues[lower];
  }

  return sortedValues[lower] + fraction * (sortedValues[upper] - sortedValues[lower]);
}

/**
 * Run both anomaly detection methods and return the one with the higher score.
 * Returns null if insufficient data.
 */
export function detectAnomalyBest(
  values: number[]
): AnomalyResult | null {
  const zscoreResult = detectAnomaly(values, 'zscore');
  const iqrResult = detectAnomaly(values, 'iqr');

  if (!zscoreResult && !iqrResult) return null;
  if (!zscoreResult) return iqrResult;
  if (!iqrResult) return zscoreResult;

  return zscoreResult.score >= iqrResult.score ? zscoreResult : iqrResult;
}
