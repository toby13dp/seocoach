import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { testWordPressConnection } from '@/lib/cms/wordpress';
import { testWooCommerceConnection } from '@/lib/cms/woocommerce';

// POST /api/projects/[id]/cms-connections/[connectionId]/test — Test the connection
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

    const connection = await db.cMSConnection.findFirst({
      where: { id: connectionId, projectId, deletedAt: null },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'CMS-verbinding niet gevonden' },
        { status: 404 }
      );
    }

    let testResult: { success: boolean; message: string; capabilities?: Record<string, boolean> };

    try {
      if (connection.providerType === 'WORDPRESS') {
        const wpResult = await testWordPressConnection(connectionId);
        testResult = {
          success: wpResult.success,
          message: wpResult.error ?? (wpResult.success ? 'WordPress-verbinding succesvol getest.' : 'WordPress-verbindingstest mislukt.'),
          capabilities: wpResult.capabilities as unknown as Record<string, boolean>,
        };
      } else if (connection.providerType === 'WOOCOMMERCE') {
        const wooResult = await testWooCommerceConnection(connectionId);
        testResult = {
          success: true,
          message: 'WooCommerce-verbinding succesvol getest.',
          capabilities: Object.fromEntries(wooResult.capabilities.map(c => [c, true])),
        };
      } else {
        // Generic test for SHOPIFY or CUSTOM
        testResult = {
          success: false,
          message: `Testen van "${connection.providerType}" verbindingen wordt nog niet ondersteund.`,
        };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      testResult = { success: false, message: msg };
    }

    // Update the connection status based on the test result
    await db.cMSConnection.update({
      where: { id: connectionId },
      data: {
        status: testResult.success ? 'CONNECTED' : 'ERROR',
        lastTestedAt: new Date(),
        lastError: testResult.success ? null : testResult.message,
        capabilities: testResult.capabilities
          ? JSON.stringify(testResult.capabilities)
          : null,
      },
    });

    return NextResponse.json({
      data: {
        connectionId,
        providerType: connection.providerType,
        success: testResult.success,
        message: testResult.message,
        capabilities: testResult.capabilities ?? null,
      },
    });
  } catch (error) {
    console.error('Test CMS connection error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
