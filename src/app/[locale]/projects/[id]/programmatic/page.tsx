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
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Layers,
  Loader2,
  FileText,
  Eye,
  CheckCircle,
  XCircle,
  Play,
  Send,
  Trash2,
  ChevronRight,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

// Types
interface TemplateVariable {
  name: string;
  label: string;
  type: "TEXT" | "URL" | "NUMBER";
}

interface DataRow {
  [key: string]: string;
}

interface ProgrammaticTemplate {
  id: string;
  name: string;
  type: string;
  contentTemplate: string;
  variables: TemplateVariable[];
  dataRows: DataRow[];
  qualityGates: string[];
  maxPages: number;
  status: string;
  pages: GeneratedPage[];
  createdAt: string;
  updatedAt: string;
}

interface GeneratedPage {
  id: string;
  title: string;
  content: string;
  status: string;
  qualityScore: number;
  rejectionReason?: string;
  createdAt: string;
}

// Dutch labels
const TYPE_LABELS: Record<string, string> = {
  SERVICE_LOCATION: "Dienst + Locatie",
  PRODUCT_USE_CASE: "Product + Gebruikscase",
  PRODUCT_AUDIENCE: "Product + Doelgroep",
  PRODUCT_FEATURE: "Product + Functie",
  CATEGORY_FEATURE: "Categorie + Functie",
  INDUSTRY_SERVICE: "Branche + Dienst",
  INTEGRATION_PLATFORM: "Integratie + Platform",
  COMPARISON: "Vergelijking",
  GLOSSARY: "Woordenlijst",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Concept",
  ACTIVE: "Actief",
  PAUSED: "Gepauzeerd",
  ARCHIVED: "Gearchiveerd",
};

const PAGE_STATUS_LABELS: Record<string, string> = {
  GENERATED: "Gegenereerd",
  APPROVED: "Goedgekeurd",
  REJECTED: "Afgewezen",
  PUBLISHED: "Gepubliceerd",
};

const QUALITY_GATES_OPTIONS = [
  { value: "UNIQUE_CONTENT", label: "Unieke content" },
  { value: "KEYWORD_DENSITY", label: "Trefwoorddichtheid" },
  { value: "MIN_WORD_COUNT", label: "Minimum woordental" },
  { value: "INTERNAL_LINKS", label: "Interne links" },
  { value: "META_COMPLETENESS", label: "Meta-compleetheid" },
  { value: "READABILITY", label: "Leesbaarheid" },
];

export default function ProgrammaticPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [templates, setTemplates] = useState<ProgrammaticTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ProgrammaticTemplate | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Create dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    type: "SERVICE_LOCATION",
    contentTemplate: "",
    variables: [{ name: "", label: "", type: "TEXT" as const }] as TemplateVariable[],
    dataRows: [] as DataRow[],
    qualityGates: [] as string[],
    maxPages: 100,
  });

  // Preview dialog
  const [previewPage, setPreviewPage] = useState<GeneratedPage | null>(null);

  // Confirm dialogs
  const [confirmAction, setConfirmAction] = useState<{
    type: "generate" | "publish" | "approve" | "reject";
    pageId?: string;
  } | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, [projectId]);

  async function fetchTemplates() {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/programmatic/`
      );
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.data?.templates || data.data || []);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchTemplateDetail(templateId: string) {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/programmatic/${templateId}/`
      );
      if (res.ok) {
        const data = await res.json();
        const template = data.data?.template || data.data;
        if (template) {
          setSelectedTemplate(template);
        }
      }
    } catch {
      toast.error("Fout bij laden sjabloon details");
    }
  }

  async function handleCreateTemplate() {
    if (!newTemplate.name.trim()) {
      toast.error("Naam is verplicht");
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/programmatic/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newTemplate.name,
            type: newTemplate.type,
            contentTemplate: newTemplate.contentTemplate,
            variables: newTemplate.variables.filter((v) => v.name.trim()),
            dataRows: newTemplate.dataRows,
            qualityGates: newTemplate.qualityGates,
            maxPages: newTemplate.maxPages,
          }),
        }
      );
      if (res.ok) {
        toast.success("Sjabloon aangemaakt");
        setShowCreateDialog(false);
        resetNewTemplate();
        fetchTemplates();
      } else {
        toast.error("Fout bij aanmaken sjabloon");
      }
    } catch {
      toast.error("Fout bij aanmaken sjabloon");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleGenerate(templateId: string) {
    setIsActionLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/programmatic/${templateId}/generate/`,
        { method: "POST" }
      );
      if (res.ok) {
        toast.success("Pagina's worden gegenereerd...");
        fetchTemplateDetail(templateId);
      } else {
        toast.error("Fout bij genereren pagina's");
      }
    } catch {
      toast.error("Fout bij genereren pagina's");
    } finally {
      setIsActionLoading(false);
      setConfirmAction(null);
    }
  }

  async function handlePublish(templateId: string) {
    setIsActionLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/programmatic/${templateId}/publish/`,
        { method: "POST" }
      );
      if (res.ok) {
        toast.success("Pagina's worden gepubliceerd...");
        fetchTemplateDetail(templateId);
      } else {
        toast.error("Fout bij publiceren pagina's");
      }
    } catch {
      toast.error("Fout bij publiceren pagina's");
    } finally {
      setIsActionLoading(false);
      setConfirmAction(null);
    }
  }

  async function handlePageAction(
    templateId: string,
    pageId: string,
    action: "approve" | "reject"
  ) {
    setIsActionLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/programmatic/${templateId}/pages/${pageId}/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: action === "approve" ? "APPROVED" : "REJECTED" }),
        }
      );
      if (res.ok) {
        toast.success(
          action === "approve"
            ? "Pagina goedgekeurd"
            : "Pagina afgewezen"
        );
        fetchTemplateDetail(templateId);
      } else {
        toast.error("Fout bij bijwerken pagina status");
      }
    } catch {
      toast.error("Fout bij bijwerken pagina status");
    } finally {
      setIsActionLoading(false);
      setConfirmAction(null);
    }
  }

  function resetNewTemplate() {
    setNewTemplate({
      name: "",
      type: "SERVICE_LOCATION",
      contentTemplate: "",
      variables: [{ name: "", label: "", type: "TEXT" }],
      dataRows: [],
      qualityGates: [],
      maxPages: 100,
    });
  }

  function addVariable() {
    setNewTemplate((prev) => ({
      ...prev,
      variables: [...prev.variables, { name: "", label: "", type: "TEXT" }],
    }));
  }

  function removeVariable(index: number) {
    setNewTemplate((prev) => ({
      ...prev,
      variables: prev.variables.filter((_, i) => i !== index),
    }));
  }

  function updateVariable(
    index: number,
    field: keyof TemplateVariable,
    value: string
  ) {
    setNewTemplate((prev) => {
      const vars = [...prev.variables];
      vars[index] = { ...vars[index], [field]: value };
      return { ...prev, variables: vars };
    });
  }

  function addDataRow() {
    const row: DataRow = {};
    newTemplate.variables
      .filter((v) => v.name.trim())
      .forEach((v) => {
        row[v.name] = "";
      });
    setNewTemplate((prev) => ({
      ...prev,
      dataRows: [...prev.dataRows, row],
    }));
  }

  function removeDataRow(index: number) {
    setNewTemplate((prev) => ({
      ...prev,
      dataRows: prev.dataRows.filter((_, i) => i !== index),
    }));
  }

  function updateDataRow(rowIndex: number, key: string, value: string) {
    setNewTemplate((prev) => {
      const rows = [...prev.dataRows];
      rows[rowIndex] = { ...rows[rowIndex], [key]: value };
      return { ...prev, dataRows: rows };
    });
  }

  function toggleQualityGate(value: string) {
    setNewTemplate((prev) => ({
      ...prev,
      qualityGates: prev.qualityGates.includes(value)
        ? prev.qualityGates.filter((g) => g !== value)
        : [...prev.qualityGates, value],
    }));
  }

  const qualityScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    if (score >= 40) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const qualityScoreBg = (score: number) => {
    if (score >= 80) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    if (score >= 60) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    if (score >= 40) return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  };

  const pageStatusBadge = (status: string) => {
    switch (status) {
      case "GENERATED":
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
      case "APPROVED":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "REJECTED":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "PUBLISHED":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Detail view
  if (selectedTemplate) {
    const publishedCount = selectedTemplate.pages?.filter(
      (p) => p.status === "PUBLISHED"
    ).length || 0;
    const approvedCount = selectedTemplate.pages?.filter(
      (p) => p.status === "APPROVED"
    ).length || 0;
    const rejectedCount = selectedTemplate.pages?.filter(
      (p) => p.status === "REJECTED"
    ).length || 0;
    const generatedCount = selectedTemplate.pages?.filter(
      (p) => p.status === "GENERATED"
    ).length || 0;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4 md:p-6 space-y-6"
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedTemplate(null);
              setActiveTab("overview");
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {selectedTemplate.name}
            </h1>
            <p className="text-muted-foreground text-sm">
              {TYPE_LABELS[selectedTemplate.type] || selectedTemplate.type}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setConfirmAction({ type: "generate" })
              }
              disabled={isActionLoading}
            >
              <Play className="mr-2 h-4 w-4" />
              Genereer pagina&apos;s
            </Button>
            <Button
              onClick={() =>
                setConfirmAction({ type: "publish" })
              }
              disabled={isActionLoading || approvedCount === 0}
            >
              <Send className="mr-2 h-4 w-4" />
              Publiceer goedgekeurde pagina&apos;s
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overzicht</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="pages">
              Gegenereerde pagina&apos;s
            </TabsTrigger>
            <TabsTrigger value="quality">Kwaliteit</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Totaal pagina&apos;s</p>
                  <p className="text-2xl font-bold">{selectedTemplate.pages?.length || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Gegenereerd</p>
                  <p className="text-2xl font-bold">{generatedCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Goedgekeurd</p>
                  <p className="text-2xl font-bold text-emerald-600">{approvedCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Gepubliceerd</p>
                  <p className="text-2xl font-bold text-blue-600">{publishedCount}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sjabloon details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="font-medium">{TYPE_LABELS[selectedTemplate.type]}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Maximaal pagina&apos;s</Label>
                  <p className="font-medium">{selectedTemplate.maxPages}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className="ml-2">{STATUS_LABELS[selectedTemplate.status] || selectedTemplate.status}</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Content sjabloon</Label>
                  <pre className="mt-1 p-3 bg-muted rounded-md text-sm overflow-auto max-h-48">
                    {selectedTemplate.contentTemplate || "Geen sjabloon ingesteld"}
                  </pre>
                </div>
                <div>
                  <Label className="text-muted-foreground">Variabelen</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedTemplate.variables?.map((v, i) => (
                      <Badge key={i} variant="outline">
                        {v.label || v.name} ({v.type})
                      </Badge>
                    )) || <span className="text-sm text-muted-foreground">Geen variabelen</span>}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Kwaliteitspoorten</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedTemplate.qualityGates?.map((g, i) => (
                      <Badge key={i} variant="secondary">
                        {QUALITY_GATES_OPTIONS.find((o) => o.value === g)?.label || g}
                      </Badge>
                    )) || <span className="text-sm text-muted-foreground">Geen kwaliteitspoorten</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Datarijen ({selectedTemplate.dataRows?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedTemplate.dataRows?.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Layers className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Geen datarijen gevonden</p>
                    <p className="text-sm mt-1">Voeg datarijen toe via het sjabloon</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {selectedTemplate.variables?.map((v, i) => (
                            <TableHead key={i}>{v.label || v.name}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedTemplate.dataRows?.map((row, i) => (
                          <TableRow key={i}>
                            {selectedTemplate.variables?.map((v, j) => (
                              <TableCell key={j} className="max-w-[200px] truncate">
                                {row[v.name] || "—"}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pages" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Gegenereerde pagina&apos;s ({selectedTemplate.pages?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {selectedTemplate.pages?.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Geen pagina&apos;s gegenereerd</p>
                    <p className="text-sm mt-1">
                      Klik op &quot;Genereer pagina&apos;s&quot; om te beginnen
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Titel</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Kwaliteitsscore</TableHead>
                          <TableHead>Aanmaakdatum</TableHead>
                          <TableHead>Acties</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedTemplate.pages?.map((page) => (
                          <TableRow key={page.id}>
                            <TableCell className="font-medium max-w-[250px] truncate">
                              {page.title}
                            </TableCell>
                            <TableCell>
                              <Badge className={pageStatusBadge(page.status)}>
                                {PAGE_STATUS_LABELS[page.status] || page.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={qualityScoreBg(page.qualityScore)}>
                                {page.qualityScore}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {new Date(page.createdAt).toLocaleDateString("nl-NL")}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setPreviewPage(page)}
                                  title="Voorbeeld bekijken"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {page.status === "GENERATED" && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        setConfirmAction({
                                          type: "approve",
                                          pageId: page.id,
                                        })
                                      }
                                      title="Goedkeuren"
                                    >
                                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        setConfirmAction({
                                          type: "reject",
                                          pageId: page.id,
                                        })
                                      }
                                      title="Afwijzen"
                                    >
                                      <XCircle className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quality" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Kwaliteitsoverzicht</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedTemplate.pages?.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Geen kwaliteitsgegevens beschikbaar</p>
                    <p className="text-sm mt-1">Genereer eerst pagina&apos;s</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Gemiddelde kwaliteitsscore</span>
                        <span className={qualityScoreColor(
                          selectedTemplate.pages.reduce((a, b) => a + b.qualityScore, 0) /
                          (selectedTemplate.pages.length || 1)
                        )}>
                          {Math.round(
                            selectedTemplate.pages.reduce((a, b) => a + b.qualityScore, 0) /
                            (selectedTemplate.pages.length || 1)
                          )}%
                        </span>
                      </div>
                      <Progress
                        value={
                          selectedTemplate.pages.reduce((a, b) => a + b.qualityScore, 0) /
                          (selectedTemplate.pages.length || 1)
                        }
                      />
                    </div>
                    <div className="grid gap-2 md:grid-cols-3">
                      <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                        <p className="text-sm text-muted-foreground">Goedgekeurd</p>
                        <p className="text-xl font-bold text-emerald-600">{approvedCount}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                        <p className="text-sm text-muted-foreground">Afgewezen</p>
                        <p className="text-xl font-bold text-red-600">{rejectedCount}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <p className="text-sm text-muted-foreground">In afwachting</p>
                        <p className="text-xl font-bold">{generatedCount}</p>
                      </div>
                    </div>
                    {selectedTemplate.pages
                      .filter((p) => p.rejectionReason)
                      .map((page) => (
                        <div
                          key={page.id}
                          className="p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                        >
                          <p className="font-medium text-red-800 dark:text-red-400">
                            {page.title}
                          </p>
                          <p className="text-sm text-red-600 dark:text-red-500 mt-1">
                            Afwijsreden: {page.rejectionReason}
                          </p>
                        </div>
                      ))}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Preview Dialog */}
        <Dialog open={!!previewPage} onOpenChange={() => setPreviewPage(null)}>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Voorbeeld: {previewPage?.title}</DialogTitle>
              <DialogDescription>
                Voorbeeldweergave van de gegenereerde pagina
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div
                className="prose prose-sm dark:prose-invert max-w-none p-4"
                dangerouslySetInnerHTML={{ __html: previewPage?.content || "" }}
              />
            </ScrollArea>
            <DialogFooter>
              <div className="flex gap-2">
                <Badge className={qualityScoreBg(previewPage?.qualityScore || 0)}>
                  Kwaliteit: {previewPage?.qualityScore}%
                </Badge>
                {previewPage?.rejectionReason && (
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    Afwijzing: {previewPage.rejectionReason}
                  </Badge>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Action Dialog */}
        <AlertDialog
          open={!!confirmAction}
          onOpenChange={() => setConfirmAction(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction?.type === "generate" &&
                  "Pagina's genereren?"}
                {confirmAction?.type === "publish" &&
                  "Goedgekeurde pagina's publiceren?"}
                {confirmAction?.type === "approve" &&
                  "Deze pagina goedkeuren?"}
                {confirmAction?.type === "reject" &&
                  "Deze pagina afwijzen?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction?.type === "generate" &&
                  "Dit genereert nieuwe pagina's op basis van het sjabloon en de datarijen."}
                {confirmAction?.type === "publish" &&
                  "Dit publiceert alle goedgekeurde pagina's. Deze actie kan niet ongedaan worden gemaakt."}
                {confirmAction?.type === "approve" &&
                  "De pagina wordt gemarkeerd als goedgekeurd en kan worden gepubliceerd."}
                {confirmAction?.type === "reject" &&
                  "De pagina wordt afgewezen en wordt niet gepubliceerd."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuleren</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!confirmAction) return;
                  if (confirmAction.type === "generate")
                    handleGenerate(selectedTemplate.id);
                  else if (confirmAction.type === "publish")
                    handlePublish(selectedTemplate.id);
                  else if (confirmAction.type === "approve" && confirmAction.pageId)
                    handlePageAction(selectedTemplate.id, confirmAction.pageId, "approve");
                  else if (confirmAction.type === "reject" && confirmAction.pageId)
                    handlePageAction(selectedTemplate.id, confirmAction.pageId, "reject");
                }}
                disabled={isActionLoading}
              >
                {isActionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Bevestigen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    );
  }

  // List view
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
          <h1 className="text-2xl font-bold tracking-tight">
            Programmatische SEO
          </h1>
          <p className="text-muted-foreground text-sm">
            Beheer sjablonen en genereer pagina&apos;s op schaal
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuw sjabloon
        </Button>
      </div>

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Sjablonen ({templates.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {templates.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Layers className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Geen sjablonen gevonden</p>
              <p className="text-sm mt-1">
                Maak je eerste sjabloon aan om te beginnen
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naam</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Max pagina&apos;s</TableHead>
                    <TableHead>Gepubliceerd</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => {
                    const pubCount = template.pages?.filter(
                      (p) => p.status === "PUBLISHED"
                    ).length || 0;
                    return (
                      <TableRow
                        key={template.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => fetchTemplateDetail(template.id)}
                      >
                        <TableCell className="font-medium">
                          {template.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {TYPE_LABELS[template.type] || template.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{template.maxPages}</TableCell>
                        <TableCell>{pubCount}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              template.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : template.status === "PAUSED"
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                : template.status === "ARCHIVED"
                                ? "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            }
                          >
                            {STATUS_LABELS[template.status] || template.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
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

      {/* Create Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Nieuw sjabloon</DialogTitle>
            <DialogDescription>
              Maak een nieuw programmatisch SEO-sjabloon aan
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Basisgegevens
                </h3>
                <div className="space-y-2">
                  <Label>Naam *</Label>
                  <Input
                    value={newTemplate.name}
                    onChange={(e) =>
                      setNewTemplate({ ...newTemplate, name: e.target.value })
                    }
                    placeholder="Bijv. Dienst + Locatie pagina's"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={newTemplate.type}
                      onValueChange={(val) =>
                        setNewTemplate({ ...newTemplate, type: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Maximaal pagina&apos;s</Label>
                    <Input
                      type="number"
                      value={newTemplate.maxPages}
                      onChange={(e) =>
                        setNewTemplate({
                          ...newTemplate,
                          maxPages: parseInt(e.target.value) || 100,
                        })
                      }
                      min={1}
                      max={10000}
                    />
                  </div>
                </div>
              </div>

              {/* Content Template */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Content sjabloon
                </h3>
                <div className="space-y-2">
                  <Label>{'Sjabloon met {{variable}} plaatshouders'}</Label>
                  <Textarea
                    value={newTemplate.contentTemplate}
                    onChange={(e) =>
                      setNewTemplate({
                        ...newTemplate,
                        contentTemplate: e.target.value,
                      })
                    }
                    placeholder={`Bijv.\n# {{dienst}} in {{locatie}}\n\nWij bieden professionele {{dienst}} aan in {{locatie}}.\n\n## Waarom {{dienst}}?\n...`}
                    rows={8}
                  />
                </div>
              </div>

              {/* Variables */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                    Variabelen
                  </h3>
                  <Button variant="outline" size="sm" onClick={addVariable}>
                    <Plus className="mr-1 h-3 w-3" />
                    Variabele toevoegen
                  </Button>
                </div>
                {newTemplate.variables.map((variable, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Naam</Label>
                      <Input
                        value={variable.name}
                        onChange={(e) =>
                          updateVariable(index, "name", e.target.value)
                        }
                        placeholder="bijv. dienst"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={variable.label}
                        onChange={(e) =>
                          updateVariable(index, "label", e.target.value)
                        }
                        placeholder="bijv. Dienst"
                      />
                    </div>
                    <div className="w-28 space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={variable.type}
                        onValueChange={(val) =>
                          updateVariable(index, "type", val)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TEXT">Tekst</SelectItem>
                          <SelectItem value="URL">URL</SelectItem>
                          <SelectItem value="NUMBER">Nummer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVariable(index)}
                      disabled={newTemplate.variables.length <= 1}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Data Rows */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                    Datarijen ({newTemplate.dataRows.length})
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addDataRow}
                    disabled={newTemplate.variables.filter((v) => v.name.trim()).length === 0}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Rij toevoegen
                  </Button>
                </div>
                {newTemplate.variables.filter((v) => v.name.trim()).length ===
                  0 && (
                  <p className="text-sm text-muted-foreground">
                    Voeg eerst variabelen toe voordat je datarijen kunt toevoegen
                  </p>
                )}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {newTemplate.dataRows.map((row, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="flex gap-2 items-start p-2 rounded border bg-muted/30"
                    >
                      <span className="text-xs text-muted-foreground pt-2 w-6 shrink-0">
                        {rowIndex + 1}
                      </span>
                      <div className="flex-1 grid gap-2 grid-cols-2 md:grid-cols-3">
                        {newTemplate.variables
                          .filter((v) => v.name.trim())
                          .map((v, colIndex) => (
                            <div key={colIndex} className="space-y-1">
                              <Label className="text-xs">{v.label || v.name}</Label>
                              <Input
                                value={row[v.name] || ""}
                                onChange={(e) =>
                                  updateDataRow(
                                    rowIndex,
                                    v.name,
                                    e.target.value
                                  )
                                }
                                placeholder={v.label || v.name}
                              />
                            </div>
                          ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDataRow(rowIndex)}
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quality Gates */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Kwaliteitspoorten
                </h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {QUALITY_GATES_OPTIONS.map((gate) => (
                    <div key={gate.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`gate-${gate.value}`}
                        checked={newTemplate.qualityGates.includes(gate.value)}
                        onCheckedChange={() => toggleQualityGate(gate.value)}
                      />
                      <Label
                        htmlFor={`gate-${gate.value}`}
                        className="text-sm cursor-pointer"
                      >
                        {gate.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                resetNewTemplate();
              }}
            >
              Annuleren
            </Button>
            <Button onClick={handleCreateTemplate} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aanmaken...
                </>
              ) : (
                "Aanmaken"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
