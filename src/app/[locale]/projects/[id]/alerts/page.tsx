"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Bell,
  BellOff,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronUp,
  ChevronDown,
  Clock,
  Check,
  Eye,
  EyeOff,
  X,
  Loader2,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
type AlertStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";

interface AlertEntry {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  changePercent: number | null;
  status: AlertStatus;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

const severityConfig: Record<AlertSeverity, { icon: typeof AlertTriangle; color: string; bgColor: string; borderColor: string; label: string }> = {
  CRITICAL: {
    icon: AlertTriangle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/50",
    borderColor: "border-l-red-500",
    label: "Kritiek",
  },
  HIGH: {
    icon: AlertCircle,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/50",
    borderColor: "border-l-orange-500",
    label: "Hoog",
  },
  MEDIUM: {
    icon: AlertTriangle,
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/50",
    borderColor: "border-l-yellow-500",
    label: "Gemiddeld",
  },
  LOW: {
    icon: Info,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
    borderColor: "border-l-blue-500",
    label: "Laag",
  },
  INFO: {
    icon: Info,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-950/50",
    borderColor: "border-l-gray-400",
    label: "Info",
  },
};

export default function AlertsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [snoozeDialogId, setSnoozeDialogId] = useState<string | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, [projectId]);

  const fetchAlerts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/alerts`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch {
      // Silently handle
    } finally {
      setIsLoading(false);
    }
  };

  const handleAlertAction = async (alertId: string, action: string) => {
    setActionLoading(alertId);
    try {
      const res = await fetch(`/api/projects/${projectId}/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const actionLabels: Record<string, string> = {
          acknowledge: "Melding bevestigd",
          snooze: "Melding uitgesteld",
          resolve: "Melding opgelost",
          dismiss: "Melding genegeerd",
        };
        toast.success(actionLabels[action] || "Actie uitgevoerd");
        fetchAlerts();
      } else {
        toast.error("Actie mislukt");
      }
    } catch {
      toast.error("Fout bij uitvoeren actie");
    } finally {
      setActionLoading(null);
      setSnoozeDialogId(null);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Zojuist";
    if (diffMins < 60) return `${diffMins} min. geleden`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} uur geleden`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} dag${diffDays > 1 ? "en" : ""} geleden`;
    const diffWeeks = Math.floor(diffDays / 7);
    return `${diffWeeks} week${diffWeeks > 1 ? "en" : ""} geleden`;
  };

  const severityCounts = alerts.reduce(
    (acc, alert) => {
      if (alert.status === "ACTIVE") {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      }
      return acc;
    },
    {} as Record<AlertSeverity, number>
  );

  const filteredAlerts = alerts.filter((alert) => {
    switch (activeTab) {
      case "active": return alert.status === "ACTIVE";
      case "acknowledged": return alert.status === "ACKNOWLEDGED";
      case "resolved": return alert.status === "RESOLVED";
      default: return true;
    }
  });

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
          <h1 className="text-2xl font-bold tracking-tight">Meldingen</h1>
          <p className="text-sm text-muted-foreground">
            Ontvang meldingen over belangrijke veranderingen in je SEO-prestaties
          </p>
        </div>
      </div>

      {/* Severity Summary Bar */}
      {!isLoading && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          {(Object.keys(severityConfig) as AlertSeverity[]).map((severity) => {
            const config = severityConfig[severity];
            const count = severityCounts[severity] || 0;
            const Icon = config.icon;
            return (
              <Card key={severity} className={`${count > 0 ? config.bgColor : ""}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Icon className={`h-5 w-5 shrink-0 ${config.color}`} />
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{config.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filter Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            Alle
            <Badge variant="secondary" className="ml-1.5 h-5 min-w-[20px] flex items-center justify-center text-[10px]">
              {alerts.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="active">
            Actief
            <Badge variant="secondary" className="ml-1.5 h-5 min-w-[20px] flex items-center justify-center text-[10px]">
              {alerts.filter((a) => a.status === "ACTIVE").length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="acknowledged">
            Bevestigd
            <Badge variant="secondary" className="ml-1.5 h-5 min-w-[20px] flex items-center justify-center text-[10px]">
              {alerts.filter((a) => a.status === "ACKNOWLEDGED").length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="resolved">
            Opgelost
            <Badge variant="secondary" className="ml-1.5 h-5 min-w-[20px] flex items-center justify-center text-[10px]">
              {alerts.filter((a) => a.status === "RESOLVED").length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="h-16 animate-pulse bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredAlerts.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Shield className="h-12 w-12 mx-auto text-emerald-500/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {activeTab === "active"
                      ? "Geen actieve meldingen. Alles ziet er goed uit!"
                      : activeTab === "acknowledged"
                      ? "Geen bevestigde meldingen"
                      : activeTab === "resolved"
                      ? "Geen opgeloste meldingen"
                      : "Geen meldingen gevonden"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {activeTab === "all"
                      ? "Meldingen verschijnen hier wanneer er belangrijke veranderingen worden gedetecteerd."
                      : ""}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-380px)] overflow-y-auto">
              {filteredAlerts.map((alert) => {
                const config = severityConfig[alert.severity];
                const Icon = config.icon;
                const isActionLoading = actionLoading === alert.id;

                return (
                  <Card
                    key={alert.id}
                    className={`border-l-4 ${config.borderColor}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${config.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-sm">{alert.title}</h4>
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-5 ${config.color}`}
                            >
                              {config.label}
                            </Badge>
                            {alert.status !== "ACTIVE" && (
                              <Badge variant="secondary" className="text-[10px] h-5">
                                {alert.status === "ACKNOWLEDGED"
                                  ? "Bevestigd"
                                  : alert.status === "RESOLVED"
                                  ? "Opgelost"
                                  : "Genegeerd"}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {alert.message}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            {alert.changePercent !== null && (
                              <span
                                className={`text-xs font-medium flex items-center gap-0.5 ${
                                  alert.changePercent >= 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-red-600 dark:text-red-400"
                                }`}
                              >
                                {alert.changePercent >= 0 ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                                {Math.abs(alert.changePercent).toFixed(1)}%
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTimeAgo(alert.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        {alert.status === "ACTIVE" && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Bevestigen"
                              onClick={() => handleAlertAction(alert.id, "acknowledge")}
                              disabled={isActionLoading}
                            >
                              {isActionLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Uitstellen"
                              onClick={() => setSnoozeDialogId(alert.id)}
                              disabled={isActionLoading}
                            >
                              <BellOff className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Oplossen"
                              onClick={() => handleAlertAction(alert.id, "resolve")}
                              disabled={isActionLoading}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Negeren"
                              onClick={() => handleAlertAction(alert.id, "dismiss")}
                              disabled={isActionLoading}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        {alert.status === "ACKNOWLEDGED" && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Oplossen"
                              onClick={() => handleAlertAction(alert.id, "resolve")}
                              disabled={isActionLoading}
                            >
                              {isActionLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Negeren"
                              onClick={() => handleAlertAction(alert.id, "dismiss")}
                              disabled={isActionLoading}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Snooze Dialog */}
      <Dialog open={snoozeDialogId !== null} onOpenChange={() => setSnoozeDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Melding uitstellen</DialogTitle>
            <DialogDescription>
              Stel deze melding tijdelijk uit. Je wordt er later opnieuw aan herinnerd.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnoozeDialogId(null)}>
              Annuleren
            </Button>
            <Button
              onClick={() => snoozeDialogId && handleAlertAction(snoozeDialogId, "snooze")}
            >
              Uitstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
