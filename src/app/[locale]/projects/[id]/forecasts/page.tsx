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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Plus,
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  Users,
  MousePointerClick,
  Target,
  LineChart,
  PieChart,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Trash2,
  Lightbulb,
  Eye,
  Calculator,
} from "lucide-react";
import { toast } from "sonner";

// --- Types ---
interface ForecastScenario {
  scenario: string;
  traffic: number;
  clicks: number;
  conversions: number;
  revenue: number;
  confidence: number;
  assumptions: string[];
  trafficRange: [number, number];
  clicksRange: [number, number];
  conversionsRange: [number, number];
  revenueRange: [number, number];
}

interface Forecast {
  id: string;
  scenario: string;
  period: number;
  currentTraffic: number;
  currentClicks: number;
  currentConversions: number;
  currentRevenue: number;
  currentCtr: number;
  currentAvgPosition: number;
  contentOutput: number;
  projectedTraffic: number;
  projectedClicks: number;
  projectedConversions: number;
  projectedRevenue: number;
  confidence: number;
  assumptions: string[];
  createdAt: string;
}

interface Budget {
  id: string;
  name: string;
  totalBudget: number;
  allocations: Record<string, number>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BudgetRecommendation {
  id: string;
  category: string;
  currentPercentage: number;
  recommendedPercentage: number;
  reason: string;
}

// --- Dutch Labels ---
const SCENARIO_LABELS: Record<string, string> = {
  CONSERVATIVE: "Conservatief",
  REALISTIC: "Realistisch",
  AMBITIOUS: "Ambitieus",
};

const SCENARIO_COLORS: Record<string, string> = {
  CONSERVATIVE: "border-blue-200 dark:border-blue-800",
  REALISTIC: "border-emerald-200 dark:border-emerald-800",
  AMBITIOUS: "border-amber-200 dark:border-amber-800",
};

const SCENARIO_BADGE_COLORS: Record<string, string> = {
  CONSERVATIVE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  REALISTIC: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  AMBITIOUS: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
};

const BUDGET_CATEGORIES: Record<string, string> = {
  TECHNICAL_SEO: "Technische SEO",
  CONTENT: "Content",
  UPDATES: "Updates",
  AUTHORITY: "Autoriteit",
  DIGITAL_PR: "Digitale PR",
  CRO: "CRO",
  LOCAL_SEO: "Lokale SEO",
  GEO: "GEO",
  MONITORING: "Monitoring",
  REPORTING: "Rapportage",
};

const BUDGET_COLORS: Record<string, string> = {
  TECHNICAL_SEO: "bg-blue-500",
  CONTENT: "bg-emerald-500",
  UPDATES: "bg-amber-500",
  AUTHORITY: "bg-purple-500",
  DIGITAL_PR: "bg-pink-500",
  CRO: "bg-orange-500",
  LOCAL_SEO: "bg-teal-500",
  GEO: "bg-indigo-500",
  MONITORING: "bg-gray-500",
  REPORTING: "bg-cyan-500",
};

const PERIOD_LABELS: Record<string, string> = {
  "6": "6 maanden",
  "12": "12 maanden",
  "24": "24 maanden",
};

export default function ForecastsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  // State
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recommendations, setRecommendations] = useState<BudgetRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Forecast dialog
  const [forecastOpen, setForecastOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [forecastForm, setForecastForm] = useState({
    scenario: "REALISTIC",
    period: "12",
    currentTraffic: "",
    currentClicks: "",
    currentConversions: "",
    currentRevenue: "",
    currentCtr: "",
    currentAvgPosition: "",
    contentOutput: "",
  });

  // Budget dialog
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [budgetForm, setBudgetForm] = useState({
    name: "",
    totalBudget: "",
  });
  const [allocations, setAllocations] = useState<Record<string, number>>({
    TECHNICAL_SEO: 15,
    CONTENT: 25,
    UPDATES: 10,
    AUTHORITY: 10,
    DIGITAL_PR: 5,
    CRO: 10,
    LOCAL_SEO: 5,
    GEO: 5,
    MONITORING: 10,
    REPORTING: 5,
  });

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fRes, bRes, rRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/forecasts`),
        fetch(`/api/projects/${projectId}/budgets`),
        fetch(`/api/projects/${projectId}/budgets/recommendations`),
      ]);

      if (fRes.ok) {
        const fData = await fRes.json();
        setForecasts(fData.forecasts || []);
      }
      if (bRes.ok) {
        const bData = await bRes.json();
        setBudgets(bData.budgets || []);
      }
      if (rRes.ok) {
        const rData = await rRes.json();
        setRecommendations(rData.recommendations || []);
      }
    } catch {
      // Silently handle
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Budget allocation sum
  const allocationSum = Object.values(allocations).reduce((a, b) => a + b, 0);
  const isAllocationValid = allocationSum === 100;

  // Active budget
  const activeBudget = budgets.find((b) => b.isActive);

  // Forecasts grouped by period and sorted by scenario
  const forecastsByPeriod = forecasts.reduce(
    (acc, f) => {
      if (!acc[f.period]) acc[f.period] = [];
      acc[f.period].push(f);
      return acc;
    },
    {} as Record<number, Forecast[]>
  );

  // Handlers
  const handleGenerateForecast = async () => {
    if (!forecastForm.currentTraffic) {
      toast.error("Vul ten minste het huidige verkeer in");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/forecasts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: forecastForm.scenario,
          period: parseInt(forecastForm.period),
          currentTraffic: parseInt(forecastForm.currentTraffic) || 0,
          currentClicks: parseInt(forecastForm.currentClicks) || 0,
          currentConversions: parseInt(forecastForm.currentConversions) || 0,
          currentRevenue: parseFloat(forecastForm.currentRevenue) || 0,
          currentCtr: parseFloat(forecastForm.currentCtr) || 0,
          currentAvgPosition: parseFloat(forecastForm.currentAvgPosition) || 0,
          contentOutput: parseInt(forecastForm.contentOutput) || 0,
        }),
      });
      if (res.ok) {
        toast.success("Prognose gegenereerd");
        setForecastOpen(false);
        setForecastForm({
          scenario: "REALISTIC",
          period: "12",
          currentTraffic: "",
          currentClicks: "",
          currentConversions: "",
          currentRevenue: "",
          currentCtr: "",
          currentAvgPosition: "",
          contentOutput: "",
        });
        fetchData();
      } else {
        toast.error("Fout bij het genereren van de prognose");
      }
    } catch {
      toast.error("Fout bij het genereren van de prognose");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteForecast = async (forecastId: string) => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/forecasts/${forecastId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success("Prognose verwijderd");
        fetchData();
      } else {
        toast.error("Fout bij het verwijderen");
      }
    } catch {
      toast.error("Fout bij het verwijderen");
    }
  };

  const handleSaveBudget = async () => {
    if (!budgetForm.name.trim()) {
      toast.error("Naam is vereist");
      return;
    }
    if (!budgetForm.totalBudget) {
      toast.error("Totaal budget is vereist");
      return;
    }
    if (!isAllocationValid) {
      toast.error(
        `De percentages moeten optellen tot 100%. Huidig totaal: ${allocationSum}%`
      );
      return;
    }
    setIsSaving(true);
    try {
      const url = editingBudgetId
        ? `/api/projects/${projectId}/budgets/${editingBudgetId}`
        : `/api/projects/${projectId}/budgets`;
      const method = editingBudgetId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: budgetForm.name,
          totalBudget: parseFloat(budgetForm.totalBudget),
          allocations,
        }),
      });
      if (res.ok) {
        toast.success(
          editingBudgetId ? "Budget bijgewerkt" : "Budget aangemaakt"
        );
        setBudgetOpen(false);
        setEditingBudgetId(null);
        setBudgetForm({ name: "", totalBudget: "" });
        setAllocations({
          TECHNICAL_SEO: 15,
          CONTENT: 25,
          UPDATES: 10,
          AUTHORITY: 10,
          DIGITAL_PR: 5,
          CRO: 10,
          LOCAL_SEO: 5,
          GEO: 5,
          MONITORING: 10,
          REPORTING: 5,
        });
        fetchData();
      } else {
        toast.error("Fout bij het opslaan");
      }
    } catch {
      toast.error("Fout bij het opslaan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/budgets/${budgetId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success("Budget verwijderd");
        fetchData();
      } else {
        toast.error("Fout bij het verwijderen");
      }
    } catch {
      toast.error("Fout bij het verwijderen");
    }
  };

  const openEditBudget = (budget: Budget) => {
    setEditingBudgetId(budget.id);
    setBudgetForm({
      name: budget.name,
      totalBudget: budget.totalBudget.toString(),
    });
    setAllocations(budget.allocations || {});
    setBudgetOpen(true);
  };

  const openNewBudget = () => {
    setEditingBudgetId(null);
    setBudgetForm({ name: "", totalBudget: "" });
    setAllocations({
      TECHNICAL_SEO: 15,
      CONTENT: 25,
      UPDATES: 10,
      AUTHORITY: 10,
      DIGITAL_PR: 5,
      CRO: 10,
      LOCAL_SEO: 5,
      GEO: 5,
      MONITORING: 10,
      REPORTING: 5,
    });
    setBudgetOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("nl-NL").format(value);
  };

  const formatDate = (dateStr: string) => {
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
          <h1 className="text-2xl font-bold tracking-tight">
            Prognoses & Budget
          </h1>
          <p className="text-sm text-muted-foreground">
            SEO-prognoses en budgetplanning
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-40 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Tabs defaultValue="forecasts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="forecasts">
              <LineChart className="mr-1.5 h-4 w-4" />
              Prognoses
            </TabsTrigger>
            <TabsTrigger value="budget">
              <PieChart className="mr-1.5 h-4 w-4" />
              Budget
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Prognoses */}
          <TabsContent value="forecasts" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">SEO-prognoses</h2>
                <p className="text-sm text-muted-foreground">
                  Vergelijk verschillende groeiscenario&apos;s
                </p>
              </div>
              <Button size="sm" onClick={() => setForecastOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nieuwe prognose
              </Button>
            </div>

            {forecasts.length > 0 ? (
              <div className="space-y-6">
                {/* Disclaimer */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Dit is een prognose, geen garantie. Werkelijke resultaten
                    kunnen afwijken.
                  </p>
                </div>

                {/* Group by period */}
                {Object.entries(forecastsByPeriod).map(
                  ([period, periodForecasts]) => (
                    <div key={period} className="space-y-3">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        {PERIOD_LABELS[period] || `${period} maanden`}
                      </h3>
                      <div className="grid gap-4 md:grid-cols-3">
                        {periodForecasts.map((f) => (
                          <Card
                            key={f.id}
                            className={`border-2 ${
                              SCENARIO_COLORS[f.scenario] || ""
                            }`}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <Badge
                                  className={`text-xs ${
                                    SCENARIO_BADGE_COLORS[f.scenario] || ""
                                  }`}
                                >
                                  {SCENARIO_LABELS[f.scenario] || f.scenario}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleDeleteForecast(f.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {/* Key Metrics */}
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    Verkeer
                                  </p>
                                  <p className="text-lg font-bold">
                                    {formatNumber(f.projectedTraffic)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <MousePointerClick className="h-3 w-3" />
                                    Kliks
                                  </p>
                                  <p className="text-lg font-bold">
                                    {formatNumber(f.projectedClicks)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Target className="h-3 w-3" />
                                    Conversies
                                  </p>
                                  <p className="text-lg font-bold">
                                    {formatNumber(f.projectedConversions)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    Omzet
                                  </p>
                                  <p className="text-lg font-bold">
                                    {formatCurrency(f.projectedRevenue)}
                                  </p>
                                </div>
                              </div>

                              {/* Confidence */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">
                                    Betrouwbaarheid
                                  </span>
                                  <span className="text-xs font-medium">
                                    {f.confidence.toFixed(0)}%
                                  </span>
                                </div>
                                <Progress
                                  value={f.confidence}
                                  className="h-2"
                                />
                              </div>

                              {/* Assumptions */}
                              {f.assumptions && f.assumptions.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-xs font-medium text-muted-foreground">
                                    Aannames
                                  </p>
                                  <ul className="space-y-1">
                                    {f.assumptions.map((a, i) => (
                                      <li
                                        key={i}
                                        className="text-xs text-muted-foreground flex items-start gap-1.5"
                                      >
                                        <span className="text-emerald-500 mt-0.5">
                                          •
                                        </span>
                                        {a}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              <p className="text-xs text-muted-foreground">
                                Aangemaakt op {formatDate(f.createdAt)}
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <LineChart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      Geen prognoses
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Genereer een SEO-prognose om inzicht te krijgen in de
                      verwachte groei op basis van verschillende scenario&apos;s.
                    </p>
                    <Button
                      className="mt-4"
                      onClick={() => setForecastOpen(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Nieuwe prognose
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab 2: Budget */}
          <TabsContent value="budget" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Budgetplanning</h2>
                <p className="text-sm text-muted-foreground">
                  Beheer en optimaliseer je SEO-budget
                </p>
              </div>
              <Button size="sm" onClick={openNewBudget}>
                <Plus className="mr-2 h-4 w-4" />
                Nieuw budget
              </Button>
            </div>

            {/* Active Budget */}
            {activeBudget ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <PieChart className="h-4 w-4" />
                        {activeBudget.name}
                      </CardTitle>
                      <CardDescription>
                        Totaal: {formatCurrency(activeBudget.totalBudget)} per
                        maand
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditBudget(activeBudget)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Bewerken
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteBudget(activeBudget.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(BUDGET_CATEGORIES).map(
                    ([key, label]) => {
                      const percentage =
                        activeBudget.allocations?.[key] || 0;
                      const amount =
                        (activeBudget.totalBudget * percentage) / 100;
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <span
                                className={`w-3 h-3 rounded-sm ${
                                  BUDGET_COLORS[key] || "bg-gray-400"
                                }`}
                              />
                              {label}
                            </span>
                            <span className="text-muted-foreground">
                              {percentage}% — {formatCurrency(amount)}
                            </span>
                          </div>
                          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`absolute inset-y-0 left-0 rounded-full ${
                                BUDGET_COLORS[key] || "bg-gray-400"
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    }
                  )}
                </CardContent>
              </Card>
            ) : (
              budgets.length > 0 && (
                <div className="space-y-3">
                  {budgets.map((b) => (
                    <Card key={b.id}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{b.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(b.totalBudget)} per maand
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditBudget(b)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600"
                            onClick={() => handleDeleteBudget(b.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
            )}

            {!activeBudget && budgets.length === 0 && (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Calculator className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Geen budget</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Maak een budgetplanning om je SEO-investeringen effectief
                      te verdelen over de verschillende categorieën.
                    </p>
                    <Button className="mt-4" onClick={openNewBudget}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nieuw budget
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Budget Recommendations */}
            {recommendations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Budgetaanbevelingen
                  </CardTitle>
                  <CardDescription>
                    Suggesties voor optimalisatie van je budgetverdeling
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recommendations.map((rec) => {
                      const diff =
                        rec.recommendedPercentage - rec.currentPercentage;
                      return (
                        <div
                          key={rec.id}
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              diff > 0
                                ? "bg-emerald-100 dark:bg-emerald-900"
                                : diff < 0
                                ? "bg-amber-100 dark:bg-amber-900"
                                : "bg-blue-100 dark:bg-blue-900"
                            }`}
                          >
                            {diff > 0 ? (
                              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            ) : diff < 0 ? (
                              <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {BUDGET_CATEGORIES[rec.category] || rec.category}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {rec.reason}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                Huidig: {rec.currentPercentage}%
                              </span>
                              <span className="text-xs text-muted-foreground">
                                →
                              </span>
                              <span
                                className={`text-xs font-medium ${
                                  diff > 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : diff < 0
                                    ? "text-amber-600 dark:text-amber-400"
                                    : ""
                                }`}
                              >
                                Aanbevolen: {rec.recommendedPercentage}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Generate Forecast Dialog */}
      <Dialog open={forecastOpen} onOpenChange={setForecastOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prognose genereren</DialogTitle>
            <DialogDescription>
              Genereer een SEO-prognose op basis van huidige metrics en een
              groeiscenario.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Scenario</Label>
                <Select
                  value={forecastForm.scenario}
                  onValueChange={(v) =>
                    setForecastForm({ ...forecastForm, scenario: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SCENARIO_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prognoseperiode</Label>
                <Select
                  value={forecastForm.period}
                  onValueChange={(v) =>
                    setForecastForm({ ...forecastForm, period: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />
            <p className="text-sm font-medium">Huidige metrics</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="f-traffic">Verkeer</Label>
                <Input
                  id="f-traffic"
                  type="number"
                  value={forecastForm.currentTraffic}
                  onChange={(e) =>
                    setForecastForm({
                      ...forecastForm,
                      currentTraffic: e.target.value,
                    })
                  }
                  placeholder="50000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-clicks">Kliks</Label>
                <Input
                  id="f-clicks"
                  type="number"
                  value={forecastForm.currentClicks}
                  onChange={(e) =>
                    setForecastForm({
                      ...forecastForm,
                      currentClicks: e.target.value,
                    })
                  }
                  placeholder="12000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-conversions">Conversies</Label>
                <Input
                  id="f-conversions"
                  type="number"
                  value={forecastForm.currentConversions}
                  onChange={(e) =>
                    setForecastForm({
                      ...forecastForm,
                      currentConversions: e.target.value,
                    })
                  }
                  placeholder="480"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-revenue">Omzet (€)</Label>
                <Input
                  id="f-revenue"
                  type="number"
                  value={forecastForm.currentRevenue}
                  onChange={(e) =>
                    setForecastForm({
                      ...forecastForm,
                      currentRevenue: e.target.value,
                    })
                  }
                  placeholder="25000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-ctr">CTR (%)</Label>
                <Input
                  id="f-ctr"
                  type="number"
                  step="0.1"
                  value={forecastForm.currentCtr}
                  onChange={(e) =>
                    setForecastForm({
                      ...forecastForm,
                      currentCtr: e.target.value,
                    })
                  }
                  placeholder="3.5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-position">Gem. positie</Label>
                <Input
                  id="f-position"
                  type="number"
                  step="0.1"
                  value={forecastForm.currentAvgPosition}
                  onChange={(e) =>
                    setForecastForm({
                      ...forecastForm,
                      currentAvgPosition: e.target.value,
                    })
                  }
                  placeholder="8.5"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="f-content">Content-output (artikelen/maand)</Label>
              <Input
                id="f-content"
                type="number"
                value={forecastForm.contentOutput}
                onChange={(e) =>
                  setForecastForm({
                    ...forecastForm,
                    contentOutput: e.target.value,
                  })
                }
                placeholder="8"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForecastOpen(false)}>
              Annuleren
            </Button>
            <Button
              onClick={handleGenerateForecast}
              disabled={isGenerating || !forecastForm.currentTraffic}
            >
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <TrendingUp className="mr-2 h-4 w-4" />
              )}
              Genereren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Budget Dialog */}
      <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBudgetId ? "Budget bewerken" : "Nieuw budget"}
            </DialogTitle>
            <DialogDescription>
              {editingBudgetId
                ? "Pas de budgetverdeling aan."
                : "Maak een nieuwe budgetplanning aan. De percentages moeten optellen tot 100%."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="b-name">Naam</Label>
              <Input
                id="b-name"
                value={budgetForm.name}
                onChange={(e) =>
                  setBudgetForm({ ...budgetForm, name: e.target.value })
                }
                placeholder="Bijv. Q1 2025 SEO-budget"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-total">Totaal budget per maand (€)</Label>
              <Input
                id="b-total"
                type="number"
                value={budgetForm.totalBudget}
                onChange={(e) =>
                  setBudgetForm({ ...budgetForm, totalBudget: e.target.value })
                }
                placeholder="5000"
              />
            </div>

            <Separator />
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Verdeling</p>
                <span
                  className={`text-sm font-bold ${
                    isAllocationValid
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {allocationSum}%
                </span>
              </div>
              {!isAllocationValid && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  De percentages moeten optellen tot 100%. Huidig totaal:{" "}
                  {allocationSum}%
                </p>
              )}
            </div>

            <div className="space-y-4">
              {Object.entries(BUDGET_CATEGORIES).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-sm ${
                          BUDGET_COLORS[key] || "bg-gray-400"
                        }`}
                      />
                      {label}
                    </span>
                    <span className="text-sm font-medium w-12 text-right">
                      {allocations[key] || 0}%
                    </span>
                  </div>
                  <Slider
                    value={[allocations[key] || 0]}
                    min={0}
                    max={50}
                    step={1}
                    onValueChange={([val]) =>
                      setAllocations({ ...allocations, [key]: val })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetOpen(false)}>
              Annuleren
            </Button>
            <Button
              onClick={handleSaveBudget}
              disabled={
                isSaving ||
                !budgetForm.name.trim() ||
                !budgetForm.totalBudget ||
                !isAllocationValid
              }
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingBudgetId ? "Opslaan" : "Aanmaken"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
