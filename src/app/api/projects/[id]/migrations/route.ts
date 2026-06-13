import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getMigrationProjects, createMigrationProject } from '@/lib/migration/migration-manager';
import { db } from '@/lib/db';

// GET /api/projects/[id]/migrations — List migration projects
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

    const migrations = await getMigrationProjects(projectId);

    return NextResponse.json({ migrations });
  } catch (error) {
    console.error('List migrations error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/migrations — Create a migration project
export async function POST(
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

    const body = await request.json();
    const { name, oldSiteUrl, newSiteUrl, plannedLaunchDate, description } = body;

    if (!name || !oldSiteUrl || !newSiteUrl) {
      return NextResponse.json(
        { error: 'Naam, oude site URL en nieuwe site URL zijn verplicht' },
        { status: 400 }
      );
    }

    // Get the project to find the organizationId
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 });
    }

    const migration = await createMigrationProject({
      organizationId: project.organizationId,
      projectId,
      name,
      description,
      oldSiteUrl,
      newSiteUrl,
      plannedLaunchDate: plannedLaunchDate ? new Date(plannedLaunchDate) : undefined,
    });

    return NextResponse.json({ migration }, { status: 201 });
  } catch (error) {
    console.error('Create migration error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
