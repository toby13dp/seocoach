/**
 * @fileoverview API Route — Project Deletion
 *
 * POST /api/projects/[id]/deletion
 * Supports three actions via the request body:
 *   - action: "request"  → Schedule project deletion (7-day grace period)
 *   - action: "confirm"  → Confirm and execute project deletion
 *   - action: "cancel"   → Cancel a scheduled project deletion
 *
 * GET /api/projects/[id]/deletion
 * Get the current deletion status for a project.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {
  requestProjectDeletion,
  confirmProjectDeletion,
  cancelProjectDeletion,
  getProjectDeletionStatus,
} from "@/lib/privacy/project-deletion";

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
// Route params type
// ---------------------------------------------------------------------------

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // --- Authentication --------------------------------------------------------
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Niet geauthenticeerd" },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;

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
          await requestProjectDeletion(projectId, userId);
        return NextResponse.json(
          {
            message:
              "Projectverwijdering ingepland. U heeft 7 dagen bedenktijd.",
            projectId,
            scheduledAt: scheduledAt.toISOString(),
            confirmationCode,
          },
          { status: 200 }
        );
      }

      case "confirm": {
        await confirmProjectDeletion(projectId, parsed.data.confirmationCode);
        return NextResponse.json(
          {
            message:
              "Het project en alle bijbehorende gegevens zijn definitief verwijderd.",
            projectId,
          },
          { status: 200 }
        );
      }

      case "cancel": {
        await cancelProjectDeletion(projectId);
        return NextResponse.json(
          {
            message:
              "De geplande projectverwijdering is geannuleerd. Het project blijft actief.",
            projectId,
          },
          { status: 200 }
        );
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Onbekende fout opgetreden";
    console.error("Project deletion error:", error);

    // Determine appropriate status code based on error message
    let status = 500;
    if (message.includes("niet gevonden")) status = 404;
    if (message.includes("al een verwijdering gepland")) status = 409;
    if (message.includes("Ongeldig bevestigingscode")) status = 400;
    if (message.includes("bedenktijd is nog niet verstreken")) status = 400;
    if (message.includes("Geen verwijdering gepland")) status = 404;
    if (message.includes("geen toestemming")) status = 403;

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}

// ---------------------------------------------------------------------------
// GET — Check deletion status
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    // --- Authentication --------------------------------------------------------
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Niet geauthenticeerd" },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;

    // --- Get deletion status ---------------------------------------------------
    const status = await getProjectDeletionStatus(projectId);

    return NextResponse.json(
      {
        projectId,
        deletionScheduled: status !== null,
        status: status
          ? {
              scheduledAt: status.scheduledAt.toISOString(),
              scheduledDeletionAt: status.scheduledDeletionAt.toISOString(),
              requestedBy: status.requestedBy,
            }
          : null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get project deletion status error:", error);
    return NextResponse.json(
      { error: "Fout bij ophalen van verwijderingsstatus" },
      { status: 500 }
    );
  }
}
