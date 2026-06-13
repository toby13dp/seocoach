"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Play,
  ChevronUp,
  ChevronDown,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

type BenchmarkCategory =
  | "CTR"
  | "TECHNICAL_HEALTH"
  | "PUBLISHING_FREQUENCY"
  | "CONTENT_GROWTH"
  | "CONVERSION_RATE"
  | "ISSUE_RESOLUTION_SPEED"
  | "GEO_READINESS"
  | "AI_VISIBILITY"
  | "ORGANIC_GROWTH"
  | "PUBLICATION_SPEED";

interface BenchmarkScore {
  category: BenchmarkCategory;
  score: number;
  previousScore?: number;
  change?: number;
  percentile?: number;
  peerCount?: number;
}

interface ConsentItem {
  category: BenchmarkCategory;
  isConsented: boolean;
}

const CATEGORY_LABELS: Record<BenchmarkCategory, string> = {
  CTR: "Clickthroughratio",
  TECHNICAL_HEALTH: "Technische gezondheid",
  PUBLISHING_FREQUENCY: "Publicatiefrequentie",
  CONTENT_GROWTH: "Contentgroei",
  CONVERSION_RATE: "Conversieratio",
  ISSUE_RESOLUTION_SPEED: "Probleemoplossingssnelheid",
  GEO_READINESS: "GEO-gereedheid",
  AI_VISIBILITY: "AI-zichtbaarheid",
  ORGANIC_GROWTH: "Organische groei",
  PUBLICATION_SPEED: "Publicatiesnelheid",
};

const ALL_CATEGORIES: BenchmarkCategory[] = [
  "CTR",
  "TECHNICAL_HEALTH",
  "PUBLISHING_FREQUENCY",
  "CONTENT_GROWTH",
  "CONVERSION_RATE",
  "ISSUE_RESOLUTION_SPEED",
  "GEO_READINESS",
  "AI_VISIBILITY",
  "ORGANIC_GROWTH",
  "PUBLICATION_SPEED",
];

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
  if (score >= 40) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Uitstekend";
  if (score >= 60) return "Goed";
  if (score >= 40) return "Matig";
  return "Slecht";
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function BenchmarksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [benchmarks, setBenchmarks] = useState<BenchmarkScore[]>([]);
  const [consent, setConsent] = useState<ConsentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isSavingConsent, setIsSavingConsent] = useState(false);

  useEffect(() => {
    fetchBenchmarks();
    fetchConsent();
  }, [projectId]);

  const fetchBenchmarks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/benchmarks`);
      if (res.ok) {
        const data = await res.json();
        setBenchmarks(data.data || []);
      }
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConsent = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/benchmarks/consent`);
      if (res.ok) {
        const data = await res.json();
        setConsent(data.data || []);
      }
    } catch {
      // silently handle
    }
  };

  const handleRunBenchmarks = async () => {
    setIsRunning(true);
    try {
      const now = new Date();
      const periodEnd = now.toISOString();
      const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

      const inputs = ALL_CATEGORIES.map((category) => ({
        category,
        projectId,
        organizationId: "",
        periodStart,
        periodEnd,
        metrics: {},
      }));

      const res = await fetch(`/api/projects/${projectId}/benchmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs,
          periodStart,
          periodEnd,
        }),
      });

      if (res.ok) {
        toast.success("Benchmarks uitgevoerd");
        fetchBenchmarks();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fout bij uitvoeren benchmarks");
      }
    } catch {
      toast.error("Fout bij uitvoeren benchmarks");
    } finally {
      setIsRunning(false);
    }
  };

  const handleConsentChange = async (category: BenchmarkCategory, checked: boolean) => {
    setIsSavingConsent(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/benchmarks/consent`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, isConsented: checked }),
      });

      if (res.ok) {
        setConsent((prev) =>
          prev.map((c) =>
            c.category === category ? { ...c, isConsented: checked } : c
          )
        );
        toast.success(
          checked
            ? `Toestemming gegeven voor ${CATEGORY_LABELS[category]}`
            : `Toestemming ingetrokken voor ${CATEGORY_LABELS[category]}`
        );
      } else {
        toast.error("Fout bij wijzigen toestemming");
      }
    } catch {
      toast.error("Fout bij wijzigen toestemming");
    } finally {
      setIsSavingConsent(false);
    }
  };

  const getConsentForCategory = (category: BenchmarkCategory): boolean => {
    return consent.find((c) => c.category === category)?.isConsented ?? false;
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-4 md:p-6 space-y-6"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/projects/${projectId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Benchmarks</h1>
          <p className="text-sm text-muted-foreground">
            Vergelijk je prestaties met branchegenoten
          </p>
        </div>
        <Button onClick={handleRunBenchmarks} disabled={isRunning}>
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uitvoeren...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Benchmarks uitvoeren
            </>
          )}
        </Button>
      </motion.div>

      {/* Benchmark Cards Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-32 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : benchmarks.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium mb-2">
                Nog geen benchmarks beschikbaar
              </h3>
              <p className="text-sm text-muted-foreground">
                Voer benchmarks uit om je prestaties te vergelijken met
                branchegenoten.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {benchmarks.map((benchmark) => {
            const label = CATEGORY_LABELS[benchmark.category] || benchmark.category;
            const scoreColor = getScoreColor(benchmark.score);
            const scoreBgColor = getScoreBgColor(benchmark.score);
            const changeIsPositive =
              benchmark.change !== undefined && benchmark.change >= 0;

            return (
              <motion.div key={benchmark.category} variants={item}>
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Score */}
                    <div className="flex items-end gap-2">
                      <span className={`text-4xl font-bold ${scoreColor}`}>
                        {Math.round(benchmark.score)}
                      </span>
                      <span className="text-sm text-muted-foreground mb-1">/100</span>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1">
                      <Progress value={benchmark.score} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {getScoreLabel(benchmark.score)}
                      </p>
                    </div>

                    {/* Change from previous */}
                    {benchmark.previousScore !== undefined &&
                      benchmark.change !== undefined && (
                        <div className="flex items-center gap-1.5">
                          {changeIsPositive ? (
                            <ChevronUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                          )}
                          <span
                            className={`text-sm font-medium ${
                              changeIsPositive
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {Math.abs(benchmark.change).toFixed(1)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            t.o.v. vorige ({Math.round(benchmark.previousScore)})
                          </span>
                        </div>
                      )}

                    {/* Percentile */}
                    {benchmark.percentile !== undefined && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          P{Math.round(benchmark.percentile)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          percentiel
                          {benchmark.peerCount !== undefined && (
                            <> &middot; {benchmark.peerCount} peers</>
                          )}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Consent Section */}
      <motion.div variants={item}>
        <Separator className="my-6" />
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">
            Anonieme vergelijking — Toestemming
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Geef toestemming per categorie om je geanonimiseerde gegevens te
          vergelijken met andere cliënten. Jouw gegevens worden nooit individueel
          getoond.
        </p>

        <Card>
          <CardContent className="p-4 md:p-6">
            {consent.length === 0 && !isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ALL_CATEGORIES.map((category) => (
                  <div
                    key={category}
                    className="flex items-center gap-3 py-2"
                  >
                    <Checkbox
                      id={`consent-${category}`}
                      checked={false}
                      onCheckedChange={(checked) =>
                        handleConsentChange(category, checked === true)
                      }
                      disabled={isSavingConsent}
                    />
                    <Label
                      htmlFor={`consent-${category}`}
                      className="text-sm cursor-pointer"
                    >
                      {CATEGORY_LABELS[category]}
                    </Label>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {consent.map((c) => (
                  <div
                    key={c.category}
                    className="flex items-center gap-3 py-2"
                  >
                    <Checkbox
                      id={`consent-${c.category}`}
                      checked={c.isConsented}
                      onCheckedChange={(checked) =>
                        handleConsentChange(c.category, checked === true)
                      }
                      disabled={isSavingConsent}
                    />
                    <Label
                      htmlFor={`consent-${c.category}`}
                      className="text-sm cursor-pointer"
                    >
                      {CATEGORY_LABELS[c.category]}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
