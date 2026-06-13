import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { hasBenchmarkConsent, setBenchmarkConsent, ALL_BENCHMARK_CATEGORIES } from '@/lib/benchmarking';
import type { BenchmarkCategory } from '@prisma/client';

// GET /api/projects/[id]/benchmarks/consent — Get benchmark consent status for project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    // Haal toestemmingsstatus op voor alle categorieën
    const consentStatus = await Promise.all(
      ALL_BENCHMARK_CATEGORIES.map(async (category) => {
        const isConsented = await hasBenchmarkConsent(projectId, category);
        return { category, isConsented };
      })
    );

    return NextResponse.json({ data: consentStatus });
  } catch (error) {
    console.error('Get benchmark consent error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PUT /api/projects/[id]/benchmarks/consent — Set benchmark consent
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();
    const { category, isConsented } = body as {
      category: string;
      isConsented: boolean;
    };

    if (!category || typeof category !== 'string') {
      return NextResponse.json(
        { error: 'Categorie is vereist' },
        { status: 400 }
      );
    }

    if (typeof isConsented !== 'boolean') {
      return NextResponse.json(
        { error: 'isConsented moet een boolean zijn' },
        { status: 400 }
      );
    }

    // Valideer dat de categorie bestaat
    if (!ALL_BENCHMARK_CATEGORIES.includes(category as BenchmarkCategory)) {
      return NextResponse.json(
        { error: `Ongeldige benchmarkcategorie: ${category}` },
        { status: 400 }
      );
    }

    const organizationId = access.project.organizationId;
    const consent = await setBenchmarkConsent(
      organizationId,
      projectId,
      category as BenchmarkCategory,
      isConsented,
      user.id
    );

    return NextResponse.json({ data: consent });
  } catch (error) {
    console.error('Set benchmark consent error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
