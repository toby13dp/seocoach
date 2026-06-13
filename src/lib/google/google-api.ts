// ============================================================================
// Google API Client — GSC, GA4, GBP
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Wraps Google API calls for Search Console, Analytics 4, and Business Profile.
// Uses the authenticated OAuth2 client from oauth-client.ts.
// All user-facing messages are in Dutch.
// ============================================================================

import { google } from 'googleapis';
import { getAuthenticatedClient } from './oauth-client';
import { db } from '@/lib/db';
import { appLogger as logger } from '@/lib/observability/logger';

// ============================================================================
// Google Search Console API
// ============================================================================

export interface GSCSearchAnalyticsRow {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  query?: string;
  page?: string;
  country?: string;
  device?: string;
}

export interface GSCSyncResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * Fetch search analytics data from Google Search Console.
 */
export async function fetchGSCSearchAnalytics(
  connectionId: string,
  propertyUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[] = ['date']
): Promise<GSCSearchAnalyticsRow[]> {
  const client = await getAuthenticatedClient(connectionId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const searchconsole = (google as any).searchconsole({ version: 'v1', auth: client });

  let allRows: GSCSearchAnalyticsRow[] = [];
  let startRow = 0;
  const rowLimit = 25000;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await searchconsole.searchanalytics.query({
        siteUrl: propertyUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions,
          rowLimit,
          startRow,
          dataState: 'all',
        },
      });

      const rows = response.data.rows ?? [];

      if (rows.length === 0) {
        hasMore = false;
        break;
      }

      for (const row of rows) {
        const mapped: GSCSearchAnalyticsRow = {
          date: dimensions.includes('date')
            ? (row.keys?.[dimensions.indexOf('date')] ?? startDate)
            : startDate,
          clicks: row.clicks ?? 0,
          impressions: row.impressions ?? 0,
          ctr: row.ctr ?? 0,
          position: row.position ?? 0,
        };

        if (dimensions.includes('query')) {
          mapped.query = row.keys?.[dimensions.indexOf('query')] ?? '(not provided)';
        }
        if (dimensions.includes('page')) {
          mapped.page = row.keys?.[dimensions.indexOf('page')];
        }
        if (dimensions.includes('country')) {
          mapped.country = row.keys?.[dimensions.indexOf('country')];
        }
        if (dimensions.includes('device')) {
          mapped.device = row.keys?.[dimensions.indexOf('device')];
        }

        allRows.push(mapped);
      }

      if (rows.length < rowLimit) {
        hasMore = false;
      } else {
        startRow += rowLimit;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('GSC searchanalytics.query failed', {
        connectionId,
        propertyUrl,
        startRow,
        error: message,
      });
      throw new Error(`GSC API fout: ${message}`);
    }
  }

  logger.info('GSC search analytics fetched', {
    connectionId,
    propertyUrl,
    startDate,
    endDate,
    rows: allRows.length,
  });

  return allRows;
}

/**
 * List available GSC properties for the authenticated user.
 */
export async function listGSCProperties(
  connectionId: string
): Promise<{ siteUrl: string; permissionLevel: string }[]> {
  const client = await getAuthenticatedClient(connectionId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const searchconsole = (google as any).searchconsole({ version: 'v1', auth: client });

  try {
    const response = await searchconsole.sites.list({});

    const sites = response.data.siteEntry ?? [];

    return sites
      .filter((site) => site.permissionLevel !== 'siteUnverifiedUser')
      .map((site) => ({
        siteUrl: site.siteUrl ?? '',
        permissionLevel: site.permissionLevel ?? '',
      }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`GSC properties ophalen mislukt: ${message}`);
  }
}

/**
 * Sync GSC data to the database.
 */
export async function syncGSCData(
  connectionId: string,
  projectId: string,
  propertyUrl: string,
  startDate: string,
  endDate: string
): Promise<GSCSyncResult> {
  const result: GSCSyncResult = { imported: 0, updated: 0, skipped: 0, errors: [] };

  try {
    const dailyRows = await fetchGSCSearchAnalytics(
      connectionId,
      propertyUrl,
      startDate,
      endDate,
      ['date']
    );

    const queryRows = await fetchGSCSearchAnalytics(
      connectionId,
      propertyUrl,
      startDate,
      endDate,
      ['date', 'query']
    ).catch(() => [] as GSCSearchAnalyticsRow[]);

    for (const row of dailyRows) {
      try {
        const existing = await db.dailyMetric.findFirst({
          where: {
            projectId,
            connectionId,
            date: new Date(row.date),
            source: 'google_search_console',
          },
        });

        const metricData = {
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          averagePosition: row.position,
        };

        if (existing) {
          await db.dailyMetric.update({
            where: { id: existing.id },
            data: metricData,
          });
          result.updated++;
        } else {
          await db.dailyMetric.create({
            data: {
              projectId,
              connectionId,
              date: new Date(row.date),
              source: 'google_search_console',
              ...metricData,
            },
          });
          result.imported++;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Rij ${row.date}: ${msg}`);
        result.skipped++;
      }
    }

    for (const row of queryRows) {
      if (!row.query) continue;
      try {
        const existing = await db.queryPerformance.findFirst({
          where: {
            projectId,
            connectionId,
            date: new Date(row.date),
            query: row.query,
          },
        });

        const queryData = {
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        };

        if (existing) {
          await db.queryPerformance.update({
            where: { id: existing.id },
            data: queryData,
          });
        } else {
          await db.queryPerformance.create({
            data: {
              projectId,
              connectionId,
              date: new Date(row.date),
              query: row.query,
              page: row.page,
              country: row.country,
              device: row.device,
              ...queryData,
            },
          });
        }
      } catch {
        // Skip individual query errors
      }
    }

    logger.info('GSC data sync completed', {
      connectionId,
      projectId,
      imported: result.imported,
      updated: result.updated,
      errors: result.errors.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`Sync mislukt: ${message}`);
  }

  return result;
}

// ============================================================================
// Google Analytics 4 API
// ============================================================================

export interface GA4MetricsRow {
  date: string;
  sessions: number;
  users: number;
  newUsers: number;
  pageViews: number;
  bounceRate: number | null;
  avgSessionDuration: number | null;
  conversions?: number;
  conversionRate?: number | null;
  revenue?: number | null;
  source?: string;
  medium?: string;
  campaign?: string;
  device?: string;
  country?: string;
  landingPage?: string;
}

/**
 * Fetch analytics data from Google Analytics 4.
 */
export async function fetchGA4Analytics(
  connectionId: string,
  propertyId: string,
  startDate: string,
  endDate: string,
  dimensions: string[] = ['date']
): Promise<GA4MetricsRow[]> {
  const client = await getAuthenticatedClient(connectionId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const analyticsdata = (google as any).analyticsdata({ version: 'v1beta', auth: client }) as any;

  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;

  const dimensionMappings: Record<string, string> = {
    date: 'date',
    source: 'sessionSource',
    medium: 'sessionMedium',
    campaign: 'sessionCampaign',
    device: 'deviceCategory',
    country: 'country',
    landingPage: 'landingPagePlusQueryString',
  };

  const metricRequests = [
    { name: 'sessions' },
    { name: 'totalUsers' },
    { name: 'newUsers' },
    { name: 'screenPageViews' },
    { name: 'bounceRate' },
    { name: 'averageSessionDuration' },
    { name: 'conversions' },
    { name: 'conversionRate' },
    { name: 'totalRevenue' },
  ];

  try {
    const response = await analyticsdata.properties.runReport({
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: dimensions.map((d) => ({
          name: dimensionMappings[d] ?? d,
        })),
        metrics: metricRequests,
        limit: 100000,
      },
    });

    const rows = response.data.rows ?? [];
    const dimensionHeaders = response.data.dimensionHeaders ?? [];
    const metricHeaders = response.data.metricHeaders ?? [];

    return rows.map((row) => {
      const dimensionValues = row.dimensionValues ?? [];
      const metricValues = row.metricValues ?? [];

      const dimMap: Record<string, string> = {};
      dimensionHeaders.forEach((header, i) => {
        dimMap[header.name ?? ''] = dimensionValues[i]?.value ?? '';
      });

      const metMap: Record<string, string> = {};
      metricHeaders.forEach((header, i) => {
        metMap[header.name ?? ''] = metricValues[i]?.value ?? '0';
      });

      const rawDate = dimMap['date'] ?? startDate;
      const formattedDate = rawDate.length === 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : rawDate;

      return {
        date: formattedDate,
        sessions: parseInt(metMap['sessions'] ?? '0', 10),
        users: parseInt(metMap['totalUsers'] ?? '0', 10),
        newUsers: parseInt(metMap['newUsers'] ?? '0', 10),
        pageViews: parseInt(metMap['screenPageViews'] ?? '0', 10),
        bounceRate: metMap['bounceRate']
          ? parseFloat(metMap['bounceRate'])
          : null,
        avgSessionDuration: metMap['averageSessionDuration']
          ? parseFloat(metMap['averageSessionDuration'])
          : null,
        conversions: metMap['conversions']
          ? parseInt(metMap['conversions'], 10)
          : undefined,
        conversionRate: metMap['conversionRate']
          ? parseFloat(metMap['conversionRate'])
          : undefined,
        revenue: metMap['totalRevenue']
          ? parseFloat(metMap['totalRevenue'])
          : undefined,
        source: dimMap['sessionSource'],
        medium: dimMap['sessionMedium'],
        campaign: dimMap['sessionCampaign'],
        device: dimMap['deviceCategory'],
        country: dimMap['country'],
        landingPage: dimMap['landingPagePlusQueryString'],
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('GA4 runReport failed', {
      connectionId,
      propertyId,
      error: message,
    });
    throw new Error(`GA4 API fout: ${message}`);
  }
}

/**
 * List available GA4 properties for the authenticated user.
 */
export async function listGA4Properties(
  connectionId: string
): Promise<{ propertyId: string; propertyName: string; accountId: string }[]> {
  const client = await getAuthenticatedClient(connectionId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const analyticsadmin = (google as any).analyticsadmin({ version: 'v1beta', auth: client }) as any;

  try {
    const response = await analyticsadmin.properties.list({
      filter: 'parent:accounts/-',
      showDeleted: false,
    });

    const properties = response.data.properties ?? [];

    return properties.map((prop) => ({
      propertyId: prop.name ?? '',
      propertyName: prop.displayName ?? '',
      accountId: prop.parent ?? '',
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`GA4 properties ophalen mislukt: ${message}`);
  }
}

/**
 * Sync GA4 data to the database.
 */
export async function syncGA4Data(
  connectionId: string,
  projectId: string,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<GSCSyncResult> {
  const result: GSCSyncResult = { imported: 0, updated: 0, skipped: 0, errors: [] };

  try {
    const rows = await fetchGA4Analytics(
      connectionId,
      propertyId,
      startDate,
      endDate,
      ['date']
    );

    for (const row of rows) {
      try {
        const existing = await db.dailyMetric.findFirst({
          where: {
            projectId,
            connectionId,
            date: new Date(row.date),
            source: 'google_analytics_4',
          },
        });

        const metricData = {
          sessions: row.sessions,
          users: row.users,
          newUsers: row.newUsers,
          pageViews: row.pageViews,
          bounceRate: row.bounceRate,
          avgSessionDuration: row.avgSessionDuration,
          conversions: row.conversions,
          conversionRate: row.conversionRate,
          revenue: row.revenue,
        };

        if (existing) {
          await db.dailyMetric.update({
            where: { id: existing.id },
            data: metricData,
          });
          result.updated++;
        } else {
          await db.dailyMetric.create({
            data: {
              projectId,
              connectionId,
              date: new Date(row.date),
              source: 'google_analytics_4',
              ...metricData,
            },
          });
          result.imported++;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Rij ${row.date}: ${msg}`);
        result.skipped++;
      }
    }

    logger.info('GA4 data sync completed', {
      connectionId,
      projectId,
      imported: result.imported,
      updated: result.updated,
      errors: result.errors.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`Sync mislukt: ${message}`);
  }

  return result;
}

// ============================================================================
// Google Business Profile API
// ============================================================================

export interface GBPLocationInfo {
  name: string;
  primaryCategory: string;
  categories: string[];
  websiteUrl: string | null;
  phone: string | null;
  address: string | null;
}

export interface GBPReview {
  reviewId: string;
  reviewer: string;
  rating: number;
  comment: string | null;
  reply: string | null;
  createTime: string;
  updateTime: string;
}

/**
 * Fetch business profile information from Google Business Profile.
 */
export async function fetchGBPProfile(
  connectionId: string,
  _accountName: string,
  locationName: string
): Promise<GBPLocationInfo> {
  const client = await getAuthenticatedClient(connectionId);

  try {
    const response = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?readMask=title,categories,websiteUri,phoneNumbers,storefrontAddress`,
      {
        headers: {
          Authorization: `Bearer ${client.credentials.access_token}`,
        },
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GBP profiel ophalen mislukt: ${body}`);
    }

    const data = await response.json();

    return {
      name: data.title ?? '',
      primaryCategory: data.primaryCategory?.displayName ?? '',
      categories: data.categories?.additionalCategories?.map((c: { displayName: string }) => c.displayName ?? '') ?? [],
      websiteUrl: data.websiteUri ?? null,
      phone: data.phoneNumbers?.primaryPhone ?? null,
      address: data.storefrontAddress
        ? [
            data.storefrontAddress.locality,
            data.storefrontAddress.addressLines?.join(' '),
          ].filter(Boolean).join(', ')
        : null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`GBP profiel ophalen mislukt: ${message}`);
  }
}

/**
 * Fetch reviews from Google Business Profile.
 */
export async function fetchGBPReviews(
  connectionId: string,
  _accountName: string,
  locationName: string,
  pageSize: number = 50
): Promise<GBPReview[]> {
  const client = await getAuthenticatedClient(connectionId);

  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationName}/reviews?pageSize=${pageSize}`,
    {
      headers: {
        Authorization: `Bearer ${client.credentials.access_token}`,
      },
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GBP beoordelingen ophalen mislukt: ${body}`);
  }

  const data = await response.json();
  const reviews = data.reviews ?? [];

  const starRatingMap: Record<string, number> = {
    FIVE: 5,
    FOUR: 4,
    THREE: 3,
    TWO: 2,
    ONE: 1,
  };

  return reviews.map((review: Record<string, unknown>) => ({
    reviewId: (review.reviewId as string) ?? '',
    reviewer: (review.reviewer as Record<string, string>)?.displayName ?? 'Anoniem',
    rating: starRatingMap[review.starRating as string] ?? 1,
    comment: (review.comment as string) ?? null,
    reply: (review.reviewReply as Record<string, string>)?.comment ?? null,
    createTime: (review.createTime as string) ?? '',
    updateTime: (review.updateTime as string) ?? '',
  }));
}

/**
 * List available GBP accounts.
 */
export async function listGBPAccounts(
  connectionId: string
): Promise<{ name: string; accountName: string; type: string }[]> {
  const client = await getAuthenticatedClient(connectionId);

  const response = await fetch(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    {
      headers: {
        Authorization: `Bearer ${client.credentials.access_token}`,
      },
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GBP accounts ophalen mislukt: ${body}`);
  }

  const data = await response.json();
  const accounts = data.accounts ?? [];

  return accounts.map((acc: Record<string, unknown>) => ({
    name: (acc.name as string) ?? '',
    accountName: (acc.accountName as string) ?? '',
    type: (acc.type as string) ?? '',
  }));
}

/**
 * List locations for a GBP account.
 */
export async function listGBPLocations(
  connectionId: string,
  accountName: string
): Promise<{ name: string; title: string; storeCode: string | null }[]> {
  const client = await getAuthenticatedClient(connectionId);

  const response = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=title,storeCode`,
    {
      headers: {
        Authorization: `Bearer ${client.credentials.access_token}`,
      },
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GBP locaties ophalen mislukt: ${body}`);
  }

  const data = await response.json();
  const locations = data.locations ?? [];

  return locations.map((loc: Record<string, unknown>) => ({
    name: (loc.name as string) ?? '',
    title: (loc.title as string) ?? '',
    storeCode: (loc.storeCode as string) ?? null,
  }));
}

/**
 * Sync GBP data to the database.
 */
export async function syncGBPDataToDb(
  connectionId: string,
  locationId: string,
  projectId: string,
  accountName: string,
  locationName: string
): Promise<{
  synced: boolean;
  reviewCount: number;
  avgRating: number;
  error?: string;
}> {
  try {
    const profile = await fetchGBPProfile(connectionId, accountName, locationName);

    const reviews = await fetchGBPReviews(connectionId, accountName, locationName).catch(() => [] as GBPReview[]);
    const totalReviews = reviews.length;
    const avgRating = totalReviews > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;

    const existing = await db.googleBusinessProfile.findUnique({
      where: { locationId },
    });

    if (existing) {
      await db.googleBusinessProfile.update({
        where: { id: existing.id },
        data: {
          businessName: profile.name,
          primaryCategory: profile.primaryCategory,
          categories: JSON.stringify(profile.categories),
          websiteUrl: profile.websiteUrl,
          avgRating,
          totalReviews,
          lastSyncAt: new Date(),
          syncStatus: 'connected',
          syncError: null,
        },
      });
    }

    // Import reviews
    for (const review of reviews) {
      try {
        const existingReview = await db.review.findFirst({
          where: {
            projectId,
            externalId: review.reviewId,
            source: 'GOOGLE',
          },
        });

        if (!existingReview) {
          await db.review.create({
            data: {
              projectId,
              locationId,
              source: 'GOOGLE',
              externalId: review.reviewId,
              authorName: review.reviewer,
              rating: review.rating,
              content: review.comment,
              reviewDate: review.createTime ? new Date(review.createTime) : new Date(),
            },
          });
        } else if (review.reply) {
          const existingResponses = await db.reviewResponse.findMany({
            where: { reviewId: existingReview.id },
          });
          if (existingResponses.length === 0) {
            await db.reviewResponse.create({
              data: {
                projectId,
                reviewId: existingReview.id,
                content: review.reply,
                status: 'PUBLISHED',
              },
            });
          }
        }
      } catch {
        // Skip individual review errors
      }
    }

    logger.info('GBP data sync completed', {
      connectionId,
      projectId,
      locationId,
      totalReviews,
      avgRating,
    });

    return {
      synced: true,
      reviewCount: totalReviews,
      avgRating,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error('GBP data sync failed', {
      connectionId,
      locationId,
      error: message,
    });

    return {
      synced: false,
      reviewCount: 0,
      avgRating: 0,
      error: `GBP synchronisatie mislukt: ${message}`,
    };
  }
}
