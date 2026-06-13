"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "@/i18n/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plug,
  Search,
  BarChart3,
  MapPin,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  Settings,
  Unplug,
} from "lucide-react";
import { useSession } from "next-auth/react";
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

// ============================================================================
// Types
// ============================================================================

interface GoogleConnectionStatus {
  connectionId: string;
  type: string;
  name: string;
  status: string;
  connected: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  nextSyncAt: string | null;
  serviceName: string;
  grantedScopes: string[];
  isTokenExpired: boolean;
  propertyId: string | null;
}

interface AvailableService {
  type: string;
  name: string;
  description: string;
  requiredScope: string;
  connected: boolean;
}

interface GooglePropertiesResponse {
  id: string;
  name: string;
  type: string;
  permissionLevel?: string;
  accountId?: string;
  locations?: { id: string; name: string; storeCode: string | null }[];
}

// ============================================================================
// Service Icons & Colors
// ============================================================================

const SERVICE_CONFIG: Record<string, { icon: typeof Search; color: string; bgColor: string }> = {
  GOOGLE_SEARCH_CONSOLE: { icon: Search, color: "text-blue-600", bgColor: "bg-blue-50" },
  GOOGLE_ANALYTICS_4: { icon: BarChart3, color: "text-orange-600", bgColor: "bg-orange-50" },
  GOOGLE_BUSINESS_PROFILE: { icon: MapPin, color: "text-green-600", bgColor: "bg-green-50" },
};

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  CONNECTED: { label: "Verbonden", variant: "default" },
  PENDING: { label: "In afwachting", variant: "secondary" },
  DISCONNECTED: { label: "Niet verbonden", variant: "outline" },
  ERROR: { label: "Fout", variant: "destructive" },
  EXPIRED: { label: "Verlopen", variant: "destructive" },
};

// ============================================================================
// Main Page Component
// ============================================================================

export default function IntegrationsPage() {
  const t = useTranslations("nav");
  const { data: session } = useSession();

  const [connections, setConnections] = useState<GoogleConnectionStatus[]>([]);
  const [availableServices, setAvailableServices] = useState<AvailableService[]>([]);
  const [isGoogleConfigured, setIsGoogleConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [expandedConnection, setExpandedConnection] = useState<string | null>(null);

  // Property selection dialog
  const [propertyDialog, setPropertyDialog] = useState<{
    open: boolean;
    connectionId: string;
    connectionType: string;
    properties: GooglePropertiesResponse[];
    selectedProperty: string | null;
    loading: boolean;
    projectId: string | null;
  }>({
    open: false,
    connectionId: "",
    connectionType: "",
    properties: [],
    selectedProperty: null,
    loading: false,
    projectId: null,
  });

  // Disconnect confirmation dialog
  const [disconnectDialog, setDisconnectDialog] = useState<{
    open: boolean;
    connectionId: string;
    connectionName: string;
    loading: boolean;
  }>({
    open: false,
    connectionId: "",
    connectionName: "",
    loading: false,
  });

  // Error/success messages from URL params (after OAuth callback)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Get current project ID (use first project for now, or from URL)
  const [projectId, setProjectId] = useState<string | null>(null);

  // ============================================================================
  // Load project and connections
  // ============================================================================

  useEffect(() => {
    // Check for OAuth callback messages
    const params = new URLSearchParams(window.location.search);
    const googleError = params.get("google_error");
    const googleConnected = params.get("google_connected");

    if (googleError) {
      setMessage({ type: "error", text: decodeURIComponent(googleError) });
      window.history.replaceState({}, "", "/nl/integrations");
    } else if (googleConnected) {
      setMessage({
        type: "success",
        text: `Google ${googleConnected === "all" ? "" : decodeURIComponent(googleConnected) + " "}succesvol gekoppeld!`,
      });
      window.history.replaceState({}, "", "/nl/integrations");
    }
  }, []);

  useEffect(() => {
    loadProjectId();
  }, []);

  useEffect(() => {
    if (projectId) {
      loadConnections();
    }
  }, [projectId]);

  const loadProjectId = async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        const projects = data.data ?? data;
        if (projects.length > 0) {
          setProjectId(projects[0].id);
        }
      }
    } catch {
      // Silently fail
    }
  };

  const loadConnections = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/google/oauth/status?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setConnections(data.data?.connections ?? []);
        setAvailableServices(data.data?.availableServices ?? []);
        setIsGoogleConfigured(data.data?.isGoogleConfigured ?? false);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // ============================================================================
  // Google OAuth Connect
  // ============================================================================

  const handleConnect = async (service: string) => {
    if (!projectId) return;
    setConnecting(service);

    try {
      const res = await fetch(
        `/api/google/oauth/authorize?projectId=${projectId}&service=${service}`
      );

      if (res.ok) {
        const data = await res.json();
        // Redirect user to Google's authorization page
        window.location.href = data.data.authorizationUrl;
      } else {
        const error = await res.json();
        setMessage({ type: "error", text: error.error ?? "Kon geen autorisatie-URL genereren." });
        setConnecting(null);
      }
    } catch {
      setMessage({ type: "error", text: "Er is een netwerkfout opgetreden." });
      setConnecting(null);
    }
  };

  // ============================================================================
  // Property Selection
  // ============================================================================

  const handleSelectProperty = async (connectionId: string, connectionType: string) => {
    if (!projectId) return;

    setPropertyDialog((prev) => ({
      ...prev,
      open: true,
      connectionId,
      connectionType,
      loading: true,
      properties: [],
      selectedProperty: null,
      projectId,
    }));

    try {
      const res = await fetch(
        `/api/google/oauth/properties?projectId=${projectId}&connectionId=${connectionId}`
      );
      if (res.ok) {
        const data = await res.json();
        setPropertyDialog((prev) => ({
          ...prev,
          properties: data.data?.properties ?? [],
          loading: false,
        }));
      } else {
        const error = await res.json();
        setMessage({ type: "error", text: error.error ?? "Kon properties niet ophalen." });
        setPropertyDialog((prev) => ({ ...prev, open: false, loading: false }));
      }
    } catch {
      setMessage({ type: "error", text: "Er is een netwerkfout opgetreden." });
      setPropertyDialog((prev) => ({ ...prev, open: false, loading: false }));
    }
  };

  const confirmPropertySelection = async () => {
    if (!propertyDialog.selectedProperty || !projectId) return;

    setPropertyDialog((prev) => ({ ...prev, loading: true }));

    try {
      // Update the data connection with the selected property
      const res = await fetch(
        `/api/projects/${projectId}/data-connections/${propertyDialog.connectionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            config: {
              propertyId: propertyDialog.selectedProperty,
              autoSync: true,
            },
          }),
        }
      );

      if (res.ok) {
        setMessage({ type: "success", text: "Property succesvol geselecteerd!" });
        loadConnections();
      } else {
        setMessage({ type: "error", text: "Kon property niet opslaan." });
      }
    } catch {
      setMessage({ type: "error", text: "Er is een netwerkfout opgetreden." });
    } finally {
      setPropertyDialog((prev) => ({ ...prev, open: false, loading: false }));
    }
  };

  // ============================================================================
  // Sync
  // ============================================================================

  const handleSync = async (connectionId: string) => {
    if (!projectId) return;
    setSyncing(connectionId);

    try {
      const res = await fetch(
        `/api/projects/${projectId}/data-connections/${connectionId}/sync`,
        { method: "POST" }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.data?.success) {
          setMessage({ type: "success", text: data.data.message });
        } else {
          setMessage({ type: "error", text: data.data?.message ?? "Synchronisatie mislukt." });
        }
        loadConnections();
      } else {
        setMessage({ type: "error", text: "Synchronisatie mislukt." });
      }
    } catch {
      setMessage({ type: "error", text: "Er is een netwerkfout opgetreden." });
    } finally {
      setSyncing(null);
    }
  };

  // ============================================================================
  // Disconnect
  // ============================================================================

  const handleDisconnect = async () => {
    if (!projectId || !disconnectDialog.connectionId) return;

    setDisconnectDialog((prev) => ({ ...prev, loading: true }));

    try {
      const res = await fetch("/api/google/oauth/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: disconnectDialog.connectionId,
          projectId,
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Google-verbinding succesvol verbroken." });
        loadConnections();
      } else {
        const error = await res.json();
        setMessage({ type: "error", text: error.error ?? "Kon verbinding niet verbreken." });
      }
    } catch {
      setMessage({ type: "error", text: "Er is een netwerkfout opgetreden." });
    } finally {
      setDisconnectDialog((prev) => ({ ...prev, open: false, loading: false }));
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  const formatDate = (date: string | null) => {
    if (!date) return "Nooit";
    return new Date(date).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("integrations")}</h1>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-lg flex items-center gap-3 ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.type === "success" ? (
              <Check className="h-5 w-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
            )}
            <span className="text-sm">{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-auto">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Google Integration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plug className="h-5 w-5 text-primary" />
            Google-integraties
          </CardTitle>
          <CardDescription>
            Koppel je Google-account om automatisch gegevens op te halen van Search Console,
            Analytics 4 en Bedrijfsprofiel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isGoogleConfigured && (
            <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Google OAuth niet geconfigureerd</span>
              </div>
              <p>
                Stel <code className="bg-yellow-100 px-1 rounded">GOOGLE_CLIENT_ID</code> en{" "}
                <code className="bg-yellow-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code> in
                je <code className="bg-yellow-100 px-1 rounded">.env</code> bestand om
                Google-integraties te activeren. Raadpleeg de documentatie voor instructies.
              </p>
            </div>
          )}

          {/* Available Services */}
          <div className="space-y-3">
            {availableServices.map((service) => {
              const config = SERVICE_CONFIG[service.type];
              const Icon = config?.icon ?? Plug;
              const existingConnection = connections.find((c) => c.type === service.type);
              const isExpanded = expandedConnection === service.type;

              return (
                <div
                  key={service.type}
                  className="border rounded-lg overflow-hidden"
                >
                  {/* Service Header */}
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config?.bgColor ?? "bg-gray-50"}`}>
                        <Icon className={`h-5 w-5 ${config?.color ?? "text-gray-600"}`} />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">{service.name}</h3>
                        <p className="text-xs text-muted-foreground">{service.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {existingConnection?.connected ? (
                        <>
                          <Badge variant={STATUS_MAP[existingConnection.status]?.variant ?? "outline"}>
                            {STATUS_MAP[existingConnection.status]?.label ?? existingConnection.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedConnection(isExpanded ? null : service.type)
                            }
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleConnect(service.type === "GOOGLE_SEARCH_CONSOLE" ? "search_console" : service.type === "GOOGLE_ANALYTICS_4" ? "analytics" : "business_profile")}
                          disabled={!isGoogleConfigured || connecting === service.type}
                        >
                          {connecting === service.type ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <ExternalLink className="h-4 w-4 mr-1" />
                          )}
                          Koppelen
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Connection Details */}
                  <AnimatePresence>
                    {isExpanded && existingConnection && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t bg-gray-50/50"
                      >
                        <div className="p-4 space-y-3">
                          {/* Property Selection */}
                          {!existingConnection.propertyId && (
                            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <Settings className="h-4 w-4" />
                                <span className="font-medium">Selecteer een property</span>
                              </div>
                              <p className="mb-2">
                                Je Google-account is gekoppeld, maar je hebt nog geen property geselecteerd.
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleSelectProperty(
                                    existingConnection.connectionId,
                                    existingConnection.type
                                  )
                                }
                              >
                                Property selecteren
                              </Button>
                            </div>
                          )}

                          {existingConnection.propertyId && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground">Property:</span>
                              <code className="bg-white px-2 py-0.5 rounded border text-xs">
                                {existingConnection.propertyId}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleSelectProperty(
                                    existingConnection.connectionId,
                                    existingConnection.type
                                  )
                                }
                              >
                                Wijzigen
                              </Button>
                            </div>
                          )}

                          {/* Granted Scopes */}
                          {existingConnection.grantedScopes.length > 0 && (
                            <div className="flex items-start gap-2 text-sm">
                              <span className="text-muted-foreground whitespace-nowrap">Rechten:</span>
                              <div className="flex flex-wrap gap-1">
                                {existingConnection.grantedScopes.map((scope) => (
                                  <Badge key={scope} variant="secondary" className="text-xs">
                                    {scope}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Sync Info */}
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Laatste synchronisatie:</span>
                              <p className="font-medium">{formatDate(existingConnection.lastSyncAt)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Volgende synchronisatie:</span>
                              <p className="font-medium">{formatDate(existingConnection.nextSyncAt)}</p>
                            </div>
                          </div>

                          {existingConnection.lastSyncError && (
                            <div className="p-2 rounded text-sm bg-red-50 text-red-700 border border-red-200">
                              {existingConnection.lastSyncError}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-2 pt-2">
                            <Button
                              size="sm"
                              onClick={() => handleSync(existingConnection.connectionId)}
                              disabled={
                                syncing === existingConnection.connectionId ||
                                !existingConnection.propertyId
                              }
                            >
                              {syncing === existingConnection.connectionId ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4 mr-1" />
                              )}
                              Synchroniseren
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setDisconnectDialog({
                                  open: true,
                                  connectionId: existingConnection.connectionId,
                                  connectionName: existingConnection.serviceName,
                                  loading: false,
                                })
                              }
                            >
                              <Unplug className="h-4 w-4 mr-1" />
                              Ontkoppelen
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connect All Google Services */}
      {isGoogleConfigured && connections.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-sm">Alle Google-services koppelen</h3>
                <p className="text-xs text-muted-foreground">
                  Koppel alle Google-services tegelijk met een enkele autorisatie.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleConnect("all")}
                disabled={connecting !== null}
              >
                {connecting === "all" ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-1" />
                )}
                Alles koppelen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Property Selection Dialog */}
      <Dialog
        open={propertyDialog.open}
        onOpenChange={(open) =>
          setPropertyDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Selecteer een property</DialogTitle>
            <DialogDescription>
              Kies de {propertyDialog.connectionType === "GOOGLE_SEARCH_CONSOLE" ? "website" : "property"} die je wilt koppelen aan dit project.
            </DialogDescription>
          </DialogHeader>

          {propertyDialog.loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : propertyDialog.properties.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Geen properties gevonden. Zorg ervoor dat je toegang hebt tot een Google-property.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {propertyDialog.properties.map((prop) => (
                <button
                  key={prop.id}
                  onClick={() =>
                    setPropertyDialog((prev) => ({
                      ...prev,
                      selectedProperty: prev.selectedProperty === prop.id ? null : prop.id,
                    }))
                  }
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    propertyDialog.selectedProperty === prop.id
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium text-sm">{prop.name}</div>
                  <div className="text-xs text-muted-foreground">{prop.id}</div>
                  {prop.type && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {prop.type}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPropertyDialog((prev) => ({ ...prev, open: false }))}
            >
              Annuleren
            </Button>
            <Button
              onClick={confirmPropertySelection}
              disabled={!propertyDialog.selectedProperty || propertyDialog.loading}
            >
              {propertyDialog.loading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : null}
              Selecteren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation Dialog */}
      <Dialog
        open={disconnectDialog.open}
        onOpenChange={(open) =>
          setDisconnectDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Google-verbinding ontkoppelen</DialogTitle>
            <DialogDescription>
              Weet je zeker dat je <strong>{disconnectDialog.connectionName}</strong> wilt ontkoppelen?
              Automatische synchronisatie wordt gestopt en opgeslagen tokens worden verwijderd.
              Bestaande gesynchroniseerde gegevens blijven bewaard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDisconnectDialog((prev) => ({ ...prev, open: false }))
              }
            >
              Annuleren
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={disconnectDialog.loading}
            >
              {disconnectDialog.loading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Unplug className="h-4 w-4 mr-1" />
              )}
              Ontkoppelen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
