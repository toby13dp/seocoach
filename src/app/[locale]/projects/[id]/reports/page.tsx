"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  FileText,
  BarChart3,
  AlertTriangle,
  Target,
  TrendingUp,
  Loader2,
  Eye,
  Share2,
  CheckCircle2,
  Archive,
  Calendar,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

type ReportType = "PERFORMANCE" | "TECHNICAL" | "KEYWORD" | "CONTENT" | "COMPETITOR" | "CUSTOM";
type ReportStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "ARCHIVED";

interface ReportEntry {
  id: string;
  title: string;
  type: ReportType;
  status: ReportStatus;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

const reportTypeConfig: Record<ReportType, { icon: typeof FileText; label: string; description: string; color: string }> = {
  PERFORMANCE: {
    icon: BarChart3,
    label: "Prestatierapport",
    description: "Overzicht van zoekprestaties, kliks en weergaven",
    color: "text-emerald-600",
  },
  TECHNICAL: {
    icon: AlertTriangle,
    label: "Technisch rapport",
    description: "Technische SEO-problemen en aanbevelingen",
    color: "text-orange-600",
  },
  KEYWORD: {
    icon: Target,
    label: "Trefwoordrapport",
    description: "Trefwoordposities en kansen",
    color: "text-purple-600",
  },
  CONTENT: {
    icon: FileText,
    label: "Contentrapport",
    description: "Contentkwaliteit en optimalisaties",
    color: "text-blue-600",
  },
  COMPETITOR: {
    icon: TrendingUp,
    label: "Concurrentieanalyse",
    description: "Vergelijking met concurrenten",
    color: "text-rose-600",
  },
  CUSTOM: {
    icon: FileText,
    label: "Aangepast rapport",
    description: "Zelf samen te stellen rapport",
    color: "text-gray-600",
  },
};

const reportStatusBadge = (status: ReportStatus) => {
  switch (status) {
    case "DRAFT":
      return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300">Concept</Badge>;
    case "IN_REVIEW":
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">In review</Badge>;
    case "APPROVED":
      return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">Goedgekeurd</Badge>;
    case "PUBLISHED":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Gepubliceerd</Badge>;
    case "ARCHIVED":
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">Gearchiveerd</Badge>;
    default:
      return <Badge className="bg-muted text-muted-foreground">{status}</Badge>;
  }
};

export default function ReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newReport, setNewReport] = useState({
    title: "",
    type: "" as ReportType | "",
    dateRangeStart: "",
    dateRangeEnd: "",
  });

  useEffect(() => {
    fetchReports();
  }, [projectId]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch {
      // Silently handle
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newReport.title || !newReport.type) {
      toast.error("Vul alle verplichte velden in");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newReport.title,
          type: newReport.type,
          dateRangeStart: newReport.dateRangeStart || null,
          dateRangeEnd: newReport.dateRangeEnd || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success("Rapport aangemaakt");
        setCreateDialogOpen(false);
        setNewReport({ title: "", type: "", dateRangeStart: "", dateRangeEnd: "" });
        router.push(`/projects/${projectId}/reports/${data.report?.id}`);
      } else {
        toast.error("Fout bij aanmaken rapport");
      }
    } catch {
      toast.error("Fout bij aanmaken rapport");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAction = async (reportId: string, action: string) => {
    setActionLoading(reportId);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const actionLabels: Record<string, string> = {
          approve: "Rapport goedgekeurd",
          archive: "Rapport gearchiveerd",
          publish: "Rapport gepubliceerd",
        };
        toast.success(actionLabels[action] || "Actie uitgevoerd");
        fetchReports();
      } else {
        toast.error("Actie mislukt");
      }
    } catch {
      toast.error("Fout bij uitvoeren actie");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
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
          <h1 className="text-2xl font-bold tracking-tight">Rapporten</h1>
          <p className="text-sm text-muted-foreground">
            Maak en beheer je SEO-rapporten
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nieuw rapport
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nieuw rapport aanmaken</DialogTitle>
              <DialogDescription>
                Kies het type rapport en geef het een naam
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="report-title">Naam</Label>
                <Input
                  id="report-title"
                  placeholder="Bijv. Maandelijks prestatierapport"
                  value={newReport.title}
                  onChange={(e) => setNewReport({ ...newReport, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-type">Type</Label>
                <Select
                  value={newReport.type}
                  onValueChange={(val) => setNewReport({ ...newReport, type: val as ReportType })}
                >
                  <SelectTrigger id="report-type">
                    <SelectValue placeholder="Selecteer type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(reportTypeConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="report-start">Startdatum</Label>
                  <Input
                    id="report-start"
                    type="date"
                    value={newReport.dateRangeStart}
                    onChange={(e) => setNewReport({ ...newReport, dateRangeStart: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-end">Einddatum</Label>
                  <Input
                    id="report-end"
                    type="date"
                    value={newReport.dateRangeEnd}
                    onChange={(e) => setNewReport({ ...newReport, dateRangeEnd: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Annuleren
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isCreating || !newReport.title || !newReport.type}
              >
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Aanmaken
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Report Type Cards */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Rapporttypen</h3>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {Object.entries(reportTypeConfig).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <Card
                key={key}
                className="hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => {
                  setNewReport({ ...newReport, type: key as ReportType });
                  setCreateDialogOpen(true);
                }}
              >
                <CardContent className="p-4 text-center">
                  <Icon className={`h-6 w-6 mx-auto mb-2 ${config.color}`} />
                  <p className="text-sm font-medium">{config.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Reports List */}
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
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Geen rapporten</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                Maak je eerste rapport aan om je SEO-resultaten inzichtelijk te maken.
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nieuw rapport
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[calc(100vh-420px)] overflow-y-auto">
          {reports.map((report) => {
            const typeConfig = reportTypeConfig[report.type];
            const TypeIcon = typeConfig.icon;
            const isActionLoading = actionLoading === report.id;

            return (
              <Card key={report.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <TypeIcon className={`h-5 w-5 shrink-0 mt-0.5 ${typeConfig.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Link href={`/projects/${projectId}/reports/${report.id}`}>
                          <h4 className="font-medium text-sm hover:underline cursor-pointer">
                            {report.title}
                          </h4>
                        </Link>
                        {reportStatusBadge(report.status)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {typeConfig.label}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        {(report.dateRangeStart || report.dateRangeEnd) && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(report.dateRangeStart)} — {formatDate(report.dateRangeEnd)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Aangemaakt: {formatDate(report.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Link href={`/projects/${projectId}/reports/${report.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Bekijken">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Delen"
                        onClick={() => toast.info("Deelfunctie beschikbaar in het rapport")}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      {report.status === "DRAFT" || report.status === "IN_REVIEW" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Goedkeuren"
                          onClick={() => handleAction(report.id, "approve")}
                          disabled={isActionLoading}
                        >
                          {isActionLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                        </Button>
                      ) : null}
                      {report.status !== "ARCHIVED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Archiveren"
                          onClick={() => handleAction(report.id, "archive")}
                          disabled={isActionLoading}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
