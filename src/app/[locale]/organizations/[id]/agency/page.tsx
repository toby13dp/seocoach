"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Users,
  FileText,
  CheckSquare,
  AlertTriangle,
  PackageX,
  AlertOctagon,
  Unplug,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

interface AgencyClientSummary {
  clientId: string;
  clientName: string;
  healthStatus: string;
  healthScore: number;
  slaStatus: string;
  concernReason: string;
}

interface AgencyDeliverableSummary {
  id: string;
  title: string;
  type: string;
  dueDate: string | null;
  clientId?: string;
  clientName?: string;
  status: string;
}

interface AgencyApprovalSummary {
  id: string;
  title: string;
  itemType: string;
  riskLevel: string;
  submittedAt: string | null;
  submittedBy?: string;
}

interface AgencyCapacityRisk {
  userId: string;
  userName: string;
  totalHoursThisWeek: number;
  maxHoursPerWeek: number;
  utilizationPercent: number;
  overloadedProjects: string[];
}

interface AgencyAlertSummary {
  id: string;
  type: string;
  severity: string;
  title: string;
  entityType?: string;
  entityId?: string;
}

interface AgencyIntegrationFailure {
  id: string;
  provider: string;
  lastSyncAt: string | null;
  errorMessage: string;
}

interface AgencyGrowthOpportunity {
  clientId: string;
  clientName: string;
  opportunityType: string;
  description: string;
  estimatedRevenue: number | null;
}

interface AgencyDashboardData {
  clientsNeedingAttention: AgencyClientSummary[];
  reportsDue: AgencyDeliverableSummary[];
  pendingApprovals: AgencyApprovalSummary[];
  capacityRisks: AgencyCapacityRisk[];
  missingDeliverables: AgencyDeliverableSummary[];
  criticalSeoAlerts: AgencyAlertSummary[];
  integrationFailures: AgencyIntegrationFailure[];
  growthOpportunities: AgencyGrowthOpportunity[];
}

const HEALTH_LABELS: Record<string, string> = {
  EXCELLENT: "Uitstekend",
  GOOD: "Goed",
  NEEDS_ATTENTION: "Heeft aandacht nodig",
  CRITICAL: "Kritiek",
};

const SLA_LABELS: Record<string, string> = {
  ON_TRACK: "Op schema",
  AT_RISK: "Risico",
  BREACHED: "Overtreden",
};

const DELIVERABLE_STATUS_LABELS: Record<string, string> = {
  PENDING: "In afwachting",
  IN_PROGRESS: "Bezig",
  SUBMITTED: "Ingediend",
  APPROVED: "Goedgekeurd",
  REJECTED: "Afgewezen",
  OVERDUE: "Te laat",
};

interface AlertSectionConfig {
  key: string;
  title: string;
  icon: typeof Users;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeColor: string;
  count: number;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function AgencyDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: organizationId } = use(params);
  const router = useRouter();

  const [dashboard, setDashboard] = useState<AgencyDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchDashboard();
  }, [organizationId]);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/agency-dashboard`);
      if (res.ok) {
        const data = await res.json();
        setDashboard(data.dashboard || null);
      }
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "-";
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const alertSections: AlertSectionConfig[] = dashboard
    ? [
        {
          key: "clientsNeedingAttention",
          title: "Cliënten die aandacht nodig hebben",
          icon: Users,
          color: "text-red-600 dark:text-red-400",
          bgColor: "bg-red-50 dark:bg-red-950/30",
          borderColor: "border-l-red-500",
          badgeColor: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
          count: dashboard.clientsNeedingAttention.length,
        },
        {
          key: "reportsDue",
          title: "Rapporten die verschuldigd zijn",
          icon: FileText,
          color: "text-amber-600 dark:text-amber-400",
          bgColor: "bg-amber-50 dark:bg-amber-950/30",
          borderColor: "border-l-amber-500",
          badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
          count: dashboard.reportsDue.length,
        },
        {
          key: "pendingApprovals",
          title: "Openstaande goedkeuringen",
          icon: CheckSquare,
          color: "text-yellow-600 dark:text-yellow-400",
          bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
          borderColor: "border-l-yellow-500",
          badgeColor: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
          count: dashboard.pendingApprovals.length,
        },
        {
          key: "capacityRisks",
          title: "Capaciteitsrisico's",
          icon: AlertTriangle,
          color: "text-orange-600 dark:text-orange-400",
          bgColor: "bg-orange-50 dark:bg-orange-950/30",
          borderColor: "border-l-orange-500",
          badgeColor: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
          count: dashboard.capacityRisks.length,
        },
        {
          key: "missingDeliverables",
          title: "Ontbrekende opleveringen",
          icon: PackageX,
          color: "text-red-600 dark:text-red-400",
          bgColor: "bg-red-50 dark:bg-red-950/30",
          borderColor: "border-l-red-500",
          badgeColor: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
          count: dashboard.missingDeliverables.length,
        },
        {
          key: "criticalSeoAlerts",
          title: "Kritieke SEO-waarschuwingen",
          icon: AlertOctagon,
          color: "text-red-600 dark:text-red-400",
          bgColor: "bg-red-50 dark:bg-red-950/30",
          borderColor: "border-l-red-500",
          badgeColor: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
          count: dashboard.criticalSeoAlerts.length,
        },
        {
          key: "integrationFailures",
          title: "Integratiefouten",
          icon: Unplug,
          color: "text-gray-600 dark:text-gray-400",
          bgColor: "bg-gray-50 dark:bg-gray-950/30",
          borderColor: "border-l-gray-400",
          badgeColor: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
          count: dashboard.integrationFailures.length,
        },
        {
          key: "growthOpportunities",
          title: "Groeimogelijkheden",
          icon: TrendingUp,
          color: "text-emerald-600 dark:text-emerald-400",
          bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
          borderColor: "border-l-emerald-500",
          badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
          count: dashboard.growthOpportunities.length,
        },
      ]
    : [];

  const renderSectionContent = (key: string) => {
    if (!dashboard) return null;

    switch (key) {
      case "clientsNeedingAttention":
        return dashboard.clientsNeedingAttention.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Geen cliënten die aandacht nodig hebben</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {dashboard.clientsNeedingAttention.map((client) => (
              <div key={client.clientId} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{client.clientName}</p>
                  <p className="text-xs text-muted-foreground">{client.concernReason}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <Badge variant="outline" className="text-xs">
                    Score: {client.healthScore}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {HEALTH_LABELS[client.healthStatus] || client.healthStatus}
                  </Badge>
                  <Badge
                    variant={
                      client.slaStatus === "BREACHED"
                        ? "destructive"
                        : client.slaStatus === "AT_RISK"
                        ? "default"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    {SLA_LABELS[client.slaStatus] || client.slaStatus}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        );

      case "reportsDue":
        return dashboard.reportsDue.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Geen rapporten verschuldigd</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {dashboard.reportsDue.map((report) => (
              <div key={report.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{report.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {report.type}
                    {report.clientName && ` · ${report.clientName}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <Badge variant="outline" className="text-xs">
                    {formatDate(report.dueDate)}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {DELIVERABLE_STATUS_LABELS[report.status] || report.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        );

      case "pendingApprovals":
        return dashboard.pendingApprovals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Geen openstaande goedkeuringen</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {dashboard.pendingApprovals.map((approval) => (
              <div key={approval.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{approval.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {approval.itemType}
                    {approval.submittedBy && ` · Ingediend door ${approval.submittedBy}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <Badge
                    variant={
                      approval.riskLevel === "critical"
                        ? "destructive"
                        : approval.riskLevel === "high"
                        ? "default"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    {approval.riskLevel === "critical"
                      ? "Kritiek"
                      : approval.riskLevel === "high"
                      ? "Hoog"
                      : approval.riskLevel === "medium"
                      ? "Gemiddeld"
                      : "Laag"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(approval.submittedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        );

      case "capacityRisks":
        return dashboard.capacityRisks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Geen capaciteitsrisico's</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {dashboard.capacityRisks.map((risk) => (
              <div key={risk.userId} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{risk.userName}</p>
                  <p className="text-xs text-muted-foreground">
                    {risk.totalHoursThisWeek}/{risk.maxHoursPerWeek} uur deze week
                    {risk.overloadedProjects.length > 0 &&
                      ` · ${risk.overloadedProjects.length} overbelaste projecten`}
                  </p>
                </div>
                <Badge
                  variant={risk.utilizationPercent > 100 ? "destructive" : "default"}
                  className="text-xs shrink-0 ml-3"
                >
                  {risk.utilizationPercent}%
                </Badge>
              </div>
            ))}
          </div>
        );

      case "missingDeliverables":
        return dashboard.missingDeliverables.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Geen ontbrekende opleveringen</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {dashboard.missingDeliverables.map((del) => (
              <div key={del.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{del.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {del.type}
                    {del.clientName && ` · ${del.clientName}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <Badge variant="destructive" className="text-xs">Ontbreekt</Badge>
                  {del.dueDate && (
                    <span className="text-xs text-muted-foreground">
                      {formatDate(del.dueDate)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        );

      case "criticalSeoAlerts":
        return dashboard.criticalSeoAlerts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Geen kritieke SEO-waarschuwingen</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {dashboard.criticalSeoAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {alert.type}
                    {alert.severity && ` · ${alert.severity}`}
                  </p>
                </div>
                <Badge variant="destructive" className="text-xs shrink-0 ml-3">
                  {alert.severity === "CRITICAL" ? "Kritiek" : alert.severity === "HIGH" ? "Hoog" : alert.severity}
                </Badge>
              </div>
            ))}
          </div>
        );

      case "integrationFailures":
        return dashboard.integrationFailures.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Geen integratiefouten</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {dashboard.integrationFailures.map((failure) => (
              <div key={failure.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{failure.provider}</p>
                  <p className="text-xs text-muted-foreground truncate">{failure.errorMessage}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-3">
                  {formatDate(failure.lastSyncAt)}
                </span>
              </div>
            ))}
          </div>
        );

      case "growthOpportunities":
        return dashboard.growthOpportunities.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Geen groeimogelijkheden gevonden</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {dashboard.growthOpportunities.map((opp) => (
              <div key={opp.clientId} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{opp.clientName}</p>
                  <p className="text-xs text-muted-foreground truncate">{opp.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <Badge variant="outline" className="text-xs">
                    {opp.opportunityType}
                  </Badge>
                  {opp.estimatedRevenue !== null && (
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(opp.estimatedRevenue)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

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
          <h1 className="text-2xl font-bold tracking-tight">Agentschapsdashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overzicht van alle agentschapsactiviteiten en waarschuwingen
          </p>
        </div>
      </motion.div>

      {/* Loading State */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {alertSections.map((section) => {
            const Icon = section.icon;
            const isExpanded = expandedSections[section.key] ?? false;

            return (
              <motion.div key={section.key} variants={item} className="sm:col-span-2 lg:col-span-1">
                <Collapsible open={isExpanded} onOpenChange={() => toggleSection(section.key)}>
                  <Card className={`border-l-4 ${section.borderColor} ${section.bgColor}`}>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="pb-2 cursor-pointer hover:opacity-80 transition-opacity">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon className={`h-5 w-5 shrink-0 ${section.color}`} />
                            <CardTitle className="text-sm font-medium truncate">
                              {section.title}
                            </CardTitle>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded-full text-xs font-bold ${section.badgeColor}`}>
                              {section.count}
                            </span>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        {renderSectionContent(section.key)}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
