import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { calculatePeriodComparison, calculateYearOverYear } from '@/lib/analytics';

// GET /api/projects/[id]/metrics/comparison — Get period comparison
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

    const { searchParams } = new URL(request.url);
    const metric = searchParams.get('metric') ?? 'clicks';
    const currentStart = searchParams.get('currentStart');
    const currentEnd = searchParams.get('currentEnd');
    const previousStart = searchParams.get('previousStart');
    const previousEnd = searchParams.get('previousEnd');
    const includeYoY = searchParams.get('includeYoY') === 'true';

    if (!currentStart || !currentEnd || !previousStart || !previousEnd) {
      return NextResponse.json(
        { error: 'currentStart, currentEnd, previousStart en previousEnd zijn vereiste parameters (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (![currentStart, currentEnd, previousStart, previousEnd].every((d) => dateRegex.test(d!))) {
      return NextResponse.json(
        { error: 'Ongeldig datumformaat. Gebruik YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    const comparison = await calculatePeriodComparison(
      projectId,
      metric,
      currentStart,
      currentEnd,
      previousStart,
      previousEnd
    );

    // Optionally include year-over-year comparison
    if (includeYoY) {
      const currentStartObj = new Date(currentStart + 'T00:00:00.000Z');
      const currentEndObj = new Date(currentEnd + 'T00:00:00.000Z');
      const yoyStart = new Date(currentStartObj);
      yoyStart.setFullYear(yoyStart.getFullYear() - 1);
      const yoyEnd = new Date(currentEndObj);
      yoyEnd.setFullYear(yoyEnd.getFullYear() - 1);

      const previousStartObj = new Date(previousStart + 'T00:00:00.000Z');
      const previousEndObj = new Date(previousEnd + 'T00:00:00.000Z');
      const yoyPrevStart = new Date(previousStartObj);
      yoyPrevStart.setFullYear(yoyPrevStart.getFullYear() - 1);
      const yoyPrevEnd = new Date(previousEndObj);
      yoyPrevEnd.setFullYear(yoyPrevEnd.getFullYear() - 1);

      const formatDateStr = (d: Date): string => {
        const year = d.getFullYear().toString();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const yoyComparison = await calculatePeriodComparison(
        projectId,
        metric,
        formatDateStr(yoyStart),
        formatDateStr(yoyEnd),
        formatDateStr(yoyPrevStart),
        formatDateStr(yoyPrevEnd)
      );

      comparison.yearOverYear = yoyComparison.current;
    }

    return NextResponse.json({ data: comparison });
  } catch (error) {
    console.error('Get metrics comparison error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
