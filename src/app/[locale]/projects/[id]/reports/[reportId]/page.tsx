"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  FileText,
  BarChart3,
  AlertTriangle,
  Target,
  TrendingUp,
  Plus,
  Loader2,
  GripVertical,
  Eye,
  Share2,
  CheckCircle2,
  Trash2,
  Link2,
  Calendar,
  Clock,
  Copy,
  Lock,
  MessageSquare,
  Send,
} from "lucide-react";
import { toast } from "sonner";

type ReportType = "PERFORMANCE" | "TECHNICAL" | "KEYWORD" | "CONTENT" | "COMPETITOR" | "CUSTOM";
type ReportStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "ARCHIVED";
type SectionType = "METRICS_OVERVIEW" | "TOP_QUERIES" | "TOP_PAGES" | "ISSUES_SUMMARY" | "KEYWORD_RANKINGS" | "CONTENT_ANALYSIS" | "COMPETITOR_COMPARISON" | "CUSTOM_TEXT" | "CHART";

interface ReportSection {
  id: string;
  type: SectionType;
  title: string;
  sortOrder: number;
  content: string | null;
  previewData: string | null;
}

interface ReportComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

interface ShareLink {
  id: string;
  token: string;
  password: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface ReportData {
  id: string;
  title: string;
  type: ReportType;
  status: ReportStatus;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  createdAt: string;
  updatedAt: string;
  sections: ReportSection[];
  comments: ReportComment[];
  shareLinks: ShareLink[];
}

const sectionTypeConfig: Record<SectionType, { icon: typeof FileText; label: string }> = {
  METRICS_OVERVIEW: { icon: BarChart3, label: "Metrieken overzicht" },
  TOP_QUERIES: { icon: Target, label: "Top zoekopdrachten" },
  TOP_PAGES: { icon: FileText, label: "Top pagina's" },
  ISSUES_SUMMARY: { icon: AlertTriangle, label: "Problemen samenvatting" },
  KEYWORD_RANKINGS: { icon: Target, label: "Trefwoordposities" },
  CONTENT_ANALYSIS: { icon: FileText, label: "Contentanalyse" },
  COMPETITOR_COMPARISON: { icon: TrendingUp, label: "Concurrentievergelijking" },
  CUSTOM_TEXT: { icon: FileText, label: "Eigen tekst" },
  CHART: { icon: BarChart3, label: "Grafiek" },
};

const reportTypeLabel = (type: ReportType) => {
  switch (type) {
    case "PERFORMANCE": return "Prestatierapport";
    case "TECHNICAL": return "Technisch rapport";
    case "KEYWORD": return "Trefwoordrapport";
    case "CONTENT": return "Contentrapport";
    case "COMPETITOR": return "Concurrentieanalyse";
    case "CUSTOM": return "Aangepast rapport";
    default: return type;
  }
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

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>;
}) {
  const { id: projectId, reportId } = use(params);
  const router = useRouter();

  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [addSectionDialogOpen, setAddSectionDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newSectionType, setNewSectionType] = useState<SectionType | "">("");
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSharePassword, setNewSharePassword] = useState("");
  const [newShareExpiry, setNewShareExpiry] = useState("");
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [projectId, reportId]);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/${reportId}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data.report || data);
      } else {
        toast.error("Rapport niet gevonden");
        router.push(`/projects/${projectId}/reports`);
      }
    } catch {
      toast.error("Fout bij laden rapport");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSection = async () => {
    if (!newSectionType || !newSectionTitle) {
      toast.error("Vul alle velden in");
      return;
    }

    setIsAddingSection(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/${reportId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newSectionType,
          title: newSectionTitle,
          sortOrder: (report?.sections.length || 0) + 1,
        }),
      });
      if (res.ok) {
        toast.success("Sectie toegevoegd");
        setAddSectionDialogOpen(false);
        setNewSectionType("");
        setNewSectionTitle("");
        fetchReport();
      } else {
        toast.error("Fout bij toevoegen sectie");
      }
    } catch {
      toast.error("Fout bij toevoegen sectie");
    } finally {
      setIsAddingSection(false);
    }
  };

  const handleGeneratePreview = async (sectionId: string) => {
    setActionLoading(sectionId);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/${reportId}/sections/${sectionId}/preview`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Voorbeeld gegenereerd");
        fetchReport();
      } else {
        toast.error("Fout bij genereren voorbeeld");
      }
    } catch {
      toast.error("Fout bij genereren voorbeeld");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/${reportId}/sections/${sectionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Sectie verwijderd");
        fetchReport();
      } else {
        toast.error("Fout bij verwijderen sectie");
      }
    } catch {
      toast.error("Fout bij verwijderen sectie");
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (res.ok) {
        toast.success("Rapport goedgekeurd");
        fetchReport();
      } else {
        toast.error("Fout bij goedkeuren");
      }
    } catch {
      toast.error("Fout bij goedkeuren");
    } finally {
      setIsApproving(false);
    }
  };

  const handleCreateShare = async () => {
    setIsCreatingShare(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/${reportId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: newSharePassword || null,
          expiresAt: newShareExpiry || null,
        }),
      });
      if (res.ok) {
        toast.success("Deellink aangemaakt");
        setNewSharePassword("");
        setNewShareExpiry("");
        fetchReport();
      } else {
        toast.error("Fout bij aanmaken deellink");
      }
    } catch {
      toast.error("Fout bij aanmaken deellink");
    } finally {
      setIsCreatingShare(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    setIsSubmittingComment(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/${reportId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });
      if (res.ok) {
        toast.success("Reactie geplaatst");
        setNewComment("");
        fetchReport();
      } else {
        toast.error("Fout bij plaatsen reactie");
      }
    } catch {
      toast.error("Fout bij plaatsen reactie");
    } finally {
      setIsSubmittingComment(false);
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

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" disabled>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-8 w-48 animate-pulse bg-muted rounded" />
        </div>
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-24 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!report) return null;

  const isDraft = report.status === "DRAFT";

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
          onClick={() => router.push(`/projects/${projectId}/reports`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{report.title}</h1>
            {reportStatusBadge(report.status)}
          </div>
          <p className="text-sm text-muted-foreground">
            {reportTypeLabel(report.type)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDraft && (
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={isApproving}
            >
              {isApproving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Goedkeuren
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShareDialogOpen(true)}
          >
            <Share2 className="mr-2 h-4 w-4" />
            Delen
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
            {(report.dateRangeStart || report.dateRangeEnd) && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(report.dateRangeStart)} — {formatDate(report.dateRangeEnd)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Aangemaakt: {formatDate(report.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Laatst bijgewerkt: {formatDate(report.updatedAt)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Secties ({report.sections.length})
          </h3>
          {isDraft && (
            <Dialog open={addSectionDialogOpen} onOpenChange={setAddSectionDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Sectie toevoegen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Sectie toevoegen</DialogTitle>
                  <DialogDescription>
                    Voeg een nieuwe sectie toe aan je rapport
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={newSectionType}
                      onValueChange={(val) => setNewSectionType(val as SectionType)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteer type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(sectionTypeConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Titel</Label>
                    <Input
                      placeholder="Bijv. Overzicht zoekprestaties"
                      value={newSectionTitle}
                      onChange={(e) => setNewSectionTitle(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddSectionDialogOpen(false)}>
                    Annuleren
                  </Button>
                  <Button
                    onClick={handleAddSection}
                    disabled={isAddingSection || !newSectionType || !newSectionTitle}
                  >
                    {isAddingSection && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Toevoegen
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {report.sections.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                Nog geen secties. Voeg secties toe om je rapport op te bouwen.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {report.sections
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((section) => {
                const secConfig = sectionTypeConfig[section.type];
                const SecIcon = secConfig.icon;
                const isLoadingPreview = actionLoading === section.id;

                return (
                  <Card key={section.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {isDraft && (
                          <GripVertical className="h-5 w-5 text-muted-foreground/40 shrink-0 mt-0.5 cursor-grab" />
                        )}
                        <SecIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm">{section.title}</h4>
                          <Badge variant="outline" className="text-[10px] h-5 mt-1">
                            {secConfig.label}
                          </Badge>
                          {section.previewData && (
                            <div className="mt-3 p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
                              {section.previewData}
                            </div>
                          )}
                          {section.content && section.type === "CUSTOM_TEXT" && (
                            <div className="mt-3 p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                              {section.content}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Voorbeeld genereren"
                            onClick={() => handleGeneratePreview(section.id)}
                            disabled={isLoadingPreview}
                          >
                            {isLoadingPreview ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          {isDraft && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                              title="Verwijderen"
                              onClick={() => handleDeleteSection(section.id)}
                            >
                              <Trash2 className="h-4 w-4" />
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
      </div>

      <Separator />

      {/* Comments Section */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Reacties ({report.comments?.length || 0})
        </h3>

        <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
          {report.comments && report.comments.length > 0 ? (
            report.comments.map((comment) => (
              <Card key={comment.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">{comment.author}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleDateString("nl-NL", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm">{comment.content}</p>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nog geen reacties
            </p>
          )}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Textarea
              placeholder="Schrijf een reactie..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={2}
            />
          </div>
          <Button
            size="sm"
            onClick={handleSubmitComment}
            disabled={!newComment.trim() || isSubmittingComment}
          >
            {isSubmittingComment ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rapport delen</DialogTitle>
            <DialogDescription>
              Maak een deellink aan om dit rapport met anderen te delen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Existing share links */}
            {report.shareLinks && report.shareLinks.length > 0 && (
              <div className="space-y-2">
                <Label>Bestaande deellinks</Label>
                {report.shareLinks.map((link) => (
                  <div key={link.id} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                    <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate flex-1">
                      {typeof window !== "undefined"
                        ? `${window.location.origin}/shared/reports/${link.token}`
                        : `/shared/reports/${link.token}`}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/shared/reports/${link.token}`
                        );
                        toast.success("Link gekopieerd");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="share-password">Wachtwoord (optioneel)</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="share-password"
                  placeholder="Optioneel wachtwoord"
                  value={newSharePassword}
                  onChange={(e) => setNewSharePassword(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="share-expiry">Vervaldatum (optioneel)</Label>
              <Input
                id="share-expiry"
                type="date"
                value={newShareExpiry}
                onChange={(e) => setNewShareExpiry(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
              Sluiten
            </Button>
            <Button onClick={handleCreateShare} disabled={isCreatingShare}>
              {isCreatingShare && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Link aanmaken
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
