import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/user/settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await db.userSettings.findUnique({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error fetching user settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// PUT /api/user/settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Update user name if provided
    if (body.name) {
      await db.user.update({
        where: { id: session.user.id },
        data: { name: body.name },
      });
    }

    // Update user settings
    const settingsData: Record<string, unknown> = {};
    if (body.locale) settingsData.locale = body.locale;
    if (body.timezone) settingsData.timezone = body.timezone;
    if (body.theme) settingsData.theme = body.theme;

    const settings = await db.userSettings.upsert({
      where: { userId: session.user.id },
      update: settingsData,
      create: {
        userId: session.user.id,
        ...settingsData,
      },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error updating user settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
