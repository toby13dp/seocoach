"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "@/i18n/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Upload,
  Search,
  Loader2,
  Tag,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FileUp,
} from "lucide-react";
import { toast } from "sonner";

// --- Types ---
interface KeywordEntry {
  id: string;
  keyword: string;
  searchIntent: string;
  funnelStage: string;
  searchVolume: number | null;
  difficulty: number | null;
  cpc: number | null;
  currentRanking: number | null;
  currentUrl: string | null;
  groupId: string | null;
  tags: string | null;
  notes: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  opportunity: {
    totalScore: number;
    volumeScore: number;
    difficultyScore: number;
    relevanceScore: number;
    currentRankScore: number;
    intentScore: number;
    funnelScore: number;
    competitionScore: number;
    calculatedAt: string;
  } | null;
}

interface KeywordMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// --- Badge helpers ---
const intentBadgeStyle = (intent: string) => {
  switch (intent) {
    case "INFORMATIONAL":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "NAVIGATIONAL":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "TRANSACTIONAL":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    case "COMMERCIAL_INVESTIGATION":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case "LOCAL":
      return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300";
    case "BRANDED":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const funnelBadgeStyle = (stage: string) => {
  switch (stage) {
    case "AWARENESS":
      return "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300";
    case "CONSIDERATION":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    case "DECISION":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300";
    case "RETENTION":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const intentLabel = (intent: string, t: (k: string) => string) => {
  switch (intent) {
    case "INFORMATIONAL": return t("informational");
    case "NAVIGATIONAL": return t("navigational");
    case "TRANSACTIONAL": return t("transactional");
    case "COMMERCIAL_INVESTIGATION": return t("commercialInvestigation");
    case "LOCAL": return t("local");
    case "BRANDED": return t("branded");
    default: return t("unknown");
  }
};

const funnelLabel = (stage: string, t: (k: string) => string) => {
  switch (stage) {
    case "AWARENESS": return t("awareness");
    case "CONSIDERATION": return t("consideration");
    case "DECISION": return t("decision");
    case "RETENTION": return t("retention");
    default: return t("unknown");
  }
};

const scoreColor = (score: number) => {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
};

export default function KeywordsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const t = useTranslations("keywords");
  const tCommon = useTranslations("common");

  // State
  const [keywords, setKeywords] = useState<KeywordEntry[]>([]);
  const [meta, setMeta] = useState<KeywordMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [classifyingIds, setClassifyingIds] = useState<Set<string>>(new Set());

  // Filters
  const [searchText, setSearchText] = useState("");
  const [filterIntent, setFilterIntent] = useState<string>("ALL");
  const [filterFunnel, setFilterFunnel] = useState<string>("ALL");
  const [filterGroup, setFilterGroup] = useState<string>("ALL");
  const [minVolume, setMinVolume] = useState("");
  const [maxDifficulty, setMaxDifficulty] = useState("");

  // Sorting
  const [sortField, setSortField] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Form state
  const [addForm, setAddForm] = useState({
    keyword: "",
    searchVolume: "",
    difficulty: "",
    cpc: "",
    currentRanking: "",
    currentUrl: "",
    groupId: "",
    tags: "",
    notes: "",
  });

  const [importFile, setImportFile] = useState<File | null>(null);

  // Groups for filter
  const [groups, setGroups] = useState<string[]>([]);

  // Fetch keywords
  const fetchKeywords = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", "20");
        params.set("sort", sortField);
        params.set("order", sortOrder);
        if (searchText) params.set("search", searchText);
        if (filterIntent !== "ALL") params.set("searchIntent", filterIntent);
        if (filterFunnel !== "ALL") params.set("funnelStage", filterFunnel);
        if (filterGroup !== "ALL") params.set("groupId", filterGroup);
        if (minVolume) params.set("minVolume", minVolume);
        if (maxDifficulty) params.set("maxDifficulty", maxDifficulty);

        const res = await fetch(
          `/api/projects/${projectId}/keywords?${params.toString()}`
        );
        if (res.ok) {
          const data = await res.json();
          setKeywords(data.data || []);
          setMeta(data.meta || { page: 1, limit: 20, total: 0, totalPages: 0 });
        }
      } catch {
        // silently fail
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, sortField, sortOrder, searchText, filterIntent, filterFunnel, filterGroup, minVolume, maxDifficulty]
  );

  // Fetch groups
  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/keywords?limit=1000`
        );
        if (res.ok) {
          const data = await res.json();
          const uniqueGroups = Array.from(
            new Set(
              (data.data || [])
                .map((k: KeywordEntry) => k.groupId)
                .filter(Boolean) as string[]
            )
          );
          setGroups(uniqueGroups);
        }
      } catch {
        // silently fail
      }
    }
    fetchGroups();
  }, [projectId]);

  useEffect(() => {
    fetchKeywords(1);
  }, [fetchKeywords]);

  // Handle sort
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Add keyword
  const handleAddKeyword = async () => {
    if (!addForm.keyword.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: addForm.keyword.trim(),
          searchVolume: addForm.searchVolume ? parseInt(addForm.searchVolume) : undefined,
          difficulty: addForm.difficulty ? parseFloat(addForm.difficulty) : undefined,
          cpc: addForm.cpc ? parseFloat(addForm.cpc) : undefined,
          currentRanking: addForm.currentRanking ? parseInt(addForm.currentRanking) : undefined,
          currentUrl: addForm.currentUrl || undefined,
          groupId: addForm.groupId || undefined,
          tags: addForm.tags ? addForm.tags.split(",").map((t) => t.trim()) : undefined,
          notes: addForm.notes || undefined,
        }),
      });
      if (res.ok) {
        toast.success(t("createSuccess"));
        setAddForm({ keyword: "", searchVolume: "", difficulty: "", cpc: "", currentRanking: "", currentUrl: "", groupId: "", tags: "", notes: "" });
        setAddDialogOpen(false);
        fetchKeywords(meta.page);
      } else {
        toast.error(t("createError"));
      }
    } catch {
      toast.error(t("createError"));
    } finally {
      setIsCreating(false);
    }
  };

  // Import CSV
  const handleImport = async () => {
    if (!importFile) return;
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await fetch(`/api/projects/${projectId}/keywords/import`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        const count = data.data?.imported || 0;
        toast.success(t("importSuccess", { count }));
        setImportFile(null);
        setImportDialogOpen(false);
        fetchKeywords(1);
      } else {
        toast.error(t("importError"));
      }
    } catch {
      toast.error(t("importError"));
    } finally {
      setIsImporting(false);
    }
  };

  // Classify intent
  const handleClassify = async (keywordId: string, useAI = false) => {
    setClassifyingIds((prev) => new Set(prev).add(keywordId));
    try {
      const res = await fetch(
        `/api/projects/${projectId}/keywords/${keywordId}/classify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ useAI }),
        }
      );
      if (res.ok) {
        toast.success(t("classifySuccess"));
        fetchKeywords(meta.page);
      } else {
        toast.error(t("classifyError"));
      }
    } catch {
      toast.error(t("classifyError"));
    } finally {
      setClassifyingIds((prev) => {
        const next = new Set(prev);
        next.delete(keywordId);
        return next;
      });
    }
  };

  // Navigate to keyword detail
  const goToKeywordDetail = (keywordId: string) => {
    router.push(`/projects/${projectId}/keywords/${keywordId}`);
  };

  const SortIcon = ({ field }: { field: string }) => (
    <ArrowUpDown
      className={`ml-1 h-3 w-3 inline ${
        sortField === field ? "opacity-100" : "opacity-30"
      }`}
    />
  );

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
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {meta.total} trefwoord{meta.total !== 1 ? "en" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="mr-2 h-4 w-4" />
                {t("importCsv")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("importTitle")}</DialogTitle>
                <DialogDescription>{t("importDesc")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <FileUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <Label htmlFor="csv-upload" className="cursor-pointer">
                    <span className="text-sm text-primary underline">
                      {importFile ? importFile.name : "Kies een CSV-bestand"}
                    </span>
                    <Input
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) =>
                        setImportFile(e.target.files?.[0] || null)
                      }
                    />
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setImportDialogOpen(false)}
                >
                  {tCommon("cancel")}
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!importFile || isImporting}
                >
                  {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {tCommon("import")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                {t("addKeyword")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{t("addTitle")}</DialogTitle>
                <DialogDescription>{t("addDesc")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("keywordLabel")}</Label>
                  <Input
                    value={addForm.keyword}
                    onChange={(e) =>
                      setAddForm({ ...addForm, keyword: e.target.value })
                    }
                    placeholder={t("keywordPlaceholder")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("volumeLabel")}</Label>
                    <Input
                      type="number"
                      value={addForm.searchVolume}
                      onChange={(e) =>
                        setAddForm({ ...addForm, searchVolume: e.target.value })
                      }
                      placeholder="1000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("difficultyLabel")}</Label>
                    <Input
                      type="number"
                      value={addForm.difficulty}
                      onChange={(e) =>
                        setAddForm({ ...addForm, difficulty: e.target.value })
                      }
                      placeholder="50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("cpcLabel")}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={addForm.cpc}
                      onChange={(e) =>
                        setAddForm({ ...addForm, cpc: e.target.value })
                      }
                      placeholder="1.50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("positionLabel")}</Label>
                    <Input
                      type="number"
                      value={addForm.currentRanking}
                      onChange={(e) =>
                        setAddForm({ ...addForm, currentRanking: e.target.value })
                      }
                      placeholder="15"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("urlLabel")}</Label>
                  <Input
                    value={addForm.currentUrl}
                    onChange={(e) =>
                      setAddForm({ ...addForm, currentUrl: e.target.value })
                    }
                    placeholder="https://voorbeeld.nl/pagina"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("groupLabel")}</Label>
                    <Input
                      value={addForm.groupId}
                      onChange={(e) =>
                        setAddForm({ ...addForm, groupId: e.target.value })
                      }
                      placeholder="groep-naam"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("tagsLabel")}</Label>
                    <Input
                      value={addForm.tags}
                      onChange={(e) =>
                        setAddForm({ ...addForm, tags: e.target.value })
                      }
                      placeholder="seo, tools"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("notesLabel")}</Label>
                  <Textarea
                    value={addForm.notes}
                    onChange={(e) =>
                      setAddForm({ ...addForm, notes: e.target.value })
                    }
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAddDialogOpen(false)}
                >
                  {tCommon("cancel")}
                </Button>
                <Button
                  onClick={handleAddKeyword}
                  disabled={!addForm.keyword.trim() || isCreating}
                >
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {tCommon("create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder={t("searchPlaceholder")}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
            </div>
            <Select value={filterIntent} onValueChange={setFilterIntent}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("filterIntent")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tCommon("all")}</SelectItem>
                <SelectItem value="INFORMATIONAL">{t("informational")}</SelectItem>
                <SelectItem value="NAVIGATIONAL">{t("navigational")}</SelectItem>
                <SelectItem value="TRANSACTIONAL">{t("transactional")}</SelectItem>
                <SelectItem value="COMMERCIAL_INVESTIGATION">{t("commercialInvestigation")}</SelectItem>
                <SelectItem value="LOCAL">{t("local")}</SelectItem>
                <SelectItem value="BRANDED">{t("branded")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterFunnel} onValueChange={setFilterFunnel}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t("filterFunnel")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tCommon("all")}</SelectItem>
                <SelectItem value="AWARENESS">{t("awareness")}</SelectItem>
                <SelectItem value="CONSIDERATION">{t("consideration")}</SelectItem>
                <SelectItem value="DECISION">{t("decision")}</SelectItem>
                <SelectItem value="RETENTION">{t("retention")}</SelectItem>
              </SelectContent>
            </Select>
            {groups.length > 0 && (
              <Select value={filterGroup} onValueChange={setFilterGroup}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={t("filterGroup")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{tCommon("all")}</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              type="number"
              className="w-[120px]"
              placeholder={t("minVolume")}
              value={minVolume}
              onChange={(e) => setMinVolume(e.target.value)}
            />
            <Input
              type="number"
              className="w-[140px]"
              placeholder={t("maxDifficulty")}
              value={maxDifficulty}
              onChange={(e) => setMaxDifficulty(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Keywords table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : keywords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Tag className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="text-lg font-medium">{t("emptyTitle")}</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                {t("emptyDesc")}
              </p>
              <Button
                className="mt-4"
                onClick={() => setAddDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("addKeyword")}
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleSort("keyword")}
                      >
                        {t("keyword")} <SortIcon field="keyword" />
                      </TableHead>
                      <TableHead>{t("searchIntent")}</TableHead>
                      <TableHead>{t("funnelStage")}</TableHead>
                      <TableHead
                        className="cursor-pointer select-none text-right"
                        onClick={() => handleSort("searchVolume")}
                      >
                        {t("volume")} <SortIcon field="searchVolume" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none text-right"
                        onClick={() => handleSort("difficulty")}
                      >
                        {t("difficulty")} <SortIcon field="difficulty" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none text-right"
                        onClick={() => handleSort("cpc")}
                      >
                        {t("cpc")} <SortIcon field="cpc" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none text-right"
                        onClick={() => handleSort("currentRanking")}
                      >
                        {t("position")} <SortIcon field="currentRanking" />
                      </TableHead>
                      <TableHead className="text-right">
                        {t("opportunityScore")}
                      </TableHead>
                      <TableHead className="w-[100px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keywords.map((kw) => (
                      <TableRow
                        key={kw.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => goToKeywordDetail(kw.id)}
                      >
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {kw.keyword}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${intentBadgeStyle(kw.searchIntent)}`}
                          >
                            {intentLabel(kw.searchIntent, t)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${funnelBadgeStyle(kw.funnelStage)}`}
                          >
                            {funnelLabel(kw.funnelStage, t)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {kw.searchVolume?.toLocaleString("nl-NL") ?? "-"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {kw.difficulty != null ? (
                            <span
                              className={
                                kw.difficulty > 60
                                  ? "text-red-600"
                                  : kw.difficulty > 30
                                  ? "text-yellow-600"
                                  : "text-emerald-600"
                              }
                            >
                              {kw.difficulty.toFixed(0)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {kw.cpc != null
                            ? `€${kw.cpc.toFixed(2)}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {kw.currentRanking ?? "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {kw.opportunity ? (
                            <span
                              className={`font-semibold tabular-nums ${scoreColor(kw.opportunity.totalScore)}`}
                            >
                              {kw.opportunity.totalScore.toFixed(0)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              {t("noScore")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClassify(kw.id);
                            }}
                            disabled={classifyingIds.has(kw.id)}
                            title={t("classify")}
                          >
                            {classifyingIds.has(kw.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {meta.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    {meta.total} trefwoord{meta.total !== 1 ? "en" : ""} &middot;{" "}
                    {tCommon("page")} {meta.page} van {meta.totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchKeywords(meta.page - 1)}
                      disabled={meta.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchKeywords(meta.page + 1)}
                      disabled={meta.page >= meta.totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
