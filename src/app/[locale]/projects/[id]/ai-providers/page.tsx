"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Cpu,
  Zap,
  CheckCircle2,
  XCircle,
  Trash2,
  TestTube2,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

interface AIProvider {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  defaultModel: string | null;
  isActive: boolean;
  isDefault: boolean;
  maxTokens: number;
  temperature: number;
  timeout: number;
  retryAttempts: number;
  costPerToken: number;
  privacySettings: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    callLogs: number;
    promptTemplates: number;
  };
}

interface TokenUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  totalCalls: number;
}

export default function AIProvidersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: 0,
    totalCalls: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Create dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProvider, setNewProvider] = useState({
    name: "",
    type: "OLLAMA",
    baseUrl: "http://localhost:11434",
    apiKey: "",
    defaultModel: "",
    maxTokens: 4096,
    temperature: 0.7,
    timeout: 60000,
    costPerToken: 0,
    allowExternal: false,
  });

  // Test connection state
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    providerId: string;
    success: boolean;
    message: string;
    duration?: number;
  } | null>(null);

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteProviderId, setDeleteProviderId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProviders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-providers`);
      if (res.ok) {
        const data = await res.json();
        setProviders(data.data || []);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const fetchTokenUsage = useCallback(async () => {
    try {
      // Use the providers data to compute token usage from call logs
      const res = await fetch(`/api/projects/${projectId}/ai-providers`);
      if (res.ok) {
        const data = await res.json();
        const providersData = data.data || [];
        let totalInput = 0;
        let totalOutput = 0;
        let totalCost = 0;
        let totalCalls = 0;
        for (const p of providersData) {
          totalCalls += p._count?.callLogs || 0;
        }
        setTokenUsage({
          totalInputTokens: totalInput,
          totalOutputTokens: totalOutput,
          totalCost: totalCost,
          totalCalls: totalCalls,
        });
      }
    } catch {
      // silently fail
    }
  }, [projectId]);

  useEffect(() => {
    fetchProviders().then(() => fetchTokenUsage());
  }, [fetchProviders, fetchTokenUsage]);

  async function handleCreateProvider() {
    if (!newProvider.name.trim()) {
      toast.error("Naam is verplicht");
      return;
    }
    if (!newProvider.baseUrl.trim()) {
      toast.error("Basis-URL is verplicht");
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-providers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProvider.name,
          type: newProvider.type,
          baseUrl: newProvider.baseUrl,
          apiKey: newProvider.apiKey || undefined,
          defaultModel: newProvider.defaultModel || undefined,
          maxTokens: newProvider.maxTokens,
          temperature: newProvider.temperature,
          timeout: newProvider.timeout,
          costPerToken: newProvider.costPerToken,
          privacySettings: {
            allowExternal: newProvider.allowExternal,
          },
        }),
      });
      if (res.ok) {
        toast.success("Provider toegevoegd");
        setShowCreateDialog(false);
        setNewProvider({
          name: "",
          type: "OLLAMA",
          baseUrl: "http://localhost:11434",
          apiKey: "",
          defaultModel: "",
          maxTokens: 4096,
          temperature: 0.7,
          timeout: 60000,
          costPerToken: 0,
          allowExternal: false,
        });
        fetchProviders();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Fout bij toevoegen provider");
      }
    } catch {
      toast.error("Fout bij toevoegen provider");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleTestConnection(providerId: string) {
    setTestingProviderId(providerId);
    setTestResult(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/ai-providers/${providerId}/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );
      const data = await res.json();
      if (res.ok && data.data?.success) {
        setTestResult({
          providerId,
          success: true,
          message: `Verbinding succesvol (${data.data.duration}ms, ${data.data.tokens || 0} tokens)`,
          duration: data.data.duration,
        });
        toast.success("Verbinding succesvol");
      } else {
        setTestResult({
          providerId,
          success: false,
          message: data.data?.error || data.error || "Verbinding mislukt",
        });
        toast.error("Verbinding mislukt");
      }
    } catch {
      setTestResult({
        providerId,
        success: false,
        message: "Kan geen verbinding maken",
      });
      toast.error("Verbinding mislukt");
    } finally {
      setTestingProviderId(null);
    }
  }

  async function handleToggleActive(provider: AIProvider) {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/ai-providers/${provider.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !provider.isActive }),
        }
      );
      if (res.ok) {
        toast.success(
          provider.isActive ? "Provider gedeactiveerd" : "Provider geactiveerd"
        );
        fetchProviders();
      } else {
        toast.error("Fout bij bijwerken provider");
      }
    } catch {
      toast.error("Fout bij bijwerken provider");
    }
  }

  async function handleSetDefault(provider: AIProvider) {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/ai-providers/${provider.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isDefault: true }),
        }
      );
      if (res.ok) {
        toast.success("Standaardprovider ingesteld");
        fetchProviders();
      } else {
        toast.error("Fout bij instellen standaardprovider");
      }
    } catch {
      toast.error("Fout bij instellen standaardprovider");
    }
  }

  async function handleDelete() {
    if (!deleteProviderId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/ai-providers/${deleteProviderId}`,
        {
          method: "DELETE",
        }
      );
      if (res.ok) {
        toast.success("Provider verwijderd");
        fetchProviders();
      } else {
        toast.error("Fout bij verwijderen provider");
      }
    } catch {
      toast.error("Fout bij verwijderen provider");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteProviderId(null);
    }
  }

  const typeLabel = (type: string) => {
    switch (type) {
      case "OLLAMA":
        return "Ollama";
      case "OPENAI_COMPATIBLE":
        return "OpenAI-compatibel";
      case "CUSTOM":
        return "Aangepast";
      default:
        return type;
    }
  };

  const typeBadgeClass = (type: string) => {
    switch (type) {
      case "OLLAMA":
        return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800";
      case "OPENAI_COMPATIBLE":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
      case "CUSTOM":
        return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800";
      default:
        return "";
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
          <h1 className="text-2xl font-bold tracking-tight">
            AI-providers
          </h1>
          <p className="text-muted-foreground text-sm">
            Beheer je AI-providers en -instellingen
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Provider toevoegen
        </Button>
      </div>

      {/* Token Usage Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">API-aanroepen</p>
                <p className="text-2xl font-bold">{tokenUsage.totalCalls}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Cpu className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Input tokens</p>
                <p className="text-2xl font-bold">
                  {tokenUsage.totalInputTokens.toLocaleString("nl-NL")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Cpu className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Output tokens</p>
                <p className="text-2xl font-bold">
                  {tokenUsage.totalOutputTokens.toLocaleString("nl-NL")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Zap className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Totale kosten</p>
                <p className="text-2xl font-bold">
                  €{tokenUsage.totalCost.toFixed(4)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Providers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Geconfigureerde providers ({providers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {providers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Cpu className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Geen AI-providers geconfigureerd</p>
              <p className="text-sm mt-1">
                Voeg een provider toe om AI-functies te gebruiken
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naam</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Basis-URL</TableHead>
                    <TableHead>Standaardmodel</TableHead>
                    <TableHead>Actief</TableHead>
                    <TableHead>Standaard</TableHead>
                    <TableHead>Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers.map((provider) => (
                    <TableRow key={provider.id}>
                      <TableCell className="font-medium">
                        {provider.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={typeBadgeClass(provider.type)}
                        >
                          {typeLabel(provider.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {provider.baseUrl}
                      </TableCell>
                      <TableCell className="text-sm">
                        {provider.defaultModel || "—"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={provider.isActive}
                          onCheckedChange={() => handleToggleActive(provider)}
                        />
                      </TableCell>
                      <TableCell>
                        {provider.isDefault ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Standaard
                          </Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => handleSetDefault(provider)}
                          >
                            Instellen
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() =>
                              handleTestConnection(provider.id)
                            }
                            disabled={testingProviderId === provider.id}
                          >
                            {testingProviderId === provider.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <TestTube2 className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-destructive"
                            onClick={() => {
                              setDeleteProviderId(provider.id);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {testResult &&
                          testResult.providerId === provider.id && (
                            <div className="mt-1">
                              {testResult.success ? (
                                <span className="text-xs text-emerald-600 flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {testResult.message}
                                </span>
                              ) : (
                                <span className="text-xs text-red-600 flex items-center gap-1">
                                  <XCircle className="h-3 w-3" />
                                  {testResult.message}
                                </span>
                              )}
                            </div>
                          )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Provider Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Provider toevoegen</DialogTitle>
            <DialogDescription>
              Configureer een nieuwe AI-provider voor je project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Naam *</Label>
                <Input
                  value={newProvider.name}
                  onChange={(e) =>
                    setNewProvider({ ...newProvider, name: e.target.value })
                  }
                  placeholder="Bijv. Lokale Ollama"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={newProvider.type}
                  onValueChange={(val) => {
                    const updates: Partial<typeof newProvider> = { type: val };
                    if (val === "OLLAMA") {
                      updates.baseUrl = "http://localhost:11434";
                      updates.costPerToken = 0;
                    }
                    setNewProvider({ ...newProvider, ...updates });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OLLAMA">Ollama</SelectItem>
                    <SelectItem value="OPENAI_COMPATIBLE">
                      OpenAI-compatibel
                    </SelectItem>
                    <SelectItem value="CUSTOM">Aangepast</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Basis-URL *</Label>
              <Input
                value={newProvider.baseUrl}
                onChange={(e) =>
                  setNewProvider({ ...newProvider, baseUrl: e.target.value })
                }
                placeholder="http://localhost:11434"
              />
            </div>
            {newProvider.type !== "OLLAMA" && (
              <div className="space-y-2">
                <Label>API-sleutel</Label>
                <Input
                  type="password"
                  value={newProvider.apiKey}
                  onChange={(e) =>
                    setNewProvider({ ...newProvider, apiKey: e.target.value })
                  }
                  placeholder="sk-..."
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Standaardmodel</Label>
              <Input
                value={newProvider.defaultModel}
                onChange={(e) =>
                  setNewProvider({
                    ...newProvider,
                    defaultModel: e.target.value,
                  })
                }
                placeholder={
                  newProvider.type === "OLLAMA"
                    ? "Bijv. llama3.2"
                    : "Bijv. gpt-4o"
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Max tokens</Label>
                <Input
                  type="number"
                  value={newProvider.maxTokens}
                  onChange={(e) =>
                    setNewProvider({
                      ...newProvider,
                      maxTokens: parseInt(e.target.value) || 4096,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Temperatuur</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={newProvider.temperature}
                  onChange={(e) =>
                    setNewProvider({
                      ...newProvider,
                      temperature: parseFloat(e.target.value) || 0.7,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Timeout (ms)</Label>
                <Input
                  type="number"
                  value={newProvider.timeout}
                  onChange={(e) =>
                    setNewProvider({
                      ...newProvider,
                      timeout: parseInt(e.target.value) || 60000,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Kosten per token</Label>
              <Input
                type="number"
                step="0.000001"
                min="0"
                value={newProvider.costPerToken}
                onChange={(e) =>
                  setNewProvider({
                    ...newProvider,
                    costPerToken: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="0 voor lokale providers"
              />
              <p className="text-xs text-muted-foreground">
                Stel in op 0 voor lokale providers zoals Ollama
              </p>
            </div>

            <Separator />

            {/* Privacy Settings */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Privacy-instellingen</Label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">
                    Externe provider toestaan voor dit project
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Sta toe dat data naar externe AI-providers wordt verzonden
                  </p>
                </div>
                <Switch
                  checked={newProvider.allowExternal}
                  onCheckedChange={(checked) =>
                    setNewProvider({ ...newProvider, allowExternal: checked })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Annuleren
            </Button>
            <Button onClick={handleCreateProvider} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Toevoegen...
                </>
              ) : (
                "Toevoegen"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Provider verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze provider wilt verwijderen? Deze actie
              kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
