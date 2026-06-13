/**
 * @fileoverview API Route — User Consent Management
 *
 * GET /api/user/consent
 * Get all current consents and consent history for the authenticated user.
 *
 * POST /api/user/consent
 * Record or withdraw consent. Supports two actions:
 *   - action: "record"   → Record a consent action (grant or deny)
 *   - action: "withdraw" → Withdraw a previously granted consent
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {
  ConsentType,
  recordConsent,
  checkConsent,
  withdrawConsent,
  getConsentHistory,
} from "@/lib/privacy/consent-manager";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const consentTypeEnum = z.enum([
  "ANALYTICS",
  "BEHAVIOUR_TRACKING",
  "EXTERNAL_AI",
  "EMAIL_MARKETING",
]);

const recordSchema = z.object({
  action: z.literal("record"),
  consentType: consentTypeEnum,
  granted: z.boolean(),
  evidence: z.string().min(1, "Evidence is vereist"),
});

const withdrawSchema = z.object({
  action: z.literal("withdraw"),
  consentType: consentTypeEnum,
  evidence: z.string().optional(),
});

const actionSchema = z.discriminatedUnion("action", [
  recordSchema,
  withdrawSchema,
]);

// ---------------------------------------------------------------------------
// GET — Get all consents and history
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    // --- Authentication --------------------------------------------------------
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Niet geauthenticeerd" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // --- Get current consent states --------------------------------------------
    const consentTypes = Object.values(ConsentType) as ConsentType[];
    const currentConsents: Record<string, boolean> = {};

    for (const ct of consentTypes) {
      currentConsents[ct] = await checkConsent(userId, ct);
    }

    // --- Get full consent history ----------------------------------------------
    const history = await getConsentHistory(userId);

    return NextResponse.json(
      {
        consents: currentConsents,
        history,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get consent error:", error);
    return NextResponse.json(
      { error: "Fout bij ophalen van toestemmingsgegevens" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Record or withdraw consent
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // --- Authentication --------------------------------------------------------
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Niet geauthenticeerd" },
        { status: 401 }
      );
    }

    // --- Input validation ------------------------------------------------------
    const body = await request.json();
    const parsed = actionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Ongeldige invoer. Gebruik action: 'record' of 'withdraw'.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // Extract request metadata for audit trail
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      null;
    const userAgent = request.headers.get("user-agent") ?? null;

    // --- Dispatch action -------------------------------------------------------
    switch (parsed.data.action) {
      case "record": {
        await recordConsent(
          userId,
          parsed.data.consentType as ConsentType,
          parsed.data.granted,
          parsed.data.evidence,
          ipAddress ?? undefined,
          userAgent ?? undefined
        );

        const action = parsed.data.granted ? "verleend" : "geweigerd";
        return NextResponse.json(
          {
            message: `Toestemming voor ${parsed.data.consentType} is ${action}.`,
            consentType: parsed.data.consentType,
            granted: parsed.data.granted,
          },
          { status: 200 }
        );
      }

      case "withdraw": {
        const evidence =
          parsed.data.evidence ?? "user_withdrawal_via_settings";
        await withdrawConsent(
          userId,
          parsed.data.consentType as ConsentType,
          evidence,
          ipAddress ?? undefined,
          userAgent ?? undefined
        );

        return NextResponse.json(
          {
            message: `Toestemming voor ${parsed.data.consentType} is ingetrokken.`,
            consentType: parsed.data.consentType,
            granted: false,
          },
          { status: 200 }
        );
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Onbekende fout opgetreden";
    console.error("Consent action error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
