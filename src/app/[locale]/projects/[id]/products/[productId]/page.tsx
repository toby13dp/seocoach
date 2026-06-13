"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  BarChart3,
  Image as ImageIcon,
  FileText,
  Code2,
  TrendingUp,
  Link2,
  Sparkles,
  Calendar,
  Snowflake,
  Sun,
  Leaf,
} from "lucide-react";
import { toast } from "sonner";

// --- Types ---
interface Product {
  id: string;
  name: string;
  sku: string | null;
  gtin: string | null;
  mpn: string | null;
  brand: string | null;
  description: string | null;
  shortDescription: string | null;
  categoryId: string | null;
  productType: string | null;
  regularPrice: number | null;
  salePrice: number | null;
  currency: string;
  costPrice: number | null;
  margin: number | null;
  stockStatus: string;
  stockQuantity: number | null;
  manageStock: boolean;
  imageUrl: string | null;
  imageAlt: string | null;
  additionalImages: string | null;
  productUrl: string | null;
  titleQuality: number;
  descriptionQuality: number;
  structuredDataScore: number;
  imageScore: number;
  overallSeoScore: number;
  seoIssues: string | null;
  revenue30d: number;
  revenue90d: number;
  unitsSold30d: number | null;
  unitsSold90d: number | null;
  internalLinkCount: number;
  isSeasonal: boolean;
  seasonalMonths: string | null;
  parentProductId: string | null;
  variationAttributes: string | null;
  source: string | null;
  createdAt: string;
  category?: { id: string; name: string } | null;
}

interface Variation {
  id: string;
  name: string;
  sku: string | null;
  variationAttributes: string | null;
  stockStatus: string;
  stockQuantity: number | null;
  imageUrl: string | null;
  regularPrice: number | null;
  currency: string;
  overallSeoScore: number;
  titleQuality: number;
  descriptionQuality: number;
}

interface SeoIssue {
  severity: string;
  field: string;
  description: string;
  recommendation: string;
}

// --- Dutch Labels ---
const stockStatusLabels: Record<string, string> = {
  ACTIVE: "Actief",
  OUT_OF_STOCK: "Uit voorraad",
  DISCONTINUED: "Stopgezet",
  SEASONAL: "Seizoensgebonden",
  DRAFT: "Concept",
};

const stockStatusColors: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  OUT_OF_STOCK: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  DISCONTINUED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  SEASONAL: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  DRAFT: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

function seoScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function seoScoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (score >= 50) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
}

function formatCurrency(amount: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency }).format(amount);
}

const monthNames = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

const severityIcons: Record<string, React.ReactNode> = {
  error: <XCircle className="h-4 w-4 text-red-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  info: <Info className="h-4 w-4 text-blue-500" />,
};

const severityLabels: Record<string, string> = {
  error: "Fout",
  warning: "Waarschuwing",
  info: "Informatie",
};

const seasonIcons: Record<string, React.ReactNode> = {
  winter: <Snowflake className="h-4 w-4 text-blue-500" />,
  spring: <Leaf className="h-4 w-4 text-green-500" />,
  summer: <Sun className="h-4 w-4 text-yellow-500" />,
  autumn: <Leaf className="h-4 w-4 text-orange-500" />,
};

// --- Component ---
export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string; productId: string }>;
}) {
  const { id, productId } = use(params);
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [productRes, variationsRes] = await Promise.all([
        fetch(`/api/projects/${id}/products/${productId}`),
        fetch(`/api/projects/${id}/products/variations/${productId}`),
      ]);

      if (productRes.ok) {
        const data = await productRes.json();
        setProduct(data.data || data || null);
      }
      if (variationsRes.ok) {
        const data = await variationsRes.json();
        setVariations(data.data || data || []);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [id, productId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch(`/api/projects/${id}/products/${productId}/analyze`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("SEO-analyse gestart");
        fetchData();
      } else {
        toast.error("Kon analyse niet starten");
      }
    } catch {
      toast.error("Kon analyse niet starten");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Parse SEO issues
  const parsedSeoIssues: SeoIssue[] = (() => {
    if (!product?.seoIssues) return [];
    try {
      const parsed = JSON.parse(product.seoIssues);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const errorIssues = parsedSeoIssues.filter((i) => i.severity === "error");
  const warningIssues = parsedSeoIssues.filter((i) => i.severity === "warning");
  const infoIssues = parsedSeoIssues.filter((i) => i.severity === "info");

  // Parse seasonal months
  const seasonalMonthNumbers: number[] = (() => {
    if (!product?.seasonalMonths) return [];
    try {
      const parsed = JSON.parse(product.seasonalMonths);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  // Determine current season
  const currentMonth = new Date().getMonth() + 1;
  const isInSeason = seasonalMonthNumbers.includes(currentMonth);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
          <Button variant="ghost" onClick={() => router.push(`/projects/${id}/products`)}>
            <ArrowLeft className="h-5 w-5 mr-2" />
            Terug naar producten
          </Button>
          <Card className="mt-8">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Product niet gevonden.</p>
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
            <Button variant="ghost" size="icon" onClick={() => router.push(`/projects/${id}/products`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{product.name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                {product.sku && <span>SKU: {product.sku}</span>}
                {product.brand && (
                  <>
                    {product.sku && <span>·</span>}
                    <span>{product.brand}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${stockStatusColors[product.stockStatus] || stockStatusColors.DRAFT}`}>
              {stockStatusLabels[product.stockStatus] || product.stockStatus}
            </span>
            {product.isSeasonal && (
              <Badge variant="outline" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                Seizoensgebonden
              </Badge>
            )}
          </div>
        </motion.div>

        {/* SEO Score Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6"
        >
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-emerald-600" />
                  SEO-score
                </CardTitle>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  size="sm"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Analyseer
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center p-4">
                  <div className={`text-5xl font-bold ${seoScoreColor(product.overallSeoScore)}`}>
                    {Math.round(product.overallSeoScore)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Totaal</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        Titel
                      </span>
                      <span className={seoScoreColor(product.titleQuality)}>{Math.round(product.titleQuality)}</span>
                    </div>
                    <Progress value={product.titleQuality} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        Beschrijving
                      </span>
                      <span className={seoScoreColor(product.descriptionQuality)}>{Math.round(product.descriptionQuality)}</span>
                    </div>
                    <Progress value={product.descriptionQuality} className="h-2" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-1.5">
                        <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                        Gestructureerde data
                      </span>
                      <span className={seoScoreColor(product.structuredDataScore)}>{Math.round(product.structuredDataScore)}</span>
                    </div>
                    <Progress value={product.structuredDataScore} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        Afbeeldingen
                      </span>
                      <span className={seoScoreColor(product.imageScore)}>{Math.round(product.imageScore)}</span>
                    </div>
                    <Progress value={product.imageScore} className="h-2" />
                  </div>
                </div>
              </div>
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
              <TabsTrigger value="overview">Overzicht</TabsTrigger>
              <TabsTrigger value="seo">SEO-analyse</TabsTrigger>
              <TabsTrigger value="variations">
                Variaties {variations.length > 0 && `(${variations.length})`}
              </TabsTrigger>
              <TabsTrigger value="seasonal">Seizoensanalyse</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Product Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Productinformatie</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {product.imageUrl && (
                      <div className="w-full h-48 rounded-lg overflow-hidden bg-muted mb-3">
                        <img src={product.imageUrl} alt={product.imageAlt || product.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Naam</p>
                        <p className="font-medium">{product.name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">SKU</p>
                        <p className="font-medium">{product.sku || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Merk</p>
                        <p className="font-medium">{product.brand || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Categorie</p>
                        <p className="font-medium">{product.category?.name || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Prijs</p>
                        <p className="font-medium">
                          {product.regularPrice != null ? formatCurrency(product.regularPrice, product.currency) : "—"}
                          {product.salePrice != null && product.salePrice < (product.regularPrice || Infinity) && (
                            <span className="text-emerald-600 ml-1 text-xs">
                              (Nu: {formatCurrency(product.salePrice, product.currency)})
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Voorraadstatus</p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stockStatusColors[product.stockStatus] || stockStatusColors.DRAFT}`}>
                          {stockStatusLabels[product.stockStatus] || product.stockStatus}
                        </span>
                        {product.stockQuantity != null && (
                          <span className="text-muted-foreground text-xs ml-1">({product.stockQuantity})</span>
                        )}
                      </div>
                      <div>
                        <p className="text-muted-foreground">GTIN</p>
                        <p className="font-medium">{product.gtin || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">MPN</p>
                        <p className="font-medium">{product.mpn || "—"}</p>
                      </div>
                    </div>
                    {product.description && (
                      <div className="mt-3">
                        <p className="text-muted-foreground text-sm">Beschrijving</p>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{product.description}</p>
                      </div>
                    )}
                    {product.productUrl && (
                      <div className="mt-3">
                        <a
                          href={product.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-emerald-600 hover:underline flex items-center gap-1"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Productpagina bekijken
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Revenue & Links */}
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                        Omzetgegevens
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-sm text-muted-foreground">Omzet 30 dagen</p>
                          <p className="text-xl font-bold">{formatCurrency(product.revenue30d, product.currency)}</p>
                          {product.unitsSold30d != null && (
                            <p className="text-xs text-muted-foreground">{product.unitsSold30d} verkocht</p>
                          )}
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-sm text-muted-foreground">Omzet 90 dagen</p>
                          <p className="text-xl font-bold">{formatCurrency(product.revenue90d, product.currency)}</p>
                          {product.unitsSold90d != null && (
                            <p className="text-xs text-muted-foreground">{product.unitsSold90d} verkocht</p>
                          )}
                        </div>
                        {product.margin != null && (
                          <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-sm text-muted-foreground">Marge</p>
                            <p className="text-xl font-bold">{product.margin.toFixed(1)}%</p>
                          </div>
                        )}
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-sm text-muted-foreground">Interne links</p>
                          <p className="text-xl font-bold">{product.internalLinkCount}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* SEO Quick Stats */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">SEO-samenvatting</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Titelkwaliteit</span>
                          <div className="flex items-center gap-2">
                            <Progress value={product.titleQuality} className="w-24 h-2" />
                            <span className={`text-sm font-medium ${seoScoreColor(product.titleQuality)}`}>
                              {Math.round(product.titleQuality)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Beschrijvingskwaliteit</span>
                          <div className="flex items-center gap-2">
                            <Progress value={product.descriptionQuality} className="w-24 h-2" />
                            <span className={`text-sm font-medium ${seoScoreColor(product.descriptionQuality)}`}>
                              {Math.round(product.descriptionQuality)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Gestructureerde data</span>
                          <div className="flex items-center gap-2">
                            <Progress value={product.structuredDataScore} className="w-24 h-2" />
                            <span className={`text-sm font-medium ${seoScoreColor(product.structuredDataScore)}`}>
                              {Math.round(product.structuredDataScore)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Afbeeldingenscore</span>
                          <div className="flex items-center gap-2">
                            <Progress value={product.imageScore} className="w-24 h-2" />
                            <span className={`text-sm font-medium ${seoScoreColor(product.imageScore)}`}>
                              {Math.round(product.imageScore)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {parsedSeoIssues.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center gap-3 text-sm">
                            {errorIssues.length > 0 && (
                              <span className="flex items-center gap-1 text-red-600">
                                <XCircle className="h-3.5 w-3.5" />
                                {errorIssues.length} fout{errorIssues.length !== 1 ? "en" : ""}
                              </span>
                            )}
                            {warningIssues.length > 0 && (
                              <span className="flex items-center gap-1 text-yellow-600">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {warningIssues.length} waarschuwing{warningIssues.length !== 1 ? "en" : ""}
                              </span>
                            )}
                            {infoIssues.length > 0 && (
                              <span className="flex items-center gap-1 text-blue-600">
                                <Info className="h-3.5 w-3.5" />
                                {infoIssues.length} tip{infoIssues.length !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* SEO Analysis Tab */}
            <TabsContent value="seo" className="mt-4">
              {parsedSeoIssues.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <CheckCircle2 className="h-12 w-12 text-emerald-600 mb-4" />
                    <p className="text-muted-foreground text-center">
                      Geen SEO-problemen gevonden. Klik op &quot;Analyseer&quot; om een nieuwe analyse uit te voeren.
                    </p>
                    <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" onClick={handleAnalyze} disabled={isAnalyzing}>
                      {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      Analyseer
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Errors */}
                  {errorIssues.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg text-red-600">
                          <XCircle className="h-5 w-5" />
                          Fouten ({errorIssues.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {errorIssues.map((issue, idx) => (
                          <div key={idx} className="p-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10">
                            <div className="flex items-start gap-2">
                              <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-sm">{issue.description}</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Aanbeveling:</span> {issue.recommendation}
                                </p>
                                <Badge variant="outline" className="text-xs mt-1">{issue.field}</Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Warnings */}
                  {warningIssues.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg text-yellow-600">
                          <AlertTriangle className="h-5 w-5" />
                          Waarschuwingen ({warningIssues.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {warningIssues.map((issue, idx) => (
                          <div key={idx} className="p-3 rounded-lg border border-yellow-200 dark:border-yellow-900/50 bg-yellow-50 dark:bg-yellow-900/10">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-sm">{issue.description}</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Aanbeveling:</span> {issue.recommendation}
                                </p>
                                <Badge variant="outline" className="text-xs mt-1">{issue.field}</Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Info */}
                  {infoIssues.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg text-blue-600">
                          <Info className="h-5 w-5" />
                          Informatie ({infoIssues.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {infoIssues.map((issue, idx) => (
                          <div key={idx} className="p-3 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10">
                            <div className="flex items-start gap-2">
                              <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-sm">{issue.description}</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Aanbeveling:</span> {issue.recommendation}
                                </p>
                                <Badge variant="outline" className="text-xs mt-1">{issue.field}</Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Variations Tab */}
            <TabsContent value="variations" className="mt-4">
              {variations.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-center">
                      Geen variaties gevonden voor dit product.
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
                            <TableHead className="min-w-[180px]">Variatie</TableHead>
                            <TableHead>Kenmerken</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Voorraad</TableHead>
                            <TableHead className="text-right">Prijs</TableHead>
                            <TableHead>SEO-score</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {variations.map((variation) => {
                            let attrs: Record<string, string> = {};
                            try {
                              if (variation.variationAttributes) {
                                attrs = JSON.parse(variation.variationAttributes);
                              }
                            } catch { /* ignore */ }

                            return (
                              <TableRow key={variation.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {variation.imageUrl ? (
                                      <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-muted">
                                        <img src={variation.imageUrl} alt={variation.name} className="w-full h-full object-cover" />
                                      </div>
                                    ) : (
                                      <div className="w-8 h-8 rounded flex-shrink-0 bg-muted flex items-center justify-center">
                                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                    )}
                                    <span className="font-medium text-sm truncate max-w-[150px]">{variation.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(attrs).map(([key, val]) => (
                                      <Badge key={key} variant="outline" className="text-xs">
                                        {key}: {val}
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{variation.sku || "—"}</TableCell>
                                <TableCell>
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stockStatusColors[variation.stockStatus] || stockStatusColors.DRAFT}`}>
                                    {stockStatusLabels[variation.stockStatus] || variation.stockStatus}
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm">{variation.stockQuantity ?? "—"}</TableCell>
                                <TableCell className="text-right text-sm">
                                  {variation.regularPrice != null ? formatCurrency(variation.regularPrice, variation.currency) : "—"}
                                </TableCell>
                                <TableCell>
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${seoScoreBg(variation.overallSeoScore)}`}>
                                    {Math.round(variation.overallSeoScore)}
                                  </span>
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

            {/* Seasonal Analysis Tab */}
            <TabsContent value="seasonal" className="mt-4">
              {!product.isSeasonal ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-center">
                      Dit product is niet gemarkeerd als seizoensgebonden.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Seasonal Status */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Calendar className="h-5 w-5 text-emerald-600" />
                        Seizoensstatus
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3 mb-4">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${isInSeason ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"}`}>
                          {isInSeason ? "In seizoen" : "Buiten seizoen"}
                        </span>
                      </div>

                      {/* Month calendar */}
                      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
                        {monthNames.map((name, idx) => {
                          const monthNum = idx + 1;
                          const isActive = seasonalMonthNumbers.includes(monthNum);
                          const isCurrent = monthNum === currentMonth;
                          return (
                            <div
                              key={idx}
                              className={`p-2 rounded-lg text-center text-xs font-medium border ${
                                isActive
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
                                  : "bg-muted/50 text-muted-foreground border-transparent"
                              } ${isCurrent ? "ring-2 ring-emerald-500" : ""}`}
                            >
                              <div>{name.slice(0, 3)}</div>
                              {isCurrent && <div className="text-[10px] text-emerald-600">nu</div>}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recommendations */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Seizoensaanbevelingen</CardTitle>
                      <CardDescription>Optimaliseer uw SEO-strategie op basis van het seizoen</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Pre-season */}
                      <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10">
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles className="h-4 w-4 text-blue-500" />
                          <span className="font-medium text-sm">Voor het seizoen</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Zorg ervoor dat productbeschrijvingen en metadata up-to-date zijn. Begin met het bouwen van interne links en content rondom het product. Optimaliseer gestructureerde data en afbeeldingen.
                        </p>
                      </div>

                      {/* In-season */}
                      <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/10">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                          <span className="font-medium text-sm">Tijdens het seizoen</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Monitor rankings en concurrentie. Update voorraadstatus en prijzen. Creëer aanvullende content zoals blogposts en FAQ-pagina&apos;s. Verzamel en toon klantbeoordelingen.
                        </p>
                      </div>

                      {/* Post-season */}
                      <div className="p-3 rounded-lg border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/10">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-4 w-4 text-orange-500" />
                          <span className="font-medium text-sm">Na het seizoen</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Analyseer de prestaties van het afgelopen seizoen. Archiveer of pas de voorraadstatus aan. Behoud de pagina met relevantie door evergreen content toe te voegen. Bereid u voor op het volgende seizoen.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
