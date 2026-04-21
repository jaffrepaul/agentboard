import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { projects, tasks, executionLogs, researchSheets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: { tasks: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: project.id,
    name: project.name,
    description: project.description,
    identifier: project.identifier,
    mode: project.mode,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    tasks: project.tasks.map((t) => ({
      id: t.id,
      projectId: t.projectId,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      order: t.order,
      output: t.output,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const [updated] = await db
    .update(projects)
    .set(body)
    .where(eq(projects.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.status) {
    Sentry.metrics.count("project.status_change", 1, {
      attributes: { status: updated.status },
    });
  }

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    description: updated.description,
    identifier: updated.identifier,
    mode: updated.mode,
    status: updated.status,
    createdAt: updated.createdAt.toISOString(),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await db.delete(researchSheets).where(eq(researchSheets.projectId, id));
  await db.delete(executionLogs).where(eq(executionLogs.projectId, id));
  await db.delete(tasks).where(eq(tasks.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));

  Sentry.metrics.count("project.deleted", 1);

  return NextResponse.json({ success: true });
}
