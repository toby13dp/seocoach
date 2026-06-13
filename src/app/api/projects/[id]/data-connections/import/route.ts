import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { syncData, createDataConnection } from '@/lib/analytics';

// POST /api/projects/[id]/data-connections/import — Upload CSV file for import
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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const connectionType = (formData.get('type') as string) ?? 'CSV_SEARCH_PERFORMANCE';
    const connectionName = (formData.get('name') as string) ?? `CSV-import ${new Date().toLocaleDateString('nl-NL')}`;
    const connectionId = formData.get('connectionId') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Geen bestand geüpload. Voeg een CSV-bestand toe.' },
        { status: 400 }
      );
    }

    // Read the file content as text
    const csvContent = await file.text();

    if (!csvContent || csvContent.trim().length === 0) {
      return NextResponse.json(
        { error: 'Het geüploade bestand is leeg.' },
        { status: 400 }
      );
    }

    // If no existing connection, create one
    let syncConnectionId = connectionId;
    if (!syncConnectionId) {
      const connection = await createDataConnection(
        projectId,
        connectionName,
        connectionType,
        { fileName: file.name, autoSync: false }
      );
      syncConnectionId = connection.id;
    }

    // Trigger sync with the CSV content
    const result = await syncData(syncConnectionId, csvContent);

    return NextResponse.json({
      data: {
        success: result.success,
        message: result.message,
        fileName: file.name,
        connectionId: syncConnectionId,
        result: result.result ?? null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Import CSV error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
