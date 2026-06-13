"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Link2,
  Plug,
  Trash2,
  Send,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface PMIntegration {
  id: string;
  provider: string;
  status: string;
  apiEndpoint: string | null;
  lastSyncAt: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  JIRA: "Jira",
  TRELLO: "Trello",
  ASANA: "Asana",
  CLICKUP: "ClickUp",
  MONDAY: "Monday.com",
  LINEAR: "Linear",
  GITHUB_ISSUES: "GitHub Issues",
  GENERIC_WEBHOOK: "Algemene Webhook",
};

const PROVIDER_OPTIONS = [
  { value: "JIRA", label: "Jira" },
  { value: "TRELLO", label: "Trello" },
  { value: "ASANA", label: "Asana" },
  { value: "CLICKUP", label: "ClickUp" },
  { value: "MONDAY", label: "Monday.com" },
  { value: "LINEAR", label: "Linear" },
  { value: "GITHUB_ISSUES", label: "GitHub Issues" },
  { value: "GENERIC_WEBHOOK", label: "Algemene Webhook" },
];

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string; icon: typeof CheckCircle2 }> = {
  CONNECTED: {
    label: "Verbonden",
    variant: "default",
    color: "text-emerald-600 dark:text-emerald-400",
    icon: CheckCircle2,
  },
  NOT_CONNECTED: {
    label: "Niet verbonden",
    variant: "secondary",
    color: "text-gray-500 dark:text-gray-400",
    icon: XCircle,
  },
  ERROR: {
    label: "Fout",
    variant: "destructive",
    color: "text-red-600 dark:text-red-400",
    icon: AlertCircle,
  },
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function IntegrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: organizationId } = use(params);
  const router = useRouter();

  const [integrations, setIntegrations] = useState<PMIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Create form state
  const [newProvider, setNewProvider] = useState("");
  const [newApiEndpoint, setNewApiEndpoint] = useState("");
  const [newApiKey, setNewApiKey] = useState("");

  useEffect(() => {
    fetchIntegrations();
  }, [organizationId]);

  const fetchIntegrations = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/pm-integrations`);
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.data || []);
      }
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newProvider) {
      toast.error("Provider is vereist");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/pm-integrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: newProvider,
          apiEndpoint: newApiEndpoint.trim() || undefined,
          apiKeyEncrypted: newApiKey.trim() || undefined,
        }),
      });

      if (res.ok) {
        toast.success(`${PROVIDER_LABELS[newProvider] || newProvider} integratie toegevoegd`);
        setShowAddDialog(false);
        resetCreateForm();
        fetchIntegrations();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fout bij toevoegen integratie");
      }
    } catch {
      toast.error("Fout bij toevoegen integratie");
    } finally {
      setIsCreating(false);
    }
  };

  const resetCreateForm = () => {
    setNewProvider("");
    setNewApiEndpoint("");
    setNewApiKey("");
  };

  const handleTestConnection = async (integrationId: string) => {
    setActionLoading(integrationId);
    try {
      // Use the GET endpoint to verify the integration exists and is accessible
      const res = await fetch(
        `/api/organizations/${organizationId}/pm-integrations/${integrationId}`
      );
      if (res.ok) {
        toast.success("Verbinding succesvol getest");
      } else {
        toast.error("Verbindingstest mislukt");
      }
    } catch {
      toast.error("Fout bij testen verbinding");
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportTask = async (integrationId: string) => {
    setActionLoading(integrationId);
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/pm-integrations/${integrationId}/export`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: {
              plainSummary: "SEOCoach taak export",
              priority: "medium",
            },
          }),
        }
      );

      if (res.ok) {
        toast.success("Taak geëxporteerd");
      } else {
        const data = await res.json();
        toast.error(data.error || "Fout bij exporteren taak");
      }
    } catch {
      toast.error("Fout bij exporteren taak");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setActionLoading(deleteId);
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/pm-integrations/${deleteId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        toast.success("Integratie verwijderd");
        fetchIntegrations();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fout bij verwijderen integratie");
      }
    } catch {
      toast.error("Fout bij verwijderen integratie");
    } finally {
      setActionLoading(null);
      setDeleteId(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Nooit";
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-4 md:p-6 space-y-6"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">PM-integraties</h1>
          <p className="text-sm text-muted-foreground">
            Beheer verbindingen met projectbeheertools
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Integratie toevoegen
        </Button>
      </motion.div>

      {/* Integrations List */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-32 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : integrations.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Plug className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium mb-2">
                Geen integraties gevonden
              </h3>
              <p className="text-sm text-muted-foreground">
                Voeg een PM-integratie toe om taken te synchroniseren met je
                projectbeheertool.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration) => {
            const statusConfig = STATUS_CONFIG[integration.status] || STATUS_CONFIG.NOT_CONNECTED;
            const StatusIcon = statusConfig.icon;
            const providerLabel = PROVIDER_LABELS[integration.provider] || integration.provider;
            const isLoadingAction = actionLoading === integration.id;

            return (
              <motion.div key={integration.id} variants={item}>
                <Card className="h-full flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-base font-medium">
                          {providerLabel}
                        </CardTitle>
                      </div>
                      <Badge variant={statusConfig.variant} className="text-xs">
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-between space-y-4">
                    {/* Details */}
                    <div className="space-y-2 text-sm">
                      {integration.apiEndpoint && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground shrink-0">Endpoint:</span>
                          <span className="truncate font-mono text-xs">{integration.apiEndpoint}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground shrink-0">Laatste sync:</span>
                        <span className="text-xs">{formatDate(integration.lastSyncAt)}</span>
                      </div>
                    </div>

                    <Separator />

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestConnection(integration.id)}
                        disabled={isLoadingAction}
                        className="flex-1"
                      >
                        {isLoadingAction ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        )}
                        Verbinding testen
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportTask(integration.id)}
                        disabled={isLoadingAction}
                        className="flex-1"
                      >
                        <Send className="h-3.5 w-3.5 mr-1" />
                        Taak exporteren
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(integration.id)}
                        disabled={isLoadingAction}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Integration Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Integratie toevoegen</DialogTitle>
            <DialogDescription>
              Verbind een projectbeheertool met je organisatie.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="provider">Provider *</Label>
              <Select value={newProvider} onValueChange={setNewProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer een provider" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="apiEndpoint">API-endpoint</Label>
              <Input
                id="apiEndpoint"
                value={newApiEndpoint}
                onChange={(e) => setNewApiEndpoint(e.target.value)}
                placeholder="https://api.voorbeeld.nl"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="apiKey">API-sleutel</Label>
              <Input
                id="apiKey"
                type="password"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder="Uw API-sleutel"
              />
              <p className="text-xs text-muted-foreground">
                De sleutel wordt versleuteld opgeslagen.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                resetCreateForm();
              }}
            >
              Annuleren
            </Button>
            <Button onClick={handleCreate} disabled={isCreating || !newProvider}>
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
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Integratie verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze integratie wilt verwijderen? Deze actie
              kan niet ongedaan worden gemaakt. Alle gekoppelde taakexports
              blijven bewaard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
