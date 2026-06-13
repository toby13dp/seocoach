import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { analyzeFacetedNavigation, saveFacetedIssues, getFacetedIssues } from '@/lib/ecommerce';

// GET /api/projects/[id]/faceted-issues — List faceted navigation issues
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

    const filters = {
      issueType: searchParams.get('issueType') ?? undefined,
      severity: searchParams.get('severity') ?? undefined,
      isResolved: searchParams.get('isResolved')
        ? searchParams.get('isResolved') === 'true'
        : undefined,
    };

    const issues = await getFacetedIssues(projectId, filters);

    return NextResponse.json({ data: issues });
  } catch (error) {
    console.error('Get faceted issues error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen facet-navigatie problemen' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/faceted-issues — Run faceted navigation analysis
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

    const issues = await analyzeFacetedNavigation(projectId);
    const savedCount = await saveFacetedIssues(projectId, issues);

    return NextResponse.json({
      data: { issuesDetected: issues.length, issuesSaved: savedCount },
    });
  } catch (error) {
    console.error('Analyze faceted navigation error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij analyseren facet-navigatie' },
      { status: 500 }
    );
  }
}
