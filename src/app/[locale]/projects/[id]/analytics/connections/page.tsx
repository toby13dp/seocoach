"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Link2,
  Upload,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileUp,
  Database,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";

interface DataConnection {
  id: string;
  name: string;
  type: string;
  status: string;
  lastSync: string | null;
  createdAt: string;
}

export default function ConnectionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [connections, setConnections] = useState<DataConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [newConnection, setNewConnection] = useState({
    name: "",
    type: "",
  });
  const [csvFile, setCsvFile] = useState<File | null>(null);

  useEffect(() => {
    fetchConnections();
  }, [projectId]);

  const fetchConnections = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/analytics/connections`);
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections || []);
      }
    } catch {
      // Silently handle
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newConnection.name || !newConnection.type) {
      toast.error("Vul alle verplichte velden in");
      return;
    }

    setIsCreating(true);
    try {
      const body: { name: string; type: string; file?: File } = {
        name: newConnection.name,
        type: newConnection.type,
      };

      if (newConnection.type === "CSV_UPLOAD" && csvFile) {
        const formData = new FormData();
        formData.append("name", newConnection.name);
        formData.append("type", newConnection.type);
        formData.append("file", csvFile);

        const res = await fetch(`/api/projects/${projectId}/analytics/connections`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Aanmaken mislukt");
      } else {
        const res = await fetch(`/api/projects/${projectId}/analytics/connections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error("Aanmaken mislukt");
      }

      toast.success("Gegevensbron succesvol toegevoegd");
      setAddDialogOpen(false);
      setNewConnection({ name: "", type: "" });
      setCsvFile(null);
      fetchConnections();
    } catch {
      toast.error("Fout bij toevoegen gegevensbron");
    } finally {
      setIsCreating(false);
    }
  };

  const handleTest = async (connectionId: string) => {
    setTestingId(connectionId);
    try {
      const res = await fetch(`/api/projects/${projectId}/analytics/connections/${connectionId}/test`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          toast.success("Verbinding succesvol getest");
        } else {
          toast.error(`Test mislukt: ${data.message || "Onbekende fout"}`);
        }
      } else {
        toast.error("Kon verbinding niet testen");
      }
    } catch {
      toast.error("Fout bij testen verbinding");
    } finally {
      setTestingId(null);
    }
  };

  const handleSync = async (connectionId: string) => {
    setSyncingId(connectionId);
    try {
      const res = await fetch(`/api/projects/${projectId}/analytics/connections/${connectionId}/sync`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Synchronisatie gestart");
        fetchConnections();
      } else {
        toast.error("Kon synchronisatie niet starten");
      }
    } catch {
      toast.error("Fout bij starten synchronisatie");
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (connectionId: string) => {
    setDeletingId(connectionId);
    try {
      const res = await fetch(`/api/projects/${projectId}/analytics/connections/${connectionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Gegevensbron verwijderd");
        fetchConnections();
      } else {
        toast.error("Kon gegevensbron niet verwijderen");
      }
    } catch {
      toast.error("Fout bij verwijderen gegevensbron");
    } finally {
      setDeletingId(null);
    }
  };

  const connectionTypeIcon = (type: string) => {
    switch (type) {
      case "GOOGLE_SEARCH_CONSOLE": return <BarChart3 className="h-5 w-5 text-blue-600" />;
      case "GOOGLE_ANALYTICS_4": return <Database className="h-5 w-5 text-orange-600" />;
      case "CSV_UPLOAD": return <FileUp className="h-5 w-5 text-emerald-600" />;
      default: return <Link2 className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const connectionTypeLabel = (type: string) => {
    switch (type) {
      case "GOOGLE_SEARCH_CONSOLE": return "Google Search Console";
      case "GOOGLE_ANALYTICS_4": return "Google Analytics 4";
      case "CSV_UPLOAD": return "CSV-upload";
      default: return type;
    }
  };

  const connectionStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">Actief</Badge>;
      case "INACTIVE":
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300">Inactief</Badge>;
      case "ERROR":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Fout</Badge>;
      case "SYNCING":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">Synchroniseren</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground">{status}</Badge>;
    }
  };

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return "Nooit";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Zojuist";
    if (diffMins < 60) return `${diffMins} min. geleden`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} uur geleden`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} dag${diffDays > 1 ? "en" : ""} geleden`;
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
          onClick={() => router.push(`/projects/${projectId}/analytics`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Gegevensbronnen</h1>
          <p className="text-sm text-muted-foreground">
            Beheer je gegevensverbindingen voor zoekprestaties
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Bron toevoegen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gegevensbron toevoegen</DialogTitle>
              <DialogDescription>
                Koppel een gegevensbron om zoekprestaties te volgen
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="conn-name">Naam</Label>
                <Input
                  id="conn-name"
                  placeholder="Bijv. Mijn website GSC"
                  value={newConnection.name}
                  onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conn-type">Type</Label>
                <Select
                  value={newConnection.type}
                  onValueChange={(val) => setNewConnection({ ...newConnection, type: val })}
                >
                  <SelectTrigger id="conn-type">
                    <SelectValue placeholder="Selecteer type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GOOGLE_SEARCH_CONSOLE">Google Search Console</SelectItem>
                    <SelectItem value="GOOGLE_ANALYTICS_4">Google Analytics 4</SelectItem>
                    <SelectItem value="CSV_UPLOAD">CSV-upload</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newConnection.type === "CSV_UPLOAD" && (
                <div className="space-y-2">
                  <Label>CSV-bestand</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-emerald-400 transition-colors">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <Label htmlFor="csv-upload-conn" className="cursor-pointer">
                      <span className="text-sm text-primary underline">
                        {csvFile ? csvFile.name : "Kies een CSV-bestand of sleep het hierheen"}
                      </span>
                      <Input
                        id="csv-upload-conn"
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                      />
                    </Label>
                    <p className="text-xs text-muted-foreground mt-2">
                      Ondersteunt CSV-bestanden met zoekprestatiegegevens
                    </p>
                  </div>
                </div>
              )}

              {(newConnection.type === "GOOGLE_SEARCH_CONSOLE" || newConnection.type === "GOOGLE_ANALYTICS_4") && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-4">
                  <div className="flex gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">OAuth-instelling vereist</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                        Om {connectionTypeLabel(newConnection.type)} te koppelen, moet je eerst de OAuth-verbinding configureren in de instellingen. Deze koppeling wordt als concept opgeslagen totdat de OAuth-authenticatie is voltooid.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Annuleren
              </Button>
              <Button onClick={handleCreate} disabled={isCreating || !newConnection.name || !newConnection.type}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Toevoegen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Connections List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-16 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : connections.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Link2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Geen gegevensbronnen</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                Voeg een gegevensbron toe om te beginnen met het verzamelen van zoekprestatiegegevens.
              </p>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Bron toevoegen
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {connections.map((conn) => (
            <Card key={conn.id}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 mt-0.5">
                    {connectionTypeIcon(conn.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{conn.name}</h3>
                      {connectionStatusBadge(conn.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {connectionTypeLabel(conn.type)}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Laatste sync: {formatTimeAgo(conn.lastSync)}</span>
                      <span>Aangemaakt: {new Date(conn.createdAt).toLocaleDateString("nl-NL")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(conn.id)}
                      disabled={testingId === conn.id}
                    >
                      {testingId === conn.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      <span className="ml-1 hidden sm:inline">Testen</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(conn.id)}
                      disabled={syncingId === conn.id}
                    >
                      {syncingId === conn.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-1 hidden sm:inline">Sync</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(conn.id)}
                      disabled={deletingId === conn.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      {deletingId === conn.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
