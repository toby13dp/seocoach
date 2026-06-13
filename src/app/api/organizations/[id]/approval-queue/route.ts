import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/organizations/[id]/approval-queue — List pending approval items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const itemType = searchParams.get('itemType');
    const riskLevel = searchParams.get('riskLevel');
    const projectId = searchParams.get('projectId');
    const clientId = searchParams.get('clientId');

    const where: Record<string, unknown> = {
      organizationId,
      deletedAt: null,
    };

    if (status) where.status = status;
    if (itemType) where.itemType = itemType;
    if (riskLevel) where.riskLevel = riskLevel;
    if (projectId) where.projectId = projectId;
    if (clientId) where.clientId = clientId;

    const items = await db.approvalQueueItem.findMany({
      where,
      orderBy: [
        { riskLevel: 'desc' },
        { submittedAt: 'asc' },
      ],
    });

    return NextResponse.json({ data: items });
  } catch (error) {
    console.error('List approval queue error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/organizations/[id]/approval-queue — Submit item for approval
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();
    const {
      itemType,
      itemId,
      title,
      description,
      evidence,
      projectId,
      clientId,
      riskLevel,
      isClientVisible,
    } = body;

    if (!itemType || typeof itemType !== 'string' || itemType.trim().length === 0) {
      return NextResponse.json(
        { error: 'Itemtype is vereist' },
        { status: 400 }
      );
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Titel is vereist' },
        { status: 400 }
      );
    }

    const validRiskLevels = ['low', 'medium', 'high', 'critical'];
    const resolvedRiskLevel = riskLevel ?? 'low';
    if (!validRiskLevels.includes(resolvedRiskLevel)) {
      return NextResponse.json(
        { error: 'Ongeldig risiconiveau. Geldige waarden: low, medium, high, critical' },
        { status: 400 }
      );
    }

    const item = await db.approvalQueueItem.create({
      data: {
        organizationId,
        itemType: itemType.trim(),
        itemId: itemId ?? null,
        title: title.trim(),
        description: description ?? null,
        evidence: evidence ?? null,
        projectId: projectId ?? null,
        clientId: clientId ?? null,
        submittedBy: user.id,
        submittedAt: new Date(),
        riskLevel: resolvedRiskLevel,
        isClientVisible: isClientVisible ?? false,
        status: 'PENDING',
      },
    });

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    console.error('Submit approval item error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
