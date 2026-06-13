import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { analyzeCROFindings, getCROFindings, generateManualFinding } from '@/lib/cro';
import type { CROFindingData } from '@/lib/cro';

// GET /api/projects/[id]/cro-findings — List CRO findings with filters
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
    const category = searchParams.get('category') ?? undefined;
    const severity = searchParams.get('severity') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const pageUrl = searchParams.get('pageUrl') ?? undefined;

    const filters: Parameters<typeof getCROFindings>[1] = {};
    if (category) filters.category = category as CROFindingData['category'];
    if (severity) filters.severity = severity as CROFindingData['severity'];
    if (status) filters.status = status;
    if (pageUrl) filters.pageUrl = pageUrl;

    const findings = await getCROFindings(projectId, filters);

    return NextResponse.json({
      data: findings,
      meta: { total: findings.length },
    });
  } catch (error) {
    console.error('List CRO findings error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/cro-findings — Run CRO analysis or create manual finding
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

    // Manual finding creation
    if (body.manual === true) {
      const { category, severity, title, description, recommendation, evidence, pageUrl, estimatedImpact, effort } = body as Partial<CROFindingData> & { manual?: boolean };

      if (!category || !severity || !title || !description || !recommendation) {
        return NextResponse.json(
          { error: 'category, severity, title, description en recommendation zijn vereist voor een handmatige bevinding' },
          { status: 400 }
        );
      }

      const validCategories = ['CTA', 'FORMS', 'TRUST', 'VALUE_PROPOSITION', 'PRICING_COMMUNICATION', 'MOBILE_UX', 'FUNNELS', 'LANDING_PAGES', 'PRODUCT_PAGES'];
      if (!validCategories.includes(category)) {
        return NextResponse.json(
          { error: `Ongeldig category. Geldige waarden: ${validCategories.join(', ')}` },
          { status: 400 }
        );
      }

      const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      if (!validSeverities.includes(severity)) {
        return NextResponse.json(
          { error: `Ongeldig severity. Geldige waarden: ${validSeverities.join(', ')}` },
          { status: 400 }
        );
      }

      const data: CROFindingData = {
        category: category as CROFindingData['category'],
        severity: severity as CROFindingData['severity'],
        title,
        description,
        recommendation,
      };

      if (evidence) data.evidence = evidence;
      if (pageUrl) data.pageUrl = pageUrl;
      if (estimatedImpact) data.estimatedImpact = estimatedImpact;
      if (effort) data.effort = effort;

      const finding = await generateManualFinding(projectId, data);

      return NextResponse.json({ data: finding }, { status: 201 });
    }

    // Automated CRO analysis
    const findings = await analyzeCROFindings(projectId);

    return NextResponse.json({
      data: findings,
      meta: { total: findings.length },
    });
  } catch (error) {
    console.error('CRO findings POST error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
