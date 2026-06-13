"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Plus,
  MapPin,
  Star,
  RefreshCw,
  Phone,
  Mail,
  Globe,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  ExternalLink,
  Unplug,
  Link2,
  Code2,
  Navigation,
  Building2,
  Users,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LocationData {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  openingHours: string | null;
  businessType: string | null;
  napConsistency: number;
  localHealthScore: number;
  avgRating: number;
  reviewCount: number;
  gbpStatus: string;
  gbpAccountId: string | null;
  gbpLocationId: string | null;
  localStructuredData: string | null;
  serviceArea: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface HealthCheck {
  id: string;
  category: string;
  status: string;
  score: number;
  title: string;
  description: string;
  recommendation: string | null;
  checkedAt: string;
}

interface LocalKeyword {
  id: string;
  keyword: string;
  intent: string;
  searchVolume: number | null;
  difficulty: number | null;
  currentRank: number | null;
  targetRank: number | null;
  url: string | null;
}

interface LandingPage {
  id: string;
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  wordCount: number;
  hasStructuredData: boolean;
  hasNAP: boolean;
  hasMap: boolean;
  hasOpeningHours: boolean;
  qualityScore: number;
  issues: string | null;
}

interface LocalCompetitor {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  website: string | null;
  avgRating: number | null;
  reviewCount: number;
  distance: number | null;
  strengths: string | null;
  weaknesses: string | null;
  notes: string | null;
}

interface GBPStatus {
  connected: boolean;
  syncStatus: string;
  businessName: string | null;
  primaryCategory: string | null;
  avgRating: number | null;
  totalReviews: number;
  lastSyncAt: string | null;
  syncError: string | null;
}

interface StructuredData {
  locationId: string;
  businessType: string | null;
  jsonLd: string | null;
}

// ---------------------------------------------------------------------------
// Dutch label maps
// ---------------------------------------------------------------------------

const HEALTH_CATEGORY_LABELS: Record<string, string> = {
  NAP_CONSISTENCY: "NAP-consistentie",
  OPENING_HOURS: "Openingstijden",
  LOCAL_STRUCTURED_DATA: "Gestructureerde gegevens",
  LANDING_PAGES: "Bestemmingspagina's",
  LOCAL_KEYWORDS: "Lokale zoekwoorden",
  REVIEWS: "Beoordelingen",
  GOOGLE_BUSINESS_PROFILE: "Google Bedrijfsprofiel",
  LOCAL_LINKS: "Lokale links",
  PHOTOS: "Foto's",
  SERVICE_AREAS: "Servicegebieden",
};

const HEALTH_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PASSING: { label: "Goed", className: "bg-green-50 text-green-700 border-green-200" },
  NEEDS_IMPROVEMENT: { label: "Verbetering nodig", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  FAILING: { label: "Onvoldoende", className: "bg-red-50 text-red-700 border-red-200" },
  NOT_CHECKED: { label: "Niet gecontroleerd", className: "bg-gray-50 text-gray-500 border-gray-200" },
};

const INTENT_LABELS: Record<string, string> = {
  NAVIGATIONAL: "Navigatie",
  INFORMATIONAL: "Informatief",
  TRANSACTIONAL: "Transactioneel",
  COMMERCIAL: "Commercieel",
  LOCAL: "Lokaal",
};

const INTENT_COLORS: Record<string, string> = {
  NAVIGATIONAL: "bg-blue-50 text-blue-700 border-blue-200",
  INFORMATIONAL: "bg-purple-50 text-purple-700 border-purple-200",
  TRANSACTIONAL: "bg-emerald-50 text-emerald-700 border-emerald-200",
  COMMERCIAL: "bg-orange-50 text-orange-700 border-orange-200",
  LOCAL: "bg-teal-50 text-teal-700 border-teal-200",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  return "text-red-600";
}

function scoreBg(score: number): string {
  if (score >= 80) return "bg-green-50 text-green-700 border-green-200";
  if (score >= 50) return "bg-yellow-50 text-yellow-700 border-yellow-200";
  return "bg-red-50 text-red-700 border-red-200";
}

function renderStars(rating: number) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const stars = [];
  for (let i = 0; i < 5; i++) {
    if (i < full) {
      stars.push(<Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />);
    } else if (i === full && half) {
      stars.push(<Star key={i} className="w-3.5 h-3.5 fill-yellow-400/50 text-yellow-400" />);
    } else {
      stars.push(<Star key={i} className="w-3.5 h-3.5 text-gray-300" />);
    }
  }
  return stars;
}

function healthStatusIcon(status: string) {
  switch (status) {
    case "PASSING":
      return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    case "FAILING":
      return <XCircle className="w-4 h-4 text-red-600" />;
    case "NEEDS_IMPROVEMENT":
      return <AlertCircle className="w-4 h-4 text-yellow-600" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LocationDetailPage({
  params,
}: {
  params: Promise<{ id: string; locationId: string }>;
}) {
  const { id: projectId, locationId } = use(params);
  const router = useRouter();

  // Location data
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Health checks
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [isRunningHealth, setIsRunningHealth] = useState(false);

  // Local keywords
  const [keywords, setKeywords] = useState<LocalKeyword[]>([]);
  const [keywordDialogOpen, setKeywordDialogOpen] = useState(false);
  const [isAddingKeyword, setIsAddingKeyword] = useState(false);
  const [keywordForm, setKeywordForm] = useState({
    keyword: "",
    intent: "LOCAL",
    searchVolume: "",
    difficulty: "",
    currentRank: "",
    targetRank: "",
    url: "",
  });

  // Landing pages
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [lpDialogOpen, setLpDialogOpen] = useState(false);
  const [isAddingLp, setIsAddingLp] = useState(false);
  const [lpForm, setLpForm] = useState({ url: "" });

  // Competitors
  const [competitors, setCompetitors] = useState<LocalCompetitor[]>([]);
  const [compDialogOpen, setCompDialogOpen] = useState(false);
  const [isAddingComp, setIsAddingComp] = useState(false);
  const [compForm, setCompForm] = useState({
    name: "",
    address: "",
    city: "",
    postalCode: "",
    website: "",
    avgRating: "",
    reviewCount: "",
    distance: "",
    notes: "",
  });

  // GBP
  const [gbpStatus, setGbpStatus] = useState<GBPStatus | null>(null);
  const [gbpDialogOpen, setGbpDialogOpen] = useState(false);
  const [isConnectingGbp, setIsConnectingGbp] = useState(false);
  const [gbpForm, setGbpForm] = useState({
    accountId: "",
    locationIdGBP: "",
    accessToken: "",
    refreshToken: "",
  });
  const [isDisconnectingGbp, setIsDisconnectingGbp] = useState(false);

  // Structured data
  const [structuredData, setStructuredData] = useState<StructuredData | null>(null);
  const [isGeneratingSD, setIsGeneratingSD] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState("overview");

  // ---------------------------------------------------------------------------
  // Fetch Location
  // ---------------------------------------------------------------------------

  const fetchLocation = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/projects/${projectId}/locations/${locationId}`);
      if (!res.ok) throw new Error("Fout bij ophalen locatie");
      const json = await res.json();
      setLocation(json.data);
    } catch {
      toast.error("Kon locatie niet laden");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, locationId]);

  // ---------------------------------------------------------------------------
  // Fetch Health Checks
  // ---------------------------------------------------------------------------

  const fetchHealthChecks = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/locations/${locationId}/health`);
      if (!res.ok) throw new Error("Fout bij ophalen gezondheidscontroles");
      const json = await res.json();
      setHealthChecks(json.data ?? []);
    } catch {
      // silent
    }
  }, [projectId, locationId]);

  // ---------------------------------------------------------------------------
  // Fetch Keywords
  // ---------------------------------------------------------------------------

  const fetchKeywords = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/locations/${locationId}/keywords`);
      if (!res.ok) throw new Error("Fout bij ophalen zoekwoorden");
      const json = await res.json();
      setKeywords(json.data ?? []);
    } catch {
      // silent
    }
  }, [projectId, locationId]);

  // ---------------------------------------------------------------------------
  // Fetch Landing Pages
  // ---------------------------------------------------------------------------

  const fetchLandingPages = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/locations/${locationId}/landing-pages`);
      if (!res.ok) throw new Error("Fout bij ophalen bestemmingspagina's");
      const json = await res.json();
      setLandingPages(json.data ?? []);
    } catch {
      // silent
    }
  }, [projectId, locationId]);

  // ---------------------------------------------------------------------------
  // Fetch Competitors
  // ---------------------------------------------------------------------------

  const fetchCompetitors = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/locations/${locationId}/competitors`);
      if (!res.ok) throw new Error("Fout bij ophalen concurrenten");
      const json = await res.json();
      setCompetitors(json.data ?? []);
    } catch {
      // silent
    }
  }, [projectId, locationId]);

  // ---------------------------------------------------------------------------
  // Fetch GBP
  // ---------------------------------------------------------------------------

  const fetchGBP = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/locations/${locationId}/gbp`);
      if (!res.ok) throw new Error("Fout bij ophalen GBP");
      const json = await res.json();
      setGbpStatus(json.data);
    } catch {
      // silent
    }
  }, [projectId, locationId]);

  // ---------------------------------------------------------------------------
  // Fetch Structured Data
  // ---------------------------------------------------------------------------

  const fetchStructuredData = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/locations/${locationId}/structured-data`);
      if (!res.ok) throw new Error("Fout bij ophalen gestructureerde gegevens");
      const json = await res.json();
      setStructuredData(json.data);
    } catch {
      // silent
    }
  }, [projectId, locationId]);

  // ---------------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  useEffect(() => {
    if (!location) return;
    fetchHealthChecks();
    fetchKeywords();
    fetchLandingPages();
    fetchCompetitors();
    fetchGBP();
    fetchStructuredData();
  }, [location, fetchHealthChecks, fetchKeywords, fetchLandingPages, fetchCompetitors, fetchGBP, fetchStructuredData]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function runHealthCheck() {
    try {
      setIsRunningHealth(true);
      const res = await fetch(`/api/projects/${projectId}/locations/${locationId}/health`, { method: "POST" });
      if (!res.ok) throw new Error("Fout bij uitvoeren gezondheidscontrole");
      const json = await res.json();
      setHealthChecks(json.data ?? []);
      toast.success("Gezondheidscontrole uitgevoerd");
      // Refresh location to get updated scores
      fetchLocation();
    } catch {
      toast.error("Kon gezondheidscontrole niet uitvoeren");
    } finally {
      setIsRunningHealth(false);
    }
  }

  async function addKeyword() {
    if (!keywordForm.keyword.trim()) {
      toast.error("Zoekwoord is verplicht");
      return;
    }
    try {
      setIsAddingKeyword(true);
      const body: Record<string, unknown> = {
        keyword: keywordForm.keyword.trim(),
        intent: keywordForm.intent,
      };
      if (keywordForm.searchVolume) body.searchVolume = parseInt(keywordForm.searchVolume);
      if (keywordForm.difficulty) body.difficulty = parseFloat(keywordForm.difficulty);
      if (keywordForm.currentRank) body.currentRank = parseInt(keywordForm.currentRank);
      if (keywordForm.targetRank) body.targetRank = parseInt(keywordForm.targetRank);
      if (keywordForm.url.trim()) body.url = keywordForm.url.trim();

      const res = await fetch(`/api/projects/${projectId}/locations/${locationId}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fout bij toevoegen zoekwoord");
      }
      toast.success("Zoekwoord toegevoegd");
      setKeywordDialogOpen(false);
      setKeywordForm({ keyword: "", intent: "LOCAL", searchVolume: "", difficulty: "", currentRank: "", targetRank: "", url: "" });
      fetchKeywords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fout bij toevoegen zoekwoord");
    } finally {
      setIsAddingKeyword(false);
    }
  }

  async function addLandingPage() {
    if (!lpForm.url.trim()) {
      toast.error("URL is verplicht");
      return;
    }
    try {
      setIsAddingLp(true);
      const res = await fetch(`/api/projects/${projectId}/locations/${locationId}/landing-pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: lpForm.url.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fout bij toevoegen bestemmingspagina");
      }
      toast.success("Bestemmingspagina toegevoegd");
      setLpDialogOpen(false);
      setLpForm({ url: "" });
      fetchLandingPages();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fout bij toevoegen bestemmingspagina");
    } finally {
      setIsAddingLp(false);
    }
  }

  async function addCompetitor() {
    if (!compForm.name.trim()) {
      toast.error("Concurrentnaam is verplicht");
      return;
    }
    try {
      setIsAddingComp(true);
      const body: Record<string, unknown> = {
        name: compForm.name.trim(),
        address: compForm.address.trim() || null,
        city: compForm.city.trim() || null,
        postalCode: compForm.postalCode.trim() || null,
        website: compForm.website.trim() || null,
        notes: compForm.notes.trim() || null,
      };
      if (compForm.avgRating) body.avgRating = parseFloat(compForm.avgRating);
      if (compForm.reviewCount) body.reviewCount = parseInt(compForm.reviewCount);
      if (compForm.distance) body.distance = parseFloat(compForm.distance);

      const res = await fetch(`/api/projects/${projectId}/locations/${locationId}/competitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fout bij toevoegen concurrent");
      }
      toast.success("Concurrent toegevoegd");
      setCompDialogOpen(false);
      setCompForm({ name: "", address: "", city: "", postalCode: "", website: "", avgRating: "", reviewCount: "", distance: "", notes: "" });
      fetchCompetitors();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fout bij toevoegen concurrent");
    } finally {
      setIsAddingComp(false);
    }
  }

  async function connectGBP() {
    if (!gbpForm.accountId.trim() || !gbpForm.locationIdGBP.trim() || !gbpForm.accessToken.trim() || !gbpForm.refreshToken.trim()) {
      toast.error("Alle velden zijn verplicht");
      return;
    }
    try {
      setIsConnectingGbp(true);
      const res = await fetch(`/api/projects/${projectId}/locations/${locationId}/gbp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: gbpForm.accountId.trim(),
          locationIdGBP: gbpForm.locationIdGBP.trim(),
          accessToken: gbpForm.accessToken.trim(),
          refreshToken: gbpForm.refreshToken.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fout bij verbinden GBP");
      }
      toast.success("Google Bedrijfsprofiel verbonden");
      setGbpDialogOpen(false);
      setGbpForm({ accountId: "", locationIdGBP: "", accessToken: "", refreshToken: "" });
      fetchGBP();
      fetchLocation();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fout bij verbinden GBP");
    } finally {
      setIsConnectingGbp(false);
    }
  }

  async function disconnectGBP() {
    try {
      setIsDisconnectingGbp(true);
      const res = await fetch(`/api/projects/${projectId}/locations/${locationId}/gbp`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fout bij verbreken GBP");
      }
      toast.success("Google Bedrijfsprofiel verbroken");
      fetchGBP();
      fetchLocation();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fout bij verbreken GBP");
    } finally {
      setIsDisconnectingGbp(false);
    }
  }

  async function generateStructuredData() {
    try {
      setIsGeneratingSD(true);
      const res = await fetch(`/api/projects/${projectId}/locations/${locationId}/structured-data`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fout bij genereren gestructureerde gegevens");
      }
      const json = await res.json();
      setStructuredData(json.data);
      toast.success("Gestructureerde gegevens gegenereerd");
      fetchLocation();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fout bij genereren gestructureerde gegevens");
    } finally {
      setIsGeneratingSD(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <span className="ml-3 text-muted-foreground">Locatie laden...</span>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Locatie niet gevonden</h3>
            <p className="text-muted-foreground mb-4">De opgevraagde locatie bestaat niet of je hebt geen toegang.</p>
            <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/locations`)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Terug naar locaties
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const healthScore = Math.round(location.localHealthScore || 0);
  const napScore = Math.round(location.napConsistency || 0);

  // Build health checks map by category
  const healthByCategory = new Map<string, HealthCheck>();
  for (const hc of healthChecks) {
    healthByCategory.set(hc.category, hc);
  }

  // All 10 categories in order
  const allCategories = [
    "NAP_CONSISTENCY",
    "OPENING_HOURS",
    "LOCAL_STRUCTURED_DATA",
    "LANDING_PAGES",
    "LOCAL_KEYWORDS",
    "REVIEWS",
    "GOOGLE_BUSINESS_PROFILE",
    "LOCAL_LINKS",
    "PHOTOS",
    "SERVICE_AREAS",
  ];

  // Parse opening hours
  let openingHoursObj: Record<string, { open: string; close: string }> | null = null;
  if (location.openingHours) {
    try {
      openingHoursObj = JSON.parse(location.openingHours);
    } catch {
      openingHoursObj = null;
    }
  }

  const dayLabels: Record<string, string> = {
    mon: "Maandag",
    tue: "Dinsdag",
    wed: "Woensdag",
    thu: "Donderdag",
    fri: "Vrijdag",
    sat: "Zaterdag",
    sun: "Zondag",
  };

  // Parse issues for landing pages
  function parseIssues(issuesStr: string | null): string[] {
    if (!issuesStr) return [];
    try {
      const parsed = JSON.parse(issuesStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/projects/${projectId}/locations`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 truncate">{location.name}</h1>
              <p className="text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="w-4 h-4" />
                {location.city || "Geen stad"}
                {location.businessType && (
                  <Badge variant="outline" className="ml-2">{location.businessType}</Badge>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Health Score Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className={`text-5xl font-bold ${scoreColor(healthScore)}`}>{healthScore}</p>
                  <p className="text-sm text-muted-foreground mt-1">Gezondheidsscore</p>
                </div>
                <div className="w-48">
                  <Progress value={healthScore} className="h-3" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0</span>
                    <span>100</span>
                  </div>
                </div>
              </div>
              <Button
                onClick={runHealthCheck}
                disabled={isRunningHealth}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isRunningHealth ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Controleer nu
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex flex-wrap h-auto gap-1 bg-white border p-1 rounded-lg">
            <TabsTrigger value="overview" className="data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              Overzicht
            </TabsTrigger>
            <TabsTrigger value="keywords" className="data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              Zoekwoorden
            </TabsTrigger>
            <TabsTrigger value="landing-pages" className="data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              Bestemmingspagina&apos;s
            </TabsTrigger>
            <TabsTrigger value="competitors" className="data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              Concurrenten
            </TabsTrigger>
            <TabsTrigger value="gbp" className="data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              Google Bedrijfsprofiel
            </TabsTrigger>
            <TabsTrigger value="structured-data" className="data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              Gestructureerde gegevens
            </TabsTrigger>
          </TabsList>

          {/* ================================================================ */}
          {/* TAB: Overzicht */}
          {/* ================================================================ */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* NAP Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    NAP-gegevens
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Naam</span>
                    <span className="text-sm font-medium">{location.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Adres</span>
                    <span className="text-sm font-medium">{location.address || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Stad</span>
                    <span className="text-sm font-medium">{location.city || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Postcode</span>
                    <span className="text-sm font-medium">{location.postalCode || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Land</span>
                    <span className="text-sm font-medium">{location.country || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Telefoon</span>
                    <span className="text-sm font-medium flex items-center gap-1">
                      {location.phone ? <><Phone className="w-3 h-3" />{location.phone}</> : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">E-mail</span>
                    <span className="text-sm font-medium flex items-center gap-1">
                      {location.email ? <><Mail className="w-3 h-3" />{location.email}</> : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Website</span>
                    <span className="text-sm font-medium flex items-center gap-1">
                      {location.website ? <><Globe className="w-3 h-3" />{location.website}</> : "—"}
                    </span>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">NAP-consistentie</span>
                      <Badge className={scoreBg(napScore)} variant="outline">{napScore}%</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Opening Hours */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    Openingstijden
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {openingHoursObj ? (
                    <div className="space-y-2">
                      {Object.entries(dayLabels).map(([key, label]) => {
                        const hours = openingHoursObj?.[key];
                        return (
                          <div key={key} className="flex justify-between">
                            <span className="text-sm text-muted-foreground">{label}</span>
                            <span className="text-sm font-medium">
                              {hours ? `${hours.open} - ${hours.close}` : "Gesloten"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Geen openingstijden ingesteld</p>
                  )}
                </CardContent>
              </Card>

              {/* GBP Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    Google Bedrijfsprofiel
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {location.gbpStatus === "connected" ? (
                    <div className="space-y-2">
                      <Badge className="bg-green-50 text-green-700 border-green-200 border">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Verbonden
                      </Badge>
                      {gbpStatus?.businessName && (
                        <p className="text-sm font-medium mt-2">{gbpStatus.businessName}</p>
                      )}
                      {gbpStatus?.primaryCategory && (
                        <p className="text-sm text-muted-foreground">{gbpStatus.primaryCategory}</p>
                      )}
                    </div>
                  ) : location.gbpStatus === "error" ? (
                    <div className="space-y-2">
                      <Badge className="bg-red-50 text-red-700 border-red-200 border">
                        <XCircle className="w-3 h-3 mr-1" />
                        Fout
                      </Badge>
                      {gbpStatus?.syncError && (
                        <p className="text-sm text-red-600 mt-1">{gbpStatus.syncError}</p>
                      )}
                    </div>
                  ) : (
                    <Badge variant="secondary" className="bg-gray-50 text-gray-500 border-gray-200 border">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Niet verbonden
                    </Badge>
                  )}
                </CardContent>
              </Card>

              {/* Review Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Star className="w-4 h-4 text-emerald-600" />
                    Beoordelingen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl font-bold">{location.avgRating.toFixed(1)}</span>
                    <div>
                      <div className="flex">{renderStars(location.avgRating)}</div>
                      <p className="text-sm text-muted-foreground mt-1">{location.reviewCount} beoordelingen</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Health Check Results Grid */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-600" />
                  Gezondheidscontroles
                </CardTitle>
                <CardDescription>
                  Resultaten van de laatste controle per categorie
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                  {allCategories.map((cat) => {
                    const hc = healthByCategory.get(cat);
                    const statusInfo = HEALTH_STATUS_LABELS[hc?.status ?? "NOT_CHECKED"];
                    return (
                      <div
                        key={cat}
                        className="p-3 rounded-lg border bg-white hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            {HEALTH_CATEGORY_LABELS[cat] || cat}
                          </span>
                          {healthStatusIcon(hc?.status ?? "NOT_CHECKED")}
                        </div>
                        {hc ? (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-lg font-bold ${scoreColor(hc.score)}`}>
                                {Math.round(hc.score)}
                              </span>
                              <Badge className={statusInfo.className} variant="outline">
                                {statusInfo.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{hc.title}</p>
                          </>
                        ) : (
                          <>
                            <span className="text-lg font-bold text-gray-300">—</span>
                            <Badge className={statusInfo.className} variant="outline">
                              {statusInfo.label}
                            </Badge>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================================================================ */}
          {/* TAB: Zoekwoorden */}
          {/* ================================================================ */}
          <TabsContent value="keywords">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Search className="w-4 h-4 text-emerald-600" />
                      Lokale zoekwoorden
                    </CardTitle>
                    <CardDescription>{keywords.length} zoekwoorden bij deze locatie</CardDescription>
                  </div>
                  <Dialog open={keywordDialogOpen} onOpenChange={setKeywordDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-1" />
                        Zoekwoord toevoegen
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Zoekwoord toevoegen</DialogTitle>
                        <DialogDescription>
                          Voeg een lokaal zoekwoord toe voor deze locatie.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label>Zoekwoord *</Label>
                          <Input
                            value={keywordForm.keyword}
                            onChange={(e) => setKeywordForm((f) => ({ ...f, keyword: e.target.value }))}
                            placeholder="Bijv. tandarts amsterdam centrum"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Intentie</Label>
                          <Select value={keywordForm.intent} onValueChange={(v) => setKeywordForm((f) => ({ ...f, intent: v }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="LOCAL">Lokaal</SelectItem>
                              <SelectItem value="NAVIGATIONAL">Navigatie</SelectItem>
                              <SelectItem value="INFORMATIONAL">Informatief</SelectItem>
                              <SelectItem value="TRANSACTIONAL">Transactioneel</SelectItem>
                              <SelectItem value="COMMERCIAL">Commercieel</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label>Zoekvolume</Label>
                            <Input
                              type="number"
                              value={keywordForm.searchVolume}
                              onChange={(e) => setKeywordForm((f) => ({ ...f, searchVolume: e.target.value }))}
                              placeholder="1000"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Moeilijkheid</Label>
                            <Input
                              type="number"
                              value={keywordForm.difficulty}
                              onChange={(e) => setKeywordForm((f) => ({ ...f, difficulty: e.target.value }))}
                              placeholder="0-100"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label>Huidige positie</Label>
                            <Input
                              type="number"
                              value={keywordForm.currentRank}
                              onChange={(e) => setKeywordForm((f) => ({ ...f, currentRank: e.target.value }))}
                              placeholder="15"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Doelpositie</Label>
                            <Input
                              type="number"
                              value={keywordForm.targetRank}
                              onChange={(e) => setKeywordForm((f) => ({ ...f, targetRank: e.target.value }))}
                              placeholder="1"
                            />
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label>URL</Label>
                          <Input
                            value={keywordForm.url}
                            onChange={(e) => setKeywordForm((f) => ({ ...f, url: e.target.value }))}
                            placeholder="https://www.voorbeeld.nl/pagina"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setKeywordDialogOpen(false)}>Annuleren</Button>
                        <Button onClick={addKeyword} disabled={isAddingKeyword} className="bg-emerald-600 hover:bg-emerald-700">
                          {isAddingKeyword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Toevoegen
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {keywords.length === 0 ? (
                  <div className="py-8 text-center">
                    <Search className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-muted-foreground">Geen lokale zoekwoorden gevonden. Voeg een zoekwoord toe om te beginnen.</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Zoekwoord</TableHead>
                          <TableHead>Intentie</TableHead>
                          <TableHead className="text-right">Volume</TableHead>
                          <TableHead className="text-right">Positie</TableHead>
                          <TableHead>URL</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {keywords.map((kw) => (
                          <TableRow key={kw.id}>
                            <TableCell className="font-medium">{kw.keyword}</TableCell>
                            <TableCell>
                              <Badge className={INTENT_COLORS[kw.intent] || "bg-gray-50 text-gray-700"} variant="outline">
                                {INTENT_LABELS[kw.intent] || kw.intent}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{kw.searchVolume ?? "—"}</TableCell>
                            <TableCell className="text-right">
                              {kw.currentRank ? (
                                <span className={kw.currentRank <= 10 ? "text-green-600 font-medium" : ""}>
                                  #{kw.currentRank}
                                </span>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                              {kw.url || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================================================================ */}
          {/* TAB: Bestemmingspagina's */}
          {/* ================================================================ */}
          <TabsContent value="landing-pages">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      Bestemmingspagina&apos;s
                    </CardTitle>
                    <CardDescription>{landingPages.length} bestemmingspagina&apos;s bij deze locatie</CardDescription>
                  </div>
                  <Dialog open={lpDialogOpen} onOpenChange={setLpDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-1" />
                        Pagina toevoegen
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Bestemmingspagina toevoegen</DialogTitle>
                        <DialogDescription>
                          Voeg een bestemmingspagina toe om de kwaliteit te analyseren.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label>URL *</Label>
                          <Input
                            value={lpForm.url}
                            onChange={(e) => setLpForm((f) => ({ ...f, url: e.target.value }))}
                            placeholder="https://www.voorbeeld.nl/amsterdam"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setLpDialogOpen(false)}>Annuleren</Button>
                        <Button onClick={addLandingPage} disabled={isAddingLp} className="bg-emerald-600 hover:bg-emerald-700">
                          {isAddingLp && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Toevoegen
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {landingPages.length === 0 ? (
                  <div className="py-8 text-center">
                    <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-muted-foreground">Geen bestemmingspagina&apos;s gevonden. Voeg een pagina toe om te beginnen.</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>URL</TableHead>
                          <TableHead className="text-center">Kwaliteit</TableHead>
                          <TableHead className="text-center">Problemen</TableHead>
                          <TableHead className="text-center">NAP</TableHead>
                          <TableHead className="text-center">Schema</TableHead>
                          <TableHead className="text-center">Kaart</TableHead>
                          <TableHead className="text-center">Uren</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {landingPages.map((lp) => {
                          const issues = parseIssues(lp.issues);
                          return (
                            <TableRow key={lp.id}>
                              <TableCell className="max-w-[250px]">
                                <a
                                  href={lp.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-emerald-700 hover:underline truncate block flex items-center gap-1"
                                >
                                  {lp.url}
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                                {lp.title && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{lp.title}</p>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className={scoreBg(lp.qualityScore)} variant="outline">
                                  {Math.round(lp.qualityScore)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                {issues.length > 0 ? (
                                  <Badge className="bg-red-50 text-red-700 border-red-200" variant="outline">
                                    {issues.length}
                                  </Badge>
                                ) : (
                                  <Badge className="bg-green-50 text-green-700 border-green-200" variant="outline">0</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {lp.hasNAP ? <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /> : <XCircle className="w-4 h-4 text-red-400 mx-auto" />}
                              </TableCell>
                              <TableCell className="text-center">
                                {lp.hasStructuredData ? <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /> : <XCircle className="w-4 h-4 text-red-400 mx-auto" />}
                              </TableCell>
                              <TableCell className="text-center">
                                {lp.hasMap ? <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /> : <XCircle className="w-4 h-4 text-red-400 mx-auto" />}
                              </TableCell>
                              <TableCell className="text-center">
                                {lp.hasOpeningHours ? <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /> : <XCircle className="w-4 h-4 text-red-400 mx-auto" />}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================================================================ */}
          {/* TAB: Concurrenten */}
          {/* ================================================================ */}
          <TabsContent value="competitors">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-600" />
                      Lokale concurrenten
                    </CardTitle>
                    <CardDescription>{competitors.length} concurrenten bij deze locatie</CardDescription>
                  </div>
                  <Dialog open={compDialogOpen} onOpenChange={setCompDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-1" />
                        Concurrent toevoegen
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Concurrent toevoegen</DialogTitle>
                        <DialogDescription>
                          Voeg een lokale concurrent toe om te vergelijken.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label>Naam *</Label>
                          <Input
                            value={compForm.name}
                            onChange={(e) => setCompForm((f) => ({ ...f, name: e.target.value }))}
                            placeholder="Bijv. Concurrent B.V."
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label>Adres</Label>
                            <Input
                              value={compForm.address}
                              onChange={(e) => setCompForm((f) => ({ ...f, address: e.target.value }))}
                              placeholder="Keizersgracht 456"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Stad</Label>
                            <Input
                              value={compForm.city}
                              onChange={(e) => setCompForm((f) => ({ ...f, city: e.target.value }))}
                              placeholder="Amsterdam"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label>Postcode</Label>
                            <Input
                              value={compForm.postalCode}
                              onChange={(e) => setCompForm((f) => ({ ...f, postalCode: e.target.value }))}
                              placeholder="1016 AB"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Website</Label>
                            <Input
                              value={compForm.website}
                              onChange={(e) => setCompForm((f) => ({ ...f, website: e.target.value }))}
                              placeholder="https://www.concurrent.nl"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="grid gap-2">
                            <Label>Beoordeling</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={compForm.avgRating}
                              onChange={(e) => setCompForm((f) => ({ ...f, avgRating: e.target.value }))}
                              placeholder="4.2"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Beoordelingen</Label>
                            <Input
                              type="number"
                              value={compForm.reviewCount}
                              onChange={(e) => setCompForm((f) => ({ ...f, reviewCount: e.target.value }))}
                              placeholder="120"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Afstand (km)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={compForm.distance}
                              onChange={(e) => setCompForm((f) => ({ ...f, distance: e.target.value }))}
                              placeholder="1.5"
                            />
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label>Notities</Label>
                          <Textarea
                            value={compForm.notes}
                            onChange={(e) => setCompForm((f) => ({ ...f, notes: e.target.value }))}
                            placeholder="Opmerkingen over deze concurrent..."
                            rows={2}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setCompDialogOpen(false)}>Annuleren</Button>
                        <Button onClick={addCompetitor} disabled={isAddingComp} className="bg-emerald-600 hover:bg-emerald-700">
                          {isAddingComp && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Toevoegen
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {competitors.length === 0 ? (
                  <div className="py-8 text-center">
                    <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-muted-foreground">Geen lokale concurrenten gevonden. Voeg een concurrent toe om te vergelijken.</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Naam</TableHead>
                          <TableHead className="text-right">Afstand</TableHead>
                          <TableHead>Beoordeling</TableHead>
                          <TableHead className="text-right">Beoordelingen</TableHead>
                          <TableHead>Website</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {competitors.map((comp) => (
                          <TableRow key={comp.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{comp.name}</p>
                                {comp.city && <p className="text-xs text-muted-foreground">{comp.city}</p>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {comp.distance != null ? (
                                <span className="flex items-center justify-end gap-1">
                                  <Navigation className="w-3 h-3 text-muted-foreground" />
                                  {comp.distance.toFixed(1)} km
                                </span>
                              ) : "—"}
                            </TableCell>
                            <TableCell>
                              {comp.avgRating != null ? (
                                <div className="flex items-center gap-1">
                                  <div className="flex">{renderStars(comp.avgRating)}</div>
                                  <span className="text-xs font-medium">{comp.avgRating.toFixed(1)}</span>
                                </div>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="text-right">{comp.reviewCount || "—"}</TableCell>
                            <TableCell>
                              {comp.website ? (
                                <a
                                  href={comp.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-emerald-700 hover:underline flex items-center gap-1"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Website
                                </a>
                              ) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================================================================ */}
          {/* TAB: Google Bedrijfsprofiel */}
          {/* ================================================================ */}
          <TabsContent value="gbp">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  Google Bedrijfsprofiel
                </CardTitle>
                <CardDescription>
                  Beheer de verbinding met je Google Bedrijfsprofiel
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Connection Status */}
                <div className="flex items-center justify-between p-4 rounded-lg border bg-white">
                  <div className="flex items-center gap-3">
                    {gbpStatus?.connected ? (
                      <>
                        <div className="p-2 bg-green-50 rounded-lg">
                          <Link2 className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Verbonden</p>
                          <p className="text-sm text-muted-foreground">
                            {gbpStatus.businessName || "Google Bedrijfsprofiel is verbonden"}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-2 bg-gray-50 rounded-lg">
                          <Unplug className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium">Niet verbonden</p>
                          <p className="text-sm text-muted-foreground">
                            Verbind je Google Bedrijfsprofiel om beoordelingen en gegevens te synchroniseren
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {gbpStatus?.connected ? (
                      <Button
                        variant="outline"
                        onClick={disconnectGBP}
                        disabled={isDisconnectingGbp}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        {isDisconnectingGbp && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Verbreken
                      </Button>
                    ) : (
                      <Dialog open={gbpDialogOpen} onOpenChange={setGbpDialogOpen}>
                        <DialogTrigger asChild>
                          <Button className="bg-emerald-600 hover:bg-emerald-700">
                            <Link2 className="w-4 h-4 mr-2" />
                            Verbinden
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Google Bedrijfsprofiel verbinden</DialogTitle>
                            <DialogDescription>
                              Voer je Google Bedrijfsprofiel gegevens in om te verbinden.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label>Account ID *</Label>
                              <Input
                                value={gbpForm.accountId}
                                onChange={(e) => setGbpForm((f) => ({ ...f, accountId: e.target.value }))}
                                placeholder="123456789"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label>Location ID *</Label>
                              <Input
                                value={gbpForm.locationIdGBP}
                                onChange={(e) => setGbpForm((f) => ({ ...f, locationIdGBP: e.target.value }))}
                                placeholder="LOC-001"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label>Access Token *</Label>
                              <Input
                                type="password"
                                value={gbpForm.accessToken}
                                onChange={(e) => setGbpForm((f) => ({ ...f, accessToken: e.target.value }))}
                                placeholder="ya29..."
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label>Refresh Token *</Label>
                              <Input
                                type="password"
                                value={gbpForm.refreshToken}
                                onChange={(e) => setGbpForm((f) => ({ ...f, refreshToken: e.target.value }))}
                                placeholder="1//..."
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setGbpDialogOpen(false)}>Annuleren</Button>
                            <Button onClick={connectGBP} disabled={isConnectingGbp} className="bg-emerald-600 hover:bg-emerald-700">
                              {isConnectingGbp && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                              Verbinden
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>

                {/* GBP Details */}
                {gbpStatus?.connected && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-3 rounded-lg border bg-white">
                      <p className="text-xs text-muted-foreground">Bedrijfsnaam</p>
                      <p className="font-medium mt-1">{gbpStatus.businessName || "—"}</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-white">
                      <p className="text-xs text-muted-foreground">Primaire categorie</p>
                      <p className="font-medium mt-1">{gbpStatus.primaryCategory || "—"}</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-white">
                      <p className="text-xs text-muted-foreground">Gem. beoordeling</p>
                      <div className="flex items-center gap-1 mt-1">
                        {gbpStatus.avgRating != null ? (
                          <>
                            <div className="flex">{renderStars(gbpStatus.avgRating)}</div>
                            <span className="font-medium">{gbpStatus.avgRating.toFixed(1)}</span>
                          </>
                        ) : "—"}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border bg-white">
                      <p className="text-xs text-muted-foreground">Totaal beoordelingen</p>
                      <p className="font-medium mt-1">{gbpStatus.totalReviews}</p>
                    </div>
                  </div>
                )}

                {/* Last Sync */}
                {gbpStatus?.lastSyncAt && (
                  <div className="p-3 rounded-lg border bg-white">
                    <p className="text-xs text-muted-foreground">Laatste synchronisatie</p>
                    <p className="font-medium mt-1">
                      {new Date(gbpStatus.lastSyncAt).toLocaleString("nl-NL")}
                    </p>
                  </div>
                )}

                {/* Sync Error */}
                {gbpStatus?.syncError && (
                  <div className="p-3 rounded-lg border border-red-200 bg-red-50">
                    <p className="text-sm font-medium text-red-700">Fout bij synchronisatie</p>
                    <p className="text-sm text-red-600 mt-1">{gbpStatus.syncError}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================================================================ */}
          {/* TAB: Gestructureerde gegevens */}
          {/* ================================================================ */}
          <TabsContent value="structured-data">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-emerald-600" />
                      Gestructureerde gegevens (JSON-LD)
                    </CardTitle>
                    <CardDescription>
                      Genereer en bekijk gestructureerde gegevens voor lokale SEO
                    </CardDescription>
                  </div>
                  <Button
                    onClick={generateStructuredData}
                    disabled={isGeneratingSD}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isGeneratingSD ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Code2 className="w-4 h-4 mr-2" />
                    )}
                    Genereren
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {structuredData?.jsonLd ? (
                  <div className="space-y-4">
                    {structuredData.businessType && (
                      <div className="p-3 rounded-lg border bg-white">
                        <p className="text-xs text-muted-foreground">Type bedrijf</p>
                        <Badge variant="outline" className="mt-1">{structuredData.businessType}</Badge>
                      </div>
                    )}
                    <div className="relative">
                      <pre className="p-4 rounded-lg bg-gray-900 text-gray-100 text-sm overflow-x-auto max-h-96 overflow-y-auto">
                        <code>
                          {(() => {
                            try {
                              return JSON.stringify(JSON.parse(structuredData.jsonLd), null, 2);
                            } catch {
                              return structuredData.jsonLd;
                            }
                          })()}
                        </code>
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Code2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-muted-foreground mb-4">
                      Nog geen gestructureerde gegevens gegenereerd. Klik op &quot;Genereren&quot; om JSON-LD te maken.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
