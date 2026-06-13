"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Rss,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Clock,
  RefreshCw,
  Upload,
  FileUp,
  Search,
  Save,
  Package,
  Link2,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";

// --- Types ---
interface Feed {
  id: string;
  name: string;
  feedType: string;
  sourceUrl: string | null;
  sourceFormat: string | null;
  status: string;
  lastValidatedAt: string | null;
  lastFetchedAt: string | null;
  totalProducts: number;
  validProducts: number;
  warningProducts: number;
  invalidProducts: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FeedItem {
  id: string;
  title: string | null;
  description: string | null;
  gtin: string | null;
  mpn: string | null;
  sku: string | null;
  brand: string | null;
  category: string | null;
  productType: string | null;
  price: number | null;
  salePrice: number | null;
  currency: string;
  availability: string | null;
  link: string | null;
  imageLink: string | null;
  validationStatus: string;
  issues: string | null;
  productId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ValidationSummary {
  totalItems: number;
  validItems: number;
  warningItems: number;
  invalidItems: number;
  errorItems: number;
  topIssues: { field: string; count: number; severity: string; message: string }[];
  severityBreakdown: { error: number; warning: number; info: number };
}

// --- Dutch Labels ---
const feedTypeLabels: Record<string, string> = {
  MERCHANT: "Merchant feed",
  META_CATALOGUE: "Meta-catalogus",
  COMPARISON: "Vergelijkingsfeed",
  MARKETPLACE: "Marketplace",
  AFFILIATE: "Affiliate feed",
};

const feedTypeColors: Record<string, string> = {
  MERCHANT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  META_CATALOGUE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  COMPARISON: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  MARKETPLACE: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  AFFILIATE: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
};

const validationStatusLabels: Record<string, string> = {
  PENDING: "In afwachting",
  VALIDATING: "Valideren",
  VALID: "Geldig",
  VALID_WITH_WARNINGS: "Geldig met waarschuwingen",
  INVALID: "Ongeldig",
  ERROR: "Fout",
};

const validationStatusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  VALIDATING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  VALID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  VALID_WITH_WARNINGS: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  INVALID: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  ERROR: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function formatCurrency(amount: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency }).format(amount);
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "Nooit";
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
};

// --- Component ---
export default function FeedDetailPage({
  params,
}: {
  params: Promise<{ id: string; feedId: string }>;
}) {
  const { id, feedId } = use(params);
  const router = useRouter();

  const [feed, setFeed] = useState<Feed | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("items");

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState("");

  // Action states
  const [isImporting, setIsImporting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Settings form
  const [settingsName, setSettingsName] = useState("");
  const [settingsUrl, setSettingsUrl] = useState("");
  const [settingsFormat, setSettingsFormat] = useState("");
  const [settingsNotes, setSettingsNotes] = useState("");

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [feedRes, summaryRes] = await Promise.all([
        fetch(`/api/projects/${id}/feeds/${feedId}`),
        fetch(`/api/projects/${id}/feeds/${feedId}/summary`),
      ]);

      if (feedRes.ok) {
        const data = await feedRes.json();
        const feedData = data.data || data || null;
        setFeed(feedData);
        if (feedData) {
          setSettingsName(feedData.name);
          setSettingsUrl(feedData.sourceUrl || "");
          setSettingsFormat(feedData.sourceFormat || "");
          setSettingsNotes(feedData.notes || "");
        }
      }

      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data.data || data || null);
      }

      // Fetch items (simplified — in a real app this would be paginated)
      const itemsRes = await fetch(`/api/projects/${id}/feeds/${feedId}?includeItems=true`);
      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(data.items || data.data?.items || []);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [id, feedId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const res = await fetch(`/api/projects/${id}/feeds/${feedId}/import`, { method: "POST" });
      if (res.ok) {
        toast.success("Import gestart");
        fetchData();
      } else {
        toast.error("Kon import niet starten");
      }
    } catch {
      toast.error("Kon import niet starten");
    } finally {
      setIsImporting(false);
    }
  };

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const res = await fetch(`/api/projects/${id}/feeds/${feedId}/validate`, { method: "POST" });
      if (res.ok) {
        toast.success("Validatie gestart");
        fetchData();
      } else {
        toast.error("Kon validatie niet starten");
      }
    } catch {
      toast.error("Kon validatie niet starten");
    } finally {
      setIsValidating(false);
    }
  };

  const handleMatch = async () => {
    setIsMatching(true);
    try {
      const res = await fetch(`/api/projects/${id}/feeds/${feedId}/match`, { method: "POST" });
      if (res.ok) {
        toast.success("Productkoppeling gestart");
        fetchData();
      } else {
        toast.error("Kon koppeling niet starten");
      }
    } catch {
      toast.error("Kon koppeling niet starten");
    } finally {
      setIsMatching(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settingsName.trim()) {
      toast.error("Feednaam is verplicht");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}/feeds/${feedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: settingsName,
          sourceUrl: settingsUrl || null,
          sourceFormat: settingsFormat || null,
          notes: settingsNotes || null,
        }),
      });
      if (res.ok) {
        toast.success("Instellingen opgeslagen");
        fetchData();
      } else {
        toast.error("Kon instellingen niet opslaan");
      }
    } catch {
      toast.error("Kon instellingen niet opslaan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.info(`Bestand "${file.name}" geselecteerd. Klik op Importeren om te starten.`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      toast.info(`Bestand "${file.name}" geselecteerd. Klik op Importeren om te starten.`);
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    if (statusFilter !== "all" && item.validationStatus !== statusFilter) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      if (
        !(item.title || "").toLowerCase().includes(q) &&
        !(item.sku || "").toLowerCase().includes(q) &&
        !(item.gtin || "").toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  // Parse item issues
  const parseItemIssues = (issues: string | null): string[] => {
    if (!issues) return [];
    try {
      const parsed = JSON.parse(issues);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!feed) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
          <Button variant="ghost" onClick={() => router.push(`/projects/${id}/feeds`)}>
            <ArrowLeft className="h-5 w-5 mr-2" />
            Terug naar feeds
          </Button>
          <Card className="mt-8">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Rss className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Feed niet gevonden.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6"
        >
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/projects/${id}/feeds`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{feed.name}</h1>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${feedTypeColors[feed.feedType] || ""}`}>
                  {feedTypeLabels[feed.feedType] || feed.feedType}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Laatst gevalideerd: {formatDate(feed.lastValidatedAt)}
              </p>
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${validationStatusColors[feed.status] || ""}`}>
              {validationStatusLabels[feed.status] || feed.status}
            </span>
          </div>
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6"
        >
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm mb-1">Totaal</p>
              <p className="text-2xl font-bold">{feed.totalProducts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm mb-1">Geldig</p>
              <p className="text-2xl font-bold text-emerald-600">{feed.validProducts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm mb-1">Waarschuwingen</p>
              <p className="text-2xl font-bold text-yellow-600">{feed.warningProducts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm mb-1">Ongeldig</p>
              <p className="text-2xl font-bold text-red-600">{feed.invalidProducts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm mb-1">Fouten</p>
              <p className="text-2xl font-bold text-red-700">{summary?.errorItems || 0}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="validation">Validatie</TabsTrigger>
              <TabsTrigger value="import">Importeren</TabsTrigger>
              <TabsTrigger value="settings">Instellingen</TabsTrigger>
            </TabsList>

            {/* Items Tab */}
            <TabsContent value="items" className="mt-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Zoek op titel, SKU of GTIN..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <SelectValue placeholder="Validatiestatus" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle statussen</SelectItem>
                    <SelectItem value="PENDING">In afwachting</SelectItem>
                    <SelectItem value="VALIDATING">Valideren</SelectItem>
                    <SelectItem value="VALID">Geldig</SelectItem>
                    <SelectItem value="VALID_WITH_WARNINGS">Geldig met waarschuwingen</SelectItem>
                    <SelectItem value="INVALID">Ongeldig</SelectItem>
                    <SelectItem value="ERROR">Fout</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Items Table */}
              {filteredItems.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Package className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-center">
                      {items.length === 0
                        ? "Geen items gevonden. Importeer of valideer de feed om items te zien."
                        : "Geen items gevonden die overeenkomen met de filters."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[200px]">Titel</TableHead>
                            <TableHead>GTIN</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead className="text-right">Prijs</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Problemen</TableHead>
                            <TableHead>Gekoppeld</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredItems.map((item) => {
                            const itemIssues = parseItemIssues(item.issues);
                            return (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium text-sm max-w-[250px] truncate">
                                  {item.title || "—"}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{item.gtin || "—"}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{item.sku || "—"}</TableCell>
                                <TableCell className="text-right text-sm">
                                  {item.price != null ? formatCurrency(item.price, item.currency) : "—"}
                                </TableCell>
                                <TableCell>
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${validationStatusColors[item.validationStatus] || ""}`}>
                                    {validationStatusLabels[item.validationStatus] || item.validationStatus}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {itemIssues.length > 0 ? (
                                    <Badge variant="destructive" className="text-xs">
                                      {itemIssues.length} probleem{itemIssues.length !== 1 ? "men" : ""}
                                    </Badge>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">Geen</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {item.productId ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Validation Tab */}
            <TabsContent value="validation" className="mt-4">
              <div className="space-y-4">
                {/* Validate Button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Validatie-overzicht</h2>
                    <p className="text-sm text-muted-foreground">Controleer de kwaliteit van uw productfeed</p>
                  </div>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleValidate}
                    disabled={isValidating}
                  >
                    {isValidating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Valideer
                  </Button>
                </div>

                {/* Severity Breakdown */}
                {summary && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Ernstverdeling</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/10 text-center">
                          <XCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
                          <p className="text-2xl font-bold text-red-600">{summary.severityBreakdown.error}</p>
                          <p className="text-sm text-muted-foreground">Fouten</p>
                        </div>
                        <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 text-center">
                          <AlertTriangle className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
                          <p className="text-2xl font-bold text-yellow-600">{summary.severityBreakdown.warning}</p>
                          <p className="text-sm text-muted-foreground">Waarschuwingen</p>
                        </div>
                        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/10 text-center">
                          <Info className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                          <p className="text-2xl font-bold text-blue-600">{summary.severityBreakdown.info}</p>
                          <p className="text-sm text-muted-foreground">Informatie</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Top Issues */}
                {summary && summary.topIssues && summary.topIssues.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Top problemen</CardTitle>
                      <CardDescription>De meest voorkomende validatieproblemen</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {summary.topIssues.map((issue, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border">
                            {issue.severity === "error" && <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                            {issue.severity === "warning" && <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
                            {issue.severity === "info" && <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{issue.message}</p>
                              <p className="text-xs text-muted-foreground">Veld: {issue.field}</p>
                            </div>
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              {issue.count}x
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!summary && (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground text-center">
                        Nog geen validatie uitgevoerd. Klik op &quot;Valideer&quot; om de feed te controleren.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Import Tab */}
            <TabsContent value="import" className="mt-4">
              <div className="space-y-4">
                {/* Upload Area */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Feed importeren</CardTitle>
                    <CardDescription>Upload een feedbestand of importeer via URL</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                        dragOver
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10"
                          : "border-muted-foreground/25 hover:border-emerald-500/50"
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                    >
                      <FileUp className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                      <p className="text-sm font-medium mb-1">
                        Sleep een bestand hierheen of klik om te bladeren
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        Ondersteunde formaten: XML, CSV, TSV
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xml,.csv,.tsv,.txt"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <Button variant="outline" size="sm" onClick={handleFileUpload}>
                        <Upload className="h-4 w-4 mr-2" />
                        Bestand selecteren
                      </Button>
                    </div>

                    <Separator className="my-4" />

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 flex-1"
                        onClick={handleImport}
                        disabled={isImporting}
                      >
                        {isImporting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Importeren
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={handleMatch}
                        disabled={isMatching}
                      >
                        {isMatching ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Link2 className="h-4 w-4 mr-2" />
                        )}
                        Koppel aan producten
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Import info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Importinformatie</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Bron URL</p>
                        <p className="font-medium truncate">{feed.sourceUrl || "Niet ingesteld"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Formaat</p>
                        <p className="font-medium">{feed.sourceFormat?.toUpperCase() || "Niet ingesteld"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Laatst opgehaald</p>
                        <p className="font-medium">{formatDate(feed.lastFetchedAt)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Totaal items</p>
                        <p className="font-medium">{feed.totalProducts}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Feed-instellingen</CardTitle>
                  <CardDescription>Wijzig de configuratie van deze feed</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 max-w-lg">
                    <div className="grid gap-2">
                      <Label htmlFor="settingsName">Naam *</Label>
                      <Input
                        id="settingsName"
                        value={settingsName}
                        onChange={(e) => setSettingsName(e.target.value)}
                        placeholder="Feednaam"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="settingsUrl">Bron URL</Label>
                      <Input
                        id="settingsUrl"
                        value={settingsUrl}
                        onChange={(e) => setSettingsUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="settingsFormat">Formaat</Label>
                      <Select value={settingsFormat} onValueChange={setSettingsFormat}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecteer formaat" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="xml">XML</SelectItem>
                          <SelectItem value="csv">CSV</SelectItem>
                          <SelectItem value="tsv">TSV</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="settingsNotes">Notities</Label>
                      <Textarea
                        id="settingsNotes"
                        value={settingsNotes}
                        onChange={(e) => setSettingsNotes(e.target.value)}
                        placeholder="Optionele notities over deze feed"
                        rows={4}
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={handleSaveSettings}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Opslaan
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
