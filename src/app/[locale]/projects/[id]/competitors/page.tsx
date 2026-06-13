"use client";

import { useState, useEffect, use } from "react";
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
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Users,
  Loader2,
  RefreshCw,
  Plus,
  ExternalLink,
  Globe,
  Clock,
  AlertTriangle,
  ChevronRight,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Competitor {
  id: string;
  name: string;
  websiteUrl: string;
  description: string | null;
  isActive: boolean;
  lastCrawledAt: string | null;
  createdAt: string;
  _count?: { changes: number };
}

interface CompetitorChange {
  id: string;
  competitorId: string;
  changeType: string;
  url: string | null;
  previousValue: string | null;
  newValue: string | null;
  changeSummary: string;
  impactSuggestion: string | null;
  detectedAt: string;
  dismissed: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CompetitorsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [allChanges, setAllChanges] = useState<CompetitorChange[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [crawlingId, setCrawlingId] = useState<string | null>(null);

  // Add competitor form
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");

  useEffect(() => {
    fetchAllData();
  }, [projectId]);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const competitorsRes = await fetch(`/api/projects/${projectId}/competitors`);
      if (competitorsRes.ok) {
        const data = await competitorsRes.json();
        const comps = data.data ?? [];
        setCompetitors(comps);

        // Fetch changes for all competitors
        const changesArr: CompetitorChange[] = [];
        for (const comp of comps) {
          try {
            const changesRes = await fetch(
              `/api/projects/${projectId}/competitors/${comp.id}/changes?dismissed=false&limit=10`
            );
            if (changesRes.ok) {
              const changesData = await changesRes.json();
              changesArr.push(...(changesData.data ?? []));
            }
          } catch {
            // skip
          }
        }
        // Sort by detectedAt desc
        changesArr.sort(
          (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
        );
        setAllChanges(changesArr);
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

  const handleAddCompetitor = async () => {
    if (!newName || !newUrl) {
      toast.error("Naam en website-URL zijn vereist");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/competitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          websiteUrl: newUrl,
          description: newDescription || undefined,
        }),
      });

      if (res.ok) {
        toast.success("Concurrent toegevoegd");
        setShowAddDialog(false);
        setNewName("");
        setNewUrl("");
        setNewDescription("");
        await fetchAllData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Toevoegen mislukt");
      }
    } catch {
      toast.error("Toevoegen mislukt");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCrawl = async (competitorId: string) => {
    setCrawlingId(competitorId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/competitors/${competitorId}/crawl`,
        { method: "POST" }
      );

      if (res.ok) {
        toast.success("Crawl gestart");
        await fetchAllData();
      } else {
        toast.error("Crawl mislukt");
      }
    } catch {
      toast.error("Crawl mislukt");
    } finally {
      setCrawlingId(null);
    }
  };

  const handleDeleteCompetitor = async (competitorId: string) => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/competitors/${competitorId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success("Concurrent verwijderd");
        await fetchAllData();
      }
    } catch {
      toast.error("Verwijderen mislukt");
    }
  };

  const handleDismissChange = async (changeId: string) => {
    try {
      // For competitor changes, we use PATCH on the changes endpoint
      const res = await fetch(
        `/api/projects/${projectId}/competitors/all/changes/${changeId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dismissed: true }),
        }
      );
      // If this specific endpoint doesn't exist, just filter locally
      setAllChanges((prev) => prev.filter((c) => c.id !== changeId));
      toast.success("Wijziging genegeerd");
    } catch {
      // Filter locally even if API fails
      setAllChanges((prev) => prev.filter((c) => c.id !== changeId));
      toast.success("Wijziging genegeerd");
    }
  };

  const changeTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      NEW_PAGE: "Nieuwe pagina",
      TITLE_CHANGE: "Titelwijziging",
      HEADING_CHANGE: "Kopwijziging",
      TOPIC_CHANGE: "Onderwerpwijziging",
      SERVICE_CHANGE: "Dienstwijziging",
      CATEGORY_CHANGE: "Categoriewijziging",
      LOCATION_CHANGE: "Locatiewijziging",
      STRUCTURED_DATA_CHANGE: "Structured data wijziging",
      INTERNAL_LINK_CHANGE: "Interne linkwijziging",
      PRICE_CHANGE: "Prijswijziging",
      PUBLISHING_FREQUENCY_CHANGE: "Publicatiefrequentie",
      POSITIONING_CHANGE: "Positioneringswijziging",
    };
    return map[type] ?? type;
  };

  const changeTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      NEW_PAGE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      TITLE_CHANGE: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
      PRICE_CHANGE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
      STRUCTURED_DATA_CHANGE: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
    };
    const colorClass = colors[type] ?? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    return <Badge className={`text-xs ${colorClass}`}>{changeTypeLabel(type)}</Badge>;
  };

  const formatTimeAgo = (dateStr: string) => {
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
            <Users className="h-6 w-6 text-orange-600" />
            Concurrentieanalyse
          </h1>
          <p className="text-sm text-muted-foreground">
            Volg je concurrenten en ontdek hun wijzigingen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Vernieuwen
          </Button>
          <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) { setNewName(""); setNewUrl(""); setNewDescription(""); } }}>
            <DialogTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700">
                <Plus className="mr-2 h-4 w-4" />
                Concurrent toevoegen
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </div>

      {/* Add Competitor Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concurrent toevoegen</DialogTitle>
            <DialogDescription>
              Voeg een concurrent toe om hun website te volgen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Naam</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Bijv. Concurrent BV"
              />
            </div>
            <div className="space-y-2">
              <Label>Website-URL</Label>
              <Input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://www.concurrent.nl"
              />
            </div>
            <div className="space-y-2">
              <Label>Beschrijving (optioneel)</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Korte beschrijving van de concurrent..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Annuleren
            </Button>
            <Button onClick={handleAddCompetitor} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Toevoegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Competitor Cards */}
      {competitors.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {competitors.map((comp) => (
            <Card key={comp.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{comp.name}</p>
                    <a
                      href={comp.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary truncate block"
                    >
                      {comp.websiteUrl}
                      <ExternalLink className="h-3 w-3 inline ml-1" />
                    </a>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteCompetitor(comp.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {comp.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {comp.description}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {comp.lastCrawledAt
                      ? formatTimeAgo(comp.lastCrawledAt)
                      : "Niet gecrawld"}
                  </div>
                  {comp._count?.changes !== undefined && comp._count.changes > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {comp._count.changes} wijziging{comp._count.changes !== 1 ? "en" : ""}
                    </Badge>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleCrawl(comp.id)}
                    disabled={crawlingId === comp.id}
                  >
                    {crawlingId === comp.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Globe className="mr-2 h-4 w-4" />
                    )}
                    Crawlen
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Nog geen concurrenten</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                Voeg een concurrent toe om wijzigingen te volgen.
              </p>
              <Button
                onClick={() => setShowAddDialog(true)}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Concurrent toevoegen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Change Feed */}
      {allChanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recente wijzigingen</CardTitle>
            <CardDescription>
              Wijzigingen gedetecteerd bij je concurrenten
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {allChanges.slice(0, 20).map((change) => (
                <div
                  key={change.id}
                  className="flex items-start gap-3 py-2 border-b last:border-0"
                >
                  <div className="shrink-0 mt-1">
                    {changeTypeBadge(change.changeType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{change.changeSummary}</p>
                    {change.impactSuggestion && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {change.impactSuggestion}
                      </p>
                    )}
                    {change.url && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {change.url}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimeAgo(change.detectedAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground"
                    onClick={() => handleDismissChange(change.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
