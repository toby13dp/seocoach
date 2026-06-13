"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Star,
  MessageSquare,
  Upload,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  Sparkles,
  FileUp,
  MapPin,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

// --- Types ---
interface ReviewSummary {
  totalReviews: number;
  averageRating: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  mixedCount: number;
  responseRate: number;
}

interface Review {
  id: string;
  projectId: string;
  locationId: string | null;
  source: string;
  externalId: string | null;
  sourceUrl: string | null;
  authorName: string | null;
  authorAvatar: string | null;
  isVerified: boolean;
  rating: number;
  title: string | null;
  content: string | null;
  sentiment: string;
  sentimentScore: number | null;
  themes: string[] | null;
  complaints: string[] | null;
  compliments: string[] | null;
  productIssues: string[] | null;
  serviceIssues: string[] | null;
  faqOpportunities: string[] | null;
  contentOpportunities: string[] | null;
  trustSignals: string[] | null;
  language: string | null;
  reviewDate: string | null;
  responseDraftId: string | null;
  responseDraft: ReviewResponse | null;
  responses: ReviewResponse[];
  importBatch: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  location?: { id: string; name: string; city: string | null } | null;
}

interface ReviewResponse {
  id: string;
  projectId: string;
  reviewId: string;
  content: string;
  status: string;
  submittedBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  publishedAt: string | null;
  publishError: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Location {
  id: string;
  name: string;
  city: string | null;
}

// --- Dutch Labels ---
const SOURCE_LABELS: Record<string, string> = {
  GOOGLE: "Google",
  WOOCOMMERCE: "WooCommerce",
  TRUSTPILOT: "Trustpilot",
  CSV_IMPORT: "CSV-import",
  SURVEY: "Enquête",
  SUPPORT_FEEDBACK: "Klantenservice-feedback",
  MANUAL: "Handmatig",
};

const SOURCE_COLORS: Record<string, string> = {
  GOOGLE: "bg-blue-100 text-blue-800 border-blue-200",
  WOOCOMMERCE: "bg-purple-100 text-purple-800 border-purple-200",
  TRUSTPILOT: "bg-green-100 text-green-800 border-green-200",
  CSV_IMPORT: "bg-gray-100 text-gray-800 border-gray-200",
  SURVEY: "bg-teal-100 text-teal-800 border-teal-200",
  SUPPORT_FEEDBACK: "bg-orange-100 text-orange-800 border-orange-200",
  MANUAL: "bg-slate-100 text-slate-800 border-slate-200",
};

const SENTIMENT_LABELS: Record<string, string> = {
  POSITIVE: "Positief",
  NEUTRAL: "Neutraal",
  NEGATIVE: "Negatief",
  MIXED: "Gemengd",
};

const SENTIMENT_COLORS: Record<string, string> = {
  POSITIVE: "bg-green-100 text-green-800 border-green-200",
  NEUTRAL: "bg-gray-100 text-gray-800 border-gray-200",
  NEGATIVE: "bg-red-100 text-red-800 border-red-200",
  MIXED: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

const RESPONSE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Concept",
  PENDING_APPROVAL: "Wacht op goedkeuring",
  APPROVED: "Goedgekeurd",
  REJECTED: "Afgewezen",
  PUBLISHED: "Gepubliceerd",
};

const RESPONSE_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800 border-gray-200",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-800 border-yellow-200",
  APPROVED: "bg-green-100 text-green-800 border-green-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  PUBLISHED: "bg-blue-100 text-blue-800 border-blue-200",
};

// --- Star Display Component ---
function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={
            star <= Math.round(rating)
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-300"
          }
        />
      ))}
    </div>
  );
}

export default function ReviewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  // --- State ---
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>({
    totalReviews: 0,
    averageRating: 0,
    positiveCount: 0,
    negativeCount: 0,
    neutralCount: 0,
    mixedCount: 0,
    responseRate: 0,
  });
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);

  // Filters
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [ratingMin, setRatingMin] = useState("");
  const [ratingMax, setRatingMax] = useState("");
  const [searchText, setSearchText] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");

  // Dialogs
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Import form
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSource, setImportSource] = useState("CSV_IMPORT");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual review form
  const [manualRating, setManualRating] = useState(5);
  const [manualTitle, setManualTitle] = useState("");
  const [manualContent, setManualContent] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");
  const [manualLocationId, setManualLocationId] = useState("");

  // --- Fetch Data ---
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/reviews/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.data || data);
      }
    } catch {
      // silent fail for summary
    }
  }, [id]);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (sentimentFilter !== "all") params.set("sentiment", sentimentFilter);
      if (ratingMin) params.set("ratingMin", ratingMin);
      if (ratingMax) params.set("ratingMax", ratingMax);
      if (searchText) params.set("search", searchText);
      if (locationFilter !== "all") params.set("locationId", locationFilter);

      const res = await fetch(`/api/projects/${id}/reviews?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.data || data || []);
      } else {
        setReviews([]);
      }
    } catch {
      setReviews([]);
    } finally {
      setIsLoading(false);
    }
  }, [id, sourceFilter, sentimentFilter, ratingMin, ratingMax, searchText, locationFilter]);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/locations`);
      if (res.ok) {
        const data = await res.json();
        setLocations(data.data || data || []);
      }
    } catch {
      setLocations([]);
    }
  }, [id]);

  useEffect(() => {
    fetchSummary();
    fetchLocations();
  }, [fetchSummary, fetchLocations]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // --- Handlers ---
  const handleImport = async () => {
    if (!importFile) {
      toast.error("Selecteer een CSV-bestand");
      return;
    }
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("source", importSource);

      const res = await fetch(`/api/projects/${id}/reviews/import`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.data?.importedCount || 0} beoordelingen geïmporteerd`);
        setShowImportDialog(false);
        setImportFile(null);
        setImportSource("CSV_IMPORT");
        fetchReviews();
        fetchSummary();
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || "Fout bij importeren");
      }
    } catch {
      toast.error("Fout bij importeren");
    } finally {
      setIsImporting(false);
    }
  };

  const handleCreateManual = async () => {
    if (!manualAuthor.trim()) {
      toast.error("Naam van auteur is verplicht");
      return;
    }
    if (!manualContent.trim()) {
      toast.error("Inhoud is verplicht");
      return;
    }
    setIsCreating(true);
    try {
      const body: Record<string, unknown> = {
        source: "MANUAL",
        rating: manualRating,
        title: manualTitle || null,
        content: manualContent,
        authorName: manualAuthor,
        locationId: manualLocationId || null,
      };

      const res = await fetch(`/api/projects/${id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success("Beoordeling toegevoegd");
        setShowAddDialog(false);
        setManualRating(5);
        setManualTitle("");
        setManualContent("");
        setManualAuthor("");
        setManualLocationId("");
        fetchReviews();
        fetchSummary();
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || "Fout bij toevoegen");
      }
    } catch {
      toast.error("Fout bij toevoegen");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAnalyze = async (reviewId: string) => {
    setIsAnalyzing(reviewId);
    try {
      const res = await fetch(`/api/projects/${id}/reviews/${reviewId}/analyze`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Analyse gestart");
        fetchReviews();
      } else {
        toast.error("Fout bij analyseren");
      }
    } catch {
      toast.error("Fout bij analyseren");
    } finally {
      setIsAnalyzing(null);
    }
  };

  const handleGenerateResponse = async (reviewId: string) => {
    setIsGenerating(reviewId);
    try {
      const res = await fetch(`/api/projects/${id}/reviews/${reviewId}/response`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Reactie gegenereerd");
        fetchReviews();
      } else {
        toast.error("Fout bij genereren reactie");
      }
    } catch {
      toast.error("Fout bij genereren reactie");
    } finally {
      setIsGenerating(null);
    }
  };

  const hasAnalysis = (review: Review) => {
    return (
      review.sentimentScore !== null ||
      (review.themes && review.themes.length > 0) ||
      (review.compliments && review.compliments.length > 0) ||
      (review.complaints && review.complaints.length > 0)
    );
  };

  // --- Render ---
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-4 mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/projects/${id}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Beoordelingen</h1>
              <p className="text-muted-foreground">
                Beheer beoordelingen en je online reputatie
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6"
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <MessageSquare className="h-4 w-4" />
                <span className="text-xs font-medium">Totaal</span>
              </div>
              <p className="text-2xl font-bold">{summary.totalReviews}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Star className="h-4 w-4" />
                <span className="text-xs font-medium">Gemiddelde</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">
                  {summary.averageRating > 0 ? summary.averageRating.toFixed(1) : "—"}
                </p>
                <StarRating rating={summary.averageRating} size={14} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <ThumbsUp className="h-4 w-4" />
                <span className="text-xs font-medium">Positief</span>
              </div>
              <p className="text-2xl font-bold text-green-700">
                {summary.positiveCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <ThumbsDown className="h-4 w-4" />
                <span className="text-xs font-medium">Negatief</span>
              </div>
              <p className="text-2xl font-bold text-red-700">
                {summary.negativeCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <BarChart3 className="h-4 w-4" />
                <span className="text-xs font-medium">Reactiesnelheid</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-blue-700">
                  {summary.responseRate}%
                </p>
              </div>
              <Progress value={summary.responseRate} className="mt-1 h-1.5" />
            </CardContent>
          </Card>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-wrap items-center gap-3 mb-6"
        >
          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                CSV importeren
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Beoordelingen importeren</DialogTitle>
                <DialogDescription>
                  Upload een CSV-bestand met beoordelingen
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="import-source">Bron</Label>
                  <Select value={importSource} onValueChange={setImportSource}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer bron" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GOOGLE">Google</SelectItem>
                      <SelectItem value="WOOCOMMERCE">WooCommerce</SelectItem>
                      <SelectItem value="TRUSTPILOT">Trustpilot</SelectItem>
                      <SelectItem value="CSV_IMPORT">CSV-import</SelectItem>
                      <SelectItem value="SURVEY">Enquête</SelectItem>
                      <SelectItem value="SUPPORT_FEEDBACK">
                        Klantenservice-feedback
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="import-file">CSV-bestand</Label>
                  <div
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {importFile ? importFile.name : "Klik om bestand te selecteren"}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) =>
                        setImportFile(e.target.files?.[0] || null)
                      }
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowImportDialog(false)}
                >
                  Annuleren
                </Button>
                <Button onClick={handleImport} disabled={isImporting}>
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importeren...
                    </>
                  ) : (
                    "Importeren"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Beoordeling toevoegen
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Handmatige beoordeling toevoegen</DialogTitle>
                <DialogDescription>
                  Voeg een beoordeling handmatig toe aan het project
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label>Beoordeling</Label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setManualRating(star)}
                        className="p-0.5 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`h-7 w-7 ${
                            star <= manualRating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-sm text-muted-foreground">
                      {manualRating}/5
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-title">Titel (optioneel)</Label>
                  <Input
                    id="manual-title"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="Korte samenvatting"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-content">Inhoud *</Label>
                  <Textarea
                    id="manual-content"
                    value={manualContent}
                    onChange={(e) => setManualContent(e.target.value)}
                    placeholder="Volledige beoordelingstekst"
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-author">Naam auteur *</Label>
                  <Input
                    id="manual-author"
                    value={manualAuthor}
                    onChange={(e) => setManualAuthor(e.target.value)}
                    placeholder="Naam van de beoordelaar"
                  />
                </div>
                {locations.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="manual-location">Locatie (optioneel)</Label>
                    <Select
                      value={manualLocationId}
                      onValueChange={setManualLocationId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteer locatie" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                            {loc.city ? ` — ${loc.city}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowAddDialog(false)}
                >
                  Annuleren
                </Button>
                <Button onClick={handleCreateManual} disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Toevoegen...
                    </>
                  ) : (
                    "Toevoegen"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Bron</Label>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Alle bronnen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle bronnen</SelectItem>
                      <SelectItem value="GOOGLE">Google</SelectItem>
                      <SelectItem value="WOOCOMMERCE">WooCommerce</SelectItem>
                      <SelectItem value="TRUSTPILOT">Trustpilot</SelectItem>
                      <SelectItem value="CSV_IMPORT">CSV-import</SelectItem>
                      <SelectItem value="SURVEY">Enquête</SelectItem>
                      <SelectItem value="SUPPORT_FEEDBACK">
                        Klantenservice-feedback
                      </SelectItem>
                      <SelectItem value="MANUAL">Handmatig</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sentiment</Label>
                  <Select
                    value={sentimentFilter}
                    onValueChange={setSentimentFilter}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Alle sentimenten" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle sentimenten</SelectItem>
                      <SelectItem value="POSITIVE">Positief</SelectItem>
                      <SelectItem value="NEUTRAL">Neutraal</SelectItem>
                      <SelectItem value="NEGATIVE">Negatief</SelectItem>
                      <SelectItem value="MIXED">Gemengd</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Min. beoordeling</Label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    placeholder="1"
                    value={ratingMin}
                    onChange={(e) => setRatingMin(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max. beoordeling</Label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    placeholder="5"
                    value={ratingMax}
                    onChange={(e) => setRatingMax(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Zoeken</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Zoek in beoordelingen..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="h-9 pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Locatie</Label>
                  <Select
                    value={locationFilter}
                    onValueChange={setLocationFilter}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Alle locaties" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle locaties</SelectItem>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Review Cards List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : reviews.length === 0 ? (
            <Card>
              <CardContent className="py-20 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  Geen beoordelingen gevonden
                </h3>
                <p className="text-muted-foreground mb-4">
                  Importeer beoordelingen of voeg er handmatig een toe om te
                  beginnen.
                </p>
                <div className="flex justify-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowImportDialog(true)}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    CSV importeren
                  </Button>
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Beoordeling toevoegen
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            reviews.map((review, index) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() =>
                    router.push(`/projects/${id}/reviews/${review.id}`)
                  }
                >
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      {/* Avatar + Author */}
                      <div className="flex items-center gap-3 sm:min-w-[200px]">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                          {review.authorName
                            ? review.authorName.charAt(0).toUpperCase()
                            : "?"}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm truncate">
                              {review.authorName || "Anoniem"}
                            </span>
                            {review.isVerified && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <StarRating rating={review.rating} size={12} />
                            <span className="text-xs text-muted-foreground">
                              {review.rating.toFixed(1)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {review.reviewDate
                              ? new Date(review.reviewDate).toLocaleDateString(
                                  "nl-NL"
                                )
                              : new Date(review.createdAt).toLocaleDateString(
                                  "nl-NL"
                                )}
                          </p>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {review.title && (
                          <p className="font-semibold text-sm mb-1">
                            {review.title}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {review.content || "Geen inhoud"}
                        </p>

                        {/* Badges row */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-3">
                          {/* Source badge */}
                          <Badge
                            variant="outline"
                            className={`text-xs ${SOURCE_COLORS[review.source] || "bg-gray-100 text-gray-800"}`}
                          >
                            {SOURCE_LABELS[review.source] || review.source}
                          </Badge>

                          {/* Sentiment badge */}
                          <Badge
                            variant="outline"
                            className={`text-xs ${SENTIMENT_COLORS[review.sentiment] || ""}`}
                          >
                            {SENTIMENT_LABELS[review.sentiment] ||
                              review.sentiment}
                          </Badge>

                          {/* Location badge */}
                          {review.location && (
                            <Badge variant="outline" className="text-xs">
                              <MapPin className="h-3 w-3 mr-1" />
                              {review.location.name}
                            </Badge>
                          )}

                          {/* Response status badge */}
                          {review.responseDraft && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${RESPONSE_STATUS_COLORS[review.responseDraft.status] || ""}`}
                            >
                              {RESPONSE_STATUS_LABELS[
                                review.responseDraft.status
                              ] || review.responseDraft.status}
                            </Badge>
                          )}

                          {/* Themes tags */}
                          {review.themes &&
                            review.themes.slice(0, 3).map((theme) => (
                              <Badge
                                key={theme}
                                variant="secondary"
                                className="text-xs"
                              >
                                {theme}
                              </Badge>
                            ))}
                          {review.themes && review.themes.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{review.themes.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex sm:flex-col items-center gap-2 shrink-0">
                        {!hasAnalysis(review) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAnalyze(review.id);
                            }}
                            disabled={isAnalyzing === review.id}
                          >
                            {isAnalyzing === review.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5" />
                            )}
                            Analyseer
                          </Button>
                        )}
                        {!review.responseDraft && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateResponse(review.id);
                            }}
                            disabled={isGenerating === review.id}
                          >
                            {isGenerating === review.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <MessageSquare className="h-3.5 w-3.5" />
                            )}
                            Genereer reactie
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(
                              `/projects/${id}/reviews/${review.id}`
                            );
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
