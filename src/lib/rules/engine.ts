// ============================================================================
// SEO Rule Engine — Core Engine
// ============================================================================
//
// The RuleEngine registers all per-page and cross-page rules, runs them
// against PageAnalysis inputs, and returns TechnicalIssueResult arrays.
//
// Usage:
//   const engine = new RuleEngine();
//   const issues = engine.runAllRules(pageAnalysis);
//   const crossIssues = engine.runAllCrossPageRules(allPages);
// ---------------------------------------------------------------------------

import type {
  TechnicalRule,
  PageAnalysis,
  TechnicalIssueResult,
  RuleEntry,
  CrossPageRuleEntry,
} from './types';

// Import all rule modules
import { statusCodesRules } from './rules/status-codes';
import { redirectChainRules } from './rules/redirect-chains';
import { redirectLoopRules } from './rules/redirect-loops';
import { canonicalErrorRules } from './rules/canonical-errors';
import { metaIssueRules, metaCrossPageRules } from './rules/meta-issues';
import { headingIssueRules } from './rules/heading-issues';
import { brokenLinksRules } from './rules/broken-links';
import { orphanPageRules } from './rules/orphan-pages';
import { deepPageRules } from './rules/deep-pages';
import { thinContentRules } from './rules/thin-content';
import { duplicateContentRules, checkDuplicateContentCrossPage } from './rules/duplicate-content';
import { imageIssueRules } from './rules/image-issues';
import { httpsIssueRules } from './rules/https-issues';
import { structuredDataIssueRules } from './rules/structured-data-issues';
import { hreflangIssueRules, hreflangCrossPageRules } from './rules/hreflang-issues';
import { sitemapIssueRules } from './rules/sitemap-issues';

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class RuleEngine {
  private perPageRules: Map<string, RuleEntry> = new Map();
  private crossPageRules: Map<string, CrossPageRuleEntry> = new Map();
  private disabledRules: Set<string> = new Set();

  constructor() {
    this.registerDefaultRules();
  }

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  private registerDefaultRules(): void {
    const allPerPageRules: RuleEntry[] = [
      ...statusCodesRules,
      ...redirectChainRules,
      ...redirectLoopRules,
      ...canonicalErrorRules,
      ...metaIssueRules,
      ...headingIssueRules,
      ...brokenLinksRules,
      ...orphanPageRules,
      ...deepPageRules,
      ...thinContentRules,
      ...duplicateContentRules,
      ...imageIssueRules,
      ...httpsIssueRules,
      ...structuredDataIssueRules,
      ...hreflangIssueRules,
      ...sitemapIssueRules,
    ];

    for (const rule of allPerPageRules) {
      this.perPageRules.set(rule.definition.id, rule);
    }

    const allCrossPageRules: CrossPageRuleEntry[] = [
      ...metaCrossPageRules,
      ...hreflangCrossPageRules,
    ];

    // duplicateContentRules has a cross-page variant too
    allCrossPageRules.push({
      definition: duplicateContentRules[0].definition,
      check: checkDuplicateContentCrossPage,
    });

    for (const rule of allCrossPageRules) {
      this.crossPageRules.set(rule.definition.id, rule);
    }
  }

  /**
   * Add a custom per-page rule to the engine.
   */
  addRule(entry: RuleEntry): void {
    this.perPageRules.set(entry.definition.id, entry);
  }

  /**
   * Add a custom cross-page rule to the engine.
   */
  addCrossPageRule(entry: CrossPageRuleEntry): void {
    this.crossPageRules.set(entry.definition.id, entry);
  }

  /**
   * Disable a specific rule by ID. It will be skipped during execution.
   */
  disableRule(ruleId: string): void {
    this.disabledRules.add(ruleId);
  }

  /**
   * Re-enable a previously disabled rule.
   */
  enableRule(ruleId: string): void {
    this.disabledRules.delete(ruleId);
  }

  /**
   * Check whether a rule is currently enabled.
   */
  isRuleEnabled(ruleId: string): boolean {
    return !this.disabledRules.has(ruleId);
  }

  // -------------------------------------------------------------------------
  // Execution — per-page
  // -------------------------------------------------------------------------

  /**
   * Run all enabled per-page rules against a single page analysis.
   */
  runAllRules(page: PageAnalysis): TechnicalIssueResult[] {
    const results: TechnicalIssueResult[] = [];

    for (const [ruleId, rule] of this.perPageRules) {
      if (this.disabledRules.has(ruleId)) continue;
      try {
        const result = rule.check(page);
        if (result !== null) {
          results.push(result);
        }
      } catch (error) {
        console.error(`[RuleEngine] Error running rule ${ruleId}:`, error);
      }
    }

    return results;
  }

  /**
   * Run a single per-page rule by ID.
   */
  runRule(ruleId: string, page: PageAnalysis): TechnicalIssueResult | null {
    const rule = this.perPageRules.get(ruleId);
    if (!rule) return null;
    if (this.disabledRules.has(ruleId)) return null;

    try {
      return rule.check(page);
    } catch (error) {
      console.error(`[RuleEngine] Error running rule ${ruleId}:`, error);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Execution — cross-page
  // -------------------------------------------------------------------------

  /**
   * Run all enabled cross-page rules against an array of page analyses.
   */
  runAllCrossPageRules(pages: PageAnalysis[]): TechnicalIssueResult[] {
    const results: TechnicalIssueResult[] = [];

    for (const [ruleId, rule] of this.crossPageRules) {
      if (this.disabledRules.has(ruleId)) continue;
      try {
        const ruleResults = rule.check(pages);
        results.push(...ruleResults);
      } catch (error) {
        console.error(`[RuleEngine] Error running cross-page rule ${ruleId}:`, error);
      }
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Query
  // -------------------------------------------------------------------------

  /**
   * Get all registered rule definitions (both per-page and cross-page).
   */
  getRuleDefinitions(): TechnicalRule[] {
    const perPage = [...this.perPageRules.values()].map(r => r.definition);
    const crossPage = [...this.crossPageRules.values()].map(r => r.definition);
    return [...perPage, ...crossPage];
  }

  /**
   * Get rule definitions filtered by category.
   */
  getRulesByCategory(category: string): TechnicalRule[] {
    return this.getRuleDefinitions().filter(r => r.category === category);
  }

  /**
   * Get all per-page rule entries.
   */
  getPerPageRules(): RuleEntry[] {
    return [...this.perPageRules.values()];
  }

  /**
   * Get all cross-page rule entries.
   */
  getCrossPageRules(): CrossPageRuleEntry[] {
    return [...this.crossPageRules.values()];
  }

  /**
   * Get a single rule definition by ID.
   */
  getRuleDefinition(ruleId: string): TechnicalRule | undefined {
    const perPage = this.perPageRules.get(ruleId);
    if (perPage) return perPage.definition;
    const crossPage = this.crossPageRules.get(ruleId);
    if (crossPage) return crossPage.definition;
    return undefined;
  }

  /**
   * Get all unique categories across all rules.
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    for (const rule of this.getRuleDefinitions()) {
      categories.add(rule.category);
    }
    return [...categories].sort();
  }
}

// ---------------------------------------------------------------------------
// Singleton instance for convenience
// ---------------------------------------------------------------------------

let _instance: RuleEngine | null = null;

export function getRuleEngine(): RuleEngine {
  if (!_instance) {
    _instance = new RuleEngine();
  }
  return _instance;
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetRuleEngine(): void {
  _instance = null;
}
