import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { executionLogs } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const logs = await db
    .select()
    .from(executionLogs)
    .where(eq(executionLogs.projectId, projectId))
    .orderBy(asc(executionLogs.timestamp));

  return NextResponse.json(
    logs.map((l) => ({
      id: l.id,
      projectId: l.projectId,
      taskId: l.taskId,
      timestamp: l.timestamp.toISOString(),
      type: l.type,
      content: l.content,
    }))
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const body = await req.json();

  const facets = Array.isArray(body.facets) ? body.facets : [];
  const rollup = facets.map((f: string) => f).join(", ");

  const [log] = await db
    .insert(executionLogs)
    .values({
      projectId,
      taskId: body.taskId || "",
      type: body.type,
      content: rollup || body.content || "",
    })
    .returning();

  return NextResponse.json({
    id: log.id,
    projectId: log.projectId,
    taskId: log.taskId,
    timestamp: log.timestamp.toISOString(),
    type: log.type,
    content: log.content,
  });
}
