"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "@/i18n/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Tag,
  Link2,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";

// --- Types ---
interface OpportunityScoreData {
  id: string;
  totalScore: number;
  volumeScore: number;
  difficultyScore: number;
  relevanceScore: number;
  currentRankScore: number;
  intentScore: number;
  funnelScore: number;
  competitionScore: number;
  calculationDetails: string | null;
  calculatedAt: string;
}

interface RelatedPage {
  id: string;
  url: string;
  title: string | null;
  relevance: number;
}

interface AssociatedTopic {
  id: string;
  name: string;
  isPillar: boolean;
}

interface KeywordDetail {
  id: string;
  keyword: string;
  searchIntent: string;
  funnelStage: string;
  searchVolume: number | null;
  difficulty: number | null;
  cpc: number | null;
  currentRanking: number | null;
  currentUrl: string | null;
  groupId: string | null;
  tags: string[] | null;
  notes: string | null;
  source: string;
  opportunity: OpportunityScoreData | null;
  keywordPages: Array<{ id: string; relevance: number; page: RelatedPage }>;
  topicKeywords: Array<{ id: string; topic: AssociatedTopic }>;
  createdAt: string;
  updatedAt: string;
}

interface ScoreStep {
  component: string;
  rawValue: string;
  score: number;
  weight: number;
  explanation: string;
}

interface ScoreDetails {
  keyword: string;
  weights: Record<string, number>;
  steps: ScoreStep[];
  totalScore: number;
  summary: string;
}

// --- Badge helpers (same as parent) ---
const intentBadgeStyle = (intent: string) => {
  switch (intent) {
    case "INFORMATIONAL":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "NAVIGATIONAL":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "TRANSACTIONAL":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    case "COMMERCIAL_INVESTIGATION":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case "LOCAL":
      return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300";
    case "BRANDED":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const funnelBadgeStyle = (stage: string) => {
  switch (stage) {
    case "AWARENESS":
      return "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300";
    case "CONSIDERATION":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    case "DECISION":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300";
    case "RETENTION":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const intentLabel = (intent: string, t: (k: string) => string) => {
  switch (intent) {
    case "INFORMATIONAL": return t("informational");
    case "NAVIGATIONAL": return t("navigational");
    case "TRANSACTIONAL": return t("transactional");
    case "COMMERCIAL_INVESTIGATION": return t("commercialInvestigation");
    case "LOCAL": return t("local");
    case "BRANDED": return t("branded");
    default: return t("unknown");
  }
};

const funnelLabel = (stage: string, t: (k: string) => string) => {
  switch (stage) {
    case "AWARENESS": return t("awareness");
    case "CONSIDERATION": return t("consideration");
    case "DECISION": return t("decision");
    case "RETENTION": return t("retention");
    default: return t("unknown");
  }
};

const scoreColor = (score: number) => {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
};

const progressBarColor = (score: number) => {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-red-500";
};

// Score component keys to translation keys
const scoreComponentKey = (key: string) => {
  switch (key) {
    case "volumeScore": return "volumeScore";
    case "difficultyScore": return "difficultyScore";
    case "relevanceScore": return "relevanceScore";
    case "currentRankScore": return "currentRankScore";
    case "intentScore": return "intentScore";
    case "funnelScore": return "funnelScore";
    case "competitionScore": return "competitionScore";
    default: return key;
  }
};

export default function KeywordDetailPage({
  params,
}: {
  params: Promise<{ id: string; keywordId: string }>;
}) {
  const { id: projectId, keywordId } = use(params);
  const router = useRouter();
  const t = useTranslations("keywords");
  const tCommon = useTranslations("common");

  const [keywordData, setKeywordData] = useState<KeywordDetail | null>(null);
  const [scoreDetails, setScoreDetails] = useState<ScoreDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/keywords/${keywordId}`
        );
        if (res.ok) {
          const data = await res.json();
          const kwData = data.data;
          setKeywordData(kwData);

          // Parse calculation details if available
          if (kwData.opportunity?.calculationDetails) {
            try {
              const details =
                typeof kwData.opportunity.calculationDetails === "string"
                  ? JSON.parse(kwData.opportunity.calculationDetails)
                  : kwData.opportunity.calculationDetails;
              setScoreDetails(details);
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch {
        // silently fail
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [projectId, keywordId]);

  // Recalculate score
  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/keywords/${keywordId}/score`,
        { method: "POST" }
      );
      if (res.ok) {
        const data = await res.json();
        toast.success(t("recalculateSuccess"));

        // Update keyword data with new score
        if (data.data?.score) {
          setKeywordData((prev) =>
            prev
              ? {
                  ...prev,
                  opportunity: {
                    ...prev.opportunity!,
                    ...data.data.score,
                  },
                }
              : prev
          );
        }
        if (data.data?.details) {
          setScoreDetails(data.data.details);
        }

        // Re-fetch to get fresh data
        const detailRes = await fetch(
          `/api/projects/${projectId}/keywords/${keywordId}`
        );
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          setKeywordData(detailData.data);
          if (detailData.data.opportunity?.calculationDetails) {
            try {
              const details =
                typeof detailData.data.opportunity.calculationDetails === "string"
                  ? JSON.parse(detailData.data.opportunity.calculationDetails)
                  : detailData.data.opportunity.calculationDetails;
              setScoreDetails(details);
            } catch {
              // ignore
            }
          }
        }
      } else {
        toast.error(t("recalculateError"));
      }
    } catch {
      toast.error(t("recalculateError"));
    } finally {
      setIsRecalculating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!keywordData) {
    return (
      <div className="p-4 md:p-6">
        <Button
          variant="ghost"
          onClick={() => router.push(`/projects/${projectId}/keywords`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tCommon("back")}
        </Button>
        <p className="text-muted-foreground mt-4">{tCommon("noResults")}</p>
      </div>
    );
  }

  const opp = keywordData.opportunity;

  // Score components for the bar chart visualization
  const scoreComponents = opp
    ? [
        { key: "volumeScore", value: opp.volumeScore, weight: 0.25 },
        { key: "difficultyScore", value: opp.difficultyScore, weight: 0.15 },
        { key: "relevanceScore", value: opp.relevanceScore, weight: 0.15 },
        { key: "currentRankScore", value: opp.currentRankScore, weight: 0.20 },
        { key: "intentScore", value: opp.intentScore, weight: 0.10 },
        { key: "funnelScore", value: opp.funnelScore, weight: 0.05 },
        { key: "competitionScore", value: opp.competitionScore, weight: 0.10 },
      ]
    : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 md:p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/projects/${projectId}/keywords`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {keywordData.keyword}
            </h1>
            <Badge
              variant="outline"
              className={intentBadgeStyle(keywordData.searchIntent)}
            >
              {intentLabel(keywordData.searchIntent, t)}
            </Badge>
            <Badge
              variant="outline"
              className={funnelBadgeStyle(keywordData.funnelStage)}
            >
              {funnelLabel(keywordData.funnelStage, t)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {t("keywordDetail")}
          </p>
        </div>
      </div>

      {/* Keyword metrics summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {t("volume")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {keywordData.searchVolume?.toLocaleString("nl-NL") ?? "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {t("difficulty")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {keywordData.difficulty != null
                ? keywordData.difficulty.toFixed(0)
                : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {t("cpc")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {keywordData.cpc != null
                ? `€${keywordData.cpc.toFixed(2)}`
                : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {t("position")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {keywordData.currentRanking ?? "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Opportunity Score */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{t("scoreBreakdown")}</CardTitle>
              <CardDescription>
                {opp
                  ? `${t("totalScore")}: ${opp.calculatedAt ? new Date(opp.calculatedAt).toLocaleDateString("nl-NL") : ""}`
                  : t("noScore")}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalculate}
              disabled={isRecalculating}
            >
              {isRecalculating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t("recalculate")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {opp ? (
            <div className="space-y-6">
              {/* Total score gauge */}
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="currentColor"
                      className="text-muted"
                      strokeWidth="8"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="currentColor"
                      className={
                        opp.totalScore >= 70
                          ? "text-emerald-500"
                          : opp.totalScore >= 40
                          ? "text-yellow-500"
                          : "text-red-500"
                      }
                      strokeWidth="8"
                      strokeDasharray={`${(opp.totalScore / 100) * 251.3} 251.3`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span
                    className={`absolute inset-0 flex items-center justify-center text-xl font-bold ${scoreColor(opp.totalScore)}`}
                  >
                    {opp.totalScore.toFixed(0)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{t("totalScore")}</p>
                  {scoreDetails?.summary && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {scoreDetails.summary}
                    </p>
                  )}
                </div>
              </div>

              {/* Score component bars */}
              <div className="space-y-3">
                {scoreComponents.map((comp) => (
                  <div key={comp.key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t(scoreComponentKey(comp.key))}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {t("weight")}: {(comp.weight * 100).toFixed(0)}%
                        </span>
                        <span className={`font-semibold tabular-nums ${scoreColor(comp.value)}`}>
                          {comp.value.toFixed(0)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${progressBarColor(comp.value)}`}
                        style={{ width: `${comp.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Calculation trace */}
              {scoreDetails?.steps && scoreDetails.steps.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-3">
                    Berekeningsdetails
                  </h4>
                  <div className="space-y-3">
                    {scoreDetails.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className="border rounded-lg p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {step.component}
                          </span>
                          <span className="text-sm font-semibold tabular-nums">
                            {step.score.toFixed(0)}/100
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {step.explanation}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Waarde: {step.rawValue} | {t("weight")}: {(step.weight * 100).toFixed(0)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{t("noScore")}</p>
              <Button
                className="mt-4"
                size="sm"
                onClick={handleRecalculate}
                disabled={isRecalculating}
              >
                {isRecalculating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("recalculate")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional info grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Related pages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              {t("relatedPages")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {keywordData.keywordPages &&
            keywordData.keywordPages.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("page")}</TableHead>
                    <TableHead className="text-right">
                      {t("relevance")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keywordData.keywordPages.map((kp) => (
                    <TableRow key={kp.id}>
                      <TableCell className="max-w-[250px]">
                        <div>
                          {kp.page.title && (
                            <p className="text-sm font-medium truncate">
                              {kp.page.title}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground truncate">
                            {kp.page.url}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {kp.relevance.toFixed(0)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <Link2 className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t("noRelatedPages")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Associated topics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {t("associatedTopics")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {keywordData.topicKeywords &&
            keywordData.topicKeywords.length > 0 ? (
              <div className="space-y-2">
                {keywordData.topicKeywords.map((tk) => (
                  <div
                    key={tk.id}
                    className="flex items-center justify-between border rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {tk.topic.name}
                      </span>
                      {tk.topic.isPillar && (
                        <Badge
                          variant="default"
                          className="text-xs bg-emerald-600"
                        >
                          Pilaar
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        router.push(
                          `/projects/${projectId}/topics?highlight=${tk.topic.id}`
                        )
                      }
                    >
                      {tCommon("details")}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <BookOpen className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t("noAssociatedTopics")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Extra info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aanvullende gegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {keywordData.groupId && (
              <div>
                <span className="text-sm text-muted-foreground">Groep:</span>
                <p className="text-sm font-medium">{keywordData.groupId}</p>
              </div>
            )}
            {keywordData.currentUrl && (
              <div>
                <span className="text-sm text-muted-foreground">
                  Huidige URL:
                </span>
                <p className="text-sm font-medium truncate">
                  {keywordData.currentUrl}
                </p>
              </div>
            )}
            <div>
              <span className="text-sm text-muted-foreground">Bron:</span>
              <p className="text-sm font-medium capitalize">
                {keywordData.source}
              </p>
            </div>
            {keywordData.tags && keywordData.tags.length > 0 && (
              <div className="md:col-span-3">
                <span className="text-sm text-muted-foreground">Tags:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {keywordData.tags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      <Tag className="mr-1 h-3 w-3" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {keywordData.notes && (
              <div className="md:col-span-3">
                <span className="text-sm text-muted-foreground">Notities:</span>
                <p className="text-sm mt-1">{keywordData.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
