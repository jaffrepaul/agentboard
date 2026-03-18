import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";
import { asc, desc } from "drizzle-orm";

export async function GET() {
  const allProjects = await db.query.projects.findMany({
    with: { tasks: { orderBy: [asc(tasks.order), asc(tasks.createdAt)] } },
    orderBy: [desc(projects.createdAt)],
  });

  const result = allProjects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    identifier: p.identifier,
    mode: p.mode,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    tasks: p.tasks.map((t) => ({
      id: t.id,
      projectId: t.projectId,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      output: t.output,
      order: t.order,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, description, identifier, mode } = body;

  const [project] = await db
    .insert(projects)
    .values({
      name,
      description: description || "",
      identifier,
      mode: mode || "build",
      status: "idle",
    })
    .returning();

  Sentry.logger.info(
    Sentry.logger.fmt`Project created: ${project.name}`,
    {
      projectId: project.id,
      projectName: project.name,
      identifier: project.identifier,
      status: project.status,
    }
  );

  Sentry.metrics.count("project.created", 1, {
    attributes: { mode: project.mode },
  });

  return NextResponse.json({
    id: project.id,
    name: project.name,
    description: project.description,
    identifier: project.identifier,
    mode: project.mode,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    tasks: [],
  });
}
