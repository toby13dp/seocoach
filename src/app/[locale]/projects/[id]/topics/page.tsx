"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "@/i18n/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Loader2,
  MoreHorizontal,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Network,
  List,
  Trash2,
  Pencil,
  Link2,
} from "lucide-react";
import { toast } from "sonner";

// --- Types ---
interface TopicKeyword {
  id: string;
  keyword: { id: string; keyword: string };
}

interface TopicEntry {
  id: string;
  name: string;
  description: string | null;
  clusterId: string | null;
  isPillar: boolean;
  suggestedUrl: string | null;
  searchIntent: string;
  funnelStage: string;
  conversionGoal: string | null;
  priority: string;
  impact: string | null;
  effort: string;
  sortOrder: number;
  cluster: { id: string; name: string } | null;
  topicKeywords: TopicKeyword[];
  createdAt: string;
  updatedAt: string;
}

interface ClusterEntry {
  id: string;
  name: string;
  description: string | null;
  _count?: { topics: number };
}

interface TopicEdge {
  id: string;
  fromId: string;
  toId: string;
  relationType: string;
  label: string | null;
}

interface TopicGraphData {
  nodes: Array<{
    id: string;
    name: string;
    isPillar: boolean;
    clusterId?: string;
    clusterName?: string;
    searchIntent: string;
    funnelStage: string;
    priority: string;
  }>;
  edges: TopicEdge[];
}

// --- Badge helpers ---
const intentBadgeStyle = (intent: string) => {
  switch (intent) {
    case "INFORMATIONAL": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "NAVIGATIONAL": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "TRANSACTIONAL": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    case "COMMERCIAL_INVESTIGATION": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case "LOCAL": return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300";
    case "BRANDED": return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    default: return "bg-muted text-muted-foreground";
  }
};

const funnelBadgeStyle = (stage: string) => {
  switch (stage) {
    case "AWARENESS": return "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300";
    case "CONSIDERATION": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    case "DECISION": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300";
    case "RETENTION": return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    default: return "bg-muted text-muted-foreground";
  }
};

const clusterColors = [
  "border-emerald-400 bg-emerald-50 dark:bg-emerald-950",
  "border-blue-400 bg-blue-50 dark:bg-blue-950",
  "border-purple-400 bg-purple-50 dark:bg-purple-950",
  "border-orange-400 bg-orange-50 dark:bg-orange-950",
  "border-rose-400 bg-rose-50 dark:bg-rose-950",
  "border-teal-400 bg-teal-50 dark:bg-teal-950",
  "border-amber-400 bg-amber-50 dark:bg-amber-950",
  "border-cyan-400 bg-cyan-50 dark:bg-cyan-950",
];

const getClusterColor = (clusterId: string | null, clusterIndex: number) => {
  if (!clusterId) return "border-gray-300 bg-gray-50 dark:bg-gray-900";
  return clusterColors[clusterIndex % clusterColors.length];
};

// Sortable row component for dnd-kit
function SortableTopicRow({
  topic,
  t,
  tKw,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
}: {
  topic: TopicEntry;
  t: (k: string) => string;
  tKw: (k: string) => string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: topic.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <>
      <TableRow ref={setNodeRef} style={style}>
        <TableCell className="w-[40px]">
          <button
            className="cursor-grab active:cursor-grabbing p-1"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        </TableCell>
        <TableCell>
          <button onClick={onToggleExpand} className="mr-1">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          <span className="font-medium">{topic.name}</span>
          {topic.isPillar && (
            <Badge className="ml-2 text-xs bg-emerald-600" variant="default">
              {t("pillar")}
            </Badge>
          )}
        </TableCell>
        <TableCell>{topic.cluster?.name ?? "-"}</TableCell>
        <TableCell>
          <Badge variant="outline" className={`text-xs ${topic.isPillar ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>
            {topic.isPillar ? t("pillar") : t("support")}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={`text-xs ${intentBadgeStyle(topic.searchIntent)}`}>
            {topic.searchIntent === "INFORMATIONAL" ? "Informatief"
              : topic.searchIntent === "NAVIGATIONAL" ? "Navigatie"
              : topic.searchIntent === "TRANSACTIONAL" ? "Transactioneel"
              : topic.searchIntent === "COMMERCIAL_INVESTIGATION" ? "Commercieel"
              : topic.searchIntent === "LOCAL" ? "Lokaal"
              : topic.searchIntent === "BRANDED" ? "Merk"
              : "Onbekend"}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={`text-xs ${funnelBadgeStyle(topic.funnelStage)}`}>
            {topic.funnelStage === "AWARENESS" ? "Bewustwording"
              : topic.funnelStage === "CONSIDERATION" ? "Overweging"
              : topic.funnelStage === "DECISION" ? "Beslissing"
              : topic.funnelStage === "RETENTION" ? "Behoud"
              : "Onbekend"}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs">
            {topic.priority === "CRITICAL" ? "Kritiek"
              : topic.priority === "HIGH" ? "Hoog"
              : topic.priority === "MEDIUM" ? "Gemiddeld"
              : "Laag"}
          </Badge>
        </TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                {t("editTopic")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                {t("deleteTopic")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/30 px-8 py-3">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">
                {tKw("keywords")}
              </p>
              {topic.topicKeywords && topic.topicKeywords.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {topic.topicKeywords.map((tk) => (
                    <Badge key={tk.id} variant="secondary" className="text-xs">
                      {tk.keyword.keyword}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{tKw("noKeywords")}</p>
              )}
              {topic.description && (
                <p className="text-sm text-muted-foreground mt-2">
                  {topic.description}
                </p>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// Graph node component
function GraphNode({
  node,
  x,
  y,
  colorClass,
  isSelected,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  node: { id: string; name: string; isPillar: boolean; searchIntent: string };
  x: number;
  y: number;
  colorClass: string;
  isSelected: boolean;
  onSelect: () => void;
  onDragStart: (id: string, e: React.MouseEvent) => void;
  onDragMove: (e: React.MouseEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      className={`absolute cursor-pointer select-none rounded-lg border-2 px-3 py-2 transition-shadow ${
        node.isPillar ? "min-w-[120px]" : "min-w-[90px]"
      } ${colorClass} ${isSelected ? "ring-2 ring-primary shadow-lg" : "shadow"}`}
      style={{ left: x, top: y }}
      onClick={onSelect}
      onMouseDown={(e) => onDragStart(node.id, e)}
      onMouseMove={onDragMove}
      onMouseUp={onDragEnd}
      onMouseLeave={onDragEnd}
    >
      <p
        className={`text-xs font-medium text-center ${
          node.isPillar ? "text-sm font-semibold" : ""
        }`}
      >
        {node.name}
      </p>
      {node.isPillar && (
        <Badge className="mt-1 text-[10px] bg-emerald-600" variant="default">
          Pilaar
        </Badge>
      )}
    </div>
  );
}

export default function TopicsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const t = useTranslations("topics");
  const tKw = useTranslations("keywords");
  const tCommon = useTranslations("common");

  // Data state
  const [topics, setTopics] = useState<TopicEntry[]>([]);
  const [clusters, setClusters] = useState<ClusterEntry[]>([]);
  const [graphData, setGraphData] = useState<TopicGraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // View state
  const [viewMode, setViewMode] = useState<"graph" | "list">("list");
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Dialog state
  const [addTopicOpen, setAddTopicOpen] = useState(false);
  const [addClusterOpen, setAddClusterOpen] = useState(false);
  const [addRelationOpen, setAddRelationOpen] = useState(false);
  const [editTopicOpen, setEditTopicOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Topic form
  const [topicForm, setTopicForm] = useState({
    name: "",
    description: "",
    clusterId: "",
    isPillar: false,
    suggestedUrl: "",
    searchIntent: "UNKNOWN",
    funnelStage: "UNKNOWN",
    conversionGoal: "",
    priority: "MEDIUM",
    impact: "",
    effort: "MEDIUM",
  });

  // Cluster form
  const [clusterForm, setClusterForm] = useState({
    name: "",
    description: "",
  });

  // Relation form
  const [relationForm, setRelationForm] = useState({
    fromTopicId: "",
    toTopicId: "",
    relationType: "supports",
    label: "",
  });

  // Edit topic state
  const [editingTopic, setEditingTopic] = useState<TopicEntry | null>(null);

  // Graph node positions (for drag)
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const graphContainerRef = useRef<HTMLDivElement>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch data
  const fetchTopics = useCallback(async () => {
    setIsLoading(true);
    try {
      const [topicsRes, clustersRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/topics`),
        fetch(`/api/projects/${projectId}/clusters`),
      ]);

      if (topicsRes.ok) {
        const data = await topicsRes.json();
        setTopics(data.data || []);
      }
      if (clustersRes.ok) {
        const data = await clustersRes.json();
        setClusters(data.data || []);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const fetchGraph = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/topics?graph=true`);
      if (res.ok) {
        const data = await res.json();
        const graph = data.data as TopicGraphData;
        setGraphData(graph);

        // Initialize positions in a grid layout
        const positions: Record<string, { x: number; y: number }> = {};
        const nodesPerRow = 4;
        const nodeSpacingX = 220;
        const nodeSpacingY = 100;
        graph.nodes.forEach((node, idx) => {
          const row = Math.floor(idx / nodesPerRow);
          const col = idx % nodesPerRow;
          positions[node.id] = {
            x: 40 + col * nodeSpacingX,
            y: 40 + row * nodeSpacingY,
          };
        });
        setNodePositions(positions);
      }
    } catch {
      // silently fail
    }
  }, [projectId]);

  useEffect(() => {
    fetchTopics();
    fetchGraph();
  }, [fetchTopics, fetchGraph]);

  // Group topics by cluster for list view
  const topicsByCluster = clusters.map((cluster) => ({
    cluster,
    topics: topics
      .filter((t) => t.clusterId === cluster.id)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }));
  const unclusteredTopics = topics.filter((t) => !t.clusterId);

  // Toggle expand
  const toggleExpand = (topicId: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  };

  // Add topic
  const handleAddTopic = async () => {
    if (!topicForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: topicForm.name.trim(),
          description: topicForm.description || undefined,
          clusterId: topicForm.clusterId || undefined,
          isPillar: topicForm.isPillar,
          suggestedUrl: topicForm.suggestedUrl || undefined,
          searchIntent: topicForm.searchIntent !== "UNKNOWN" ? topicForm.searchIntent : undefined,
          funnelStage: topicForm.funnelStage !== "UNKNOWN" ? topicForm.funnelStage : undefined,
          conversionGoal: topicForm.conversionGoal || undefined,
          priority: topicForm.priority,
          impact: topicForm.impact || undefined,
          effort: topicForm.effort,
        }),
      });
      if (res.ok) {
        toast.success(t("createTopicSuccess"));
        setTopicForm({ name: "", description: "", clusterId: "", isPillar: false, suggestedUrl: "", searchIntent: "UNKNOWN", funnelStage: "UNKNOWN", conversionGoal: "", priority: "MEDIUM", impact: "", effort: "MEDIUM" });
        setAddTopicOpen(false);
        fetchTopics();
        fetchGraph();
      } else {
        toast.error(t("createTopicError"));
      }
    } catch {
      toast.error(t("createTopicError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add cluster
  const handleAddCluster = async () => {
    if (!clusterForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/clusters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: clusterForm.name.trim(),
          description: clusterForm.description || undefined,
        }),
      });
      if (res.ok) {
        toast.success(t("createClusterSuccess"));
        setClusterForm({ name: "", description: "" });
        setAddClusterOpen(false);
        fetchTopics();
      } else {
        toast.error(t("createClusterError"));
      }
    } catch {
      toast.error(t("createClusterError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add relation
  const handleAddRelation = async () => {
    if (!relationForm.fromTopicId || !relationForm.toTopicId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/topic-relations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromTopicId: relationForm.fromTopicId,
          toTopicId: relationForm.toTopicId,
          relationType: relationForm.relationType,
          label: relationForm.label || undefined,
        }),
      });
      if (res.ok) {
        toast.success(t("createRelationSuccess"));
        setRelationForm({ fromTopicId: "", toTopicId: "", relationType: "supports", label: "" });
        setAddRelationOpen(false);
        fetchGraph();
      } else {
        toast.error(t("createRelationError"));
      }
    } catch {
      toast.error(t("createRelationError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit topic
  const handleEditTopic = async () => {
    if (!editingTopic || !topicForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/topics/${editingTopic.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: topicForm.name.trim(),
            description: topicForm.description || undefined,
            clusterId: topicForm.clusterId || null,
            isPillar: topicForm.isPillar,
            searchIntent: topicForm.searchIntent,
            funnelStage: topicForm.funnelStage,
            priority: topicForm.priority,
            effort: topicForm.effort,
          }),
        }
      );
      if (res.ok) {
        toast.success(t("updateTopicSuccess"));
        setEditTopicOpen(false);
        setEditingTopic(null);
        fetchTopics();
        fetchGraph();
      } else {
        toast.error(t("updateTopicError"));
      }
    } catch {
      toast.error(t("updateTopicError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete topic
  const handleDeleteTopic = async (topicId: string) => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/topics/${topicId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success(t("deleteTopicSuccess"));
        fetchTopics();
        fetchGraph();
      } else {
        toast.error(t("deleteTopicError"));
      }
    } catch {
      toast.error(t("deleteTopicError"));
    }
  };

  // Open edit dialog
  const openEditDialog = (topic: TopicEntry) => {
    setEditingTopic(topic);
    setTopicForm({
      name: topic.name,
      description: topic.description || "",
      clusterId: topic.clusterId || "",
      isPillar: topic.isPillar,
      suggestedUrl: topic.suggestedUrl || "",
      searchIntent: topic.searchIntent,
      funnelStage: topic.funnelStage,
      conversionGoal: topic.conversionGoal || "",
      priority: topic.priority,
      impact: topic.impact || "",
      effort: topic.effort,
    });
    setEditTopicOpen(true);
  };

  // DnD handler for list view
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Find which cluster the items belong to
    for (const group of topicsByCluster) {
      const ids = group.topics.map((t) => t.id);
      if (ids.includes(String(active.id)) && ids.includes(String(over.id))) {
        const oldIndex = ids.indexOf(String(active.id));
        const newIndex = ids.indexOf(String(over.id));
        const reordered = arrayMove(group.topics, oldIndex, newIndex);
        // Update sort orders via API
        reordered.forEach((topic, idx) => {
          fetch(`/api/projects/${projectId}/topics/${topic.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: idx }),
          });
        });
        // Optimistic update
        setTopics((prev) => {
          const updated = [...prev];
          for (const t of updated) {
            if (t.clusterId === group.cluster.id) {
              const sorted = reordered.find((r) => r.id === t.id);
              if (sorted) {
                t.sortOrder = reordered.indexOf(sorted);
              }
            }
          }
          return updated;
        });
        break;
      }
    }
  };

  // Graph drag handlers
  const handleGraphDragStart = (nodeId: string, e: React.MouseEvent) => {
    const pos = nodePositions[nodeId];
    if (!pos) return;
    setDraggingNodeId(nodeId);
    dragOffset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
  };

  const handleGraphDragMove = (e: React.MouseEvent) => {
    if (!draggingNodeId || !graphContainerRef.current) return;
    const rect = graphContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.current.x;
    const y = e.clientY - rect.top - dragOffset.current.y;
    setNodePositions((prev) => ({
      ...prev,
      [draggingNodeId]: { x: Math.max(0, x), y: Math.max(0, y) },
    }));
  };

  const handleGraphDragEnd = () => {
    setDraggingNodeId(null);
  };

  // Selected node/edge details
  const selectedNode = graphData?.nodes.find((n) => n.id === selectedNodeId);
  const selectedEdge = graphData?.edges.find((e) => e.id === selectedEdgeId);

  // Build cluster index map
  const clusterIndexMap: Record<string, number> = {};
  clusters.forEach((c, idx) => {
    clusterIndexMap[c.id] = idx;
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
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {topics.length} onderwerp{topics.length !== 1 ? "en" : ""} in{" "}
            {clusters.length} cluster{clusters.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={addRelationOpen} onOpenChange={setAddRelationOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Link2 className="mr-2 h-4 w-4" />
                {t("addRelation")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("addRelation")}</DialogTitle>
                <DialogDescription>
                  Koppel twee onderwerpen aan elkaar
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("fromTopic")}</Label>
                  <Select
                    value={relationForm.fromTopicId}
                    onValueChange={(val) =>
                      setRelationForm({ ...relationForm, fromTopicId: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectTopic")} />
                    </SelectTrigger>
                    <SelectContent>
                      {topics.map((tp) => (
                        <SelectItem key={tp.id} value={tp.id}>
                          {tp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("toTopic")}</Label>
                  <Select
                    value={relationForm.toTopicId}
                    onValueChange={(val) =>
                      setRelationForm({ ...relationForm, toTopicId: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectTopic")} />
                    </SelectTrigger>
                    <SelectContent>
                      {topics.map((tp) => (
                        <SelectItem key={tp.id} value={tp.id}>
                          {tp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("relationType")}</Label>
                  <Select
                    value={relationForm.relationType}
                    onValueChange={(val) =>
                      setRelationForm({ ...relationForm, relationType: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supports">{t("supports")}</SelectItem>
                      <SelectItem value="contradicts">{t("contradicts")}</SelectItem>
                      <SelectItem value="related">{t("related")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("relationLabel")}</Label>
                  <Input
                    value={relationForm.label}
                    onChange={(e) =>
                      setRelationForm({ ...relationForm, label: e.target.value })
                    }
                    placeholder="Optioneel label"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddRelationOpen(false)}>
                  {tCommon("cancel")}
                </Button>
                <Button
                  onClick={handleAddRelation}
                  disabled={
                    !relationForm.fromTopicId ||
                    !relationForm.toTopicId ||
                    isSubmitting
                  }
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {tCommon("create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={addClusterOpen} onOpenChange={setAddClusterOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                {t("addCluster")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("addCluster")}</DialogTitle>
                <DialogDescription>
                  Maak een nieuwe cluster aan
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("clusterName")}</Label>
                  <Input
                    value={clusterForm.name}
                    onChange={(e) =>
                      setClusterForm({ ...clusterForm, name: e.target.value })
                    }
                    placeholder={t("clusterNamePlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("clusterDescription")}</Label>
                  <Textarea
                    value={clusterForm.description}
                    onChange={(e) =>
                      setClusterForm({
                        ...clusterForm,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddClusterOpen(false)}>
                  {tCommon("cancel")}
                </Button>
                <Button
                  onClick={handleAddCluster}
                  disabled={!clusterForm.name.trim() || isSubmitting}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {tCommon("create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={addTopicOpen} onOpenChange={setAddTopicOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                {t("addTopic")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("addTopic")}</DialogTitle>
                <DialogDescription>
                  Voeg een nieuw onderwerp toe
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("topicName")}</Label>
                  <Input
                    value={topicForm.name}
                    onChange={(e) =>
                      setTopicForm({ ...topicForm, name: e.target.value })
                    }
                    placeholder={t("topicNamePlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("description")}</Label>
                  <Textarea
                    value={topicForm.description}
                    onChange={(e) =>
                      setTopicForm({ ...topicForm, description: e.target.value })
                    }
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("cluster")}</Label>
                    <Select
                      value={topicForm.clusterId}
                      onValueChange={(val) =>
                        setTopicForm({ ...topicForm, clusterId: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("clusterSelect")} />
                      </SelectTrigger>
                      <SelectContent>
                        {clusters.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("priority")}</Label>
                    <Select
                      value={topicForm.priority}
                      onValueChange={(val) =>
                        setTopicForm({ ...topicForm, priority: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CRITICAL">Kritiek</SelectItem>
                        <SelectItem value="HIGH">Hoog</SelectItem>
                        <SelectItem value="MEDIUM">Gemiddeld</SelectItem>
                        <SelectItem value="LOW">Laag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("intent")}</Label>
                    <Select
                      value={topicForm.searchIntent}
                      onValueChange={(val) =>
                        setTopicForm({ ...topicForm, searchIntent: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UNKNOWN">Onbekend</SelectItem>
                        <SelectItem value="INFORMATIONAL">Informatief</SelectItem>
                        <SelectItem value="NAVIGATIONAL">Navigatie</SelectItem>
                        <SelectItem value="TRANSACTIONAL">Transactioneel</SelectItem>
                        <SelectItem value="COMMERCIAL_INVESTIGATION">Commercieel onderzoek</SelectItem>
                        <SelectItem value="LOCAL">Lokaal</SelectItem>
                        <SelectItem value="BRANDED">Merk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("funnel")}</Label>
                    <Select
                      value={topicForm.funnelStage}
                      onValueChange={(val) =>
                        setTopicForm({ ...topicForm, funnelStage: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UNKNOWN">Onbekend</SelectItem>
                        <SelectItem value="AWARENESS">Bewustwording</SelectItem>
                        <SelectItem value="CONSIDERATION">Overweging</SelectItem>
                        <SelectItem value="DECISION">Beslissing</SelectItem>
                        <SelectItem value="RETENTION">Behoud</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isPillar"
                    checked={topicForm.isPillar}
                    onCheckedChange={(checked) =>
                      setTopicForm({ ...topicForm, isPillar: !!checked })
                    }
                  />
                  <Label htmlFor="isPillar">{t("isPillar")}</Label>
                </div>
                <div className="space-y-2">
                  <Label>{t("suggestedUrl")}</Label>
                  <Input
                    value={topicForm.suggestedUrl}
                    onChange={(e) =>
                      setTopicForm({ ...topicForm, suggestedUrl: e.target.value })
                    }
                    placeholder="https://voorbeeld.nl/onderwerp"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("conversionGoal")}</Label>
                    <Input
                      value={topicForm.conversionGoal}
                      onChange={(e) =>
                        setTopicForm({
                          ...topicForm,
                          conversionGoal: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("effort")}</Label>
                    <Select
                      value={topicForm.effort}
                      onValueChange={(val) =>
                        setTopicForm({ ...topicForm, effort: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MINIMAL">Minimaal</SelectItem>
                        <SelectItem value="LOW">Laag</SelectItem>
                        <SelectItem value="MEDIUM">Gemiddeld</SelectItem>
                        <SelectItem value="HIGH">Hoog</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddTopicOpen(false)}>
                  {tCommon("cancel")}
                </Button>
                <Button
                  onClick={handleAddTopic}
                  disabled={!topicForm.name.trim() || isSubmitting}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {tCommon("create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : topics.length === 0 && clusters.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center">
              <Network className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="text-lg font-medium">{t("emptyTitle")}</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                {t("emptyDesc")}
              </p>
              <div className="flex gap-2 mt-4">
                <Button onClick={() => setAddClusterOpen(true)} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  {t("addCluster")}
                </Button>
                <Button onClick={() => setAddTopicOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("addTopic")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs
          value={viewMode}
          onValueChange={(val) => setViewMode(val as "graph" | "list")}
        >
          <TabsList>
            <TabsTrigger value="graph">
              <Network className="mr-2 h-4 w-4" />
              {t("graphView")}
            </TabsTrigger>
            <TabsTrigger value="list">
              <List className="mr-2 h-4 w-4" />
              {t("listView")}
            </TabsTrigger>
          </TabsList>

          {/* Graph View */}
          <TabsContent value="graph" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <Card>
                  <CardContent className="p-0">
                    <div
                      ref={graphContainerRef}
                      className="relative w-full h-[500px] overflow-auto bg-muted/30 rounded-lg"
                      style={{ minHeight: 400 }}
                    >
                      {/* Draw edges as SVG */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        {graphData?.edges.map((edge) => {
                          const fromPos = nodePositions[edge.fromId];
                          const toPos = nodePositions[edge.toId];
                          if (!fromPos || !toPos) return null;
                          return (
                            <g key={edge.id}>
                              <line
                                x1={fromPos.x + 60}
                                y1={fromPos.y + 20}
                                x2={toPos.x + 60}
                                y2={toPos.y + 20}
                                stroke={
                                  edge.relationType === "supports"
                                    ? "#10b981"
                                    : edge.relationType === "contradicts"
                                    ? "#ef4444"
                                    : "#94a3b8"
                                }
                                strokeWidth={selectedEdgeId === edge.id ? 3 : 1.5}
                                strokeDasharray={
                                  edge.relationType === "related"
                                    ? "5,5"
                                    : undefined
                                }
                                className="cursor-pointer pointer-events-auto"
                                onClick={() => {
                                  setSelectedEdgeId(edge.id);
                                  setSelectedNodeId(null);
                                }}
                              />
                              {/* Arrow in the middle */}
                              <circle
                                cx={(fromPos.x + 60 + toPos.x + 60) / 2}
                                cy={(fromPos.y + 20 + toPos.y + 20) / 2}
                                r={3}
                                fill={
                                  edge.relationType === "supports"
                                    ? "#10b981"
                                    : edge.relationType === "contradicts"
                                    ? "#ef4444"
                                    : "#94a3b8"
                                }
                                className="pointer-events-auto cursor-pointer"
                                onClick={() => {
                                  setSelectedEdgeId(edge.id);
                                  setSelectedNodeId(null);
                                }}
                              />
                            </g>
                          );
                        })}
                      </svg>

                      {/* Nodes */}
                      {graphData?.nodes.map((node) => {
                        const pos = nodePositions[node.id];
                        if (!pos) return null;
                        const colorClass = getClusterColor(
                          node.clusterId || null,
                          clusterIndexMap[node.clusterId || ""] ?? 0
                        );
                        return (
                          <GraphNode
                            key={node.id}
                            node={node}
                            x={pos.x}
                            y={pos.y}
                            colorClass={colorClass}
                            isSelected={selectedNodeId === node.id}
                            onSelect={() => {
                              setSelectedNodeId(node.id);
                              setSelectedEdgeId(null);
                            }}
                            onDragStart={handleGraphDragStart}
                            onDragMove={handleGraphDragMove}
                            onDragEnd={handleGraphDragEnd}
                          />
                        );
                      })}

                      {/* Empty graph */}
                      {(!graphData || graphData.nodes.length === 0) && (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-sm text-muted-foreground">
                            {t("emptyTitle")}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Details panel */}
              <div className="space-y-4">
                {selectedNode && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t("nodeDetails")}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <span className="text-sm text-muted-foreground">{t("name")}:</span>
                        <p className="text-sm font-medium">{selectedNode.name}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline" className={`text-xs ${intentBadgeStyle(selectedNode.searchIntent)}`}>
                          {selectedNode.searchIntent === "INFORMATIONAL" ? "Informatief"
                            : selectedNode.searchIntent === "NAVIGATIONAL" ? "Navigatie"
                            : selectedNode.searchIntent === "TRANSACTIONAL" ? "Transactioneel"
                            : selectedNode.searchIntent === "COMMERCIAL_INVESTIGATION" ? "Commercieel"
                            : selectedNode.searchIntent === "LOCAL" ? "Lokaal"
                            : selectedNode.searchIntent === "BRANDED" ? "Merk"
                            : "Onbekend"}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${funnelBadgeStyle(selectedNode.funnelStage)}`}>
                          {selectedNode.funnelStage === "AWARENESS" ? "Bewustwording"
                            : selectedNode.funnelStage === "CONSIDERATION" ? "Overweging"
                            : selectedNode.funnelStage === "DECISION" ? "Beslissing"
                            : selectedNode.funnelStage === "RETENTION" ? "Behoud"
                            : "Onbekend"}
                        </Badge>
                      </div>
                      {selectedNode.isPillar && (
                        <Badge className="bg-emerald-600" variant="default">
                          {t("pillar")}
                        </Badge>
                      )}
                      {selectedNode.clusterName && (
                        <div>
                          <span className="text-sm text-muted-foreground">{t("cluster")}:</span>
                          <p className="text-sm font-medium">{selectedNode.clusterName}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-sm text-muted-foreground">{t("priority")}:</span>
                        <p className="text-sm font-medium">
                          {selectedNode.priority === "CRITICAL" ? "Kritiek"
                            : selectedNode.priority === "HIGH" ? "Hoog"
                            : selectedNode.priority === "MEDIUM" ? "Gemiddeld"
                            : "Laag"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          const topic = topics.find((tp) => tp.id === selectedNode.id);
                          if (topic) openEditDialog(topic);
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        {t("editTopic")}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {selectedEdge && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t("edgeDetails")}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <span className="text-sm text-muted-foreground">{t("fromTopic")}:</span>
                        <p className="text-sm font-medium">
                          {graphData?.nodes.find((n) => n.id === selectedEdge.fromId)?.name ?? "-"}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">{t("toTopic")}:</span>
                        <p className="text-sm font-medium">
                          {graphData?.nodes.find((n) => n.id === selectedEdge.toId)?.name ?? "-"}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">{t("relationType")}:</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {selectedEdge.relationType === "supports" ? t("supports")
                            : selectedEdge.relationType === "contradicts" ? t("contradicts")
                            : t("related")}
                        </Badge>
                      </div>
                      {selectedEdge.label && (
                        <div>
                          <span className="text-sm text-muted-foreground">{t("relationLabel")}:</span>
                          <p className="text-sm font-medium">{selectedEdge.label}</p>
                        </div>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={async () => {
                          try {
                            const res = await fetch(
                              `/api/projects/${projectId}/topic-relations?relationId=${selectedEdge.id}`,
                              { method: "DELETE" }
                            );
                            if (res.ok) {
                              toast.success(t("deleteRelationSuccess"));
                              setSelectedEdgeId(null);
                              fetchGraph();
                            } else {
                              toast.error(t("deleteRelationError"));
                            }
                          } catch {
                            toast.error(t("deleteRelationError"));
                          }
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Verwijder relatie
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {!selectedNode && !selectedEdge && (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        Klik op een onderwerp of relatie om details te bekijken
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* List View */}
          <TabsContent value="list" className="space-y-4">
            {topicsByCluster.map((group) => (
              <Card key={group.cluster.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {group.cluster.name}
                      </CardTitle>
                      {group.cluster.description && (
                        <CardDescription>
                          {group.cluster.description}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {group.topics.length} onderwerp{group.topics.length !== 1 ? "en" : ""}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {group.topics.length > 0 ? (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={group.topics.map((t) => t.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[40px]" />
                              <TableHead>{t("name")}</TableHead>
                              <TableHead>{t("cluster")}</TableHead>
                              <TableHead>{t("type")}</TableHead>
                              <TableHead>{t("intent")}</TableHead>
                              <TableHead>{t("funnel")}</TableHead>
                              <TableHead>{t("priority")}</TableHead>
                              <TableHead className="w-[60px]" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.topics.map((topic) => (
                              <SortableTopicRow
                                key={topic.id}
                                topic={topic}
                                t={t}
                                tKw={tKw}
                                isExpanded={expandedTopics.has(topic.id)}
                                onToggleExpand={() => toggleExpand(topic.id)}
                                onEdit={() => openEditDialog(topic)}
                                onDelete={() => handleDeleteTopic(topic.id)}
                              />
                            ))}
                          </TableBody>
                        </Table>
                      </SortableContext>
                    </DndContext>
                  ) : (
                    <div className="py-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        Geen onderwerpen in dit cluster
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Unclustered topics */}
            {unclusteredTopics.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Zonder cluster
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]" />
                        <TableHead>{t("name")}</TableHead>
                        <TableHead>{t("cluster")}</TableHead>
                        <TableHead>{t("type")}</TableHead>
                        <TableHead>{t("intent")}</TableHead>
                        <TableHead>{t("funnel")}</TableHead>
                        <TableHead>{t("priority")}</TableHead>
                        <TableHead className="w-[60px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unclusteredTopics.map((topic) => (
                        <SortableTopicRow
                          key={topic.id}
                          topic={topic}
                          t={t}
                          tKw={tKw}
                          isExpanded={expandedTopics.has(topic.id)}
                          onToggleExpand={() => toggleExpand(topic.id)}
                          onEdit={() => openEditDialog(topic)}
                          onDelete={() => handleDeleteTopic(topic.id)}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Edit topic dialog */}
      <Dialog open={editTopicOpen} onOpenChange={setEditTopicOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("editTopic")}</DialogTitle>
            <DialogDescription>
              Bewerk de gegevens van dit onderwerp
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("topicName")}</Label>
              <Input
                value={topicForm.name}
                onChange={(e) =>
                  setTopicForm({ ...topicForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t("description")}</Label>
              <Textarea
                value={topicForm.description}
                onChange={(e) =>
                  setTopicForm({ ...topicForm, description: e.target.value })
                }
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("cluster")}</Label>
                <Select
                  value={topicForm.clusterId}
                  onValueChange={(val) =>
                    setTopicForm({ ...topicForm, clusterId: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("clusterSelect")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geen cluster</SelectItem>
                    {clusters.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("priority")}</Label>
                <Select
                  value={topicForm.priority}
                  onValueChange={(val) =>
                    setTopicForm({ ...topicForm, priority: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CRITICAL">Kritiek</SelectItem>
                    <SelectItem value="HIGH">Hoog</SelectItem>
                    <SelectItem value="MEDIUM">Gemiddeld</SelectItem>
                    <SelectItem value="LOW">Laag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("intent")}</Label>
                <Select
                  value={topicForm.searchIntent}
                  onValueChange={(val) =>
                    setTopicForm({ ...topicForm, searchIntent: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNKNOWN">Onbekend</SelectItem>
                    <SelectItem value="INFORMATIONAL">Informatief</SelectItem>
                    <SelectItem value="NAVIGATIONAL">Navigatie</SelectItem>
                    <SelectItem value="TRANSACTIONAL">Transactioneel</SelectItem>
                    <SelectItem value="COMMERCIAL_INVESTIGATION">Commercieel onderzoek</SelectItem>
                    <SelectItem value="LOCAL">Lokaal</SelectItem>
                    <SelectItem value="BRANDED">Merk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("funnel")}</Label>
                <Select
                  value={topicForm.funnelStage}
                  onValueChange={(val) =>
                    setTopicForm({ ...topicForm, funnelStage: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNKNOWN">Onbekend</SelectItem>
                    <SelectItem value="AWARENESS">Bewustwording</SelectItem>
                    <SelectItem value="CONSIDERATION">Overweging</SelectItem>
                    <SelectItem value="DECISION">Beslissing</SelectItem>
                    <SelectItem value="RETENTION">Behoud</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="editIsPillar"
                checked={topicForm.isPillar}
                onCheckedChange={(checked) =>
                  setTopicForm({ ...topicForm, isPillar: !!checked })
                }
              />
              <Label htmlFor="editIsPillar">{t("isPillar")}</Label>
            </div>
            <div className="space-y-2">
              <Label>{t("effort")}</Label>
              <Select
                value={topicForm.effort}
                onValueChange={(val) =>
                  setTopicForm({ ...topicForm, effort: val })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MINIMAL">Minimaal</SelectItem>
                  <SelectItem value="LOW">Laag</SelectItem>
                  <SelectItem value="MEDIUM">Gemiddeld</SelectItem>
                  <SelectItem value="HIGH">Hoog</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTopicOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleEditTopic} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
