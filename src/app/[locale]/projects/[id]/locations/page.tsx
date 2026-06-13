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
  Building2,
  Search,
  Filter,
  Phone,
  Mail,
  Globe,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Location {
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
  businessType: string | null;
  napConsistency: number;
  localHealthScore: number;
  avgRating: number;
  reviewCount: number;
  gbpStatus: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

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

function gbpBadge(gbpStatus: string) {
  switch (gbpStatus) {
    case "connected":
      return (
        <Badge className="bg-green-50 text-green-700 border-green-200 border">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Verbonden
        </Badge>
      );
    case "error":
      return (
        <Badge className="bg-red-50 text-red-700 border-red-200 border">
          <XCircle className="w-3 h-3 mr-1" />
          Fout
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="bg-gray-50 text-gray-500 border-gray-200 border">
          <AlertCircle className="w-3 h-3 mr-1" />
          Niet verbonden
        </Badge>
      );
  }
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LocationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalLocations, setTotalLocations] = useState(0);

  // Filters
  const [filterCity, setFilterCity] = useState<string>("");
  const [filterBusinessType, setFilterBusinessType] = useState<string>("");

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    postalCode: "",
    country: "NL",
    phone: "",
    email: "",
    website: "",
    latitude: "",
    longitude: "",
    businessType: "",
    notes: "",
  });

  // Derived
  const uniqueCities = Array.from(new Set(locations.map((l) => l.city).filter(Boolean))) as string[];
  const uniqueBusinessTypes = Array.from(new Set(locations.map((l) => l.businessType).filter(Boolean))) as string[];

  const filteredLocations = locations.filter((loc) => {
    if (filterCity && filterCity !== "all" && loc.city !== filterCity) return false;
    if (filterBusinessType && filterBusinessType !== "all" && loc.businessType !== filterBusinessType) return false;
    return true;
  });

  const avgHealthScore =
    filteredLocations.length > 0
      ? Math.round(filteredLocations.reduce((sum, l) => sum + (l.localHealthScore || 0), 0) / filteredLocations.length)
      : 0;

  const avgRating =
    filteredLocations.length > 0
      ? (filteredLocations.reduce((sum, l) => sum + (l.avgRating || 0), 0) / filteredLocations.length).toFixed(1)
      : "0.0";

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const fetchLocations = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filterCity && filterCity !== "all") params.set("city", filterCity);
      if (filterBusinessType && filterBusinessType !== "all") params.set("businessType", filterBusinessType);

      const res = await fetch(`/api/projects/${projectId}/locations?${params.toString()}`);
      if (!res.ok) throw new Error("Fout bij ophalen locaties");
      const json = await res.json();
      setLocations(json.data ?? []);
      setTotalLocations(json.meta?.total ?? json.data?.length ?? 0);
    } catch {
      toast.error("Kon locaties niet laden");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, filterCity, filterBusinessType]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async function handleCreate() {
    if (!form.name.trim()) {
      toast.error("Locatienaam is verplicht");
      return;
    }

    try {
      setIsCreating(true);
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        postalCode: form.postalCode.trim() || null,
        country: form.country.trim() || "NL",
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        businessType: form.businessType.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (form.latitude) body.latitude = parseFloat(form.latitude);
      if (form.longitude) body.longitude = parseFloat(form.longitude);

      const res = await fetch(`/api/projects/${projectId}/locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fout bij aanmaken locatie");
      }

      toast.success("Locatie toegevoegd");
      setAddOpen(false);
      setForm({
        name: "",
        address: "",
        city: "",
        postalCode: "",
        country: "NL",
        phone: "",
        email: "",
        website: "",
        latitude: "",
        longitude: "",
        businessType: "",
        notes: "",
      });
      fetchLocations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fout bij aanmaken locatie");
    } finally {
      setIsCreating(false);
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
            <Button variant="ghost" size="icon" onClick={() => router.push(`/projects/${projectId}`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Locaties</h1>
              <p className="text-muted-foreground mt-1">Beheer je locaties en lokale SEO</p>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <MapPin className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Totaal locaties</p>
                <p className="text-xl font-bold">{totalLocations}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Building2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gem. gezondheidsscore</p>
                <p className={`text-xl font-bold ${scoreColor(avgHealthScore)}`}>{avgHealthScore}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Star className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gem. beoordeling</p>
                <p className="text-xl font-bold">{avgRating}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar + Add Button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filters:</span>
            </div>
            <Select value={filterCity} onValueChange={setFilterCity}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Alle steden" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle steden</SelectItem>
                {uniqueCities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterBusinessType} onValueChange={setFilterBusinessType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Alle types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle types</SelectItem>
                {uniqueBusinessTypes.map((bt) => (
                  <SelectItem key={bt} value={bt}>
                    {bt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                Locatie toevoegen
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nieuwe locatie toevoegen</DialogTitle>
                <DialogDescription>
                  Voeg een nieuwe locatie toe om lokale SEO te beheren.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="loc-name">Naam *</Label>
                  <Input
                    id="loc-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Bijv. Hoofdlocatie Amsterdam"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="loc-address">Adres</Label>
                    <Input
                      id="loc-address"
                      value={form.address}
                      onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                      placeholder="Keizersgracht 123"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="loc-city">Stad</Label>
                    <Input
                      id="loc-city"
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                      placeholder="Amsterdam"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="loc-postal">Postcode</Label>
                    <Input
                      id="loc-postal"
                      value={form.postalCode}
                      onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                      placeholder="1015 CJ"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="loc-country">Land</Label>
                    <Input
                      id="loc-country"
                      value={form.country}
                      onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                      placeholder="NL"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="loc-phone">Telefoon</Label>
                    <Input
                      id="loc-phone"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+31 20 123 4567"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="loc-email">E-mail</Label>
                    <Input
                      id="loc-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="info@voorbeeld.nl"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="loc-website">Website</Label>
                  <Input
                    id="loc-website"
                    value={form.website}
                    onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                    placeholder="https://www.voorbeeld.nl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="loc-lat">Breedtegraad</Label>
                    <Input
                      id="loc-lat"
                      value={form.latitude}
                      onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                      placeholder="52.3676"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="loc-lng">Lengtegraad</Label>
                    <Input
                      id="loc-lng"
                      value={form.longitude}
                      onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                      placeholder="4.9041"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="loc-btype">Type bedrijf</Label>
                  <Input
                    id="loc-btype"
                    value={form.businessType}
                    onChange={(e) => setForm((f) => ({ ...f, businessType: e.target.value }))}
                    placeholder="Bijv. restaurant, tandarts, advocaat"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="loc-notes">Notities</Label>
                  <Textarea
                    id="loc-notes"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Aanvullende informatie over deze locatie..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  Annuleren
                </Button>
                <Button onClick={handleCreate} disabled={isCreating} className="bg-emerald-600 hover:bg-emerald-700">
                  {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Toevoegen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <span className="ml-3 text-muted-foreground">Locaties laden...</span>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredLocations.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardContent className="py-16 flex flex-col items-center text-center">
                <MapPin className="w-12 h-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Geen locaties gevonden</h3>
                {totalLocations === 0 ? (
                  <>
                    <p className="text-muted-foreground max-w-md">
                      Nog geen locaties toegevoegd. Voeg je eerste locatie toe om te beginnen met lokale SEO.
                    </p>
                    <Button
                      className="mt-6 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => setAddOpen(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Locatie toevoegen
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground max-w-md">
                    Geen locaties gevonden met de huidige filters. Pas de filters aan of voeg een nieuwe locatie toe.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Location Cards Grid */}
        {!isLoading && filteredLocations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredLocations.map((loc, idx) => (
              <motion.div
                key={loc.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                  style={{ borderLeftColor: loc.localHealthScore >= 80 ? "#16a34a" : loc.localHealthScore >= 50 ? "#ca8a04" : "#dc2626" }}
                  onClick={() => router.push(`/projects/${projectId}/locations/${loc.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base font-semibold truncate">{loc.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          {loc.city || "Geen stad"}
                        </CardDescription>
                      </div>
                      {gbpBadge(loc.gbpStatus)}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 pb-4">
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {/* NAP Consistency */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">NAP-consistentie</p>
                        <Badge className={scoreBg(loc.napConsistency)} variant="outline">
                          {Math.round(loc.napConsistency)}%
                        </Badge>
                      </div>
                      {/* Health Score */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Gezondheid</p>
                        <Badge className={scoreBg(loc.localHealthScore)} variant="outline">
                          {Math.round(loc.localHealthScore)}
                        </Badge>
                      </div>
                      {/* Rating */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Beoordeling</p>
                        <div className="flex items-center gap-1">
                          <div className="flex">{renderStars(loc.avgRating)}</div>
                          <span className="text-xs font-medium">{loc.avgRating.toFixed(1)}</span>
                        </div>
                      </div>
                      {/* Reviews */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Beoordelingen</p>
                        <span className="text-sm font-medium">{loc.reviewCount}</span>
                      </div>
                    </div>
                    {/* Quick Info */}
                    {(loc.phone || loc.email) && (
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t text-xs text-muted-foreground">
                        {loc.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {loc.phone}
                          </span>
                        )}
                        {loc.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3" />
                            {loc.email}
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
