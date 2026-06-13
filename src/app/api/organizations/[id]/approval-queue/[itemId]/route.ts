import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// PUT /api/organizations/[id]/approval-queue/[itemId] — Approve or reject
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId, itemId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    // Only managers and above can approve/reject
    const allowedRoles = ['ORG_OWNER', 'AGENCY_OWNER', 'SEO_MANAGER', 'PLATFORM_ADMIN'];
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json(
        { error: 'Onvoldoende rechten om goedkeuringen te verwerken' },
        { status: 403 }
      );
    }

    const existing = await db.approvalQueueItem.findFirst({
      where: { id: itemId, organizationId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Goedkeuringsitem niet gevonden' },
        { status: 404 }
      );
    }

    if (existing.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Dit item is al verwerkt' },
        { status: 409 }
      );
    }

    const body = await request.json();
    const { action, notes } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Actie is vereist. Geldige waarden: approve, reject' },
        { status: 400 }
      );
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    const updated = await db.approvalQueueItem.update({
      where: { id: itemId },
      data: {
        status: newStatus,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        reviewNotes: notes ?? null,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Review approval item error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
