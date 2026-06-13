"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Plus,
  Package,
} from "lucide-react";
import { toast } from "sonner";

interface Deliverable {
  id: string;
  title: string;
  description: string | null;
  type: string;
  clientId: string | null;
  projectId: string | null;
  dueDate: string | null;
  assignedTo: string | null;
  status: string;
  isClientVisible: boolean;
  hoursBudgeted: number | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "In afwachting",
  IN_PROGRESS: "Bezig",
  SUBMITTED: "Ingediend",
  APPROVED: "Goedgekeurd",
  REJECTED: "Afgewezen",
  OVERDUE: "Te laat",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "secondary",
  IN_PROGRESS: "default",
  SUBMITTED: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
  OVERDUE: "destructive",
};

const STATUS_OPTIONS = [
  { value: "all", label: "Alle statussen" },
  { value: "PENDING", label: "In afwachting" },
  { value: "IN_PROGRESS", label: "Bezig" },
  { value: "SUBMITTED", label: "Ingediend" },
  { value: "APPROVED", label: "Goedgekeurd" },
  { value: "REJECTED", label: "Afgewezen" },
  { value: "OVERDUE", label: "Te laat" },
];

const DELIVERABLE_TYPES = [
  "Rapport",
  "Analyse",
  "Strategie",
  "Implementatie",
  "Optimalisatie",
  "Anders",
];

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

export default function DeliverablesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: organizationId } = use(params);
  const router = useRouter();

  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientIdFilter, setClientIdFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newAssignedTo, setNewAssignedTo] = useState("");
  const [newStatus, setNewStatus] = useState("PENDING");

  useEffect(() => {
    fetchDeliverables();
  }, [organizationId, statusFilter, clientIdFilter]);

  const fetchDeliverables = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (clientIdFilter && clientIdFilter !== "all") params.set("clientId", clientIdFilter);

      const res = await fetch(
        `/api/organizations/${organizationId}/deliverables${params.toString() ? `?${params.toString()}` : ""}`
      );
      if (res.ok) {
        const data = await res.json();
        setDeliverables(data.data || []);
      }
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      toast.error("Titel is vereist");
      return;
    }
    if (!newType.trim()) {
      toast.error("Type is vereist");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/deliverables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          type: newType.trim(),
          dueDate: newDueDate || null,
          assignedTo: newAssignedTo.trim() || null,
          status: newStatus,
        }),
      });

      if (res.ok) {
        toast.success("Oplevering aangemaakt");
        setShowCreateDialog(false);
        resetCreateForm();
        fetchDeliverables();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fout bij aanmaken oplevering");
      }
    } catch {
      toast.error("Fout bij aanmaken oplevering");
    } finally {
      setIsCreating(false);
    }
  };

  const resetCreateForm = () => {
    setNewTitle("");
    setNewDescription("");
    setNewType("");
    setNewDueDate("");
    setNewAssignedTo("");
    setNewStatus("PENDING");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Get unique client IDs for filter
  const uniqueClients = Array.from(
    new Set(deliverables.map((d) => d.clientId).filter(Boolean))
  ) as string[];

  const filteredDeliverables = deliverables.filter((d) => {
    if (clientIdFilter && clientIdFilter !== "all" && d.clientId !== clientIdFilter) {
      return false;
    }
    return true;
  });

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
          <h1 className="text-2xl font-bold tracking-tight">Opleveringen</h1>
          <p className="text-sm text-muted-foreground">
            Beheer alle opleveringen en deliverables
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe oplevering
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div variants={item} className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter op status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {uniqueClients.length > 0 && (
          <Select value={clientIdFilter} onValueChange={setClientIdFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter op cliënt" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle cliënten</SelectItem>
              {uniqueClients.map((clientId) => (
                <SelectItem key={clientId} value={clientId}>
                  {clientId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
            ) : filteredDeliverables.length === 0 ? (
              <div className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  Geen opleveringen gevonden
                </h3>
                <p className="text-sm text-muted-foreground">
                  {statusFilter !== "all"
                    ? "Probeer een andere filter of maak een nieuwe oplevering aan."
                    : "Maak je eerste oplevering aan om te beginnen."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titel</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Cliënt</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Uiterste datum</TableHead>
                      <TableHead>Toegewezen aan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDeliverables.map((deliverable) => (
                      <TableRow
                        key={deliverable.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          router.push(
                            `/organizations/${organizationId}/deliverables/${deliverable.id}`
                          )
                        }
                      >
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {deliverable.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {deliverable.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {deliverable.clientId || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={STATUS_VARIANTS[deliverable.status] || "secondary"}
                            className="text-xs"
                          >
                            {STATUS_LABELS[deliverable.status] || deliverable.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(deliverable.dueDate)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {deliverable.assignedTo || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nieuwe oplevering</DialogTitle>
            <DialogDescription>
              Voeg een nieuwe oplevering of deliverable toe.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Titel *</Label>
              <Input
                id="title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Bijv. Maandelijks SEO-rapport"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Beschrijving</Label>
              <Textarea
                id="description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optionele beschrijving..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="type">Type *</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERABLE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dueDate">Uiterste datum</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="assignedTo">Toegewezen aan</Label>
                <Input
                  id="assignedTo"
                  value={newAssignedTo}
                  onChange={(e) => setNewAssignedTo(e.target.value)}
                  placeholder="Gebruikers-ID"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                resetCreateForm();
              }}
            >
              Annuleren
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
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
