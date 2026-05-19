import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { taskIds } = await req.json();

  // Update each task's updatedAt with sequential timestamps to persist ordering
  const baseTime = Date.now();
  for (let i = 0; i < taskIds.length; i++) {
    await db
      .update(tasks)
      .set({ updatedAt: new Date(baseTime + i) })
      .where(eq(tasks.id, taskIds[i]));
  }

  return NextResponse.json({ success: true, projectId });
}
