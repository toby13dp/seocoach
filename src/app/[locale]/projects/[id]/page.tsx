"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { useTranslations } from "@/i18n/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Globe,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Save,
  Clock,
  Search,
  FileText,
  AlertTriangle,
  Tag,
  GitBranch,
  PenTool,
  Cpu,
  TrendingDown,
  Workflow,
  Link2,
  Database,
  FileCode2,
  GitMerge,
  History,
  BarChart3,
  Bell,
  Map,
} from "lucide-react";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string | null;
  status: string;
  onboardingCompleted: boolean;
  description: string | null;
  createdAt: string;
}

interface BrandProfile {
  id: string;
  brandName: string | null;
  description: string | null;
  toneOfVoice: string | null;
  products: string | null;
  services: string | null;
  audiences: string | null;
  regions: string | null;
  preferredTerminology: string | null;
  prohibitedTerminology: string | null;
  allowedClaims: string | null;
  prohibitedClaims: string | null;
  proofPoints: string | null;
  certifications: string | null;
  contactInformation: string | null;
  conversionGoals: string | null;
  editorialRules: string | null;
  disclaimers: string | null;
  addressPreference: string | null;
}

interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  effort: string;
  status: string;
  deadline: string | null;
  createdAt: string;
}

interface JobEntry {
  id: string;
  type: string;
  status: string;
  progress: number;
  createdAt: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations("project");
  const tBrand = useTranslations("brand");
  const tActions = useTranslations("actions");
  const tJobs = useTranslations("jobs");
  const tAudit = useTranslations("audit");
  const tCommon = useTranslations("common");

  const [project, setProject] = useState<Project | null>(null);
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Brand profile form
  const [brandForm, setBrandForm] = useState<Partial<BrandProfile>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        const [projectRes, actionsRes, jobsRes, auditRes] = await Promise.all([
          fetch(`/api/projects/${id}`),
          fetch(`/api/actions?projectId=${id}`),
          fetch(`/api/jobs?projectId=${id}`),
          fetch(`/api/audit?projectId=${id}`),
        ]);

        if (projectRes.ok) {
          const data = await projectRes.json();
          setProject(data.project);
          if (data.brandProfile) {
            setBrandProfile(data.brandProfile);
            setBrandForm(data.brandProfile);
          }
        }
        if (actionsRes.ok) {
          const data = await actionsRes.json();
          setActionItems(data.items || []);
        }
        if (jobsRes.ok) {
          const data = await jobsRes.json();
          setJobs(data.items || []);
        }
        if (auditRes.ok) {
          const data = await auditRes.json();
          setAuditLogs(data.items || []);
        }
      } catch {
        // silently fail
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const handleSaveBrandProfile = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}/brand-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brandForm),
      });
      if (res.ok) {
        toast.success(tBrand("saveSuccess"));
      } else {
        toast.error(tBrand("saveError"));
      }
    } catch {
      toast.error(tBrand("saveError"));
    } finally {
      setIsSaving(false);
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

  const priorityVariant = (priority: string) => {
    switch (priority) {
      case "CRITICAL": return "destructive";
      case "HIGH": return "default";
      case "MEDIUM": return "secondary";
      case "LOW": return "outline";
      default: return "secondary";
    }
  };

  const actionStatusLabel = (status: string) => {
    switch (status) {
      case "PENDING": return tActions("pending");
      case "IN_PROGRESS": return tActions("inProgress");
      case "COMPLETED": return tActions("completed");
      case "SKIPPED": return tActions("skipped");
      default: return status;
    }
  };

  const jobStatusLabel = (status: string) => {
    switch (status) {
      case "PENDING": return tJobs("pending");
      case "RUNNING": return tJobs("running");
      case "COMPLETED": return tJobs("completed");
      case "FAILED": return tJobs("failed");
      case "CANCELLED": return tJobs("cancelled");
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-4 md:p-6">
        <Button variant="ghost" onClick={() => router.push("/projects")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tCommon("back")}
        </Button>
        <p className="text-muted-foreground mt-4">{tCommon("noResults")}</p>
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
        <Button variant="ghost" size="icon" onClick={() => router.push("/projects")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <Badge variant={statusVariant(project.status) as "default" | "secondary" | "outline"}>
              {statusLabel(project.status)}
            </Badge>
            {project.onboardingCompleted ? (
              <Badge variant="default" className="bg-emerald-600 text-xs">
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
          {project.websiteUrl && (
            <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {project.websiteUrl}
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
          <TabsTrigger value="brand">{t("brandProfile")}</TabsTrigger>
          <TabsTrigger value="actions">{t("actionItems")}</TabsTrigger>
          <TabsTrigger value="jobs">{t("jobs")}</TabsTrigger>
          <TabsTrigger value="audit">{t("auditLog")}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("projectInfo")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-sm text-muted-foreground">{t("name")}:</span>
                  <p className="text-sm font-medium">{project.name}</p>
                </div>
                {project.websiteUrl && (
                  <div>
                    <span className="text-sm text-muted-foreground">{t("website")}:</span>
                    <p className="text-sm font-medium">{project.websiteUrl}</p>
                  </div>
                )}
                <div>
                  <span className="text-sm text-muted-foreground">{t("status")}:</span>
                  <Badge variant={statusVariant(project.status) as "default" | "secondary" | "outline"} className="ml-2">
                    {statusLabel(project.status)}
                  </Badge>
                </div>
                {project.description && (
                  <div>
                    <span className="text-sm text-muted-foreground">{tCommon("description")}:</span>
                    <p className="text-sm">{project.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("quickStats")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t("actionItems")}:</span>
                  <span className="text-sm font-medium">{actionItems.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t("jobs")}:</span>
                  <span className="text-sm font-medium">{jobs.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Aangemaakt:</span>
                  <span className="text-sm font-medium">
                    {new Date(project.createdAt).toLocaleDateString("nl-NL")}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Module Navigation */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Modules</h3>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              <Link href={`/projects/${id}/crawls`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Search className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Crawls</p>
                      <p className="text-xs text-muted-foreground">Website scannen</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href={`/projects/${id}/inventory`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Inventaris</p>
                      <p className="text-xs text-muted-foreground">Pagina-overzicht</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href={`/projects/${id}/issues`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Technische problemen</p>
                      <p className="text-xs text-muted-foreground">SEO-aanbevelingen</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href={`/projects/${id}/keywords`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Tag className="h-5 w-5 text-purple-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Trefwoorden</p>
                      <p className="text-xs text-muted-foreground">Zoekwoordbeheer</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href={`/projects/${id}/topics`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <GitBranch className="h-5 w-5 text-teal-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Onderwerpen</p>
                      <p className="text-xs text-muted-foreground">Clusters & structuur</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href={`/projects/${id}/briefs`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <PenTool className="h-5 w-5 text-rose-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Contentstudio</p>
                      <p className="text-xs text-muted-foreground">Briefs & concepten</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href={`/projects/${id}/ai-providers`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Cpu className="h-5 w-5 text-indigo-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">AI-instellingen</p>
                      <p className="text-xs text-muted-foreground">Providers & modellen</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href={`/projects/${id}/decay`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <TrendingDown className="h-5 w-5 text-red-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Contentverval</p>
                      <p className="text-xs text-muted-foreground">Snoei-aanbevelingen</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href={`/projects/${id}/studio`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Workflow className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Contentwizard</p>
                      <p className="text-xs text-muted-foreground">Stap-voor-stap maken</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href={`/projects/${id}/links`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Link2 className="h-5 w-5 text-cyan-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Interne links</p>
                      <p className="text-xs text-muted-foreground">Suggesties & goedkeuring</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href={`/projects/${id}/structured-data`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Database className="h-5 w-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Gestructureerde data</p>
                      <p className="text-xs text-muted-foreground">JSON-LD schema</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href={`/projects/${id}/programmatic`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <FileCode2 className="h-5 w-5 text-violet-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Programmatische SEO</p>
                      <p className="text-xs text-muted-foreground">Sjablonen & bulkpagina's</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href={`/projects/${id}/cms`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <GitMerge className="h-5 w-5 text-sky-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">CMS-verbindingen</p>
                      <p className="text-xs text-muted-foreground">WordPress & WooCommerce</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href={`/projects/${id}/decay-workflow`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <TrendingDown className="h-5 w-5 text-orange-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Verval-workflow</p>
                      <p className="text-xs text-muted-foreground">Update & snoeien</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href={`/projects/${id}/history`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <History className="h-5 w-5 text-slate-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Wijzigingsgeschiedenis</p>
                      <p className="text-xs text-muted-foreground">Alle contentwijzigingen</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href={`/projects/${id}/analytics`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <BarChart3 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Zoekprestaties</p>
                      <p className="text-xs text-muted-foreground">Analytics &amp; monitoring</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href={`/projects/${id}/alerts`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Bell className="h-5 w-5 text-red-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Meldingen</p>
                      <p className="text-xs text-muted-foreground">SEO-waarschuwingen</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href={`/projects/${id}/roadmap`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Map className="h-5 w-5 text-teal-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Roadmap</p>
                      <p className="text-xs text-muted-foreground">Geprioriteerde acties</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href={`/projects/${id}/reports`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <FileText className="h-5 w-5 text-sky-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Rapporten</p>
                      <p className="text-xs text-muted-foreground">SEO-rapportages</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </TabsContent>

        {/* Brand Profile Tab */}
        <TabsContent value="brand">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{tBrand("title")}</CardTitle>
              <CardDescription>
                Beheer het merkprofiel voor dit project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{tBrand("brandName")}</Label>
                  <Input
                    value={brandForm.brandName || ""}
                    onChange={(e) => setBrandForm({ ...brandForm, brandName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tBrand("toneOfVoice")}</Label>
                  <Select
                    value={brandForm.addressPreference || ""}
                    onValueChange={(val) => setBrandForm({ ...brandForm, addressPreference: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={tBrand("addressPreference")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">{tBrand("formal")}</SelectItem>
                      <SelectItem value="informal">{tBrand("informal")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{tBrand("description")}</Label>
                <Textarea
                  value={brandForm.description || ""}
                  onChange={(e) => setBrandForm({ ...brandForm, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{tBrand("products")}</Label>
                  <Textarea
                    value={brandForm.products || ""}
                    onChange={(e) => setBrandForm({ ...brandForm, products: e.target.value })}
                    rows={3}
                    placeholder="Eén per regel"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tBrand("services")}</Label>
                  <Textarea
                    value={brandForm.services || ""}
                    onChange={(e) => setBrandForm({ ...brandForm, services: e.target.value })}
                    rows={3}
                    placeholder="Eén per regel"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{tBrand("audiences")}</Label>
                  <Textarea
                    value={brandForm.audiences || ""}
                    onChange={(e) => setBrandForm({ ...brandForm, audiences: e.target.value })}
                    rows={3}
                    placeholder="Eén per regel"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tBrand("regions")}</Label>
                  <Textarea
                    value={brandForm.regions || ""}
                    onChange={(e) => setBrandForm({ ...brandForm, regions: e.target.value })}
                    rows={3}
                    placeholder="Eén per regel"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{tBrand("preferredTerms")}</Label>
                  <Textarea
                    value={brandForm.preferredTerminology || ""}
                    onChange={(e) => setBrandForm({ ...brandForm, preferredTerminology: e.target.value })}
                    rows={2}
                    placeholder="Eén per regel"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tBrand("prohibitedTerms")}</Label>
                  <Textarea
                    value={brandForm.prohibitedTerminology || ""}
                    onChange={(e) => setBrandForm({ ...brandForm, prohibitedTerminology: e.target.value })}
                    rows={2}
                    placeholder="Eén per regel"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{tBrand("allowedClaims")}</Label>
                  <Textarea
                    value={brandForm.allowedClaims || ""}
                    onChange={(e) => setBrandForm({ ...brandForm, allowedClaims: e.target.value })}
                    rows={2}
                    placeholder="Eén per regel"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tBrand("prohibitedClaims")}</Label>
                  <Textarea
                    value={brandForm.prohibitedClaims || ""}
                    onChange={(e) => setBrandForm({ ...brandForm, prohibitedClaims: e.target.value })}
                    rows={2}
                    placeholder="Eén per regel"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{tBrand("proofPoints")}</Label>
                  <Textarea
                    value={brandForm.proofPoints || ""}
                    onChange={(e) => setBrandForm({ ...brandForm, proofPoints: e.target.value })}
                    rows={2}
                    placeholder="Eén per regel"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tBrand("certifications")}</Label>
                  <Textarea
                    value={brandForm.certifications || ""}
                    onChange={(e) => setBrandForm({ ...brandForm, certifications: e.target.value })}
                    rows={2}
                    placeholder="Eén per regel"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{tBrand("conversionGoals")}</Label>
                  <Textarea
                    value={brandForm.conversionGoals || ""}
                    onChange={(e) => setBrandForm({ ...brandForm, conversionGoals: e.target.value })}
                    rows={2}
                    placeholder="Eén per regel"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tBrand("editorialRules")}</Label>
                  <Textarea
                    value={brandForm.editorialRules || ""}
                    onChange={(e) => setBrandForm({ ...brandForm, editorialRules: e.target.value })}
                    rows={2}
                    placeholder="Eén per regel"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{tBrand("disclaimers")}</Label>
                <Textarea
                  value={brandForm.disclaimers || ""}
                  onChange={(e) => setBrandForm({ ...brandForm, disclaimers: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveBrandProfile} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  {tCommon("save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("actionItems")}</CardTitle>
            </CardHeader>
            <CardContent>
              {actionItems.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titel</TableHead>
                      <TableHead>{tActions("priority")}</TableHead>
                      <TableHead>{tActions("status")}</TableHead>
                      <TableHead>{tActions("effort")}</TableHead>
                      <TableHead>{tActions("deadline")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actionItems.map((action) => (
                      <TableRow key={action.id}>
                        <TableCell className="font-medium">{action.title}</TableCell>
                        <TableCell>
                          <Badge variant={priorityVariant(action.priority) as "destructive" | "default" | "secondary" | "outline"} className="text-xs">
                            {tActions(action.priority.toLowerCase() as "critical" | "high" | "medium" | "low")}
                          </Badge>
                        </TableCell>
                        <TableCell>{actionStatusLabel(action.status)}</TableCell>
                        <TableCell>{tActions(action.effort.toLowerCase() as "minimal" | "low" | "medium" | "high")}</TableCell>
                        <TableCell>
                          {action.deadline
                            ? new Date(action.deadline).toLocaleDateString("nl-NL")
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">{t("noActionItems")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Jobs Tab */}
        <TabsContent value="jobs">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("jobs")}</CardTitle>
            </CardHeader>
            <CardContent>
              {jobs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tCommon("type")}</TableHead>
                      <TableHead>{tJobs("status")}</TableHead>
                      <TableHead>{tJobs("progress")}</TableHead>
                      <TableHead>{tCommon("date")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">{job.type}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {jobStatusLabel(job.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${job.progress}%` }}
                              />
                            </div>
                            <span className="text-xs">{job.progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(job.createdAt).toLocaleDateString("nl-NL")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">{t("noJobs")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Tab */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("auditLog")}</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tCommon("date")}</TableHead>
                      <TableHead>{tAudit("action")}</TableHead>
                      <TableHead>{tAudit("entity")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {new Date(log.createdAt).toLocaleDateString("nl-NL")}
                        </TableCell>
                        <TableCell>{log.action}</TableCell>
                        <TableCell>{log.entity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">{t("noAuditLogs")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
