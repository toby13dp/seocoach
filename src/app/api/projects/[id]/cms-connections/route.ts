import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/projects/[id]/cms-connections — List all CMS connections for project
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

    const connections = await db.cMSConnection.findMany({
      where: {
        projectId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        providerType: true,
        status: true,
        baseUrl: true,
        lastTestedAt: true,
        lastError: true,
        capabilities: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: connections });
  } catch (error) {
    console.error('List CMS connections error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/cms-connections — Create new CMS connection
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

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Verbindingsnaam is vereist' },
        { status: 400 }
      );
    }

    if (!body.providerType || !['WORDPRESS', 'WOOCOMMERCE', 'SHOPIFY', 'CUSTOM'].includes(body.providerType)) {
      return NextResponse.json(
        { error: 'Ongeldig providertype. Geldige types: WORDPRESS, WOOCOMMERCE, SHOPIFY, CUSTOM' },
        { status: 400 }
      );
    }

    if (!body.baseUrl || typeof body.baseUrl !== 'string') {
      return NextResponse.json(
        { error: 'Basis-URL is vereist' },
        { status: 400 }
      );
    }

    const connection = await db.cMSConnection.create({
      data: {
        projectId,
        name: body.name,
        providerType: body.providerType,
        baseUrl: body.baseUrl,
        apiKey: body.apiKey ?? null,
        apiSecret: body.apiSecret ?? null,
        username: body.username ?? null,
        status: 'PENDING',
        metadata: body.metadata ? JSON.stringify(body.metadata) : null,
      },
    });

    return NextResponse.json({ data: connection }, { status: 201 });
  } catch (error) {
    console.error('Create CMS connection error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
