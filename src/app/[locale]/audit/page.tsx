"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "@/i18n/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion } from "framer-motion";
import { ClipboardList, Loader2, Filter } from "lucide-react";

interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  changes: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string } | null;
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

export default function AuditPage() {
  const t = useTranslations("audit");
  const tCommon = useTranslations("common");

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const entityTypes = ["Project", "ActionItem", "Job", "BrandProfile", "User", "Organization"];
  const users = Array.from(new Set(logs.map((l) => l.user?.email).filter(Boolean))) as string[];

  useEffect(() => {
    fetchLogs();
  }, [page, filterEntity]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (filterEntity !== "all") params.set("entity", filterEntity);
      if (filterUser !== "all") params.set("userEmail", filterUser);

      const res = await fetch(`/api/audit?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.items || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  };

  const entityBadgeVariant = (entity: string) => {
    switch (entity) {
      case "Project": return "default";
      case "ActionItem": return "secondary";
      case "Job": return "outline";
      default: return "secondary";
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
      <motion.div variants={item} className="flex flex-wrap gap-3 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("filterEntity")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tCommon("all")}</SelectItem>
            {entityTypes.map((entity) => (
              <SelectItem key={entity} value={entity}>
                {entity}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t("filterUser")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tCommon("all")}</SelectItem>
            {users.map((email) => (
              <SelectItem key={email} value={email}>
                {email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Audit Table */}
      <motion.div variants={item}>
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <ClipboardList className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium">{t("noLogs")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("noLogsDesc")}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("user")}</TableHead>
                    <TableHead>{t("action")}</TableHead>
                    <TableHead>{t("entity")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("details")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(log.createdAt).toLocaleDateString("nl-NL", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.user?.name || log.user?.email || t("system")}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {log.action}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={entityBadgeVariant(log.entity) as "default" | "secondary" | "outline"}
                          className="text-xs"
                        >
                          {log.entity}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-xs truncate">
                        {log.entityId || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div variants={item} className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            {tCommon("previous")}
          </Button>
          <span className="flex items-center text-sm text-muted-foreground px-2">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            {tCommon("next")}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
