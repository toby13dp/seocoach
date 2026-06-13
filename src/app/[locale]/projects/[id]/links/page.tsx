"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Link2,
  Sparkles,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Eye,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

interface InternalLink {
  id: string;
  sourceUrl: string;
  targetUrl: string;
  anchorText: string;
  surroundingText: string | null;
  strategy: string;
  status: string;
  confidence: number;
  isExisting: boolean;
  isBroken: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  rolledBackAt: string | null;
  createdAt: string;
  diff?: {
    before: string;
    after: string;
  } | null;
}

interface LinkMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  PENDING: {
    label: "Pending",
    className:
      "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
  },
  APPROVED: {
    label: "Goedgekeurd",
    className:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  },
  REJECTED: {
    label: "Afgewezen",
    className:
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  },
  PUBLISHED: {
    label: "Gepubliceerd",
    className:
      "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  },
  ROLLED_BACK: {
    label: "Teruggedraaid",
    className:
      "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  },
};

const strategyConfig: Record<
  string,
  { label: string; className: string }
> = {
  SEMANTIC: {
    label: "Semantisch",
    className:
      "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800",
  },
  TOPIC_CLUSTER: {
    label: "Topiccluster",
    className:
      "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800",
  },
  ORPHAN_PAGE: {
    label: "Weespagina",
    className:
      "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  },
  STRONG_PAGE: {
    label: "Sterke pagina",
    className:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  },
  BROKEN_REPLACEMENT: {
    label: "Kapotte link",
    className:
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  },
};

export default function InternalLinksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [links, setLinks] = useState<InternalLink[]>([]);
  const [meta, setMeta] = useState<LinkMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [strategyFilter, setStrategyFilter] = useState("all");
  const [selectedLink, setSelectedLink] = useState<InternalLink | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    setIsLoading(true);
    try {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(meta.page));
      searchParams.set("pageSize", String(meta.pageSize));
      if (statusFilter !== "all") searchParams.set("status", statusFilter);
      if (strategyFilter !== "all") searchParams.set("strategy", strategyFilter);

      const res = await fetch(
        `/api/projects/${projectId}/internal-links?${searchParams.toString()}`
      );
      if (res.ok) {
        const data = await res.json();
        setLinks(data.data || []);
        if (data.meta) setMeta(data.meta);
      }
    } catch {
      toast.error("Fout bij ophalen interne links");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, meta.page, meta.pageSize, statusFilter, strategyFilter]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/internal-links`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(
          `Linksuggesties gegenereerd: ${data.data?.candidates?.length || 0} suggesties`
        );
        fetchLinks();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fout bij genereren linksuggesties");
      }
    } catch {
      toast.error("Fout bij genereren linksuggesties");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleViewDetail(link: InternalLink) {
    setActionLoadingId(link.id);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/internal-links/${link.id}`
      );
      if (res.ok) {
        const data = await res.json();
        setSelectedLink(data.data || link);
        setShowDetailDialog(true);
      } else {
        setSelectedLink(link);
        setShowDetailDialog(true);
      }
    } catch {
      setSelectedLink(link);
      setShowDetailDialog(true);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleApprove(linkId: string) {
    setActionLoadingId(linkId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/internal-links/${linkId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve" }),
        }
      );
      if (res.ok) {
        toast.success("Link goedgekeurd");
        fetchLinks();
        if (showDetailDialog) setShowDetailDialog(false);
      } else {
        const data = await res.json();
        toast.error(data.error || "Fout bij goedkeuren link");
      }
    } catch {
      toast.error("Fout bij goedkeuren link");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleReject(linkId: string) {
    setActionLoadingId(linkId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/internal-links/${linkId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reject" }),
        }
      );
      if (res.ok) {
        toast.success("Link afgewezen");
        fetchLinks();
        if (showDetailDialog) setShowDetailDialog(false);
      } else {
        const data = await res.json();
        toast.error(data.error || "Fout bij afwijzen link");
      }
    } catch {
      toast.error("Fout bij afwijzen link");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleRollback(linkId: string) {
    setActionLoadingId(linkId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/internal-links/${linkId}/rollback`,
        { method: "POST" }
      );
      if (res.ok) {
        toast.success("Link teruggedraaid");
        fetchLinks();
        if (showDetailDialog) setShowDetailDialog(false);
      } else {
        const data = await res.json();
        toast.error(data.error || "Fout bij terugdraaien link");
      }
    } catch {
      toast.error("Fout bij terugdraaien link");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleBulkApprove() {
    if (selectedIds.size === 0) {
      toast.error("Selecteer minimaal één link");
      return;
    }
    setIsBulkApproving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/internal-links/bulk-approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ linkIds: Array.from(selectedIds) }),
        }
      );
      if (res.ok) {
        toast.success(`${selectedIds.size} links goedgekeurd`);
        setSelectedIds(new Set());
        fetchLinks();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fout bij bulk-goedkeuren");
      }
    } catch {
      toast.error("Fout bij bulk-goedkeuren");
    } finally {
      setIsBulkApproving(false);
    }
  }

  function toggleSelect(linkId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(linkId)) {
        next.delete(linkId);
      } else {
        next.add(linkId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === links.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(links.map((l) => l.id)));
    }
  }

  function truncateUrl(url: string, maxLen = 40) {
    if (url.length <= maxLen) return url;
    return url.substring(0, maxLen - 3) + "...";
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/projects/${projectId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Interne links
            </h1>
            <p className="text-muted-foreground text-sm">
              Beheer interne linksuggesties en -goedkeuringen
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              onClick={handleBulkApprove}
              disabled={isBulkApproving}
            >
              {isBulkApproving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Goedkeuren ({selectedIds.size})
            </Button>
          )}
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Genereer linksuggesties
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setMeta((m) => ({ ...m, page: 1 })); }}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter op status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statussen</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Goedgekeurd</SelectItem>
                <SelectItem value="REJECTED">Afgewezen</SelectItem>
                <SelectItem value="PUBLISHED">Gepubliceerd</SelectItem>
                <SelectItem value="ROLLED_BACK">Teruggedraaid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={strategyFilter} onValueChange={(val) => { setStrategyFilter(val); setMeta((m) => ({ ...m, page: 1 })); }}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter op strategie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle strategieën</SelectItem>
                <SelectItem value="SEMANTIC">Semantisch</SelectItem>
                <SelectItem value="TOPIC_CLUSTER">Topiccluster</SelectItem>
                <SelectItem value="ORPHAN_PAGE">Weespagina</SelectItem>
                <SelectItem value="STRONG_PAGE">Sterke pagina</SelectItem>
                <SelectItem value="BROKEN_REPLACEMENT">Kapotte link</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Links Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Linksuggesties ({meta.total})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {links.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Link2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Geen interne links gevonden</p>
              <p className="text-sm mt-1">
                Genereer linksuggesties om te beginnen met interne linkbuilding
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          selectedIds.size === links.length && links.length > 0
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Bronpagina</TableHead>
                    <TableHead className="w-8" />
                    <TableHead>Doelpagina</TableHead>
                    <TableHead>Ankertekst</TableHead>
                    <TableHead>Strategie</TableHead>
                    <TableHead>Vertrouwen</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((link) => {
                    const sConfig = statusConfig[link.status] || statusConfig.PENDING;
                    const strConfig =
                      strategyConfig[link.strategy] || strategyConfig.SEMANTIC;
                    const confidencePct = Math.round(link.confidence * 100);

                    return (
                      <TableRow
                        key={link.id}
                        className={
                          selectedIds.has(link.id)
                            ? "bg-emerald-50 dark:bg-emerald-950/20"
                            : ""
                        }
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(link.id)}
                            onCheckedChange={() => toggleSelect(link.id)}
                          />
                        </TableCell>
                        <TableCell
                          className="max-w-[180px] truncate font-mono text-xs cursor-pointer hover:text-primary"
                          title={link.sourceUrl}
                          onClick={() => handleViewDetail(link)}
                        >
                          {truncateUrl(link.sourceUrl)}
                        </TableCell>
                        <TableCell>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        </TableCell>
                        <TableCell
                          className="max-w-[180px] truncate font-mono text-xs cursor-pointer hover:text-primary"
                          title={link.targetUrl}
                          onClick={() => handleViewDetail(link)}
                        >
                          {truncateUrl(link.targetUrl)}
                        </TableCell>
                        <TableCell
                          className="max-w-[140px] truncate text-sm cursor-pointer hover:text-primary"
                          onClick={() => handleViewDetail(link)}
                        >
                          {link.anchorText}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${strConfig.className}`}
                          >
                            {strConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[80px]">
                            <Progress
                              value={confidencePct}
                              className="h-2 flex-1"
                            />
                            <span className="text-xs text-muted-foreground w-8 text-right">
                              {confidencePct}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${sConfig.className}`}
                          >
                            {sConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleViewDetail(link)}
                            disabled={actionLoadingId === link.id}
                          >
                            {actionLoadingId === link.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
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

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page <= 1}
            onClick={() => setMeta((m) => ({ ...m, page: m.page - 1 }))}
          >
            Vorige
          </Button>
          <span className="text-sm text-muted-foreground">
            Pagina {meta.page} van {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page >= meta.totalPages}
            onClick={() => setMeta((m) => ({ ...m, page: m.page + 1 }))}
          >
            Volgende
          </Button>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[700px]">
          {selectedLink && (
            <>
              <DialogHeader>
                <DialogTitle>Linkdetails</DialogTitle>
                <DialogDescription>
                  Bekijk en beheer deze interne linksuggestie
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4 pr-4">
                  {/* Source → Target */}
                  <div className="grid gap-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Bronpagina
                      </p>
                      <p className="text-sm font-mono break-all">
                        {selectedLink.sourceUrl}
                      </p>
                    </div>
                    <div className="flex justify-center">
                      <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Doelpagina
                      </p>
                      <p className="text-sm font-mono break-all">
                        {selectedLink.targetUrl}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Anchor Text */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Ankertekst
                    </p>
                    <p className="text-sm font-medium">
                      &ldquo;{selectedLink.anchorText}&rdquo;
                    </p>
                  </div>

                  {/* Strategy & Status */}
                  <div className="flex gap-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Strategie
                      </p>
                      <Badge
                        variant="outline"
                        className={
                          strategyConfig[selectedLink.strategy]?.className || ""
                        }
                      >
                        {strategyConfig[selectedLink.strategy]?.label ||
                          selectedLink.strategy}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Status
                      </p>
                      <Badge
                        variant="outline"
                        className={
                          statusConfig[selectedLink.status]?.className || ""
                        }
                      >
                        {statusConfig[selectedLink.status]?.label ||
                          selectedLink.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Confidence */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Vertrouwen
                    </p>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={Math.round(selectedLink.confidence * 100)}
                        className="h-2 flex-1"
                      />
                      <span className="text-sm font-medium">
                        {Math.round(selectedLink.confidence * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Context Snippet */}
                  {selectedLink.surroundingText && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Context
                      </p>
                      <div className="bg-muted/50 rounded-md p-3 text-sm">
                        {selectedLink.surroundingText}
                      </div>
                    </div>
                  )}

                  {/* Diff Preview */}
                  {selectedLink.diff && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Verschilweergave
                      </p>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Voor:
                          </p>
                          <div className="bg-red-50 dark:bg-red-950/20 rounded-md p-3 text-xs font-mono whitespace-pre-wrap border border-red-200 dark:border-red-800">
                            {selectedLink.diff.before}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Na:
                          </p>
                          <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-md p-3 text-xs font-mono whitespace-pre-wrap border border-emerald-200 dark:border-emerald-800">
                            {selectedLink.diff.after}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    {selectedLink.approvedAt && (
                      <p>
                        Goedgekeurd:{" "}
                        {new Date(selectedLink.approvedAt).toLocaleDateString(
                          "nl-NL",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    )}
                    {selectedLink.publishedAt && (
                      <p>
                        Gepubliceerd:{" "}
                        {new Date(selectedLink.publishedAt).toLocaleDateString(
                          "nl-NL",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    )}
                    {selectedLink.rolledBackAt && (
                      <p>
                        Teruggedraaid:{" "}
                        {new Date(selectedLink.rolledBackAt).toLocaleDateString(
                          "nl-NL",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    )}
                    <p>
                      Aangemaakt:{" "}
                      {new Date(selectedLink.createdAt).toLocaleDateString(
                        "nl-NL",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </p>
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter className="flex-row gap-2 sm:justify-between">
                <div />
                <div className="flex gap-2">
                  {selectedLink.status === "PENDING" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReject(selectedLink.id)}
                        disabled={actionLoadingId === selectedLink.id}
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        Afwijzen
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(selectedLink.id)}
                        disabled={actionLoadingId === selectedLink.id}
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Goedkeuren
                      </Button>
                    </>
                  )}
                  {selectedLink.status === "PUBLISHED" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRollback(selectedLink.id)}
                      disabled={actionLoadingId === selectedLink.id}
                    >
                      <RotateCcw className="mr-1 h-4 w-4" />
                      Terugdraaien
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
