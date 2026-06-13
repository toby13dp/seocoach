import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getFindings } from '@/lib/content/quality-controls';
import type { CheckType, FindingSeverity } from '@/lib/content/quality-controls';

// GET /api/projects/[id]/quality-findings — List findings with filters
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
    const versionId = searchParams.get('versionId') ?? undefined;
    const briefId = searchParams.get('briefId') ?? undefined;
    const checkType = searchParams.get('checkType') as CheckType | null;
    const severity = searchParams.get('severity') as FindingSeverity | null;
    const dismissed = searchParams.has('dismissed')
      ? searchParams.get('dismissed') === 'true'
      : undefined;

    const findings = await getFindings(projectId, {
      versionId,
      briefId,
      checkType: checkType ?? undefined,
      severity: severity ?? undefined,
      dismissed,
    });

    return NextResponse.json({ data: findings });
  } catch (error) {
    console.error('List quality findings error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
