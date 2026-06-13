"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Globe,
  AlertTriangle,
  Loader2,
  Map,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";

// --- Types ---
type MigrationProjectStatus =
  | "PLANNING"
  | "CRAWLING_OLD"
  | "CRAWLING_NEW"
  | "MAPPING"
  | "PRE_LAUNCH"
  | "LIVE"
  | "POST_LAUNCH"
  | "COMPLETED";

interface MigrationProject {
  id: string;
  name: string;
  description: string | null;
  oldSiteUrl: string;
  newSiteUrl: string;
  status: MigrationProjectStatus;
  oldUrlCount: number;
  mappedCount: number;
  blockerCount: number;
  plannedLaunchDate: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<
  MigrationProjectStatus,
  { label: string; color: string; bgColor: string }
> = {
  PLANNING: { label: "Planning", color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800" },
  CRAWLING_OLD: { label: "Oude site crawlen", color: "text-yellow-700 dark:text-yellow-400", bgColor: "bg-yellow-100 dark:bg-yellow-900/40 border-yellow-200 dark:border-yellow-800" },
  CRAWLING_NEW: { label: "Nieuwe site crawlen", color: "text-yellow-700 dark:text-yellow-400", bgColor: "bg-yellow-100 dark:bg-yellow-900/40 border-yellow-200 dark:border-yellow-800" },
  MAPPING: { label: "URL-mapping", color: "text-amber-700 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800" },
  PRE_LAUNCH: { label: "Pre-launch", color: "text-orange-700 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-900/40 border-orange-200 dark:border-orange-800" },
  LIVE: { label: "Live", color: "text-green-700 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/40 border-green-200 dark:border-green-800" },
  POST_LAUNCH: { label: "Post-launch monitoring", color: "text-emerald-700 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800" },
  COMPLETED: { label: "Voltooid", color: "text-emerald-700 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800" },
};

export default function MigrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [migrations, setMigrations] = useState<MigrationProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formOldUrl, setFormOldUrl] = useState("");
  const [formNewUrl, setFormNewUrl] = useState("");
  const [formLaunchDate, setFormLaunchDate] = useState("");

  useEffect(() => {
    fetchMigrations();
  }, [projectId]);

  const fetchMigrations = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/migrations`);
      if (res.ok) {
        const data = await res.json();
        setMigrations(data.migrations || []);
      }
    } catch {
      // Silently handle
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMigration = async () => {
    if (!formName.trim() || !formOldUrl.trim() || !formNewUrl.trim()) {
      toast.error("Vul alle verplichte velden in");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/migrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          oldSiteUrl: formOldUrl,
          newSiteUrl: formNewUrl,
          plannedLaunchDate: formLaunchDate || undefined,
        }),
      });
      if (res.ok) {
        toast.success("Migratie aangemaakt");
        setDialogOpen(false);
        setFormName("");
        setFormOldUrl("");
        setFormNewUrl("");
        setFormLaunchDate("");
        fetchMigrations();
      } else {
        const data = await res.json();
        toast.error(data.error || "Kon migratie niet aanmaken");
      }
    } catch {
      toast.error("Fout bij aanmaken migratie");
    } finally {
      setIsCreating(false);
    }
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
          onClick={() => router.push(`/projects/${projectId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Migraties</h1>
          <p className="text-sm text-muted-foreground">
            Beheer websitemigraties met URL-mapping en pre-launch controles
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nieuwe migratie
        </Button>
      </div>

      {/* Migration Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-32 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : migrations.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Rocket className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Geen migraties gevonden</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Maak je eerste migratie aan om URL-mapping en lanceringcontroles te starten.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nieuwe migratie
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {migrations.map((migration, index) => {
            const statusConfig = STATUS_CONFIG[migration.status];
            const progressPercent =
              migration.oldUrlCount > 0
                ? Math.round((migration.mappedCount / migration.oldUrlCount) * 100)
                : 0;

            return (
              <motion.div
                key={migration.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={`/projects/${projectId}/migrations/${migration.id}`}>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base font-semibold leading-tight">
                          {migration.name}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className={`text-[10px] whitespace-nowrap shrink-0 ${statusConfig.color} ${statusConfig.bgColor}`}
                        >
                          {statusConfig.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* URL flow */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate max-w-[120px]" title={migration.oldSiteUrl}>
                          {migration.oldSiteUrl}
                        </span>
                        <ArrowRight className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[120px]" title={migration.newSiteUrl}>
                          {migration.newSiteUrl}
                        </span>
                      </div>

                      {/* Progress */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            <Map className="h-3 w-3 inline mr-1" />
                            URL-mapping
                          </span>
                          <span className="font-medium">
                            {migration.mappedCount}/{migration.oldUrlCount}
                          </span>
                        </div>
                        <Progress value={progressPercent} className="h-2" />
                      </div>

                      {/* Blocker count */}
                      {migration.blockerCount > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span className="font-medium">
                            {migration.blockerCount} lanceringblokkade{migration.blockerCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}

                      {/* Launch date */}
                      {migration.plannedLaunchDate && (
                        <div className="text-xs text-muted-foreground">
                          <Globe className="h-3 w-3 inline mr-1" />
                          Gepland: {new Date(migration.plannedLaunchDate).toLocaleDateString("nl-NL")}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* New Migration Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nieuwe migratie</DialogTitle>
            <DialogDescription>
              Maak een nieuw migratieproject aan om URL-mapping en controles te starten.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="migration-name">Naam *</Label>
              <Input
                id="migration-name"
                placeholder="Bijv. Website migratie 2025"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="old-url">Oude site URL *</Label>
              <Input
                id="old-url"
                placeholder="https://oud.voorbeeld.nl"
                value={formOldUrl}
                onChange={(e) => setFormOldUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-url">Nieuwe site URL *</Label>
              <Input
                id="new-url"
                placeholder="https://nieuw.voorbeeld.nl"
                value={formNewUrl}
                onChange={(e) => setFormNewUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="launch-date">Geplande lanceringdatum</Label>
              <Input
                id="launch-date"
                type="date"
                value={formLaunchDate}
                onChange={(e) => setFormLaunchDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={handleCreateMigration} disabled={isCreating}>
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Aanmaken
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
