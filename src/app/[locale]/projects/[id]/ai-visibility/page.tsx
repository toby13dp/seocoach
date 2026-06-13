"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Brain,
  Loader2,
  RefreshCw,
  Plus,
  Upload,
  Eye,
  EyeOff,
  AlertTriangle,
  FlaskConical,
  FileText,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AIPrompt {
  id: string;
  name: string;
  prompt: string;
  clusterId: string | null;
  funnelStage: string;
  searchIntent: string;
  isActive: boolean;
  createdAt: string;
  cluster?: { id: string; name: string } | null;
}

interface AICluster {
  id: string;
  name: string;
  description: string | null;
  prompts: AIPrompt[];
}

interface AIResult {
  id: string;
  method: string;
  platform: string | null;
  model: string | null;
  promptText: string;
  isMentioned: boolean;
  isSimulation: boolean;
  simulationNote: string | null;
  sentiment: string | null;
  accuracy: number | null;
  testDate: string;
  prompt?: { id: string; name: string } | null;
}

interface AISummary {
  shareOfAIVoice: number;
  brandMentionRate: number;
  competitorMentionRate: number;
  avgAccuracy: number;
  totalTests: number;
  mentionedTests: number;
  simulationTests: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AIVisibilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [clusters, setClusters] = useState<AICluster[]>([]);
  const [results, setResults] = useState<AIResult[]>([]);
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNewTestDialog, setShowNewTestDialog] = useState(false);
  const [showAddPromptDialog, setShowAddPromptDialog] = useState(false);

  // New test form
  const [testType, setTestType] = useState<"manual" | "simulation">("manual");
  const [testPromptText, setTestPromptText] = useState("");
  const [testPlatform, setTestPlatform] = useState("");
  const [testModel, setTestModel] = useState("");
  const [testIsMentioned, setTestIsMentioned] = useState(false);
  const [testResponse, setTestResponse] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New prompt form
  const [promptName, setPromptName] = useState("");
  const [promptText, setPromptText] = useState("");

  // CSV import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, [projectId]);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [promptsRes, resultsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/ai-visibility/prompts`),
        fetch(`/api/projects/${projectId}/ai-visibility/results`),
      ]);

      if (promptsRes.ok) {
        const data = await promptsRes.json();
        setPrompts(data.data?.prompts ?? []);
        setClusters(data.data?.clusters ?? []);
      }

      if (resultsRes.ok) {
        const data = await resultsRes.json();
        setResults(data.data ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAllData();
    setIsRefreshing(false);
    toast.success("Gegevens vernieuwd");
  };

  const handleCreateTest = async () => {
    if (!testPromptText) {
      toast.error("Voer een prompt in");
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint =
        testType === "simulation"
          ? `/api/projects/${projectId}/ai-visibility/simulate`
          : `/api/projects/${projectId}/ai-visibility/results`;

      const body =
        testType === "simulation"
          ? { promptText: testPromptText, platform: testPlatform || undefined, model: testModel || undefined }
          : { promptText: testPromptText, platform: testPlatform || undefined, model: testModel || undefined, isMentioned: testIsMentioned, response: testResponse || undefined };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(testType === "simulation" ? "Simulatie gestart" : "Testresultaat opgeslagen");
        setShowNewTestDialog(false);
        resetTestForm();
        await fetchAllData();
      } else {
        toast.error("Test aanmaken mislukt");
      }
    } catch {
      toast.error("Test aanmaken mislukt");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePrompt = async () => {
    if (!promptName || !promptText) {
      toast.error("Naam en prompt zijn vereist");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-visibility/prompts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: promptName, prompt: promptText }),
      });

      if (res.ok) {
        toast.success("Prompt toegevoegd");
        setShowAddPromptDialog(false);
        setPromptName("");
        setPromptText("");
        await fetchAllData();
      } else {
        toast.error("Prompt aanmaken mislukt");
      }
    } catch {
      toast.error("Prompt aanmaken mislukt");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-visibility/prompts/${promptId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Prompt verwijderd");
        await fetchAllData();
      }
    } catch {
      toast.error("Verwijderen mislukt");
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) {
        toast.error("CSV-bestand moet een header en minimaal één rij bevatten");
        return;
      }

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const records = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim());
        const record: Record<string, unknown> = {};
        headers.forEach((h, idx) => {
          record[h] = values[idx] ?? "";
        });
        records.push({
          promptText: (record.prompt as string) || (record.prompttext as string) || "",
          platform: (record.platform as string) || undefined,
          model: (record.model as string) || undefined,
          isMentioned: (record.ismentioned as string) === "true",
          sentiment: (record.sentiment as string) || undefined,
        });
      }

      const res = await fetch(`/api/projects/${projectId}/ai-visibility/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.meta?.importedCount ?? records.length} resultaten geïmporteerd`);
        await fetchAllData();
      } else {
        toast.error("Importeren mislukt");
      }
    } catch {
      toast.error("Importeren mislukt");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const resetTestForm = () => {
    setTestPromptText("");
    setTestPlatform("");
    setTestModel("");
    setTestIsMentioned(false);
    setTestResponse("");
    setTestType("manual");
  };

  const methodLabel = (method: string) => {
    switch (method) {
      case "MANUAL_TEST": return "Handmatig";
      case "CSV_IMPORT": return "CSV-import";
      case "LOCAL_SIMULATION": return "Simulatie";
      case "PROVIDER_ADAPTER": return "Provider";
      default: return method;
    }
  };

  const methodBadge = (method: string, isSimulation: boolean) => {
    if (isSimulation) {
      return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">Simulatie</Badge>;
    }
    switch (method) {
      case "MANUAL_TEST":
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">Handmatig</Badge>;
      case "CSV_IMPORT":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">CSV-import</Badge>;
      default:
        return <Badge variant="secondary">{method}</Badge>;
    }
  };

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
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-600" />
            AI-zichtbaarheid
          </h1>
          <p className="text-sm text-muted-foreground">
            Meet en volg je zichtbaarheid in AI-antwoorden
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Vernieuwen
          </Button>
          <Dialog open={showNewTestDialog} onOpenChange={setShowNewTestDialog}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700">
                <Plus className="mr-2 h-4 w-4" />
                Nieuwe test
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </div>

      {/* New Test Dialog */}
      <Dialog open={showNewTestDialog} onOpenChange={(open) => { setShowNewTestDialog(open); if (!open) resetTestForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe test</DialogTitle>
            <DialogDescription>
              Voer een handmatige test uit of start een lokale simulatie
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={testType} onValueChange={(v) => setTestType(v as "manual" | "simulation")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Handmatige test
                    </div>
                  </SelectItem>
                  <SelectItem value="simulation">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4" />
                      Lokale simulatie
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prompt</Label>
              <Textarea
                value={testPromptText}
                onChange={(e) => setTestPromptText(e.target.value)}
                placeholder="Bijv. Wat zijn de beste SEO-tools voor Nederlandse bedrijven?"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={testPlatform} onValueChange={setTestPlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chatgpt">ChatGPT</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>
                    <SelectItem value="perplexity">Perplexity</SelectItem>
                    <SelectItem value="claude">Claude</SelectItem>
                    <SelectItem value="other">Anders</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input
                  value={testModel}
                  onChange={(e) => setTestModel(e.target.value)}
                  placeholder="Bijv. gpt-4o"
                />
              </div>
            </div>
            {testType === "manual" && (
              <>
                <div className="flex items-center gap-3">
                  <Label>Wordt je merk genoemd?</Label>
                  <Button
                    variant={testIsMentioned ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTestIsMentioned(!testIsMentioned)}
                  >
                    {testIsMentioned ? (
                      <Eye className="mr-1 h-4 w-4" />
                    ) : (
                      <EyeOff className="mr-1 h-4 w-4" />
                    )}
                    {testIsMentioned ? "Ja" : "Nee"}
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>AI-antwoord (optioneel)</Label>
                  <Textarea
                    value={testResponse}
                    onChange={(e) => setTestResponse(e.target.value)}
                    placeholder="Plak hier het AI-antwoord..."
                    rows={3}
                  />
                </div>
              </>
            )}
            {testType === "simulation" && (
              <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    Simulatie – geen bewijs van werkelijke externe AI-zichtbaarheid.
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTestDialog(false)}>
              Annuleren
            </Button>
            <Button onClick={handleCreateTest} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {testType === "simulation" ? "Simulatie starten" : "Test opslaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary Cards */}
      {results.length > 0 && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Share of AI Voice</span>
                <Brain className="h-4 w-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold">
                {summary?.shareOfAIVoice !== undefined
                  ? `${Math.round(summary.shareOfAIVoice * 100)}%`
                  : `${Math.round((results.filter(r => r.isMentioned && !r.isSimulation).length / Math.max(1, results.filter(r => !r.isSimulation).length)) * 100)}%`}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Merkvermelding</span>
                <Eye className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold">
                {Math.round((results.filter(r => r.isMentioned).length / Math.max(1, results.length)) * 100)}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Concurrent-vermelding</span>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold">—</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Simulation Disclaimer Banner */}
      {results.some(r => r.isSimulation) && (
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-purple-900 dark:text-purple-200">
              Simulatie – geen bewijs van werkelijke externe AI-zichtbaarheid.
            </p>
            <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">
              Sommige resultaten zijn gegenereerd door lokale simulatie en vertegenwoordigen geen daadwerkelijke vermeldingen in externe AI-systemen.
            </p>
          </div>
        </div>
      )}

      {/* Prompt Library Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Promptbibliotheek</CardTitle>
              <CardDescription>Beheer je testprompts</CardDescription>
            </div>
            <Dialog open={showAddPromptDialog} onOpenChange={(open) => { setShowAddPromptDialog(open); if (!open) { setPromptName(""); setPromptText(""); } }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Prompt toevoegen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nieuwe prompt</DialogTitle>
                  <DialogDescription>Voeg een prompt toe aan je bibliotheek</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Naam</Label>
                    <Input
                      value={promptName}
                      onChange={(e) => setPromptName(e.target.value)}
                      placeholder="Bijv. SEO-tools query"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Prompt</Label>
                    <Textarea
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      placeholder="Wat zijn de beste SEO-tools voor Nederlandse bedrijven?"
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddPromptDialog(false)}>
                    Annuleren
                  </Button>
                  <Button onClick={handleCreatePrompt} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Toevoegen
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {prompts.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {prompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className="flex items-center justify-between py-2 px-3 border rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{prompt.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{prompt.prompt}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeletePrompt(prompt.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nog geen prompts toegevoegd
            </p>
          )}
        </CardContent>
      </Card>

      {/* CSV Import Area */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CSV-import</CardTitle>
          <CardDescription>Importeer testresultaten vanuit een CSV-bestand</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvImport}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
            >
              {isImporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              CSV uploaden
            </Button>
            <p className="text-xs text-muted-foreground">
              Verwachte kolommen: prompt, platform, model, isMentioned, sentiment
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Results List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Testresultaten</CardTitle>
          <CardDescription>Alle uitgevoerde tests en hun resultaten</CardDescription>
        </CardHeader>
        <CardContent>
          {results.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.map((result) => (
                <div
                  key={result.id}
                  className="flex items-center gap-3 py-2 px-3 border rounded-lg"
                >
                  <div className="shrink-0">
                    {result.isMentioned ? (
                      <Eye className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{result.promptText}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {methodBadge(result.method, result.isSimulation)}
                      {result.platform && (
                        <Badge variant="outline" className="text-xs">{result.platform}</Badge>
                      )}
                      {result.model && (
                        <span className="text-xs text-muted-foreground">{result.model}</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge
                      className={
                        result.isMentioned
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                      }
                    >
                      {result.isMentioned ? "Vernoemd" : "Niet vermeld"}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(result.testDate).toLocaleDateString("nl-NL")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Brain className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Nog geen testresultaten</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                Voer een test uit om je AI-zichtbaarheid te meten.
              </p>
              <Button
                onClick={() => setShowNewTestDialog(true)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nieuwe test
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
