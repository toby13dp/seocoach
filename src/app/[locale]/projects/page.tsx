"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "@/i18n/client";
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
import { motion } from "framer-motion";
import {
  Plus,
  FolderKanban,
  Globe,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string | null;
  status: string;
  onboardingCompleted: boolean;
  onboardingStep: number;
  createdAt: string;
}

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

export default function ProjectsPage() {
  const router = useRouter();
  const t = useTranslations("project");
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // New project form
  const [newName, setNewName] = useState("");
  const [newWebsite, setNewWebsite] = useState("");

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          websiteUrl: newWebsite || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDialogOpen(false);
        setNewName("");
        setNewWebsite("");
        // Redirect to onboarding
        router.push(`/onboarding?projectId=${data.project.id}`);
      }
    } catch {
      // silently fail
    } finally {
      setIsCreating(false);
    }
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case "ACTIVE": return "default";
      case "PAUSED": return "secondary";
      case "ARCHIVED": return "outline";
      default: return "secondary";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "ACTIVE": return t("active");
      case "PAUSED": return t("paused");
      case "ARCHIVED": return t("archived");
      default: return status;
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-4 md:p-6 space-y-6"
    >
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("create")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("create")}</DialogTitle>
              <DialogDescription>
                Maak een nieuw project aan om te beginnen met SEO-automatisering.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">{t("name")}</Label>
                <Input
                  id="project-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Bijv. Mijn Website"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-website">{t("website")}</Label>
                <Input
                  id="project-website"
                  type="url"
                  value={newWebsite}
                  onChange={(e) => setNewWebsite(e.target.value)}
                  placeholder="https://www.voorbeeld.nl"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateProject}
                disabled={!newName.trim() || isCreating}
              >
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <motion.div variants={item}>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderKanban className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold">{t("noProjects")}</h3>
              <p className="text-muted-foreground text-sm mt-1">{t("createFirst")}</p>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("create")}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <motion.div key={project.id} variants={item}>
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <Badge variant={statusVariant(project.status) as "default" | "secondary" | "outline"}>
                      {statusLabel(project.status)}
                    </Badge>
                  </div>
                  {project.websiteUrl && (
                    <CardDescription className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {project.websiteUrl}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {project.onboardingCompleted ? (
                      <Badge variant="default" className="text-xs bg-emerald-600">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {t("onboardingComplete")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        {t("onboardingIncomplete")}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
