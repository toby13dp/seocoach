"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Map,
  RefreshCw,
  Loader2,
  Check,
  User,
  Clock,
  Zap,
  Flame,
  Minus,
  AlertTriangle,
  Calendar,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";

type RoadmapTimeframe = "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "NINETY_DAYS" | "LATER";
type RoadmapItemStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED";
type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface RoadmapItem {
  id: string;
  title: string;
  type: string;
  priority: Priority;
  effort: string;
  status: RoadmapItemStatus;
  assignedTo: string | null;
  dueDate: string | null;
  timeframe: RoadmapTimeframe;
  createdAt: string;
}

const timeframeConfig: Record<RoadmapTimeframe, { label: string; emptyLabel: string }> = {
  TODAY: { label: "Vandaag", emptyLabel: "Vandaag" },
  THIS_WEEK: { label: "Deze week", emptyLabel: "deze week" },
  THIS_MONTH: { label: "Deze maand", emptyLabel: "deze maand" },
  NINETY_DAYS: { label: "90 dagen", emptyLabel: "90 dagen" },
  LATER: { label: "Later", emptyLabel: "later" },
};

const priorityConfig: Record<Priority, { color: string; icon: typeof Flame; label: string }> = {
  CRITICAL: { color: "text-red-600 dark:text-red-400", icon: Flame, label: "Kritiek" },
  HIGH: { color: "text-orange-600 dark:text-orange-400", icon: AlertTriangle, label: "Hoog" },
  MEDIUM: { color: "text-yellow-600 dark:text-yellow-400", icon: Minus, label: "Gemiddeld" },
  LOW: { color: "text-blue-600 dark:text-blue-400", icon: Minus, label: "Laag" },
};

const typeBadgeStyle = (type: string) => {
  switch (type) {
    case "TECHNICAL":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "CONTENT":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300";
    case "LINK_BUILDING":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case "ON_PAGE":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
    case "MONITORING":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const typeLabel = (type: string) => {
  switch (type) {
    case "TECHNICAL": return "Technisch";
    case "CONTENT": return "Content";
    case "LINK_BUILDING": return "Linkbuilding";
    case "ON_PAGE": return "On-page";
    case "MONITORING": return "Monitoring";
    default: return type;
  }
};

const effortLabel = (effort: string) => {
  switch (effort) {
    case "MINIMAL": return "Minimaal";
    case "LOW": return "Laag";
    case "MEDIUM": return "Gemiddeld";
    case "HIGH": return "Hoog";
    case "VERY_HIGH": return "Zeer hoog";
    default: return effort;
  }
};

const statusBadgeStyle = (status: RoadmapItemStatus) => {
  switch (status) {
    case "PLANNED":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const statusLabel = (status: RoadmapItemStatus) => {
  switch (status) {
    case "PLANNED": return "Gepland";
    case "IN_PROGRESS": return "Bezig";
    case "COMPLETED": return "Voltooid";
    default: return status;
  }
};

export default function RoadmapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("TODAY");
  const [completingId, setCompletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRoadmap();
  }, [projectId]);

  const fetchRoadmap = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/roadmap`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      // Silently handle
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/roadmap/generate`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Roadmap vernieuwd");
        fetchRoadmap();
      } else {
        toast.error("Kon roadmap niet vernieuwen");
      }
    } catch {
      toast.error("Fout bij vernieuwen roadmap");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleComplete = async (itemId: string) => {
    setCompletingId(itemId);
    try {
      const res = await fetch(`/api/projects/${projectId}/roadmap/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      if (res.ok) {
        toast.success("Actie voltooid");
        fetchRoadmap();
      } else {
        toast.error("Kon actie niet voltooien");
      }
    } catch {
      toast.error("Fout bij voltooien actie");
    } finally {
      setCompletingId(null);
    }
  };

  const handleChangePriority = async (itemId: string, priority: Priority) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/roadmap/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      });
      if (res.ok) {
        toast.success("Prioriteit bijgewerkt");
        fetchRoadmap();
      } else {
        toast.error("Kon prioriteit niet bijwerken");
      }
    } catch {
      toast.error("Fout bij bijwerken prioriteit");
    }
  };

  const timeframe = activeTab as RoadmapTimeframe;
  const filteredItems = items.filter((item) => item.timeframe === timeframe);
  const plannedItems = filteredItems.filter((i) => i.status !== "COMPLETED");
  const completedItems = filteredItems.filter((i) => i.status === "COMPLETED");

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
          <h1 className="text-2xl font-bold tracking-tight">Roadmap</h1>
          <p className="text-sm text-muted-foreground">
            Jouw geprioriteerde SEO-acties op een rij
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Verversen
        </Button>
      </div>

      {/* View Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          {Object.entries(timeframeConfig).map(([key, config]) => (
            <TabsTrigger key={key} value={key}>
              {config.label}
              <Badge variant="secondary" className="ml-1.5 h-5 min-w-[20px] flex items-center justify-center text-[10px]">
                {items.filter((i) => i.timeframe === key && i.status !== "COMPLETED").length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.keys(timeframeConfig).map((key) => (
          <TabsContent key={key} value={key} className="mt-4">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="h-32 animate-pulse bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Map className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      Geen acties gepland voor {timeframeConfig[key as RoadmapTimeframe].emptyLabel}.
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Klik op &quot;Verversen&quot; om je roadmap opnieuw te genereren op basis van je projectgegevens.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Planned items */}
                {plannedItems.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      Gepland ({plannedItems.length})
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {plannedItems.map((item) => {
                        const prioConfig = priorityConfig[item.priority];
                        const PrioIcon = prioConfig.icon;

                        return (
                          <Card key={item.id} className="relative">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-2 mb-3">
                                <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <Badge className={`text-[10px] h-5 ${typeBadgeStyle(item.type)}`}>
                                      {typeLabel(item.type)}
                                    </Badge>
                                    <Badge className={`text-[10px] h-5 ${statusBadgeStyle(item.status)}`}>
                                      {statusLabel(item.status)}
                                    </Badge>
                                  </div>
                                  <h4 className="font-medium text-sm">{item.title}</h4>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 text-xs text-muted-foreground ml-6">
                                <span className={`flex items-center gap-1 ${prioConfig.color}`}>
                                  <PrioIcon className="h-3 w-3" />
                                  {prioConfig.label}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Zap className="h-3 w-3" />
                                  {effortLabel(item.effort)}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-xs text-muted-foreground ml-6 mt-2">
                                {item.assignedTo && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {item.assignedTo}
                                  </span>
                                )}
                                {item.dueDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(item.dueDate).toLocaleDateString("nl-NL")}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 ml-6 mt-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => handleComplete(item.id)}
                                  disabled={completingId === item.id}
                                >
                                  {completingId === item.id ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  ) : (
                                    <Check className="mr-1 h-3 w-3" />
                                  )}
                                  Voltooien
                                </Button>
                                <Select
                                  onValueChange={(val) => handleChangePriority(item.id, val as Priority)}
                                >
                                  <SelectTrigger className="h-7 w-auto text-xs border-0 p-0 pr-6">
                                    <SelectValue placeholder="Prioriteit" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="CRITICAL">Kritiek</SelectItem>
                                    <SelectItem value="HIGH">Hoog</SelectItem>
                                    <SelectItem value="MEDIUM">Gemiddeld</SelectItem>
                                    <SelectItem value="LOW">Laag</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Completed items */}
                {completedItems.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      Voltooid ({completedItems.length})
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {completedItems.map((item) => (
                        <Card key={item.id} className="opacity-60">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-2 mb-2">
                              <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <Badge className={`text-[10px] h-5 ${typeBadgeStyle(item.type)}`}>
                                    {typeLabel(item.type)}
                                  </Badge>
                                  <Badge className="text-[10px] h-5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                                    Voltooid
                                  </Badge>
                                </div>
                                <h4 className="font-medium text-sm line-through">{item.title}</h4>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </motion.div>
  );
}
