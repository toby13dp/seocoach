import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { analyzeLandingPageQuality, saveLandingPageAnalysis } from '@/lib/local-seo';
import { db } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';

// GET /api/projects/[id]/locations/[locationId]/landing-pages — List landing pages for a location
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; locationId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, locationId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    const where = {
      locationId,
      deletedAt: null,
    };

    const [data, total] = await Promise.all([
      db.localLandingPage.findMany({
        where,
        orderBy: { qualityScore: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.localLandingPage.count({ where }),
    ]);

    return NextResponse.json({
      data,
      meta: { total, limit, offset },
    });
  } catch (error) {
    console.error('Fout bij ophalen landingpagina\'s:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen landingpagina\'s' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/locations/[locationId]/landing-pages — Create/update landing pages with quality analysis
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; locationId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, locationId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();
    const { url, title, metaDescription, h1, wordCount } = body;

    if (!url || typeof url !== 'string' || !url.trim()) {
      return NextResponse.json(
        { error: 'URL is verplicht' },
        { status: 400 }
      );
    }

    // Fetch location data for quality analysis
    const location = await db.location.findFirst({
      where: { id: locationId, deletedAt: null },
    });

    if (!location) {
      return NextResponse.json(
        { error: 'Locatie niet gevonden' },
        { status: 404 }
      );
    }

    // Run quality analysis
    const analysis = await analyzeLandingPageQuality(url.trim(), {
      name: location.name,
      address: location.address,
      city: location.city,
      phone: location.phone,
      openingHours: location.openingHours,
    });

    // Create landing page
    const landingPage = await db.localLandingPage.create({
      data: {
        projectId,
        locationId,
        url: url.trim(),
        title: title ?? null,
        metaDescription: metaDescription ?? null,
        h1: h1 ?? null,
        wordCount: wordCount ?? 0,
        hasStructuredData: analysis.hasStructuredData,
        hasNAP: analysis.hasNAP,
        hasMap: analysis.hasMap,
        hasOpeningHours: analysis.hasOpeningHours,
        qualityScore: analysis.qualityScore,
        issues: JSON.stringify(analysis.issues),
      },
    });

    await logAuditEvent({
      organizationId: access.project.organizationId,
      projectId,
      userId: user.id,
      action: 'landing_page_created',
      entity: 'local_landing_page',
      entityId: landingPage.id,
      changes: { url, qualityScore: analysis.qualityScore },
    });

    return NextResponse.json(
      { data: landingPage, analysis },
      { status: 201 }
    );
  } catch (error) {
    console.error('Fout bij aanmaken landingpagina:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij aanmaken landingpagina' },
      { status: 500 }
    );
  }
}
