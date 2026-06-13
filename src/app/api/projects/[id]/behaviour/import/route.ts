import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { importBehaviourCSV } from '@/lib/cro';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// POST /api/projects/[id]/behaviour/import — Import behaviour CSV
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
    const file = formData.get('csvFile') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Geen bestand geüpload. Voeg een CSV-bestand toe met de naam csvFile.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Bestand is te groot. Maximum grootte is 5MB.' },
        { status: 400 }
      );
    }

    const csvContent = await file.text();

    if (!csvContent || csvContent.trim().length === 0) {
      return NextResponse.json(
        { error: 'Het geüploade bestand is leeg.' },
        { status: 400 }
      );
    }

    const result = await importBehaviourCSV(projectId, csvContent, 'csv_upload');

    return NextResponse.json({
      data: {
        imported: result.imported,
        errors: result.errors,
        fileName: file.name,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Import behaviour CSV error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
