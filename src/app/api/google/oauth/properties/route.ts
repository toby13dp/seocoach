// ============================================================================
// Google OAuth — Properties Listing Endpoint
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Lists available Google properties (GSC sites, GA4 properties, GBP accounts)
// for a given connection. Used when configuring which property to sync.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { listGSCProperties, listGA4Properties, listGBPSccounts, listGBPLocations } from '@/lib/google';
import { db } from '@/lib/db';

// GET /api/google/oauth/properties?projectId=...&connectionId=...
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Niet geauthenticeerd' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const connectionId = searchParams.get('connectionId');

    if (!projectId || !connectionId) {
      return NextResponse.json(
        { error: 'projectId en connectionId zijn vereist' },
        { status: 400 }
      );
    }

    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json(
        { error: 'Geen toegang tot dit project' },
        { status: 403 }
      );
    }

    // Get the connection type
    const connection = await db.dataConnection.findFirst({
      where: { id: connectionId, projectId, deletedAt: null },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Gegevensverbinding niet gevonden' },
        { status: 404 }
      );
    }

    let properties: Record<string, unknown>[] = [];

    switch (connection.type) {
      case 'GOOGLE_SEARCH_CONSOLE': {
        const sites = await listGSCProperties(connectionId);
        properties = sites.map((s) => ({
          id: s.siteUrl,
          name: s.siteUrl,
          type: 'gsc_property',
          permissionLevel: s.permissionLevel,
        }));
        break;
      }

      case 'GOOGLE_ANALYTICS_4': {
        const ga4Props = await listGA4Properties(connectionId);
        properties = ga4Props.map((p) => ({
          id: p.propertyId,
          name: p.propertyName,
          type: 'ga4_property',
          accountId: p.accountId,
        }));
        break;
      }

      case 'GOOGLE_BUSINESS_PROFILE': {
        const accounts = await listGBPSccounts(connectionId);
        // For each account, also fetch locations
        const accountsWithLocations = await Promise.all(
          accounts.map(async (acc) => {
            const locations = await listGBPLocations(connectionId, acc.name).catch(() => []);
            return {
              id: acc.name,
              name: acc.accountName || acc.name,
              type: 'gbp_account',
              locations: locations.map((loc) => ({
                id: loc.name,
                name: loc.title,
                storeCode: loc.storeCode,
              })),
            };
          })
        );
        properties = accountsWithLocations;
        break;
      }

      default:
        return NextResponse.json(
          { error: `Ongeldig verbindingstype: ${connection.type}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      data: {
        connectionType: connection.type,
        properties,
      },
    });
  } catch (error) {
    console.error('Google properties listing error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
