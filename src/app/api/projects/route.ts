import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/api/_helpers/auth";
import { db } from "@/lib/db";
import { logProjectChange } from "@/lib/audit";

// GET /api/projects - List projects for the current user
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Niet geauthenticeerd" }, { status: 401 });
    }

    // Get user's organizations
    const memberships = await db.organizationMembership.findMany({
      where: { userId: user.id, deletedAt: null },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m) => m.organizationId);

    if (orgIds.length === 0) {
      return NextResponse.json({ projects: [] });
    }

    const projects = await db.project.findMany({
      where: {
        organizationId: { in: orgIds },
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        websiteUrl: true,
        status: true,
        onboardingCompleted: true,
        onboardingStep: true,
        description: true,
        organizationId: true,
        clientId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "Projecten ophalen mislukt" }, { status: 500 });
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Niet geauthenticeerd" }, { status: 401 });
    }

    console.log("Creating project for user:", user.id, user.email);

    const body = await request.json();
    const { name, websiteUrl, organizationId } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Projectnaam is verplicht" }, { status: 400 });
    }

    // Create slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Find or create an organization for the user
    let orgId = organizationId;
    if (!orgId) {
      // Get user's first organization
      const membership = await db.organizationMembership.findFirst({
        where: { userId: user.id, deletedAt: null },
      });
      
      if (membership) {
        orgId = membership.organizationId;
      } else {
        // Create a default organization for the user
        const org = await db.organization.create({
          data: {
            name: `${user.name || user.email}'s Organisatie`,
            slug: `${slug}-org-${Date.now()}`,
            locale: "nl-NL",
          },
        });
        // Make user the owner
        await db.organizationMembership.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            role: "ORG_OWNER",
            acceptedAt: new Date(),
          },
        });
        orgId = org.id;
      }
    }

    // Create project first
    const project = await db.project.create({
      data: {
        name: name.trim(),
        slug: `${slug}-${Date.now()}`,
        websiteUrl: websiteUrl || null,
        organizationId: orgId,
        onboardingStep: 0,
        onboardingCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Then create brand profile separately
    await db.brandProfile.create({
      data: {
        projectId: project.id,
        locale: "nl-NL",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Audit log - try/catch to not block
    try {
      await logProjectChange("CREATE", project.id, { name, websiteUrl }, { organizationId: orgId, userId: user.id });
    } catch (auditErr) {
      console.error("Audit log failed:", auditErr);
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", JSON.stringify(error, null, 2));
    const message = error instanceof Error ? error.message : "Project aanmaken mislukt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
