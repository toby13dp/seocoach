import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/api/_helpers/auth";
import { db } from "@/lib/db";

// PUT /api/projects/[id]/brand-profile
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Niet geauthenticeerd" }, { status: 401 });
    }

    const { id } = await params;

    // Check project exists (use findFirst — deletedAt is not a unique constraint)
    const project = await db.project.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, organizationId: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project niet gevonden" }, { status: 404 });
    }

    // Verify user has access
    const membership = await db.organizationMembership.findFirst({
      where: {
        userId: user.id,
        organizationId: project.organizationId,
        deletedAt: null,
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Geen toegang tot dit project" }, { status: 403 });
    }

    const body = await request.json();

    // Check existing brand profile
    const existing = await db.brandProfile.findUnique({
      where: { projectId: id },
    });

    const data = {
      brandName: body.brandName || null,
      description: body.description || null,
      toneOfVoice: body.toneOfVoice || null,
      addressPreference: body.addressPreference || null,
      products: body.products || null,
      services: body.services || null,
      audiences: body.audiences || null,
      regions: body.regions || null,
      preferredTerminology: body.preferredTerminology || null,
      prohibitedTerminology: body.prohibitedTerminology || null,
      allowedClaims: body.allowedClaims || null,
      prohibitedClaims: body.prohibitedClaims || null,
      proofPoints: body.proofPoints || null,
      certifications: body.certifications || null,
      contactInformation: body.contactInformation || null,
      conversionGoals: body.conversionGoals || null,
      editorialRules: body.editorialRules || null,
      disclaimers: body.disclaimers || null,
    };

    let brandProfile;
    if (existing) {
      brandProfile = await db.brandProfile.update({
        where: { id: existing.id },
        data,
      });
    } else {
      brandProfile = await db.brandProfile.create({
        data: {
          projectId: id,
          ...data,
        },
      });
    }

    return NextResponse.json({ brandProfile });
  } catch (error) {
    console.error("Error saving brand profile:", error);
    return NextResponse.json({ error: "Brand profiel opslaan mislukt" }, { status: 500 });
  }
}
