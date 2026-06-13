import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { testConnection } from '@/lib/analytics';

// POST /api/projects/[id]/data-connections/[connectionId]/test — Test the connection
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; connectionId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, connectionId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const result = await testConnection(connectionId);

    return NextResponse.json({
      data: {
        success: result.success,
        message: result.message,
      },
    });
  } catch (error) {
    console.error('Test data connection error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
