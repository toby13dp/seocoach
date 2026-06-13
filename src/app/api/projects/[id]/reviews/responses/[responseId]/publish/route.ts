import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { publishResponse } from '@/lib/reviews';
import { db } from '@/lib/db';
import { ReviewResponseStatus } from '@prisma/client';

// POST /api/projects/[id]/reviews/responses/[responseId]/publish — Publish an approved response
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

    // CRITICAL: Pre-verify status is APPROVED before attempting to publish
    // This provides a clear Dutch error message for invalid transitions
    const response = await db.reviewResponse.findFirst({
      where: {
        id: responseId,
        projectId,
      },
    });

    if (!response) {
      return NextResponse.json(
        { error: 'Reactie niet gevonden' },
        { status: 404 }
      );
    }

    // Explicitly check and reject non-APPROVED statuses with clear Dutch messages
    if (response.status === ('DRAFT' as ReviewResponseStatus)) {
      return NextResponse.json(
        { error: 'Een concept-reactie kan niet direct worden gepubliceerd. Dien de reactie eerst in voor goedkeuring.' },
        { status: 400 }
      );
    }

    if (response.status === ('PENDING_APPROVAL' as ReviewResponseStatus)) {
      return NextResponse.json(
        { error: 'De reactie wacht nog op goedkeuring en kan niet worden gepubliceerd. Laat de reactie eerst goedkeuren.' },
        { status: 400 }
      );
    }

    if (response.status === ('REJECTED' as ReviewResponseStatus)) {
      return NextResponse.json(
        { error: 'Een afgewezen reactie kan niet worden gepubliceerd. Bewerk de reactie en dien deze opnieuw in.' },
        { status: 400 }
      );
    }

    if (response.status === ('PUBLISHED' as ReviewResponseStatus)) {
      return NextResponse.json(
        { error: 'Deze reactie is al gepubliceerd' },
        { status: 400 }
      );
    }

    // Status must be APPROVED at this point
    const updated = await publishResponse(responseId, projectId);

    return NextResponse.json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('niet gevonden')) {
      return NextResponse.json({ error: 'Reactie niet gevonden' }, { status: 404 });
    }
    if (message.includes('Alleen goedgekeurde')) {
      return NextResponse.json(
        { error: 'Alleen goedgekeurde reacties kunnen worden gepubliceerd. De reactie moet eerst worden goedgekeurd via het goedkeuringsproces.' },
        { status: 400 }
      );
    }
    console.error('Publish response error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij publiceren reactie' },
      { status: 500 }
    );
  }
}
