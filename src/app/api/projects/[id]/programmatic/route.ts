import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { listTemplates, createTemplate } from '@/lib/programmatic/template-manager';
import type { TemplateType, ProgrammaticTemplateConfig, QualityGatesConfig } from '@/lib/programmatic/types';

// GET /api/projects/[id]/programmatic — List templates
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

    const templates = await listTemplates(projectId);

    return NextResponse.json({ data: templates });
  } catch (error) {
    console.error('List programmatic templates error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/programmatic — Create template
export async function POST(
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

    const validTypes: TemplateType[] = [
      'SERVICE_LOCATION', 'PRODUCT_USE_CASE', 'PRODUCT_AUDIENCE',
      'PRODUCT_FEATURE', 'CATEGORY_FEATURE', 'INDUSTRY_SERVICE',
      'INTEGRATION_PLATFORM', 'COMPARISON', 'GLOSSARY',
    ];

    if (!body.templateType || !validTypes.includes(body.templateType)) {
      return NextResponse.json(
        { error: `Ongeldig sjabloontype. Geldige types: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const config: ProgrammaticTemplateConfig = {
      templateType: body.templateType,
      variables: body.variables ?? [],
      contentTemplate: body.contentTemplate ?? '',
      targetKeyword: body.targetKeyword ?? '',
      qualityGates: body.qualityGates ?? {} as QualityGatesConfig,
    };

    const template = await createTemplate(
      projectId,
      config,
      body.name,
      body.description
    );

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error) {
    console.error('Create programmatic template error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
