"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  History,
  Eye,
  RotateCcw,
  Search,
  Calendar,
  User,
  Bot,
  Plus,
  Edit,
  Trash2,
  Globe,
  Unplug,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

// Types
interface ContentChange {
  id: string;
  changeType: string;
  summary: string;
  userId: string | null;
  userName: string | null;
  aiAgent: string | null;
  timestamp: string;
  contentBefore: string | null;
  contentAfter: string | null;
  diffHtml: string | null;
  cmsResult: string | null;
  rollbackData: string | null;
  approvalInfo: {
    approvedBy: string;
    approvedAt: string;
  } | null;
}

// Dutch labels for change types
const CHANGE_TYPE_LABELS: Record<string, string> = {
  CREATE: "Aanmaken",
  UPDATE: "Bijwerken",
  DELETE: "Verwijderen",
  PUBLISH: "Publiceren",
  UNPUBLISH: "Depubliceren",
  SCHEDULE: "Plannen",
  APPROVE: "Goedkeuren",
  REJECT: "Afwijzen",
  ROLLBACK: "Terugdraaien",
};

const CHANGE_TYPE_ICONS: Record<string, typeof Plus> = {
  CREATE: Plus,
  UPDATE: Edit,
  DELETE: Trash2,
  PUBLISH: Globe,
  UNPUBLISH: Unplug,
  SCHEDULE: Clock,
  APPROVE: CheckCircle,
  REJECT: XCircle,
  ROLLBACK: RotateCcw,
};

const CHANGE_TYPE_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  UPDATE: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  DELETE: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  PUBLISH: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
  UNPUBLISH: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  SCHEDULE: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
  APPROVE: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  REJECT: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  ROLLBACK: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
};

export default function HistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [changes, setChanges] = useState<ContentChange[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");

  // Detail dialog
  const [selectedChange, setSelectedChange] = useState<ContentChange | null>(null);

  // Rollback confirmation
  const [rollbackTarget, setRollbackTarget] = useState<ContentChange | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  useEffect(() => {
    fetchChanges();
  }, [projectId, typeFilter, dateFilter]);

  async function fetchChanges() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("changeType", typeFilter);
      if (dateFilter !== "all") params.set("dateRange", dateFilter);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(
        `/api/projects/${projectId}/content-changes/?${params.toString()}`
      );
      if (res.ok) {
        const data = await res.json();
        setChanges(data.data?.changes || data.data || []);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRollback(change: ContentChange) {
    setIsRollingBack(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/content-changes/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rollback",
            changeId: change.id,
          }),
        }
      );
      if (res.ok) {
        toast.success("Wijziging succesvol teruggedraaid");
        fetchChanges();
      } else {
        toast.error("Fout bij terugdraaien wijziging");
      }
    } catch {
      toast.error("Fout bij terugdraaien wijziging");
    } finally {
      setIsRollingBack(false);
      setRollbackTarget(null);
    }
  }

  function formatTimestamp(ts: string) {
    return new Date(ts).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getUniqueUsers() {
    const users = new Map<string, string>();
    changes.forEach((c) => {
      if (c.userId && c.userName) {
        users.set(c.userId, c.userName);
      }
      if (c.aiAgent) {
        users.set(`ai-${c.aiAgent}`, `AI: ${c.aiAgent}`);
      }
    });
    return Array.from(users.entries());
  }

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
            Contentgeschiedenis
          </h1>
          <p className="text-muted-foreground text-sm">
            Tijdlijn van alle contentwijzigingen
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek wijzigingen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchChanges()}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Type wijziging" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle types</SelectItem>
                {Object.entries(CHANGE_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alles</SelectItem>
                <SelectItem value="today">Vandaag</SelectItem>
                <SelectItem value="week">Deze week</SelectItem>
                <SelectItem value="month">Deze maand</SelectItem>
                <SelectItem value="quarter">Dit kwartaal</SelectItem>
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Gebruiker" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle gebruikers</SelectItem>
                {getUniqueUsers().map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Wijzigingen ({changes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {changes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Geen wijzigingen gevonden</p>
              <p className="text-sm mt-1">
                Contentwijzigingen verschijnen hier automatisch
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-muted" />

                <div className="space-y-0">
                  {changes.map((change, index) => {
                    const Icon = CHANGE_TYPE_ICONS[change.changeType] || Edit;
                    const colorClass = CHANGE_TYPE_COLORS[change.changeType] || CHANGE_TYPE_COLORS.UPDATE;
                    const isLast = index === changes.length - 1;

                    return (
                      <div key={change.id} className="relative pl-12 pb-6">
                        {/* Timeline dot */}
                        <div
                          className={`absolute left-3 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center ${colorClass}`}
                        >
                          <Icon className="h-2.5 w-2.5" />
                        </div>

                        {/* Content */}
                        <div className="flex flex-col sm:flex-row sm:items-start gap-2 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={colorClass}>
                                {CHANGE_TYPE_LABELS[change.changeType] || change.changeType}
                              </Badge>
                              <span className="text-sm font-medium">
                                {change.summary}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                {change.aiAgent ? (
                                  <>
                                    <Bot className="h-3 w-3" />
                                    AI: {change.aiAgent}
                                  </>
                                ) : (
                                  <>
                                    <User className="h-3 w-3" />
                                    {change.userName || "Onbekend"}
                                  </>
                                )}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatTimestamp(change.timestamp)}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedChange(change)}
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            Bekijk details
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog
        open={!!selectedChange}
        onOpenChange={() => setSelectedChange(null)}
      >
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedChange && (
                <Badge className={CHANGE_TYPE_COLORS[selectedChange.changeType] || ""}>
                  {CHANGE_TYPE_LABELS[selectedChange.changeType] || selectedChange.changeType}
                </Badge>
              )}
              Wijzigingsdetails
            </DialogTitle>
            <DialogDescription>
              {selectedChange?.summary}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {/* Meta info */}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground text-xs">Gebruiker</Label>
                  <p className="text-sm font-medium flex items-center gap-1">
                    {selectedChange?.aiAgent ? (
                      <>
                        <Bot className="h-3 w-3" />
                        AI: {selectedChange.aiAgent}
                      </>
                    ) : (
                      <>
                        <User className="h-3 w-3" />
                        {selectedChange?.userName || "Onbekend"}
                      </>
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Tijdstip</Label>
                  <p className="text-sm font-medium">
                    {selectedChange?.timestamp &&
                      formatTimestamp(selectedChange.timestamp)}
                  </p>
                </div>
              </div>

              {/* Content Diff */}
              {(selectedChange?.diffHtml || selectedChange?.contentBefore || selectedChange?.contentAfter) && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Contentwijziging</Label>
                  <div className="rounded-lg border overflow-hidden">
                    {selectedChange?.diffHtml ? (
                      <div
                        className="p-3 text-sm font-mono"
                        dangerouslySetInnerHTML={{
                          __html: selectedChange.diffHtml,
                        }}
                      />
                    ) : (
                      <div className="space-y-2 p-3">
                        {selectedChange?.contentBefore && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Vorige versie:
                            </p>
                            <pre className="text-sm bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 p-2 rounded whitespace-pre-wrap">
                              {selectedChange.contentBefore}
                            </pre>
                          </div>
                        )}
                        {selectedChange?.contentAfter && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Nieuwe versie:
                            </p>
                            <pre className="text-sm bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-400 p-2 rounded whitespace-pre-wrap">
                              {selectedChange.contentAfter}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CMS Result */}
              {selectedChange?.cmsResult && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">CMS-resultaat</Label>
                  <div className="p-3 rounded-lg border bg-muted/50 text-sm">
                    {selectedChange.cmsResult}
                  </div>
                </div>
              )}

              {/* Approval Info */}
              {selectedChange?.approvalInfo && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Goedkeuring</Label>
                  <div className="p-3 rounded-lg border bg-emerald-50 dark:bg-emerald-900/20">
                    <p className="text-sm">
                      Goedgekeurd door:{" "}
                      <span className="font-medium">
                        {selectedChange.approvalInfo.approvedBy}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimestamp(selectedChange.approvalInfo.approvedAt)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            {selectedChange?.rollbackData && (
              <Button
                variant="destructive"
                onClick={() => setRollbackTarget(selectedChange)}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Terugdraaien
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setSelectedChange(null)}
            >
              Sluiten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Confirmation */}
      <AlertDialog
        open={!!rollbackTarget}
        onOpenChange={() => setRollbackTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wijziging terugdraaien?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze wijziging wilt terugdraaien? Dit kan
              niet ongedaan worden gemaakt. De content wordt hersteld naar de
              vorige versie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (rollbackTarget) handleRollback(rollbackTarget);
              }}
              disabled={isRollingBack}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRollingBack ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Terugdraaien
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
