import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { createShareLink, revokeShareLink } from '@/lib/reporting';

// POST /api/projects/[id]/reports/[reportId]/share — Create share link
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, reportId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const existing = await db.report.findFirst({
      where: { id: reportId, projectId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Rapport niet gevonden' },
        { status: 404 }
      );
    }

    if (existing.status !== 'APPROVED' && existing.status !== 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Rapport moet goedgekeurd zijn voordat het kan worden gedeeld' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { password, expiresInDays } = body as {
      password?: string;
      expiresInDays?: number;
    };

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const shared = await createShareLink(reportId, {
      password,
      expiresAt,
    });

    return NextResponse.json({
      data: {
        id: shared.id,
        shareToken: shared.shareToken,
        shareExpiresAt: shared.shareExpiresAt,
        hasPassword: !!shared.sharePassword,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Share report error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/reports/[reportId]/share — Revoke share link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, reportId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const existing = await db.report.findFirst({
      where: { id: reportId, projectId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Rapport niet gevonden' },
        { status: 404 }
      );
    }

    if (!existing.shareToken) {
      return NextResponse.json(
        { error: 'Dit rapport heeft geen actieve deelverwijzing' },
        { status: 400 }
      );
    }

    await revokeShareLink(reportId);

    return NextResponse.json({ data: { id: reportId, shareRevoked: true } });
  } catch (error) {
    console.error('Revoke share link error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
