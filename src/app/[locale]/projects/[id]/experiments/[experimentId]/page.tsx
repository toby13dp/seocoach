"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Circle,
  Play,
  XCircle,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Target,
  FlaskConical,
  Lightbulb,
  ArrowRight,
  Award,
} from "lucide-react";
import { toast } from "sonner";

// --- Types ---
interface ExperimentResult {
  testGroupResult: number;
  controlGroupResult: number;
  improvement: number;
  confidence: number;
  isSignificant: boolean;
  sampleSize: number;
  testGroupSize: number;
  controlGroupSize: number;
}

interface Recommendation {
  id: string;
  content: string;
  type: string;
  priority: string;
}

interface ExperimentDetail {
  id: string;
  projectId: string;
  name: string;
  hypothesis: string;
  kpiName: string | null;
  baseline: number | null;
  target: number | null;
  controlGroupSize: number | null;
  testGroupSize: number | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  result: ExperimentResult | null;
  createdAt: string;
  updatedAt: string;
}

// --- Dutch Labels ---
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Concept",
  RUNNING: "Actief",
  COMPLETED: "Afgerond",
  CANCELLED: "Geannuleerd",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  RUNNING: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  COMPLETED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const PRIORITY_LABELS: Record<string, string> = {
  HIGH: "Hoog",
  MEDIUM: "Gemiddeld",
  LOW: "Laag",
};

export default function ExperimentDetailPage({
  params,
}: {
  params: Promise<{ id: string; experimentId: string }>;
}) {
  const { id: projectId, experimentId } = use(params);
  const router = useRouter();

  const [experiment, setExperiment] = useState<ExperimentDetail | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Results form
  const [resultForm, setResultForm] = useState({
    testGroupResult: "",
    controlGroupResult: "",
  });

  useEffect(() => {
    fetchExperiment();
  }, [projectId, experimentId]);

  const fetchExperiment = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/experiments/${experimentId}`
      );
      if (res.ok) {
        const data = await res.json();
        setExperiment(data.experiment || data);
      }

      // Fetch recommendations if experiment is completed
      const recRes = await fetch(
        `/api/projects/${projectId}/experiments/recommendations`
      );
      if (recRes.ok) {
        const recData = await recRes.json();
        setRecommendations(recData.recommendations || []);
      }
    } catch {
      // Silently handle
    } finally {
      setIsLoading(false);
    }
  }, [projectId, experimentId]);

  const handleStart = async () => {
    setIsActioning(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/experiments/${experimentId}/start`,
        { method: "POST" }
      );
      if (res.ok) {
        toast.success("Experiment gestart");
        fetchExperiment();
      } else {
        toast.error("Fout bij het starten");
      }
    } catch {
      toast.error("Fout bij het starten");
    } finally {
      setIsActioning(false);
    }
  };

  const handleComplete = async () => {
    setIsActioning(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/experiments/${experimentId}/complete`,
        { method: "POST" }
      );
      if (res.ok) {
        toast.success("Experiment afgerond");
        fetchExperiment();
      } else {
        toast.error("Fout bij het afronden");
      }
    } catch {
      toast.error("Fout bij het afronden");
    } finally {
      setIsActioning(false);
    }
  };

  const handleCancel = async () => {
    setIsActioning(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/experiments/${experimentId}/cancel`,
        { method: "POST" }
      );
      if (res.ok) {
        toast.success("Experiment geannuleerd");
        fetchExperiment();
      } else {
        toast.error("Fout bij het annuleren");
      }
    } catch {
      toast.error("Fout bij het annuleren");
    } finally {
      setIsActioning(false);
    }
  };

  const handleRecordResults = async () => {
    if (!resultForm.testGroupResult || !resultForm.controlGroupResult) {
      toast.error("Vul beide resultaten in");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/experiments/${experimentId}/results`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            testGroupResult: parseFloat(resultForm.testGroupResult),
            controlGroupResult: parseFloat(resultForm.controlGroupResult),
          }),
        }
      );
      if (res.ok) {
        toast.success("Resultaten opgeslagen");
        setResultsOpen(false);
        setResultForm({ testGroupResult: "", controlGroupResult: "" });
        fetchExperiment();
      } else {
        toast.error("Fout bij het opslaan van resultaten");
      }
    } catch {
      toast.error("Fout bij het opslaan van resultaten");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("nl-NL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4 md:p-6 space-y-6"
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" disabled>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="h-8 w-64 animate-pulse bg-muted rounded" />
            <div className="h-4 w-48 animate-pulse bg-muted rounded mt-2" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-40 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
    );
  }

  if (!experiment) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4 md:p-6 space-y-6"
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/projects/${projectId}/cro`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            Experiment niet gevonden
          </h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              Het opgevraagde experiment bestaat niet of is verwijderd.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const statusSteps = ["DRAFT", "RUNNING", "COMPLETED"];
  const currentStepIndex = statusSteps.indexOf(experiment.status);
  const result = experiment.result;

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
          onClick={() => router.push(`/projects/${projectId}/cro`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {experiment.name}
            </h1>
            <Badge className={STATUS_COLORS[experiment.status] || ""}>
              {STATUS_LABELS[experiment.status] || experiment.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Experiment details en resultaten
          </p>
        </div>
      </div>

      {/* Experiment Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Experimentgegevens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Hypothese
                </p>
                <p className="text-sm">{experiment.hypothesis}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  KPI
                </p>
                <p className="text-sm">{experiment.kpiName || "—"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Baseline
                </p>
                <p className="text-lg font-semibold">
                  {experiment.baseline !== null ? `${experiment.baseline}%` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Doel
                </p>
                <p className="text-lg font-semibold">
                  {experiment.target !== null ? `${experiment.target}%` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Controlegroep
                </p>
                <p className="text-sm font-medium">
                  {experiment.controlGroupSize?.toLocaleString("nl-NL") || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Testgroep
                </p>
                <p className="text-sm font-medium">
                  {experiment.testGroupSize?.toLocaleString("nl-NL") || "—"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Workflow */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Statusworkflow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            {statusSteps.map((step, index) => {
              const isCompleted =
                currentStepIndex > index ||
                experiment.status === "COMPLETED";
              const isCurrent =
                currentStepIndex === index &&
                experiment.status !== "COMPLETED" &&
                experiment.status !== "CANCELLED";
              const isCancelled = experiment.status === "CANCELLED";

              return (
                <div key={step} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isCancelled
                          ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
                          : isCompleted
                          ? "border-emerald-500 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950"
                          : isCurrent
                          ? "border-primary bg-primary/10"
                          : "border-muted bg-muted"
                      }`}
                    >
                      {isCancelled ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                      ) : isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : isCurrent ? (
                        <Circle className="h-5 w-5 text-primary fill-primary/20" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <span
                      className={`text-xs mt-1.5 font-medium ${
                        isCompleted
                          ? "text-emerald-600 dark:text-emerald-400"
                          : isCurrent
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {STATUS_LABELS[step]}
                    </span>
                  </div>
                  {index < statusSteps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 ${
                        isCancelled
                          ? "bg-red-200 dark:bg-red-800"
                          : isCompleted
                          ? "bg-emerald-300 dark:bg-emerald-700"
                          : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {experiment.status === "DRAFT" && (
              <Button onClick={handleStart} disabled={isActioning}>
                {isActioning ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Start experiment
              </Button>
            )}
            {experiment.status === "RUNNING" && (
              <>
                <Button onClick={() => setResultsOpen(true)}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Resultaten invoeren
                </Button>
                <Button onClick={handleComplete} disabled={isActioning}>
                  {isActioning ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Afronden
                </Button>
              </>
            )}
            {(experiment.status === "DRAFT" ||
              experiment.status === "RUNNING") && (
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isActioning}
                className="text-red-600 hover:text-red-700"
              >
                {isActioning ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Annuleren
              </Button>
            )}
            {experiment.status === "CANCELLED" && (
              <p className="text-sm text-muted-foreground">
                Dit experiment is geannuleerd.
              </p>
            )}
          </div>

          {/* Dates */}
          <div className="flex items-center gap-6 mt-4 text-sm text-muted-foreground">
            <span>Aangemaakt: {formatDate(experiment.createdAt)}</span>
            {experiment.startDate && (
              <span>Gestart: {formatDate(experiment.startDate)}</span>
            )}
            {experiment.endDate && (
              <span>Afgerond: {formatDate(experiment.endDate)}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Card (if completed or has results) */}
      {(experiment.status === "COMPLETED" || result) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Resultaten
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-6">
                {/* Group Results Comparison */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="border-muted">
                    <CardContent className="p-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Controlegroep
                      </p>
                      <p className="text-2xl font-bold">
                        {result.controlGroupResult.toFixed(2)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {result.controlGroupSize?.toLocaleString("nl-NL") || experiment.controlGroupSize?.toLocaleString("nl-NL") || "—"} bezoekers
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-muted">
                    <CardContent className="p-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Testgroep
                      </p>
                      <p className="text-2xl font-bold">
                        {result.testGroupResult.toFixed(2)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {result.testGroupSize?.toLocaleString("nl-NL") || experiment.testGroupSize?.toLocaleString("nl-NL") || "—"} bezoekers
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Improvement */}
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      result.improvement >= 0
                        ? "bg-emerald-100 dark:bg-emerald-900"
                        : "bg-red-100 dark:bg-red-900"
                    }`}
                  >
                    {result.improvement > 0 ? (
                      <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    ) : result.improvement < 0 ? (
                      <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                    ) : (
                      <Minus className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Verbetering
                    </p>
                    <p
                      className={`text-2xl font-bold ${
                        result.improvement >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {result.improvement >= 0 ? "+" : ""}
                      {result.improvement.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Confidence Gauge */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Betrouwbaarheid</p>
                    <p className="text-sm font-bold">
                      {result.confidence.toFixed(1)}%
                    </p>
                  </div>
                  <div className="relative">
                    <Progress
                      value={result.confidence}
                      className="h-3"
                    />
                    {/* Significance threshold marker at 95% */}
                    <div
                      className="absolute top-0 h-3 w-0.5 bg-foreground"
                      style={{ left: "95%" }}
                      title="95% significantiedrempel"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Significantiedrempel: 95%
                  </p>
                </div>

                {/* Significance Badge */}
                <div className="flex items-center gap-3 p-4 rounded-lg">
                  {result.isSignificant ? (
                    <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
                      <Award className="h-6 w-6" />
                      <div>
                        <p className="font-medium">
                          Wel statistisch significant
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Het resultaat is statistisch significant bij een
                          betrouwbaarheidsniveau van 95%.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-6 w-6" />
                      <div>
                        <p className="font-medium">
                          Niet statistisch significant
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Het resultaat is niet statistisch significant. Overweeg
                          de test langer door te laten lopen.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sample Size Warning */}
                {(result.testGroupSize < 100 ||
                  result.controlGroupSize < 100) && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                        Waarschuwing: steekproefgrootte te klein
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                        Minimaal 100 bezoekers per groep wordt aanbevolen voor
                        betrouwbare resultaten. Huidige groepen:
                        test {result.testGroupSize}, controle{" "}
                        {result.controlGroupSize}.
                      </p>
                    </div>
                  </div>
                )}

                {/* Conclusion */}
                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Conclusie
                  </p>
                  <p className="text-sm">
                    {result.isSignificant
                      ? `De testgroep presteerde ${
                          result.improvement >= 0 ? "beter" : "slechter"
                        } dan de controlegroep met een verbetering van ${
                          result.improvement >= 0 ? "+" : ""
                        }${result.improvement.toFixed(2)}%. Dit resultaat is statistisch significant (betrouwbaarheid: ${result.confidence.toFixed(
                          1
                        )}%).`
                      : `De testgroep toonde een verschil van ${
                          result.improvement >= 0 ? "+" : ""
                        }${result.improvement.toFixed(
                          2
                        )}%, maar dit is niet statistisch significant (betrouwbaarheid: ${result.confidence.toFixed(
                          1
                        )}%). Verzamel meer data of pas de test aan.`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nog geen resultaten vastgelegd voor dit experiment.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recommendations Section (if completed) */}
      {experiment.status === "COMPLETED" && recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Aanbevelingen
            </CardTitle>
            <CardDescription>
              Op basis van de experimentresultaten
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                >
                  <ArrowRight className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm">{rec.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {rec.type}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          rec.priority === "HIGH"
                            ? "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400"
                            : rec.priority === "MEDIUM"
                            ? "border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400"
                            : ""
                        }`}
                      >
                        {PRIORITY_LABELS[rec.priority] || rec.priority}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Record Results Dialog */}
      <Dialog open={resultsOpen} onOpenChange={setResultsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resultaten invoeren</DialogTitle>
            <DialogDescription>
              Voer de resultaten in voor de test- en controlegroep.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="test-result">Testgroep resultaat (%)</Label>
              <Input
                id="test-result"
                type="number"
                step="0.01"
                value={resultForm.testGroupResult}
                onChange={(e) =>
                  setResultForm({
                    ...resultForm,
                    testGroupResult: e.target.value,
                  })
                }
                placeholder="Bijv. 4.8"
              />
              <p className="text-xs text-muted-foreground">
                Conversiepercentage van de testgroep
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="control-result">
                Controlegroep resultaat (%)
              </Label>
              <Input
                id="control-result"
                type="number"
                step="0.01"
                value={resultForm.controlGroupResult}
                onChange={(e) =>
                  setResultForm({
                    ...resultForm,
                    controlGroupResult: e.target.value,
                  })
                }
                placeholder="Bijv. 3.5"
              />
              <p className="text-xs text-muted-foreground">
                Conversiepercentage van de controlegroep
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResultsOpen(false)}>
              Annuleren
            </Button>
            <Button
              onClick={handleRecordResults}
              disabled={
                isSubmitting ||
                !resultForm.testGroupResult ||
                !resultForm.controlGroupResult
              }
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
