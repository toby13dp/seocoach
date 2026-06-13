"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Star,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  XCircle,
  Send,
  Edit3,
  Eye,
  Clock,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  FileText,
  Shield,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

// --- Types ---
interface ReviewResponse {
  id: string;
  projectId: string;
  reviewId: string;
  content: string;
  status: string;
  submittedBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  publishedAt: string | null;
  publishError: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ReviewDetail {
  id: string;
  projectId: string;
  locationId: string | null;
  source: string;
  externalId: string | null;
  sourceUrl: string | null;
  authorName: string | null;
  authorAvatar: string | null;
  isVerified: boolean;
  rating: number;
  title: string | null;
  content: string | null;
  sentiment: string;
  sentimentScore: number | null;
  themes: string[] | null;
  complaints: string[] | null;
  compliments: string[] | null;
  productIssues: string[] | null;
  serviceIssues: string[] | null;
  faqOpportunities: string[] | null;
  contentOpportunities: string[] | null;
  trustSignals: string[] | null;
  language: string | null;
  reviewDate: string | null;
  responseDraftId: string | null;
  responseDraft: ReviewResponse | null;
  responses: ReviewResponse[];
  importBatch: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  location?: { id: string; name: string; city: string | null } | null;
}

// --- Dutch Labels ---
const SOURCE_LABELS: Record<string, string> = {
  GOOGLE: "Google",
  WOOCOMMERCE: "WooCommerce",
  TRUSTPILOT: "Trustpilot",
  CSV_IMPORT: "CSV-import",
  SURVEY: "Enquête",
  SUPPORT_FEEDBACK: "Klantenservice-feedback",
  MANUAL: "Handmatig",
};

const SOURCE_COLORS: Record<string, string> = {
  GOOGLE: "bg-blue-100 text-blue-800 border-blue-200",
  WOOCOMMERCE: "bg-purple-100 text-purple-800 border-purple-200",
  TRUSTPILOT: "bg-green-100 text-green-800 border-green-200",
  CSV_IMPORT: "bg-gray-100 text-gray-800 border-gray-200",
  SURVEY: "bg-teal-100 text-teal-800 border-teal-200",
  SUPPORT_FEEDBACK: "bg-orange-100 text-orange-800 border-orange-200",
  MANUAL: "bg-slate-100 text-slate-800 border-slate-200",
};

const SENTIMENT_LABELS: Record<string, string> = {
  POSITIVE: "Positief",
  NEUTRAL: "Neutraal",
  NEGATIVE: "Negatief",
  MIXED: "Gemengd",
};

const SENTIMENT_COLORS: Record<string, string> = {
  POSITIVE: "bg-green-100 text-green-800 border-green-200",
  NEUTRAL: "bg-gray-100 text-gray-800 border-gray-200",
  NEGATIVE: "bg-red-100 text-red-800 border-red-200",
  MIXED: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

const RESPONSE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Concept",
  PENDING_APPROVAL: "Wacht op goedkeuring",
  APPROVED: "Goedgekeurd",
  REJECTED: "Afgewezen",
  PUBLISHED: "Gepubliceerd",
};

const RESPONSE_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800 border-gray-200",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-800 border-yellow-200",
  APPROVED: "bg-green-100 text-green-800 border-green-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  PUBLISHED: "bg-blue-100 text-blue-800 border-blue-200",
};

// --- Star Display Component ---
function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={
            star <= Math.round(rating)
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-300"
          }
        />
      ))}
    </div>
  );
}

// --- Sentiment Gauge ---
function SentimentGauge({ score }: { score: number | null }) {
  if (score === null) return null;
  // score is -1 to 1, normalize to 0-100 for progress
  const percentage = ((score + 1) / 2) * 100;
  const color =
    score > 0.2
      ? "text-green-600"
      : score < -0.2
        ? "text-red-600"
        : "text-yellow-600";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Sentimentscore</span>
        <span className={`text-sm font-bold ${color}`}>
          {score.toFixed(2)}
        </span>
      </div>
      <div className="relative">
        <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${percentage}%`,
              background:
                score > 0.2
                  ? "linear-gradient(90deg, #fbbf24, #22c55e)"
                  : score < -0.2
                    ? "linear-gradient(90deg, #ef4444, #fbbf24)"
                    : "linear-gradient(90deg, #eab308, #fbbf24)",
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-red-500">-1</span>
          <span className="text-xs text-yellow-500">0</span>
          <span className="text-xs text-green-500">+1</span>
        </div>
      </div>
    </div>
  );
}

export default function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string; reviewId: string }>;
}) {
  const { id, reviewId } = use(params);
  const router = useRouter();

  // --- State ---
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Response editing
  const [editedContent, setEditedContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  // --- Fetch Data ---
  const fetchReview = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/reviews/${reviewId}`);
      if (res.ok) {
        const data = await res.json();
        const reviewData = data.data || data;
        setReview(reviewData);
        if (reviewData?.responseDraft?.content) {
          setEditedContent(reviewData.responseDraft.content);
        }
      } else {
        toast.error("Beoordeling niet gevonden");
        router.push(`/projects/${id}/reviews`);
      }
    } catch {
      toast.error("Fout bij ophalen beoordeling");
    } finally {
      setIsLoading(false);
    }
  }, [id, reviewId, router]);

  useEffect(() => {
    fetchReview();
  }, [fetchReview]);

  // --- Handlers ---
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch(`/api/projects/${id}/reviews/${reviewId}/analyze`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Analyse gestart");
        fetchReview();
      } else {
        toast.error("Fout bij analyseren");
      }
    } catch {
      toast.error("Fout bij analyseren");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateResponse = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/projects/${id}/reviews/${reviewId}/response`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Reactie gegenereerd");
        fetchReview();
      } else {
        toast.error("Fout bij genereren reactie");
      }
    } catch {
      toast.error("Fout bij genereren reactie");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditAndSave = async () => {
    if (!review?.responseDraft) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/projects/${id}/reviews/responses/${review.responseDraft.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editedContent }),
        }
      );
      if (res.ok) {
        toast.success("Reactie bijgewerkt");
        setIsEditing(false);
        fetchReview();
      } else {
        toast.error("Fout bij bijwerken");
      }
    } catch {
      toast.error("Fout bij bijwerken");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!review?.responseDraft) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/projects/${id}/reviews/responses/${review.responseDraft.id}/submit`,
        { method: "POST" }
      );
      if (res.ok) {
        toast.success("Reactie ingediend ter goedkeuring");
        fetchReview();
      } else {
        toast.error("Fout bij indienen");
      }
    } catch {
      toast.error("Fout bij indienen");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!review?.responseDraft) return;
    setIsApproving(true);
    try {
      const res = await fetch(
        `/api/projects/${id}/reviews/responses/${review.responseDraft.id}/approve`,
        { method: "POST" }
      );
      if (res.ok) {
        toast.success("Reactie goedgekeurd");
        fetchReview();
      } else {
        toast.error("Fout bij goedkeuren");
      }
    } catch {
      toast.error("Fout bij goedkeuren");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!review?.responseDraft) return;
    setIsRejecting(true);
    try {
      const res = await fetch(
        `/api/projects/${id}/reviews/responses/${review.responseDraft.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rejectionReason }),
        }
      );
      if (res.ok) {
        toast.success("Reactie afgewezen");
        setShowRejectDialog(false);
        setRejectionReason("");
        fetchReview();
      } else {
        toast.error("Fout bij afwijzen");
      }
    } catch {
      toast.error("Fout bij afwijzen");
    } finally {
      setIsRejecting(false);
    }
  };

  const handlePublish = async () => {
    if (!review?.responseDraft) return;
    setIsPublishing(true);
    try {
      const res = await fetch(
        `/api/projects/${id}/reviews/responses/${review.responseDraft.id}/publish`,
        { method: "POST" }
      );
      if (res.ok) {
        toast.success("Reactie gepubliceerd");
        fetchReview();
      } else {
        toast.error("Fout bij publiceren");
      }
    } catch {
      toast.error("Fout bij publiceren");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleResubmitAfterRejection = async () => {
    if (!review?.responseDraft) return;
    setIsSubmitting(true);
    try {
      // First save edited content
      const patchRes = await fetch(
        `/api/projects/${id}/reviews/responses/${review.responseDraft.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editedContent }),
        }
      );
      if (!patchRes.ok) {
        toast.error("Fout bij bijwerken");
        return;
      }

      // Then submit for approval
      const res = await fetch(
        `/api/projects/${id}/reviews/responses/${review.responseDraft.id}/submit`,
        { method: "POST" }
      );
      if (res.ok) {
        toast.success("Reactie opnieuw ingediend ter goedkeuring");
        setIsEditing(false);
        fetchReview();
      } else {
        toast.error("Fout bij indienen");
      }
    } catch {
      toast.error("Fout bij indienen");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render Helpers ---
  const hasAnalysis = review
    ? review.sentimentScore !== null ||
      (review.themes && review.themes.length > 0) ||
      (review.compliments && review.compliments.length > 0) ||
      (review.complaints && review.complaints.length > 0)
    : false;

  // --- Render ---
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Beoordeling niet gevonden</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push(`/projects/${id}/reviews`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Terug naar beoordelingen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-start gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/projects/${id}/reviews`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1 className="text-xl font-bold tracking-tight truncate">
                  {review.authorName || "Anoniem"}
                </h1>
                {review.isVerified && (
                  <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                )}
                <Badge
                  variant="outline"
                  className={`text-xs ${SOURCE_COLORS[review.source] || ""}`}
                >
                  {SOURCE_LABELS[review.source] || review.source}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-xs ${SENTIMENT_COLORS[review.sentiment] || ""}`}
                >
                  {SENTIMENT_LABELS[review.sentiment] || review.sentiment}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <StarRating rating={review.rating} size={14} />
                  <span>{review.rating.toFixed(1)}/5</span>
                </div>
                <span>•</span>
                <span>
                  {review.reviewDate
                    ? new Date(review.reviewDate).toLocaleDateString("nl-NL", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : new Date(review.createdAt).toLocaleDateString("nl-NL", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                </span>
                {review.location && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {review.location.name}
                    </span>
                  </>
                )}
              </div>
              {review.sourceUrl && (
                <a
                  href={review.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Bekijk origineel
                </a>
              )}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column — Review Content & Analysis */}
          <div className="lg:col-span-2 space-y-6">
            {/* Review Content Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Beoordeling</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {review.title && (
                    <h3 className="font-semibold">{review.title}</h3>
                  )}
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {review.content || "Geen inhoud beschikbaar"}
                  </p>
                  {!hasAnalysis && (
                    <Button
                      variant="outline"
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="gap-2"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Analyseer beoordeling
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Sentiment Analysis Card */}
            {hasAnalysis && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Sentimentanalyse
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Sentiment Score Gauge */}
                    {review.sentimentScore !== null && (
                      <SentimentGauge score={review.sentimentScore} />
                    )}

                    {/* Themes */}
                    {review.themes && review.themes.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          Thema&apos;s
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {review.themes.map((theme) => (
                            <Badge key={theme} variant="secondary">
                              {theme}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Complaints */}
                    {review.complaints && review.complaints.length > 0 && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5 text-red-800">
                          <ThumbsDown className="h-4 w-4" />
                          Klachten
                        </h4>
                        <ul className="space-y-1">
                          {review.complaints.map((item, i) => (
                            <li
                              key={i}
                              className="text-sm text-red-700 flex items-start gap-2"
                            >
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Compliments */}
                    {review.compliments && review.compliments.length > 0 && (
                      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5 text-green-800">
                          <ThumbsUp className="h-4 w-4" />
                          Complimenten
                        </h4>
                        <ul className="space-y-1">
                          {review.compliments.map((item, i) => (
                            <li
                              key={i}
                              className="text-sm text-green-700 flex items-start gap-2"
                            >
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Product Issues */}
                    {review.productIssues && review.productIssues.length > 0 && (
                      <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5 text-orange-800">
                          <AlertTriangle className="h-4 w-4" />
                          Productproblemen
                        </h4>
                        <ul className="space-y-1">
                          {review.productIssues.map((item, i) => (
                            <li
                              key={i}
                              className="text-sm text-orange-700 flex items-start gap-2"
                            >
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Service Issues */}
                    {review.serviceIssues && review.serviceIssues.length > 0 && (
                      <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5 text-orange-800">
                          <AlertTriangle className="h-4 w-4" />
                          Serviceproblemen
                        </h4>
                        <ul className="space-y-1">
                          {review.serviceIssues.map((item, i) => (
                            <li
                              key={i}
                              className="text-sm text-orange-700 flex items-start gap-2"
                            >
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* FAQ Opportunities */}
                    {review.faqOpportunities &&
                      review.faqOpportunities.length > 0 && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5 text-blue-800">
                            <HelpCircle className="h-4 w-4" />
                            FAQ-kansen
                          </h4>
                          <ul className="space-y-1">
                            {review.faqOpportunities.map((item, i) => (
                              <li
                                key={i}
                                className="text-sm text-blue-700 flex items-start gap-2"
                              >
                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {/* Content Opportunities */}
                    {review.contentOpportunities &&
                      review.contentOpportunities.length > 0 && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5 text-blue-800">
                            <FileText className="h-4 w-4" />
                            Contentkansen
                          </h4>
                          <ul className="space-y-1">
                            {review.contentOpportunities.map((item, i) => (
                              <li
                                key={i}
                                className="text-sm text-blue-700 flex items-start gap-2"
                              >
                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {/* Trust Signals */}
                    {review.trustSignals && review.trustSignals.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          Vertrouwenssignalen
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {review.trustSignals.map((signal) => (
                            <Badge
                              key={signal}
                              variant="outline"
                              className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200"
                            >
                              <Shield className="h-3 w-3 mr-1" />
                              {signal}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Right Column — Response Workflow */}
          <div className="space-y-6">
            {/* Response Workflow Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Reactie
                  </CardTitle>
                  {review.responseDraft && (
                    <Badge
                      variant="outline"
                      className={`w-fit ${RESPONSE_STATUS_COLORS[review.responseDraft.status] || ""}`}
                    >
                      {RESPONSE_STATUS_LABELS[review.responseDraft.status] ||
                        review.responseDraft.status}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* No response yet */}
                  {!review.responseDraft && (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground mb-4">
                        Nog geen reactie opgesteld
                      </p>
                      <Button
                        onClick={handleGenerateResponse}
                        disabled={isGenerating}
                        className="gap-2"
                      >
                        {isGenerating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        Genereer reactie
                      </Button>
                    </div>
                  )}

                  {/* DRAFT */}
                  {review.responseDraft &&
                    review.responseDraft.status === "DRAFT" && (
                      <div className="space-y-4">
                        {/* Workflow step indicator */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium text-primary">
                            <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                              1
                            </span>
                            Concept
                          </span>
                          <span>→</span>
                          <span>Wacht op goedkeuring</span>
                          <span>→</span>
                          <span>Goedgekeurd</span>
                          <span>→</span>
                          <span>Gepubliceerd</span>
                        </div>

                        {isEditing ? (
                          <div className="space-y-3">
                            <Textarea
                              value={editedContent}
                              onChange={(e) => setEditedContent(e.target.value)}
                              rows={8}
                              className="text-sm"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={handleEditAndSave}
                                disabled={isSubmitting}
                                className="gap-1.5"
                              >
                                {isSubmitting ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                )}
                                Opslaan
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setIsEditing(false);
                                  setEditedContent(
                                    review.responseDraft?.content || ""
                                  );
                                }}
                              >
                                Annuleren
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="rounded-lg border p-3 text-sm bg-muted/50 whitespace-pre-wrap">
                              {review.responseDraft.content}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={handleSubmitForApproval}
                                disabled={isSubmitting}
                                className="gap-1.5"
                              >
                                {isSubmitting ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Send className="h-3.5 w-3.5" />
                                )}
                                Dien in ter goedkeuring
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditedContent(
                                    review.responseDraft?.content || ""
                                  );
                                  setIsEditing(true);
                                }}
                                className="gap-1.5"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                Bewerk
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  {/* PENDING_APPROVAL */}
                  {review.responseDraft &&
                    review.responseDraft.status === "PENDING_APPROVAL" && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Concept</span>
                          <span>→</span>
                          <span className="flex items-center gap-1 font-medium text-yellow-600">
                            <span className="h-5 w-5 rounded-full bg-yellow-500 text-white text-xs flex items-center justify-center">
                              2
                            </span>
                            Wacht op goedkeuring
                          </span>
                          <span>→</span>
                          <span>Goedgekeurd</span>
                          <span>→</span>
                          <span>Gepubliceerd</span>
                        </div>

                        <div className="rounded-lg border p-3 text-sm bg-muted/50 whitespace-pre-wrap">
                          {review.responseDraft.content}
                        </div>
                        {review.responseDraft.submittedBy && (
                          <p className="text-xs text-muted-foreground">
                            Ingediend door: {review.responseDraft.submittedBy}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleApprove}
                            disabled={isApproving}
                            className="gap-1.5"
                          >
                            {isApproving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            Keur goed
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setShowRejectDialog(true)}
                            disabled={isRejecting}
                            className="gap-1.5"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Wijs af
                          </Button>
                        </div>
                      </div>
                    )}

                  {/* APPROVED */}
                  {review.responseDraft &&
                    review.responseDraft.status === "APPROVED" && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Concept</span>
                          <span>→</span>
                          <span>Wacht op goedkeuring</span>
                          <span>→</span>
                          <span className="flex items-center gap-1 font-medium text-green-600">
                            <span className="h-5 w-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center">
                              3
                            </span>
                            Goedgekeurd
                          </span>
                          <span>→</span>
                          <span>Gepubliceerd</span>
                        </div>

                        <div className="rounded-lg border p-3 text-sm bg-muted/50 whitespace-pre-wrap">
                          {review.responseDraft.content}
                        </div>
                        {review.responseDraft.reviewedBy && (
                          <p className="text-xs text-muted-foreground">
                            Goedgekeurd door:{" "}
                            {review.responseDraft.reviewedBy}
                          </p>
                        )}
                        <Button
                          size="sm"
                          onClick={handlePublish}
                          disabled={isPublishing}
                          className="gap-1.5 w-full"
                        >
                          {isPublishing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          Publiceer
                        </Button>
                      </div>
                    )}

                  {/* REJECTED */}
                  {review.responseDraft &&
                    review.responseDraft.status === "REJECTED" && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Concept</span>
                          <span>→</span>
                          <span>Wacht op goedkeuring</span>
                          <span>→</span>
                          <span className="flex items-center gap-1 font-medium text-red-600">
                            <XCircle className="h-4 w-4" />
                            Afgewezen
                          </span>
                          <span>→</span>
                          <span>Opnieuw indienen</span>
                        </div>

                        <div className="rounded-lg border p-3 text-sm bg-muted/50 whitespace-pre-wrap">
                          {review.responseDraft.content}
                        </div>
                        {review.responseDraft.rejectionReason && (
                          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                            <p className="text-xs font-medium text-red-800 mb-1">
                              Afwijzingsreden:
                            </p>
                            <p className="text-sm text-red-700">
                              {review.responseDraft.rejectionReason}
                            </p>
                          </div>
                        )}
                        {review.responseDraft.reviewedBy && (
                          <p className="text-xs text-muted-foreground">
                            Afgewezen door:{" "}
                            {review.responseDraft.reviewedBy}
                          </p>
                        )}

                        {isEditing ? (
                          <div className="space-y-3">
                            <Textarea
                              value={editedContent}
                              onChange={(e) => setEditedContent(e.target.value)}
                              rows={8}
                              className="text-sm"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={handleResubmitAfterRejection}
                                disabled={isSubmitting}
                                className="gap-1.5"
                              >
                                {isSubmitting ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Send className="h-3.5 w-3.5" />
                                )}
                                Dien opnieuw in
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setIsEditing(false);
                                  setEditedContent(
                                    review.responseDraft?.content || ""
                                  );
                                }}
                              >
                                Annuleren
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditedContent(
                                review.responseDraft?.content || ""
                              );
                              setIsEditing(true);
                            }}
                            className="gap-1.5 w-full"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Bewerk en dien opnieuw in
                          </Button>
                        )}
                      </div>
                    )}

                  {/* PUBLISHED */}
                  {review.responseDraft &&
                    review.responseDraft.status === "PUBLISHED" && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Concept</span>
                          <span>→</span>
                          <span>Wacht op goedkeuring</span>
                          <span>→</span>
                          <span>Goedgekeurd</span>
                          <span>→</span>
                          <span className="flex items-center gap-1 font-medium text-blue-600">
                            <CheckCircle2 className="h-4 w-4" />
                            Gepubliceerd
                          </span>
                        </div>

                        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm whitespace-pre-wrap">
                          {review.responseDraft.content}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-green-700">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>
                            Gepubliceerd op{" "}
                            {review.responseDraft.publishedAt
                              ? new Date(
                                  review.responseDraft.publishedAt
                                ).toLocaleDateString("nl-NL", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "onbekend"}
                          </span>
                        </div>
                        {review.responseDraft.publishError && (
                          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                            <p className="text-sm text-red-700">
                              {review.responseDraft.publishError}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Response History Card */}
            {review.responses && review.responses.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      Reactiegeschiedenis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                      {review.responses.map((response) => (
                        <div
                          key={response.id}
                          className="border rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <Badge
                              variant="outline"
                              className={`text-xs ${RESPONSE_STATUS_COLORS[response.status] || ""}`}
                            >
                              {RESPONSE_STATUS_LABELS[response.status] ||
                                response.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(response.createdAt).toLocaleDateString(
                                "nl-NL",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                          </div>
                          <p className="text-sm line-clamp-3 whitespace-pre-wrap">
                            {response.content}
                          </p>
                          {response.rejectionReason && (
                            <p className="text-xs text-red-600">
                              Reden: {response.rejectionReason}
                            </p>
                          )}
                          {response.reviewedBy && (
                            <p className="text-xs text-muted-foreground">
                              Beoordeeld door: {response.reviewedBy}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Quick Info Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">
                    Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Bron</span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${SOURCE_COLORS[review.source] || ""}`}
                    >
                      {SOURCE_LABELS[review.source] || review.source}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Beoordeling</span>
                    <div className="flex items-center gap-1">
                      <StarRating rating={review.rating} size={12} />
                      <span className="text-xs">{review.rating.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Sentiment</span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${SENTIMENT_COLORS[review.sentiment] || ""}`}
                    >
                      {SENTIMENT_LABELS[review.sentiment] || review.sentiment}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Geverifieerd</span>
                    <span className="text-xs">
                      {review.isVerified ? "Ja" : "Nee"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Taal</span>
                    <span className="text-xs">
                      {review.language === "nl"
                        ? "Nederlands"
                        : review.language === "en"
                          ? "Engels"
                          : review.language || "Onbekend"}
                    </span>
                  </div>
                  {review.externalId && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Extern ID
                      </span>
                      <span className="text-xs font-mono">
                        {review.externalId}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Aangemaakt</span>
                    <span className="text-xs">
                      {new Date(review.createdAt).toLocaleDateString("nl-NL")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reactie afwijzen</DialogTitle>
            <DialogDescription>
              Geef een reden voor de afwijzing. Deze wordt getoond aan de
              auteur van de reactie.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rejection-reason">Afwijzingsreden</Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Waarom wordt deze reactie afgewezen?"
              rows={4}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
            >
              Annuleren
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isRejecting || !rejectionReason.trim()}
            >
              {isRejecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Wijs af
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
