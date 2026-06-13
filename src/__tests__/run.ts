/**
 * SEOCoach Test Runner
 * Runs all test suites and reports results.
 */

import { run as ssrfTests } from './crawler/ssrf.test';
import { run as robotsTests } from './crawler/robots.test';
import { run as sitemapTests } from './crawler/sitemap.test';
import { run as parserTests } from './crawler/parser.test';
import { run as engineTests } from './rules/engine.test';
import { run as intentClassifierTests } from './keywords/intent-classifier.test';
import { run as opportunityScorerTests } from './keywords/opportunity-scorer.test';
import { run as providerTests } from './ai/provider.test';
import { run as qualityTests } from './content/quality.test';

// ============================================================================
// Main Runner
// ============================================================================

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════');
  console.log('  SEOCoach Test Suite');
  console.log('═══════════════════════════════════════════');

  const suites = [
    { name: 'SSRF Protection', run: ssrfTests },
    { name: 'Robots.txt Parser', run: robotsTests },
    { name: 'Sitemap Parser', run: sitemapTests },
    { name: 'HTML Parser', run: parserTests },
    { name: 'SEO Rule Engine', run: engineTests },
    { name: 'Intent Classifier', run: intentClassifierTests },
    { name: 'Opportunity Scorer', run: opportunityScorerTests },
    { name: 'AI Provider', run: providerTests },
    { name: 'Content Quality', run: qualityTests },
  ];

  let totalPassed = 0;
  let totalFailed = 0;
  const failedSuites: string[] = [];

  for (const suite of suites) {
    try {
      suite.run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`\n  ⚠ Suite "${suite.name}" crashed: ${msg}`);
      failedSuites.push(suite.name);
    }
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  Test Suite Summary');
  console.log('═══════════════════════════════════════════');
  console.log(`  Total suites: ${suites.length}`);
  if (failedSuites.length > 0) {
    console.log(`  Crashed suites: ${failedSuites.join(', ')}`);
  }
  console.log('\n  Done. See per-suite results above.');
  console.log('═══════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
