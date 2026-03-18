import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { orderedIds } = await req.json();

  if (!Array.isArray(orderedIds)) {
    Sentry.logger.warn("Reorder called with invalid orderedIds", {
      projectId,
    });
    return NextResponse.json(
      { error: "orderedIds must be an array" },
      { status: 400 }
    );
  }

  Sentry.logger.info(
    Sentry.logger.fmt`Reordering ${orderedIds.length} tasks for project ${projectId}`
  );

  // Update each task's order in a transaction
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(tasks)
        .set({ order: i * 1000, updatedAt: new Date() })
        .where(and(eq(tasks.id, orderedIds[i]), eq(tasks.projectId, projectId)));
    }
  });

  Sentry.logger.info("Task reorder completed", {
    projectId,
    taskCount: orderedIds.length,
  });

  return NextResponse.json({ success: true });
}
