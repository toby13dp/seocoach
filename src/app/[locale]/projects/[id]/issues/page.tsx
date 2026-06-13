"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "@/i18n/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  ChevronDown,
  Eye,
  EyeOff,
  ShieldAlert,
  Bug,
  AlertOctagon,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

interface IssuePage {
  id: string;
  url: string;
  title: string | null;
}

interface TechnicalIssue {
  id: string;
  projectId: string;
  pageId: string | null;
  crawlSessionId: string;
  ruleId: string;
  ruleName: string;
  dutchExplanation: string;
  technicalDetails: string | null;
  evidence: string | null;
  severity: string;
  priority: string;
  impact: string | null;
  effort: string;
  affectedUrls: string | null;
  recommendedAction: string | null;
  autoFixAvailable: boolean;
  confidence: number;
  dismissed: boolean;
  dismissedBy: string | null;
  dismissedAt: string | null;
  createdAt: string;
  page: IssuePage | null;
}

interface SeverityCounts {
  CRITICAL?: number;
  ERROR?: number;
  WARNING?: number;
  INFO?: number;
  [key: string]: number | undefined;
}

const CATEGORY_MAP: Record<string, string> = {
  "status-codes": "categoryStatusCodes",
  "redirect": "categoryRedirects",
  "canonical": "categoryCanonical",
  "meta": "categoryMeta",
  "heading": "categoryHeadings",
  "broken-link": "categoryLinks",
  "orphan": "categoryLinks",
  "deep-page": "categoryLinks",
  "thin-content": "categoryContent",
  "duplicate-content": "categoryContent",
  "image": "categoryImages",
  "https": "categorySecurity",
  "structured-data": "categoryStructuredData",
  "hreflang": "categoryHreflang",
  "sitemap": "categorySitemap",
};

function getCategoryFromRuleId(ruleId: string): string {
  const prefix = ruleId.split("-")[0] + "-" + ruleId.split("-")[1];
  // Try matching the first two segments
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (ruleId.startsWith(key)) return val;
  }
  // Try matching just the first segment
  const firstSegment = ruleId.split("-")[0];
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (key.startsWith(firstSegment)) return val;
  }
  return "categoryContent";
}

export default function IssuesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations("issues");
  const tCommon = useTranslations("common");

  const [issues, setIssues] = useState<TechnicalIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [severityCounts, setSeverityCounts] = useState<SeverityCounts>({});
  const [totalIssues, setTotalIssues] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasCrawl, setHasCrawl] = useState(true);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showDismissed, setShowDismissed] = useState(false);
  const [groupByCategory, setGroupByCategory] = useState(false);

  // Expanded issues
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchIssues = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("limit", "20");
      if (severityFilter !== "all") params.set("severity", severityFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (showDismissed) params.set("dismissed", "true");
      else params.set("dismissed", "false");

      const res = await fetch(`/api/projects/${id}/issues?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setIssues(data.data || []);
        setTotalIssues(data.meta?.total || 0);
        setTotalPages(data.meta?.totalPages || 1);
        setSeverityCounts(data.meta?.severityCounts || {});
        if (data.data?.length === 0 && data.meta?.total === 0 && !data.meta?.severityCounts) {
          // Check if there's no crawl at all
          setHasCrawl(false);
        }
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [id, currentPage, severityFilter, priorityFilter, categoryFilter, showDismissed]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [severityFilter, priorityFilter, categoryFilter, showDismissed]);

  const handleDismiss = async (issueId: string, currentDismissed: boolean) => {
    try {
      const res = await fetch(`/api/projects/${id}/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: !currentDismissed }),
      });
      if (res.ok) {
        toast.success(!currentDismissed ? t("dismissSuccess") : t("undismissSuccess"));
        fetchIssues();
      } else {
        toast.error(t("dismissError"));
      }
    } catch {
      toast.error(t("dismissError"));
    }
  };

  const toggleExpanded = (issueId: string) => {
    const next = new Set(expandedIds);
    if (next.has(issueId)) {
      next.delete(issueId);
    } else {
      next.add(issueId);
    }
    setExpandedIds(next);
  };

  const severityIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return <AlertOctagon className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case "ERROR": return <XCircle className="h-4 w-4 text-red-500" />;
      case "WARNING": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "INFO": return <Info className="h-4 w-4 text-blue-500" />;
      default: return <Bug className="h-4 w-4 text-gray-400" />;
    }
  };

  const severityVariant = (severity: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (severity) {
      case "CRITICAL": return "destructive";
      case "ERROR": return "destructive";
      case "WARNING": return "secondary";
      case "INFO": return "outline";
      default: return "secondary";
    }
  };

  const severityLabel = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return t("critical");
      case "ERROR": return "Fout";
      case "WARNING": return t("warnings").replace(/s$/, "");
      case "INFO": return t("info");
      default: return severity;
    }
  };

  const priorityLabel = (priority: string) => {
    switch (priority) {
      case "CRITICAL": return "Kritiek";
      case "HIGH": return "Hoog";
      case "MEDIUM": return "Gemiddeld";
      case "LOW": return "Laag";
      case "MINIMAL": return "Minimaal";
      default: return priority;
    }
  };

  const priorityVariant = (priority: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (priority) {
      case "CRITICAL": return "destructive";
      case "HIGH": return "default";
      case "MEDIUM": return "secondary";
      case "LOW": return "outline";
      default: return "outline";
    }
  };

  const parseAffectedUrls = (jsonStr: string | null): string[] => {
    if (!jsonStr) return [];
    try {
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const parseEvidence = (jsonStr: string | null): Record<string, unknown>[] | Record<string, unknown> | string | null => {
    if (!jsonStr) return null;
    try {
      return JSON.parse(jsonStr) as Record<string, unknown>[] | Record<string, unknown>;
    } catch {
      return jsonStr;
    }
  };

  // Group issues by category
  const groupedIssues = (): Record<string, TechnicalIssue[]> => {
    const groups: Record<string, TechnicalIssue[]> = {};
    for (const issue of issues) {
      const catKey = getCategoryFromRuleId(issue.ruleId);
      if (!groups[catKey]) groups[catKey] = [];
      groups[catKey].push(issue);
    }
    return groups;
  };

  // Available categories from current issues
  const availableCategories = Array.from(
    new Set(issues.map((i) => getCategoryFromRuleId(i.ruleId)))
  );

  // No crawl yet state
  if (!isLoading && !hasCrawl && issues.length === 0 && Object.keys(severityCounts).length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 mb-6"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/projects/${id}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
          </motion.div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center max-w-md">
                {t("noCrawlYet")}
              </p>
              <Button
                className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => router.push(`/projects/${id}/crawls`)}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Naar crawls
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-6"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/projects/${id}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
        </motion.div>

        {/* Summary stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6"
        >
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{totalIssues}</p>
              <p className="text-sm text-muted-foreground">{t("total")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                {(severityCounts.CRITICAL || 0) + (severityCounts.ERROR || 0)}
              </p>
              <p className="text-sm text-muted-foreground">{t("critical")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                {severityCounts.WARNING || 0}
              </p>
              <p className="text-sm text-muted-foreground">{t("warnings")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {severityCounts.INFO || 0}
              </p>
              <p className="text-sm text-muted-foreground">{t("info")}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-4"
        >
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("filterSeverity")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("filterSeverity")}</SelectItem>
                    <SelectItem value="CRITICAL">{t("critical")}</SelectItem>
                    <SelectItem value="ERROR">Fout</SelectItem>
                    <SelectItem value="WARNING">{t("warnings")}</SelectItem>
                    <SelectItem value="INFO">{t("info")}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("filterPriority")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("filterPriority")}</SelectItem>
                    <SelectItem value="CRITICAL">Kritiek</SelectItem>
                    <SelectItem value="HIGH">Hoog</SelectItem>
                    <SelectItem value="MEDIUM">Gemiddeld</SelectItem>
                    <SelectItem value="LOW">Laag</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("filterCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("filterCategory")}</SelectItem>
                    {availableCategories.map((catKey) => (
                      <SelectItem key={catKey} value={catKey}>
                        {t(catKey as never)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Switch
                    id="showDismissed"
                    checked={showDismissed}
                    onCheckedChange={setShowDismissed}
                  />
                  <Label htmlFor="showDismissed" className="text-sm">
                    {t("showDismissed")}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="groupByCategory"
                    checked={groupByCategory}
                    onCheckedChange={setGroupByCategory}
                  />
                  <Label htmlFor="groupByCategory" className="text-sm">
                    {t("groupByCategory")}
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Issues list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : issues.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t("noIssues")}</h3>
              <p className="text-sm text-muted-foreground">{t("noIssuesDesc")}</p>
            </CardContent>
          </Card>
        ) : groupByCategory ? (
          // Grouped view
          <div className="space-y-6">
            {Object.entries(groupedIssues()).map(([catKey, catIssues]) => (
              <div key={catKey}>
                <h3 className="text-lg font-semibold mb-3">
                  {t(catKey as never)} ({catIssues.length})
                </h3>
                <div className="space-y-3">
                  {catIssues.map((issue, index) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      index={index}
                      expanded={expandedIds.has(issue.id)}
                      onToggleExpand={() => toggleExpanded(issue.id)}
                      onDismiss={() => handleDismiss(issue.id, issue.dismissed)}
                      t={t}
                      severityIcon={severityIcon}
                      severityVariant={severityVariant}
                      severityLabel={severityLabel}
                      priorityLabel={priorityLabel}
                      priorityVariant={priorityVariant}
                      parseAffectedUrls={parseAffectedUrls}
                      parseEvidence={parseEvidence}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Flat list view
          <div className="space-y-3">
            {issues.map((issue, index) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                index={index}
                expanded={expandedIds.has(issue.id)}
                onToggleExpand={() => toggleExpanded(issue.id)}
                onDismiss={() => handleDismiss(issue.id, issue.dismissed)}
                t={t}
                severityIcon={severityIcon}
                severityVariant={severityVariant}
                severityLabel={severityLabel}
                priorityLabel={priorityLabel}
                priorityVariant={priorityVariant}
                parseAffectedUrls={parseAffectedUrls}
                parseEvidence={parseEvidence}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              {tCommon("previous")}
            </Button>
            <span className="text-sm text-muted-foreground">
              {tCommon("status")} {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              {tCommon("next")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Issue card component
function IssueCard({
  issue,
  index,
  expanded,
  onToggleExpand,
  onDismiss,
  t,
  severityIcon,
  severityVariant,
  severityLabel,
  priorityLabel,
  priorityVariant,
  parseAffectedUrls,
  parseEvidence,
}: {
  issue: TechnicalIssue;
  index: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onDismiss: () => void;
  t: (key: string) => string;
  severityIcon: (s: string) => React.ReactNode;
  severityVariant: (s: string) => "default" | "secondary" | "destructive" | "outline";
  severityLabel: (s: string) => string;
  priorityLabel: (s: string) => string;
  priorityVariant: (s: string) => "default" | "secondary" | "destructive" | "outline";
  parseAffectedUrls: (s: string | null) => string[];
  parseEvidence: (s: string | null) => Record<string, unknown>[] | Record<string, unknown> | string | null;
}) {
  const affectedUrls = parseAffectedUrls(issue.affectedUrls);
  const evidence = parseEvidence(issue.evidence);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Card className={issue.dismissed ? "opacity-60" : ""}>
        <Collapsible open={expanded} onOpenChange={onToggleExpand}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <CollapsibleTrigger asChild>
                <div className="flex items-start gap-3 flex-1 cursor-pointer">
                  {severityIcon(issue.severity)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{issue.dutchExplanation}</p>
                    {issue.page && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {issue.page.url}
                      </p>
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={severityVariant(issue.severity)} className="text-xs">
                  {severityLabel(issue.severity)}
                </Badge>
                <Badge variant={priorityVariant(issue.priority)} className="text-xs">
                  {priorityLabel(issue.priority)}
                </Badge>
                {affectedUrls.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {affectedUrls.length} URL{"'"}{affectedUrls.length !== 1 ? "s" : ""}
                  </Badge>
                )}
                <Button
                  variant={issue.dismissed ? "outline" : "ghost"}
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss();
                  }}
                >
                  {issue.dismissed ? (
                    <>
                      <Eye className="h-3 w-3 mr-1" />
                      {t("undismiss")}
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3 w-3 mr-1" />
                      {t("dismiss")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* Recommended action */}
          {issue.recommendedAction && (
            <CardContent className="pt-0 pb-3">
              <div className="ml-7">
                <p className="text-sm">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {t("recommendedAction")}:
                  </span>{" "}
                  {issue.recommendedAction}
                </p>
              </div>
            </CardContent>
          )}

          <CollapsibleContent>
            <CardContent className="pt-0 pb-4">
              <div className="ml-7 space-y-3 border-t pt-3">
                {/* Technical details */}
                {issue.technicalDetails && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("technicalDetails")}
                    </p>
                    <p className="text-sm bg-muted p-2 rounded">{issue.technicalDetails}</p>
                  </div>
                )}

                {/* Evidence */}
                {evidence && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("evidence")}
                    </p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-48 overflow-y-auto">
                      {typeof evidence === "string"
                        ? evidence
                        : JSON.stringify(evidence, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Affected URLs */}
                {affectedUrls.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("affectedUrls")} ({affectedUrls.length})
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-0.5">
                      {affectedUrls.map((url, i) => (
                        <p key={i} className="text-xs text-muted-foreground truncate">
                          {url}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rule ID and metadata */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Regel: {issue.ruleId}</span>
                  {issue.autoFixAvailable && (
                    <Badge variant="outline" className="text-xs">
                      Auto-fix beschikbaar
                    </Badge>
                  )}
                  <span>
                    {new Date(issue.createdAt).toLocaleDateString("nl-NL")}
                  </span>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </motion.div>
  );
}

// Helper to avoid apostrophe issues in JSX
const apost = "'";
