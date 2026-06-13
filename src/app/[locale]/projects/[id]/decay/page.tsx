"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  TrendingDown,
  Search,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface DecayEntry {
  id: string;
  url: string;
  currentPage: number;
  previousPage: number | null;
  currentClicks: number | null;
  previousClicks: number | null;
  currentImpressions: number | null;
  previousImpressions: number | null;
  decayPercentage: number;
  pruningAction: string;
  riskAnalysis: string | null;
  recommendations: string | null;
  dataAvailable: boolean;
  dataNote: string | null;
  detectedAt: string;
}

interface DecaySummary {
  actionCounts: Record<string, number>;
  averageDecay: number;
}

export default function ContentDecayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [decayEntries, setDecayEntries] = useState<DecayEntry[]>([]);
  const [summary, setSummary] = useState<DecaySummary>({
    actionCounts: {},
    averageDecay: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [actionFilter, setActionFilter] = useState("all");

  // Detail dialog
  const [selectedEntry, setSelectedEntry] = useState<DecayEntry | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const fetchDecay = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter !== "all") params.set("pruningAction", actionFilter);

      const res = await fetch(
        `/api/projects/${projectId}/decay?${params.toString()}`
      );
      if (res.ok) {
        const data = await res.json();
        setDecayEntries(data.data || []);
        if (data.meta?.summary) {
          setSummary(data.meta.summary);
        }
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [projectId, actionFilter]);

  useEffect(() => {
    fetchDecay();
  }, [fetchDecay]);

  async function handleDetectDecay() {
    setIsDetecting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/decay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(
          `Vervalsdetectie voltooid: ${data.data?.detected || 0} items gevonden`
        );
        fetchDecay();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Fout bij vervalsdetectie");
      }
    } catch {
      toast.error("Fout bij vervalsdetectie");
    } finally {
      setIsDetecting(false);
    }
  }

  const pruningActionBadge = (action: string) => {
    switch (action) {
      case "KEEP":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
            Behouden
          </Badge>
        );
      case "IMPROVE":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800">
            Verbeteren
          </Badge>
        );
      case "MERGE":
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800">
            Samenvoegen
          </Badge>
        );
      case "REDIRECT":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
            Doorverwijzen
          </Badge>
        );
      case "NOINDEX":
        return (
          <Badge className="bg-red-200 text-red-900 border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800">
            Noindex
          </Badge>
        );
      case "REMOVE":
        return (
          <Badge className="bg-gray-300 text-gray-800 border-gray-400 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600">
            Verwijderen
          </Badge>
        );
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const parseJSON = (value: string | null): Record<string, unknown> | null => {
    if (!value) return null;
    try {
      return typeof value === "string" ? JSON.parse(value) : value;
    } catch {
      return null;
    }
  };

  const openDetail = (entry: DecayEntry) => {
    setSelectedEntry(entry);
    setShowDetailDialog(true);
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
            Contentverval
          </h1>
          <p className="text-muted-foreground text-sm">
            Detecteer en beheer vervallende content
          </p>
        </div>
        <Button onClick={handleDetectDecay} disabled={isDetecting}>
          {isDetecting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <TrendingDown className="mr-2 h-4 w-4" />
          )}
          Verval detecteren
        </Button>
      </div>

      {/* Summary Cards */}
      {decayEntries.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {Object.entries(summary.actionCounts || {}).map(([action, count]) => (
            <Card key={action}>
              <CardContent className="p-3 text-center">
                <div className="flex justify-center mb-1">
                  {pruningActionBadge(action)}
                </div>
                <p className="text-2xl font-bold">{count}</p>
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">
                Gemiddeld verval
              </p>
              <p className="text-2xl font-bold">
                {summary.averageDecay.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Filter op actie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle acties</SelectItem>
                <SelectItem value="KEEP">Behouden</SelectItem>
                <SelectItem value="IMPROVE">Verbeteren</SelectItem>
                <SelectItem value="MERGE">Samenvoegen</SelectItem>
                <SelectItem value="REDIRECT">Doorverwijzen</SelectItem>
                <SelectItem value="NOINDEX">Noindex</SelectItem>
                <SelectItem value="REMOVE">Verwijderen</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* No data message */}
      {decayEntries.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            {decayEntries.length === 0 && !isDetecting ? (
              <>
                <TrendingDown className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium text-muted-foreground">
                  Er is nog niet genoeg historische data om een trend te
                  berekenen.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Kom later terug voor een analyse.
                </p>
              </>
            ) : (
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            )}
          </CardContent>
        </Card>
      )}

      {/* Decay Table */}
      {decayEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Verval-items ({decayEntries.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead className="text-right">
                      Huidige positie
                    </TableHead>
                    <TableHead className="text-right">
                      Vorige positie
                    </TableHead>
                    <TableHead className="text-right">
                      Vervalpercentage
                    </TableHead>
                    <TableHead>Aanbeveling</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {decayEntries.map((entry) => (
                    <TableRow
                      key={entry.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetail(entry)}
                    >
                      <TableCell className="font-medium max-w-[300px] truncate">
                        {entry.url}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.currentPage > 0 ? (
                          <span className="flex items-center justify-end gap-1">
                            {entry.currentPage}
                            {entry.previousPage &&
                              entry.currentPage > entry.previousPage && (
                                <ArrowDownRight className="h-3 w-3 text-red-500" />
                              )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.previousPage ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-medium ${
                            entry.decayPercentage > 50
                              ? "text-red-600 dark:text-red-400"
                              : entry.decayPercentage > 20
                              ? "text-orange-600 dark:text-orange-400"
                              : "text-yellow-600 dark:text-yellow-400"
                          }`}
                        >
                          {entry.decayPercentage.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        {pruningActionBadge(entry.pruningAction)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          {selectedEntry && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base break-all">
                  {selectedEntry.url}
                </DialogTitle>
                <DialogDescription>
                  Gedetecteerd op{" "}
                  {new Date(selectedEntry.detectedAt).toLocaleDateString(
                    "nl-NL",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Position Change */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">
                        Huidige positie
                      </p>
                      <p className="text-2xl font-bold">
                        {selectedEntry.currentPage || "—"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">
                        Vorige positie
                      </p>
                      <p className="text-2xl font-bold">
                        {selectedEntry.previousPage || "—"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Verval</p>
                      <p
                        className={`text-2xl font-bold ${
                          selectedEntry.decayPercentage > 50
                            ? "text-red-600 dark:text-red-400"
                            : selectedEntry.decayPercentage > 20
                            ? "text-orange-600 dark:text-orange-400"
                            : "text-yellow-600 dark:text-yellow-400"
                        }`}
                      >
                        {selectedEntry.decayPercentage.toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Pruning Action */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    Aanbeveling:
                  </span>
                  {pruningActionBadge(selectedEntry.pruningAction)}
                </div>

                <Separator />

                {/* Data Note */}
                {!selectedEntry.dataAvailable && selectedEntry.dataNote && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <Info className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                    <p className="text-sm">{selectedEntry.dataNote}</p>
                  </div>
                )}

                {/* Risk Analysis */}
                {selectedEntry.riskAnalysis && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Risicoanalyse
                    </h4>
                    {(() => {
                      const analysis = parseJSON(selectedEntry.riskAnalysis);
                      if (!analysis) return null;
                      return (
                        <div className="space-y-2">
                          {Object.entries(analysis).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-muted-foreground">
                                {key}
                              </span>
                              <span className="font-medium">
                                {typeof value === "number"
                                  ? value.toFixed(1)
                                  : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Recommendations */}
                {selectedEntry.recommendations && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Aanbevelingen
                    </h4>
                    {(() => {
                      const recs = parseJSON(selectedEntry.recommendations);
                      if (!recs) return null;
                      if (Array.isArray(recs)) {
                        return (
                          <ul className="space-y-1">
                            {recs.map((rec: string, i: number) => (
                              <li
                                key={i}
                                className="text-sm text-muted-foreground flex items-start gap-2"
                              >
                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                {rec}
                              </li>
                            ))}
                          </ul>
                        );
                      }
                      return (
                        <div className="space-y-2">
                          {Object.entries(recs).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-muted-foreground">
                                {key}
                              </span>
                              <span className="font-medium">
                                {String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Click/Impression Stats */}
                {(selectedEntry.currentClicks !== null ||
                  selectedEntry.currentImpressions !== null) && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Verkeersgegevens</h4>
                      <div className="grid gap-2 md:grid-cols-2">
                        {selectedEntry.currentClicks !== null && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              Huidige klikken:
                            </span>
                            <span className="font-medium">
                              {selectedEntry.currentClicks}
                            </span>
                          </div>
                        )}
                        {selectedEntry.previousClicks !== null && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              Vorige klikken:
                            </span>
                            <span className="font-medium">
                              {selectedEntry.previousClicks}
                            </span>
                          </div>
                        )}
                        {selectedEntry.currentImpressions !== null && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              Huidige impressies:
                            </span>
                            <span className="font-medium">
                              {selectedEntry.currentImpressions}
                            </span>
                          </div>
                        )}
                        {selectedEntry.previousImpressions !== null && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              Vorige impressies:
                            </span>
                            <span className="font-medium">
                              {selectedEntry.previousImpressions}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
