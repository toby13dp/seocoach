/**
 * @fileoverview API Route — Data Export (GDPR Right to Portability)
 *
 * POST /api/user/data-export
 * Request a data export for the authenticated user. Generates a JSON file
 * containing all personal data and returns a download link.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { generateExportFile } from "@/lib/privacy/data-export";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const dataExportSchema = z.object({
  /** Optional format override (currently only "json" is supported). */
  format: z.enum(["json"]).default("json"),
});

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
    const body = await request.json().catch(() => ({}));
    const parsed = dataExportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // --- Generate export -------------------------------------------------------
    const { filePath, fileName } = await generateExportFile(session.user.id);

    // --- Return result ---------------------------------------------------------
    return NextResponse.json(
      {
        message: "Gegevensexport succesvol gegenereerd",
        fileName,
        downloadUrl: `/api/user/data-export?file=${encodeURIComponent(fileName)}`,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Onbekende fout opgetreden";
    console.error("Data export error:", error);
    return NextResponse.json(
      { error: `Fout bij exporteren van gegevens: ${message}` },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET — Download the generated export file
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // --- Authentication --------------------------------------------------------
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Niet geauthenticeerd" },
        { status: 401 }
      );
    }

    // --- Retrieve file name from query -----------------------------------------
    const fileName = request.nextUrl.searchParams.get("file");
    if (!fileName) {
      return NextResponse.json(
        { error: "Bestandsnaam is vereist" },
        { status: 400 }
      );
    }

    // --- Basic security: verify the file belongs to this user ------------------
    const userPrefix = `seocoach-data-export-${session.user.id.substring(0, 8)}`;
    if (!fileName.startsWith(userPrefix)) {
      return NextResponse.json(
        { error: "U heeft geen toegang tot dit bestand" },
        { status: 403 }
      );
    }

    // --- Read and return the file ----------------------------------------------
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");

    const filePath = join("/tmp", fileName);

    try {
      const fileContent = await readFile(filePath, "utf-8");
      return new NextResponse(fileContent, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    } catch {
      return NextResponse.json(
        { error: "Exportbestand niet gevonden. Genereer een nieuwe export." },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Data export download error:", error);
    return NextResponse.json(
      { error: "Fout bij downloaden van exportbestand" },
      { status: 500 }
    );
  }
}
