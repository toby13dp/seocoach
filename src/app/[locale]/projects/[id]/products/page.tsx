"use client";

import { useState, useEffect, use, useCallback } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Plus,
  ShoppingBag,
  Search,
  LayoutGrid,
  List,
  TrendingUp,
  Package,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BarChart3,
  ArrowUpRight,
  Euro,
  Filter,
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
  categoryId: string | null;
  regularPrice: number | null;
  salePrice: number | null;
  currency: string;
  costPrice: number | null;
  margin: number | null;
  stockStatus: string;
  stockQuantity: number | null;
  imageUrl: string | null;
  productUrl: string | null;
  titleQuality: number;
  descriptionQuality: number;
  structuredDataScore: number;
  imageScore: number;
  overallSeoScore: number;
  revenue30d: number;
  revenue90d: number;
  unitsSold30d: number | null;
  internalLinkCount: number;
  isSeasonal: boolean;
  seasonalMonths: string | null;
  parentProductId: string | null;
  variationAttributes: string | null;
  source: string | null;
  createdAt: string;
  category?: { id: string; name: string } | null;
  _count?: { variations: number };
}

interface InventorySummary {
  totalProducts: number;
  activeProducts: number;
  outOfStock: number;
  avgSeoScore: number;
  totalRevenue30d: number;
}

interface RevenuePriority {
  productId: string;
  productName: string;
  revenue30d: number;
  overallSeoScore: number;
  priority: string;
  reason: string;
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

const priorityLabels: Record<string, string> = {
  critical: "Kritiek",
  high: "Hoog",
  medium: "Gemiddeld",
  low: "Laag",
};

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
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

// --- Component ---
export default function ProductsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [revenuePriorities, setRevenuePriorities] = useState<RevenuePriority[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [seoRange, setSeoRange] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("revenue");

  // View state
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formGtin, setFormGtin] = useState("");
  const [formBrand, setFormBrand] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formSalePrice, setFormSalePrice] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formProductUrl, setFormProductUrl] = useState("");

  // Categories for filter
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [productsRes, inventoryRes, priorityRes] = await Promise.all([
        fetch(`/api/projects/${id}/products`),
        fetch(`/api/projects/${id}/products/inventory`),
        fetch(`/api/projects/${id}/products/revenue-prioritization`),
      ]);

      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data.data || data || []);
      }
      if (inventoryRes.ok) {
        const data = await inventoryRes.json();
        setInventorySummary(data.data || data || null);
      }
      if (priorityRes.ok) {
        const data = await priorityRes.json();
        setRevenuePriorities(data.data || data || []);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Extract categories from products
  useEffect(() => {
    const cats = new Map<string, string>();
    products.forEach((p) => {
      if (p.categoryId && p.category) {
        cats.set(p.categoryId, p.category.name);
      }
    });
    setCategories(Array.from(cats.entries()).map(([id, name]) => ({ id, name })));
  }, [products]);

  // Filter and sort products
  const filteredProducts = products
    .filter((p) => {
      if (searchText) {
        const q = searchText.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !(p.sku || "").toLowerCase().includes(q) &&
          !(p.brand || "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (categoryFilter !== "all" && p.categoryId !== categoryFilter) return false;
      if (stockFilter !== "all" && p.stockStatus !== stockFilter) return false;
      if (seoRange !== "all") {
        if (seoRange === "low" && p.overallSeoScore >= 50) return false;
        if (seoRange === "medium" && (p.overallSeoScore < 50 || p.overallSeoScore >= 80)) return false;
        if (seoRange === "high" && p.overallSeoScore < 80) return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "revenue":
          return (b.revenue30d || 0) - (a.revenue30d || 0);
        case "seo":
          return (b.overallSeoScore || 0) - (a.overallSeoScore || 0);
        case "name":
          return a.name.localeCompare(b.name, "nl");
        default:
          return 0;
      }
    });

  const handleAddProduct = async () => {
    if (!formName.trim()) {
      toast.error("Productnaam is verplicht");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${id}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          sku: formSku || null,
          gtin: formGtin || null,
          brand: formBrand || null,
          categoryId: formCategory || null,
          regularPrice: formPrice ? parseFloat(formPrice) : null,
          salePrice: formSalePrice ? parseFloat(formSalePrice) : null,
          description: formDescription || null,
          imageUrl: formImageUrl || null,
          productUrl: formProductUrl || null,
        }),
      });
      if (res.ok) {
        toast.success("Product toegevoegd");
        setAddDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Kon product niet toevoegen");
      }
    } catch {
      toast.error("Kon product niet toevoegen");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormSku("");
    setFormGtin("");
    setFormBrand("");
    setFormCategory("");
    setFormPrice("");
    setFormSalePrice("");
    setFormDescription("");
    setFormImageUrl("");
    setFormProductUrl("");
  };

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
            <Button variant="ghost" size="icon" onClick={() => router.push(`/projects/${id}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Producten</h1>
              <p className="text-sm text-muted-foreground">E-commerce SEO en productbeheer</p>
            </div>
          </div>
          <div className="flex-1" />
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-2" />
                Product toevoegen
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Product toevoegen</DialogTitle>
                <DialogDescription>Voeg een nieuw product toe aan het project.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Naam *</Label>
                  <Input id="name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Productnaam" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input id="sku" value={formSku} onChange={(e) => setFormSku(e.target.value)} placeholder="SKU-code" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gtin">GTIN</Label>
                    <Input id="gtin" value={formGtin} onChange={(e) => setFormGtin(e.target.value)} placeholder="EAN/UPC" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="brand">Merk</Label>
                    <Input id="brand" value={formBrand} onChange={(e) => setFormBrand(e.target.value)} placeholder="Merknaam" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="category">Categorie</Label>
                    <Select value={formCategory} onValueChange={setFormCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteer categorie" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="price">Prijs</Label>
                    <Input id="price" type="number" step="0.01" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} placeholder="0,00" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="salePrice">Aanbiedingsprijs</Label>
                    <Input id="salePrice" type="number" step="0.01" value={formSalePrice} onChange={(e) => setFormSalePrice(e.target.value)} placeholder="0,00" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Beschrijving</Label>
                  <Textarea id="description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Productbeschrijving" rows={3} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="imageUrl">Afbeelding URL</Label>
                  <Input id="imageUrl" value={formImageUrl} onChange={(e) => setFormImageUrl(e.target.value)} placeholder="https://..." />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="productUrl">Product URL</Label>
                  <Input id="productUrl" value={formProductUrl} onChange={(e) => setFormProductUrl(e.target.value)} placeholder="https://..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Annuleren
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleAddProduct} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Toevoegen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* Stats Bar */}
        {inventorySummary && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6"
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <Package className="h-4 w-4" />
                  Totaal
                </div>
                <p className="text-2xl font-bold">{inventorySummary.totalProducts}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Actief
                </div>
                <p className="text-2xl font-bold text-emerald-600">{inventorySummary.activeProducts}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <XCircle className="h-4 w-4" />
                  Uit voorraad
                </div>
                <p className="text-2xl font-bold text-red-600">{inventorySummary.outOfStock}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <BarChart3 className="h-4 w-4" />
                  Gem. SEO-score
                </div>
                <p className={`text-2xl font-bold ${seoScoreColor(inventorySummary.avgSeoScore)}`}>
                  {Math.round(inventorySummary.avgSeoScore)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <Euro className="h-4 w-4" />
                  Omzet 30d
                </div>
                <p className="text-2xl font-bold">{formatCurrency(inventorySummary.totalRevenue30d)}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-4"
        >
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="sm:col-span-2 lg:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Zoek op naam, SKU of merk..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Categorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle categorieën</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Voorraadstatus" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle statussen</SelectItem>
                    <SelectItem value="ACTIVE">Actief</SelectItem>
                    <SelectItem value="OUT_OF_STOCK">Uit voorraad</SelectItem>
                    <SelectItem value="DISCONTINUED">Stopgezet</SelectItem>
                    <SelectItem value="SEASONAL">Seizoensgebonden</SelectItem>
                    <SelectItem value="DRAFT">Concept</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={seoRange} onValueChange={setSeoRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="SEO-score" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle scores</SelectItem>
                    <SelectItem value="high">Goed (≥80)</SelectItem>
                    <SelectItem value="medium">Gemiddeld (50-79)</SelectItem>
                    <SelectItem value="low">Slecht (&lt;50)</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sorteren" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">Omzet</SelectItem>
                    <SelectItem value="seo">SEO-score</SelectItem>
                    <SelectItem value="name">Naam</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* View Toggle */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            {filteredProducts.length} product{filteredProducts.length !== 1 ? "en" : ""}
          </p>
          <div className="flex items-center gap-1 bg-muted rounded-md p-1">
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm"
              className={viewMode === "cards" ? "h-7 px-2" : "h-7 px-2"}
              onClick={() => setViewMode("cards")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              className={viewMode === "table" ? "h-7 px-2" : "h-7 px-2"}
              onClick={() => setViewMode("table")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : filteredProducts.length === 0 ? (
          /* Empty State */
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center max-w-md">
                  Nog geen producten. Voeg producten toe of importeer ze via een feed.
                </p>
                <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Product toevoegen
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : viewMode === "cards" ? (
          /* Card View */
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product, idx) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * Math.min(idx, 5) }}
                >
                  <Card
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => router.push(`/projects/${id}/products/${product.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        {product.imageUrl ? (
                          <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-muted">
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-md flex-shrink-0 bg-muted flex items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{product.name}</h3>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {product.sku && <span>SKU: {product.sku}</span>}
                            {product.brand && <span>· {product.brand}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {product.category && (
                          <Badge variant="outline" className="text-xs">{product.category.name}</Badge>
                        )}
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${seoScoreBg(product.overallSeoScore)}`}>
                          SEO: {Math.round(product.overallSeoScore)}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stockStatusColors[product.stockStatus] || stockStatusColors.DRAFT}`}>
                          {stockStatusLabels[product.stockStatus] || product.stockStatus}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-3 text-sm">
                        <div>
                          {product.regularPrice != null && (
                            <div>
                              <span className="font-semibold">{formatCurrency(product.regularPrice, product.currency)}</span>
                              {product.salePrice != null && product.salePrice < product.regularPrice && (
                                <span className="text-muted-foreground line-through text-xs ml-1">
                                  {formatCurrency(product.regularPrice, product.currency)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          {product.revenue30d > 0 && (
                            <div className="text-xs text-muted-foreground">
                              30d: {formatCurrency(product.revenue30d, product.currency)}
                            </div>
                          )}
                          {product._count?.variations != null && product._count.variations > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {product._count.variations} variatie{product._count.variations !== 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          /* Table View */
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Merk</TableHead>
                        <TableHead>Categorie</TableHead>
                        <TableHead>SEO-score</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Prijs</TableHead>
                        <TableHead className="text-right">Omzet 30d</TableHead>
                        <TableHead>Variaties</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product) => (
                        <TableRow
                          key={product.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/projects/${id}/products/${product.id}`)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {product.imageUrl ? (
                                <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-muted">
                                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded flex-shrink-0 bg-muted flex items-center justify-center">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <span className="font-medium text-sm truncate max-w-[180px]">{product.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{product.sku || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{product.brand || "—"}</TableCell>
                          <TableCell>
                            {product.category ? (
                              <Badge variant="outline" className="text-xs">{product.category.name}</Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${seoScoreBg(product.overallSeoScore)}`}>
                              {Math.round(product.overallSeoScore)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stockStatusColors[product.stockStatus] || stockStatusColors.DRAFT}`}>
                              {stockStatusLabels[product.stockStatus] || product.stockStatus}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {product.regularPrice != null ? formatCurrency(product.regularPrice, product.currency) : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {product.revenue30d > 0 ? formatCurrency(product.revenue30d, product.currency) : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {product._count?.variations || 0}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Revenue Prioritization Section */}
        {revenuePriorities.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  Omzetprioritering
                </CardTitle>
                <CardDescription>Top omzetkansen met lage SEO-score — focus hier voor maximale impact</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {revenuePriorities.slice(0, 5).map((item, idx) => (
                    <div
                      key={item.productId}
                      className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => router.push(`/projects/${id}/products/${item.productId}`)}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{item.reason}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-sm">{formatCurrency(item.revenue30d)}</p>
                        <p className={`text-xs ${seoScoreColor(item.overallSeoScore)}`}>
                          SEO: {Math.round(item.overallSeoScore)}
                        </p>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[item.priority] || priorityColors.medium}`}>
                        {priorityLabels[item.priority] || item.priority}
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
