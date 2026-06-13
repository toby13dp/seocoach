import { NextRequest, NextResponse } from 'next/server';
import { accessSharedReport } from '@/lib/reporting';

// GET /api/shared-reports/[token] — Access shared report (public, no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return NextResponse.json(
        { error: 'Ongeldige deelverwijzing' },
        { status: 400 }
      );
    }

    // Check for password in query params
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('password') ?? undefined;

    const result = await accessSharedReport(token, password);

    if (!result.granted) {
      return NextResponse.json(
        { error: result.reason ?? 'Toegang geweigerd' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      data: result.report,
    });
  } catch (error) {
    console.error('Access shared report error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/shared-reports/[token] — Access shared report with password in body
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return NextResponse.json(
        { error: 'Ongeldige deelverwijzing' },
        { status: 400 }
      );
    }

    let password: string | undefined;
    try {
      const body = await request.json();
      password = body.password;
    } catch {
      // No body provided
    }

    const result = await accessSharedReport(token, password);

    if (!result.granted) {
      return NextResponse.json(
        { error: result.reason ?? 'Toegang geweigerd' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      data: result.report,
    });
  } catch (error) {
    console.error('Access shared report error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
