// ============================================================================
// Experiments — Analyzer
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Records experiment results, runs statistical analysis, and generates
// Dutch recommendations. Never overstates statistical certainty.
// ============================================================================

import { db } from '@/lib/db';
import type { StatisticalTestResult } from './types';
import { calculateZTest, calculateTTest, calculateImprovement, generateDutchConclusion } from './statistics';

// ============================================================================
// Record Experiment Result
// ============================================================================

/**
 * Record the results of a running experiment and perform statistical analysis.
 *
 * Calculates improvement, runs the appropriate statistical test (Z-test for
 * conversion rates, t-test for continuous metrics), and generates a Dutch
 * conclusion.
 *
 * CRITICAL: If sample sizes are too small (< 100 per group), adds a Dutch
 * warning about unreliable conclusions.
 *
 * @param experimentId - The experiment to record results for
 * @param projectId - The project it belongs to (tenant isolation)
 * @param data - Test and control group results
 * @returns The updated Experiment record with analysis results
 * @throws Error if experiment not found or not in RUNNING status
 */
export async function recordExperimentResult(
  experimentId: string,
  projectId: string,
  data: { testGroupResult: number; controlGroupResult: number }
) {
  // Verify ownership and status
  const experiment = await db.experiment.findFirst({
    where: { id: experimentId, projectId, deletedAt: null },
  });

  if (!experiment) {
    throw new Error(
      `Experiment met ID "${experimentId}" niet gevonden voor dit project.`
    );
  }

  if (experiment.status !== 'RUNNING') {
    throw new Error(
      `Resultaten kunnen alleen worden vastgelegd voor actieve experimenten. Huidige status: ${experiment.status}.`
    );
  }

  // Calculate improvement
  const improvement = calculateImprovement(data.testGroupResult, data.controlGroupResult);

  // Determine which statistical test to use based on available data
  // If we have group sizes, use Z-test (for conversion rates)
  // If we don't have group sizes, we still record results but can't run a full test
  let testResult: StatisticalTestResult | null = null;

  if (experiment.testGroupSize && experiment.controlGroupSize) {
    // Use Z-test for conversion rates (0-1 range)
    if (
      data.testGroupResult >= 0 && data.testGroupResult <= 1 &&
      data.controlGroupResult >= 0 && data.controlGroupResult <= 1
    ) {
      testResult = calculateZTest(
        data.testGroupResult,
        data.controlGroupResult,
        experiment.testGroupSize,
        experiment.controlGroupSize
      );
    } else {
      // For continuous metrics, we need standard deviations.
      // Since we don't have those from the result data, estimate from the values.
      // This is a simplification; in practice, raw data would be better.
      const testStdDev = Math.abs(data.testGroupResult) * 0.2 || 1;
      const controlStdDev = Math.abs(data.controlGroupResult) * 0.2 || 1;

      testResult = calculateTTest(
        data.testGroupResult,
        data.controlGroupResult,
        testStdDev,
        controlStdDev,
        experiment.testGroupSize,
        experiment.controlGroupSize
      );
    }
  } else {
    // No group sizes available — provide a limited analysis
    testResult = {
      testStatistic: 0,
      pValue: 1,
      confidence: 0,
      isSignificant: false,
      sampleSizeNeeded: 0,
      dutchExplanation:
        'Geen steekproefgroottes beschikbaar. Statistische test kan niet worden uitgevoerd. Voeg steekproefgroottes toe aan het experiment voor betrouwbare analyse.',
    };
  }

  // Generate Dutch conclusion
  const conclusion = generateDutchConclusion(testResult, {
    name: experiment.name,
    kpiName: experiment.kpiName,
    testGroupResult: data.testGroupResult,
    controlGroupResult: data.controlGroupResult,
  });

  // Build conclusion with sample size warning if needed
  let finalConclusion = conclusion;

  const testSize = experiment.testGroupSize ?? 0;
  const controlSize = experiment.controlGroupSize ?? 0;

  if (testSize < 100 || controlSize < 100) {
    finalConclusion +=
      '\n\nLet op: De steekproefgrootte is mogelijk te klein voor betrouwbare conclusies.';
  }

  // Build follow-up recommendation
  const followUp = generateFollowUp(testResult, experiment.kpiName);

  // Update the experiment record
  return db.experiment.update({
    where: { id: experimentId },
    data: {
      testGroupResult: data.testGroupResult,
      controlGroupResult: data.controlGroupResult,
      improvement: isFinite(improvement) ? improvement : null,
      confidence: testResult.confidence,
      isSignificant: testResult.isSignificant,
      conclusion: finalConclusion,
      followUp,
    },
  });
}

// ============================================================================
// Experiment Recommendations
// ============================================================================

/**
 * Get Dutch recommendations based on completed experiment results for a project.
 *
 * Analyzes all completed experiments and provides actionable recommendations.
 *
 * @param projectId - The project to get recommendations for
 * @returns Array of recommendations with experiment IDs
 */
export async function getExperimentRecommendations(
  projectId: string
): Promise<{ experimentId: string; recommendation: string }[]> {
  const completedExperiments = await db.experiment.findMany({
    where: {
      projectId,
      status: 'COMPLETED',
      deletedAt: null,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const recommendations: { experimentId: string; recommendation: string }[] = [];

  for (const exp of completedExperiments) {
    const recs: string[] = [];

    // Significant positive result
    if (exp.isSignificant && (exp.improvement ?? 0) > 0) {
      recs.push(
        `Implementeer de wijziging uit de testgroep — een verbetering van ${(exp.improvement ?? 0).toFixed(1)}% voor ${exp.kpiName} is statistisch significant.`
      );

      // Suggest scaling
      recs.push(
        'Overweeg om de winnende variant uit te rollen naar alle verkeer en het experiment te herhalen met een grotere steekproef voor verdere validatie.'
      );
    }

    // Significant negative result
    if (exp.isSignificant && (exp.improvement ?? 0) < 0) {
      recs.push(
        `De testgroep presteerde significant slechter (${(exp.improvement ?? 0).toFixed(1)}%) voor ${exp.kpiName}. Behoud de huidige (controle)versie.`
      );
    }

    // Not significant
    if (!exp.isSignificant) {
      const testSize = exp.testGroupSize ?? 0;
      const controlSize = exp.controlGroupSize ?? 0;

      if (testSize < 100 || controlSize < 100) {
        recs.push(
          `Het experiment "${exp.name}" was niet significant, maar de steekproef was klein (${testSize} vs ${controlSize}). Overweeg een herhaling met meer verkeer.`
        );
      } else {
        recs.push(
          `Geen significant verschil gevonden voor "${exp.name}". Dit kan betekenen dat de wijziging geen impact heeft, of dat het effect te klein is om te detecteren.`
        );
      }
    }

    // Low confidence warning
    if ((exp.confidence ?? 0) < 0.8 && (exp.confidence ?? 0) > 0) {
      recs.push(
        `De betrouwbaarheid is relatief laag (${((exp.confidence ?? 0) * 100).toFixed(0)}%). Verhoog de steekproefgrootte voordat u definitieve conclusies trekt.`
      );
    }

    // No results recorded
    if (exp.testGroupResult === null || exp.controlGroupResult === null) {
      recs.push(
        `Experiment "${exp.name}" is afgerond zonder resultaten. Voer de resultaten in om een analyse te krijgen.`
      );
    }

    if (recs.length > 0) {
      recommendations.push({
        experimentId: exp.id,
        recommendation: recs.join('\n'),
      });
    }
  }

  return recommendations;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Generate a Dutch follow-up action based on statistical results.
 */
function generateFollowUp(
  result: StatisticalTestResult,
  kpiName: string
): string {
  if (result.isSignificant) {
    if (result.confidence >= 0.95) {
      return `Implementeer de winnende variant. Hoge betrouwbaarheid (${(result.confidence * 100).toFixed(0)}%) voor ${kpiName}.`;
    }
    return `Overweeg implementatie na verdere validatie. Matige betrouwbaarheid (${(result.confidence * 100).toFixed(0)}%) voor ${kpiName}.`;
  }

  if (result.pValue >= 0.05 && result.pValue < 0.1) {
    return `Bijna significant (p=${result.pValue.toFixed(4)}). Verhoog de steekproefgrootte en herhaal het experiment voor ${kpiName}.`;
  }

  return `Geen actie vereist op basis van dit experiment. Overweeg alternatieve hypothesen voor ${kpiName}.`;
}
