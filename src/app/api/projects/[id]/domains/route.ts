import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { db } from '@/lib/db';
import { validateProjectAccess } from '@/lib/tenant';
import { logAuditEvent } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const access = await validateProjectAccess(user.id, id);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const domains = await db.domain.findMany({
      where: { projectId: id, deletedAt: null },
      orderBy: { isPrimary: 'desc' },
    });

    return NextResponse.json({ domains });
  } catch (error) {
    console.error('List domains error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const access = await validateProjectAccess(user.id, id);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { domain, isPrimary, verificationMethod } = body;

    if (!domain) {
      return NextResponse.json(
        { error: 'Domain is required' },
        { status: 400 }
      );
    }

    // Check uniqueness within project
    const existing = await db.domain.findUnique({
      where: { projectId_domain: { projectId: id, domain } },
    });
    if (existing && !existing.deletedAt) {
      return NextResponse.json(
        { error: 'This domain already exists in the project' },
        { status: 409 }
      );
    }

    // If setting as primary, unset other primaries
    if (isPrimary) {
      await db.domain.updateMany({
        where: { projectId: id, isPrimary: true, deletedAt: null },
        data: { isPrimary: false },
      });
    }

    const newDomain = await db.domain.create({
      data: {
        projectId: id,
        domain,
        isPrimary: isPrimary ?? false,
        verificationMethod: verificationMethod ?? null,
      },
    });

    // Log audit event
    await logAuditEvent({
      organizationId: access.project.organizationId,
      projectId: id,
      userId: user.id,
      action: 'domain_added',
      entity: 'domain',
      entityId: newDomain.id,
      changes: { domain, isPrimary },
    });

    return NextResponse.json({ domain: newDomain }, { status: 201 });
  } catch (error) {
    console.error('Add domain error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
