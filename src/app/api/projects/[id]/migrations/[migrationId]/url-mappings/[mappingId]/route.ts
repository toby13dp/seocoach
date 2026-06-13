import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { updateUrlMapping } from '@/lib/migration';
import { db } from '@/lib/db';

// PUT /api/projects/[id]/migrations/[migrationId]/url-mappings/[mappingId] — Update URL mapping
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; migrationId: string; mappingId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 });
    }

    const { id: projectId, migrationId, mappingId } = await params;
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

    // Verify mapping belongs to this migration
    const existingMapping = await db.migrationUrlMapping.findFirst({
      where: { id: mappingId, migrationProjectId: migrationId, deletedAt: null },
    });

    if (!existingMapping) {
      return NextResponse.json({ error: 'URL-mapping niet gevonden' }, { status: 404 });
    }

    const body = await request.json();
    const {
      newUrl,
      redirectType,
      metadataStatus,
      headingsStatus,
      contentStatus,
      canonicalStatus,
      robotsStatus,
      structuredDataStatus,
      internalLinksStatus,
      metadataDiff,
      headingsDiff,
      contentDiff,
      canonicalDiff,
      robotsDiff,
      structuredDataDiff,
      internalLinksDiff,
      notes,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (newUrl !== undefined) updateData.newUrl = newUrl;
    if (redirectType !== undefined) updateData.redirectType = redirectType;
    if (metadataStatus !== undefined) updateData.metadataStatus = metadataStatus;
    if (headingsStatus !== undefined) updateData.headingsStatus = headingsStatus;
    if (contentStatus !== undefined) updateData.contentStatus = contentStatus;
    if (canonicalStatus !== undefined) updateData.canonicalStatus = canonicalStatus;
    if (robotsStatus !== undefined) updateData.robotsStatus = robotsStatus;
    if (structuredDataStatus !== undefined) updateData.structuredDataStatus = structuredDataStatus;
    if (internalLinksStatus !== undefined) updateData.internalLinksStatus = internalLinksStatus;
    if (metadataDiff !== undefined) updateData.metadataDiff = metadataDiff;
    if (headingsDiff !== undefined) updateData.headingsDiff = headingsDiff;
    if (contentDiff !== undefined) updateData.contentDiff = contentDiff;
    if (canonicalDiff !== undefined) updateData.canonicalDiff = canonicalDiff;
    if (robotsDiff !== undefined) updateData.robotsDiff = robotsDiff;
    if (structuredDataDiff !== undefined) updateData.structuredDataDiff = structuredDataDiff;
    if (internalLinksDiff !== undefined) updateData.internalLinksDiff = internalLinksDiff;
    if (notes !== undefined) updateData.notes = notes;

    const mapping = await updateUrlMapping(mappingId, updateData);

    return NextResponse.json({ data: mapping });
  } catch (error) {
    console.error('URL-mapping bijwerken fout:', error);
    return NextResponse.json({ error: 'Interne serverfout bij bijwerken van URL-mapping' }, { status: 500 });
  }
}
