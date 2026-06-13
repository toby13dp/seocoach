/**
 * SEO Rule Engine Tests
 * Tests for /src/lib/rules/engine.ts
 */

import { RuleEngine, getRuleEngine, resetRuleEngine } from '@/lib/rules/engine';
import type { PageAnalysis } from '@/lib/rules/types';

// ============================================================================
// Test Framework
// ============================================================================

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`  ✗ ${name}: ${msg}`);
    console.log(`  ✗ ${name}: ${msg}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, label?: string): void {
  if (actual !== expected) {
    throw new Error(
      `Expected ${label ? label + ': ' : ''}${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertTrue(value: boolean, label?: string): void {
  if (!value) throw new Error(`Expected true${label ? ` (${label})` : ''}, got false`);
}

function assertFalse(value: boolean, label?: string): void {
  if (value) throw new Error(`Expected false${label ? ` (${label})` : ''}, got true`);
}

// ============================================================================
// Helpers
// ============================================================================

function createWellFormedPage(): PageAnalysis {
  return {
    url: 'https://example.com/good-page',
    statusCode: 200,
    title: 'Goede Pagina Titel - Voorbeeld Site',
    description: 'Een uitgebreide beschrijving van de pagina-inhoud voor SEO-doeleinden.',
    h1: 'Welkom op onze pagina',
    canonicalUrl: 'https://example.com/good-page',
    metaRobots: 'index, follow',
    wordCount: 500,
    internalLinkCount: 5,
    externalLinkCount: 2,
    imageCount: 3,
    imagesWithoutAlt: 0,
    structuredData: [{ '@type': 'Article' }],
    crawlDepth: 1,
    isOrphan: false,
    contentType: 'HTML',
    language: 'nl-NL',
    indexability: 'INDEXABLE',
    duplicateGroup: null,
    similarityScore: null,
    redirectChain: null,
    loadTimeMs: 500,
    htmlSizeBytes: 50000,
    hreflang: [{ hreflang: 'nl', href: 'https://example.com/good-page' }],
    headings: [
      { level: 1, text: 'Welkom op onze pagina' },
      { level: 2, text: 'Sectie één' },
      { level: 2, text: 'Sectie twee' },
    ],
    internalLinks: [
      { href: '/about', anchor: 'Over ons' },
      { href: '/contact', anchor: 'Contact' },
    ],
    externalLinks: [
      { href: 'https://external.com', anchor: 'Externe link' },
    ],
    images: [
      { src: '/img/photo.jpg', alt: 'Foto beschrijving' },
      { src: '/img/logo.png', alt: 'Logo' },
    ],
  };
}

function createMissingTitlePage(): PageAnalysis {
  const page = createWellFormedPage();
  page.title = null;
  return page;
}

function create404Page(): PageAnalysis {
  return {
    url: 'https://example.com/not-found',
    statusCode: 404,
    title: null,
    description: null,
    h1: null,
    canonicalUrl: null,
    metaRobots: null,
    wordCount: 0,
    internalLinkCount: 0,
    externalLinkCount: 0,
    imageCount: 0,
    imagesWithoutAlt: 0,
    structuredData: null,
    crawlDepth: 0,
    isOrphan: false,
    contentType: 'HTML',
    language: null,
    indexability: 'NON_INDEXABLE',
    duplicateGroup: null,
    similarityScore: null,
    redirectChain: null,
    loadTimeMs: null,
    htmlSizeBytes: null,
    hreflang: null,
    headings: null,
    internalLinks: null,
    externalLinks: null,
    images: null,
  };
}

function createThinContentPage(): PageAnalysis {
  const page = createWellFormedPage();
  page.wordCount = 50;
  return page;
}

// ============================================================================
// Tests
// ============================================================================

export function run(): void {
  console.log('\n📦 SEO Rule Engine Tests\n');
  passed = 0;
  failed = 0;
  failures.length = 0;

  // Reset singleton for clean tests
  resetRuleEngine();

  // --- Run all rules on well-formed page (no issues expected) ---
  test('Well-formed page produces no meta issues', () => {
    const engine = new RuleEngine();
    const issues = engine.runAllRules(createWellFormedPage());
    // Should have very few or no issues for a well-formed page
    const metaIssues = issues.filter((i) => i.ruleId.startsWith('meta-missing'));
    assertEqual(metaIssues.length, 0, 'meta-missing issues');
  });

  test('Well-formed page produces no status code issues', () => {
    const engine = new RuleEngine();
    const issues = engine.runAllRules(createWellFormedPage());
    const statusIssues = issues.filter((i) => i.ruleId.startsWith('status-'));
    assertEqual(statusIssues.length, 0, 'status issues');
  });

  test('Well-formed page produces no thin content issue', () => {
    const engine = new RuleEngine();
    const issues = engine.runAllRules(createWellFormedPage());
    const thinIssues = issues.filter((i) => i.ruleId === 'content-thin');
    assertEqual(thinIssues.length, 0, 'thin content issues');
  });

  // --- Run rules on page with missing title ---
  test('Missing title page finds meta-missing-title issue', () => {
    const engine = new RuleEngine();
    const issues = engine.runAllRules(createMissingTitlePage());
    const titleIssue = issues.find((i) => i.ruleId === 'meta-missing-title');
    assertTrue(titleIssue !== undefined, 'should find missing title issue');
  });

  test('Missing title issue has ERROR severity', () => {
    const engine = new RuleEngine();
    const issues = engine.runAllRules(createMissingTitlePage());
    const titleIssue = issues.find((i) => i.ruleId === 'meta-missing-title');
    assertEqual(titleIssue?.severity, 'ERROR');
  });

  // --- Run rules on 404 page ---
  test('404 page finds status-4xx issue', () => {
    const engine = new RuleEngine();
    const issues = engine.runAllRules(create404Page());
    const statusIssue = issues.find((i) => i.ruleId === 'status-4xx');
    assertTrue(statusIssue !== undefined, 'should find 4xx issue');
  });

  test('404 page issue has ERROR severity', () => {
    const engine = new RuleEngine();
    const issues = engine.runAllRules(create404Page());
    const statusIssue = issues.find((i) => i.ruleId === 'status-4xx');
    assertEqual(statusIssue?.severity, 'ERROR');
  });

  test('500 page finds status-5xx issue', () => {
    const engine = new RuleEngine();
    const page = create404Page();
    page.statusCode = 500;
    const issues = engine.runAllRules(page);
    const statusIssue = issues.find((i) => i.ruleId === 'status-5xx');
    assertTrue(statusIssue !== undefined, 'should find 5xx issue');
    assertEqual(statusIssue?.severity, 'CRITICAL');
  });

  // --- Run rules on thin content page ---
  test('Thin content page finds content-thin issue', () => {
    const engine = new RuleEngine();
    const issues = engine.runAllRules(createThinContentPage());
    const thinIssue = issues.find((i) => i.ruleId === 'content-thin');
    assertTrue(thinIssue !== undefined, 'should find thin content issue');
  });

  test('Thin content issue has WARNING severity', () => {
    const engine = new RuleEngine();
    const issues = engine.runAllRules(createThinContentPage());
    const thinIssue = issues.find((i) => i.ruleId === 'content-thin');
    assertEqual(thinIssue?.severity, 'WARNING');
  });

  // --- Severity levels are correct ---
  test('Rule engine severity levels include all expected values', () => {
    const engine = new RuleEngine();
    const defs = engine.getRuleDefinitions();
    const severities = new Set(defs.map((d) => d.severity));
    assertTrue(severities.has('INFO'), 'has INFO');
    assertTrue(severities.has('WARNING'), 'has WARNING');
    assertTrue(severities.has('ERROR'), 'has ERROR');
    assertTrue(severities.has('CRITICAL'), 'has CRITICAL');
  });

  // --- Dutch explanations are present ---
  test('All issues have Dutch explanations', () => {
    const engine = new RuleEngine();
    const issues = engine.runAllRules(createMissingTitlePage());
    for (const issue of issues) {
      assertTrue(
        issue.dutchExplanation.length > 0,
        `Issue ${issue.ruleId} should have Dutch explanation`
      );
    }
  });

  test('Issue Dutch explanations contain Dutch words', () => {
    const engine = new RuleEngine();
    const issues = engine.runAllRules(createMissingTitlePage());
    const titleIssue = issues.find((i) => i.ruleId === 'meta-missing-title');
    assertTrue(titleIssue !== undefined);
    // Check for Dutch words: "titel", "pagina", "zoekmachines"
    const explanation = titleIssue!.dutchExplanation.toLowerCase();
    assertTrue(
      explanation.includes('titel') || explanation.includes('pagina') || explanation.includes('zoekmachines'),
      'Dutch explanation should contain Dutch words'
    );
  });

  // --- Rule categories are correct ---
  test('Rule categories include expected categories', () => {
    const engine = new RuleEngine();
    const categories = engine.getCategories();
    assertTrue(categories.includes('status-codes'), 'has status-codes');
    assertTrue(categories.includes('meta'), 'has meta');
    assertTrue(categories.includes('content'), 'has content');
    assertTrue(categories.includes('canonical'), 'has canonical');
  });

  test('getRulesByCategory returns only rules in that category', () => {
    const engine = new RuleEngine();
    const metaRules = engine.getRulesByCategory('meta');
    for (const rule of metaRules) {
      assertEqual(rule.category, 'meta');
    }
    assertTrue(metaRules.length > 0, 'should have meta rules');
  });

  // --- Cross-page rules: duplicate titles ---
  test('Cross-page rules detect duplicate titles', () => {
    const engine = new RuleEngine();
    const page1 = createWellFormedPage();
    const page2 = createWellFormedPage();
    page2.url = 'https://example.com/other-page';

    const issues = engine.runAllCrossPageRules([page1, page2]);
    const duplicateTitleIssue = issues.find((i) => i.ruleId === 'meta-duplicate-title');
    assertTrue(duplicateTitleIssue !== undefined, 'should detect duplicate title');
  });

  test('Cross-page rules do not flag unique titles', () => {
    const engine = new RuleEngine();
    const page1 = createWellFormedPage();
    const page2 = createWellFormedPage();
    page2.url = 'https://example.com/other-page';
    page2.title = 'Andere Pagina Titel - Uniek';

    const issues = engine.runAllCrossPageRules([page1, page2]);
    const duplicateTitleIssue = issues.find((i) => i.ruleId === 'meta-duplicate-title');
    assertTrue(duplicateTitleIssue === undefined, 'should not flag unique titles');
  });

  // --- Enable/disable rules ---
  test('Disable rule prevents it from running', () => {
    const engine = new RuleEngine();
    engine.disableRule('meta-missing-title');
    const issues = engine.runAllRules(createMissingTitlePage());
    const titleIssue = issues.find((i) => i.ruleId === 'meta-missing-title');
    assertTrue(titleIssue === undefined, 'disabled rule should not produce issue');
  });

  test('Re-enable rule allows it to run again', () => {
    const engine = new RuleEngine();
    engine.disableRule('meta-missing-title');
    engine.enableRule('meta-missing-title');
    const issues = engine.runAllRules(createMissingTitlePage());
    const titleIssue = issues.find((i) => i.ruleId === 'meta-missing-title');
    assertTrue(titleIssue !== undefined, 're-enabled rule should produce issue');
  });

  test('isRuleEnabled returns correct state', () => {
    const engine = new RuleEngine();
    assertTrue(engine.isRuleEnabled('meta-missing-title'));
    engine.disableRule('meta-missing-title');
    assertFalse(engine.isRuleEnabled('meta-missing-title'));
    engine.enableRule('meta-missing-title');
    assertTrue(engine.isRuleEnabled('meta-missing-title'));
  });

  // --- Run single rule ---
  test('runRule executes a specific rule by ID', () => {
    const engine = new RuleEngine();
    const result = engine.runRule('status-4xx', create404Page());
    assertTrue(result !== null, 'should find 4xx issue');
    assertEqual(result?.ruleId, 'status-4xx');
  });

  test('runRule returns null for unknown rule ID', () => {
    const engine = new RuleEngine();
    const result = engine.runRule('nonexistent-rule', createWellFormedPage());
    assertEqual(result, null);
  });

  // --- Singleton ---
  test('getRuleEngine returns singleton instance', () => {
    resetRuleEngine();
    const engine1 = getRuleEngine();
    const engine2 = getRuleEngine();
    assertEqual(engine1, engine2);
    resetRuleEngine(); // Clean up
  });

  // --- Recommended actions are present ---
  test('All issues have recommended actions', () => {
    const engine = new RuleEngine();
    const issues = engine.runAllRules(createMissingTitlePage());
    for (const issue of issues) {
      assertTrue(
        issue.recommendedAction.length > 0,
        `Issue ${issue.ruleId} should have recommended action`
      );
    }
  });

  // Summary
  console.log(`\n  Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\n  Failures:');
    failures.forEach((f) => console.log(f));
  }
}

