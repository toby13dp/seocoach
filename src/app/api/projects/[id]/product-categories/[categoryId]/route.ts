import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/projects/[id]/product-categories/[categoryId] — Get category details with products
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, categoryId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const category = await db.productCategory.findFirst({
      where: { id: categoryId, projectId, deletedAt: null },
      include: {
        products: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            sku: true,
            regularPrice: true,
            stockStatus: true,
            overallSeoScore: true,
          },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Categorie niet gevonden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: category });
  } catch (error) {
    console.error('Get category error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen categorie' },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id]/product-categories/[categoryId] — Update category
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, categoryId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const existing = await db.productCategory.findFirst({
      where: { id: categoryId, projectId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Categorie niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.hasStructuredData !== undefined) updateData.hasStructuredData = body.hasStructuredData;

    const category = await db.productCategory.update({
      where: { id: categoryId },
      data: updateData,
    });

    return NextResponse.json({ data: category });
  } catch (error) {
    console.error('Update category error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij bijwerken categorie' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/product-categories/[categoryId] — Soft delete category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, categoryId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const existing = await db.productCategory.findFirst({
      where: { id: categoryId, projectId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Categorie niet gevonden' },
        { status: 404 }
      );
    }

    await db.productCategory.update({
      where: { id: categoryId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error('Delete category error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij verwijderen categorie' },
      { status: 500 }
    );
  }
}
