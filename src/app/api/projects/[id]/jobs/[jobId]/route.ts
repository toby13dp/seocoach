import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { db } from '@/lib/db';
import { validateProjectAccess } from '@/lib/tenant';
import { getJobStatus, cancelJob } from '@/lib/jobs';
import { logAuditEvent } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, jobId } = await params;
    const access = await validateProjectAccess(user.id, id);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const job = await getJobStatus(jobId);

    if (!job || job.projectId !== id) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error('Get job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, jobId } = await params;
    const access = await validateProjectAccess(user.id, id);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const job = await db.job.findUnique({
      where: { id: jobId },
    });

    if (!job || job.projectId !== id) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { status } = body;

    // Currently only support cancellation
    if (status === 'CANCELLED') {
      if (job.status !== 'PENDING' && job.status !== 'RUNNING') {
        return NextResponse.json(
          { error: 'Only pending or running jobs can be cancelled' },
          { status: 400 }
        );
      }

      const cancelledJob = await cancelJob(jobId);

      // Log audit event
      await logAuditEvent({
        organizationId: access.project.organizationId,
        projectId: id,
        userId: user.id,
        action: 'job_cancelled',
        entity: 'job',
        entityId: jobId,
      });

      return NextResponse.json({ job: cancelledJob });
    }

    return NextResponse.json(
      { error: 'Invalid status update. Only CANCELLED is supported.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Update job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
