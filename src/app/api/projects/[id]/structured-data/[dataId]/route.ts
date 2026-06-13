import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { updateStructuredData, approveStructuredData, deleteStructuredData } from '@/lib/structured-data/generator';
import { validateStructuredData } from '@/lib/structured-data/validator';

// GET /api/projects/[id]/structured-data/[dataId] — Get structured data entry with validation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dataId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, dataId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const entry = await db.structuredData.findFirst({
      where: { id: dataId, projectId },
    });

    if (!entry) {
      return NextResponse.json(
        { error: 'Gestructureerde data niet gevonden' },
        { status: 404 }
      );
    }

    // Run validation on the current data
    let parsedData: Record<string, unknown>;
    try {
      parsedData = JSON.parse(entry.data);
    } catch {
      parsedData = {};
    }

    const validation = validateStructuredData(entry.type, parsedData);

    return NextResponse.json({
      data: {
        ...entry,
        validation,
      },
    });
  } catch (error) {
    console.error('Get structured data error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/structured-data/[dataId] — Update/approve
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dataId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, dataId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const entry = await db.structuredData.findFirst({
      where: { id: dataId, projectId },
    });

    if (!entry) {
      return NextResponse.json(
        { error: 'Gestructureerde data niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Handle approve action
    if (body.approve === true) {
      await approveStructuredData(dataId, user.id);
      return NextResponse.json({ data: { id: dataId, approved: true } });
    }

    // Handle data update
    if (body.data) {
      const result = await updateStructuredData(dataId, body.data, entry.type);
      return NextResponse.json({ data: result });
    }

    return NextResponse.json(
      { error: 'Geen geldige actie opgegeven. Gebruik "approve" of geef "data" mee.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Update structured data error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/structured-data/[dataId] — Delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dataId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, dataId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const entry = await db.structuredData.findFirst({
      where: { id: dataId, projectId },
    });

    if (!entry) {
      return NextResponse.json(
        { error: 'Gestructureerde data niet gevonden' },
        { status: 404 }
      );
    }

    await deleteStructuredData(dataId);

    return NextResponse.json({ data: { id: dataId, deleted: true } });
  } catch (error) {
    console.error('Delete structured data error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
