"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "@/i18n/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
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
  Loader2,
  Globe,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Bug,
  Ban,
} from "lucide-react";
import { toast } from "sonner";

interface CrawlSession {
  id: string;
  status: string;
  startUrl: string;
  maxPages: number;
  maxDepth: number;
  pagesCrawled: number;
  pagesFound: number;
  issuesFound: number;
  errorCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  websiteUrl: string | null;
}

export default function CrawlsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations("crawl");
  const tCommon = useTranslations("common");

  const [project, setProject] = useState<Project | null>(null);
  const [crawls, setCrawls] = useState<CrawlSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Crawl form
  const [startUrl, setStartUrl] = useState("");
  const [maxPages, setMaxPages] = useState(500);
  const [maxDepth, setMaxDepth] = useState(10);
  const [crawlDelay, setCrawlDelay] = useState(1000);
  const [respectRobots, setRespectRobots] = useState(true);
  const [includeSubdomains, setIncludeSubdomains] = useState(false);
  const [useRendering, setUseRendering] = useState(false);

  const fetchCrawls = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/crawls`);
      if (res.ok) {
        const data = await res.json();
        setCrawls(data.data || []);
      }
    } catch {
      // silently fail
    }
  }, [id]);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        if (data.project?.websiteUrl) {
          setStartUrl(data.project.websiteUrl);
        }
      }
    } catch {
      // silently fail
    }
  }, [id]);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      await Promise.all([fetchProject(), fetchCrawls()]);
      setIsLoading(false);
    }
    init();
  }, [fetchProject, fetchCrawls]);

  // Poll running crawls every 3 seconds
  useEffect(() => {
    const hasRunning = crawls.some(
      (c) => c.status === "RUNNING" || c.status === "PENDING"
    );
    if (!hasRunning) return;

    const interval = setInterval(fetchCrawls, 3000);
    return () => clearInterval(interval);
  }, [crawls, fetchCrawls]);

  const handleStartCrawl = async () => {
    setIsStarting(true);
    try {
      const res = await fetch(`/api/projects/${id}/crawls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUrl,
          maxPages,
          maxDepth,
          crawlDelayMs: crawlDelay,
          respectRobotsTxt: respectRobots,
          includeSubdomains,
          useRendering,
        }),
      });
      if (res.ok) {
        toast.success(t("crawlStarted"));
        setDialogOpen(false);
        fetchCrawls();
      } else {
        const data = await res.json();
        toast.error(data.error || t("crawlStartError"));
      }
    } catch {
      toast.error(t("crawlStartError"));
    } finally {
      setIsStarting(false);
    }
  };

  const handleCancelCrawl = async (crawlId: string) => {
    try {
      const res = await fetch(`/api/projects/${id}/crawls/${crawlId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(t("crawlCancelled"));
        fetchCrawls();
      } else {
        toast.error(t("crawlCancelError"));
      }
    } catch {
      toast.error(t("crawlCancelError"));
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "RUNNING":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "FAILED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "CANCELLED":
        return <Ban className="h-4 w-4 text-gray-400" />;
      case "PAUSED":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "PENDING": return t("pending");
      case "RUNNING": return t("running");
      case "COMPLETED": return t("completed");
      case "FAILED": return t("failed");
      case "CANCELLED": return t("cancelled");
      case "PAUSED": return t("paused");
      default: return status;
    }
  };

  const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "COMPLETED": return "default";
      case "RUNNING": return "secondary";
      case "FAILED": return "destructive";
      default: return "outline";
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getProgress = (crawl: CrawlSession) => {
    if (crawl.status === "COMPLETED") return 100;
    if (crawl.maxPages > 0) {
      return Math.min(100, Math.round((crawl.pagesCrawled / crawl.maxPages) * 100));
    }
    return 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
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
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            {project && (
              <p className="text-sm text-muted-foreground">{project.name}</p>
            )}
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-2" />
                {t("startNew")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{t("startNew")}</DialogTitle>
                <DialogDescription>
                  Configureer de instellingen voor de nieuwe crawl.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="startUrl">{t("startUrl")}</Label>
                  <Input
                    id="startUrl"
                    value={startUrl}
                    onChange={(e) => setStartUrl(e.target.value)}
                    placeholder={t("startUrlPlaceholder")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="maxPages">{t("maxPages")}</Label>
                    <Input
                      id="maxPages"
                      type="number"
                      value={maxPages}
                      onChange={(e) => setMaxPages(parseInt(e.target.value) || 500)}
                      min={1}
                      max={10000}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="maxDepth">{t("maxDepth")}</Label>
                    <Input
                      id="maxDepth"
                      type="number"
                      value={maxDepth}
                      onChange={(e) => setMaxDepth(parseInt(e.target.value) || 10)}
                      min={1}
                      max={50}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="crawlDelay">{t("crawlDelay")}</Label>
                  <Input
                    id="crawlDelay"
                    type="number"
                    value={crawlDelay}
                    onChange={(e) => setCrawlDelay(parseInt(e.target.value) || 1000)}
                    min={100}
                    max={10000}
                    step={100}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="respectRobots">{t("respectRobots")}</Label>
                  <Switch
                    id="respectRobots"
                    checked={respectRobots}
                    onCheckedChange={setRespectRobots}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="includeSubdomains">{t("includeSubdomains")}</Label>
                  <Switch
                    id="includeSubdomains"
                    checked={includeSubdomains}
                    onCheckedChange={setIncludeSubdomains}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="useRendering">{t("useRendering")}</Label>
                    <Switch
                      id="useRendering"
                      checked={useRendering}
                      onCheckedChange={setUseRendering}
                    />
                  </div>
                  {useRendering && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {t("renderingWarning")}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  {tCommon("cancel")}
                </Button>
                <Button
                  onClick={handleStartCrawl}
                  disabled={isStarting || !startUrl}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {isStarting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t("startNew")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* Crawl list */}
        {crawls.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Bug className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t("noCrawls")}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("noCrawlsDesc")}
                </p>
                <Button
                  onClick={() => setDialogOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("startNew")}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {crawls.map((crawl, index) => (
              <motion.div
                key={crawl.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(`/projects/${id}/inventory?crawlSessionId=${crawl.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {statusIcon(crawl.status)}
                        <CardTitle className="text-base font-medium">
                          {crawl.startUrl}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant(crawl.status)}>
                          {statusLabel(crawl.status)}
                        </Badge>
                        {(crawl.status === "RUNNING" || crawl.status === "PENDING") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelCrawl(crawl.id);
                            }}
                          >
                            <Ban className="h-3 w-3 mr-1" />
                            {t("cancelCrawl")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Progress bar for running/pending */}
                    {(crawl.status === "RUNNING" || crawl.status === "PENDING") && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">{t("progress")}</span>
                          <span className="font-medium">{getProgress(crawl)}%</span>
                        </div>
                        <Progress value={getProgress(crawl)} className="h-2" />
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">{t("pagesCrawled")}</p>
                        <p className="font-medium">{crawl.pagesCrawled} / {crawl.maxPages}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("pagesFound")}</p>
                        <p className="font-medium">{crawl.pagesFound}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("issuesFound")}</p>
                        <p className="font-medium text-orange-600 dark:text-orange-400">
                          {crawl.issuesFound}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("errors")}</p>
                        <p className="font-medium text-red-600 dark:text-red-400">
                          {crawl.errorCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("startedAt")}</p>
                        <p className="font-medium">{formatDate(crawl.startedAt)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("completedAt")}</p>
                        <p className="font-medium">{formatDate(crawl.completedAt)}</p>
                      </div>
                    </div>

                    {crawl.errorMessage && (
                      <div className="mt-3 p-2 bg-red-50 dark:bg-red-950/20 rounded text-sm text-red-600 dark:text-red-400">
                        {crawl.errorMessage}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
