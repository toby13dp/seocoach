import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import {
  getNotificationPreferences,
  createNotificationPreference,
  updateNotificationPreference,
} from '@/lib/alerts';
import type { NotificationPreferenceSettings, NotificationPreferenceUpdate } from '@/lib/alerts';

// GET /api/projects/[id]/alert-preferences — List alert notification preferences
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

    const preferences = await getNotificationPreferences(projectId, user.id);

    return NextResponse.json({ data: preferences });
  } catch (error) {
    console.error('Get alert preferences error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/alert-preferences — Create/update preference
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
    const { preferenceId, ...settings } = body as {
      preferenceId?: string;
    } & NotificationPreferenceSettings;

    if (!settings.channel) {
      return NextResponse.json(
        { error: 'channel is vereist (email, in_app, webhook)' },
        { status: 400 }
      );
    }

    let preference;

    if (preferenceId) {
      // Update existing preference
      const updates: NotificationPreferenceUpdate = {};
      if (settings.isEnabled !== undefined) updates.isEnabled = settings.isEnabled;
      if (settings.digestFrequency !== undefined) updates.digestFrequency = settings.digestFrequency;
      if (settings.quietHoursStart !== undefined) updates.quietHoursStart = settings.quietHoursStart;
      if (settings.quietHoursEnd !== undefined) updates.quietHoursEnd = settings.quietHoursEnd;

      preference = await updateNotificationPreference(preferenceId, updates);
    } else {
      // Create new preference
      preference = await createNotificationPreference(
        projectId,
        user.id,
        settings as NotificationPreferenceSettings
      );
    }

    return NextResponse.json({ data: preference }, { status: preferenceId ? 200 : 201 });
  } catch (error) {
    console.error('Create/update alert preference error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
