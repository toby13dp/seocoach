// ============================================================================
// Reviews & Reputation — Review Manager
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// CRUD operations and querying for reviews, including summary statistics
// and sentiment analysis integration. All functions verify projectId for
// tenant isolation. All user-facing text is in Dutch.
// ============================================================================

import { ReviewSource, ReviewSentiment } from '@prisma/client';
import { db } from '@/lib/db';
import { analyzeSentiment } from './sentiment-analyzer';
import type { ReviewSummary } from './types';

// ============================================================================
// List Reviews
// ============================================================================

/**
 * List reviews for a project with flexible filtering and pagination.
 *
 * @param projectId - The project to query reviews for
 * @param filters - Optional filters for location, source, sentiment, rating, dates, search, etc.
 * @returns Paginated list of reviews and total count
 */
export async function listReviews(
  projectId: string,
  filters?: {
    locationId?: string;
    source?: ReviewSource;
    sentiment?: ReviewSentiment;
    minRating?: number;
    maxRating?: number;
    startDate?: Date;
    endDate?: Date;
    hasResponse?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ reviews: Awaited<ReturnType<typeof db.review.findMany>>; total: number }> {
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    projectId,
    deletedAt: null,
  };

  if (filters?.locationId) {
    where.locationId = filters.locationId;
  }
  if (filters?.source) {
    where.source = filters.source;
  }
  if (filters?.sentiment) {
    where.sentiment = filters.sentiment;
  }
  if (filters?.minRating !== undefined || filters?.maxRating !== undefined) {
    where.rating = {};
    if (filters?.minRating !== undefined) {
      where.rating.gte = filters.minRating;
    }
    if (filters?.maxRating !== undefined) {
      where.rating.lte = filters.maxRating;
    }
  }
  if (filters?.startDate || filters?.endDate) {
    where.reviewDate = {};
    if (filters?.startDate) {
      where.reviewDate.gte = filters.startDate;
    }
    if (filters?.endDate) {
      where.reviewDate.lte = filters.endDate;
    }
  }
  if (filters?.hasResponse === true) {
    where.responseDraftId = { not: null };
  } else if (filters?.hasResponse === false) {
    where.responseDraftId = null;
  }
  if (filters?.search) {
    const searchTerm = filters.search.trim();
    if (searchTerm.length > 0) {
      where.OR = [
        { content: { contains: searchTerm } },
        { title: { contains: searchTerm } },
        { authorName: { contains: searchTerm } },
      ];
    }
  }

  const [reviews, total] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { reviewDate: 'desc' },
      take: limit,
      skip: offset,
      include: {
        responseDraft: true,
        _count: {
          select: { responses: true },
        },
      },
    }),
    db.review.count({ where }),
  ]);

  return { reviews, total };
}

// ============================================================================
// Get Review
// ============================================================================

/**
 * Get a single review with full details.
 * Verifies that the review belongs to the specified project for tenant isolation.
 *
 * @param reviewId - The review ID
 * @param projectId - The project ID for tenant isolation
 * @returns The review with responses, or null if not found
 */
export async function getReview(reviewId: string, projectId: string) {
  return db.review.findFirst({
    where: {
      id: reviewId,
      projectId,
      deletedAt: null,
    },
    include: {
      responseDraft: true,
      responses: {
        orderBy: { createdAt: 'desc' },
      },
      location: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

// ============================================================================
// Review Summary Statistics
// ============================================================================

/**
 * Get aggregated review summary statistics for a project.
 * Includes rating distribution, sentiment distribution, top themes,
 * complaints, compliments, response rate, and average response time.
 *
 * @param projectId - The project to summarize reviews for
 * @param locationId - Optional location filter
 * @returns Review summary statistics
 */
export async function getReviewSummary(
  projectId: string,
  locationId?: string
): Promise<ReviewSummary> {
  // Build base where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    projectId,
    deletedAt: null,
  };
  if (locationId) {
    where.locationId = locationId;
  }

  // Get all reviews for aggregation
  const reviews = await db.review.findMany({
    where,
    select: {
      rating: true,
      sentiment: true,
      themes: true,
      complaints: true,
      compliments: true,
      responseDraftId: true,
      reviewDate: true,
      createdAt: true,
      responses: {
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  });

  const totalReviews = reviews.length;

  // Default empty summary
  if (totalReviews === 0) {
    return {
      totalReviews: 0,
      avgRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      sentimentDistribution: {
        POSITIVE: 0,
        NEUTRAL: 0,
        NEGATIVE: 0,
        MIXED: 0,
      },
      topThemes: [],
      topComplaints: [],
      topCompliments: [],
      responseRate: 0,
      avgResponseTimeHours: null,
    };
  }

  // Average rating
  const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
  const avgRating = Math.round((totalRating / totalReviews) * 100) / 100;

  // Rating distribution
  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const review of reviews) {
    const roundedRating = Math.round(review.rating);
    if (roundedRating >= 1 && roundedRating <= 5) {
      ratingDistribution[roundedRating]++;
    }
  }

  // Sentiment distribution
  const sentimentDistribution: Record<ReviewSentiment, number> = {
    POSITIVE: 0,
    NEUTRAL: 0,
    NEGATIVE: 0,
    MIXED: 0,
  };
  for (const review of reviews) {
    sentimentDistribution[review.sentiment as ReviewSentiment]++;
  }

  // Top themes (from JSON arrays)
  const themeCounts: Record<string, number> = {};
  for (const review of reviews) {
    if (review.themes) {
      try {
        const themes: string[] = JSON.parse(review.themes);
        for (const theme of themes) {
          themeCounts[theme] = (themeCounts[theme] ?? 0) + 1;
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }
  const topThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([theme, count]) => ({ theme, count }));

  // Top complaints
  const complaintCounts: Record<string, number> = {};
  for (const review of reviews) {
    if (review.complaints) {
      try {
        const complaints: string[] = JSON.parse(review.complaints);
        for (const complaint of complaints) {
          complaintCounts[complaint] = (complaintCounts[complaint] ?? 0) + 1;
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }
  const topComplaints = Object.entries(complaintCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([complaint]) => complaint);

  // Top compliments
  const complimentCounts: Record<string, number> = {};
  for (const review of reviews) {
    if (review.compliments) {
      try {
        const compliments: string[] = JSON.parse(review.compliments);
        for (const compliment of compliments) {
          complimentCounts[compliment] = (complimentCounts[compliment] ?? 0) + 1;
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }
  const topCompliments = Object.entries(complimentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([compliment]) => compliment);

  // Response rate
  const reviewsWithResponse = reviews.filter(
    (r) => r.responseDraftId !== null || r.responses.length > 0
  );
  const responseRate = reviewsWithResponse.length / totalReviews;

  // Average response time (time between review and first response)
  const responseTimes: number[] = [];
  for (const review of reviews) {
    if (review.responses.length > 0 && review.reviewDate) {
      const responseTime = review.responses[0].createdAt.getTime() - review.reviewDate.getTime();
      const hours = responseTime / (1000 * 60 * 60);
      if (hours >= 0) {
        responseTimes.push(hours);
      }
    }
  }
  const avgResponseTimeHours =
    responseTimes.length > 0
      ? Math.round(
          (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10
        ) / 10
      : null;

  return {
    totalReviews,
    avgRating,
    ratingDistribution,
    sentimentDistribution,
    topThemes,
    topComplaints,
    topCompliments,
    responseRate: Math.round(responseRate * 1000) / 1000,
    avgResponseTimeHours,
  };
}

// ============================================================================
// Sentiment Analysis Integration
// ============================================================================

/**
 * Run sentiment analysis on a review and save the results to the database.
 *
 * @param reviewId - The review ID to analyze
 * @param projectId - The project ID for tenant isolation
 * @returns The updated review with analysis results
 */
export async function analyzeAndSaveReviewSentiment(
  reviewId: string,
  projectId: string
) {
  // Fetch the review
  const review = await db.review.findFirst({
    where: {
      id: reviewId,
      projectId,
      deletedAt: null,
    },
  });

  if (!review) {
    throw new Error(`Review niet gevonden (ID: ${reviewId})`);
  }

  // Run sentiment analysis
  const analysis = analyzeSentiment({
    rating: review.rating,
    content: review.content ?? undefined,
    title: review.title ?? undefined,
  });

  // Save results
  const updated = await db.review.update({
    where: { id: reviewId },
    data: {
      sentiment: analysis.sentiment,
      sentimentScore: analysis.score,
      themes: JSON.stringify(analysis.themes),
      complaints: JSON.stringify(analysis.complaints),
      compliments: JSON.stringify(analysis.compliments),
      productIssues: JSON.stringify(analysis.productIssues),
      serviceIssues: JSON.stringify(analysis.serviceIssues),
      faqOpportunities: JSON.stringify(analysis.faqOpportunities),
      contentOpportunities: JSON.stringify(analysis.contentOpportunities),
      trustSignals: JSON.stringify(analysis.trustSignals),
    },
  });

  return updated;
}

/**
 * Run sentiment analysis on all unanalyzed reviews for a project.
 * A review is considered "unanalyzed" if it has the default NEUTRAL sentiment
 * and a null sentimentScore.
 *
 * @param projectId - The project to analyze reviews for
 * @returns Count of analyzed reviews and any errors
 */
export async function analyzeProjectReviews(
  projectId: string
): Promise<{ analyzed: number; errors: string[] }> {
  // Find reviews that haven't been analyzed yet
  const unanalyzed = await db.review.findMany({
    where: {
      projectId,
      deletedAt: null,
      sentimentScore: null,
    },
    select: { id: true },
  });

  let analyzed = 0;
  const errors: string[] = [];

  for (const review of unanalyzed) {
    try {
      await analyzeAndSaveReviewSentiment(review.id, projectId);
      analyzed++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Fout bij analyseren review ${review.id}: ${msg}`);
    }
  }

  return { analyzed, errors };
}

// ============================================================================
// Soft Delete
// ============================================================================

/**
 * Soft delete a review by setting its deletedAt timestamp.
 * The review will no longer appear in queries but is retained for audit purposes.
 *
 * @param reviewId - The review ID to delete
 * @param projectId - The project ID for tenant isolation
 * @returns The soft-deleted review
 */
export async function deleteReview(reviewId: string, projectId: string) {
  // Verify the review belongs to this project
  const review = await db.review.findFirst({
    where: {
      id: reviewId,
      projectId,
      deletedAt: null,
    },
  });

  if (!review) {
    throw new Error(`Review niet gevonden (ID: ${reviewId})`);
  }

  return db.review.update({
    where: { id: reviewId },
    data: { deletedAt: new Date() },
  });
}
