import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { sql, inArray } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { orderedIds } = await req.json();

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json(
      { error: "orderedIds must be a non-empty array" },
      { status: 400 }
    );
  }

  // Build a single batched UPDATE using CASE WHEN instead of N separate queries
  const caseClauses = orderedIds
    .map(
      (id: string, index: number) =>
        sql`WHEN ${tasks.id} = ${id} THEN ${index}`
    )
    .reduce((acc, clause) => sql`${acc} ${clause}`);

  await db
    .update(tasks)
    .set({
      position: sql`CASE ${caseClauses} ELSE ${tasks.position} END`,
      updatedAt: new Date(),
    })
    .where(inArray(tasks.id, orderedIds));

  return NextResponse.json({ success: true });
}
