import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getSessionSummary } from '@/lib/first-party-analytics';

// GET /api/projects/[id]/analytics-sessions — Get session summary statistics
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
    const startDate = searchParams.get('startDate') ?? undefined;
    const endDate = searchParams.get('endDate') ?? undefined;
    const deviceType = searchParams.get('deviceType') ?? undefined;
    const source = searchParams.get('source') ?? undefined;

    const filters: {
      startDate?: Date;
      endDate?: Date;
      deviceType?: string;
      source?: string;
    } = {};

    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    if (deviceType) filters.deviceType = deviceType;
    if (source) filters.source = source;

    const summary = await getSessionSummary(projectId, filters);

    return NextResponse.json({ data: summary });
  } catch (error) {
    console.error('Get session summary error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
