import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { rejectResponse } from '@/lib/reviews';

// POST /api/projects/[id]/reviews/responses/[responseId]/reject — Reject a response
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, responseId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.rejectionReason || typeof body.rejectionReason !== 'string' || body.rejectionReason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Afwijsreden (rejectionReason) is verplicht' },
        { status: 400 }
      );
    }

    const updated = await rejectResponse(
      responseId,
      projectId,
      user.id,
      body.rejectionReason.trim()
    );

    return NextResponse.json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('niet gevonden')) {
      return NextResponse.json({ error: 'Reactie niet gevonden' }, { status: 404 });
    }
    if (message.includes('Alleen reacties die wachten')) {
      return NextResponse.json(
        { error: 'Alleen reacties die wachten op goedkeuring kunnen worden afgewezen' },
        { status: 400 }
      );
    }
    console.error('Reject response error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij afwijzen reactie' },
      { status: 500 }
    );
  }
}
