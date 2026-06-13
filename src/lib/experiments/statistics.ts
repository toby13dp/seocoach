// ============================================================================
// Experiments — Statistical Analysis Engine
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Honest statistical analysis for A/B tests.
// CRITICAL: Do not overstate statistical certainty.
// All explanations are in Dutch.
// ============================================================================

import type { StatisticalTestResult } from './types';

// ============================================================================
// Normal Distribution Helpers
// ============================================================================

/**
 * Approximate the cumulative standard normal distribution Φ(z)
 * using the Abramowitz & Stegun approximation (max error ~7.5e-8).
 */
function normalCDF(z: number): number {
  // Constants
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Approximate the inverse standard normal distribution (probit function)
 * using the Rational approximation (Abramowitz & Stegun 26.2.23).
 */
function normalInverseCDF(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  // Rational approximation for lower region
  if (p < 0.5) {
    return -normalInverseCDF(1 - p);
  }

  // p >= 0.5
  const t = Math.sqrt(-2 * Math.log(1 - p));
  // Coefficients
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;

  return t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
}

// ============================================================================
// Z-Test (Two-proportion Z-test for conversion rates)
// ============================================================================

/**
 * Perform a two-proportion Z-test for comparing conversion rates.
 *
 * Tests the null hypothesis that two population proportions are equal.
 * This is the standard test for A/B testing conversion rates.
 *
 * CRITICAL: Does not overstate certainty. Small samples are flagged.
 *
 * @param testRate - Conversion rate in the test group (0-1)
 * @param controlRate - Conversion rate in the control group (0-1)
 * @param testSize - Sample size of the test group
 * @param controlSize - Sample size of the control group
 * @returns Statistical test result with Dutch explanation
 */
export function calculateZTest(
  testRate: number,
  controlRate: number,
  testSize: number,
  controlSize: number
): StatisticalTestResult {
  // Validate inputs
  if (testSize <= 0 || controlSize <= 0) {
    return {
      testStatistic: 0,
      pValue: 1,
      confidence: 0,
      isSignificant: false,
      sampleSizeNeeded: 0,
      dutchExplanation:
        'Steekproefgroottes moeten groter zijn dan nul. De statistische test kan niet worden uitgevoerd.',
    };
  }

  // Pooled proportion under H0
  const p1 = testRate;
  const p2 = controlRate;
  const n1 = testSize;
  const n2 = controlSize;

  const pPool = (p1 * n1 + p2 * n2) / (n1 + n2);

  // Standard error under H0
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));

  // If standard error is zero (e.g., both rates are 0 or 1), no test possible
  if (se === 0) {
    return {
      testStatistic: 0,
      pValue: 1,
      confidence: 0,
      isSignificant: false,
      sampleSizeNeeded: calculateRequiredSampleSize(
        Math.max(p2, 0.01),
        Math.abs(p1 - p2) || 0.01
      ),
      dutchExplanation:
        'De standaardfout is nul, waarschijnlijk omdat beide groepen dezelfde conversierate hebben (0% of 100%). Er kan geen betrouwbare statistische test worden uitgevoerd.',
    };
  }

  // Z-statistic
  const z = (p1 - p2) / se;

  // Two-tailed p-value
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  // Confidence (1 - pValue)
  const confidence = Math.max(0, Math.min(1, 1 - pValue));

  // Significance at α = 0.05
  const isSignificant = pValue < 0.05;

  // Required sample size for detecting the observed effect
  const mde = Math.abs(p1 - p2) || 0.01;
  const baseline = Math.max(p2, 0.01);
  const sampleSizeNeeded = calculateRequiredSampleSize(baseline, mde);

  // Build Dutch explanation
  const improvementPct = ((p1 - p2) / p2 * 100).toFixed(1);
  const significantText = isSignificant ? 'wel' : 'niet';
  let explanation = `De waargenomen verbetering van ${improvementPct}% is ${significantText} statistisch significant (p=${pValue.toFixed(4)}, betrouwbaarheid=${(confidence * 100).toFixed(1)}%).`;

  // Cautions
  if (n1 < 100 || n2 < 100) {
    explanation += ' Let op: De steekproefgrootte is mogelijk te klein voor betrouwbare conclusies.';
  }

  if (sampleSizeNeeded > Math.max(n1, n2)) {
    explanation += ` Een steekproef van minimaal ${sampleSizeNeeded} per groep wordt aanbevolen voor voldoende statistische power.`;
  }

  if (isSignificant && (n1 < 100 || n2 < 100)) {
    explanation += ' Hoewel het resultaat significant is, kan dit een vals positief zijn door de kleine steekproef.';
  }

  if (!isSignificant) {
    explanation += ' Dit betekent niet dat er geen verschil is — mogelijk is de steekproef te klein om het aan te tonen.';
  }

  return {
    testStatistic: z,
    pValue,
    confidence,
    isSignificant,
    sampleSizeNeeded,
    dutchExplanation: explanation,
  };
}

// ============================================================================
// Welch's t-test (for continuous metrics)
// ============================================================================

/**
 * Perform Welch's t-test for comparing means of continuous metrics.
 *
 * Welch's t-test is more robust than Student's t-test when the two
 * samples have unequal variances and/or unequal sample sizes.
 *
 * @param testMean - Mean of the test group
 * @param controlMean - Mean of the control group
 * @param testStdDev - Standard deviation of the test group
 * @param controlStdDev - Standard deviation of the control group
 * @param testSize - Sample size of the test group
 * @param controlSize - Sample size of the control group
 * @returns Statistical test result with Dutch explanation
 */
export function calculateTTest(
  testMean: number,
  controlMean: number,
  testStdDev: number,
  controlStdDev: number,
  testSize: number,
  controlSize: number
): StatisticalTestResult {
  // Validate inputs
  if (testSize <= 1 || controlSize <= 1) {
    return {
      testStatistic: 0,
      pValue: 1,
      confidence: 0,
      isSignificant: false,
      sampleSizeNeeded: 0,
      dutchExplanation:
        'Steekproefgroottes moeten groter zijn dan 1 voor de t-test. De statistische test kan niet worden uitgevoerd.',
    };
  }

  if (testStdDev < 0 || controlStdDev < 0) {
    return {
      testStatistic: 0,
      pValue: 1,
      confidence: 0,
      isSignificant: false,
      sampleSizeNeeded: 0,
      dutchExplanation:
        'Standaardafwijkingen mogen niet negatief zijn. De statistische test kan niet worden uitgevoerd.',
    };
  }

  const n1 = testSize;
  const n2 = controlSize;
  const s1 = testStdDev;
  const s2 = controlStdDev;

  // Welch's t-statistic
  const seDiff = Math.sqrt((s1 * s1) / n1 + (s2 * s2) / n2);

  if (seDiff === 0) {
    return {
      testStatistic: 0,
      pValue: 1,
      confidence: 0,
      isSignificant: false,
      sampleSizeNeeded: 0,
      dutchExplanation:
        'De standaardfout van het verschil is nul. Beide groepen hebben identieke verdelingen.',
    };
  }

  const t = (testMean - controlMean) / seDiff;

  // Welch-Satterthwaite degrees of freedom
  const numerator = Math.pow(s1 * s1 / n1 + s2 * s2 / n2, 2);
  const denominator = Math.pow(s1 * s1 / n1, 2) / (n1 - 1) + Math.pow(s2 * s2 / n2, 2) / (n2 - 1);
  const df = denominator > 0 ? numerator / denominator : 1;

  // Two-tailed p-value using t-distribution approximation
  // For large df, t-distribution approaches normal
  const pValue = df > 30
    ? 2 * (1 - normalCDF(Math.abs(t)))
    : twoTailedTProb(Math.abs(t), df);

  const confidence = Math.max(0, Math.min(1, 1 - pValue));
  const isSignificant = pValue < 0.05;

  // Estimate required sample size (using Cohen's d)
  const pooledStd = Math.sqrt((s1 * s1 + s2 * s2) / 2);
  const cohensD = pooledStd > 0 ? Math.abs(testMean - controlMean) / pooledStd : 0;
  const mde = cohensD || 0.2; // Default to small effect
  const sampleSizeNeeded = Math.ceil(
    2 * Math.pow((normalInverseCDF(0.975) + normalInverseCDF(0.8)) / mde, 2)
  );

  // Build Dutch explanation
  const improvementPct = controlMean !== 0
    ? ((testMean - controlMean) / Math.abs(controlMean) * 100).toFixed(1)
    : '∞';
  const significantText = isSignificant ? 'wel' : 'niet';
  let explanation = `De waargenomen verbetering van ${improvementPct}% is ${significantText} statistisch significant (p=${pValue.toFixed(4)}, betrouwbaarheid=${(confidence * 100).toFixed(1)}%).`;

  if (n1 < 100 || n2 < 100) {
    explanation += ' Let op: De steekproefgrootte is mogelijk te klein voor betrouwbare conclusies.';
  }

  if (!isSignificant) {
    explanation += ' Dit betekent niet dat er geen verschil is — mogelijk is de steekproef te klein om het aan te tonen.';
  }

  if (isSignificant && cohensD < 0.2) {
    explanation += ' Hoewel statistisch significant, is het effect klein (Cohen\'s d < 0.2). Het praktische belang kan beperkt zijn.';
  }

  return {
    testStatistic: t,
    pValue,
    confidence,
    isSignificant,
    sampleSizeNeeded,
    dutchExplanation: explanation,
  };
}

// ============================================================================
// Required Sample Size
// ============================================================================

/**
 * Calculate the minimum required sample size per group for a two-proportion test.
 *
 * Uses the standard formula for sample size determination with
 * specified significance level and power.
 *
 * @param baselineRate - Current baseline conversion rate (0-1)
 * @param minimumDetectableEffect - The minimum effect size to detect (absolute difference)
 * @param significanceLevel - Type I error rate (default: 0.05)
 * @param power - Statistical power (1 - Type II error, default: 0.8)
 * @returns Minimum sample size per group
 */
export function calculateRequiredSampleSize(
  baselineRate: number,
  minimumDetectableEffect: number,
  significanceLevel: number = 0.05,
  power: number = 0.8
): number {
  if (baselineRate <= 0 || baselineRate >= 1) return 0;
  if (minimumDetectableEffect <= 0) return 0;

  const p1 = baselineRate;
  const p2 = baselineRate + minimumDetectableEffect;

  // Ensure p2 is in valid range
  if (p2 <= 0 || p2 >= 1) return 0;

  const zAlpha = normalInverseCDF(1 - significanceLevel / 2);
  const zBeta = normalInverseCDF(power);

  // Sample size formula for two-proportion test
  const pAvg = (p1 + p2) / 2;
  const n =
    (zAlpha * Math.sqrt(2 * pAvg * (1 - pAvg)) +
      zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) **
    2 / (p2 - p1) ** 2;

  return Math.ceil(n);
}

// ============================================================================
// Improvement Calculation
// ============================================================================

/**
 * Calculate the percentage improvement of test over control.
 *
 * @param testResult - The test group result
 * @param controlResult - The control group result
 * @returns Percentage improvement (can be negative if test is worse)
 */
export function calculateImprovement(testResult: number, controlResult: number): number {
  if (controlResult === 0) {
    // Avoid division by zero; return 0 if both are 0, Infinity if test > 0
    return testResult === 0 ? 0 : Infinity;
  }
  return ((testResult - controlResult) / Math.abs(controlResult)) * 100;
}

// ============================================================================
// Dutch Conclusion Generation
// ============================================================================

/**
 * Generate an honest Dutch conclusion based on statistical test results.
 *
 * CRITICAL: Never overstates statistical certainty. Always includes
 * confidence and p-value, and cautions about limitations.
 *
 * @param result - The statistical test result
 * @param experiment - Experiment metadata
 * @returns Dutch conclusion string
 */
export function generateDutchConclusion(
  result: StatisticalTestResult,
  experiment: {
    name: string;
    kpiName: string;
    testGroupResult?: number;
    controlGroupResult?: number;
  }
): string {
  const lines: string[] = [];

  // Header
  lines.push(`Conclusie voor experiment "${experiment.name}":`);
  lines.push('');

  // Main finding
  if (result.isSignificant) {
    lines.push(
      `De testgroep presteert significant beter dan de controlegroep voor ${experiment.kpiName}.`
    );
  } else {
    lines.push(
      'Er is onvoldoende bewijs om een significant verschil aan te tonen. Dit betekent niet dat er geen verschil is — mogelijk is de steekproef te klein.'
    );
  }

  // Quantitative results if available
  if (experiment.testGroupResult !== undefined && experiment.controlGroupResult !== undefined) {
    const improvement = calculateImprovement(
      experiment.testGroupResult,
      experiment.controlGroupResult
    );
    if (isFinite(improvement)) {
      lines.push(
        `Waargenomen verbetering: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}%`
      );
    }
  }

  // Statistical details — always included
  lines.push('');
  lines.push(`Betrouwbaarheid: ${(result.confidence * 100).toFixed(1)}% | p-waarde: ${result.pValue.toFixed(4)}`);

  // Sample size caution
  if (result.sampleSizeNeeded > 0) {
    lines.push(
      `Aanbevolen steekproefgrootte per groep: ${result.sampleSizeNeeded}.`
    );
  }

  // Honesty disclaimer
  lines.push('');
  lines.push(
    'Deze conclusie is gebaseerd op een statistische test en moet met voorzichtigheid worden geïnterpreteerd. Statistische significantie garandeert geen praktische relevantie.'
  );

  return lines.join('\n');
}

// ============================================================================
// Internal: Two-tailed t-distribution probability approximation
// ============================================================================

/**
 * Approximate two-tailed p-value for t-distribution using
 * Hill's approximation (algorithm AS 3).
 * Good enough for practical use; for critical applications,
 * a full numerical integration would be preferred.
 */
function twoTailedTProb(t: number, df: number): number {
  if (df <= 0) return 1;

  const a = df / 2;
  const x = df / (df + t * t);

  // Incomplete beta function approximation
  const p = incompleteBeta(df / (df + t * t), df / 2, 0.5);

  // Two-tailed
  return Math.min(1, 2 * p);
}

/**
 * Regularized incomplete beta function approximation.
 * Used to compute p-values for the t-distribution.
 */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Use continued fraction expansion (Lentz's method)
  const maxIter = 200;
  const eps = 1e-10;

  // Log of Beta function
  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta);

  // Choose the more efficient series
  if (x < (a + 1) / (a + b + 2)) {
    return front * betaCF(x, a, b, maxIter, eps) / a;
  } else {
    return 1 - front * betaCF(1 - x, b, a, maxIter, eps) / b;
  }
}

/**
 * Continued fraction for incomplete beta function.
 */
function betaCF(x: number, a: number, b: number, maxIter: number, eps: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;

  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;

    // Even step
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;

    // Odd step
    aa = ((a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < eps) break;
  }

  return h;
}

/**
 * Log of the Gamma function using Lanczos approximation.
 */
function lnGamma(z: number): number {
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }

  const g = 7;
  const coef = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];

  z -= 1;
  let x = coef[0];
  for (let i = 1; i < g + 2; i++) {
    x += coef[i] / (z + i);
  }

  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
