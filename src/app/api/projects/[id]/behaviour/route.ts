import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { importBehaviourRecord, listBehaviourRecords } from '@/lib/cro';
import type { BehaviourImportData } from '@/lib/cro';

// GET /api/projects/[id]/behaviour — List behaviour records with filters
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
    const behaviourType = searchParams.get('behaviourType') ?? undefined;
    const pageUrl = searchParams.get('pageUrl') ?? undefined;
    const startDate = searchParams.get('startDate') ?? undefined;
    const endDate = searchParams.get('endDate') ?? undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));

    const filters: Parameters<typeof listBehaviourRecords>[1] = { limit, offset };
    if (behaviourType) filters.behaviourType = behaviourType as BehaviourImportData['behaviourType'];
    if (pageUrl) filters.pageUrl = pageUrl;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const { records, total } = await listBehaviourRecords(projectId, filters);

    return NextResponse.json({
      data: records,
      meta: { total, limit, offset },
    });
  } catch (error) {
    console.error('List behaviour records error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/behaviour — Import behaviour data (single record)
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
    const { behaviourType, pageUrl, element, value, metadata, sessionId, deviceType, recordedAt } = body as {
      behaviourType?: string;
      pageUrl?: string;
      element?: string;
      value?: number;
      metadata?: string;
      sessionId?: string;
      deviceType?: string;
      recordedAt?: string;
    };

    if (!behaviourType) {
      return NextResponse.json(
        { error: 'behaviourType is vereist' },
        { status: 400 }
      );
    }

    const validTypes = ['SCROLL_DEPTH', 'CLICK', 'RAGE_CLICK', 'DEAD_CLICK', 'FORM_ABANDONMENT', 'DEVICE_TYPE', 'ENGAGEMENT'];
    if (!validTypes.includes(behaviourType)) {
      return NextResponse.json(
        { error: `Ongeldig behaviourType. Geldige waarden: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const data: BehaviourImportData = {
      behaviourType: behaviourType as BehaviourImportData['behaviourType'],
    };

    if (pageUrl) data.pageUrl = pageUrl;
    if (element) data.element = element;
    if (value !== undefined) data.value = value;
    if (metadata) data.metadata = metadata;
    if (sessionId) data.sessionId = sessionId;
    if (deviceType) data.deviceType = deviceType;
    if (recordedAt) data.recordedAt = new Date(recordedAt);

    const record = await importBehaviourRecord(projectId, data);

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    console.error('Import behaviour record error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
