"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";

interface ApprovalQueueItem {
  id: string;
  itemType: string;
  itemId: string | null;
  title: string;
  description: string | null;
  evidence: string | null;
  projectId: string | null;
  clientId: string | null;
  submittedBy: string;
  submittedAt: string;
  riskLevel: string;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  isClientVisible: boolean;
}

const RISK_LEVEL_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  low: {
    label: "Laag",
    variant: "secondary",
    color: "text-emerald-600 dark:text-emerald-400",
  },
  medium: {
    label: "Gemiddeld",
    variant: "outline",
    color: "text-yellow-600 dark:text-yellow-400",
  },
  high: {
    label: "Hoog",
    variant: "default",
    color: "text-orange-600 dark:text-orange-400",
  },
  critical: {
    label: "Kritiek",
    variant: "destructive",
    color: "text-red-600 dark:text-red-400",
  },
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "In afwachting",
  APPROVED: "Goedgekeurd",
  REJECTED: "Afgewezen",
  CANCELLED: "Geannuleerd",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  CANCELLED: "outline",
};

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

export default function ApprovalsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: organizationId } = use(params);
  const router = useRouter();

  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Review dialog state
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewItemId, setReviewItemId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [reviewNotes, setReviewNotes] = useState("");

  useEffect(() => {
    fetchItems();
  }, [organizationId, statusFilter, riskFilter]);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (riskFilter && riskFilter !== "all") params.set("riskLevel", riskFilter);

      const res = await fetch(
        `/api/organizations/${organizationId}/approval-queue${params.toString() ? `?${params.toString()}` : ""}`
      );
      if (res.ok) {
        const data = await res.json();
        setItems(data.data || []);
      }
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  };

  const openReviewDialog = (itemId: string, action: "approve" | "reject") => {
    setReviewItemId(itemId);
    setReviewAction(action);
    setReviewNotes("");
    setReviewDialogOpen(true);
  };

  const handleReview = async () => {
    if (!reviewItemId) return;

    setActionLoading(reviewItemId);
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/approval-queue/${reviewItemId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: reviewAction,
            notes: reviewNotes.trim() || null,
          }),
        }
      );

      if (res.ok) {
        toast.success(
          reviewAction === "approve"
            ? "Item goedgekeurd"
            : "Item afgewezen"
        );
        setReviewDialogOpen(false);
        setReviewItemId(null);
        setReviewNotes("");
        fetchItems();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fout bij verwerken goedkeuring");
      }
    } catch {
      toast.error("Fout bij verwerken goedkeuring");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const pendingCount = items.filter((i) => i.status === "PENDING").length;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-4 md:p-6 space-y-6"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Goedkeuringswachtrij</h1>
          <p className="text-sm text-muted-foreground">
            Beheer goedkeuringsverzoeken en risicobeoordelingen
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="default" className="text-sm">
            {pendingCount} openstaand
          </Badge>
        )}
      </motion.div>

      {/* Filters */}
      <motion.div variants={item} className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter op status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="PENDING">In afwachting</SelectItem>
            <SelectItem value="APPROVED">Goedgekeurd</SelectItem>
            <SelectItem value="REJECTED">Afgewezen</SelectItem>
            <SelectItem value="CANCELLED">Geannuleerd</SelectItem>
          </SelectContent>
        </Select>

        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter op risico" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle risiconiveaus</SelectItem>
            <SelectItem value="critical">Kritiek</SelectItem>
            <SelectItem value="high">Hoog</SelectItem>
            <SelectItem value="medium">Gemiddeld</SelectItem>
            <SelectItem value="low">Laag</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Table */}
      <motion.div variants={item}>
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 animate-pulse bg-muted rounded" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center">
                <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  Geen goedkeuringsitems gevonden
                </h3>
                <p className="text-sm text-muted-foreground">
                  {statusFilter !== "all" || riskFilter !== "all"
                    ? "Probeer een andere filter om meer resultaten te zien."
                    : "Er zijn momenteel geen goedkeuringsverzoeken."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titel</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Risiconiveau</TableHead>
                      <TableHead>Ingediend op</TableHead>
                      <TableHead>Ingediend door</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Acties</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((queueItem) => {
                      const riskConfig = RISK_LEVEL_CONFIG[queueItem.riskLevel] || RISK_LEVEL_CONFIG.low;
                      const isItemLoading = actionLoading === queueItem.id;
                      const isPending = queueItem.status === "PENDING";

                      return (
                        <TableRow key={queueItem.id}>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate max-w-[200px]">
                                {queueItem.title}
                              </p>
                              {queueItem.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5">
                                  {queueItem.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {queueItem.itemType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={riskConfig.variant} className="text-xs">
                              {riskConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateTime(queueItem.submittedAt)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {queueItem.submittedBy || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={STATUS_VARIANTS[queueItem.status] || "secondary"}
                              className="text-xs"
                            >
                              {STATUS_LABELS[queueItem.status] || queueItem.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {isPending ? (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/50"
                                  onClick={() => openReviewDialog(queueItem.id, "approve")}
                                  disabled={isItemLoading}
                                >
                                  {isItemLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                  )}
                                  Goedkeuren
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-red-700 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/50"
                                  onClick={() => openReviewDialog(queueItem.id, "reject")}
                                  disabled={isItemLoading}
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-1" />
                                  Afwijzen
                                </Button>
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                {queueItem.reviewedBy && (
                                  <span>
                                    Door {queueItem.reviewedBy}
                                    {queueItem.reviewedAt && ` op ${formatDate(queueItem.reviewedAt)}`}
                                  </span>
                                )}
                              </div>
                            )}
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
      </motion.div>

      {/* Approve / Reject Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve" ? "Goedkeuren" : "Afwijzen"}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === "approve"
                ? "Keur dit item goed. Je kunt optioneel notities toevoegen."
                : "Wijs dit item af. Geef een reden op voor de afwijzing."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reviewNotes">
                Notities {reviewAction === "reject" && "(optioneel)"}
              </Label>
              <Textarea
                id="reviewNotes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder={
                  reviewAction === "approve"
                    ? "Optionele opmerkingen bij de goedkeuring..."
                    : "Reden voor afwijzing..."
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReviewDialogOpen(false);
                setReviewItemId(null);
                setReviewNotes("");
              }}
            >
              Annuleren
            </Button>
            <Button
              onClick={handleReview}
              disabled={actionLoading !== null}
              className={
                reviewAction === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-600"
                  : "bg-red-600 hover:bg-red-700 focus:ring-red-600"
              }
            >
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : reviewAction === "approve" ? (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              {reviewAction === "approve" ? "Goedkeuren" : "Afwijzen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
