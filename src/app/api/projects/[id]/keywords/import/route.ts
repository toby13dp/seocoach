import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { parseCSV, importKeywords } from '@/lib/keywords';

// POST /api/projects/[id]/keywords/import — Import keywords from CSV
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('csv') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'CSV file is required. Use form field "csv".' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'text/plain') {
      return NextResponse.json(
        { error: 'File must be a CSV file' },
        { status: 400 }
      );
    }

    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be under 5MB' },
        { status: 400 }
      );
    }

    const csvText = await file.text();

    if (!csvText.trim()) {
      return NextResponse.json(
        { error: 'CSV file is empty' },
        { status: 400 }
      );
    }

    // Parse the CSV
    const parsed = parseCSV(csvText);

    if (parsed.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows found in CSV' },
        { status: 400 }
      );
    }

    // Import keywords into the project
    const result = await importKeywords(projectId, parsed, 'csv');

    return NextResponse.json(
      {
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Import keywords error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
