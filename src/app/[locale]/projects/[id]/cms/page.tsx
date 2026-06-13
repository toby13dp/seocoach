"use client";

import { useState, useEffect, use, useCallback } from "react";
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
  Plus,
  Loader2,
  Globe,
  Unplug,
  AlertCircle,
  Clock,
  Trash2,
  Pencil,
  TestTube2,
  CheckCircle2,
  XCircle,
  ShoppingCart,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

interface CMSConnection {
  id: string;
  name: string;
  providerType: string;
  status: string;
  baseUrl: string;
  apiKey?: string | null;
  apiSecret?: string | null;
  username?: string | null;
  capabilities?: string | null;
  lastTestedAt?: string | null;
  lastError?: string | null;
  metadata?: string | null;
  createdAt: string;
  updatedAt: string;
}

const statusBadgeConfig: Record<
  string,
  { label: string; className: string; icon: React.ElementType }
> = {
  CONNECTED: {
    label: "Verbonden",
    className:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
    icon: CheckCircle2,
  },
  DISCONNECTED: {
    label: "Verbroken",
    className:
      "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
    icon: Unplug,
  },
  ERROR: {
    label: "Fout",
    className:
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
    icon: AlertCircle,
  },
  PENDING: {
    label: "In behandeling",
    className:
      "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
    icon: Clock,
  },
};

const providerLabel: Record<string, string> = {
  WORDPRESS: "WordPress",
  WOOCOMMERCE: "WooCommerce",
  SHOPIFY: "Shopify",
  CUSTOM: "Overig",
};

export default function CMSConnectionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [connections, setConnections] = useState<CMSConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedConnection, setSelectedConnection] =
    useState<CMSConnection | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    providerType: "WORDPRESS",
    baseUrl: "",
    username: "",
    apiKey: "",
    apiSecret: "",
  });

  const fetchConnections = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/cms-connections`);
      if (res.ok) {
        const data = await res.json();
        setConnections(data.data || []);
      }
    } catch {
      toast.error("Fout bij ophalen CMS-verbindingen");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  function resetForm() {
    setFormData({
      name: "",
      providerType: "WORDPRESS",
      baseUrl: "",
      username: "",
      apiKey: "",
      apiSecret: "",
    });
  }

  function openEditDialog(conn: CMSConnection) {
    setSelectedConnection(conn);
    setFormData({
      name: conn.name,
      providerType: conn.providerType,
      baseUrl: conn.baseUrl,
      username: conn.username || "",
      apiKey: conn.apiKey || "",
      apiSecret: conn.apiSecret || "",
    });
    setShowEditDialog(true);
  }

  function openDeleteDialog(conn: CMSConnection) {
    setSelectedConnection(conn);
    setShowDeleteDialog(true);
  }

  async function handleCreate() {
    if (!formData.name.trim()) {
      toast.error("Naam is verplicht");
      return;
    }
    if (!formData.baseUrl.trim()) {
      toast.error("Basis-URL is verplicht");
      return;
    }

    setIsCreating(true);
    try {
      const body: Record<string, unknown> = {
        name: formData.name,
        providerType: formData.providerType,
        baseUrl: formData.baseUrl,
        username: formData.providerType === "WORDPRESS" ? formData.username : undefined,
        apiKey:
          formData.providerType === "WOOCOMMERCE"
            ? formData.apiKey
            : formData.providerType === "WORDPRESS"
              ? formData.apiSecret
              : undefined,
        apiSecret:
          formData.providerType === "WOOCOMMERCE"
            ? formData.apiSecret
            : undefined,
      };

      const res = await fetch(`/api/projects/${projectId}/cms-connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success("CMS-verbinding aangemaakt");
        setShowCreateDialog(false);
        resetForm();
        fetchConnections();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fout bij aanmaken verbinding");
      }
    } catch {
      toast.error("Fout bij aanmaken verbinding");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdate() {
    if (!selectedConnection) return;
    setIsUpdating(true);
    try {
      const body: Record<string, unknown> = {
        name: formData.name,
        baseUrl: formData.baseUrl,
        username:
          formData.providerType === "WORDPRESS"
            ? formData.username
            : undefined,
        apiKey:
          formData.providerType === "WOOCOMMERCE"
            ? formData.apiKey
            : formData.providerType === "WORDPRESS"
              ? formData.apiSecret
              : undefined,
        apiSecret:
          formData.providerType === "WOOCOMMERCE"
            ? formData.apiSecret
            : undefined,
      };

      const res = await fetch(
        `/api/projects/${projectId}/cms-connections/${selectedConnection.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (res.ok) {
        toast.success("Verbinding bijgewerkt");
        setShowEditDialog(false);
        setSelectedConnection(null);
        resetForm();
        fetchConnections();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fout bij bijwerken verbinding");
      }
    } catch {
      toast.error("Fout bij bijwerken verbinding");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDelete() {
    if (!selectedConnection) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/cms-connections/${selectedConnection.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success("Verbinding verwijderd");
        setShowDeleteDialog(false);
        setSelectedConnection(null);
        fetchConnections();
      } else {
        toast.error("Fout bij verwijderen verbinding");
      }
    } catch {
      toast.error("Fout bij verwijderen verbinding");
    }
  }

  async function handleTestConnection(conn: CMSConnection) {
    setTestingId(conn.id);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/cms-connections/${conn.id}/test`,
        { method: "POST" }
      );
      const data = await res.json();
      if (res.ok && data.data?.success) {
        toast.success(
          `Verbinding succesvol! ${data.data.capabilities ? Object.keys(data.data.capabilities).length + " mogelijkheden gedetecteerd" : ""}`
        );
      } else {
        toast.error(
          data.data?.message || data.error || "Verbindingstest mislukt"
        );
      }
      fetchConnections();
    } catch {
      toast.error("Fout bij testen verbinding");
    } finally {
      setTestingId(null);
    }
  }

  function parseCapabilities(capabilities: string | null | undefined): string[] {
    if (!capabilities) return [];
    try {
      const parsed = JSON.parse(capabilities);
      if (typeof parsed === "object" && parsed !== null) {
        return Object.entries(parsed)
          .filter(([, v]) => v === true)
          .map(([k]) => k);
      }
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  }

  function parseMetadata(metadata: string | null | undefined): Record<string, unknown> | null {
    if (!metadata) return null;
    try {
      return JSON.parse(metadata);
    } catch {
      return null;
    }
  }

  const isWordPress = formData.providerType === "WORDPRESS";
  const isWooCommerce = formData.providerType === "WOOCOMMERCE";

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
            CMS-verbindingen
          </h1>
          <p className="text-muted-foreground text-sm">
            Beheer je WordPress- en WooCommerce-verbindingen
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe verbinding
        </Button>
      </div>

      {/* Connections List */}
      {connections.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Globe className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="font-medium text-muted-foreground">
              Geen CMS-verbindingen gevonden
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Verbind je eerste CMS om content te publiceren.
            </p>
            <Button
              className="mt-4"
              onClick={() => { resetForm(); setShowCreateDialog(true); }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nieuwe verbinding
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {connections.map((conn) => {
            const statusConfig = statusBadgeConfig[conn.status] || statusBadgeConfig.PENDING;
            const StatusIcon = statusConfig.icon;
            const capabilities = parseCapabilities(conn.capabilities);
            const metadata = parseMetadata(conn.metadata);

            return (
              <motion.div
                key={conn.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                          {conn.providerType === "WOOCOMMERCE" ? (
                            <ShoppingCart className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {conn.name}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {providerLabel[conn.providerType] || conn.providerType}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-xs ${statusConfig.className}`}
                            >
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {statusConfig.label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestConnection(conn)}
                          disabled={testingId === conn.id}
                        >
                          {testingId === conn.id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <TestTube2 className="mr-1 h-3 w-3" />
                          )}
                          Testen
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(conn)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => openDeleteDialog(conn)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="grid gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Basis-URL:</span>
                        <span className="font-mono text-xs break-all">
                          {conn.baseUrl}
                        </span>
                      </div>
                      {conn.username && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Gebruiker:</span>
                          <span>{conn.username}</span>
                        </div>
                      )}
                      {conn.lastTestedAt && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Laatst getest:</span>
                          <span>
                            {new Date(conn.lastTestedAt).toLocaleDateString("nl-NL", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      )}
                      {conn.lastError && (
                        <div className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <span className="text-red-600 dark:text-red-400 text-xs">
                            {conn.lastError}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Provider-specific details */}
                    {conn.providerType === "WORDPRESS" && capabilities.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Gedetecteerde mogelijkheden
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {capabilities.map((cap) => (
                              <Badge
                                key={cap}
                                variant="secondary"
                                className="text-xs"
                              >
                                {cap}
                              </Badge>
                            ))}
                          </div>
                          {Boolean(metadata?.seoPlugin) && (
                            <p className="text-xs text-muted-foreground mt-2">
                              SEO-plugin:{" "}
                              <span className="font-medium">
                                {String(metadata?.seoPlugin)}
                              </span>
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    {conn.providerType === "WOOCOMMERCE" && metadata && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            WooCommerce details
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {metadata.productCount !== undefined && (
                              <Badge variant="secondary" className="text-xs">
                                {String(metadata.productCount)} producten
                              </Badge>
                            )}
                            {capabilities.length > 0 &&
                              capabilities.map((cap) => (
                                <Badge
                                  key={cap}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {cap}
                                </Badge>
                              ))}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Nieuwe CMS-verbinding</DialogTitle>
            <DialogDescription>
              Verbind je CMS-systeem om content te publiceren
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={formData.providerType}
                onValueChange={(val) =>
                  setFormData({ ...formData, providerType: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WORDPRESS">WordPress</SelectItem>
                  <SelectItem value="WOOCOMMERCE">WooCommerce</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Naam *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Bijv. Mijn WordPress-site"
              />
            </div>
            <div className="space-y-2">
              <Label>Basis-URL *</Label>
              <Input
                value={formData.baseUrl}
                onChange={(e) =>
                  setFormData({ ...formData, baseUrl: e.target.value })
                }
                placeholder="https://jouwwebsite.nl"
              />
            </div>

            {isWordPress && (
              <>
                <div className="space-y-2">
                  <Label>Gebruikersnaam</Label>
                  <Input
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    placeholder="WordPress-gebruikersnaam"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Applicatiewachtwoord</Label>
                  <Input
                    type="password"
                    value={formData.apiSecret}
                    onChange={(e) =>
                      setFormData({ ...formData, apiSecret: e.target.value })
                    }
                    placeholder="WordPress-applicatiewachtwoord"
                  />
                </div>
              </>
            )}

            {isWooCommerce && (
              <>
                <div className="space-y-2">
                  <Label>Consumer Key</Label>
                  <Input
                    value={formData.apiKey}
                    onChange={(e) =>
                      setFormData({ ...formData, apiKey: e.target.value })
                    }
                    placeholder="ck_xxxxxxxxxxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Consumer Secret</Label>
                  <Input
                    type="password"
                    value={formData.apiSecret}
                    onChange={(e) =>
                      setFormData({ ...formData, apiSecret: e.target.value })
                    }
                    placeholder="cs_xxxxxxxxxxxxxxxx"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Annuleren
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
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

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Verbinding bewerken</DialogTitle>
            <DialogDescription>
              Wijzig de instellingen van je CMS-verbinding
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Naam *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Basis-URL *</Label>
              <Input
                value={formData.baseUrl}
                onChange={(e) =>
                  setFormData({ ...formData, baseUrl: e.target.value })
                }
              />
            </div>

            {(formData.providerType === "WORDPRESS") && (
              <>
                <div className="space-y-2">
                  <Label>Gebruikersnaam</Label>
                  <Input
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Applicatiewachtwoord</Label>
                  <Input
                    type="password"
                    value={formData.apiSecret}
                    onChange={(e) =>
                      setFormData({ ...formData, apiSecret: e.target.value })
                    }
                    placeholder="Laat leeg om niet te wijzigen"
                  />
                </div>
              </>
            )}

            {(formData.providerType === "WOOCOMMERCE") && (
              <>
                <div className="space-y-2">
                  <Label>Consumer Key</Label>
                  <Input
                    value={formData.apiKey}
                    onChange={(e) =>
                      setFormData({ ...formData, apiKey: e.target.value })
                    }
                    placeholder="Laat leeg om niet te wijzigen"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Consumer Secret</Label>
                  <Input
                    type="password"
                    value={formData.apiSecret}
                    onChange={(e) =>
                      setFormData({ ...formData, apiSecret: e.target.value })
                    }
                    placeholder="Laat leeg om niet te wijzigen"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
            >
              Annuleren
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opslaan...
                </>
              ) : (
                "Opslaan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verbinding verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je &ldquo;{selectedConnection?.name}&rdquo;
              wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
