"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Rss,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Upload,
  ArrowRight,
  FileSpreadsheet,
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

const validationStatusIcons: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-4 w-4" />,
  VALIDATING: <Loader2 className="h-4 w-4 animate-spin" />,
  VALID: <CheckCircle2 className="h-4 w-4" />,
  VALID_WITH_WARNINGS: <AlertTriangle className="h-4 w-4" />,
  INVALID: <XCircle className="h-4 w-4" />,
  ERROR: <XCircle className="h-4 w-4" />,
};

// --- Component ---
export default function FeedsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formFeedType, setFormFeedType] = useState("");
  const [formSourceUrl, setFormSourceUrl] = useState("");
  const [formFormat, setFormFormat] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const fetchFeeds = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/feeds`);
      if (res.ok) {
        const data = await res.json();
        setFeeds(data.data || data || []);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);

  const handleAddFeed = async () => {
    if (!formName.trim()) {
      toast.error("Feednaam is verplicht");
      return;
    }
    if (!formFeedType) {
      toast.error("Selecteer een feedtype");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${id}/feeds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          feedType: formFeedType,
          sourceUrl: formSourceUrl || null,
          sourceFormat: formFormat || null,
          notes: formNotes || null,
        }),
      });
      if (res.ok) {
        toast.success("Feed aangemaakt");
        setAddDialogOpen(false);
        resetForm();
        fetchFeeds();
      } else {
        const data = await res.json();
        toast.error(data.error || "Kon feed niet aanmaken");
      }
    } catch {
      toast.error("Kon feed niet aanmaken");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormFeedType("");
    setFormSourceUrl("");
    setFormFormat("");
    setFormNotes("");
  };

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
              <h1 className="text-2xl font-bold">Productfeeds</h1>
              <p className="text-sm text-muted-foreground">Importeer en valideer productfeeds</p>
            </div>
          </div>
          <div className="flex-1" />
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-2" />
                Feed aanmaken
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Feed aanmaken</DialogTitle>
                <DialogDescription>Maak een nieuwe productfeed aan om producten te importeren en valideren.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="feedName">Naam *</Label>
                  <Input id="feedName" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Feednaam" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="feedType">Feedtype *</Label>
                  <Select value={formFeedType} onValueChange={setFormFeedType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer feedtype" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MERCHANT">Merchant feed</SelectItem>
                      <SelectItem value="META_CATALOGUE">Meta-catalogus</SelectItem>
                      <SelectItem value="COMPARISON">Vergelijkingsfeed</SelectItem>
                      <SelectItem value="MARKETPLACE">Marketplace</SelectItem>
                      <SelectItem value="AFFILIATE">Affiliate feed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sourceUrl">Bron URL</Label>
                  <Input id="sourceUrl" value={formSourceUrl} onChange={(e) => setFormSourceUrl(e.target.value)} placeholder="https://..." />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="format">Formaat</Label>
                  <Select value={formFormat} onValueChange={setFormFormat}>
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
                  <Label htmlFor="notes">Notities</Label>
                  <Textarea id="notes" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Optionele notities" rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Annuleren
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleAddFeed} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Aanmaken
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* Loading */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : feeds.length === 0 ? (
          /* Empty State */
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Rss className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center max-w-md">
                  Nog geen feeds. Maak een feed aan om producten te importeren en valideren.
                </p>
                <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Feed aanmaken
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          /* Feed Cards */
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {feeds.map((feed, idx) => (
                <motion.div
                  key={feed.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * Math.min(idx, 5) }}
                >
                  <Card
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => router.push(`/projects/${id}/feeds/${feed.id}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate">{feed.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${feedTypeColors[feed.feedType] || ""}`}>
                              {feedTypeLabels[feed.feedType] || feed.feedType}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${validationStatusColors[feed.status] || ""}`}>
                              {validationStatusIcons[feed.status]}
                              {validationStatusLabels[feed.status] || feed.status}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2 mt-1" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Stats */}
                      <div className="grid grid-cols-4 gap-2 text-center mb-3">
                        <div>
                          <p className="text-lg font-bold">{feed.totalProducts}</p>
                          <p className="text-xs text-muted-foreground">Totaal</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-emerald-600">{feed.validProducts}</p>
                          <p className="text-xs text-muted-foreground">Geldig</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-yellow-600">{feed.warningProducts}</p>
                          <p className="text-xs text-muted-foreground">Waarsch.</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-red-600">{feed.invalidProducts}</p>
                          <p className="text-xs text-muted-foreground">Ongeldig</p>
                        </div>
                      </div>

                      {/* Last validated */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t">
                        <span>Laatst gevalideerd: {formatDate(feed.lastValidatedAt)}</span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.info("Importeren gestart...");
                          }}
                        >
                          <Upload className="h-3.5 w-3.5 mr-1" />
                          Importeren
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.info("Validatie gestart...");
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                          Valideren
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
