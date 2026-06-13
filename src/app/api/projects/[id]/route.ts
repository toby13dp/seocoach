import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/projects/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await db.project.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        websiteUrl: true,
        status: true,
        onboardingCompleted: true,
        onboardingStep: true,
        description: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get brand profile
    const brandProfile = await db.brandProfile.findUnique({
      where: { projectId: id },
    });

    return NextResponse.json({ project, brandProfile });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

// PATCH /api/projects/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.websiteUrl !== undefined) updateData.websiteUrl = body.websiteUrl;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.onboardingStep !== undefined) updateData.onboardingStep = body.onboardingStep;
    if (body.onboardingCompleted !== undefined) updateData.onboardingCompleted = body.onboardingCompleted;
    if (body.settings !== undefined) updateData.settings = JSON.stringify(body.settings);

    const project = await db.project.update({
      where: { id },
      data: updateData,
    });

    // Update brand profile if provided
    if (body.brandProfile) {
      const bp = body.brandProfile;
      const existingBrandProfile = await db.brandProfile.findUnique({
        where: { projectId: id },
      });

      const brandData: Record<string, unknown> = {};
      if (bp.brandName !== undefined) brandData.brandName = bp.brandName;
      if (bp.description !== undefined) brandData.description = bp.description;
      if (bp.audiences !== undefined) brandData.audiences = bp.audiences;
      if (bp.products !== undefined) brandData.products = bp.products;
      if (bp.services !== undefined) brandData.services = bp.services;
      if (bp.regions !== undefined) brandData.regions = bp.regions;

      if (existingBrandProfile) {
        await db.brandProfile.update({
          where: { id: existingBrandProfile.id },
          data: brandData,
        });
      } else {
        await db.brandProfile.create({
          data: {
            projectId: id,
            ...brandData,
          },
        });
      }
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}
