/**
 * @fileoverview API Route — Account Deletion (GDPR Right to Erasure)
 *
 * POST /api/user/account-deletion
 * Supports three actions via the request body:
 *   - action: "request"  → Schedule account deletion (30-day grace period)
 *   - action: "confirm"  → Confirm and execute account deletion
 *   - action: "cancel"   → Cancel a scheduled account deletion
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {
  requestAccountDeletion,
  confirmAccountDeletion,
  cancelAccountDeletion,
  getDeletionStatus,
} from "@/lib/privacy/account-deletion";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const requestSchema = z.object({
  action: z.literal("request"),
});

const confirmSchema = z.object({
  action: z.literal("confirm"),
  confirmationCode: z.string().min(1, "Bevestigingscode is vereist"),
});

const cancelSchema = z.object({
  action: z.literal("cancel"),
});

const actionSchema = z.discriminatedUnion("action", [
  requestSchema,
  confirmSchema,
  cancelSchema,
]);

// ---------------------------------------------------------------------------
// POST
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
          error: "Ongeldige invoer. Gebruik action: 'request', 'confirm' of 'cancel'.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // --- Dispatch action -------------------------------------------------------
    switch (parsed.data.action) {
      case "request": {
        const { scheduledAt, confirmationCode } =
          await requestAccountDeletion(userId);
        return NextResponse.json(
          {
            message:
              "Accountverwijdering ingepland. U heeft 30 dagen bedenktijd.",
            scheduledAt: scheduledAt.toISOString(),
            confirmationCode,
          },
          { status: 200 }
        );
      }

      case "confirm": {
        await confirmAccountDeletion(
          userId,
          parsed.data.confirmationCode
        );
        return NextResponse.json(
          {
            message:
              "Uw account is definitief verwijderd. Al uw persoonsgegevens zijn geanonimiseerd.",
          },
          { status: 200 }
        );
      }

      case "cancel": {
        await cancelAccountDeletion(userId);
        return NextResponse.json(
          {
            message:
              "De geplande accountverwijdering is geannuleerd. Uw account blijft actief.",
          },
          { status: 200 }
        );
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Onbekende fout opgetreden";
    console.error("Account deletion error:", error);

    // Determine appropriate status code based on error message
    let status = 500;
    if (message.includes("niet gevonden")) status = 404;
    if (message.includes("al een verwijdering gepland")) status = 409;
    if (message.includes("Ongeldig bevestigingscode")) status = 400;
    if (message.includes("bedenktijd is nog niet verstreken")) status = 400;
    if (message.includes("Geen verwijdering gepland")) status = 404;

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}

// ---------------------------------------------------------------------------
// GET — Check deletion status
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

    // --- Get deletion status ---------------------------------------------------
    const status = await getDeletionStatus(session.user.id);

    return NextResponse.json(
      {
        deletionScheduled: status !== null,
        status: status
          ? {
              scheduledAt: status.scheduledAt.toISOString(),
              scheduledDeletionAt: status.scheduledDeletionAt.toISOString(),
            }
          : null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get deletion status error:", error);
    return NextResponse.json(
      { error: "Fout bij ophalen van verwijderingsstatus" },
      { status: 500 }
    );
  }
}
