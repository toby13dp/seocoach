"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Globe,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MinusCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

interface GeoCheck {
  id: string;
  category: string;
  status: string;
  score: number;
  title: string;
  description: string;
  recommendation: string | null;
  evidence: string | null;
  checkedAt: string;
}

interface GeoSummary {
  overallScore: number;
  categoryScores: Record<string, number>;
  totalChecks: number;
  passingChecks: number;
  failingChecks: number;
  notCheckedChecks: number;
  calculatedAt: string;
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  DIRECT_ANSWERS: "Bevat je pagina's duidelijke, directe antwoorden op veelgestelde vragen?",
  DEFINITIONS: "Worden belangrijke termen en concepten helder gedefinieerd?",
  ANSWER_BLOCKS: "Zijn antwoorden gestructureerd in blokken die AI-modellen gemakkelijk kunnen extraheren?",
  ENTITY_CLARITY: "Is voor AI duidelijk welke entiteiten je content beschrijft?",
  ORGANISATION_CLARITY: "Is jouw organisatie als entiteit herkenbaar voor AI-systemen?",
  AUTHOR_INFORMATION: "Worden auteurs van content duidelijk geïdentificeerd met hun expertise?",
  SOURCE_TRANSPARENCY: "Verwijs je naar betrouwbare bronnen en wordt jezelf als bron geciteerd?",
  DATES: "Zijn publicatie- en updatedatums duidelijk zichtbaar op je pagina's?",
  STRUCTURED_DATA: "Gebruik je schema.org markup om AI-systemen te helpen je content begrijpen?",
  FAQS: "Bevat je site FAQ-pagina's of -secties met gestructureerde vragen en antwoorden?",
  UNIQUE_INFORMATION: "Bied je informatie die niet algemeen beschikbaar is op andere sites?",
  CITABLE_FACTS: "Bevat je content feiten, statistieken of uitspraken die door AI als bron geciteerd kunnen worden?",
  CRAWLABILITY: "Kunnen zoekmachines en AI-systemen je content correct crawlen en lezen?",
  INDEXABILITY: "Zijn je pagina's correct geïndexeerd en niet geblokkeerd?",
  BRAND_CONSISTENCY: "Is je merknaam consistent en correct weergegeven across je hele webpresence?",
};

export default function GeoReadinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [checks, setChecks] = useState<GeoCheck[]>([]);
  const [summary, setSummary] = useState<GeoSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [note] = useState(
    "Dit is geen meting van werkelijke AI-zichtbaarheid, maar een analyse van je gereedheid."
  );

  useEffect(() => {
    fetchGeoData();
  }, [projectId]);

  const fetchGeoData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/geo`);
      if (res.ok) {
        const data = await res.json();
        setChecks(data.data?.checks ?? []);
        setSummary(data.data?.summary ?? null);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/geo`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setChecks(data.data?.checks ?? []);
        setSummary(data.data?.summary ?? null);
        toast.success("GEO-analyse voltooid");
      } else {
        toast.error("Analyse mislukt");
      }
    } catch {
      toast.error("Analyse mislukt");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDismiss = async (checkId: string, dismissed: boolean) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/geo/${checkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: !dismissed }),
      });
      if (res.ok) {
        setChecks(prev =>
          prev.map(c => {
            if (c.id === checkId) {
              const evidence = c.evidence ? JSON.parse(c.evidence) : {};
              return { ...c, evidence: JSON.stringify({ ...evidence, dismissed: !dismissed }) };
            }
            return c;
          })
        );
        toast.success(dismissed ? "Controle hersteld" : "Controle genegeerd");
      }
    } catch {
      toast.error("Actie mislukt");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PASSING":
        return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
      case "NEEDS_IMPROVEMENT":
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case "FAILING":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "NOT_CHECKED":
        return <MinusCircle className="h-5 w-5 text-gray-400" />;
      default:
        return <MinusCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "PASSING":
        return "Goed";
      case "NEEDS_IMPROVEMENT":
        return "Verbetering nodig";
      case "FAILING":
        return "Onvoldoende";
      case "NOT_CHECKED":
        return "Niet gecontroleerd";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PASSING":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300";
      case "NEEDS_IMPROVEMENT":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
      case "FAILING":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-emerald-600";
    if (score >= 40) return "text-amber-600";
    return "text-red-600";
  };

  const isDismissed = (check: GeoCheck) => {
    try {
      const evidence = check.evidence ? JSON.parse(check.evidence) : {};
      return evidence.dismissed === true;
    } catch {
      return false;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
          onClick={() => router.push(`/projects/${projectId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-violet-600" />
            GEO-gereedheid
          </h1>
          <p className="text-sm text-muted-foreground">
            Analyseer je gereedheid voor AI-zoeksystemen
          </p>
        </div>
        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="bg-violet-600 hover:bg-violet-700"
        >
          {isAnalyzing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Analyse uitvoeren
        </Button>
      </div>

      {/* Disclaimer Banner */}
      <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-violet-900 dark:text-violet-200">{note}</p>
          <p className="text-xs text-violet-700 dark:text-violet-400 mt-1">
            GEO-gereedheid meet of je content geoptimaliseerd is voor AI-systemen, niet of je daadwerkelijk genoemd wordt.
          </p>
        </div>
      </div>

      {/* Overall Score */}
      {summary && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-8">
              {/* Circular Gauge */}
              <div className="relative w-32 h-32 shrink-0">
                <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60" cy="60" r="50"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="10"
                    className="text-muted/30"
                  />
                  <circle
                    cx="60" cy="60" r="50"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="10"
                    strokeDasharray={`${(summary.overallScore / 100) * 314.16} 314.16`}
                    strokeLinecap="round"
                    className={
                      summary.overallScore >= 70
                        ? "text-emerald-500"
                        : summary.overallScore >= 40
                        ? "text-amber-500"
                        : "text-red-500"
                    }
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-3xl font-bold ${getScoreColor(summary.overallScore)}`}>
                    {Math.round(summary.overallScore)}
                  </span>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-lg font-semibold">Totaalscore</h3>
                  <p className="text-sm text-muted-foreground">
                    Laatst berekend: {new Date(summary.calculatedAt).toLocaleDateString("nl-NL")}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-600">{summary.passingChecks}</p>
                    <p className="text-xs text-muted-foreground">Goed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-600">{summary.totalChecks - summary.passingChecks - summary.failingChecks - summary.notCheckedChecks}</p>
                    <p className="text-xs text-muted-foreground">Verbetering nodig</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{summary.failingChecks}</p>
                    <p className="text-xs text-muted-foreground">Onvoldoende</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">15 GEO-categorieën</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {checks.map((check) => {
            const dismissed = isDismissed(check);
            return (
              <Card
                key={check.id}
                className={`transition-colors ${dismissed ? "opacity-50" : ""}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(check.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{check.title}</p>
                        <Badge
                          className={`text-xs shrink-0 ${getStatusColor(check.status)}`}
                          variant="secondary"
                        >
                          {Math.round(check.score)}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {CATEGORY_DESCRIPTIONS[check.category] ?? check.description}
                      </p>
                      <div className="mt-2">
                        <Progress
                          value={check.score}
                          className="h-1.5"
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <Badge className={`text-xs ${getStatusColor(check.status)}`} variant="secondary">
                          {getStatusLabel(check.status)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() =>
                            setExpandedCheck(expandedCheck === check.id ? null : check.id)
                          }
                        >
                          Details
                          {expandedCheck === check.id ? (
                            <ChevronUp className="ml-1 h-3 w-3" />
                          ) : (
                            <ChevronDown className="ml-1 h-3 w-3" />
                          )}
                        </Button>
                      </div>

                      {/* Expanded Details */}
                      {expandedCheck === check.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          className="mt-3 pt-3 border-t space-y-2"
                        >
                          {check.recommendation && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">Aanbeveling:</span>{" "}
                              {check.recommendation}
                            </p>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => handleDismiss(check.id, dismissed)}
                          >
                            {dismissed ? "Herstellen" : "Negeren"}
                          </Button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {checks.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Globe className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Nog geen GEO-analyse uitgevoerd</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                Voer een analyse uit om te controleren of je website geoptimaliseerd is voor AI-zoeksystemen.
              </p>
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {isAnalyzing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Analyse uitvoeren
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
