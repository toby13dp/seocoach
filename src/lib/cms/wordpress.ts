// ============================================================================
// SEOCoach — WordPress CMS Integration Module
// ============================================================================
// Provides connection management, content operations, media uploads,
// category/tag management, SEO metadata updates, and capability detection
// for WordPress sites via the WP REST API.
// ============================================================================

import { db } from '@/lib/db';

// ============================================================================
// Types
// ============================================================================

export interface WPConnectionConfig {
  name: string;
  baseUrl: string; // e.g. https://example.com
  username: string;
  applicationPassword: string; // WP application password
}

export interface WPListParams {
  page?: number;
  perPage?: number;
  status?: string;
  search?: string;
  type?: 'post' | 'page';
}

export interface WPCreateDraft {
  title: string;
  content: string;
  slug?: string;
  excerpt?: string;
  type?: 'post' | 'page';
  categories?: number[];
  tags?: number[];
  featuredMedia?: number;
  meta?: Record<string, string>;
}

export interface WPSEOMeta {
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  canonical?: string;
  noIndex?: boolean;
}

export interface WPMediaUpload {
  fileName: string;
  data: string; // base64 encoded
  title?: string;
  altText?: string;
}

export interface WPCapabilities {
  canCreatePosts: boolean;
  canCreatePages: boolean;
  canUploadMedia: boolean;
  canManageCategories: boolean;
  canSchedulePosts: boolean;
  seoPlugin: 'yoast' | 'rank-math' | 'aioseo' | 'none';
  version: string;
}

export interface WPTestResult {
  success: boolean;
  capabilities: WPCapabilities;
  error?: string;
}

interface WPAPIError {
  code: string;
  message: string;
  data?: { status?: number };
}

interface WPPostResponse {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  slug: string;
  status: string;
  type: string;
  date: string;
  modified: string;
  categories: number[];
  tags: number[];
  featured_media: number;
  meta: Record<string, unknown>;
  _links?: Record<string, unknown>;
}

interface WPCategoryResponse {
  id: number;
  name: string;
  slug: string;
  count: number;
  parent: number;
}

interface WPTagResponse {
  id: number;
  name: string;
  slug: string;
  count: number;
}

interface WPMediaResponse {
  id: number;
  title: { rendered: string };
  source_url: string;
  alt_text: string;
  media_type: string;
}

interface WPListResponse<T> {
  data: T[];
  totalPages: number;
  totalItems: number;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const RATE_LIMIT_DELAY_MS = 600; // ~100 requests/minute budget
const WP_API_PREFIX = '/wp-json/wp/v2/';

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Build the Basic Authorization header value from username and application password.
 */
function buildAuthHeader(username: string, applicationPassword: string): string {
  const credentials = Buffer.from(`${username}:${applicationPassword}`).toString('base64');
  return `Basic ${credentials}`;
}

/**
 * Get a CMSConnection record by ID, throwing if not found or soft-deleted.
 */
async function getConnectionOrThrow(connectionId: string) {
  const connection = await db.cMSConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    throw new Error(`Verbinding met ID "${connectionId}" niet gevonden.`);
  }

  if (connection.deletedAt) {
    throw new Error(`Verbinding "${connection.name}" is verwijderd en kan niet worden gebruikt.`);
  }

  if (connection.providerType !== 'WORDPRESS') {
    throw new Error(`Verbinding "${connection.name}" is geen WordPress-verbinding.`);
  }

  return connection;
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse capabilities from the JSON string stored in the database.
 */
function parseCapabilities(raw: string | null | undefined): WPCapabilities | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WPCapabilities;
  } catch {
    return null;
  }
}

/**
 * Parse metadata from the JSON string stored in the database.
 */
function parseMetadata(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Create a ContentChange audit record.
 */
async function logContentChange(params: {
  projectId: string;
  changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'PUBLISH' | 'SCHEDULE';
  summary: string;
  previousContent?: string;
  newContent?: string;
  cmsResult?: string;
  userId?: string;
}) {
  await db.contentChange.create({
    data: {
      projectId: params.projectId,
      changeType: params.changeType,
      summary: params.summary,
      previousContent: params.previousContent ?? null,
      newContent: params.newContent ?? null,
      cmsResult: params.cmsResult ?? null,
      userId: params.userId ?? null,
    },
  });
}

/**
 * Make a fetch request to the WordPress REST API with retry logic,
 * exponential backoff, and rate-limit awareness.
 */
async function wpFetch<T>(
  connection: {
    baseUrl: string;
    username: string | null;
    apiKey: string | null;
  },
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  if (!connection.username || !connection.apiKey) {
    throw new Error('Gebruikersnaam en applicatiewachtwoord zijn vereist voor WordPress-verbinding.');
  }

  const url = `${connection.baseUrl.replace(/\/+$/, '')}${WP_API_PREFIX}${endpoint.replace(/^\/+/, '')}`;
  const authHeader = buildAuthHeader(connection.username, connection.apiKey);

  const headers: Record<string, string> = {
    Authorization: authHeader,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Rate limit: space out requests
      if (attempt > 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 2);
        await sleep(delay);
      } else {
        await sleep(RATE_LIMIT_DELAY_MS);
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle rate limiting (429 Too Many Requests)
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : BASE_DELAY_MS * Math.pow(2, attempt);
        if (attempt < MAX_RETRIES) {
          await sleep(waitMs);
          continue;
        }
        throw new Error('WordPress-aanvraaglimiet bereikt. Probeer het later opnieuw.');
      }

      if (!response.ok) {
        let errorBody: WPAPIError | null = null;
        try {
          errorBody = (await response.json()) as WPAPIError;
        } catch {
          // Response body is not JSON
        }

        const errorMessage = errorBody?.message ?? `HTTP ${response.status}`;
        const isRetryable = response.status >= 500 || response.status === 429;

        if (isRetryable && attempt < MAX_RETRIES) {
          lastError = new Error(`WordPress API-fout (poging ${attempt}/${MAX_RETRIES}): ${errorMessage}`);
          continue;
        }

        // Map common status codes to Dutch messages
        switch (response.status) {
          case 401:
            throw new Error('Authenticatie mislukt. Controleer gebruikersnaam en applicatiewachtwoord.');
          case 403:
            throw new Error('Geen toestemming voor deze WordPress-actie. Controleer de gebruikersrechten.');
          case 404:
            throw new Error('De gevraagde WordPress-bron is niet gevonden.');
          case 400:
            throw new Error(`Ongeldig verzoek: ${errorMessage}`);
          default:
            throw new Error(`WordPress API-fout: ${errorMessage}`);
        }
      }

      // For list endpoints, extract pagination from headers
      const totalPages = parseInt(response.headers.get('X-WP-TotalPages') ?? '1', 10);
      const totalItems = parseInt(response.headers.get('X-WP-Total') ?? '0', 10);

      if (totalPages > 0 || totalItems > 0) {
        const data = (await response.json()) as T[];
        return { data, totalPages, totalItems } as unknown as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.message.includes('WordPress')) {
        throw error;
      }
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < MAX_RETRIES) {
        continue;
      }
    }
  }

  throw new Error(
    `Kon geen verbinding maken met WordPress na ${MAX_RETRIES} pogingen. ${lastError?.message ?? 'Onbekende fout.'}`,
  );
}

// ============================================================================
// Connection Management
// ============================================================================

/**
 * Create a new WordPress CMSConnection record.
 */
export async function createWordPressConnection(
  projectId: string,
  config: WPConnectionConfig,
): Promise<{ id: string; name: string }> {
  // Validate the base URL
  try {
    new URL(config.baseUrl);
  } catch {
    throw new Error(`Ongeldige basis-URL: "${config.baseUrl}". Geef een geldige URL op, bijv. https://example.com.`);
  }

  if (!config.username.trim()) {
    throw new Error('Gebruikersnaam is vereist voor een WordPress-verbinding.');
  }

  if (!config.applicationPassword.trim()) {
    throw new Error('Applicatiewachtwoord is vereist voor een WordPress-verbinding.');
  }

  // Normalize base URL (remove trailing slashes)
  const baseUrl = config.baseUrl.replace(/\/+$/, '');

  const connection = await db.cMSConnection.create({
    data: {
      projectId,
      name: config.name,
      providerType: 'WORDPRESS',
      status: 'PENDING',
      baseUrl,
      apiKey: config.applicationPassword,
      username: config.username,
      capabilities: null,
      metadata: JSON.stringify({
        connectionType: 'application_password',
        createdAtInit: new Date().toISOString(),
      }),
    },
  });

  await logContentChange({
    projectId,
    changeType: 'CREATE',
    summary: `WordPress-verbinding "${config.name}" aangemaakt voor ${baseUrl}.`,
    newContent: JSON.stringify({ connectionId: connection.id, name: config.name, baseUrl }),
  });

  return { id: connection.id, name: connection.name };
}

/**
 * Test a WordPress connection by calling the WP REST API,
 * detecting capabilities, and updating the connection status.
 */
export async function testWordPressConnection(
  connectionId: string,
): Promise<WPTestResult> {
  const connection = await getConnectionOrThrow(connectionId);

  try {
    // Test basic connectivity by fetching site info
    const siteUrl = `${connection.baseUrl.replace(/\/+$/, '')}/wp-json/`;
    const authHeader = buildAuthHeader(connection.username ?? '', connection.apiKey ?? '');

    const response = await fetch(siteUrl, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        await db.cMSConnection.update({
          where: { id: connectionId },
          data: {
            status: 'ERROR',
            lastError: 'Authenticatie mislukt. Controleer gebruikersnaam en applicatiewachtwoord.',
            lastTestedAt: new Date(),
          },
        });
        return {
          success: false,
          capabilities: getEmptyCapabilities(),
          error: 'Authenticatie mislukt. Controleer gebruikersnaam en applicatiewachtwoord.',
        };
      }

      if (response.status === 403) {
        await db.cMSConnection.update({
          where: { id: connectionId },
          data: {
            status: 'ERROR',
            lastError: 'Geen toestemming. Controleer de gebruikersrechten in WordPress.',
            lastTestedAt: new Date(),
          },
        });
        return {
          success: false,
          capabilities: getEmptyCapabilities(),
          error: 'Geen toestemming. Controleer de gebruikersrechten in WordPress.',
        };
      }

      await db.cMSConnection.update({
        where: { id: connectionId },
        data: {
          status: 'ERROR',
          lastError: `Kan geen verbinding maken met WordPress (HTTP ${response.status}).`,
          lastTestedAt: new Date(),
        },
      });
      return {
        success: false,
        capabilities: getEmptyCapabilities(),
        error: `Kan geen verbinding maken met WordPress (HTTP ${response.status}).`,
      };
    }

    // Detect capabilities
    const capabilities = await detectWPCapabilitiesDirect(connection);

    await db.cMSConnection.update({
      where: { id: connectionId },
      data: {
        status: 'CONNECTED',
        lastTestedAt: new Date(),
        lastError: null,
        capabilities: JSON.stringify(capabilities),
      },
    });

    return {
      success: true,
      capabilities,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Onbekende fout bij verbindingscontrole.';

    await db.cMSConnection.update({
      where: { id: connectionId },
      data: {
        status: 'ERROR',
        lastError: errorMessage,
        lastTestedAt: new Date(),
      },
    });

    return {
      success: false,
      capabilities: getEmptyCapabilities(),
      error: errorMessage,
    };
  }
}

/**
 * Update an existing WordPress connection's settings.
 */
export async function updateWordPressConnection(
  connectionId: string,
  config: Partial<WPConnectionConfig>,
): Promise<{ id: string; name: string }> {
  const connection = await getConnectionOrThrow(connectionId);

  // Validate base URL if provided
  if (config.baseUrl !== undefined) {
    try {
      new URL(config.baseUrl);
    } catch {
      throw new Error(`Ongeldige basis-URL: "${config.baseUrl}". Geef een geldige URL op.`);
    }
  }

  const updateData: Record<string, unknown> = {};

  if (config.name !== undefined) updateData.name = config.name;
  if (config.baseUrl !== undefined) updateData.baseUrl = config.baseUrl.replace(/\/+$/, '');
  if (config.username !== undefined) updateData.username = config.username;
  if (config.applicationPassword !== undefined) updateData.apiKey = config.applicationPassword;

  // Reset status to PENDING when credentials change
  if (config.username !== undefined || config.applicationPassword !== undefined || config.baseUrl !== undefined) {
    updateData.status = 'PENDING';
    updateData.lastError = null;
  }

  const previousData = JSON.stringify({
    name: connection.name,
    baseUrl: connection.baseUrl,
    username: connection.username,
  });

  const updated = await db.cMSConnection.update({
    where: { id: connectionId },
    data: updateData,
  });

  await logContentChange({
    projectId: connection.projectId,
    changeType: 'UPDATE',
    summary: `WordPress-verbinding "${updated.name}" bijgewerkt.`,
    previousContent: previousData,
    newContent: JSON.stringify(updateData),
  });

  return { id: updated.id, name: updated.name };
}

/**
 * Soft-delete a WordPress connection.
 */
export async function deleteWordPressConnection(connectionId: string): Promise<void> {
  const connection = await getConnectionOrThrow(connectionId);

  await db.cMSConnection.update({
    where: { id: connectionId },
    data: {
      deletedAt: new Date(),
      status: 'DISCONNECTED',
    },
  });

  await logContentChange({
    projectId: connection.projectId,
    changeType: 'DELETE',
    summary: `WordPress-verbinding "${connection.name}" verwijderd.`,
    previousContent: JSON.stringify({
      connectionId: connection.id,
      name: connection.name,
      baseUrl: connection.baseUrl,
    }),
  });
}

// ============================================================================
// Content Operations
// ============================================================================

/**
 * List posts or pages from WordPress with pagination support.
 */
export async function wpListPosts(
  connectionId: string,
  params?: WPListParams,
): Promise<WPListResponse<WPPostResponse>> {
  const connection = await getConnectionOrThrow(connectionId);

  const type = params?.type ?? 'post';
  const queryParams = new URLSearchParams();

  if (params?.page) queryParams.set('page', String(params.page));
  if (params?.perPage) queryParams.set('per_page', String(params.perPage));
  if (params?.status) queryParams.set('status', params.status);
  if (params?.search) queryParams.set('search', params.search);

  const endpoint = `${type}s?${queryParams.toString()}`;

  return wpFetch<WPListResponse<WPPostResponse>>(connection, endpoint);
}

/**
 * Get a single post or page by ID.
 */
export async function wpGetPost(
  connectionId: string,
  postId: number,
): Promise<WPPostResponse> {
  const connection = await getConnectionOrThrow(connectionId);

  return wpFetch<WPPostResponse>(connection, `posts/${postId}`);
}

/**
 * Create a draft post or page in WordPress.
 */
export async function wpCreateDraft(
  connectionId: string,
  draft: WPCreateDraft,
): Promise<WPPostResponse> {
  const connection = await getConnectionOrThrow(connectionId);

  const type = draft.type ?? 'post';
  const endpoint = type === 'page' ? 'pages' : 'posts';

  const body: Record<string, unknown> = {
    title: draft.title,
    content: draft.content,
    status: 'draft',
  };

  if (draft.slug) body.slug = draft.slug;
  if (draft.excerpt) body.excerpt = draft.excerpt;
  if (draft.categories && draft.categories.length > 0) body.categories = draft.categories;
  if (draft.tags && draft.tags.length > 0) body.tags = draft.tags;
  if (draft.featuredMedia) body.featured_media = draft.featuredMedia;
  if (draft.meta && Object.keys(draft.meta).length > 0) body.meta = draft.meta;

  const result = await wpFetch<WPPostResponse>(connection, endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  await logContentChange({
    projectId: connection.projectId,
    changeType: 'CREATE',
    summary: `Concept-${type === 'page' ? 'pagina' : 'bericht'} "${draft.title}" aangemaakt in WordPress (ID: ${result.id}).`,
    newContent: JSON.stringify({
      wpId: result.id,
      title: draft.title,
      type,
      status: 'draft',
    }),
  });

  return result;
}

/**
 * Update an existing draft post or page in WordPress.
 */
export async function wpUpdateDraft(
  connectionId: string,
  postId: number,
  draft: Partial<WPCreateDraft>,
): Promise<WPPostResponse> {
  const connection = await getConnectionOrThrow(connectionId);

  // First get the current post for audit trail
  const currentPost = await wpFetch<WPPostResponse>(connection, `posts/${postId}`);

  const type = draft.type ?? currentPost.type ?? 'post';
  const endpoint = type === 'page' ? `pages/${postId}` : `posts/${postId}`;

  const body: Record<string, unknown> = {};

  if (draft.title !== undefined) body.title = draft.title;
  if (draft.content !== undefined) body.content = draft.content;
  if (draft.slug !== undefined) body.slug = draft.slug;
  if (draft.excerpt !== undefined) body.excerpt = draft.excerpt;
  if (draft.categories !== undefined) body.categories = draft.categories;
  if (draft.tags !== undefined) body.tags = draft.tags;
  if (draft.featuredMedia !== undefined) body.featured_media = draft.featuredMedia;
  if (draft.meta !== undefined) body.meta = draft.meta;

  const result = await wpFetch<WPPostResponse>(connection, endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  await logContentChange({
    projectId: connection.projectId,
    changeType: 'UPDATE',
    summary: `${type === 'page' ? 'Pagina' : 'Bericht'} "${currentPost.title.rendered}" bijgewerkt in WordPress (ID: ${postId}).`,
    previousContent: JSON.stringify({
      title: currentPost.title.rendered,
      status: currentPost.status,
    }),
    newContent: JSON.stringify(body),
    cmsResult: JSON.stringify({ wpId: result.id, status: result.status }),
  });

  return result;
}

/**
 * Schedule a post for future publishing.
 */
export async function wpSchedulePost(
  connectionId: string,
  postId: number,
  publishDate: Date,
): Promise<WPPostResponse> {
  const connection = await getConnectionOrThrow(connectionId);

  // Validate publish date is in the future
  if (publishDate <= new Date()) {
    throw new Error('De publicatiedatum moet in de toekomst liggen om een bericht in te plannen.');
  }

  // Get current post for audit
  const currentPost = await wpFetch<WPPostResponse>(connection, `posts/${postId}`);

  const endpoint = currentPost.type === 'page' ? `pages/${postId}` : `posts/${postId}`;

  const result = await wpFetch<WPPostResponse>(connection, endpoint, {
    method: 'POST',
    body: JSON.stringify({
      status: 'future',
      date: publishDate.toISOString(),
    }),
  });

  await logContentChange({
    projectId: connection.projectId,
    changeType: 'SCHEDULE',
    summary: `${currentPost.type === 'page' ? 'Pagina' : 'Bericht'} "${currentPost.title.rendered}" ingepland voor publicatie op ${publishDate.toLocaleDateString('nl-NL')} (ID: ${postId}).`,
    previousContent: JSON.stringify({
      wpId: postId,
      previousStatus: currentPost.status,
    }),
    newContent: JSON.stringify({
      wpId: postId,
      status: 'future',
      scheduledDate: publishDate.toISOString(),
    }),
  });

  return result;
}

/**
 * Publish a draft post immediately.
 */
export async function wpPublishPost(
  connectionId: string,
  postId: number,
): Promise<WPPostResponse> {
  const connection = await getConnectionOrThrow(connectionId);

  // Get current post for audit
  const currentPost = await wpFetch<WPPostResponse>(connection, `posts/${postId}`);

  if (currentPost.status === 'publish') {
    throw new Error('Dit bericht is al gepubliceerd.');
  }

  const endpoint = currentPost.type === 'page' ? `pages/${postId}` : `posts/${postId}`;

  const result = await wpFetch<WPPostResponse>(connection, endpoint, {
    method: 'POST',
    body: JSON.stringify({
      status: 'publish',
    }),
  });

  await logContentChange({
    projectId: connection.projectId,
    changeType: 'PUBLISH',
    summary: `${currentPost.type === 'page' ? 'Pagina' : 'Bericht'} "${currentPost.title.rendered}" gepubliceerd in WordPress (ID: ${postId}).`,
    previousContent: JSON.stringify({
      wpId: postId,
      previousStatus: currentPost.status,
    }),
    newContent: JSON.stringify({
      wpId: postId,
      status: 'publish',
      publishedAt: new Date().toISOString(),
    }),
  });

  return result;
}

/**
 * Check the publication status of a post.
 */
export async function wpGetPostStatus(
  connectionId: string,
  postId: number,
): Promise<{
  id: number;
  status: string;
  type: string;
  date: string;
  modified: string;
  title: string;
  link: string;
}> {
  const connection = await getConnectionOrThrow(connectionId);

  const post = await wpFetch<WPPostResponse>(connection, `posts/${postId}`);

  return {
    id: post.id,
    status: post.status,
    type: post.type,
    date: post.date,
    modified: post.modified,
    title: post.title.rendered,
    link: (post._links?.self as Array<{ href: string }>)?.[0]?.href ?? '',
  };
}

// ============================================================================
// Media
// ============================================================================

/**
 * Upload a media file to WordPress.
 */
export async function wpUploadMedia(
  connectionId: string,
  file: WPMediaUpload,
): Promise<WPMediaResponse> {
  const connection = await getConnectionOrThrow(connectionId);

  if (!connection.username || !connection.apiKey) {
    throw new Error('Gebruikersnaam en applicatiewachtwoord zijn vereist voor media-upload.');
  }

  const authHeader = buildAuthHeader(connection.username, connection.apiKey);
  const url = `${connection.baseUrl.replace(/\/+$/, '')}${WP_API_PREFIX}media`;

  // Decode base64 to buffer
  const buffer = Buffer.from(file.data, 'base64');

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 2);
        await sleep(delay);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Disposition': `attachment; filename="${file.fileName}"`,
          'Content-Type': 'application/octet-stream',
        },
        body: buffer,
      });

      if (!response.ok) {
        let errorBody: WPAPIError | null = null;
        try {
          errorBody = (await response.json()) as WPAPIError;
        } catch {
          // not JSON
        }

        const errorMessage = errorBody?.message ?? `HTTP ${response.status}`;
        const isRetryable = response.status >= 500;

        if (isRetryable && attempt < MAX_RETRIES) {
          lastError = new Error(`Media-upload mislukt (poging ${attempt}/${MAX_RETRIES}): ${errorMessage}`);
          continue;
        }

        switch (response.status) {
          case 401:
            throw new Error('Authenticatie mislukt bij media-upload. Controleer de inloggegevens.');
          case 403:
            throw new Error('Geen toestemming om media te uploaden. Controleer de gebruikersrechten.');
          case 413:
            throw new Error('Het bestand is te groot om te uploaden naar WordPress.');
          default:
            throw new Error(`Media-upload mislukt: ${errorMessage}`);
        }
      }

      const result = (await response.json()) as WPMediaResponse;

      // If alt text or title provided, update the media item
      if (file.altText || file.title) {
        const updateBody: Record<string, string> = {};
        if (file.altText) updateBody.alt_text = file.altText;
        if (file.title) updateBody.title = file.title;

        try {
          await fetch(`${url}/${result.id}`, {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateBody),
          });
        } catch {
          // Non-critical: media is uploaded, alt/title update is best-effort
        }
      }

      await logContentChange({
        projectId: connection.projectId,
        changeType: 'CREATE',
        summary: `Mediabestand "${file.fileName}" geüpload naar WordPress (ID: ${result.id}).`,
        newContent: JSON.stringify({
          mediaId: result.id,
          fileName: file.fileName,
          sourceUrl: result.source_url,
        }),
      });

      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Media-upload mislukt')) {
        throw error;
      }
      if (error instanceof Error && (error.message.includes('Authenticatie') || error.message.includes('toestemming') || error.message.includes('te groot'))) {
        throw error;
      }
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES) continue;
    }
  }

  throw new Error(
    `Kon media niet uploaden na ${MAX_RETRIES} pogingen. ${lastError?.message ?? 'Onbekende fout.'}`,
  );
}

// ============================================================================
// Categories & Tags
// ============================================================================

/**
 * List all categories from WordPress.
 */
export async function wpListCategories(
  connectionId: string,
): Promise<WPCategoryResponse[]> {
  const connection = await getConnectionOrThrow(connectionId);

  const result = await wpFetch<WPListResponse<WPCategoryResponse>>(
    connection,
    'categories?per_page=100',
  );

  return result.data;
}

/**
 * List all tags from WordPress.
 */
export async function wpListTags(
  connectionId: string,
): Promise<WPTagResponse[]> {
  const connection = await getConnectionOrThrow(connectionId);

  const result = await wpFetch<WPListResponse<WPTagResponse>>(
    connection,
    'tags?per_page=100',
  );

  return result.data;
}

// ============================================================================
// SEO Metadata
// ============================================================================

/**
 * Update SEO metadata for a post, detecting the active SEO plugin
 * and using the appropriate meta keys.
 */
export async function wpUpdateSEOMeta(
  connectionId: string,
  postId: number,
  meta: WPSEOMeta,
): Promise<WPPostResponse> {
  const connection = await getConnectionOrThrow(connectionId);

  // Get current capabilities to determine SEO plugin
  const capabilities = parseCapabilities(connection.capabilities);
  const seoPlugin = capabilities?.seoPlugin ?? 'none';

  const metaUpdate: Record<string, string> = {};

  switch (seoPlugin) {
    case 'yoast':
      if (meta.metaTitle) metaUpdate['_yoast_wpseo_title'] = meta.metaTitle;
      if (meta.metaDescription) metaUpdate['_yoast_wpseo_metadesc'] = meta.metaDescription;
      if (meta.focusKeyword) metaUpdate['_yoast_wpseo_focuskw'] = meta.focusKeyword;
      if (meta.canonical) metaUpdate['_yoast_wpseo_canonical'] = meta.canonical;
      if (meta.noIndex !== undefined) metaUpdate['_yoast_wpseo_meta-robots-noindex'] = meta.noIndex ? '1' : '0';
      break;

    case 'rank-math':
      if (meta.metaTitle) metaUpdate['rank_math_title'] = meta.metaTitle;
      if (meta.metaDescription) metaUpdate['rank_math_description'] = meta.metaDescription;
      if (meta.focusKeyword) metaUpdate['rank_math_focus_keyword'] = meta.focusKeyword;
      if (meta.canonical) metaUpdate['rank_math_canonical_url'] = meta.canonical;
      if (meta.noIndex !== undefined) metaUpdate['rank_math_robots'] = meta.noIndex ? 'noindex' : 'index';
      break;

    case 'aioseo':
      if (meta.metaTitle) metaUpdate['_aioseo_title'] = meta.metaTitle;
      if (meta.metaDescription) metaUpdate['_aioseo_description'] = meta.metaDescription;
      if (meta.focusKeyword) metaUpdate['_aioseo_keyphrases'] = JSON.stringify({ focus: meta.focusKeyword });
      if (meta.canonical) metaUpdate['_aioseo_canonical_url'] = meta.canonical;
      if (meta.noIndex !== undefined) metaUpdate['_aioseo_robots_default'] = meta.noIndex ? 'noindex' : 'index';
      break;

    case 'none':
    default:
      // No SEO plugin detected; store as generic custom fields
      if (meta.metaTitle) metaUpdate['_seo_meta_title'] = meta.metaTitle;
      if (meta.metaDescription) metaUpdate['_seo_meta_description'] = meta.metaDescription;
      if (meta.focusKeyword) metaUpdate['_seo_focus_keyword'] = meta.focusKeyword;
      if (meta.canonical) metaUpdate['_seo_canonical'] = meta.canonical;
      if (meta.noIndex !== undefined) metaUpdate['_seo_noindex'] = meta.noIndex ? '1' : '0';
      break;
  }

  // Get current post for audit
  const currentPost = await wpFetch<WPPostResponse>(connection, `posts/${postId}`);
  const endpoint = currentPost.type === 'page' ? `pages/${postId}` : `posts/${postId}`;

  const result = await wpFetch<WPPostResponse>(connection, endpoint, {
    method: 'POST',
    body: JSON.stringify({ meta: metaUpdate }),
  });

  const pluginLabel = seoPlugin === 'yoast' ? 'Yoast SEO' : seoPlugin === 'rank-math' ? 'Rank Math' : seoPlugin === 'aioseo' ? 'All in One SEO' : 'aangepaste velden';

  await logContentChange({
    projectId: connection.projectId,
    changeType: 'UPDATE',
    summary: `SEO-metadata bijgewerkt voor "${currentPost.title.rendered}" via ${pluginLabel} (ID: ${postId}).`,
    previousContent: JSON.stringify({
      wpId: postId,
      previousMeta: currentPost.meta,
    }),
    newContent: JSON.stringify({
      wpId: postId,
      seoPlugin,
      metaUpdates: metaUpdate,
    }),
  });

  return result;
}

// ============================================================================
// Capability Detection
// ============================================================================

/**
 * Get empty capabilities (default when connection fails).
 */
function getEmptyCapabilities(): WPCapabilities {
  return {
    canCreatePosts: false,
    canCreatePages: false,
    canUploadMedia: false,
    canManageCategories: false,
    canSchedulePosts: false,
    seoPlugin: 'none',
    version: 'onbekend',
  };
}

/**
 * Direct capability detection from a connection (used internally by testWordPressConnection).
 * Calls various WP REST API endpoints to determine what the user can do.
 */
async function detectWPCapabilitiesDirect(connection: {
  baseUrl: string;
  username: string | null;
  apiKey: string | null;
}): Promise<WPCapabilities> {
  if (!connection.username || !connection.apiKey) {
    return getEmptyCapabilities();
  }

  const authHeader = buildAuthHeader(connection.username, connection.apiKey);
  const baseApiUrl = `${connection.baseUrl.replace(/\/+$/, '')}/wp-json/`;

  const capabilities: WPCapabilities = {
    canCreatePosts: false,
    canCreatePages: false,
    canUploadMedia: false,
    canManageCategories: false,
    canSchedulePosts: false,
    seoPlugin: 'none',
    version: 'onbekend',
  };

  try {
    // Step 1: Get site info for version
    const siteResponse = await fetch(baseApiUrl, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (siteResponse.ok) {
      const siteData = (await siteResponse.json()) as Record<string, unknown>;
      // WordPress REST API root returns namespaces and site info
      const namespaces = (siteData.namespaces as string[]) ?? [];
      capabilities.version = (siteData.name as string) ?? 'WordPress';

      // Step 2: Detect SEO plugin from namespaces
      if (namespaces.includes('yoast/v1')) {
        capabilities.seoPlugin = 'yoast';
      } else if (namespaces.includes('rankmath/v1')) {
        capabilities.seoPlugin = 'rank-math';
      } else if (namespaces.includes('aioseo/v1') || namespaces.includes('aioseo')) {
        capabilities.seoPlugin = 'aioseo';
      }
    }
  } catch {
    // Site info unavailable; continue with defaults
  }

  // Step 3: Test post creation capability by checking the posts endpoint
  try {
    const postsResponse = await fetch(
      `${connection.baseUrl.replace(/\/+$/, '')}${WP_API_PREFIX}posts?per_page=1`,
      {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      },
    );
    if (postsResponse.ok) {
      capabilities.canCreatePosts = true;
    }
  } catch {
    // Posts endpoint unavailable
  }

  // Step 4: Test page creation capability
  try {
    const pagesResponse = await fetch(
      `${connection.baseUrl.replace(/\/+$/, '')}${WP_API_PREFIX}pages?per_page=1`,
      {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      },
    );
    if (pagesResponse.ok) {
      capabilities.canCreatePages = true;
    }
  } catch {
    // Pages endpoint unavailable
  }

  // Step 5: Test media upload capability
  try {
    const mediaResponse = await fetch(
      `${connection.baseUrl.replace(/\/+$/, '')}${WP_API_PREFIX}media?per_page=1`,
      {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      },
    );
    if (mediaResponse.ok) {
      capabilities.canUploadMedia = true;
    }
  } catch {
    // Media endpoint unavailable
  }

  // Step 6: Test category management capability
  try {
    const categoriesResponse = await fetch(
      `${connection.baseUrl.replace(/\/+$/, '')}${WP_API_PREFIX}categories?per_page=1`,
      {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      },
    );
    if (categoriesResponse.ok) {
      capabilities.canManageCategories = true;
    }
  } catch {
    // Categories endpoint unavailable
  }

  // Step 7: Test scheduling capability — check if the user can edit posts
  // (scheduling requires edit_posts capability in WP)
  try {
    const meResponse = await fetch(`${baseApiUrl}wp/v2/users/me`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (meResponse.ok) {
      const meData = (await meResponse.json()) as Record<string, unknown>;
      const roles = (meData.roles as string[]) ?? [];
      // Administrator, editor, and author can schedule posts
      const canSchedule = roles.some(
        (role) => ['administrator', 'editor', 'author'].includes(role),
      );
      capabilities.canSchedulePosts = canSchedule;

      // Refine version from user info
      if (capabilities.version === 'WordPress' && meData.name) {
        // Keep the version label as-is; user info doesn't typically include WP version
      }
    }
  } catch {
    // User endpoint unavailable; default to false
  }

  // Step 8: Try to get WP version from the site info endpoint
  try {
    const siteInfoResponse = await fetch(`${baseApiUrl}`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (siteInfoResponse.ok) {
      const siteInfo = (await siteInfoResponse.json()) as Record<string, unknown>;
      // The REST API root may expose a description with version info
      if (siteInfo.description && typeof siteInfo.description === 'string') {
        capabilities.version = siteInfo.description;
      }
    }
  } catch {
    // Version detection failed
  }

  return capabilities;
}

/**
 * Detect WordPress capabilities for a connection (public API).
 * Updates the connection record with detected capabilities.
 */
export async function detectWPCapabilities(
  connectionId: string,
): Promise<WPCapabilities> {
  const connection = await getConnectionOrThrow(connectionId);

  const capabilities = await detectWPCapabilitiesDirect(connection);

  // Update the connection with detected capabilities
  await db.cMSConnection.update({
    where: { id: connectionId },
    data: {
      capabilities: JSON.stringify(capabilities),
      lastTestedAt: new Date(),
    },
  });

  return capabilities;
}

// ============================================================================
// Utility: Get parsed capabilities for a connection
// ============================================================================

/**
 * Retrieve the stored capabilities for a connection.
 */
export async function getWPCapabilities(
  connectionId: string,
): Promise<WPCapabilities | null> {
  const connection = await db.cMSConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.deletedAt) return null;

  return parseCapabilities(connection.capabilities);
}

/**
 * Retrieve the stored metadata for a connection.
 */
export async function getWPMetadata(
  connectionId: string,
): Promise<Record<string, unknown> | null> {
  const connection = await db.cMSConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.deletedAt) return null;

  return parseMetadata(connection.metadata);
}
