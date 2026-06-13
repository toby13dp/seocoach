"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  Link2,
  Plus,
  MousePointerClick,
  Eye,
  TrendingUp,
  Target,
  Clock,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface DataConnection {
  id: string;
  name: string;
  type: string;
  status: string;
  lastSync: string | null;
}

interface SearchMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  clicksChange: number | null;
  impressionsChange: number | null;
  ctrChange: number | null;
  positionChange: number | null;
}

interface TopQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface TopPage {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export default function AnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [connections, setConnections] = useState<DataConnection[]>([]);
  const [metrics, setMetrics] = useState<SearchMetrics | null>(null);
  const [topQueries, setTopQueries] = useState<TopQuery[]>([]);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [dataRange, setDataRange] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalyticsData();
  }, [projectId]);

  const fetchAnalyticsData = async () => {
    setIsLoading(true);
    try {
      const connRes = await fetch(`/api/projects/${projectId}/analytics/connections`);
      if (connRes.ok) {
        const connData = await connRes.json();
        setConnections(connData.connections || []);
        if (connData.lastSync) setLastSync(connData.lastSync);
        if (connData.dataRange) setDataRange(connData.dataRange);
      }

      const metricsRes = await fetch(`/api/projects/${projectId}/analytics/metrics`);
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      }

      const queriesRes = await fetch(`/api/projects/${projectId}/analytics/queries`);
      if (queriesRes.ok) {
        const queriesData = await queriesRes.json();
        setTopQueries(queriesData.queries || []);
      }

      const pagesRes = await fetch(`/api/projects/${projectId}/analytics/pages`);
      if (pagesRes.ok) {
        const pagesData = await pagesRes.json();
        setTopPages(pagesData.pages || []);
      }
    } catch {
      // Silently handle — data will show empty states
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAnalyticsData();
    setIsRefreshing(false);
    toast.success("Gegevens vernieuwd");
  };

  const hasData = metrics !== null && metrics.clicks > 0;

  const formatChange = (change: number | null) => {
    if (change === null) return null;
    const isPositive = change >= 0;
    return (
      <span
        className={`text-xs font-medium ${
          isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        }`}
      >
        {isPositive ? "↑" : "↓"} {Math.abs(change).toFixed(1)}%
      </span>
    );
  };

  const connectionStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">Actief</Badge>;
      case "INACTIVE":
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300">Inactief</Badge>;
      case "ERROR":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Fout</Badge>;
      case "SYNCING":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">Synchroniseren</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground">{status}</Badge>;
    }
  };

  const connectionTypeLabel = (type: string) => {
    switch (type) {
      case "GOOGLE_SEARCH_CONSOLE": return "Google Search Console";
      case "GOOGLE_ANALYTICS_4": return "Google Analytics 4";
      case "CSV_UPLOAD": return "CSV-upload";
      default: return type;
    }
  };

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return "Nooit";
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
          <h1 className="text-2xl font-bold tracking-tight">Zoekprestaties</h1>
          <p className="text-sm text-muted-foreground">
            Inzicht in je zoekresultaten en prestaties
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Vernieuwen
          </Button>
          <Link href={`/projects/${projectId}/analytics/connections`}>
            <Button variant="outline" size="sm">
              <Link2 className="mr-2 h-4 w-4" />
              Gegevensbronnen
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Data Freshness & Connections Summary */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Gegevensverversing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Laatste synchronisatie</span>
                    <span className="font-medium">{lastSync ? formatTimeAgo(lastSync) : "— —"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Periode</span>
                    <span className="font-medium">{dataRange || "— —"}</span>
                  </div>
                  {connections.length === 0 && (
                    <p className="text-amber-600 dark:text-amber-400 text-xs mt-2 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Geen gegevensbron gekoppeld — gegevens worden niet bijgewerkt
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    Gegevensbronnen
                  </CardTitle>
                  <Link href={`/projects/${projectId}/analytics/connections`}>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      Beheren
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {connections.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                      Koppel een gegevensbron om te beginnen met het volgen van je zoekprestaties.
                    </p>
                    <Link href={`/projects/${projectId}/analytics/connections`}>
                      <Button size="sm" className="mt-3">
                        <Plus className="mr-2 h-4 w-4" />
                        Bron toevoegen
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {connections.map((conn) => (
                      <div
                        key={conn.id}
                        className="flex items-center justify-between py-1.5 border-b last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{conn.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {connectionTypeLabel(conn.type)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {connectionStatusBadge(conn.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Key Metrics */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Kliks</span>
                  <MousePointerClick className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold">
                  {hasData ? metrics.clicks.toLocaleString("nl-NL") : "— —"}
                </div>
                {hasData && formatChange(metrics.clicksChange)}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Weergaven</span>
                  <Eye className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold">
                  {hasData ? metrics.impressions.toLocaleString("nl-NL") : "— —"}
                </div>
                {hasData && formatChange(metrics.impressionsChange)}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">CTR</span>
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold">
                  {hasData ? `${metrics.ctr.toFixed(1)}%` : "— —"}
                </div>
                {hasData && formatChange(metrics.ctrChange)}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Positie</span>
                  <Target className="h-4 w-4 text-purple-600" />
                </div>
                <div className="text-2xl font-bold">
                  {hasData ? metrics.position.toFixed(1) : "— —"}
                </div>
                {hasData && formatChange(metrics.positionChange)}
              </CardContent>
            </Card>
          </div>

          {/* Top Queries & Top Pages */}
          {hasData ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top zoekopdrachten</CardTitle>
                  <CardDescription>
                    Meest voorkomende zoekopdrachten die naar je site leiden
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {topQueries.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Zoekopdracht</TableHead>
                          <TableHead className="text-right">Kliks</TableHead>
                          <TableHead className="text-right">Weergaven</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">Pos.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topQueries.slice(0, 10).map((q, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium text-sm">{q.query}</TableCell>
                            <TableCell className="text-right text-sm">{q.clicks.toLocaleString("nl-NL")}</TableCell>
                            <TableCell className="text-right text-sm">{q.impressions.toLocaleString("nl-NL")}</TableCell>
                            <TableCell className="text-right text-sm">{q.ctr.toFixed(1)}%</TableCell>
                            <TableCell className="text-right text-sm">{q.position.toFixed(1)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Nog geen zoekopdrachtgegevens beschikbaar
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Beste bestemmingspagina&apos;s</CardTitle>
                  <CardDescription>
                    Pagina&apos;s met de meeste zoekresultaat-kliks
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {topPages.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>URL</TableHead>
                          <TableHead className="text-right">Kliks</TableHead>
                          <TableHead className="text-right">Weergaven</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">Pos.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topPages.slice(0, 10).map((p, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium text-sm max-w-[200px] truncate" title={p.url}>
                              {p.url.replace(/^https?:\/\/[^/]+/, "")}
                            </TableCell>
                            <TableCell className="text-right text-sm">{p.clicks.toLocaleString("nl-NL")}</TableCell>
                            <TableCell className="text-right text-sm">{p.impressions.toLocaleString("nl-NL")}</TableCell>
                            <TableCell className="text-right text-sm">{p.ctr.toFixed(1)}%</TableCell>
                            <TableCell className="text-right text-sm">{p.position.toFixed(1)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Nog geen paginagegevens beschikbaar
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nog geen prestatiegegevens</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                    Koppel een gegevensbron zoals Google Search Console om je zoekprestaties te bekijken.
                  </p>
                  <Link href={`/projects/${projectId}/analytics/connections`}>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Gegevensbron toevoegen
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </motion.div>
  );
}
