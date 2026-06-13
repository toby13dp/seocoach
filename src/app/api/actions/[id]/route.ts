import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH /api/actions/[id] - Update action item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.priority !== undefined) updateData.priority = body.priority;

    const actionItem = await db.actionItem.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ actionItem });
  } catch (error) {
    console.error("Error updating action:", error);
    return NextResponse.json({ error: "Failed to update action" }, { status: 500 });
  }
}
