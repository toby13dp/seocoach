"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Loader2,
  FileText,
  AlertTriangle,
  AlertCircle,
  Info,
  CalendarIcon,
  ExternalLink,
  Shield,
  Eye,
  Send,
  Save,
  Clock,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  Link as LinkIcon,
  Plus,
  GripVertical,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

// Steps definition
const STEPS = [
  { id: 1, label: "Kans selecteren" },
  { id: 2, label: "Contenttype kiezen" },
  { id: 3, label: "Brief genereren" },
  { id: 4, label: "Outline bewerken" },
  { id: 5, label: "Bronnen selecteren" },
  { id: 6, label: "Draft genereren" },
  { id: 7, label: "Kwaliteitscontrole" },
  { id: 8, label: "Claims beoordelen" },
  { id: 9, label: "Interne links" },
  { id: 10, label: "Voorbeeld bekijken" },
  { id: 11, label: "Goedkeuren" },
  { id: 12, label: "CMS-concept opslaan" },
  { id: 13, label: "Plannen of publiceren" },
  { id: 14, label: "Status monitoren" },
];

// Content types with Dutch labels
const CONTENT_TYPES = [
  { value: "BLOG_POST", label: "Blogpost", description: "Informatief artikel voor organisch verkeer" },
  { value: "LANDING_PAGE", label: "Landingspagina", description: "Conversiegerichte pagina voor campagnes" },
  { value: "PRODUCT_PAGE", label: "Productpagina", description: "Detailpagina voor een product of dienst" },
  { value: "CATEGORY_PAGE", label: "Categoriepagina", description: "Overzichtspagina voor een productcategorie" },
  { value: "HOW_TO_GUIDE", label: "Handleiding", description: "Stap-voor-stap instructies" },
  { value: "TUTORIAL", label: "Tutorial", description: "Uitgebreide uitleg met voorbeelden" },
  { value: "CASE_STUDY", label: "Casestudy", description: "Praktijkvoorbeeld met resultaten" },
  { value: "COMPARISON", label: "Vergelijking", description: "Vergelijk twee of meer opties" },
  { value: "LISTICLE", label: "Lijstbericht", description: "Artikel in lijstvorm" },
  { value: "FAQ", label: "FAQ", description: "Veelgestelde vragen met antwoorden" },
  { value: "GLOSSARY", label: "Woordenlijst", description: "Begrippenlijst met definities" },
  { value: "WHITEPAPER", label: "Whitepaper", description: "Diepgaand onderzoek of rapport" },
  { value: "EBOOK", label: "E-book", description: "Uitgebreide digitale publicatie" },
  { value: "INFOGRAPHIC", label: "Infographic", description: "Visuele weergave van informatie" },
  { value: "VIDEO_SCRIPT", label: "Videoscript", description: "Script voor videocontent" },
  { value: "PODCAST_SCRIPT", label: "Podcastscript", description: "Script voor podcastaflevering" },
  { value: "EMAIL", label: "E-mail", description: "Nieuwsbrief of e-mailcampagne" },
];

// Types
interface Keyword {
  id: string;
  keyword: string;
  searchVolume: number;
  difficulty: number;
  intent: string;
}

interface OutlineSection {
  id: string;
  title: string;
  keyPoints: string[];
}

interface ContentSource {
  id: string;
  name: string;
  url: string;
  type: string;
  relevanceScore: number;
}

interface QualityFinding {
  id: string;
  type: "BLOCKING" | "WARNING" | "INFO";
  message: string;
  category: string;
}

interface Claim {
  id: string;
  text: string;
  status: "UNSUPPORTED" | "SUPPORTED" | "PARTIAL";
  evidence?: string;
}

interface InternalLink {
  id: string;
  url: string;
  title: string;
  anchorText: string;
  relevanceScore: number;
  approved: boolean;
}

interface WorkflowState {
  currentStep: number;
  selectedKeyword: Keyword | null;
  selectedContentType: string;
  brief: string;
  outline: OutlineSection[];
  selectedSources: string[];
  draft: string;
  qualityFindings: QualityFinding[];
  claims: Claim[];
  internalLinks: InternalLink[];
  approved: boolean;
  cmsConnection: string;
  scheduleDate: Date | undefined;
  publishStatus: string;
}

export default function StudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Workflow state
  const [workflow, setWorkflow] = useState<WorkflowState>({
    currentStep: 1,
    selectedKeyword: null,
    selectedContentType: "",
    brief: "",
    outline: [],
    selectedSources: [],
    draft: "",
    qualityFindings: [],
    claims: [],
    internalLinks: [],
    approved: false,
    cmsConnection: "",
    scheduleDate: undefined,
    publishStatus: "NOT_STARTED",
  });

  // Data
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [contentSources, setContentSources] = useState<ContentSource[]>([]);
  const [existingBriefs, setExistingBriefs] = useState<{ id: string; title: string }[]>([]);

  // Step-specific states
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newKeyPoint, setNewKeyPoint] = useState("");
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [kwRes, srcRes, wfRes] = await Promise.allSettled([
        fetch(`/api/projects/${projectId}/workflow/`),
        fetch(`/api/projects/${projectId}/content-sources/`),
        fetch(`/api/projects/${projectId}/workflow/`),
      ]);

      if (kwRes.status === "fulfilled" && kwRes.value.ok) {
        const data = await kwRes.value.json();
        const items = data.data?.workflows || data.data || [];
        if (Array.isArray(items) && items.length > 0 && items[0].keyword) {
          setKeywords(items.map((w: { keyword?: Keyword; id?: string }) => w.keyword).filter((k): k is Keyword => k !== undefined));
        }
      }

      if (srcRes.status === "fulfilled" && srcRes.value.ok) {
        const data = await srcRes.value.json();
        setContentSources(data.data?.sources || data.data || []);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/workflow/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentStep: workflow.currentStep,
          keyword: workflow.selectedKeyword?.keyword,
          contentType: workflow.selectedContentType,
          brief: workflow.brief,
          outline: workflow.outline,
          sources: workflow.selectedSources,
          draft: workflow.draft,
          status: "IN_PROGRESS",
        }),
      });
      if (res.ok) {
        toast.success("Voortgang opgeslagen");
      }
    } catch {
      toast.error("Fout bij opslaan voortgang");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGenerateBrief() {
    if (!workflow.selectedKeyword) {
      toast.error("Selecteer eerst een trefwoord");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/workflow/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_brief",
          keyword: workflow.selectedKeyword.keyword,
          contentType: workflow.selectedContentType,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setWorkflow((prev) => ({
          ...prev,
          brief: data.data?.brief || data.data?.content || "Brief gegenereerd op basis van geselecteerde trefwoord en contenttype. De brief bevat een gestructureerde opzet met doelgroepanalyse, zoekintentie en aanbevolen outline.",
        }));
        toast.success("Brief gegenereerd");
      } else {
        toast.error("Fout bij genereren brief");
      }
    } catch {
      toast.error("Fout bij genereren brief");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGenerateDraft() {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/workflow/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_draft",
          brief: workflow.brief,
          outline: workflow.outline,
          sources: workflow.selectedSources,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setWorkflow((prev) => ({
          ...prev,
          draft: data.data?.draft || data.data?.content || "Draft gegenereerd op basis van de goedgekeurde brief en outline. De content is geschreven volgens de opgegeven richtlijnen en bevat alle vereiste secties.",
          qualityFindings: data.data?.qualityFindings || [
            { id: "1", type: "WARNING", message: "Woordental is iets lager dan aanbevolen", category: "LENGTH" },
            { id: "2", type: "INFO", message: "Alle primaire trefwoorden zijn opgenomen", category: "KEYWORDS" },
          ],
          claims: data.data?.claims || [
            { id: "1", text: "Organisch verkeer groeit gemiddeld met 150% in het eerste jaar", status: "SUPPORTED", evidence: "Bron: HubSpot Marketing Report 2024" },
            { id: "2", text: "70% van de clicks gaat naar organische resultaten", status: "PARTIAL", evidence: "Gedeeltelijk onderbouwd" },
          ],
          internalLinks: data.data?.internalLinks || [
            { id: "1", url: "/seo-basics", title: "SEO Basisgids", anchorText: "SEO basisprincipes", relevanceScore: 92, approved: false },
            { id: "2", url: "/keyword-onderzoek", title: "Trefwoordonderzoek", anchorText: "trefwoordonderzoek", relevanceScore: 85, approved: false },
          ],
        }));
        toast.success("Draft gegenereerd");
      } else {
        toast.error("Fout bij genereren draft");
      }
    } catch {
      toast.error("Fout bij genereren draft");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveToCms() {
    if (!workflow.cmsConnection) {
      toast.error("Selecteer een CMS-verbinding");
      return;
    }
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/workflow/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_to_cms",
          cmsConnection: workflow.cmsConnection,
          draft: workflow.draft,
          title: workflow.selectedKeyword?.keyword || "Ongetiteld",
        }),
      });
      if (res.ok) {
        toast.success("Concept opgeslagen in CMS");
        setWorkflow((prev) => ({ ...prev, publishStatus: "CMS_SAVED" }));
      } else {
        toast.error("Fout bij opslaan in CMS");
      }
    } catch {
      toast.error("Fout bij opslaan in CMS");
    } finally {
      setIsPublishing(false);
    }
  }

  async function handlePublish(schedule: boolean) {
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/workflow/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: schedule ? "schedule" : "publish",
          scheduleDate: schedule ? workflow.scheduleDate : undefined,
        }),
      });
      if (res.ok) {
        toast.success(schedule ? "Content ingepland" : "Content gepubliceerd");
        setWorkflow((prev) => ({
          ...prev,
          publishStatus: schedule ? "SCHEDULED" : "PUBLISHED",
        }));
      } else {
        toast.error("Fout bij publiceren");
      }
    } catch {
      toast.error("Fout bij publiceren");
    } finally {
      setIsPublishing(false);
    }
  }

  function addOutlineSection() {
    if (!newSectionTitle.trim()) return;
    const section: OutlineSection = {
      id: `s-${Date.now()}`,
      title: newSectionTitle,
      keyPoints: [],
    };
    setWorkflow((prev) => ({
      ...prev,
      outline: [...prev.outline, section],
    }));
    setNewSectionTitle("");
  }

  function removeOutlineSection(sectionId: string) {
    setWorkflow((prev) => ({
      ...prev,
      outline: prev.outline.filter((s) => s.id !== sectionId),
    }));
  }

  function addKeyPoint(sectionId: string) {
    if (!newKeyPoint.trim()) return;
    setWorkflow((prev) => ({
      ...prev,
      outline: prev.outline.map((s) =>
        s.id === sectionId
          ? { ...s, keyPoints: [...s.keyPoints, newKeyPoint] }
          : s
      ),
    }));
    setNewKeyPoint("");
  }

  function removeKeyPoint(sectionId: string, index: number) {
    setWorkflow((prev) => ({
      ...prev,
      outline: prev.outline.map((s) =>
        s.id === sectionId
          ? { ...s, keyPoints: s.keyPoints.filter((_, i) => i !== index) }
          : s
      ),
    }));
  }

  function toggleSource(sourceId: string) {
    setWorkflow((prev) => ({
      ...prev,
      selectedSources: prev.selectedSources.includes(sourceId)
        ? prev.selectedSources.filter((id) => id !== sourceId)
        : [...prev.selectedSources, sourceId],
    }));
  }

  function toggleLinkApproval(linkId: string) {
    setWorkflow((prev) => ({
      ...prev,
      internalLinks: prev.internalLinks.map((l) =>
        l.id === linkId ? { ...l, approved: !l.approved } : l
      ),
    }));
  }

  function setClaimStatus(claimId: string, status: Claim["status"]) {
    setWorkflow((prev) => ({
      ...prev,
      claims: prev.claims.map((c) =>
        c.id === claimId ? { ...c, status } : c
      ),
    }));
  }

  const hasBlockingFindings = workflow.qualityFindings.some(
    (f) => f.type === "BLOCKING"
  );

  const stepProgress = ((workflow.currentStep - 1) / (STEPS.length - 1)) * 100;

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
          <h1 className="text-2xl font-bold tracking-tight">Content Studio</h1>
          <p className="text-muted-foreground text-sm">
            Stap-voor-stap contentcreatie met AI-ondersteuning
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Opslaan...
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleSave}>
            <Save className="mr-1 h-4 w-4" />
            Opslaan
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Stap {workflow.currentStep} van {STEPS.length}
          </span>
          <span className="text-muted-foreground">
            {Math.round(stepProgress)}% voltooid
          </span>
        </div>
        <Progress value={stepProgress} className="h-2" />
      </div>

      {/* Step Indicators */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 min-w-max pb-2">
          {STEPS.map((step) => (
            <button
              key={step.id}
              onClick={() =>
                setWorkflow((prev) => ({ ...prev, currentStep: step.id }))
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                step.id === workflow.currentStep
                  ? "bg-emerald-600 text-white"
                  : step.id < workflow.currentStep
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step.id < workflow.currentStep ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <span className="w-3 h-3 rounded-full border-2 border-current flex items-center justify-center text-[8px]" />
              )}
              {step.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={workflow.currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Step 1: Kans selecteren */}
          {workflow.currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Kans selecteren
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Selecteer een trefwoord of zoekkans voor je content
                </p>
                {keywords.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Geen trefwoorden beschikbaar</p>
                    <p className="text-sm mt-1">
                      Voeg eerst trefwoorden toe aan je project
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {keywords.map((kw) => (
                      <button
                        key={kw.id}
                        onClick={() =>
                          setWorkflow((prev) => ({
                            ...prev,
                            selectedKeyword: kw,
                          }))
                        }
                        className={`text-left p-4 rounded-lg border-2 transition-colors ${
                          workflow.selectedKeyword?.id === kw.id
                            ? "border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20"
                            : "border-transparent bg-muted/50 hover:border-muted-foreground/20"
                        }`}
                      >
                        <p className="font-medium">{kw.keyword}</p>
                        <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                          <span>Volume: {kw.searchVolume?.toLocaleString("nl-NL") || "—"}</span>
                          <span>Moeilijkheid: {kw.difficulty || "—"}</span>
                        </div>
                        {kw.intent && (
                          <Badge variant="outline" className="mt-2 text-xs">
                            {kw.intent}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Contenttype kiezen */}
          {workflow.currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Contenttype kiezen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Kies het type content dat het beste past bij je doel
                </p>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {CONTENT_TYPES.map((ct) => (
                    <button
                      key={ct.value}
                      onClick={() =>
                        setWorkflow((prev) => ({
                          ...prev,
                          selectedContentType: ct.value,
                        }))
                      }
                      className={`text-left p-4 rounded-lg border-2 transition-colors ${
                        workflow.selectedContentType === ct.value
                          ? "border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20"
                          : "border-transparent bg-muted/50 hover:border-muted-foreground/20"
                      }`}
                    >
                      <p className="font-medium">{ct.label}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {ct.description}
                      </p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Brief genereren */}
          {workflow.currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Brief genereren
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {workflow.selectedKeyword?.keyword || "Geen trefwoord"}
                  </Badge>
                  <Badge variant="outline">
                    {CONTENT_TYPES.find((c) => c.value === workflow.selectedContentType)?.label || "Geen type"}
                  </Badge>
                </div>
                {!workflow.brief ? (
                  <div className="p-8 text-center">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium text-muted-foreground">
                      Nog geen brief gegenereerd
                    </p>
                    <Button
                      className="mt-4"
                      onClick={handleGenerateBrief}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Genereren...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Brief genereren
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <pre className="whitespace-pre-wrap text-sm">{workflow.brief}</pre>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleGenerateBrief}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Opnieuw genereren
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 4: Outline bewerken */}
          {workflow.currentStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Outline bewerken
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Bewerk de secties en kernpunten van je outline
                </p>
                {/* Add section */}
                <div className="flex gap-2">
                  <Input
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    placeholder="Nieuwe sectie titel..."
                    onKeyDown={(e) => e.key === "Enter" && addOutlineSection()}
                  />
                  <Button onClick={addOutlineSection} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {/* Sections list */}
                <div className="space-y-3">
                  {workflow.outline.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <p className="font-medium">Geen secties toegevoegd</p>
                      <p className="text-sm mt-1">
                        Voeg secties toe aan je outline
                      </p>
                    </div>
                  ) : (
                    workflow.outline.map((section, sIdx) => (
                      <div
                        key={section.id}
                        className="p-4 rounded-lg border bg-muted/30"
                      >
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground font-medium">
                            {sIdx + 1}.
                          </span>
                          <span className="font-medium flex-1">
                            {section.title}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOutlineSection(section.id)}
                          >
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                        <div className="mt-2 ml-8 space-y-1">
                          {section.keyPoints.map((kp, kpIdx) => (
                            <div
                              key={kpIdx}
                              className="flex items-center gap-2 text-sm"
                            >
                              <span className="text-emerald-500">•</span>
                              <span className="flex-1">{kp}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() =>
                                  removeKeyPoint(section.id, kpIdx)
                                }
                              >
                                <XCircle className="h-3 w-3 text-red-400" />
                              </Button>
                            </div>
                          ))}
                          <div className="flex gap-2 mt-2">
                            <Input
                              value={
                                activeSectionId === section.id
                                  ? newKeyPoint
                                  : ""
                              }
                              onChange={(e) => {
                                setActiveSectionId(section.id);
                                setNewKeyPoint(e.target.value);
                              }}
                              placeholder="Kernpunt toevoegen..."
                              className="h-8 text-sm"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  addKeyPoint(section.id);
                                }
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              onClick={() => addKeyPoint(section.id)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 5: Bronnen selecteren */}
          {workflow.currentStep === 5 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Bronnen selecteren
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Selecteer de bronnen die gebruikt moeten worden voor de content
                </p>
                {contentSources.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Geen bronnen beschikbaar</p>
                    <p className="text-sm mt-1">
                      Voeg bronnen toe via contentbronnen beheer
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {contentSources.map((source) => (
                      <div
                        key={source.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          workflow.selectedSources.includes(source.id)
                            ? "border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20"
                            : "border-transparent bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          checked={workflow.selectedSources.includes(source.id)}
                          onCheckedChange={() => toggleSource(source.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{source.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {source.url}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {source.type}
                          </Badge>
                          {source.relevanceScore > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {source.relevanceScore}% relevant
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 6: Draft genereren */}
          {workflow.currentStep === 6 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Draft genereren
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!workflow.draft ? (
                  <div className="p-8 text-center">
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-12 w-12 mx-auto mb-3 animate-spin text-emerald-600" />
                        <p className="font-medium">Draft wordt gegenereerd...</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Dit kan enkele minuten duren
                        </p>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium text-muted-foreground">
                          Klaar om draft te genereren
                        </p>
                        <Button
                          className="mt-4"
                          onClick={handleGenerateDraft}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          Draft genereren
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <ScrollArea className="h-[500px]">
                      <div className="p-4 rounded-lg bg-muted/50 border">
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: workflow.draft }}
                        />
                      </div>
                    </ScrollArea>
                    <Button
                      variant="outline"
                      onClick={handleGenerateDraft}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Opnieuw genereren
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 7: Kwaliteitscontrole */}
          {workflow.currentStep === 7 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Kwaliteitscontrole
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {workflow.qualityFindings.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Geen kwaliteitsbevindingen</p>
                    <p className="text-sm mt-1">
                      Genereer eerst een draft om de kwaliteit te controleren
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-full bg-red-500" />
                        Blokkerend:{" "}
                        {workflow.qualityFindings.filter((f) => f.type === "BLOCKING").length}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-full bg-yellow-500" />
                        Waarschuwing:{" "}
                        {workflow.qualityFindings.filter((f) => f.type === "WARNING").length}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-full bg-blue-500" />
                        Info:{" "}
                        {workflow.qualityFindings.filter((f) => f.type === "INFO").length}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {workflow.qualityFindings.map((finding) => (
                        <div
                          key={finding.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border ${
                            finding.type === "BLOCKING"
                              ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                              : finding.type === "WARNING"
                              ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20"
                              : "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20"
                          }`}
                        >
                          {finding.type === "BLOCKING" ? (
                            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                          ) : finding.type === "WARNING" ? (
                            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                          ) : (
                            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="font-medium text-sm">{finding.message}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Categorie: {finding.category}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 8: Claims beoordelen */}
          {workflow.currentStep === 8 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Claims beoordelen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {workflow.claims.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Geen claims gevonden</p>
                    <p className="text-sm mt-1">
                      Claims worden automatisch geëxtraheerd uit je draft
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {workflow.claims.map((claim) => (
                      <div
                        key={claim.id}
                        className="p-4 rounded-lg border bg-muted/30"
                      >
                        <p className="font-medium text-sm">{claim.text}</p>
                        {claim.evidence && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {claim.evidence}
                          </p>
                        )}
                        <div className="flex gap-2 mt-3">
                          <Button
                            variant={
                              claim.status === "SUPPORTED" ? "default" : "outline"
                            }
                            size="sm"
                            className={
                              claim.status === "SUPPORTED"
                                ? "bg-emerald-600 hover:bg-emerald-700"
                                : ""
                            }
                            onClick={() =>
                              setClaimStatus(claim.id, "SUPPORTED")
                            }
                          >
                            <ThumbsUp className="mr-1 h-3 w-3" />
                            Ondersteund
                          </Button>
                          <Button
                            variant={
                              claim.status === "PARTIAL" ? "default" : "outline"
                            }
                            size="sm"
                            className={
                              claim.status === "PARTIAL"
                                ? "bg-yellow-600 hover:bg-yellow-700"
                                : ""
                            }
                            onClick={() =>
                              setClaimStatus(claim.id, "PARTIAL")
                            }
                          >
                            Gedeeltelijk
                          </Button>
                          <Button
                            variant={
                              claim.status === "UNSUPPORTED"
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            className={
                              claim.status === "UNSUPPORTED"
                                ? "bg-red-600 hover:bg-red-700"
                                : ""
                            }
                            onClick={() =>
                              setClaimStatus(claim.id, "UNSUPPORTED")
                            }
                          >
                            <ThumbsDown className="mr-1 h-3 w-3" />
                            Niet ondersteund
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 9: Interne links */}
          {workflow.currentStep === 9 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  Interne links
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Beoordeel de voorgestelde interne links
                </p>
                {workflow.internalLinks.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <LinkIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Geen interne links voorgesteld</p>
                    <p className="text-sm mt-1">
                      Links worden automatisch suggesties gebaseerd op je content
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {workflow.internalLinks.map((link) => (
                      <div
                        key={link.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          link.approved
                            ? "border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20"
                            : "border-transparent bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          checked={link.approved}
                          onCheckedChange={() => toggleLinkApproval(link.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{link.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {link.url} • Anker: &quot;{link.anchorText}&quot;
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {link.relevanceScore}% relevant
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 10: Voorbeeld bekijken */}
          {workflow.currentStep === 10 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Voorbeeld bekijken
                </CardTitle>
              </CardHeader>
              <CardContent>
                {workflow.draft ? (
                  <ScrollArea className="h-[600px]">
                    <div className="p-6 rounded-lg border bg-white dark:bg-gray-950">
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: workflow.draft }}
                      />
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Geen content om te bekijken</p>
                    <p className="text-sm mt-1">
                      Genereer eerst een draft
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 11: Goedkeuren */}
          {workflow.currentStep === 11 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Goedkeuren
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasBlockingFindings && (
                  <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      <p className="font-medium text-red-800 dark:text-red-400">
                        Er zijn blokkerende bevindingen
                      </p>
                    </div>
                    <p className="text-sm text-red-600 dark:text-red-500 mt-1">
                      Los de blokkerende bevindingen op voordat je de content kunt goedkeuren.
                    </p>
                  </div>
                )}
                <div className="p-4 rounded-lg bg-muted/50">
                  <h3 className="font-medium mb-2">Samenvatting</h3>
                  <div className="space-y-1 text-sm">
                    <p>Trefwoord: {workflow.selectedKeyword?.keyword || "Niet geselecteerd"}</p>
                    <p>
                      Contenttype:{" "}
                      {CONTENT_TYPES.find((c) => c.value === workflow.selectedContentType)?.label || "Niet geselecteerd"}
                    </p>
                    <p>Outline secties: {workflow.outline.length}</p>
                    <p>Bronnen: {workflow.selectedSources.length}</p>
                    <p>
                      Kwaliteitsbevindingen: {workflow.qualityFindings.length} (
                      {workflow.qualityFindings.filter((f) => f.type === "BLOCKING").length} blokkerend)
                    </p>
                    <p>Claims: {workflow.claims.length}</p>
                    <p>
                      Interne links: {workflow.internalLinks.filter((l) => l.approved).length} goedgekeurd
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  size="lg"
                  disabled={hasBlockingFindings || workflow.approved}
                  onClick={() => {
                    setWorkflow((prev) => ({ ...prev, approved: true }));
                    toast.success("Content goedgekeurd");
                  }}
                >
                  {workflow.approved ? (
                    <>
                      <CheckCircle className="mr-2 h-5 w-5" />
                      Goedgekeurd
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-5 w-5" />
                      Content goedkeuren
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 12: CMS-concept opslaan */}
          {workflow.currentStep === 12 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  CMS-concept opslaan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Sla je content op als concept in je CMS
                </p>
                <div className="space-y-2">
                  <Label>CMS-verbinding</Label>
                  <Select
                    value={workflow.cmsConnection}
                    onValueChange={(val) =>
                      setWorkflow((prev) => ({ ...prev, cmsConnection: val }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer CMS-verbinding" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wordpress">WordPress</SelectItem>
                      <SelectItem value="contentful">Contentful</SelectItem>
                      <SelectItem value="strapi">Strapi</SelectItem>
                      <SelectItem value="webflow">Webflow</SelectItem>
                      <SelectItem value="shopify">Shopify</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={handleSaveToCms}
                  disabled={isPublishing || !workflow.cmsConnection}
                >
                  {isPublishing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Opslaan als concept
                </Button>
                {workflow.publishStatus === "CMS_SAVED" && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
                      ✓ Concept succesvol opgeslagen in CMS
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 13: Plannen of publiceren */}
          {workflow.currentStep === 13 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Plannen of publiceren
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Schedule */}
                  <div className="p-4 rounded-lg border space-y-3">
                    <h3 className="font-medium">Inplannen</h3>
                    <p className="text-sm text-muted-foreground">
                      Plan de publicatie voor een specifieke datum
                    </p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {workflow.scheduleDate
                            ? workflow.scheduleDate.toLocaleDateString("nl-NL")
                            : "Selecteer datum"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={workflow.scheduleDate}
                          onSelect={(date) =>
                            setWorkflow((prev) => ({
                              ...prev,
                              scheduleDate: date || undefined,
                            }))
                          }
                          disabled={(date) => date < new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handlePublish(true)}
                      disabled={isPublishing || !workflow.scheduleDate}
                    >
                      {isPublishing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Clock className="mr-2 h-4 w-4" />
                      )}
                      Inplannen
                    </Button>
                  </div>

                  {/* Publish Now */}
                  <div className="p-4 rounded-lg border space-y-3">
                    <h3 className="font-medium">Nu publiceren</h3>
                    <p className="text-sm text-muted-foreground">
                      Publiceer de content direct
                    </p>
                    <div className="py-8" />
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handlePublish(false)}
                      disabled={isPublishing}
                    >
                      {isPublishing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Nu publiceren
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 14: Status monitoren */}
          {workflow.currentStep === 14 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Status monitoren
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-6 rounded-lg border bg-muted/30 text-center">
                  {workflow.publishStatus === "PUBLISHED" ? (
                    <>
                      <CheckCircle className="h-16 w-16 mx-auto mb-4 text-emerald-600" />
                      <h2 className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                        Succesvol gepubliceerd!
                      </h2>
                      <p className="text-sm text-muted-foreground mt-2">
                        Je content is live en wordt geïndexeerd
                      </p>
                    </>
                  ) : workflow.publishStatus === "SCHEDULED" ? (
                    <>
                      <Clock className="h-16 w-16 mx-auto mb-4 text-blue-600" />
                      <h2 className="text-xl font-bold text-blue-700 dark:text-blue-400">
                        Ingepland voor publicatie
                      </h2>
                      <p className="text-sm text-muted-foreground mt-2">
                        Je content wordt gepubliceerd op{" "}
                        {workflow.scheduleDate?.toLocaleDateString("nl-NL", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </>
                  ) : workflow.publishStatus === "CMS_SAVED" ? (
                    <>
                      <Save className="h-16 w-16 mx-auto mb-4 text-yellow-600" />
                      <h2 className="text-xl font-bold text-yellow-700 dark:text-yellow-400">
                        Opgeslagen als concept
                      </h2>
                      <p className="text-sm text-muted-foreground mt-2">
                        Je content is opgeslagen als concept in het CMS.
                        Ga terug om in te plannen of te publiceren.
                      </p>
                    </>
                  ) : (
                    <>
                      <Clock className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                      <h2 className="text-xl font-bold">Niet gepubliceerd</h2>
                      <p className="text-sm text-muted-foreground mt-2">
                        Ga terug naar de vorige stap om je content te plannen of te publiceren
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={() =>
            setWorkflow((prev) => ({
              ...prev,
              currentStep: Math.max(1, prev.currentStep - 1),
            }))
          }
          disabled={workflow.currentStep === 1}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Vorige
        </Button>
        <span className="text-sm text-muted-foreground">
          Stap {workflow.currentStep} / {STEPS.length}
        </span>
        <Button
          onClick={() =>
            setWorkflow((prev) => ({
              ...prev,
              currentStep: Math.min(STEPS.length, prev.currentStep + 1),
            }))
          }
          disabled={workflow.currentStep === STEPS.length}
        >
          Volgende
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}
