import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { snoozeAlert } from '@/lib/alerts';

// POST /api/projects/[id]/alerts/[alertId]/snooze — Snooze alert
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; alertId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, alertId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const existing = await db.alert.findFirst({
      where: { id: alertId, projectId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Waarschuwing niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { untilDate } = body as { untilDate?: string };

    if (!untilDate) {
      return NextResponse.json(
        { error: 'untilDate is vereist. Geef een datum op tot wanneer de waarschuwing moet worden uitgesteld.' },
        { status: 400 }
      );
    }

    const untilDateObj = new Date(untilDate);
    if (isNaN(untilDateObj.getTime())) {
      return NextResponse.json(
        { error: 'Ongeldig datumformaat voor untilDate.' },
        { status: 400 }
      );
    }

    if (untilDateObj <= new Date()) {
      return NextResponse.json(
        { error: 'untilDate moet in de toekomst liggen.' },
        { status: 400 }
      );
    }

    await snoozeAlert(alertId, user.id, untilDateObj);

    const updated = await db.alert.findUnique({
      where: { id: alertId },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Snooze alert error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
