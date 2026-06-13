"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "@/i18n/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Globe,
  FileText,
  Link2,
  ImageIcon,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Code,
  Clock,
  Hash,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

interface PageIssue {
  id: string;
  ruleId: string;
  ruleName: string;
  dutchExplanation: string;
  severity: string;
  priority: string;
  recommendedAction: string | null;
}

interface PageSnapshot {
  id: string;
  source: string;
  sizeBytes: number | null;
  createdAt: string;
}

interface RenderedComparison {
  id: string;
  textDiff: string | null;
  linkDiff: string | null;
  canonicalDiff: string | null;
  robotsDiff: string | null;
  structuredDataDiff: string | null;
  headingDiff: string | null;
  navigationDiff: string | null;
  hasSignificantDiff: boolean;
  summary: string | null;
}

interface PageDetail {
  id: string;
  url: string;
  normalizedUrl: string;
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
  structuredData: string | null;
  crawlDepth: number;
  isOrphan: boolean;
  redirectChain: string | null;
  finalUrl: string | null;
  loadTimeMs: number | null;
  htmlSizeBytes: number | null;
  contentHash: string | null;
  mainContent: string | null;
  internalLinks: string | null;
  externalLinks: string | null;
  images: string | null;
  metaRobots: string | null;
  renderDiffDetected: boolean;
  snapshots: PageSnapshot[];
  issues: PageIssue[];
  renderedComparison: RenderedComparison | null;
}

export default function PageDetailPage({
  params,
}: {
  params: Promise<{ id: string; pageId: string }>;
}) {
  const { id, pageId } = use(params);
  const router = useRouter();
  const t = useTranslations("pageDetail");
  const tCommon = useTranslations("common");

  const [pageData, setPageData] = useState<PageDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("simple");

  useEffect(() => {
    async function fetchPage() {
      try {
        const res = await fetch(`/api/projects/${id}/pages/${pageId}`);
        if (res.ok) {
          const data = await res.json();
          setPageData(data.data);
        } else {
          toast.error(t("pageNotFound"));
        }
      } catch {
        toast.error(t("loadError"));
      } finally {
        setIsLoading(false);
      }
    }
    fetchPage();
  }, [id, pageId, t]);

  const indexabilityLabel = (val: string) => {
    switch (val) {
      case "INDEXABLE": return t("indexable");
      case "NOINDEX": return t("noindex");
      case "BLOCKED_ROBOTS": return t("blockedRobots");
      case "CANONICALIZED": return t("canonicalized");
      case "BLOCKED_META": return t("blockedMeta");
      default: return t("unknown");
    }
  };

  const indexabilityIcon = (val: string) => {
    switch (val) {
      case "INDEXABLE": return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "NOINDEX": return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "BLOCKED_ROBOTS":
      case "BLOCKED_META": return <XCircle className="h-5 w-5 text-red-500" />;
      case "CANONICALIZED": return <Link2 className="h-5 w-5 text-blue-500" />;
      default: return <AlertTriangle className="h-5 w-5 text-gray-400" />;
    }
  };

  const severityVariant = (severity: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (severity) {
      case "CRITICAL": return "destructive";
      case "ERROR": return "destructive";
      case "WARNING": return "secondary";
      case "INFO": return "outline";
      default: return "secondary";
    }
  };

  const severityLabel = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return "Kritiek";
      case "ERROR": return "Fout";
      case "WARNING": return "Waarschuwing";
      case "INFO": return "Info";
      default: return severity;
    }
  };

  const parseJsonSafely = (jsonStr: string | null): unknown[] | null => {
    if (!jsonStr) return null;
    try {
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const formatBytes = (bytes: number | null) => {
    if (bytes === null) return t("notAvailable");
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} ${t("kb")}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!pageData) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
          <Button
            variant="ghost"
            onClick={() => router.push(`/projects/${id}/inventory`)}
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            {tCommon("back")}
          </Button>
          <Card className="mt-6">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Globe className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t("pageNotFound")}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const internalLinksList = parseJsonSafely(pageData.internalLinks);
  const externalLinksList = parseJsonSafely(pageData.externalLinks);
  const imagesList = parseJsonSafely(pageData.images);
  const redirectChainList = parseJsonSafely(pageData.redirectChain);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/projects/${id}/inventory`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {tCommon("back")}
          </Button>
          <div className="flex items-start gap-3">
            <Globe className="h-6 w-6 text-emerald-600 mt-1 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold break-all">{pageData.url}</h1>
              {pageData.title && (
                <p className="text-muted-foreground mt-1">{pageData.title}</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="simple">{t("simple")}</TabsTrigger>
            <TabsTrigger value="technical">{t("technical")}</TabsTrigger>
          </TabsList>

          {/* Simple View */}
          <TabsContent value="simple">
            <div className="grid gap-4">
              {/* Basic info */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {tCommon("overview")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">{t("title")}</p>
                        <p className="font-medium">{pageData.title || t("notAvailable")}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("description")}</p>
                        <p className="font-medium text-sm">{pageData.description || t("notAvailable")}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("h1")}</p>
                        <p className="font-medium">{pageData.h1 || t("notAvailable")}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("wordCount")}</p>
                        <p className="font-medium">
                          {pageData.wordCount > 0
                            ? pageData.wordCount.toLocaleString("nl-NL")
                            : t("notAvailable")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Indexability */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      {t("indexabilityStatus")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      {indexabilityIcon(pageData.indexability)}
                      <div>
                        <p className="font-medium">{indexabilityLabel(pageData.indexability)}</p>
                        {pageData.canonicalUrl && (
                          <p className="text-sm text-muted-foreground">
                            Canoniek: {pageData.canonicalUrl}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Links & Images */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Link2 className="h-5 w-5" />
                      Links & afbeeldingen
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">{t("internalLinks")}</p>
                        <p className="font-medium text-lg">{pageData.internalLinkCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("externalLinks")}</p>
                        <p className="font-medium text-lg">{pageData.externalLinkCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("images")}</p>
                        <p className="font-medium text-lg">{pageData.imageCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("imageAltStatus")}</p>
                        {pageData.imageCount > 0 ? (
                          pageData.imagesWithoutAlt === 0 ? (
                            <p className="font-medium text-emerald-600 dark:text-emerald-400 text-sm">
                              {t("allImagesHaveAlt")}
                            </p>
                          ) : (
                            <p className="font-medium text-orange-600 dark:text-orange-400 text-sm">
                              {t("someImagesMissingAlt", { count: pageData.imagesWithoutAlt })}
                            </p>
                          )
                        ) : (
                          <p className="text-muted-foreground text-sm">{t("noImages")}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Issues */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      {t("issuesSummary")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pageData.issues.length === 0 ? (
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-5 w-5" />
                        <p>{t("noIssues")}</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {pageData.issues.map((issue) => (
                          <div
                            key={issue.id}
                            className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                          >
                            <Badge variant={severityVariant(issue.severity)} className="shrink-0 mt-0.5">
                              {severityLabel(issue.severity)}
                            </Badge>
                            <div className="min-w-0">
                              <p className="text-sm">{issue.dutchExplanation}</p>
                              {issue.recommendedAction && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Actie: {issue.recommendedAction}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          {/* Technical View */}
          <TabsContent value="technical">
            <div className="grid gap-4">
              {/* HTTP & Performance */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      HTTP & prestaties
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">{t("httpStatus")}</p>
                        <p className="font-mono font-medium text-lg">
                          {pageData.statusCode ?? t("notAvailable")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("responseTime")}</p>
                        <p className="font-medium">
                          {pageData.loadTimeMs
                            ? `${pageData.loadTimeMs} ${t("ms")}`
                            : t("notAvailable")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("htmlSize")}</p>
                        <p className="font-medium">{formatBytes(pageData.htmlSizeBytes)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Content-type</p>
                        <p className="font-medium">{pageData.contentType}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Meta & Canonical */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Code className="h-5 w-5" />
                      Meta & canoniek
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{t("canonicalUrl")}</p>
                      <p className="font-medium text-sm break-all">
                        {pageData.canonicalUrl || t("notAvailable")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("metaRobots")}</p>
                      <p className="font-medium">
                        {pageData.metaRobots || t("notAvailable")}
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground">{t("contentHash")}</p>
                      <p className="font-mono text-xs break-all">
                        {pageData.contentHash || t("notAvailable")}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Structured Data */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Hash className="h-5 w-5" />
                      {t("structuredData")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pageData.structuredData ? (
                      <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto">
                        {JSON.stringify(JSON.parse(pageData.structuredData), null, 2)}
                      </pre>
                    ) : (
                      <p className="text-muted-foreground">{t("noStructuredData")}</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Internal Links */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Link2 className="h-5 w-5" />
                      {t("internalLinks")} ({pageData.internalLinkCount})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {internalLinksList && internalLinksList.length > 0 ? (
                      <div className="max-h-64 overflow-y-auto space-y-1">
                        {internalLinksList.map((link, i) => {
                          const linkStr = typeof link === "string" ? link : (link as Record<string, unknown>)?.href?.toString() || JSON.stringify(link);
                          return (
                            <div key={i} className="flex items-center gap-2 text-sm py-1">
                              <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="truncate">{linkStr}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">{t("noInternalLinks")}</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* External Links */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ExternalLink className="h-5 w-5" />
                      {t("externalLinks")} ({pageData.externalLinkCount})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {externalLinksList && externalLinksList.length > 0 ? (
                      <div className="max-h-64 overflow-y-auto space-y-1">
                        {externalLinksList.map((link, i) => {
                          const linkStr = typeof link === "string" ? link : (link as Record<string, unknown>)?.href?.toString() || JSON.stringify(link);
                          return (
                            <div key={i} className="flex items-center gap-2 text-sm py-1">
                              <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="truncate">{linkStr}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">{t("noExternalLinks")}</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Images */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ImageIcon className="h-5 w-5" />
                      {t("images")} ({pageData.imageCount})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {imagesList && imagesList.length > 0 ? (
                      <div className="max-h-64 overflow-y-auto space-y-1">
                        {imagesList.map((img, i) => {
                          const imgObj = img as Record<string, unknown>;
                          const src = (imgObj.src as string) || JSON.stringify(img);
                          const alt = imgObj.alt as string | undefined;
                          return (
                            <div key={i} className="flex items-center gap-2 text-sm py-1">
                              {alt ? (
                                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                              ) : (
                                <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                              )}
                              <span className="truncate flex-1">{src}</span>
                              {alt ? (
                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  alt: {alt}
                                </span>
                              ) : (
                                <span className="text-xs text-red-500">geen alt</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">{t("noImages")}</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Redirect Chain */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      {t("redirectChain")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {redirectChainList && redirectChainList.length > 0 ? (
                      <div className="space-y-2">
                        {redirectChainList.map((url, i) => {
                          const urlStr = typeof url === "string" ? url : JSON.stringify(url);
                          return (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <span className="font-mono text-muted-foreground">{i + 1}.</span>
                              <span className="truncate">{urlStr}</span>
                              {i < redirectChainList.length - 1 && (
                                <span className="text-muted-foreground">→</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">{t("noRedirectChain")}</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Source vs Rendered */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Code className="h-5 w-5" />
                      {t("sourceVsRendered")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pageData.renderedComparison ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          {pageData.renderedComparison.hasSignificantDiff ? (
                            <>
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                                {t("significantDiff")}
                              </p>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                                {t("noDiff")}
                              </p>
                            </>
                          )}
                        </div>
                        {pageData.renderedComparison.summary && (
                          <p className="text-sm text-muted-foreground">
                            {pageData.renderedComparison.summary}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        Geen render-vergelijking beschikbaar. Schakel JavaScript rendering in bij de crawl om dit te zien.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Snapshots */}
              {pageData.snapshots.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {t("snapshots")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {pageData.snapshots.map((snapshot) => (
                          <div
                            key={snapshot.id}
                            className="flex items-center justify-between p-2 bg-muted/50 rounded"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{snapshot.source}</Badge>
                              <span className="text-sm text-muted-foreground">
                                {new Date(snapshot.createdAt).toLocaleDateString("nl-NL", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            {snapshot.sizeBytes && (
                              <span className="text-sm text-muted-foreground">
                                {formatBytes(snapshot.sizeBytes)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Technical Issues */}
              {pageData.issues.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        {t("issuesSummary")} ({pageData.issues.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {pageData.issues.map((issue) => (
                          <div
                            key={issue.id}
                            className="p-3 rounded-lg bg-muted/50 space-y-2"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant={severityVariant(issue.severity)}>
                                {severityLabel(issue.severity)}
                              </Badge>
                              <span className="text-xs text-muted-foreground font-mono">
                                {issue.ruleId}
                              </span>
                            </div>
                            <p className="text-sm">{issue.dutchExplanation}</p>
                            {issue.recommendedAction && (
                              <p className="text-xs text-muted-foreground">
                                Aanbevolen: {issue.recommendedAction}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
