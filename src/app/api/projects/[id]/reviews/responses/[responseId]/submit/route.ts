import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { submitResponseForApproval } from '@/lib/reviews';

// POST /api/projects/[id]/reviews/responses/[responseId]/submit — Submit response for approval
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

    const updated = await submitResponseForApproval(responseId, projectId, user.id);

    return NextResponse.json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('niet gevonden')) {
      return NextResponse.json({ error: 'Reactie niet gevonden' }, { status: 404 });
    }
    if (message.includes('Alleen concept')) {
      return NextResponse.json(
        { error: 'Alleen concept-reacties kunnen worden ingediend voor goedkeuring' },
        { status: 400 }
      );
    }
    console.error('Submit response error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij indienen reactie' },
      { status: 500 }
    );
  }
}
