import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PUT /api/projects/[id]/brand-profile
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check project exists
    const project = await db.project.findUnique({
      where: { id, deletedAt: null },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

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
    return NextResponse.json({ error: "Failed to save brand profile" }, { status: 500 });
  }
}
