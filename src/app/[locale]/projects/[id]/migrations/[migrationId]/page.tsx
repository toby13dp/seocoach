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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Shield,
  Loader2,
  ExternalLink,
  Rocket,
  Ban,
  Eye,
  X,
} from "lucide-react";
import { toast } from "sonner";

// --- Types ---
type MigrationProjectStatus =
  | "PLANNING"
  | "CRAWLING_OLD"
  | "CRAWLING_NEW"
  | "MAPPING"
  | "PRE_LAUNCH"
  | "LIVE"
  | "POST_LAUNCH"
  | "COMPLETED";

type MigrationCheckStatus =
  | "NOG_TE_CONTROLEREN"
  | "KLAAR"
  | "PROBLEEM_GEVONDEN"
  | "BLOKKEERT_LANCERING"
  | "GOEDGEKEURD";

interface MigrationProject {
  id: string;
  name: string;
  description: string | null;
  oldSiteUrl: string;
  newSiteUrl: string;
  status: MigrationProjectStatus;
  oldUrlCount: number;
  newUrlCount: number;
  mappedCount: number;
  redirectCount: number;
  issueCount: number;
  blockerCount: number;
  plannedLaunchDate: string | null;
  actualLaunchDate: string | null;
}

interface UrlMapping {
  id: string;
  oldUrl: string;
  newUrl: string | null;
  redirectType: number;
  metadataStatus: MigrationCheckStatus;
  headingsStatus: MigrationCheckStatus;
  contentStatus: MigrationCheckStatus;
  canonicalStatus: MigrationCheckStatus;
  robotsStatus: MigrationCheckStatus;
  structuredDataStatus: MigrationCheckStatus;
  internalLinksStatus: MigrationCheckStatus;
}

interface PreLaunchCheck {
  id: string;
  category: string;
  title: string;
  description: string | null;
  status: MigrationCheckStatus;
  checkedBy: string | null;
  checkedAt: string | null;
}

interface LaunchBlocker {
  id: string;
  title: string;
  description: string;
  severity: string;
  entityType: string | null;
  entityId: string | null;
  isResolved: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<
  MigrationProjectStatus,
  { label: string; color: string; bgColor: string }
> = {
  PLANNING: { label: "Planning", color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800" },
  CRAWLING_OLD: { label: "Oude site crawlen", color: "text-yellow-700 dark:text-yellow-400", bgColor: "bg-yellow-100 dark:bg-yellow-900/40 border-yellow-200 dark:border-yellow-800" },
  CRAWLING_NEW: { label: "Nieuwe site crawlen", color: "text-yellow-700 dark:text-yellow-400", bgColor: "bg-yellow-100 dark:bg-yellow-900/40 border-yellow-200 dark:border-yellow-800" },
  MAPPING: { label: "URL-mapping", color: "text-amber-700 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800" },
  PRE_LAUNCH: { label: "Pre-launch", color: "text-orange-700 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-900/40 border-orange-200 dark:border-orange-800" },
  LIVE: { label: "Live", color: "text-green-700 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/40 border-green-200 dark:border-green-800" },
  POST_LAUNCH: { label: "Post-launch monitoring", color: "text-emerald-700 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800" },
  COMPLETED: { label: "Voltooid", color: "text-emerald-700 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800" },
};

const CHECK_STATUS_CONFIG: Record<
  MigrationCheckStatus,
  { label: string; color: string; bgColor: string }
> = {
  NOG_TE_CONTROLEREN: { label: "Nog te controleren", color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700" },
  KLAAR: { label: "Klaar", color: "text-green-700 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/40 border-green-200 dark:border-green-800" },
  PROBLEEM_GEVONDEN: { label: "Probleem gevonden", color: "text-yellow-700 dark:text-yellow-400", bgColor: "bg-yellow-100 dark:bg-yellow-900/40 border-yellow-200 dark:border-yellow-800" },
  BLOKKEERT_LANCERING: { label: "Blokkeert lancering", color: "text-red-700 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/40 border-red-200 dark:border-red-800" },
  GOEDGEKEURD: { label: "Goedgekeurd", color: "text-emerald-700 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800" },
};

const CHECK_COLUMNS = [
  { key: "metadataStatus" as const, label: "Metadata" },
  { key: "headingsStatus" as const, label: "Koppen" },
  { key: "contentStatus" as const, label: "Content" },
  { key: "canonicalStatus" as const, label: "Canonical" },
  { key: "robotsStatus" as const, label: "Robots" },
  { key: "structuredDataStatus" as const, label: "Gestr. data" },
  { key: "internalLinksStatus" as const, label: "Int. links" },
];

export default function MigrationDetailPage({
  params,
}: {
  params: Promise<{ id: string; migrationId: string }>;
}) {
  const { id: projectId, migrationId } = use(params);
  const router = useRouter();

  const [migration, setMigration] = useState<MigrationProject | null>(null);
  const [urlMappings, setUrlMappings] = useState<UrlMapping[]>([]);
  const [preLaunchChecks, setPreLaunchChecks] = useState<PreLaunchCheck[]>([]);
  const [blockers, setBlockers] = useState<LaunchBlocker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("url-mapping");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Resolve blocker dialog
  const [resolveDialogId, setResolveDialogId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");

  // Launch readiness
  const [launchCheck, setLaunchCheck] = useState<{
    ready: boolean;
    openBlockers: number;
    uncheckedItems: number;
  } | null>(null);
  const [isCheckingLaunch, setIsCheckingLaunch] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [projectId, migrationId]);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [migrationRes, mappingsRes, checksRes, blockersRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/migrations/${migrationId}`),
        fetch(`/api/projects/${projectId}/migrations/${migrationId}/url-mappings`),
        fetch(`/api/projects/${projectId}/migrations/${migrationId}/checks`),
        fetch(`/api/projects/${projectId}/migrations/${migrationId}/blockers`),
      ]);

      if (migrationRes.ok) {
        const data = await migrationRes.json();
        setMigration(data.migration || null);
      }
      if (mappingsRes.ok) {
        const data = await mappingsRes.json();
        setUrlMappings(data.mappings || []);
      }
      if (checksRes.ok) {
        const data = await checksRes.json();
        setPreLaunchChecks(data.checks || []);
      }
      if (blockersRes.ok) {
        const data = await blockersRes.json();
        setBlockers(data.blockers || []);
      }
    } catch {
      // Silently handle
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunCheck = async (checkId: string) => {
    setActionLoading(checkId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/migrations/${migrationId}/checks/${checkId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check" }),
        }
      );
      if (res.ok) {
        toast.success("Controle uitgevoerd");
        fetchAll();
      } else {
        toast.error("Controle mislukt");
      }
    } catch {
      toast.error("Fout bij uitvoeren controle");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveBlocker = async () => {
    if (!resolveDialogId) return;
    setActionLoading(resolveDialogId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/migrations/${migrationId}/blockers/${resolveDialogId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "resolve",
            resolutionNotes: resolveNotes,
          }),
        }
      );
      if (res.ok) {
        toast.success("Blokkade opgelost");
        setResolveDialogId(null);
        setResolveNotes("");
        fetchAll();
      } else {
        toast.error("Oplossen mislukt");
      }
    } catch {
      toast.error("Fout bij oplossen blokkade");
    } finally {
      setActionLoading(null);
    }
  };

  const handleLaunchReadiness = async () => {
    setIsCheckingLaunch(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/migrations/${migrationId}/launch-readiness`
      );
      if (res.ok) {
        const data = await res.json();
        setLaunchCheck(data);
        if (data.ready) {
          toast.success("De migratie is lanceer-klaar!");
        } else {
          toast.warning(
            `Niet lanceer-klaar: ${data.openBlockers} open blokkades, ${data.uncheckedItems} ongecontroleerde items`
          );
        }
      }
    } catch {
      toast.error("Fout bij controleren lanceergereedheid");
    } finally {
      setIsCheckingLaunch(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="h-12 animate-pulse bg-muted rounded w-1/3" />
        <div className="h-6 animate-pulse bg-muted rounded w-2/3" />
        <div className="h-64 animate-pulse bg-muted rounded" />
      </div>
    );
  }

  if (!migration) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Migratie niet gevonden</h3>
              <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/migrations`)}>
                Terug naar migraties
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[migration.status];
  const progressPercent =
    migration.oldUrlCount > 0
      ? Math.round((migration.mappedCount / migration.oldUrlCount) * 100)
      : 0;

  const openBlockers = blockers.filter((b) => !b.isResolved);
  const resolvedBlockers = blockers.filter((b) => b.isResolved);

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
          onClick={() => router.push(`/projects/${projectId}/migrations`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{migration.name}</h1>
            <Badge
              variant="outline"
              className={`text-[10px] ${statusConfig.color} ${statusConfig.bgColor}`}
            >
              {statusConfig.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {migration.oldSiteUrl} → {migration.newSiteUrl}
          </p>
        </div>
        <Button
          onClick={handleLaunchReadiness}
          disabled={isCheckingLaunch}
          variant={launchCheck?.ready ? "default" : "outline"}
        >
          {isCheckingLaunch ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Rocket className="h-4 w-4 mr-2" />
          )}
          Lanceren klaar?
        </Button>
      </div>

      {/* Launch readiness result */}
      {launchCheck && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card
            className={
              launchCheck.ready
                ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30"
                : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
            }
          >
            <CardContent className="p-4 flex items-center gap-3">
              {launchCheck.ready ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
              )}
              <div>
                <p className="font-medium text-sm">
                  {launchCheck.ready
                    ? "De migratie is lanceer-klaar!"
                    : "De migratie is nog niet lanceer-klaar"}
                </p>
                {!launchCheck.ready && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {launchCheck.openBlockers} open blokkades,{" "}
                    {launchCheck.uncheckedItems} ongecontroleerde items
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-8 w-8 p-0"
                onClick={() => setLaunchCheck(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Progress bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">URL-mapping voortgang</span>
            <span className="text-sm text-muted-foreground">
              {migration.mappedCount} / {migration.oldUrlCount} URL&apos;s gemapped
            </span>
          </div>
          <Progress value={progressPercent} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>{migration.redirectCount} redirects</span>
            <span>{migration.issueCount} problemen</span>
            <span>{migration.blockerCount} blokkades</span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="url-mapping">
            URL-mapping
            <Badge variant="secondary" className="ml-1.5 h-5 text-[10px]">
              {urlMappings.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="pre-launch">
            Pre-launch controles
            <Badge variant="secondary" className="ml-1.5 h-5 text-[10px]">
              {preLaunchChecks.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="blockers">
            Lanceringblokkades
            <Badge variant="secondary" className="ml-1.5 h-5 text-[10px]">
              {openBlockers.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* URL-mapping tab */}
        <TabsContent value="url-mapping" className="mt-4">
          {urlMappings.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <ArrowRight className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Geen URL-mappings gevonden</h3>
                  <p className="text-sm text-muted-foreground">
                    URL-mappings verschijnen hier zodra de crawl is voltooid.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[calc(100vh-420px)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Oude URL</TableHead>
                        <TableHead className="min-w-[200px]">Nieuwe URL</TableHead>
                        <TableHead className="w-[80px]">Redirect</TableHead>
                        {CHECK_COLUMNS.map((col) => (
                          <TableHead key={col.key} className="w-[100px] text-center">
                            {col.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {urlMappings.map((mapping) => (
                        <TableRow key={mapping.id}>
                          <TableCell className="text-xs font-mono truncate max-w-[200px]" title={mapping.oldUrl}>
                            {mapping.oldUrl}
                          </TableCell>
                          <TableCell className="text-xs font-mono truncate max-w-[200px]" title={mapping.newUrl || ""}>
                            {mapping.newUrl || (
                              <span className="text-muted-foreground italic">Niet toegewezen</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-[10px] h-5">
                              {mapping.redirectType}
                            </Badge>
                          </TableCell>
                          {CHECK_COLUMNS.map((col) => {
                            const status = mapping[col.key];
                            const config = CHECK_STATUS_CONFIG[status];
                            return (
                              <TableCell key={col.key} className="text-center p-1">
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] h-5 whitespace-nowrap ${config.color} ${config.bgColor}`}
                                >
                                  {config.label}
                                </Badge>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Pre-launch checks tab */}
        <TabsContent value="pre-launch" className="mt-4">
          {preLaunchChecks.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Geen pre-launch controles</h3>
                  <p className="text-sm text-muted-foreground">
                    Pre-launch controles verschijnen hier zodra de migratie in de pre-launch fase is.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {preLaunchChecks.map((check) => {
                const config = CHECK_STATUS_CONFIG[check.status];
                return (
                  <Card key={check.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm">{check.title}</h4>
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-5 ${config.color} ${config.bgColor}`}
                            >
                              {config.label}
                            </Badge>
                          </div>
                          {check.description && (
                            <p className="text-xs text-muted-foreground">
                              {check.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="text-[10px] h-5">
                              {check.category}
                            </Badge>
                            {check.checkedAt && (
                              <span>
                                Gecontroleerd: {new Date(check.checkedAt).toLocaleDateString("nl-NL")}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRunCheck(check.id)}
                          disabled={actionLoading === check.id || check.status === "GOEDGEKEURD"}
                        >
                          {actionLoading === check.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Controleren
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Blockers tab */}
        <TabsContent value="blockers" className="mt-4">
          {blockers.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Geen lanceringblokkades</h3>
                  <p className="text-sm text-muted-foreground">
                    Er zijn momenteel geen blokkades die de lancering verhinderen.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Open blockers */}
              {openBlockers.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
                    <Ban className="h-4 w-4" />
                    Open blokkades ({openBlockers.length})
                  </h3>
                  {openBlockers.map((blocker) => (
                    <Card key={blocker.id} className="border-l-4 border-l-red-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-sm">{blocker.title}</h4>
                              <Badge
                                variant="outline"
                                className={`text-[10px] h-5 ${
                                  blocker.severity === "critical"
                                    ? "text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40 border-red-200 dark:border-red-800"
                                    : blocker.severity === "high"
                                    ? "text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40 border-orange-200 dark:border-orange-800"
                                    : "text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40 border-yellow-200 dark:border-yellow-800"
                                }`}
                              >
                                {blocker.severity === "critical"
                                  ? "Kritiek"
                                  : blocker.severity === "high"
                                  ? "Hoog"
                                  : "Gemiddeld"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {blocker.description}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setResolveDialogId(blocker.id);
                              setResolveNotes("");
                            }}
                            disabled={actionLoading === blocker.id}
                          >
                            {actionLoading === blocker.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Oplossen
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Resolved blockers */}
              {resolvedBlockers.length > 0 && (
                <div className="space-y-3 mt-6">
                  <h3 className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Opgelost ({resolvedBlockers.length})
                  </h3>
                  {resolvedBlockers.map((blocker) => (
                    <Card key={blocker.id} className="opacity-60">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm line-through">
                              {blocker.title}
                            </h4>
                            {blocker.resolutionNotes && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Notities: {blocker.resolutionNotes}
                              </p>
                            )}
                            {blocker.resolvedAt && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Opgelost: {new Date(blocker.resolvedAt).toLocaleDateString("nl-NL")}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Resolve Blocker Dialog */}
      <Dialog
        open={resolveDialogId !== null}
        onOpenChange={() => setResolveDialogId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Blokkade oplossen</DialogTitle>
            <DialogDescription>
              Voeg notities toe over hoe deze blokkade is opgelost.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resolve-notes">Oplossingsnotities</Label>
              <Textarea
                id="resolve-notes"
                placeholder="Beschrijf hoe de blokkade is opgelost..."
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogId(null)}>
              Annuleren
            </Button>
            <Button onClick={handleResolveBlocker} disabled={actionLoading !== null}>
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Oplossen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
