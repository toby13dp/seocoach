import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/actions - List action items
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: Record<string, unknown> = {};

    if (projectId) {
      where.projectId = projectId;
    }

    const items = await db.actionItem.findMany({
      where,
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching actions:", error);
    return NextResponse.json({ error: "Failed to fetch actions" }, { status: 500 });
  }
}
