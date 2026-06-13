import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getAuthorityRecords, addAuthorityRecord, importCsvBacklinks, calculateAuthoritySummary } from '@/lib/authority';

// GET /api/projects/[id]/authority — List authority records
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const domain = searchParams.get('domain') ?? undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));

    const [result, summary] = await Promise.all([
      getAuthorityRecords(projectId, { type, status, domain, limit, offset }),
      calculateAuthoritySummary(projectId),
    ]);

    return NextResponse.json({
      data: result.records,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        summary,
      },
    });
  } catch (error) {
    console.error('List authority records error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/authority — Add record or import CSV
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();

    // CSV import mode
    if (body.records && Array.isArray(body.records)) {
      const result = await importCsvBacklinks(projectId, body);
      return NextResponse.json({
        data: result,
        meta: { importedCount: result.count },
      }, { status: 201 });
    }

    // Single record
    const { type, sourceUrl, targetUrl, anchorText, domain, domainAuthority, pageAuthority, isNofollow, notes, campaignId, status, providerSource, discoveredAt } = body;

    if (!type) {
      return NextResponse.json({ error: 'type is vereist' }, { status: 400 });
    }

    const record = await addAuthorityRecord(projectId, {
      type,
      sourceUrl,
      targetUrl,
      anchorText,
      domain,
      domainAuthority,
      pageAuthority,
      isNofollow,
      notes,
      campaignId,
      status,
      providerSource,
      discoveredAt,
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    console.error('Add authority record error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
