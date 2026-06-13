"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Save,
  Sparkles,
  BarChart3,
  Send,
  CheckCircle2,
  GripVertical,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

// Types
interface OutlineItem {
  id: string;
  heading: string;
  level: number;
  keyPoints: string[];
}

interface ContentVersion {
  id: string;
  version: number;
  content: string;
  wordCount: number;
  changeSummary: string | null;
  aiGenerated: boolean;
  claimMarkers: string | null;
  createdAt: string;
}

interface QualityScore {
  intentScore: number;
  coverageScore: number;
  readabilityScore: number;
  originalityScore: number;
  brandConsistencyScore: number;
  eeatScore: number;
  internalLinkScore: number;
  entityScore: number;
  conversionScore: number;
  geoReadinessScore: number;
  publicationReadinessScore: number;
  overallScore: number;
  recommendations: string | null;
  details: string | null;
}

interface Brief {
  id: string;
  title: string;
  targetKeyword: string | null;
  secondaryKeywords: string | null;
  searchIntent: string;
  funnelStage: string;
  outline: string | null;
  approvalStatus: string;
  targetWordCount: number | null;
  targetAudience: string | null;
  toneOfVoice: string | null;
  versions: ContentVersion[];
  quality: QualityScore | null;
  createdAt: string;
  updatedAt: string;
}

const QUALITY_DIMENSIONS = [
  { key: "intentScore", label: "Intentie" },
  { key: "coverageScore", label: "Dekking" },
  { key: "readabilityScore", label: "Leesbaarheid" },
  { key: "originalityScore", label: "Originaliteit" },
  { key: "brandConsistencyScore", label: "Merkconsistentie" },
  { key: "eeatScore", label: "E-E-A-T" },
  { key: "internalLinkScore", label: "Interne links" },
  { key: "entityScore", label: "Entiteiten" },
  { key: "conversionScore", label: "Conversie" },
  { key: "geoReadinessScore", label: "GEO-gereedheid" },
  { key: "publicationReadinessScore", label: "Publicatiegereedheid" },
] as const;

function generateId() {
  return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default function ContentStudioPage({
  params,
}: {
  params: Promise<{ id: string; briefId: string }>;
}) {
  const { id: projectId, briefId } = use(params);
  const router = useRouter();

  const [brief, setBrief] = useState<Brief | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Editable fields
  const [title, setTitle] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [secondaryKeywords, setSecondaryKeywords] = useState("");
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [content, setContent] = useState("");
  const [selectedVersion, setSelectedVersion] = useState<number>(0);
  const [showDiff, setShowDiff] = useState(false);

  // Approval dialog
  const [showApproveDialog, setShowApproveDialog] = useState(false);

  const fetchBrief = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/briefs/${briefId}`);
      if (res.ok) {
        const data = await res.json();
        const briefData = data.data;
        setBrief(briefData);
        setTitle(briefData.title || "");
        setTargetKeyword(briefData.targetKeyword || "");
        setSecondaryKeywords(
          Array.isArray(briefData.secondaryKeywords)
            ? briefData.secondaryKeywords.join(", ")
            : briefData.secondaryKeywords
            ? JSON.parse(briefData.secondaryKeywords).join(", ")
            : ""
        );

        // Parse outline
        if (briefData.outline) {
          try {
            const parsed =
              typeof briefData.outline === "string"
                ? JSON.parse(briefData.outline)
                : briefData.outline;
            if (Array.isArray(parsed)) {
              setOutline(parsed);
            }
          } catch {
            setOutline([]);
          }
        }

        // Set content from latest version
        if (briefData.versions && briefData.versions.length > 0) {
          const latestVersion =
            briefData.versions[briefData.versions.length - 1];
          setContent(latestVersion.content || "");
          setSelectedVersion(latestVersion.version);
        }
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [projectId, briefId]);

  useEffect(() => {
    fetchBrief();
  }, [fetchBrief]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/briefs/${briefId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          targetKeyword: targetKeyword || undefined,
          secondaryKeywords: secondaryKeywords
            ? secondaryKeywords.split(",").map((k) => k.trim())
            : undefined,
          outline: outline.length > 0 ? outline : undefined,
        }),
      });
      if (res.ok) {
        toast.success("Brief opgeslagen");
        fetchBrief();
      } else {
        toast.error("Fout bij opslaan");
      }
    } catch {
      toast.error("Fout bij opslaan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateOutline = async () => {
    setIsGeneratingOutline(true);
    try {
      // Simulate outline generation with AI
      const generatedOutline: OutlineItem[] = [
        {
          id: generateId(),
          heading: "Inleiding",
          level: 2,
          keyPoints: ["Probleemstelling", "Belang van het onderwerp"],
        },
        {
          id: generateId(),
          heading: "Wat is " + (targetKeyword || "dit onderwerp") + "?",
          level: 2,
          keyPoints: ["Definitie", "Kernconcepten", "Achtergrond"],
        },
        {
          id: generateId(),
          heading: "Voordelen en toepassingen",
          level: 2,
          keyPoints: ["Praktische toepassingen", "Meetbare resultaten"],
        },
        {
          id: generateId(),
          heading: "Stap-voor-stap aanpak",
          level: 2,
          keyPoints: ["Voorbereiding", "Uitvoering", "Evaluatie"],
        },
        {
          id: generateId(),
          heading: "Veelgemaakte fouten",
          level: 2,
          keyPoints: ["Te vermijden valkuilen", "Best practices"],
        },
        {
          id: generateId(),
          heading: "Conclusie",
          level: 2,
          keyPoints: ["Samenvatting", "Volgende stappen", "Call-to-action"],
        },
      ];
      setOutline(generatedOutline);
      toast.success("Outline gegenereerd");
    } catch {
      toast.error("Fout bij genereren outline");
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleGenerateDraft = async () => {
    setIsGeneratingDraft(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/briefs/${briefId}/draft`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            outline,
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        toast.success("Concept gegenereerd");
        fetchBrief();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Fout bij genereren concept");
      }
    } catch {
      toast.error("Fout bij genereren concept");
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleQualityAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/briefs/${briefId}/quality`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );
      if (res.ok) {
        toast.success("Kwaliteitsanalyse voltooid");
        fetchBrief();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Fout bij kwaliteitsanalyse");
      }
    } catch {
      toast.error("Fout bij kwaliteitsanalyse");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitForReview = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/briefs/${briefId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: "IN_REVIEW" }),
      });
      if (res.ok) {
        toast.success("Ter beoordeling ingediend");
        fetchBrief();
      } else {
        toast.error("Fout bij indienen");
      }
    } catch {
      toast.error("Fout bij indienen");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/briefs/${briefId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve: true }),
      });
      if (res.ok) {
        toast.success("Brief goedgekeurd");
        fetchBrief();
      } else {
        toast.error("Fout bij goedkeuren");
      }
    } catch {
      toast.error("Fout bij goedkeuren");
    } finally {
      setIsApproving(false);
      setShowApproveDialog(false);
    }
  };

  // Outline editing functions
  const addOutlineItem = () => {
    setOutline([
      ...outline,
      { id: generateId(), heading: "", level: 2, keyPoints: [] },
    ]);
  };

  const removeOutlineItem = (id: string) => {
    setOutline(outline.filter((item) => item.id !== id));
  };

  const updateOutlineItem = (
    id: string,
    field: keyof OutlineItem,
    value: string | number | string[]
  ) => {
    setOutline(
      outline.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const moveOutlineItem = (index: number, direction: "up" | "down") => {
    const newOutline = [...outline];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOutline.length) return;
    [newOutline[index], newOutline[targetIndex]] = [
      newOutline[targetIndex],
      newOutline[index],
    ];
    setOutline(newOutline);
  };

  const addKeyPoint = (itemId: string) => {
    setOutline(
      outline.map((item) =>
        item.id === itemId
          ? { ...item, keyPoints: [...item.keyPoints, ""] }
          : item
      )
    );
  };

  const updateKeyPoint = (itemId: string, index: number, value: string) => {
    setOutline(
      outline.map((item) =>
        item.id === itemId
          ? {
              ...item,
              keyPoints: item.keyPoints.map((kp, i) =>
                i === index ? value : kp
              ),
            }
          : item
      )
    );
  };

  const removeKeyPoint = (itemId: string, index: number) => {
    setOutline(
      outline.map((item) =>
        item.id === itemId
          ? {
              ...item,
              keyPoints: item.keyPoints.filter((_, i) => i !== index),
            }
          : item
      )
    );
  };

  // Version handling
  const handleVersionChange = (version: number) => {
    setSelectedVersion(version);
    const found = brief?.versions?.find((v) => v.version === version);
    if (found) {
      setContent(found.content || "");
    }
  };

  const wordCount = content
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  const statusLabel = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "Concept";
      case "IN_REVIEW":
        return "In beoordeling";
      case "APPROVED":
        return "Goedgekeurd";
      case "PUBLISHED":
        return "Gepubliceerd";
      case "ARCHIVED":
        return "Gearchiveerd";
      default:
        return status;
    }
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
      case "IN_REVIEW":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800";
      case "APPROVED":
        return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800";
      case "PUBLISHED":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
      case "ARCHIVED":
        return "bg-gray-200 text-gray-600 border-gray-300 dark:bg-gray-900/50 dark:text-gray-500 dark:border-gray-700";
      default:
        return "";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
  };

  const getOverallScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    if (score >= 40) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const renderDiffContent = () => {
    if (!showDiff || !brief?.versions || brief.versions.length < 2) {
      return content;
    }
    const currentVersion = brief.versions.find(
      (v) => v.version === selectedVersion
    );
    const prevVersion = brief.versions.find(
      (v) => v.version === selectedVersion - 1
    );
    if (!currentVersion || !prevVersion) return content;

    // Simple diff visualization
    const currentLines = (currentVersion.content || "").split("\n");
    const prevLines = (prevVersion.content || "").split("\n");

    return currentLines
      .map((line, i) => {
        if (i < prevLines.length && line !== prevLines[i]) {
          return `[-] ${prevLines[i]}\n[+] ${line}`;
        }
        if (i >= prevLines.length) {
          return `[+] ${line}`;
        }
        return line;
      })
      .join("\n");
  };

  const parseRecommendations = (
    recs: string | null | undefined
  ): string[] => {
    if (!recs) return [];
    try {
      const parsed = typeof recs === "string" ? JSON.parse(recs) : recs;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const highlightVerificationNeeded = (text: string) => {
    return text.replace(
      /\[VERIFICATIE_NODIG\]/g,
      '<mark class="bg-yellow-200 dark:bg-yellow-800 px-1 rounded text-yellow-900 dark:text-yellow-100 font-medium">[VERIFICATIE_NODIG]</mark>'
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="p-4 md:p-6">
        <Button
          variant="ghost"
          onClick={() => router.push(`/projects/${projectId}/briefs`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Terug
        </Button>
        <p className="text-muted-foreground mt-4">Brief niet gevonden</p>
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/projects/${projectId}/briefs`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              Content Studio
            </h1>
            <Badge
              variant="outline"
              className={statusBadgeClass(brief.approvalStatus)}
            >
              {statusLabel(brief.approvalStatus)}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">{brief.title}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {brief.approvalStatus === "DRAFT" && (
            <Button
              variant="outline"
              onClick={handleSubmitForReview}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Ter beoordeling indienen
            </Button>
          )}
          {brief.approvalStatus === "IN_REVIEW" && (
            <Button
              onClick={() => setShowApproveDialog(true)}
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
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Opslaan
          </Button>
        </div>
      </div>

      {/* Main Layout - Two Panels */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        {/* Left Panel - Brief Details & Outline */}
        <div className="space-y-6">
          {/* Brief Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Briefgegevens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Titel</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Doeltrefwoord</Label>
                <Input
                  value={targetKeyword}
                  onChange={(e) => setTargetKeyword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Secundaire trefwoorden</Label>
                <Input
                  value={secondaryKeywords}
                  onChange={(e) => setSecondaryKeywords(e.target.value)}
                  placeholder="Komma-gescheiden"
                />
              </div>
              {brief.targetWordCount && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Doelwoordental:</span>
                  <span className="font-medium">{brief.targetWordCount}</span>
                </div>
              )}
              {brief.targetAudience && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Doelgroep:</span>
                  <span className="font-medium">{brief.targetAudience}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Outline Editor */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Outline</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateOutline}
                    disabled={isGeneratingOutline}
                  >
                    {isGeneratingOutline ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-3 w-3" />
                    )}
                    Genereren
                  </Button>
                  <Button variant="outline" size="sm" onClick={addOutlineItem}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {outline.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Geen outline-items. Klik op &quot;Genereren&quot; voor een
                  AI-voorstel of voeg items handmatig toe.
                </p>
              ) : (
                outline.map((item, index) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Select
                        value={String(item.level)}
                        onValueChange={(val) =>
                          updateOutlineItem(item.id, "level", parseInt(val))
                        }
                      >
                        <SelectTrigger className="w-20 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">H1</SelectItem>
                          <SelectItem value="2">H2</SelectItem>
                          <SelectItem value="3">H3</SelectItem>
                          <SelectItem value="4">H4</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={item.heading}
                        onChange={(e) =>
                          updateOutlineItem(item.id, "heading", e.target.value)
                        }
                        placeholder="Koptekst..."
                        className="h-8 text-sm flex-1"
                      />
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveOutlineItem(index, "up")}
                          disabled={index === 0}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveOutlineItem(index, "down")}
                          disabled={index === outline.length - 1}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeOutlineItem(item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {/* Key points */}
                    <div className="ml-8 space-y-1">
                      {item.keyPoints.map((kp, kpIndex) => (
                        <div key={kpIndex} className="flex items-center gap-1">
                          <Input
                            value={kp}
                            onChange={(e) =>
                              updateKeyPoint(
                                item.id,
                                kpIndex,
                                e.target.value
                              )
                            }
                            placeholder="Kernpunt..."
                            className="h-7 text-xs flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-destructive"
                            onClick={() => removeKeyPoint(item.id, kpIndex)}
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-muted-foreground"
                        onClick={() => addKeyPoint(item.id)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Kernpunt toevoegen
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Content Editor */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Content editor
                </CardTitle>
                <div className="flex items-center gap-2">
                  {brief.versions && brief.versions.length > 0 && (
                    <>
                      <Select
                        value={String(selectedVersion)}
                        onValueChange={(val) =>
                          handleVersionChange(parseInt(val))
                        }
                      >
                        <SelectTrigger className="w-36 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {brief.versions.map((v) => (
                            <SelectItem key={v.id} value={String(v.version)}>
                              Versie {v.version}
                              {v.aiGenerated ? " (AI)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant={showDiff ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setShowDiff(!showDiff)}
                        disabled={
                          !brief.versions || brief.versions.length < 2
                        }
                      >
                        Verschil
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateDraft}
                  disabled={isGeneratingDraft}
                >
                  {isGeneratingDraft ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1 h-3 w-3" />
                  )}
                  Concept genereren
                </Button>
              </div>
              <Textarea
                value={showDiff ? renderDiffContent() : content}
                onChange={(e) => {
                  if (!showDiff) setContent(e.target.value);
                }}
                readOnly={showDiff}
                className="min-h-[500px] font-mono text-sm"
                placeholder="Schrijf je content hier of genereer een concept met AI..."
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {wordCount} woorden
                  {brief.targetWordCount
                    ? ` / ${brief.targetWordCount} doel`
                    : ""}
                </span>
                {selectedVersion > 0 && (
                  <span>Versie {selectedVersion}</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quality Analysis */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Kwaliteitsanalyse
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleQualityAnalysis}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <BarChart3 className="mr-1 h-3 w-3" />
                  )}
                  Kwaliteit analyseren
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {brief.quality ? (
                <>
                  {/* Overall Score */}
                  <div className="text-center py-4">
                    <div
                      className={`text-5xl font-bold ${getOverallScoreColor(
                        brief.quality.overallScore
                      )}`}
                    >
                      {Math.round(brief.quality.overallScore)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Totale score
                    </p>
                  </div>

                  <Separator />

                  {/* Score Bars */}
                  <div className="space-y-3">
                    {QUALITY_DIMENSIONS.map((dim) => {
                      const score = brief.quality?.[dim.key] ?? 0;
                      return (
                        <div key={dim.key} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{dim.label}</span>
                            <span className="font-medium">
                              {Math.round(score)}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${getScoreColor(
                                score
                              )}`}
                              style={{ width: `${Math.max(2, score)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Recommendations */}
                  {parseRecommendations(brief.quality.recommendations).length >
                    0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">
                          Aanbevelingen
                        </h4>
                        <ul className="space-y-1">
                          {parseRecommendations(
                            brief.quality.recommendations
                          ).map((rec: string, i: number) => (
                            <li
                              key={i}
                              className="text-sm text-muted-foreground flex items-start gap-2"
                            >
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                              <span
                                dangerouslySetInnerHTML={{
                                  __html: highlightVerificationNeeded(rec),
                                }}
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Geen kwaliteitsanalyse beschikbaar</p>
                  <p className="text-sm mt-1">
                    Genereer eerst een concept en voer dan een kwaliteitsanalyse
                    uit
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Claim Markers Notice */}
      {brief.versions &&
        brief.versions.length > 0 &&
        brief.versions[brief.versions.length - 1].claimMarkers && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">
                    AI-gegenereerde beweringen gevonden
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sommige beweringen in de tekst zijn gemarkeerd met
                    [VERIFICATIE_NODIG]. Controleer deze beweringen voordat je
                    de content publiceert.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Approve Confirmation Dialog */}
      <AlertDialog
        open={showApproveDialog}
        onOpenChange={setShowApproveDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Brief goedkeuren</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze brief wilt goedkeuren? Na goedkeuring
              kan de content worden gepubliceerd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Goedkeuren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
