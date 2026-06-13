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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Loader2,
  TrendingDown,
  Eye,
  FileText,
  CheckCircle,
  AlertTriangle,
  Shield,
  Link as LinkIcon,
  ArrowRightLeft,
  Search,
  ExternalLink,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

// Types
interface DecayPage {
  id: string;
  url: string;
  title: string;
  decayPercentage: number;
  recommendedAction: string;
  evidence: {
    trafficDrop: number;
    rankingDrop: number;
    clickDrop: number;
    lastUpdated: string;
  };
  riskAssessment: {
    level: string;
    description: string;
  };
  affectedInternalLinks: number;
  proposedRedirectTarget: string | null;
  status: string;
  createdAt: string;
}

// Dutch labels for recommended actions
const ACTION_LABELS: Record<string, string> = {
  KEEP: "Behouden",
  IMPROVE: "Verbeteren",
  MERGE: "Samenvoegen",
  REDIRECT: "Doorverwijzen",
  NOINDEX: "NoIndex",
  REMOVE: "Verwijderen",
};

const ACTION_COLORS: Record<string, string> = {
  KEEP: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  IMPROVE: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  MERGE: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
  REDIRECT: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  NOINDEX: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
  REMOVE: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
};

const RISK_COLORS: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const RISK_LABELS: Record<string, string> = {
  LOW: "Laag",
  MEDIUM: "Gemiddeld",
  HIGH: "Hoog",
  CRITICAL: "Kritiek",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "In afwachting",
  IN_PROGRESS: "In behandeling",
  APPROVED: "Goedgekeurd",
  COMPLETED: "Voltooid",
  CANCELLED: "Geannuleerd",
};

export default function DecayWorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [decayPages, setDecayPages] = useState<DecayPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  // Detail dialog
  const [selectedPage, setSelectedPage] = useState<DecayPage | null>(null);

  // Approval confirmation
  const [confirmAction, setConfirmAction] = useState<{
    type: "brief" | "approve";
    pageId: string;
    destructive?: boolean;
  } | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Approval form
  const [approvalNote, setApprovalNote] = useState("");

  useEffect(() => {
    fetchDecayPages();
  }, [projectId, actionFilter]);

  async function fetchDecayPages() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(
        `/api/projects/${projectId}/decay-workflow/?${params.toString()}`
      );
      if (res.ok) {
        const data = await res.json();
        const pages = data.data?.pages || data.data || [];
        // Sort by decay percentage descending
        pages.sort(
          (a: DecayPage, b: DecayPage) =>
            b.decayPercentage - a.decayPercentage
        );
        setDecayPages(pages);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateBrief(pageId: string) {
    setIsActionLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/decay-workflow/${pageId}/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_brief",
          }),
        }
      );
      if (res.ok) {
        toast.success("Update brief wordt aangemaakt...");
        fetchDecayPages();
      } else {
        toast.error("Fout bij aanmaken update brief");
      }
    } catch {
      toast.error("Fout bij aanmaken update brief");
    } finally {
      setIsActionLoading(false);
      setConfirmAction(null);
    }
  }

  async function handleApproveAction(pageId: string) {
    setIsActionLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/decay-workflow/${pageId}/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "approve",
            note: approvalNote,
          }),
        }
      );
      if (res.ok) {
        toast.success("Snoeiactie goedgekeurd");
        fetchDecayPages();
      } else {
        toast.error("Fout bij goedkeuren snoeiactie");
      }
    } catch {
      toast.error("Fout bij goedkeuren snoeiactie");
    } finally {
      setIsActionLoading(false);
      setConfirmAction(null);
      setApprovalNote("");
    }
  }

  function decayColor(percentage: number) {
    if (percentage < 15) return "text-emerald-600 dark:text-emerald-400";
    if (percentage < 40) return "text-yellow-600 dark:text-yellow-400";
    if (percentage < 70) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  }

  function decayBg(percentage: number) {
    if (percentage < 15)
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    if (percentage < 40)
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    if (percentage < 70)
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  }

  function decayProgressColor(percentage: number) {
    if (percentage < 15) return "bg-emerald-500";
    if (percentage < 40) return "bg-yellow-500";
    if (percentage < 70) return "bg-orange-500";
    return "bg-red-500";
  }

  function isDestructiveAction(action: string) {
    return ["REMOVE", "REDIRECT", "NOINDEX"].includes(action);
  }

  // Stats
  const totalDecaying = decayPages.length;
  const avgDecay =
    totalDecaying > 0
      ? Math.round(
          decayPages.reduce((a, b) => a + b.decayPercentage, 0) / totalDecaying
        )
      : 0;
  const criticalCount = decayPages.filter(
    (p) => p.decayPercentage >= 70
  ).length;
  const destructiveCount = decayPages.filter((p) =>
    isDestructiveAction(p.recommendedAction)
  ).length;

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
          <h1 className="text-2xl font-bold tracking-tight">
            Vervalworkflow
          </h1>
          <p className="text-muted-foreground text-sm">
            Beheer pagina&apos;s met dalende prestaties
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Dalende pagina&apos;s</p>
            <p className="text-2xl font-bold">{totalDecaying}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Gemiddeld verval</p>
            <p className={`text-2xl font-bold ${decayColor(avgDecay)}`}>
              {avgDecay}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Kritiek</p>
            <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Snoeiacties</p>
            <p className="text-2xl font-bold text-orange-600">
              {destructiveCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek pagina's..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchDecayPages()}
                className="pl-9"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Aanbevolen actie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle acties</SelectItem>
                {Object.entries(ACTION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Decay Pages Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Dalende pagina&apos;s ({decayPages.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {decayPages.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <TrendingDown className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Geen dalende pagina&apos;s gevonden</p>
              <p className="text-sm mt-1">
                Alle pagina&apos;s presteren goed
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Verval</TableHead>
                    <TableHead>Aanbevolen actie</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {decayPages.map((page) => (
                    <TableRow key={page.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate max-w-[250px]">
                            {page.title || page.url}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                            {page.url}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge className={decayBg(page.decayPercentage)}>
                            {page.decayPercentage}%
                          </Badge>
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${decayProgressColor(page.decayPercentage)}`}
                              style={{ width: `${page.decayPercentage}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={ACTION_COLORS[page.recommendedAction] || ""}>
                          {ACTION_LABELS[page.recommendedAction] || page.recommendedAction}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {STATUS_LABELS[page.status] || page.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedPage(page)}
                            title="Details bekijken"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setConfirmAction({
                                type: "brief",
                                pageId: page.id,
                              })
                            }
                            title="Update brief maken"
                          >
                            <FileText className="h-4 w-4 text-blue-600" />
                          </Button>
                          {isDestructiveAction(page.recommendedAction) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setConfirmAction({
                                  type: "approve",
                                  pageId: page.id,
                                  destructive: true,
                                })
                              }
                              title="Snoeiactie goedkeuren"
                            >
                              <CheckCircle className="h-4 w-4 text-orange-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedPage} onOpenChange={() => setSelectedPage(null)}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Verval details
            </DialogTitle>
            <DialogDescription className="truncate">
              {selectedPage?.url}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-5 pr-4">
              {/* Decay Overview */}
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className={`text-3xl font-bold ${selectedPage ? decayColor(selectedPage.decayPercentage) : ""}`}>
                    {selectedPage?.decayPercentage}%
                  </p>
                  <p className="text-xs text-muted-foreground">Verval</p>
                </div>
                <div className="flex-1">
                  <Badge className={selectedPage ? ACTION_COLORS[selectedPage.recommendedAction] || "" : ""}>
                    {selectedPage
                      ? ACTION_LABELS[selectedPage.recommendedAction]
                      : ""}
                  </Badge>
                </div>
              </div>

              {/* Evidence Section */}
              {selectedPage?.evidence && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    Bewijs
                  </h3>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs text-muted-foreground">
                        Verkeersdaling
                      </p>
                      <p className="text-lg font-bold text-red-600">
                        -{selectedPage.evidence.trafficDrop}%
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs text-muted-foreground">
                        Positiedaling
                      </p>
                      <p className="text-lg font-bold text-orange-600">
                        -{selectedPage.evidence.rankingDrop}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs text-muted-foreground">
                        Klikdaling
                      </p>
                      <p className="text-lg font-bold text-yellow-600">
                        -{selectedPage.evidence.clickDrop}%
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Laatst bijgewerkt:{" "}
                    {selectedPage.evidence.lastUpdated &&
                      new Date(selectedPage.evidence.lastUpdated).toLocaleDateString("nl-NL")}
                  </p>
                </div>
              )}

              {/* Risk Assessment */}
              {selectedPage?.riskAssessment && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm flex items-center gap-1">
                    <Shield className="h-4 w-4" />
                    Risicobeoordeling
                  </h3>
                  <div
                    className={`p-3 rounded-lg border ${
                      RISK_COLORS[selectedPage.riskAssessment.level] || "bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {RISK_LABELS[selectedPage.riskAssessment.level] || selectedPage.riskAssessment.level}
                      </Badge>
                    </div>
                    <p className="text-sm mt-2">
                      {selectedPage.riskAssessment.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Affected Internal Links */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-1">
                  <LinkIcon className="h-4 w-4" />
                  Getroffen interne links
                </h3>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-sm">
                    <span className="font-bold">
                      {selectedPage?.affectedInternalLinks || 0}
                    </span>{" "}
                    interne links verwijzen naar deze pagina
                  </p>
                  {selectedPage && selectedPage.affectedInternalLinks > 5 && (
                    <p className="text-xs text-orange-600 mt-1">
                      ⚠️ Veel interne links worden beïnvloed
                    </p>
                  )}
                </div>
              </div>

              {/* Proposed Redirect Target */}
              {selectedPage?.proposedRedirectTarget && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm flex items-center gap-1">
                    <ArrowRightLeft className="h-4 w-4" />
                    Voorgesteld doorverwijsdoel
                  </h3>
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-400">
                      {selectedPage.proposedRedirectTarget}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (selectedPage) {
                      setConfirmAction({
                        type: "brief",
                        pageId: selectedPage.id,
                      });
                      setSelectedPage(null);
                    }
                  }}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Update brief maken
                </Button>
                {selectedPage &&
                  isDestructiveAction(selectedPage.recommendedAction) && (
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => {
                        setConfirmAction({
                          type: "approve",
                          pageId: selectedPage.id,
                          destructive: true,
                        });
                        setSelectedPage(null);
                      }}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Snoeiactie goedkeuren
                    </Button>
                  )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Brief Confirmation */}
      <AlertDialog
        open={confirmAction?.type === "brief"}
        onOpenChange={() => setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update brief maken?</AlertDialogTitle>
            <AlertDialogDescription>
              Er wordt een update brief aangemaakt om de prestaties van deze
              pagina te verbeteren. De brief bevat aanbevelingen voor
              optimalisatie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction) handleCreateBrief(confirmAction.pageId);
              }}
              disabled={isActionLoading}
            >
              {isActionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Brief aanmaken
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Destructive Action Dialog */}
      <Dialog
        open={confirmAction?.type === "approve" && confirmAction?.destructive}
        onOpenChange={() => {
          setConfirmAction(null);
          setApprovalNote("");
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Snoeiactie goedkeuren
            </DialogTitle>
            <DialogDescription>
              Dit is een destructieve actie. Zorg dat je de gevolgen begrijpt
              voordat je goedkeurt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm font-medium text-red-800 dark:text-red-400">
                ⚠️ Waarschuwing
              </p>
              <p className="text-sm text-red-600 dark:text-red-500 mt-1">
                Deze actie kan niet ongedaan worden gemaakt. De pagina wordt
                permanent gewijzigd of verwijderd. Alle interne links die naar
                deze pagina verwijzen worden bijgewerkt.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Opmerking (optioneel)</Label>
              <Textarea
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="Waarom keur je deze actie goed?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmAction(null);
                setApprovalNote("");
              }}
            >
              Annuleren
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmAction) handleApproveAction(confirmAction.pageId);
              }}
              disabled={isActionLoading}
            >
              {isActionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="mr-2 h-4 w-4" />
              )}
              Goedkeuren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
