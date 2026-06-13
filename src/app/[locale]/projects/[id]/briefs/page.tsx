"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Search,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface ContentBrief {
  id: string;
  title: string;
  targetKeyword: string | null;
  secondaryKeywords: string | null;
  searchIntent: string;
  funnelStage: string;
  approvalStatus: string;
  targetWordCount: number | null;
  targetAudience: string | null;
  toneOfVoice: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function BriefsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [briefs, setBriefs] = useState<ContentBrief[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newBrief, setNewBrief] = useState({
    title: "",
    targetKeyword: "",
    secondaryKeywords: "",
    searchIntent: "INFORMATIONAL",
    funnelStage: "AWARENESS",
    targetWordCount: 1000,
    targetAudience: "",
  });

  useEffect(() => {
    fetchBriefs();
  }, [projectId, statusFilter]);

  async function fetchBriefs() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("approvalStatus", statusFilter);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(
        `/api/projects/${projectId}/briefs?${params.toString()}`
      );
      if (res.ok) {
        const data = await res.json();
        setBriefs(data.data?.briefs || data.data || []);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateBrief() {
    if (!newBrief.title.trim()) {
      toast.error("Titel is verplicht");
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/briefs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newBrief.title,
          targetKeyword: newBrief.targetKeyword || undefined,
          secondaryKeywords: newBrief.secondaryKeywords
            ? newBrief.secondaryKeywords.split(",").map((k) => k.trim())
            : undefined,
          searchIntent: newBrief.searchIntent,
          funnelStage: newBrief.funnelStage,
          targetWordCount: newBrief.targetWordCount || undefined,
          targetAudience: newBrief.targetAudience || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success("Contentbrief aangemaakt");
        setShowCreateDialog(false);
        setNewBrief({
          title: "",
          targetKeyword: "",
          secondaryKeywords: "",
          searchIntent: "INFORMATIONAL",
          funnelStage: "AWARENESS",
          targetWordCount: 1000,
          targetAudience: "",
        });
        // Navigate to the new brief
        const briefId = data.data?.id || data.data?.brief?.id;
        if (briefId) {
          router.push(`/projects/${projectId}/briefs/${briefId}`);
        } else {
          fetchBriefs();
        }
      } else {
        toast.error("Fout bij aanmaken contentbrief");
      }
    } catch {
      toast.error("Fout bij aanmaken contentbrief");
    } finally {
      setIsCreating(false);
    }
  }

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "secondary";
      case "IN_REVIEW":
        return "outline";
      case "APPROVED":
        return "default";
      case "PUBLISHED":
        return "default";
      case "ARCHIVED":
        return "outline";
      default:
        return "secondary";
    }
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
      case "IN_REVIEW":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800";
      case "APPROVED":
        return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800";
      case "PUBLISHED":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
      case "ARCHIVED":
        return "bg-gray-200 text-gray-600 border-gray-300 dark:bg-gray-900/50 dark:text-gray-500 dark:border-gray-700";
      default:
        return "";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "Concept";
      case "IN_REVIEW":
        return "In beoordeling";
      case "APPROVED":
        return "Goedgekeurd";
      case "PUBLISHED":
        return "Gepubliceerd";
      case "ARCHIVED":
        return "Gearchiveerd";
      default:
        return status;
    }
  };

  const intentLabel = (intent: string) => {
    switch (intent) {
      case "INFORMATIONAL":
        return "Informatief";
      case "NAVIGATIONAL":
        return "Navigatie";
      case "TRANSACTIONAL":
        return "Transactioneel";
      case "COMMERCIAL_INVESTIGATION":
        return "Commercieel";
      case "LOCAL":
        return "Lokaal";
      case "BRANDED":
        return "Merk";
      default:
        return "Onbekend";
    }
  };

  const funnelLabel = (funnel: string) => {
    switch (funnel) {
      case "AWARENESS":
        return "Bekendheid";
      case "CONSIDERATION":
        return "Overweging";
      case "DECISION":
        return "Beslissing";
      case "RETENTION":
        return "Behoud";
      default:
        return "Onbekend";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/projects/${projectId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Contentbrieven
          </h1>
          <p className="text-muted-foreground text-sm">
            Beheer je contentbrieven en -concepten
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe contentbrief
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek contentbrieven..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchBriefs()}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter op status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statussen</SelectItem>
                <SelectItem value="DRAFT">Concept</SelectItem>
                <SelectItem value="IN_REVIEW">In beoordeling</SelectItem>
                <SelectItem value="APPROVED">Goedgekeurd</SelectItem>
                <SelectItem value="PUBLISHED">Gepubliceerd</SelectItem>
                <SelectItem value="ARCHIVED">Gearchiveerd</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Briefs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Contentbrieven ({briefs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {briefs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Geen contentbrieven gevonden</p>
              <p className="text-sm mt-1">
                Maak je eerste contentbrief aan om te beginnen
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titel</TableHead>
                    <TableHead>Doeltrefwoord</TableHead>
                    <TableHead>Intentie</TableHead>
                    <TableHead>Trechter</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aangemaakt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {briefs.map((brief) => (
                    <TableRow
                      key={brief.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        router.push(
                          `/projects/${projectId}/briefs/${brief.id}`
                        )
                      }
                    >
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {brief.title}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {brief.targetKeyword || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {intentLabel(brief.searchIntent)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {funnelLabel(brief.funnelStage)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={statusBadgeVariant(brief.approvalStatus)}
                          className={statusBadgeClass(brief.approvalStatus)}
                        >
                          {statusLabel(brief.approvalStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(brief.createdAt).toLocaleDateString("nl-NL")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Brief Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Nieuwe contentbrief</DialogTitle>
            <DialogDescription>
              Maak een nieuwe contentbrief aan voor je project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titel *</Label>
              <Input
                value={newBrief.title}
                onChange={(e) =>
                  setNewBrief({ ...newBrief, title: e.target.value })
                }
                placeholder="Bijv. SEO-gids voor MKB"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Doeltrefwoord</Label>
                <Input
                  value={newBrief.targetKeyword}
                  onChange={(e) =>
                    setNewBrief({ ...newBrief, targetKeyword: e.target.value })
                  }
                  placeholder="Bijv. seo tips mkb"
                />
              </div>
              <div className="space-y-2">
                <Label>Secundaire trefwoorden</Label>
                <Input
                  value={newBrief.secondaryKeywords}
                  onChange={(e) =>
                    setNewBrief({
                      ...newBrief,
                      secondaryKeywords: e.target.value,
                    })
                  }
                  placeholder="Komma-gescheiden"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Zoekintentie</Label>
                <Select
                  value={newBrief.searchIntent}
                  onValueChange={(val) =>
                    setNewBrief({ ...newBrief, searchIntent: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INFORMATIONAL">Informatief</SelectItem>
                    <SelectItem value="NAVIGATIONAL">Navigatie</SelectItem>
                    <SelectItem value="TRANSACTIONAL">
                      Transactioneel
                    </SelectItem>
                    <SelectItem value="COMMERCIAL_INVESTIGATION">
                      Commercieel
                    </SelectItem>
                    <SelectItem value="LOCAL">Lokaal</SelectItem>
                    <SelectItem value="BRANDED">Merk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Trechterfase</Label>
                <Select
                  value={newBrief.funnelStage}
                  onValueChange={(val) =>
                    setNewBrief({ ...newBrief, funnelStage: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AWARENESS">Bekendheid</SelectItem>
                    <SelectItem value="CONSIDERATION">Overweging</SelectItem>
                    <SelectItem value="DECISION">Beslissing</SelectItem>
                    <SelectItem value="RETENTION">Behoud</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Doelwoordental</Label>
                <Input
                  type="number"
                  value={newBrief.targetWordCount}
                  onChange={(e) =>
                    setNewBrief({
                      ...newBrief,
                      targetWordCount: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="1000"
                />
              </div>
              <div className="space-y-2">
                <Label>Doelgroep</Label>
                <Input
                  value={newBrief.targetAudience}
                  onChange={(e) =>
                    setNewBrief({
                      ...newBrief,
                      targetAudience: e.target.value,
                    })
                  }
                  placeholder="Bijv. MKB-eigenaren"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Annuleren
            </Button>
            <Button onClick={handleCreateBrief} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aanmaken...
                </>
              ) : (
                "Aanmaken"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
