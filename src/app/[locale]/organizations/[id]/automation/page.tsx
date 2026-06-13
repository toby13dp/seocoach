"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Zap,
  AlertTriangle,
  Play,
  Pause,
  Pencil,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCw,
  ChevronDown,
  ChevronUp,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AutomationTriggerType =
  | "NEW_TECHNICAL_ISSUE"
  | "METRIC_DROP"
  | "NEW_CONTENT_OPPORTUNITY"
  | "CONTENT_DECAY"
  | "NEW_COMPETITOR_PAGE"
  | "NEW_NEGATIVE_REVIEW"
  | "SCHEDULED_DATE"
  | "NEW_AI_VISIBILITY_RESULT"
  | "NEW_WORDPRESS_DRAFT"
  | "PRODUCT_FEED_ERROR"
  | "DEPLOYMENT_EVENT";

type AutomationActionType =
  | "CREATE_TASK"
  | "CREATE_ALERT"
  | "GENERATE_BRIEF"
  | "GENERATE_CONTENT_DRAFT"
  | "GENERATE_REPORT"
  | "NOTIFY_USER"
  | "PREPARE_CMS_UPDATE"
  | "RUN_CRAWL"
  | "RUN_QUALITY_CHECK"
  | "CREATE_APPROVAL_REQUEST"
  | "CALL_WEBHOOK";

type AutomationRuleStatus = "ACTIVE" | "PAUSED" | "DRAFT" | "DISABLED";

interface AutomationCondition {
  field: string;
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "not_contains";
  value: string;
}

interface AutomationAction {
  type: AutomationActionType;
  config: Record<string, unknown>;
}

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  triggerType: AutomationTriggerType;
  conditions: AutomationCondition[] | null;
  actions: AutomationAction[];
  status: AutomationRuleStatus;
  isHighRisk: boolean;
  requiresApproval: boolean;
  lastTriggeredAt: string | null;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AutomationExecution {
  id: string;
  ruleId: string;
  triggerType: AutomationTriggerType;
  status: string;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const TRIGGER_LABELS: Record<AutomationTriggerType, string> = {
  NEW_TECHNICAL_ISSUE: "Nieuw technisch probleem",
  METRIC_DROP: "Metrische daling",
  NEW_CONTENT_OPPORTUNITY: "Nieuwe contentkans",
  CONTENT_DECAY: "Contentverval",
  NEW_COMPETITOR_PAGE: "Nieuwe concurrentiepagina",
  NEW_NEGATIVE_REVIEW: "Nieuwe negatieve beoordeling",
  SCHEDULED_DATE: "Geplande datum",
  NEW_AI_VISIBILITY_RESULT: "Nieuw AI-zichtbaarheidsresultaat",
  NEW_WORDPRESS_DRAFT: "Nieuw WordPress-concept",
  PRODUCT_FEED_ERROR: "Productfeed-fout",
  DEPLOYMENT_EVENT: "Deployment-gebeurtenis",
};

const ACTION_LABELS: Record<AutomationActionType, string> = {
  CREATE_TASK: "Taak aanmaken",
  CREATE_ALERT: "Waarschuwing aanmaken",
  GENERATE_BRIEF: "Brief genereren",
  GENERATE_CONTENT_DRAFT: "Contentconcept genereren",
  GENERATE_REPORT: "Rapport genereren",
  NOTIFY_USER: "Gebruiker informeren",
  PREPARE_CMS_UPDATE: "CMS-update voorbereiden",
  RUN_CRAWL: "Crawl uitvoeren",
  RUN_QUALITY_CHECK: "Kwaliteitscontrole uitvoeren",
  CREATE_APPROVAL_REQUEST: "Goedkeuringsverzoek aanmaken",
  CALL_WEBHOOK: "Webhook aanroepen",
};

const STATUS_LABELS: Record<AutomationRuleStatus, string> = {
  ACTIVE: "Actief",
  PAUSED: "Gepauzeerd",
  DRAFT: "Concept",
  DISABLED: "Uitgeschakeld",
};

const STATUS_BADGE_CONFIG: Record<AutomationRuleStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  PAUSED: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  DISABLED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const HIGH_RISK_ACTIONS: AutomationActionType[] = [
  "GENERATE_CONTENT_DRAFT",
  "PREPARE_CMS_UPDATE",
  "RUN_CRAWL",
  "CALL_WEBHOOK",
];

const OPERATOR_LABELS: Record<string, string> = {
  equals: "Gelijk aan",
  not_equals: "Niet gelijk aan",
  greater_than: "Groter dan",
  less_than: "Kleiner dan",
  contains: "Bevat",
  not_contains: "Bevat niet",
};

const EXECUTION_STATUS_LABELS: Record<string, string> = {
  running: "Bezig",
  completed: "Voltooid",
  failed: "Mislukt",
  awaiting_approval: "Wacht op goedkeuring",
};

const EXECUTION_STATUS_CONFIG: Record<string, string> = {
  running: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  awaiting_approval: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

const ALL_TRIGGER_TYPES: AutomationTriggerType[] = [
  "NEW_TECHNICAL_ISSUE",
  "METRIC_DROP",
  "NEW_CONTENT_OPPORTUNITY",
  "CONTENT_DECAY",
  "NEW_COMPETITOR_PAGE",
  "NEW_NEGATIVE_REVIEW",
  "SCHEDULED_DATE",
  "NEW_AI_VISIBILITY_RESULT",
  "NEW_WORDPRESS_DRAFT",
  "PRODUCT_FEED_ERROR",
  "DEPLOYMENT_EVENT",
];

const ALL_ACTION_TYPES: AutomationActionType[] = [
  "CREATE_TASK",
  "CREATE_ALERT",
  "GENERATE_BRIEF",
  "GENERATE_CONTENT_DRAFT",
  "GENERATE_REPORT",
  "NOTIFY_USER",
  "PREPARE_CMS_UPDATE",
  "RUN_CRAWL",
  "RUN_QUALITY_CHECK",
  "CREATE_APPROVAL_REQUEST",
  "CALL_WEBHOOK",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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

export default function AutomationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: organizationId } = use(params);
  const router = useRouter();

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editRuleId, setEditRuleId] = useState<string | null>(null);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showExecutions, setShowExecutions] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formTriggerType, setFormTriggerType] = useState<AutomationTriggerType>("NEW_TECHNICAL_ISSUE");
  const [formConditions, setFormConditions] = useState<AutomationCondition[]>([]);
  const [formActions, setFormActions] = useState<AutomationAction[]>([
    { type: "CREATE_TASK", config: {} },
  ]);

  useEffect(() => {
    fetchData();
  }, [organizationId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [rulesRes, execRes] = await Promise.all([
        fetch(`/api/organizations/${organizationId}/automation-rules`),
        fetch(`/api/organizations/${organizationId}/automation-rules/executions`),
      ]);
      if (rulesRes.ok) {
        const data = await rulesRes.json();
        setRules(data.rules || []);
      }
      if (execRes.ok) {
        const data = await execRes.json();
        setExecutions(data.executions || []);
      }
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditRuleId(null);
    setFormName("");
    setFormTriggerType("NEW_TECHNICAL_ISSUE");
    setFormConditions([]);
    setFormActions([{ type: "CREATE_TASK", config: {} }]);
    setCreateDialogOpen(true);
  };

  const openEditDialog = (rule: AutomationRule) => {
    setEditRuleId(rule.id);
    setFormName(rule.name);
    setFormTriggerType(rule.triggerType);
    setFormConditions(rule.conditions || []);
    setFormActions(rule.actions);
    setCreateDialogOpen(true);
  };

  const saveRule = async () => {
    if (!formName.trim()) {
      toast.error("Vul een naam in");
      return;
    }
    if (formActions.length === 0) {
      toast.error("Voeg minimaal één actie toe");
      return;
    }

    const isHighRisk = formActions.some((a) => HIGH_RISK_ACTIONS.includes(a.type));
    setIsSaving(true);

    try {
      const url = editRuleId
        ? `/api/organizations/${organizationId}/automation-rules/${editRuleId}`
        : `/api/organizations/${organizationId}/automation-rules`;
      const method = editRuleId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          triggerType: formTriggerType,
          conditions: formConditions.length > 0 ? formConditions : undefined,
          actions: formActions,
          isHighRisk,
        }),
      });

      if (res.ok) {
        toast.success(editRuleId ? "Regel bijgewerkt" : "Regel aangemaakt");
        setCreateDialogOpen(false);
        fetchData();
      } else {
        toast.error("Opslaan mislukt");
      }
    } catch {
      toast.error("Fout bij opslaan");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      const res = await fetch(`/api/organizations/${organizationId}/automation-rules/${ruleId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Regel verwijderd");
        fetchData();
      } else {
        toast.error("Verwijderen mislukt");
      }
    } catch {
      toast.error("Fout bij verwijderen");
    }
    setDeleteRuleId(null);
  };

  const toggleRuleStatus = async (rule: AutomationRule) => {
    const newStatus: AutomationRuleStatus = rule.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const res = await fetch(`/api/organizations/${organizationId}/automation-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(newStatus === "ACTIVE" ? "Regel geactiveerd" : "Regel gepauzeerd");
        fetchData();
      } else {
        toast.error("Status wijzigen mislukt");
      }
    } catch {
      toast.error("Fout bij wijzigen status");
    }
  };

  // Condition builder helpers
  const addCondition = () => {
    setFormConditions((prev) => [
      ...prev,
      { field: "", operator: "equals", value: "" },
    ]);
  };

  const removeCondition = (index: number) => {
    setFormConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, key: keyof AutomationCondition, val: string) => {
    setFormConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [key]: val } : c))
    );
  };

  // Action builder helpers
  const addAction = () => {
    setFormActions((prev) => [...prev, { type: "CREATE_TASK", config: {} }]);
  };

  const removeAction = (index: number) => {
    setFormActions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateActionType = (index: number, type: AutomationActionType) => {
    setFormActions((prev) =>
      prev.map((a, i) => (i === index ? { ...a, type, config: {} } : a))
    );
  };

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return "-";
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

  const formatDuration = (ms: number | null) => {
    if (!ms) return "-";
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const ruleHasHighRisk = (rule: AutomationRule) => {
    return rule.isHighRisk || rule.actions.some((a) => HIGH_RISK_ACTIONS.includes(a.type));
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
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Automatiseringsregels</h1>
          <p className="text-sm text-muted-foreground">
            Beheer geautomatiseerde regels voor SEO-acties en meldingen
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nieuwe regel
        </Button>
      </motion.div>

      {/* Rules List */}
      <motion.div variants={item}>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Regels
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="h-16 animate-pulse bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : rules.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Zap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium mb-2">Geen automatiseringsregels</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Maak je eerste regel om SEO-taken te automatiseren.
                </p>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nieuwe regel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <Card
                key={rule.id}
                className={`hover:shadow-md transition-shadow ${
                  ruleHasHighRisk(rule) ? "border-l-4 border-l-amber-400" : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-sm">{rule.name}</h3>
                        <Badge className={`text-[10px] h-5 ${STATUS_BADGE_CONFIG[rule.status]}`}>
                          {STATUS_LABELS[rule.status]}
                        </Badge>
                        {ruleHasHighRisk(rule) && (
                          <Badge variant="outline" className="text-[10px] h-5 text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Hoog risico
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          {TRIGGER_LABELS[rule.triggerType]}
                        </span>
                        <span>{rule.actions.length} actie{rule.actions.length !== 1 ? "s" : ""}</span>
                        <span className="flex items-center gap-1">
                          <RotateCw className="h-3 w-3" />
                          {rule.triggerCount} keer uitgevoerd
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(rule.lastTriggeredAt)}
                        </span>
                      </div>
                      {/* Actions preview */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {rule.actions.map((action, idx) => (
                          <Badge key={idx} variant="secondary" className="text-[10px] h-5">
                            {ACTION_LABELS[action.type]}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {(rule.status === "ACTIVE" || rule.status === "PAUSED") && (
                        <div className="flex items-center gap-2 mr-2">
                          <Switch
                            checked={rule.status === "ACTIVE"}
                            onCheckedChange={() => toggleRuleStatus(rule)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {rule.status === "ACTIVE" ? "Actief" : "Gepauzeerd"}
                          </span>
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Bewerken"
                        onClick={() => openEditDialog(rule)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        title="Verwijderen"
                        onClick={() => setDeleteRuleId(rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>

      {/* Execution History */}
      <motion.div variants={item}>
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setShowExecutions(!showExecutions)}
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Uitvoeringsgeschiedenis
          </h2>
          <Button variant="ghost" size="sm">
            {showExecutions ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        {showExecutions && (
          <Card className="mt-3">
            <CardContent className="p-0">
              {executions.length === 0 ? (
                <div className="py-8 text-center">
                  <Clock className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nog geen uitvoeringen
                  </p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trigger</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duur</TableHead>
                        <TableHead>Gestart</TableHead>
                        <TableHead>Fout</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {executions.map((exec) => (
                        <TableRow key={exec.id}>
                          <TableCell className="text-sm">
                            {TRIGGER_LABELS[exec.triggerType] || exec.triggerType}
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-[10px] h-5 ${EXECUTION_STATUS_CONFIG[exec.status] || ""}`}>
                              {EXECUTION_STATUS_LABELS[exec.status] || exec.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDuration(exec.durationMs)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatTimeAgo(exec.startedAt)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {exec.error ? (
                              <span className="text-red-600 dark:text-red-400 line-clamp-1">
                                {exec.error}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Create/Edit Rule Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editRuleId ? "Regel bewerken" : "Nieuwe regel aanmaken"}
            </DialogTitle>
            <DialogDescription>
              Definieer een automatiseringsregel met trigger, voorwaarden en acties.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label>Naam</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="bijv. Waarschuwing bij technisch probleem"
              />
            </div>

            {/* Trigger Type */}
            <div className="space-y-2">
              <Label>Triggertype</Label>
              <Select
                value={formTriggerType}
                onValueChange={(val) => setFormTriggerType(val as AutomationTriggerType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_TRIGGER_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {TRIGGER_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conditions Builder */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Voorwaarden</Label>
                <Button variant="ghost" size="sm" onClick={addCondition}>
                  <Plus className="h-3 w-3 mr-1" />
                  Voorwaarde toevoegen
                </Button>
              </div>
              {formConditions.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  Geen voorwaarden toegevoegd. De regel triggert bij elk voorval van het type.
                </p>
              ) : (
                <div className="space-y-2">
                  {formConditions.map((cond, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        placeholder="Veld"
                        value={cond.field}
                        onChange={(e) => updateCondition(idx, "field", e.target.value)}
                        className="flex-1"
                      />
                      <Select
                        value={cond.operator}
                        onValueChange={(val) => updateCondition(idx, "operator", val)}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(OPERATOR_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Waarde"
                        value={cond.value}
                        onChange={(e) => updateCondition(idx, "value", e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500"
                        onClick={() => removeCondition(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions Builder */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Acties</Label>
                <Button variant="ghost" size="sm" onClick={addAction}>
                  <Plus className="h-3 w-3 mr-1" />
                  Actie toevoegen
                </Button>
              </div>
              {formActions.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  Voeg minimaal één actie toe.
                </p>
              ) : (
                <div className="space-y-2">
                  {formActions.map((action, idx) => {
                    const isHighRisk = HIGH_RISK_ACTIONS.includes(action.type);
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 p-2.5 rounded-md border ${
                          isHighRisk ? "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20" : ""
                        }`}
                      >
                        <Settings2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Select
                          value={action.type}
                          onValueChange={(val) => updateActionType(idx, val as AutomationActionType)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_ACTION_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                <div className="flex items-center gap-2">
                                  {ACTION_LABELS[type]}
                                  {HIGH_RISK_ACTIONS.includes(type) && (
                                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isHighRisk && (
                          <Badge variant="outline" className="text-[10px] h-5 text-amber-600 border-amber-300 shrink-0">
                            Hoog risico
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 shrink-0"
                          onClick={() => removeAction(idx)}
                          disabled={formActions.length <= 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* High risk warning */}
            {formActions.some((a) => HIGH_RISK_ACTIONS.includes(a.type)) && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    Hoogrisico-acties gedetecteerd
                  </p>
                  <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                    Deze regel bevat acties die als hoogrisico worden beschouwd. Goedkeuring kan vereist zijn voordat de acties worden uitgevoerd.
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={saveRule} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {editRuleId ? "Opslaan" : "Aanmaken"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Rule Confirmation */}
      <AlertDialog open={deleteRuleId !== null} onOpenChange={() => setDeleteRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regel verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze automatiseringsregel wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteRuleId && deleteRule(deleteRuleId)}
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
