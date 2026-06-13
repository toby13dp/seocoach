import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { isLaunchReady, createPreLaunchCheck, updatePreLaunchCheck } from '@/lib/migration';
import { db } from '@/lib/db';

// GET /api/projects/[id]/migrations/[migrationId]/launch-check — Check if launch ready
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; migrationId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 });
    }

    const { id: projectId, migrationId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang tot dit project' }, { status: 403 });
    }

    // Verify migration belongs to this project
    const migration = await db.migrationProject.findFirst({
      where: { id: migrationId, projectId, deletedAt: null },
    });

    if (!migration) {
      return NextResponse.json({ error: 'Migratieproject niet gevonden' }, { status: 404 });
    }

    const launchStatus = await isLaunchReady(migrationId);

    return NextResponse.json({ data: launchStatus });
  } catch (error) {
    console.error('Lanceercontrole fout:', error);
    return NextResponse.json({ error: 'Interne serverfout bij lanceercontrole' }, { status: 500 });
  }
}

// POST /api/projects/[id]/migrations/[migrationId]/launch-check — Create or update pre-launch check
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; migrationId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 });
    }

    const { id: projectId, migrationId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang tot dit project' }, { status: 403 });
    }

    // Verify migration belongs to this project
    const migration = await db.migrationProject.findFirst({
      where: { id: migrationId, projectId, deletedAt: null },
    });

    if (!migration) {
      return NextResponse.json({ error: 'Migratieproject niet gevonden' }, { status: 404 });
    }

    const body = await request.json();

    // Update existing check: { checkId, status, details }
    if (body.checkId) {
      if (!body.status) {
        return NextResponse.json(
          { error: 'Status is vereist bij het bijwerken van een controle' },
          { status: 400 }
        );
      }

      // Verify check belongs to this migration
      const existingCheck = await db.migrationPreLaunchCheck.findFirst({
        where: { id: body.checkId, migrationProjectId: migrationId, deletedAt: null },
      });

      if (!existingCheck) {
        return NextResponse.json(
          { error: 'Pre-lanceercontrole niet gevonden' },
          { status: 404 }
        );
      }

      const check = await updatePreLaunchCheck(body.checkId, {
        status: body.status,
        details: body.details,
        checkedBy: user.id,
      });

      return NextResponse.json({ data: check });
    }

    // Create new check: { category, title, description? }
    if (!body.category || typeof body.category !== 'string') {
      return NextResponse.json(
        { error: 'Categorie is vereist' },
        { status: 400 }
      );
    }

    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json(
        { error: 'Titel is vereist' },
        { status: 400 }
      );
    }

    const check = await createPreLaunchCheck({
      migrationProjectId: migrationId,
      category: body.category,
      title: body.title,
      description: body.description,
    });

    return NextResponse.json({ data: check }, { status: 201 });
  } catch (error) {
    console.error('Pre-lanceercontrole fout:', error);
    return NextResponse.json({ error: 'Interne serverfout bij pre-lanceercontrole' }, { status: 500 });
  }
}
