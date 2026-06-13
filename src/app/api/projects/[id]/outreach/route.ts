import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getOutreachCampaigns, createOutreachCampaign } from '@/lib/authority';

// GET /api/projects/[id]/outreach — List campaigns
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

    const campaigns = await getOutreachCampaigns(projectId);

    return NextResponse.json({
      data: campaigns,
      meta: { total: campaigns.length },
    });
  } catch (error) {
    console.error('List outreach campaigns error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/outreach — Create campaign
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
    const { name, description, targetCount, startDate, endDate } = body;

    if (!name) {
      return NextResponse.json({ error: 'Naam is vereist' }, { status: 400 });
    }

    const campaign = await createOutreachCampaign(projectId, {
      name,
      description,
      targetCount,
      startDate,
      endDate,
    });

    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch (error) {
    console.error('Create outreach campaign error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
