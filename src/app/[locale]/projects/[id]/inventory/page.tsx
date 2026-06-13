"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter, useSearchParams } from "@/i18n/routing";
import { useTranslations } from "@/i18n/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Search,
  Download,
  FileSpreadsheet,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Globe,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

interface PageEntry {
  id: string;
  url: string;
  statusCode: number | null;
  status: string;
  contentType: string;
  title: string | null;
  description: string | null;
  h1: string | null;
  wordCount: number;
  canonicalUrl: string | null;
  indexability: string;
  language: string | null;
  internalLinkCount: number;
  externalLinkCount: number;
  imageCount: number;
  imagesWithoutAlt: number;
  crawlDepth: number;
  isOrphan: boolean;
  loadTimeMs: number | null;
  createdAt: string;
}

interface PagesMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  crawlSessionId: string;
}

type SortField = "url" | "title" | "statusCode" | "wordCount" | "crawlDepth" | "createdAt" | "loadTimeMs";
type SortOrder = "asc" | "desc";

export default function InventoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("inventory");
  const tCommon = useTranslations("common");

  // State
  const [pages, setPages] = useState<PageEntry[]>([]);
  const [meta, setMeta] = useState<PagesMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCrawl, setHasCrawl] = useState(true);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [statusCodeFilter, setStatusCodeFilter] = useState<string>("all");
  const [indexabilityFilter, setIndexabilityFilter] = useState<string>("all");
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all");
  const [minWordCount, setMinWordCount] = useState("");
  const [maxWordCount, setMaxWordCount] = useState("");

  // Sorting & Pagination
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Get crawlSessionId from URL params if present
  const crawlSessionId = searchParams.get("crawlSessionId");

  const fetchPages = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("limit", pageSize.toString());
      params.set("sort", sortField);
      params.set("order", sortOrder);
      if (searchText) params.set("search", searchText);
      if (statusCodeFilter !== "all") params.set("statusCode", statusCodeFilter);
      if (indexabilityFilter !== "all") params.set("indexability", indexabilityFilter);
      if (contentTypeFilter !== "all") params.set("contentType", contentTypeFilter);
      if (minWordCount) params.set("minWordCount", minWordCount);
      if (maxWordCount) params.set("maxWordCount", maxWordCount);
      if (crawlSessionId) params.set("crawlSessionId", crawlSessionId);

      const res = await fetch(`/api/projects/${id}/pages?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPages(data.data || []);
        setMeta(data.meta || null);
        if (data.data?.length === 0 && !data.meta?.crawlSessionId) {
          setHasCrawl(false);
        }
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [id, currentPage, pageSize, sortField, sortOrder, searchText, statusCodeFilter, indexabilityFilter, contentTypeFilter, minWordCount, maxWordCount, crawlSessionId]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, statusCodeFilter, indexabilityFilter, contentTypeFilter, minWordCount, maxWordCount]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortOrder === "asc" ? (
      <ChevronUp className="h-3 w-3 ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1" />
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pages.map((p) => p.id)));
    }
  };

  const toggleSelect = (pageId: string) => {
    const next = new Set(selectedIds);
    if (next.has(pageId)) {
      next.delete(pageId);
    } else {
      next.add(pageId);
    }
    setSelectedIds(next);
  };

  const handleExport = () => {
    if (pages.length === 0) return;

    const headers = [
      "URL", "Status", "Titel", "Beschrijving", "H1", "Woorden",
      "Canoniek", "Indexeerbaar", "Type", "Taal", "Interne links",
      "Externe links", "Afbeeldingen", "Diepte",
    ];

    const rows = pages.map((p) => [
      p.url,
      p.statusCode?.toString() || "",
      `"${(p.title || "").replace(/"/g, '""')}"`,
      `"${(p.description || "").replace(/"/g, '""')}"`,
      `"${(p.h1 || "").replace(/"/g, '""')}"`,
      p.wordCount.toString(),
      p.canonicalUrl || "",
      p.indexability,
      p.contentType,
      p.language || "",
      p.internalLinkCount.toString(),
      p.externalLinkCount.toString(),
      p.imageCount.toString(),
      p.crawlDepth.toString(),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `content-inventory-${id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t("exportSuccess"));
  };

  const indexabilityLabel = (val: string) => {
    switch (val) {
      case "INDEXABLE": return "Indexeerbaar";
      case "NOINDEX": return "Noindex";
      case "BLOCKED_ROBOTS": return "Geblokkeerd (robots)";
      case "CANONICALIZED": return "Gecanoniseerd";
      case "BLOCKED_META": return "Geblokkeerd (meta)";
      default: return val;
    }
  };

  const indexabilityVariant = (val: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (val) {
      case "INDEXABLE": return "default";
      case "NOINDEX": return "secondary";
      case "BLOCKED_ROBOTS":
      case "BLOCKED_META": return "destructive";
      case "CANONICALIZED": return "outline";
      default: return "secondary";
    }
  };

  const statusCodeColor = (code: number | null) => {
    if (!code) return "";
    if (code >= 200 && code < 300) return "text-emerald-600 dark:text-emerald-400";
    if (code >= 300 && code < 400) return "text-yellow-600 dark:text-yellow-400";
    if (code >= 400 && code < 500) return "text-orange-600 dark:text-orange-400";
    if (code >= 500) return "text-red-600 dark:text-red-400";
    return "";
  };

  // Empty state when no crawl has been done
  if (!isLoading && !hasCrawl) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 mb-6"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/projects/${id}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
          </motion.div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Globe className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center max-w-md">
                {t("empty")}
              </p>
              <Button
                className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => router.push(`/projects/${id}/crawls`)}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Naar crawls
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6"
        >
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/projects/${id}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <span className="text-sm text-muted-foreground">
                {t("selected", { count: selectedIds.size })}
              </span>
            )}
            <Button variant="outline" onClick={handleExport} disabled={pages.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              {t("export")}
            </Button>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-4"
        >
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="sm:col-span-2 lg:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t("searchPlaceholder")}
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={statusCodeFilter} onValueChange={setStatusCodeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("filterStatus")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("filterStatus")}</SelectItem>
                    <SelectItem value="200">200 OK</SelectItem>
                    <SelectItem value="301">301 Redirect</SelectItem>
                    <SelectItem value="302">302 Redirect</SelectItem>
                    <SelectItem value="404">404 Niet gevonden</SelectItem>
                    <SelectItem value="500">500 Serverfout</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={indexabilityFilter} onValueChange={setIndexabilityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("filterIndexability")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("filterIndexability")}</SelectItem>
                    <SelectItem value="INDEXABLE">Indexeerbaar</SelectItem>
                    <SelectItem value="NOINDEX">Noindex</SelectItem>
                    <SelectItem value="BLOCKED_ROBOTS">Geblokkeerd (robots)</SelectItem>
                    <SelectItem value="CANONICALIZED">Gecanoniseerd</SelectItem>
                    <SelectItem value="BLOCKED_META">Geblokkeerd (meta)</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("filterType")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("filterType")}</SelectItem>
                    <SelectItem value="HTML">HTML</SelectItem>
                    <SelectItem value="PDF">PDF</SelectItem>
                    <SelectItem value="IMAGE">Afbeelding</SelectItem>
                    <SelectItem value="VIDEO">Video</SelectItem>
                    <SelectItem value="OTHER">Overig</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input
                    placeholder={t("minWords")}
                    type="number"
                    value={minWordCount}
                    onChange={(e) => setMinWordCount(e.target.value)}
                    className="w-1/2"
                  />
                  <Input
                    placeholder={t("maxWords")}
                    type="number"
                    value={maxWordCount}
                    onChange={(e) => setMaxWordCount(e.target.value)}
                    className="w-1/2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                </div>
              ) : pages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t("noPages")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedIds.size === pages.length && pages.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none min-w-[200px]"
                          onClick={() => handleSort("url")}
                        >
                          <span className="flex items-center">{t("url")}<SortIcon field="url" /></span>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => handleSort("statusCode")}
                        >
                          <span className="flex items-center">{t("statusCode")}<SortIcon field="statusCode" /></span>
                        </TableHead>
                        <TableHead className="min-w-[150px]">{t("titel")}</TableHead>
                        <TableHead className="min-w-[120px]">{t("h1")}</TableHead>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => handleSort("wordCount")}
                        >
                          <span className="flex items-center">{t("woorden")}<SortIcon field="wordCount" /></span>
                        </TableHead>
                        <TableHead>{t("canoniek")}</TableHead>
                        <TableHead>{t("indexeerbaar")}</TableHead>
                        <TableHead>{t("type")}</TableHead>
                        <TableHead>{t("taal")}</TableHead>
                        <TableHead>{t("interneLinks")}</TableHead>
                        <TableHead>{t("externeLinks")}</TableHead>
                        <TableHead>{t("afbeeldingen")}</TableHead>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => handleSort("crawlDepth")}
                        >
                          <span className="flex items-center">{t("diepte")}<SortIcon field="crawlDepth" /></span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pages.map((page) => (
                        <TableRow
                          key={page.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/projects/${id}/inventory/${page.id}`)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(page.id)}
                              onCheckedChange={() => toggleSelect(page.id)}
                            />
                          </TableCell>
                          <TableCell className="max-w-[250px] truncate font-medium text-sm">
                            {page.url}
                          </TableCell>
                          <TableCell>
                            <span className={`font-mono text-sm ${statusCodeColor(page.statusCode)}`}>
                              {page.statusCode}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate text-sm">
                            {page.title || "—"}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate text-sm">
                            {page.h1 || "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {page.wordCount > 0 ? page.wordCount.toLocaleString("nl-NL") : "—"}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate text-sm">
                            {page.canonicalUrl ? (
                              <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                            ) : (
                              <span className="text-red-500">✗</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={indexabilityVariant(page.indexability)} className="text-xs">
                              {indexabilityLabel(page.indexability)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{page.contentType}</TableCell>
                          <TableCell className="text-sm">{page.language || "—"}</TableCell>
                          <TableCell className="text-sm">{page.internalLinkCount}</TableCell>
                          <TableCell className="text-sm">{page.externalLinkCount}</TableCell>
                          <TableCell className="text-sm">
                            {page.imageCount}
                            {page.imagesWithoutAlt > 0 && (
                              <span className="text-red-500 text-xs ml-1">
                                ({page.imagesWithoutAlt} zonder alt)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{page.crawlDepth}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Pagination */}
        {meta && meta.totalPages > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {t("page")} {meta.page} {t("of")} {meta.totalPages} — {meta.total} {tCommon("status").toLowerCase()}
              </span>
              <Select
                value={pageSize.toString()}
                onValueChange={(val) => {
                  setPageSize(parseInt(val));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[80px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                {tCommon("previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= meta.totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                {tCommon("next")}
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
