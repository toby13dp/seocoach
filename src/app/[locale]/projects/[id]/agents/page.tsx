"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Play,
  Loader2,
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  ShieldCheck,
  Lightbulb,
  Wrench,
  FileText,
  PenTool,
  CheckSquare,
  Link2,
  MapPin,
  ShoppingCart,
  Brain,
  Users,
  BarChart3,
  FileUp,
  ArrowRightLeft,
  Shield,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentType =
  | "STRATEGY"
  | "TECHNICAL_SEO"
  | "CONTENT_RESEARCH"
  | "CONTENT_WRITER"
  | "CONTENT_QUALITY"
  | "INTERNAL_LINKING"
  | "LOCAL_SEO"
  | "ECOMMERCE"
  | "GEO"
  | "COMPETITOR"
  | "CRO"
  | "REPORTING"
  | "PUBLISHING"
  | "MIGRATION"
  | "QUALITY_ASSURANCE";

type AgentRunStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "AWAITING_APPROVAL";

interface AgentRun {
  id: string;
  agentType: AgentType;
  objective: string;
  model: string;
  status: AgentRunStatus;
  maxSteps: number;
  currentStep: number;
  costEur: number;
  confidence: number | null;
  durationMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Agent config
// ---------------------------------------------------------------------------

const AGENT_CONFIG: Record<AgentType, { label: string; description: string; icon: typeof Bot; color: string }> = {
  STRATEGY: { label: "Strategie-agent", description: "Analyseert en beveelt SEO-strategie aan", icon: Lightbulb, color: "text-purple-600 dark:text-purple-400" },
  TECHNICAL_SEO: { label: "Technische SEO-agent", description: "Identificeert en lost technische SEO-problemen op", icon: Wrench, color: "text-orange-600 dark:text-orange-400" },
  CONTENT_RESEARCH: { label: "Contentonderzoek-agent", description: "Onderzoekt keywords, topics en concurrentie", icon: Bot, color: "text-blue-600 dark:text-blue-400" },
  CONTENT_WRITER: { label: "Contentwriter-agent", description: "Genereert en optimaliseert content", icon: PenTool, color: "text-emerald-600 dark:text-emerald-400" },
  CONTENT_QUALITY: { label: "Contentkwaliteit-agent", description: "Controleert kwaliteit en bronvermelding", icon: CheckSquare, color: "text-teal-600 dark:text-teal-400" },
  INTERNAL_LINKING: { label: "Interne linking-agent", description: "Stelt interne links voor en keurt goed", icon: Link2, color: "text-cyan-600 dark:text-cyan-400" },
  LOCAL_SEO: { label: "Lokale SEO-agent", description: "Beheert lokale SEO en Google Bedrijfsprofiel", icon: MapPin, color: "text-rose-600 dark:text-rose-400" },
  ECOMMERCE: { label: "E-commerce-agent", description: "Analyseert producten, feeds en categorieën", icon: ShoppingCart, color: "text-amber-600 dark:text-amber-400" },
  GEO: { label: "GEO-agent", description: "Monitort AI-zichtbaarheid en generatieve resultaten", icon: Brain, color: "text-violet-600 dark:text-violet-400" },
  COMPETITOR: { label: "Concurrentie-agent", description: "Volgt en analyseert concurrenten", icon: Users, color: "text-red-600 dark:text-red-400" },
  CRO: { label: "CRO-agent", description: "Analyseert conversie-optimalisatie", icon: BarChart3, color: "text-indigo-600 dark:text-indigo-400" },
  REPORTING: { label: "Rapportage-agent", description: "Genereert rapporten en samenvattingen", icon: FileText, color: "text-sky-600 dark:text-sky-400" },
  PUBLISHING: { label: "Publicatie-agent", description: "Beheert content-publicatie en CMS", icon: FileUp, color: "text-lime-600 dark:text-lime-400" },
  MIGRATION: { label: "Migratie-agent", description: "Begeleidt URL-migraties en redirects", icon: ArrowRightLeft, color: "text-fuchsia-600 dark:text-fuchsia-400" },
  QUALITY_ASSURANCE: { label: "Kwaliteitsborging-agent", description: "Valideert datakwaliteit en vlagt problemen", icon: Shield, color: "text-slate-600 dark:text-slate-400" },
};

const STATUS_LABELS: Record<AgentRunStatus, string> = {
  PENDING: "In afwachting",
  RUNNING: "Bezig",
  COMPLETED: "Voltooid",
  FAILED: "Mislukt",
  CANCELLED: "Geannuleerd",
  AWAITING_APPROVAL: "Wacht op goedkeuring",
};

const STATUS_CONFIG: Record<AgentRunStatus, { color: string; bgColor: string; icon: typeof CheckCircle2 }> = {
  PENDING: { color: "text-yellow-600 dark:text-yellow-400", bgColor: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300", icon: Clock },
  RUNNING: { color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", icon: Loader2 },
  COMPLETED: { color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", icon: CheckCircle2 },
  FAILED: { color: "text-red-600 dark:text-red-400", bgColor: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", icon: XCircle },
  CANCELLED: { color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: Ban },
  AWAITING_APPROVAL: { color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", icon: ShieldCheck },
};

const MODEL_OPTIONS = [
  { value: "gpt-4", label: "GPT-4" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  { value: "claude-3-opus", label: "Claude 3 Opus" },
  { value: "claude-3-sonnet", label: "Claude 3 Sonnet" },
];

const ALL_AGENT_TYPES: AgentType[] = [
  "STRATEGY", "TECHNICAL_SEO", "CONTENT_RESEARCH", "CONTENT_WRITER",
  "CONTENT_QUALITY", "INTERNAL_LINKING", "LOCAL_SEO", "ECOMMERCE",
  "GEO", "COMPETITOR", "CRO", "REPORTING", "PUBLISHING",
  "MIGRATION", "QUALITY_ASSURANCE",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function AgentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [detailsDialogId, setDetailsDialogId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [selectedAgentType, setSelectedAgentType] = useState<AgentType>("STRATEGY");
  const [objective, setObjective] = useState("");
  const [model, setModel] = useState("gpt-4");
  const [maxSteps, setMaxSteps] = useState("10");

  useEffect(() => {
    fetchAgentRuns();
  }, [projectId]);

  const fetchAgentRuns = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/agent-runs`);
      if (res.ok) {
        const data = await res.json();
        setAgentRuns(data.runs || []);
      }
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  };

  const createAgentRun = async () => {
    if (!objective.trim()) {
      toast.error("Vul een doelstelling in");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/agent-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentType: selectedAgentType,
          objective: objective.trim(),
          model,
          maxSteps: parseInt(maxSteps, 10),
        }),
      });

      if (res.ok) {
        toast.success("Agent-run gestart");
        setStartDialogOpen(false);
        setObjective("");
        fetchAgentRuns();
      } else {
        toast.error("Agent-run starten mislukt");
      }
    } catch {
      toast.error("Fout bij starten agent-run");
    } finally {
      setIsCreating(false);
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "-";
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatCost = (cost: number) => {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(cost);
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Zojuist";
    if (diffMins < 60) return `${diffMins} min. geleden`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} uur geleden`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} dag${diffDays > 1 ? "en" : ""} geleden`;
  };

  // Separate active runs (PENDING/RUNNING/AWAITING_APPROVAL) from completed ones
  const activeRuns = agentRuns.filter((r) =>
    ["PENDING", "RUNNING", "AWAITING_APPROVAL"].includes(r.status)
  );
  const recentRuns = agentRuns.filter((r) =>
    ["COMPLETED", "FAILED", "CANCELLED"].includes(r.status)
  );

  // Count runs per agent type
  const runCountByType: Record<string, number> = {};
  const lastStatusByType: Record<string, AgentRunStatus> = {};
  agentRuns.forEach((run) => {
    runCountByType[run.agentType] = (runCountByType[run.agentType] || 0) + 1;
    if (!lastStatusByType[run.agentType]) {
      lastStatusByType[run.agentType] = run.status;
    }
  });

  const selectedRun = agentRuns.find((r) => r.id === detailsDialogId);

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
          <h1 className="text-2xl font-bold tracking-tight">Agentbeheer</h1>
          <p className="text-sm text-muted-foreground">
            Beheer en start AI-agents voor geautomatiseerde SEO-taken
          </p>
        </div>
        <Button onClick={() => setStartDialogOpen(true)}>
          <Play className="h-4 w-4 mr-2" />
          Starten
        </Button>
      </motion.div>

      {/* Active Runs */}
      {activeRuns.length > 0 && (
        <motion.div variants={item}>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Actieve runs
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeRuns.map((run) => {
              const config = AGENT_CONFIG[run.agentType];
              const statusConf = STATUS_CONFIG[run.status];
              const Icon = config.icon;
              const progressPercent = run.maxSteps > 0
                ? Math.round((run.currentStep / run.maxSteps) * 100)
                : 0;

              return (
                <Card key={run.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${config.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{config.label}</p>
                          <Badge className={`text-[10px] h-5 ${statusConf.bgColor}`}>
                            {STATUS_LABELS[run.status]}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {run.objective}
                        </p>
                        {run.status === "RUNNING" && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>Stap {run.currentStep}/{run.maxSteps}</span>
                              <span>{progressPercent}%</span>
                            </div>
                            <Progress value={progressPercent} className="h-1.5" />
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{formatCost(run.costEur)}</span>
                          <span>{formatTimeAgo(run.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Agent Cards Grid */}
      <motion.div variants={item}>
        <h2 className="text-lg font-semibold mb-3">Beschikbare agents</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {ALL_AGENT_TYPES.map((agentType) => {
            const config = AGENT_CONFIG[agentType];
            const Icon = config.icon;
            const lastStatus = lastStatusByType[agentType];
            const runCount = runCountByType[agentType] || 0;

            return (
              <Card
                key={agentType}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedAgentType(agentType);
                  setStartDialogOpen(true);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{config.label}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {config.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {runCount} run{runCount !== 1 ? "s" : ""}
                    </span>
                    {lastStatus && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-5 ${STATUS_CONFIG[lastStatus]?.color || ""}`}
                      >
                        {STATUS_LABELS[lastStatus]}
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto">
                      <Play className="h-3 w-3 mr-1" />
                      Starten
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </motion.div>

      {/* Recent Runs Table */}
      <motion.div variants={item}>
        <h2 className="text-lg font-semibold mb-3">Recente runs</h2>
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse bg-muted rounded" />
                ))}
              </div>
            ) : recentRuns.length === 0 ? (
              <div className="py-12 text-center">
                <Bot className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium mb-2">Geen recente runs</h3>
                <p className="text-sm text-muted-foreground">
                  Start een agent om hier resultaten te zien.
                </p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Doelstelling</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duur</TableHead>
                      <TableHead>Kosten</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentRuns.map((run) => {
                      const config = AGENT_CONFIG[run.agentType];
                      const statusConf = STATUS_CONFIG[run.status];
                      const Icon = config.icon;

                      return (
                        <TableRow
                          key={run.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setDetailsDialogId(run.id)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${config.color}`} />
                              <span className="text-sm font-medium">{config.label}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-muted-foreground line-clamp-1 max-w-[200px]">
                              {run.objective}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-[10px] h-5 ${statusConf.bgColor}`}>
                              {STATUS_LABELS[run.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDuration(run.durationMs)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatCost(run.costEur)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Start Agent Run Dialog */}
      <Dialog open={startDialogOpen} onOpenChange={setStartDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nieuwe agent-run starten</DialogTitle>
            <DialogDescription>
              Configureer en start een AI-agent om een geautomatiseerde SEO-taak uit te voeren.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Agenttype</Label>
              <Select
                value={selectedAgentType}
                onValueChange={(val) => setSelectedAgentType(val as AgentType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_AGENT_TYPES.map((type) => {
                    const config = AGENT_CONFIG[type];
                    const Icon = config.icon;
                    return (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${config.color}`} />
                          {config.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {selectedAgentType && (
                <p className="text-xs text-muted-foreground">
                  {AGENT_CONFIG[selectedAgentType].description}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Doelstelling</Label>
              <Textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Beschrijf wat de agent moet bereiken..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Max. stappen</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={maxSteps}
                  onChange={(e) => setMaxSteps(e.target.value)}
                />
              </div>
            </div>

            {AGENT_CONFIG[selectedAgentType] && (
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Over dit agenttype</p>
                <p>{AGENT_CONFIG[selectedAgentType].description}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartDialogOpen(false)}>
              Annuleren
            </Button>
            <Button
              onClick={createAgentRun}
              disabled={isCreating || !objective.trim()}
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Starten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Details Dialog */}
      <Dialog open={detailsDialogId !== null} onOpenChange={() => setDetailsDialogId(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedRun && (() => {
            const config = AGENT_CONFIG[selectedRun.agentType];
            const statusConf = STATUS_CONFIG[selectedRun.status];
            const Icon = config.icon;
            const progressPercent = selectedRun.maxSteps > 0
              ? Math.round((selectedRun.currentStep / selectedRun.maxSteps) * 100)
              : 0;

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${config.color}`} />
                    {config.label}
                  </DialogTitle>
                  <DialogDescription>
                    Run details en resultaten
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground">Status</Label>
                      <Badge className={statusConf.bgColor}>{STATUS_LABELS[selectedRun.status]}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground">Model</Label>
                      <span className="text-sm">{selectedRun.model}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground">Voortgang</Label>
                      <span className="text-sm">{selectedRun.currentStep}/{selectedRun.maxSteps} stappen</span>
                    </div>
                    {selectedRun.status === "RUNNING" && (
                      <Progress value={progressPercent} className="h-2" />
                    )}
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground">Duur</Label>
                      <span className="text-sm">{formatDuration(selectedRun.durationMs)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground">Kosten</Label>
                      <span className="text-sm">{formatCost(selectedRun.costEur)}</span>
                    </div>
                    {selectedRun.confidence !== null && (
                      <div className="flex items-center justify-between">
                        <Label className="text-muted-foreground">Zekerheid</Label>
                        <span className="text-sm">{Math.round(selectedRun.confidence * 100)}%</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground">Doelstelling</Label>
                    <p className="text-sm bg-muted/50 p-3 rounded-md">{selectedRun.objective}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Aangemaakt: {new Date(selectedRun.createdAt).toLocaleString("nl-NL")}</span>
                    {selectedRun.startedAt && (
                      <span>Gestart: {new Date(selectedRun.startedAt).toLocaleString("nl-NL")}</span>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDetailsDialogId(null)}>
                    Sluiten
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
