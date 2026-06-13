"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import { useRouter } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Upload,
  Filter,
  BarChart3,
  AlertTriangle,
  AlertOctagon,
  MousePointerClick,
  ScrollText,
  FlaskConical,
  Target,
  TrendingUp,
  Eye,
  Search,
  FileUp,
} from "lucide-react";
import { toast } from "sonner";

// --- Types ---
interface BehaviourRecord {
  id: string;
  type: string;
  pageUrl: string;
  element: string | null;
  value: number | null;
  device: string | null;
  createdAt: string;
}

interface CROFinding {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string | null;
  recommendation: string | null;
  pageUrl: string | null;
  status: string;
  createdAt: string;
}

interface Experiment {
  id: string;
  name: string;
  status: string;
  kpiName: string | null;
  improvement: number | null;
  confidence: number | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

// --- Dutch Labels ---
const BEHAVIOUR_TYPE_LABELS: Record<string, string> = {
  SCROLL_DEPTH: "Scroll-diepte",
  CLICK: "Klik",
  RAGE_CLICK: "Woedeklik",
  DEAD_CLICK: "Dode klik",
  FORM_ABANDONMENT: "Formulier-afbreking",
  DEVICE_TYPE: "Apparaattype",
  ENGAGEMENT: "Betrokkenheid",
};

const CRO_CATEGORY_LABELS: Record<string, string> = {
  CTA: "Call-to-action",
  FORMS: "Formulieren",
  TRUST: "Vertrouwen",
  VALUE_PROPOSITION: "Waardepropositie",
  PRICING_COMMUNICATION: "Prijscommunicatie",
  MOBILE_UX: "Mobiele UX",
  FUNNELS: "Funnels",
  LANDING_PAGES: "Bestemmingspagina's",
  PRODUCT_PAGES: "Productpagina's",
};

const SEVERITY_LABELS: Record<string, string> = {
  CRITICAL: "Kritiek",
  HIGH: "Hoog",
  MEDIUM: "Gemiddeld",
  LOW: "Laag",
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  LOW: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
};

const EXPERIMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Concept",
  RUNNING: "Actief",
  COMPLETED: "Afgerond",
  CANCELLED: "Geannuleerd",
};

const EXPERIMENT_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  RUNNING: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  COMPLETED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export default function CROPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  // State
  const [behaviours, setBehaviours] = useState<BehaviourRecord[]>([]);
  const [findings, setFindings] = useState<CROFinding[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [behaviourFilter, setBehaviourFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  // Dialogs
  const [importOpen, setImportOpen] = useState(false);
  const [findingOpen, setFindingOpen] = useState(false);
  const [experimentOpen, setExperimentOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New finding form
  const [newFinding, setNewFinding] = useState({
    category: "CTA",
    severity: "MEDIUM",
    title: "",
    description: "",
    recommendation: "",
    pageUrl: "",
  });

  // New experiment form
  const [newExperiment, setNewExperiment] = useState({
    name: "",
    hypothesis: "",
    kpiName: "",
    baseline: "",
    target: "",
    controlGroupSize: "1000",
    testGroupSize: "1000",
  });

  // CSV import
  const [importFile, setImportFile] = useState<File | null>(null);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [behRes, findRes, expRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/behaviour`),
        fetch(`/api/projects/${projectId}/cro-findings`),
        fetch(`/api/projects/${projectId}/experiments`),
      ]);

      if (behRes.ok) {
        const behData = await behRes.json();
        setBehaviours(behData.records || behData.behaviours || []);
      }
      if (findRes.ok) {
        const findData = await findRes.json();
        setFindings(findData.findings || []);
      }
      if (expRes.ok) {
        const expData = await expRes.json();
        setExperiments(expData.experiments || []);
      }
    } catch {
      // Silently handle — data will show empty states
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Stats
  const totalBehaviours = behaviours.length;
  const openFindings = findings.filter(
    (f) => f.status === "OPEN" || f.status === "NEW"
  ).length;
  const criticalFindings = findings.filter(
    (f) => f.severity === "CRITICAL"
  ).length;
  const avgScrollDepth =
    behaviours.filter((b) => b.type === "SCROLL_DEPTH" && b.value !== null).length > 0
      ? Math.round(
          behaviours
            .filter((b) => b.type === "SCROLL_DEPTH" && b.value !== null)
            .reduce((sum, b) => sum + (b.value || 0), 0) /
            behaviours.filter((b) => b.type === "SCROLL_DEPTH" && b.value !== null).length
        )
      : 0;

  // Filtered data
  const filteredBehaviours =
    behaviourFilter === "all"
      ? behaviours
      : behaviours.filter((b) => b.type === behaviourFilter);

  const filteredFindings = findings.filter((f) => {
    if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
    if (severityFilter !== "all" && f.severity !== severityFilter) return false;
    return true;
  });

  // Handlers
  const handleImportCSV = async () => {
    if (!importFile) {
      toast.error("Selecteer een CSV-bestand");
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await fetch(`/api/projects/${projectId}/behaviour/import`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        toast.success("Gedragsgegevens geïmporteerd");
        setImportOpen(false);
        setImportFile(null);
        fetchData();
      } else {
        toast.error("Fout bij het importeren");
      }
    } catch {
      toast.error("Fout bij het importeren");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateFinding = async () => {
    if (!newFinding.title.trim()) {
      toast.error("Titel is vereist");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/cro-findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFinding),
      });
      if (res.ok) {
        toast.success("Bevinding toegevoegd");
        setFindingOpen(false);
        setNewFinding({
          category: "CTA",
          severity: "MEDIUM",
          title: "",
          description: "",
          recommendation: "",
          pageUrl: "",
        });
        fetchData();
      } else {
        toast.error("Fout bij het toevoegen");
      }
    } catch {
      toast.error("Fout bij het toevoegen");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateExperiment = async () => {
    if (!newExperiment.name.trim() || !newExperiment.hypothesis.trim()) {
      toast.error("Naam en hypothese zijn vereist");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/experiments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newExperiment.name,
          hypothesis: newExperiment.hypothesis,
          kpiName: newExperiment.kpiName,
          baseline: parseFloat(newExperiment.baseline) || 0,
          target: parseFloat(newExperiment.target) || 0,
          controlGroupSize: parseInt(newExperiment.controlGroupSize) || 1000,
          testGroupSize: parseInt(newExperiment.testGroupSize) || 1000,
        }),
      });
      if (res.ok) {
        toast.success("Experiment aangemaakt");
        setExperimentOpen(false);
        setNewExperiment({
          name: "",
          hypothesis: "",
          kpiName: "",
          baseline: "",
          target: "",
          controlGroupSize: "1000",
          testGroupSize: "1000",
        });
        fetchData();
      } else {
        toast.error("Fout bij het aanmaken");
      }
    } catch {
      toast.error("Fout bij het aanmaken");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/cro-findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze" }),
      });
      if (res.ok) {
        toast.success("CRO-analyse gestart");
        fetchData();
      } else {
        toast.error("Fout bij het starten van de analyse");
      }
    } catch {
      toast.error("Fout bij het starten van de analyse");
    } finally {
      setIsAnalyzing(false);
    }
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
          <h1 className="text-2xl font-bold tracking-tight">CRO & Gedrag</h1>
          <p className="text-sm text-muted-foreground">
            Conversie-optimalisatie en gedragsanalyse
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Stats Bar */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Gedragsrecords</span>
                  <Eye className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold">{totalBehaviours.toLocaleString("nl-NL")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Open bevindingen</span>
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                </div>
                <div className="text-2xl font-bold">{openFindings}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Kritieke bevindingen</span>
                  <AlertOctagon className="h-4 w-4 text-red-600" />
                </div>
                <div className="text-2xl font-bold">{criticalFindings}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Gem. scroll-diepte</span>
                  <ScrollText className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold">{avgScrollDepth}%</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="behaviour" className="space-y-4">
            <TabsList>
              <TabsTrigger value="behaviour">
                <MousePointerClick className="mr-1.5 h-4 w-4" />
                Gedragsgegevens
              </TabsTrigger>
              <TabsTrigger value="findings">
                <Search className="mr-1.5 h-4 w-4" />
                CRO-bevindingen
              </TabsTrigger>
              <TabsTrigger value="experiments">
                <FlaskConical className="mr-1.5 h-4 w-4" />
                Experimenten
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Gedragsgegevens */}
            <TabsContent value="behaviour" className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Select value={behaviourFilter} onValueChange={setBehaviourFilter}>
                    <SelectTrigger className="w-[200px]">
                      <Filter className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Filter op type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle types</SelectItem>
                      {Object.entries(BEHAVIOUR_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <FileUp className="mr-2 h-4 w-4" />
                  CSV importeren
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  {filteredBehaviours.length > 0 ? (
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Pagina</TableHead>
                            <TableHead>Element</TableHead>
                            <TableHead>Waarde</TableHead>
                            <TableHead>Apparaat</TableHead>
                            <TableHead>Datum</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredBehaviours.map((b) => (
                            <TableRow key={b.id}>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {BEHAVIOUR_TYPE_LABELS[b.type] || b.type}
                                </Badge>
                              </TableCell>
                              <TableCell
                                className="text-sm max-w-[200px] truncate"
                                title={b.pageUrl}
                              >
                                {b.pageUrl.replace(/^https?:\/\/[^/]+/, "") || "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {b.element || "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {b.value !== null ? `${b.value}%` : "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {b.device || "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDate(b.createdAt)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium mb-2">
                        Geen gedragsgegevens
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Importeer gedragsgegevens via CSV of koppel een
                        analyse-tool om te beginnen.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 2: CRO-bevindingen */}
            <TabsContent value="findings" className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Categorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle categorieën</SelectItem>
                      {Object.entries(CRO_CATEGORY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Ernst" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle ernst</SelectItem>
                      {Object.entries(SEVERITY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRunAnalysis}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <TrendingUp className="mr-2 h-4 w-4" />
                    )}
                    Analyseer
                  </Button>
                  <Button size="sm" onClick={() => setFindingOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nieuwe bevinding
                  </Button>
                </div>
              </div>

              {filteredFindings.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredFindings.map((f) => (
                    <Card key={f.id} className="flex flex-col">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {CRO_CATEGORY_LABELS[f.category] || f.category}
                          </Badge>
                          <Badge className={`text-xs ${SEVERITY_COLORS[f.severity] || ""}`}>
                            {SEVERITY_LABELS[f.severity] || f.severity}
                          </Badge>
                        </div>
                        <CardTitle className="text-base mt-2">{f.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 space-y-3">
                        {f.description && (
                          <p className="text-sm text-muted-foreground">
                            {f.description}
                          </p>
                        )}
                        {f.recommendation && (
                          <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-md p-3">
                            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300 mb-1">
                              Aanbeveling
                            </p>
                            <p className="text-sm text-emerald-700 dark:text-emerald-400">
                              {f.recommendation}
                            </p>
                          </div>
                        )}
                        {f.pageUrl && (
                          <p className="text-xs text-muted-foreground truncate" title={f.pageUrl}>
                            📄 {f.pageUrl.replace(/^https?:\/\/[^/]+/, "")}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium mb-2">
                        Geen CRO-bevindingen
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Voer een CRO-analyse uit of voeg handmatig bevindingen toe
                        om conversieproblemen te identificeren.
                      </p>
                      <Button className="mt-4" onClick={() => setFindingOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nieuwe bevinding
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Tab 3: Experimenten */}
            <TabsContent value="experiments" className="space-y-4">
              <div className="flex items-center justify-end">
                <Button size="sm" onClick={() => setExperimentOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nieuw experiment
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  {experiments.length > 0 ? (
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Naam</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>KPI</TableHead>
                            <TableHead>Verbetering</TableHead>
                            <TableHead>Betrouwbaarheid</TableHead>
                            <TableHead>Startdatum</TableHead>
                            <TableHead>Einddatum</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {experiments.map((exp) => (
                            <TableRow
                              key={exp.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() =>
                                router.push(
                                  `/projects/${projectId}/experiments/${exp.id}`
                                )
                              }
                            >
                              <TableCell className="font-medium text-sm">
                                {exp.name}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={`text-xs ${
                                    EXPERIMENT_STATUS_COLORS[exp.status] || ""
                                  }`}
                                >
                                  {EXPERIMENT_STATUS_LABELS[exp.status] || exp.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {exp.kpiName || "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {exp.improvement !== null ? (
                                  <span
                                    className={
                                      exp.improvement >= 0
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-red-600 dark:text-red-400"
                                    }
                                  >
                                    {exp.improvement >= 0 ? "+" : ""}
                                    {exp.improvement.toFixed(1)}%
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {exp.confidence !== null
                                  ? `${exp.confidence.toFixed(0)}%`
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {exp.startDate ? formatDate(exp.startDate) : "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {exp.endDate ? formatDate(exp.endDate) : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium mb-2">
                        Geen experimenten
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Maak een experiment om CRO-hypotheses te testen en meetbare
                        resultaten te verzamelen.
                      </p>
                      <Button className="mt-4" onClick={() => setExperimentOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nieuw experiment
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Import CSV Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gedragsgegevens importeren</DialogTitle>
            <DialogDescription>
              Upload een CSV-bestand met gedragsgegevens. Het bestand moet
              kolommen bevatten voor type, pageUrl, element, value en device.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file">CSV-bestand</Label>
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {importFile ? importFile.name : "Klik om een bestand te selecteren"}
                </p>
                <input
                  ref={fileInputRef}
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={handleImportCSV} disabled={isSubmitting || !importFile}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Importeren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Finding Dialog */}
      <Dialog open={findingOpen} onOpenChange={setFindingOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nieuwe CRO-bevinding</DialogTitle>
            <DialogDescription>
              Voeg een nieuwe conversie-bevinding toe met categorie en ernst.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="finding-title">Titel</Label>
              <Input
                id="finding-title"
                value={newFinding.title}
                onChange={(e) =>
                  setNewFinding({ ...newFinding, title: e.target.value })
                }
                placeholder="Bijv. CTA-knop onvindbaar op mobiel"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categorie</Label>
                <Select
                  value={newFinding.category}
                  onValueChange={(v) =>
                    setNewFinding({ ...newFinding, category: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CRO_CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ernst</Label>
                <Select
                  value={newFinding.severity}
                  onValueChange={(v) =>
                    setNewFinding({ ...newFinding, severity: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEVERITY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="finding-description">Beschrijving</Label>
              <Textarea
                id="finding-description"
                value={newFinding.description}
                onChange={(e) =>
                  setNewFinding({ ...newFinding, description: e.target.value })
                }
                placeholder="Beschrijf het probleem..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="finding-recommendation">Aanbeveling</Label>
              <Textarea
                id="finding-recommendation"
                value={newFinding.recommendation}
                onChange={(e) =>
                  setNewFinding({ ...newFinding, recommendation: e.target.value })
                }
                placeholder="Wat raad je aan om dit op te lossen?"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="finding-url">Pagina-URL</Label>
              <Input
                id="finding-url"
                value={newFinding.pageUrl}
                onChange={(e) =>
                  setNewFinding({ ...newFinding, pageUrl: e.target.value })
                }
                placeholder="https://voorbeeld.nl/pagina"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFindingOpen(false)}>
              Annuleren
            </Button>
            <Button
              onClick={handleCreateFinding}
              disabled={isSubmitting || !newFinding.title.trim()}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Toevoegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Experiment Dialog */}
      <Dialog open={experimentOpen} onOpenChange={setExperimentOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nieuw experiment</DialogTitle>
            <DialogDescription>
              Maak een A/B-test aan om een CRO-hypothese te valideren.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="exp-name">Naam</Label>
              <Input
                id="exp-name"
                value={newExperiment.name}
                onChange={(e) =>
                  setNewExperiment({ ...newExperiment, name: e.target.value })
                }
                placeholder="Bijv. CTA-kleur test"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-hypothesis">Hypothese</Label>
              <Textarea
                id="exp-hypothesis"
                value={newExperiment.hypothesis}
                onChange={(e) =>
                  setNewExperiment({ ...newExperiment, hypothesis: e.target.value })
                }
                placeholder="Als we X veranderen, dan verwachten we Y omdat..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-kpi">KPI-naam</Label>
              <Input
                id="exp-kpi"
                value={newExperiment.kpiName}
                onChange={(e) =>
                  setNewExperiment({ ...newExperiment, kpiName: e.target.value })
                }
                placeholder="Bijv. Conversiepercentage"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="exp-baseline">Baseline (%)</Label>
                <Input
                  id="exp-baseline"
                  type="number"
                  step="0.1"
                  value={newExperiment.baseline}
                  onChange={(e) =>
                    setNewExperiment({ ...newExperiment, baseline: e.target.value })
                  }
                  placeholder="3.5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-target">Doel (%)</Label>
                <Input
                  id="exp-target"
                  type="number"
                  step="0.1"
                  value={newExperiment.target}
                  onChange={(e) =>
                    setNewExperiment({ ...newExperiment, target: e.target.value })
                  }
                  placeholder="4.5"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="exp-control">Controlegroep</Label>
                <Input
                  id="exp-control"
                  type="number"
                  value={newExperiment.controlGroupSize}
                  onChange={(e) =>
                    setNewExperiment({
                      ...newExperiment,
                      controlGroupSize: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-test">Testgroep</Label>
                <Input
                  id="exp-test"
                  type="number"
                  value={newExperiment.testGroupSize}
                  onChange={(e) =>
                    setNewExperiment({
                      ...newExperiment,
                      testGroupSize: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExperimentOpen(false)}>
              Annuleren
            </Button>
            <Button
              onClick={handleCreateExperiment}
              disabled={
                isSubmitting ||
                !newExperiment.name.trim() ||
                !newExperiment.hypothesis.trim()
              }
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aanmaken
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
