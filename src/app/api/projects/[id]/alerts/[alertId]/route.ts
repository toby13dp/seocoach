import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import {
  acknowledgeAlert,
  resolveAlert,
  dismissAlert,
  assignAlert,
  snoozeAlert,
} from '@/lib/alerts';

// GET /api/projects/[id]/alerts/[alertId] — Get alert details
export async function GET(
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

    const alert = await db.alert.findFirst({
      where: { id: alertId, projectId },
    });

    if (!alert) {
      return NextResponse.json(
        { error: 'Waarschuwing niet gevonden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: alert });
  } catch (error) {
    console.error('Get alert error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/alerts/[alertId] — Update alert (acknowledge, snooze, resolve, dismiss, assign)
export async function PATCH(
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
    const { action, resolution, assignedTo, untilDate } = body as {
      action?: string;
      resolution?: string;
      assignedTo?: string;
      untilDate?: string;
    };

    switch (action) {
      case 'acknowledge':
        await acknowledgeAlert(alertId, user.id);
        break;

      case 'resolve':
        await resolveAlert(alertId, user.id, resolution ?? 'Opgelost door gebruiker');
        break;

      case 'dismiss':
        await dismissAlert(alertId, user.id);
        break;

      case 'assign':
        if (!assignedTo) {
          return NextResponse.json(
            { error: 'assignedTo is vereist voor het toewijzen van een waarschuwing' },
            { status: 400 }
          );
        }
        await assignAlert(alertId, assignedTo);
        break;

      case 'snooze':
        if (!untilDate) {
          return NextResponse.json(
            { error: 'untilDate is vereist voor het uitstellen van een waarschuwing' },
            { status: 400 }
          );
        }
        await snoozeAlert(alertId, user.id, new Date(untilDate));
        break;

      default:
        return NextResponse.json(
          { error: 'Ongeldige actie. Gebruik: acknowledge, resolve, dismiss, assign of snooze' },
          { status: 400 }
        );
    }

    const updated = await db.alert.findUnique({
      where: { id: alertId },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update alert error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
