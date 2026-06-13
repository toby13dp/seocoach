import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { importCsvResults, calculateSummary } from '@/lib/ai-visibility';

// POST /api/projects/[id]/ai-visibility/import — Import CSV results
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
    const { records } = body;

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'records array is vereist en mag niet leeg zijn' }, { status: 400 });
    }

    const result = await importCsvResults(projectId, records);

    // Recalculate summary
    await calculateSummary(projectId);

    return NextResponse.json({
      data: result,
      meta: {
        importedCount: result.count,
        batchId: result.batchId,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Import AI visibility CSV error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
