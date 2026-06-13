"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Send,
  MessageSquare,
  Bot,
  User,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  FileText,
  AlertTriangle,
  Trash2,
  Hash,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Citation {
  recordType: string;
  recordId: string;
  url?: string;
  snippet: string;
}

interface ToolUsage {
  tool: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
}

interface CopilotMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Citation[];
  toolsUsed?: ToolUsage[];
  hasWarning?: boolean;
  warningType?: string;
  tokenCount?: number;
  modelUsed?: string;
  createdAt: string;
}

interface CopilotConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Quick question types (Dutch labels)
// ---------------------------------------------------------------------------

const QUICK_QUESTIONS = [
  { type: "which_pages_to_improve", label: "Welke pagina's verbeteren?" },
  { type: "why_traffic_changed", label: "Waarom verkeersdaling?" },
  { type: "which_topics_missing", label: "Welke onderwerpen ontbreken?" },
  { type: "which_pages_compete", label: "Welke pagina's concurreren?" },
  { type: "what_competitors_changed", label: "Wat deden concurrenten?" },
  { type: "which_technical_problems_matter", label: "Technische problemen?" },
  { type: "which_opportunities_affect_revenue", label: "Omzetkansen?" },
  { type: "monthly_client_summary", label: "Maandelijkse samenvatting?" },
  { type: "which_location_needs_attention", label: "Locatie aandacht?" },
  { type: "where_brand_absent_from_ai", label: "Merk in AI antwoorden?" },
];

const QUESTION_FULL_LABELS: Record<string, string> = {
  which_pages_to_improve: "Welke pagina's moeten eerst worden verbeterd?",
  why_traffic_changed: "Waarom is het verkeer veranderd?",
  which_topics_missing: "Welke onderwerpen ontbreken?",
  which_pages_compete: "Welke pagina's concurreren met elkaar?",
  what_competitors_changed: "Wat hebben concurrenten gewijzigd?",
  which_technical_problems_matter: "Welke technische problemen zijn het belangrijkst?",
  which_opportunities_affect_revenue: "Welke kansen beïnvloeden waarschijnlijk de omzet?",
  monthly_client_summary: "Wat moet in de maandelijkse cliëntsamenvatting?",
  which_location_needs_attention: "Welke locatie vereist aandacht?",
  where_brand_absent_from_ai: "Waar is het merk afwezig in AI-antwoorden?",
};

const WARNING_LABELS: Record<string, string> = {
  missing_data: "Ontbrekende gegevens",
  uncertainty: "Onzekerheid in antwoord",
  no_access: "Geen toegang tot gegevens",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CopilotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [conversations, setConversations] = useState<CopilotConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetchConversations();
  }, [projectId]);

  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
    }
  }, [activeConversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversations = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/copilot/conversations`);
      if (res.ok) {
        const data = await res.json();
        const convos = data.conversations || [];
        setConversations(convos);
        if (convos.length > 0 && !activeConversationId) {
          setActiveConversationId(convos[0].id);
        }
      }
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/copilot/conversations/${conversationId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {
      // silently handle
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const createConversation = async (initialQuestion?: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/copilot/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: initialQuestion ? initialQuestion.slice(0, 60) : "Nieuw gesprek",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newConvo = data.conversation;
        setConversations((prev) => [newConvo, ...prev]);
        setActiveConversationId(newConvo.id);
        setMessages([]);
        if (initialQuestion) {
          setTimeout(() => sendMessage(newConvo.id, initialQuestion), 100);
        }
      } else {
        toast.error("Gesprek aanmaken mislukt");
      }
    } catch {
      toast.error("Fout bij aanmaken gesprek");
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/copilot/conversations/${conversationId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));
        if (activeConversationId === conversationId) {
          const remaining = conversations.filter((c) => c.id !== conversationId);
          setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
          setMessages([]);
        }
        toast.success("Gesprek verwijderd");
      } else {
        toast.error("Verwijderen mislukt");
      }
    } catch {
      toast.error("Fout bij verwijderen");
    }
  };

  const sendMessage = async (conversationId?: string, content?: string) => {
    const targetConversationId = conversationId || activeConversationId;
    const messageContent = content || inputValue.trim();
    if (!messageContent || !targetConversationId) return;

    setInputValue("");
    setIsSending(true);

    // Optimistically add user message
    const tempUserMsg: CopilotMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: messageContent,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`/api/projects/${projectId}/copilot/conversations/${targetConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageContent }),
      });

      if (res.ok) {
        const data = await res.json();
        // Replace temp message and add assistant response
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== tempUserMsg.id);
          return [...filtered, ...(data.messages || [])];
        });
      } else {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
        toast.error("Bericht versturen mislukt");
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      toast.error("Fout bij versturen bericht");
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleQuickQuestion = (questionType: string) => {
    const fullQuestion = QUESTION_FULL_LABELS[questionType] || questionType;
    if (!activeConversationId) {
      createConversation(fullQuestion);
    } else {
      sendMessage(activeConversationId, fullQuestion);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleCitations = (messageId: string) => {
    setExpandedCitations((prev) => ({ ...prev, [messageId]: !prev[messageId] }));
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-[calc(100vh-4rem)]"
    >
      {/* Sidebar - Conversations List */}
      <div
        className={`${
          sidebarOpen ? "w-72" : "w-0"
        } transition-all duration-300 overflow-hidden border-r bg-card flex-shrink-0`}
      >
        <div className="w-72 h-full flex flex-col">
          <div className="p-4 border-b">
            <Button
              className="w-full"
              onClick={() => createConversation()}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nieuw gesprek
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {conversations.map((convo) => (
                <div
                  key={convo.id}
                  className={`group flex items-center gap-2 p-2.5 rounded-md cursor-pointer transition-colors ${
                    activeConversationId === convo.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => {
                    setActiveConversationId(convo.id);
                    setSidebarOpen(false);
                  }}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{convo.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(convo.updatedAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteDialogId(convo.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {conversations.length === 0 && !isLoading && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nog geen gesprekken
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b bg-card">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/projects/${projectId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              SEO Copilot
            </h1>
            <p className="text-xs text-muted-foreground">
              Stel vragen over je SEO-project en krijg AI-ondersteunde antwoorden
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => createConversation()}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nieuw
          </Button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {!activeConversationId ? (
            // Welcome screen with quick questions
            <div className="flex flex-col items-center justify-center h-full p-6">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center mb-8"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold mb-2">
                  Welkom bij de SEO Copilot
                </h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Stel een vraag of kies een van de onderstaande snelle vragen om te beginnen.
                  De copilot analyseert je projectgegevens en geeft onderbouwde antwoorden.
                </p>
              </motion.div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 max-w-3xl w-full">
                {QUICK_QUESTIONS.map((q) => (
                  <motion.button
                    key={q.type}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="p-3 rounded-lg border bg-card hover:bg-muted/50 text-left transition-colors"
                    onClick={() => handleQuickQuestion(q.type)}
                  >
                    <span className="text-sm font-medium">{q.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : messages.length === 0 ? (
            // Empty conversation
            <div className="flex flex-col items-center justify-center h-full p-6">
              <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-2">Nieuw gesprek</h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                Stel je eerste vraag of kies een snelle vraag hieronder.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
                {QUICK_QUESTIONS.map((q) => (
                  <Button
                    key={q.type}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleQuickQuestion(q.type)}
                  >
                    {q.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            // Message list
            <div className="p-4 space-y-4">
              <AnimatePresence>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex gap-3 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className="max-w-[75%]">
                      <div
                        className={`rounded-2xl px-4 py-3 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted rounded-bl-md"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>

                      {/* Warning badge */}
                      {msg.hasWarning && msg.warningType && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            {WARNING_LABELS[msg.warningType] || msg.warningType}
                          </span>
                        </div>
                      )}

                      {/* Citations */}
                      {msg.citations && msg.citations.length > 0 && (
                        <Collapsible
                          open={expandedCitations[msg.id]}
                          onOpenChange={() => toggleCitations(msg.id)}
                          className="mt-2"
                        >
                          <CollapsibleTrigger asChild>
                            <button className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                              <Hash className="h-3 w-3" />
                              {msg.citations.length} bron{msg.citations.length > 1 ? "nen" : ""}
                              {expandedCitations[msg.id] ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="mt-1.5 space-y-1.5">
                              {msg.citations.map((citation, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-start gap-2 p-2 rounded-md bg-background border text-xs"
                                >
                                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <Badge variant="secondary" className="text-[10px] h-4">
                                        {citation.recordType}
                                      </Badge>
                                      {citation.url && (
                                        <a
                                          href={citation.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary hover:underline"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      )}
                                    </div>
                                    <p className="text-muted-foreground mt-0.5 line-clamp-2">
                                      {citation.snippet}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {/* Tools used */}
                      {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            Tools: {msg.toolsUsed.map((t) => t.tool).join(", ")}
                          </span>
                        </div>
                      )}

                      {/* Timestamp */}
                      <p
                        className={`text-[10px] text-muted-foreground mt-1 ${
                          msg.role === "user" ? "text-right" : "text-left"
                        }`}
                      >
                        {formatTime(msg.createdAt)}
                        {msg.modelUsed && (
                          <span className="ml-2 opacity-60">({msg.modelUsed})</span>
                        )}
                      </p>
                    </div>

                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Sending indicator */}
              {isSending && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Aan het denken...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Quick Questions Bar (shown when in conversation) */}
        {activeConversationId && messages.length > 0 && (
          <div className="border-t px-4 py-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {QUICK_QUESTIONS.map((q) => (
                <Button
                  key={q.type}
                  variant="ghost"
                  size="sm"
                  className="text-xs whitespace-nowrap shrink-0 h-7"
                  onClick={() => handleQuickQuestion(q.type)}
                  disabled={isSending}
                >
                  {q.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t p-4 bg-card">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Stel een vraag over je SEO-project..."
              disabled={isSending || !activeConversationId}
              className="flex-1"
            />
            <Button
              onClick={() => sendMessage()}
              disabled={isSending || !inputValue.trim() || !activeConversationId}
              size="icon"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          {!activeConversationId && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Start een nieuw gesprek om te beginnen
            </p>
          )}
        </div>
      </div>

      {/* Delete Conversation Dialog */}
      <Dialog
        open={deleteDialogId !== null}
        onOpenChange={() => setDeleteDialogId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gesprek verwijderen</DialogTitle>
            <DialogDescription>
              Weet je zeker dat je dit gesprek wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogId(null)}>
              Annuleren
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteDialogId) deleteConversation(deleteDialogId);
                setDeleteDialogId(null);
              }}
            >
              Verwijderen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
