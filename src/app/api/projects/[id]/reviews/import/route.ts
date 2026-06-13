import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { importReviewsCSV } from '@/lib/reviews';
import { ReviewSource } from '@prisma/client';

const VALID_SOURCES: ReviewSource[] = [
  'GOOGLE',
  'WOOCOMMERCE',
  'TRUSTPILOT',
  'CSV_IMPORT',
  'SURVEY',
  'SUPPORT_FEEDBACK',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// POST /api/projects/[id]/reviews/import — Import reviews from CSV
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

    // Extract CSV file
    const csvFile = formData.get('csvFile');
    if (!csvFile || !(csvFile instanceof File)) {
      return NextResponse.json(
        { error: 'CSV-bestand (csvFile) is verplicht' },
        { status: 400 }
      );
    }

    // Validate file size
    if (csvFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Bestand is te groot. Maximum grootte is 5MB.' },
        { status: 400 }
      );
    }

    // Extract source
    const sourceStr = formData.get('source') as string | null;
    if (!sourceStr) {
      return NextResponse.json(
        { error: 'Bron (source) is verplicht' },
        { status: 400 }
      );
    }

    if (!VALID_SOURCES.includes(sourceStr as ReviewSource)) {
      return NextResponse.json(
        { error: `Ongeldige bron. Geldige waarden: ${VALID_SOURCES.join(', ')}` },
        { status: 400 }
      );
    }

    const source = sourceStr as ReviewSource;

    // Extract optional locationId
    const locationId = (formData.get('locationId') as string | null) ?? undefined;

    // Read file content
    const csvContent = await csvFile.text();

    if (csvContent.trim().length === 0) {
      return NextResponse.json(
        { error: 'CSV-bestand is leeg' },
        { status: 400 }
      );
    }

    // Import reviews
    const result = await importReviewsCSV(projectId, csvContent, source, locationId);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error('Import reviews error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij importeren reviews' },
      { status: 500 }
    );
  }
}
