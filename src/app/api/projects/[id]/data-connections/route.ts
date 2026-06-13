import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { createDataConnection, getSyncStatus } from '@/lib/analytics';
import type { DataConnectionConfig } from '@/lib/analytics';

// GET /api/projects/[id]/data-connections — List data connections for a project
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
    const type = searchParams.get('type') ?? undefined;
    const status = searchParams.get('status') ?? undefined;

    const where: Record<string, unknown> = {
      projectId,
      deletedAt: null,
    };

    if (type) where.type = type;
    if (status) where.status = status;

    const [connections, syncStatus] = await Promise.all([
      db.dataConnection.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
      getSyncStatus(projectId),
    ]);

    return NextResponse.json({
      data: connections,
      meta: {
        total: connections.length,
        syncStatus,
      },
    });
  } catch (error) {
    console.error('List data connections error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/data-connections — Create a new data connection
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
    const { name, type, config } = body as {
      name: string;
      type: string;
      config?: DataConnectionConfig;
    };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Verbindingsnaam is vereist' },
        { status: 400 }
      );
    }

    if (!type || typeof type !== 'string') {
      return NextResponse.json(
        { error: 'Verbindingstype is vereist' },
        { status: 400 }
      );
    }

    const allowedTypes = [
      'GOOGLE_SEARCH_CONSOLE',
      'GOOGLE_ANALYTICS_4',
      'CSV_SEARCH_PERFORMANCE',
      'CSV_ANALYTICS',
      'CSV_CONVERSIONS',
      'CSV_REVENUE',
      'GOOGLE_BUSINESS_PROFILE',
    ];

    if (!allowedTypes.includes(type)) {
      return NextResponse.json(
        { error: `Ongeldig verbindingstype. Toegestane types: ${allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const connection = await createDataConnection(
      projectId,
      name,
      type,
      config ?? {}
    );

    return NextResponse.json({ data: connection }, { status: 201 });
  } catch (error) {
    console.error('Create data connection error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
