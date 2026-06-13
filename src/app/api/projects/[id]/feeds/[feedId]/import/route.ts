import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { importFeed } from '@/lib/product-feeds';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// POST /api/projects/[id]/feeds/[feedId]/import — Import feed data from uploaded file
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; feedId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, feedId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const format = formData.get('format') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Geen bestand geüpload. Voeg een bestand toe aan het verzoek.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Bestand is te groot. Maximaal 10 MB toegestaan.' },
        { status: 400 }
      );
    }

    const content = await file.text();

    if (!content.trim()) {
      return NextResponse.json(
        { error: 'Bestand is leeg. Upload een bestand met feed-data.' },
        { status: 400 }
      );
    }

    const validFormats = ['xml', 'csv', 'tsv'];
    const normalizedFormat = format?.toLowerCase() as 'xml' | 'csv' | 'tsv' | undefined;
    if (normalizedFormat && !validFormats.includes(normalizedFormat)) {
      return NextResponse.json(
        { error: 'Ongeldig formaat. Ondersteunde formaten: xml, csv, tsv.' },
        { status: 400 }
      );
    }

    const result = await importFeed(
      projectId,
      feedId,
      content,
      normalizedFormat,
    );

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Import feed error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij importeren feed' },
      { status: 500 }
    );
  }
}
