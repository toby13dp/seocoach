"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import {
  Card,
  CardContent,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Loader2,
  GitBranch,
  Shield,
  Unlock,
  Rocket,
  Server,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

// --- Types ---
type DeploymentProvider = "GITHUB" | "GITLAB" | "GENERIC_CICD";
type DeploymentCheckType =
  | "ROBOTS_TXT"
  | "CANONICALS"
  | "TITLES"
  | "META_ROBOTS"
  | "SITEMAPS"
  | "STATUS_CODES"
  | "STRUCTURED_DATA"
  | "INTERNAL_LINKS"
  | "RENDERING"
  | "PERFORMANCE"
  | "CRITICAL_URLS";
type DeploymentCheckStatus = "PASSING" | "FAILING" | "WARNING" | "NOT_CHECKED";

interface DeploymentCheck {
  id: string;
  checkType: DeploymentCheckType;
  status: DeploymentCheckStatus;
  beforeValue: string | null;
  afterValue: string | null;
  diff: string | null;
  finding: string | null;
  severity: string;
  checkedAt: string | null;
}

interface DeploymentRecord {
  id: string;
  provider: DeploymentProvider;
  commitSha: string | null;
  branch: string | null;
  environment: string | null;
  deployedAt: string;
  regressionFound: boolean;
  severity: string;
  suggestedRollback: boolean;
  isBlocking: boolean;
  blockingEnabled: boolean;
  checks: DeploymentCheck[];
}

const PROVIDER_LABELS: Record<DeploymentProvider, string> = {
  GITHUB: "GitHub",
  GITLAB: "GitLab",
  GENERIC_CICD: "Algemene CI/CD",
};

const SEVERITY_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  none: { label: "Geen", color: "text-green-700 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/40 border-green-200 dark:border-green-800" },
  low: { label: "Laag", color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800" },
  medium: { label: "Gemiddeld", color: "text-yellow-700 dark:text-yellow-400", bgColor: "bg-yellow-100 dark:bg-yellow-900/40 border-yellow-200 dark:border-yellow-800" },
  high: { label: "Hoog", color: "text-orange-700 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-900/40 border-orange-200 dark:border-orange-800" },
  critical: { label: "Kritiek", color: "text-red-700 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/40 border-red-200 dark:border-red-800" },
};

const CHECK_STATUS_CONFIG: Record<
  DeploymentCheckStatus,
  { label: string; color: string; bgColor: string; icon: typeof CheckCircle2 }
> = {
  PASSING: { label: "Passing", color: "text-green-700 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/40 border-green-200 dark:border-green-800", icon: CheckCircle2 },
  FAILING: { label: "Failing", color: "text-red-700 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/40 border-red-200 dark:border-red-800", icon: XCircle },
  WARNING: { label: "Warning", color: "text-yellow-700 dark:text-yellow-400", bgColor: "bg-yellow-100 dark:bg-yellow-900/40 border-yellow-200 dark:border-yellow-800", icon: AlertTriangle },
  NOT_CHECKED: { label: "Not checked", color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700", icon: AlertCircle },
};

const CHECK_TYPE_LABELS: Record<DeploymentCheckType, string> = {
  ROBOTS_TXT: "robots.txt",
  CANONICALS: "Canonicals",
  TITLES: "Titels",
  META_ROBOTS: "Meta robots",
  SITEMAPS: "Sitemaps",
  STATUS_CODES: "Statuscodes",
  STRUCTURED_DATA: "Gestructureerde data",
  INTERNAL_LINKS: "Interne links",
  RENDERING: "Rendering",
  PERFORMANCE: "Prestaties",
  CRITICAL_URLS: "Kritieke URL's",
};

export default function DeploymentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New deployment dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formProvider, setFormProvider] = useState<DeploymentProvider>("GITHUB");
  const [formCommitSha, setFormCommitSha] = useState("");
  const [formBranch, setFormBranch] = useState("");
  const [formEnvironment, setFormEnvironment] = useState("production");
  const [formBlocking, setFormBlocking] = useState(false);

  // Unblock dialog
  const [unblockDialogId, setUnblockDialogId] = useState<string | null>(null);
  const [unblockReason, setUnblockReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchDeployments();
  }, [projectId]);

  const fetchDeployments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/deployments`);
      if (res.ok) {
        const data = await res.json();
        setDeployments(data.deployments || []);
      }
    } catch {
      // Silently handle
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDeployment = async () => {
    setIsCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/deployments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: formProvider,
          commitSha: formCommitSha || undefined,
          branch: formBranch || undefined,
          environment: formEnvironment,
          blockingEnabled: formBlocking,
        }),
      });
      if (res.ok) {
        toast.success("Deployment geregistreerd");
        setDialogOpen(false);
        setFormProvider("GITHUB");
        setFormCommitSha("");
        setFormBranch("");
        setFormEnvironment("production");
        setFormBlocking(false);
        fetchDeployments();
      } else {
        const data = await res.json();
        toast.error(data.error || "Kon deployment niet registreren");
      }
    } catch {
      toast.error("Fout bij registreren deployment");
    } finally {
      setIsCreating(false);
    }
  };

  const handleUnblock = async () => {
    if (!unblockDialogId) return;
    setActionLoading(unblockDialogId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/deployments/${unblockDialogId}/unblock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: unblockReason }),
        }
      );
      if (res.ok) {
        toast.success("Deployment ontblokkeerd");
        setUnblockDialogId(null);
        setUnblockReason("");
        fetchDeployments();
      } else {
        toast.error("Ontblokkeren mislukt");
      }
    } catch {
      toast.error("Fout bij ontblokkeren");
    } finally {
      setActionLoading(null);
    }
  };

  const formatShortSha = (sha: string | null) => {
    if (!sha) return "—";
    return sha.length > 7 ? sha.substring(0, 7) : sha;
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
          <h1 className="text-2xl font-bold tracking-tight">Deployments</h1>
          <p className="text-sm text-muted-foreground">
            Monitor deployments en detecteer SEO-regressies
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nieuwe deployment
        </Button>
      </div>

      {/* Deployments Table */}
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
      ) : deployments.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Server className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Geen deployments gevonden</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Registreer je eerste deployment om SEO-regressiecontroles te starten.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nieuwe deployment
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {deployments.map((deployment, index) => {
            const severityConfig = SEVERITY_CONFIG[deployment.severity] || SEVERITY_CONFIG.none;
            const isExpanded = expandedId === deployment.id;
            const checks = deployment.checks || [];
            const passingCount = checks.filter((c) => c.status === "PASSING").length;
            const failingCount = checks.filter((c) => c.status === "FAILING").length;

            return (
              <motion.div
                key={deployment.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card className={deployment.isBlocking ? "border-red-200 dark:border-red-800" : ""}>
                  <Collapsible
                    open={isExpanded}
                    onOpenChange={() => setExpandedId(isExpanded ? null : deployment.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <CardContent className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4 flex-wrap">
                          {/* Expand/collapse icon */}
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}

                          {/* Date */}
                          <span className="text-sm text-muted-foreground w-[120px] shrink-0">
                            {new Date(deployment.deployedAt).toLocaleDateString("nl-NL", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>

                          {/* Provider */}
                          <Badge variant="outline" className="text-xs h-6 shrink-0">
                            {PROVIDER_LABELS[deployment.provider]}
                          </Badge>

                          {/* Commit */}
                          <span className="text-xs font-mono text-muted-foreground shrink-0" title={deployment.commitSha || ""}>
                            {formatShortSha(deployment.commitSha)}
                          </span>

                          {/* Branch */}
                          <div className="flex items-center gap-1 shrink-0">
                            <GitBranch className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">{deployment.branch || "—"}</span>
                          </div>

                          {/* Environment */}
                          <Badge variant="secondary" className="text-[10px] h-5 shrink-0">
                            {deployment.environment || "—"}
                          </Badge>

                          {/* Regression? */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {deployment.regressionFound ? (
                              <>
                                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                                <span className="text-xs text-red-600 dark:text-red-400 font-medium">Regressie</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                <span className="text-xs text-green-600 dark:text-green-400">Geen regressie</span>
                              </>
                            )}
                          </div>

                          {/* Severity */}
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-5 shrink-0 ${severityConfig.color} ${severityConfig.bgColor}`}
                          >
                            {severityConfig.label}
                          </Badge>

                          {/* Blocking? */}
                          {deployment.isBlocking && (
                            <Badge className="text-[10px] h-5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800 shrink-0">
                              <Lock className="h-3 w-3 mr-1" />
                              Blokkeert
                            </Badge>
                          )}

                          {/* Checks summary */}
                          <span className="text-xs text-muted-foreground ml-auto shrink-0">
                            {checks.length > 0 ? (
                              <>
                                {passingCount}/{checks.length} checks ok
                                {failingCount > 0 && (
                                  <span className="text-red-600 dark:text-red-400 ml-1">
                                    ({failingCount} falend)
                                  </span>
                                )}
                              </>
                            ) : (
                              "Geen checks"
                            )}
                          </span>
                        </div>
                      </CardContent>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-4 pb-4 space-y-4 border-t">
                        {/* Checks section */}
                        <div className="pt-4">
                          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            SEO-regressiecontroles
                          </h4>
                          {checks.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Geen controles uitgevoerd voor deze deployment.
                            </p>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                              {checks.map((check) => {
                                const statusConfig = CHECK_STATUS_CONFIG[check.status];
                                const StatusIcon = statusConfig.icon;
                                return (
                                  <Card key={check.id} className="p-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-medium truncate">
                                        {CHECK_TYPE_LABELS[check.checkType] || check.checkType}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={`text-[9px] h-5 shrink-0 ${statusConfig.color} ${statusConfig.bgColor}`}
                                      >
                                        <StatusIcon className="h-2.5 w-2.5 mr-1" />
                                        {statusConfig.label}
                                      </Badge>
                                    </div>
                                    {check.finding && (
                                      <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-2">
                                        {check.finding}
                                      </p>
                                    )}
                                    {check.severity && check.severity !== "none" && (
                                      <Badge
                                        variant="outline"
                                        className={`text-[9px] h-4 mt-1.5 ${
                                          (SEVERITY_CONFIG[check.severity] || SEVERITY_CONFIG.none).color
                                        } ${(SEVERITY_CONFIG[check.severity] || SEVERITY_CONFIG.none).bgColor}`}
                                      >
                                        {(SEVERITY_CONFIG[check.severity] || SEVERITY_CONFIG.none).label}
                                      </Badge>
                                    )}
                                  </Card>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Unblock button */}
                        {deployment.isBlocking && (
                          <div className="flex items-center justify-end pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setUnblockDialogId(deployment.id);
                                setUnblockReason("");
                              }}
                              className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              <Unlock className="h-3.5 w-3.5 mr-1.5" />
                              Ontblokkeren
                            </Button>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* New Deployment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nieuwe deployment</DialogTitle>
            <DialogDescription>
              Registreer een nieuwe deployment om SEO-regressiecontroles uit te voeren.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Provider *</Label>
              <Select
                value={formProvider}
                onValueChange={(v) => setFormProvider(v as DeploymentProvider)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GITHUB">GitHub</SelectItem>
                  <SelectItem value="GITLAB">GitLab</SelectItem>
                  <SelectItem value="GENERIC_CICD">Algemene CI/CD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="commit-sha">Commit SHA</Label>
              <Input
                id="commit-sha"
                placeholder="abc123def456"
                value={formCommitSha}
                onChange={(e) => setFormCommitSha(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <Input
                id="branch"
                placeholder="main"
                value={formBranch}
                onChange={(e) => setFormBranch(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Omgeving</Label>
              <Select
                value={formEnvironment}
                onValueChange={setFormEnvironment}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Productie</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="development">Ontwikkeling</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Blokkering inschakelen</Label>
                <p className="text-xs text-muted-foreground">
                  Blokkeer verdere deploy bij regressies
                </p>
              </div>
              <Switch
                checked={formBlocking}
                onCheckedChange={setFormBlocking}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={handleCreateDeployment} disabled={isCreating}>
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Rocket className="h-4 w-4 mr-2" />
              )}
              Registreren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unblock Dialog */}
      <Dialog
        open={unblockDialogId !== null}
        onOpenChange={() => setUnblockDialogId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deployment ontblokkeren</DialogTitle>
            <DialogDescription>
              Geef een reden waarom deze deployment ontblokkeerd wordt ondanks de regressies.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unblock-reason">Reden voor ontblokkering</Label>
              <Input
                id="unblock-reason"
                placeholder="Bijv. Geaccepteerd risico, hotfix vereist..."
                value={unblockReason}
                onChange={(e) => setUnblockReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnblockDialogId(null)}>
              Annuleren
            </Button>
            <Button
              onClick={handleUnblock}
              disabled={actionLoading !== null || !unblockReason.trim()}
              variant="outline"
              className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Unlock className="h-4 w-4 mr-2" />
              )}
              Ontblokkeren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}


