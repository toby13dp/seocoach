"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "@/i18n/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  AlertCircle,
  Activity,
  Link2,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { useEffect, useState } from "react";

interface ActionItem {
  id: string;
  title: string;
  priority: string;
  status: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
}

interface JobEntry {
  id: string;
  type: string;
  status: string;
  progress: number;
  createdAt: string;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tActions = useTranslations("actions");

  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([]);
  const [recentJobs, setRecentJobs] = useState<JobEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [actionsRes, logsRes, jobsRes] = await Promise.all([
          fetch("/api/actions?limit=5"),
          fetch("/api/audit?limit=5"),
          fetch("/api/jobs?limit=5"),
        ]);

        if (actionsRes.ok) {
          const data = await actionsRes.json();
          setActionItems(data.items || []);
        }
        if (logsRes.ok) {
          const data = await logsRes.json();
          setRecentLogs(data.items || []);
        }
        if (jobsRes.ok) {
          const data = await jobsRes.json();
          setRecentJobs(data.items || []);
        }
      } catch {
        // silently fail - data will just be empty
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const userName = session?.user?.name || "";

  const priorityVariant = (priority: string) => {
    switch (priority) {
      case "CRITICAL": return "destructive";
      case "HIGH": return "default";
      case "MEDIUM": return "secondary";
      case "LOW": return "outline";
      default: return "secondary";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "PENDING": return tActions("pending");
      case "IN_PROGRESS": return tActions("inProgress");
      case "COMPLETED": return tActions("completed");
      case "SKIPPED": return tActions("skipped");
      default: return status;
    }
  };

  const jobStatusLabel = (status: string) => {
    switch (status) {
      case "PENDING": return tActions("pending");
      case "RUNNING": return tActions("inProgress");
      case "COMPLETED": return tActions("completed");
      case "FAILED": return "Mislukt";
      case "CANCELLED": return "Geannuleerd";
      default: return status;
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-4 md:p-6 space-y-6"
    >
      {/* Welcome */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("welcome", { name: userName })}
        </h1>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={item} className="flex flex-wrap gap-3">
        <Button onClick={() => router.push("/projects")}>
          <Plus className="mr-2 h-4 w-4" />
          {t("newProject")}
        </Button>
        <Button variant="outline" onClick={() => router.push("/projects")}>
          <Search className="mr-2 h-4 w-4" />
          {t("startCrawl")}
        </Button>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Important Actions */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertCircle className="h-5 w-5 text-primary" />
                {t("importantActions")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : actionItems.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {actionItems.map((action) => (
                    <div
                      key={action.id}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className="text-sm truncate mr-2">{action.title}</span>
                      <Badge variant={priorityVariant(action.priority) as "destructive" | "default" | "secondary" | "outline"} className="shrink-0 text-xs">
                        {tActions(action.priority.toLowerCase() as "critical" | "high" | "medium" | "low")}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("noActions")}</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-5 w-5 text-primary" />
                {t("recentActivity")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : recentLogs.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between py-1.5">
                      <span className="text-sm truncate mr-2">{log.action}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(log.createdAt).toLocaleDateString("nl-NL")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("noActivity")}</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Integration Status */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="h-5 w-5 text-primary" />
                {t("integrationStatus")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <Link2 className="h-10 w-10 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium">{t("noIntegrations")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("noIntegrationsDesc")}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Scheduled Work */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-5 w-5 text-primary" />
                {t("scheduledWork")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-8 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : recentJobs.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {recentJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between py-1.5">
                      <span className="text-sm truncate mr-2">{job.type}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {jobStatusLabel(job.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("noScheduledWork")}</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Approval Requests */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                {t("approvalRequests")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <CheckCircle2 className="h-10 w-10 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium">{t("noApprovalRequests")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("noApprovalRequestsDesc")}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
