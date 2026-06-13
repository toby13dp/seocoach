"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "@/i18n/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  CheckSquare,
  Loader2,
  AlertCircle,
  Clock,
  Zap,
} from "lucide-react";

interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  effort: string;
  status: string;
  deadline: string | null;
  automationAvailable: boolean;
  approvalRequired: boolean;
  project: { id: string; name: string };
  createdAt: string;
}

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

export default function ActionsPage() {
  const router = useRouter();
  const t = useTranslations("actions");
  const tCommon = useTranslations("common");

  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/actions").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ])
      .then(([actionsData, projectsData]) => {
        setActionItems(actionsData.items || []);
        setProjects((projectsData.projects || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
      })
      .catch(() => {
        // silently fail
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filteredItems = actionItems.filter((item) => {
    if (filterPriority !== "all" && item.priority !== filterPriority) return false;
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (filterProject !== "all" && item.project.id !== filterProject) return false;
    return true;
  });

  const priorityVariant = (priority: string) => {
    switch (priority) {
      case "CRITICAL": return "destructive";
      case "HIGH": return "default";
      case "MEDIUM": return "secondary";
      case "LOW": return "outline";
      default: return "secondary";
    }
  };

  const priorityLabel = (priority: string) => {
    switch (priority) {
      case "CRITICAL": return t("critical");
      case "HIGH": return t("high");
      case "MEDIUM": return t("medium");
      case "LOW": return t("low");
      default: return priority;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "PENDING": return t("pending");
      case "IN_PROGRESS": return t("inProgress");
      case "COMPLETED": return t("completed");
      case "SKIPPED": return t("skipped");
      default: return status;
    }
  };

  const effortLabel = (effort: string) => {
    switch (effort) {
      case "MINIMAL": return t("minimal");
      case "LOW": return t("low");
      case "MEDIUM": return t("medium");
      case "HIGH": return t("high");
      default: return effort;
    }
  };

  const handleUpdateStatus = async (actionId: string, newStatus: string) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/actions/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setActionItems((prev) =>
          prev.map((a) => (a.id === actionId ? { ...a, status: newStatus } : a))
        );
        setSelectedAction(null);
      }
    } catch {
      // silently fail
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-4 md:p-6 space-y-6"
    >
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      </motion.div>

      {/* Filters */}
      <motion.div variants={item} className="flex flex-wrap gap-3">
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("filterPriority")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tCommon("all")}</SelectItem>
            <SelectItem value="CRITICAL">{t("critical")}</SelectItem>
            <SelectItem value="HIGH">{t("high")}</SelectItem>
            <SelectItem value="MEDIUM">{t("medium")}</SelectItem>
            <SelectItem value="LOW">{t("low")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("filterStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tCommon("all")}</SelectItem>
            <SelectItem value="PENDING">{t("pending")}</SelectItem>
            <SelectItem value="IN_PROGRESS">{t("inProgress")}</SelectItem>
            <SelectItem value="COMPLETED">{t("completed")}</SelectItem>
            <SelectItem value="SKIPPED">{t("skipped")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t("filterProject")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tCommon("all")}</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Action Items */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-5 bg-muted rounded w-1/3" />
                <div className="h-4 bg-muted rounded w-2/3 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <motion.div variants={item}>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckSquare className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold">{t("noActions")}</h3>
              <p className="text-muted-foreground text-sm mt-1">{t("noActionsDesc")}</p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((actionItem) => (
            <motion.div key={actionItem.id} variants={item}>
              <Card
                className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => setSelectedAction(actionItem)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sm truncate">{actionItem.title}</h3>
                        {actionItem.automationAvailable && (
                          <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </div>
                      {actionItem.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {actionItem.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={priorityVariant(actionItem.priority) as "destructive" | "default" | "secondary" | "outline"} className="text-xs">
                          {priorityLabel(actionItem.priority)}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {effortLabel(actionItem.effort)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {statusLabel(actionItem.status)}
                        </Badge>
                        {actionItem.deadline && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(actionItem.deadline).toLocaleDateString("nl-NL")}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {actionItem.project.name}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Action Detail Dialog */}
      <Dialog open={!!selectedAction} onOpenChange={() => setSelectedAction(null)}>
        <DialogContent>
          {selectedAction && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedAction.title}</DialogTitle>
                <DialogDescription>
                  {selectedAction.description || ""}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={priorityVariant(selectedAction.priority) as "destructive" | "default" | "secondary" | "outline"}>
                    {priorityLabel(selectedAction.priority)}
                  </Badge>
                  <Badge variant="secondary">
                    {effortLabel(selectedAction.effort)}
                  </Badge>
                  <Badge variant="outline">
                    {statusLabel(selectedAction.status)}
                  </Badge>
                  {selectedAction.automationAvailable && (
                    <Badge className="bg-emerald-600">
                      <Zap className="mr-1 h-3 w-3" />
                      {t("automationAvailable")}
                    </Badge>
                  )}
                  {selectedAction.approvalRequired && (
                    <Badge variant="destructive">
                      {t("approvalRequired")}
                    </Badge>
                  )}
                </div>
                {selectedAction.deadline && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {t("deadline")}: {new Date(selectedAction.deadline).toLocaleDateString("nl-NL")}
                  </p>
                )}
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row">
                {selectedAction.status !== "IN_PROGRESS" && (
                  <Button
                    variant="outline"
                    onClick={() => handleUpdateStatus(selectedAction.id, "IN_PROGRESS")}
                    disabled={isUpdating}
                  >
                    {t("inProgress")}
                  </Button>
                )}
                {selectedAction.status !== "COMPLETED" && (
                  <Button
                    onClick={() => handleUpdateStatus(selectedAction.id, "COMPLETED")}
                    disabled={isUpdating}
                  >
                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("completed")}
                  </Button>
                )}
                {selectedAction.status !== "SKIPPED" && (
                  <Button
                    variant="ghost"
                    onClick={() => handleUpdateStatus(selectedAction.id, "SKIPPED")}
                    disabled={isUpdating}
                  >
                    {t("skipped")}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
