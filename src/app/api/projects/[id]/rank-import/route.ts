import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { importRankCSV } from '@/lib/local-seo';
import { logAuditEvent } from '@/lib/audit';

const MAX_CSV_SIZE = 5 * 1024 * 1024; // 5MB

// POST /api/projects/[id]/rank-import — Import rank CSV data
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

    // Check content type
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Verzoek moet multipart/form-data zijn' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const csvFile = formData.get('csvFile');

    if (!csvFile || !(csvFile instanceof File)) {
      return NextResponse.json(
        { error: 'CSV-bestand is verplicht' },
        { status: 400 }
      );
    }

    // Check file size
    if (csvFile.size > MAX_CSV_SIZE) {
      return NextResponse.json(
        { error: 'CSV-bestand mag maximaal 5MB zijn' },
        { status: 400 }
      );
    }

    // Check file extension
    const fileName = csvFile.name.toLowerCase();
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.tsv')) {
      return NextResponse.json(
        { error: 'Alleen CSV- en TSV-bestanden zijn toegestaan' },
        { status: 400 }
      );
    }

    const csvContent = await csvFile.text();

    if (!csvContent.trim()) {
      return NextResponse.json(
        { error: 'CSV-bestand is leeg' },
        { status: 400 }
      );
    }

    const locationId = (formData.get('locationId') as string) ?? undefined;

    const result = await importRankCSV(projectId, csvContent, locationId);

    await logAuditEvent({
      organizationId: access.project.organizationId,
      projectId,
      userId: user.id,
      action: 'rank_csv_imported',
      entity: 'rank_import',
      entityId: result.batch,
      changes: {
        rowCount: result.rowCount,
        successCount: result.successCount,
        errorCount: result.errorCount,
      },
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error('Fout bij importeren CSV-ranglijst:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij importeren CSV-ranglijst' },
      { status: 500 }
    );
  }
}
