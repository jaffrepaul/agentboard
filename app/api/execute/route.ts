import { query } from "@anthropic-ai/claude-agent-sdk";
import * as Sentry from "@sentry/nextjs";
import { NextRequest } from "next/server";
import path from "path";
import { mkdir } from "fs/promises";
import { db } from "@/lib/db";
import { tasks as tasksTable, executionLogs, projects, researchSheets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..", "agentboard-workspace");

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { tasks, projectId, projectName, projectIdentifier, mode } = await req.json();
  const isResearch = mode === "research";

  // Create workspace and project directory (only needed for build mode)
  const projectDir = path.join(WORKSPACE_ROOT, projectIdentifier || projectName.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase());
  if (!isResearch) {
    await mkdir(projectDir, { recursive: true });
  }

  const encoder = new TextEncoder();

  // Helper to write a log entry to DB (fire-and-forget)
  function persistLog(taskId: string, type: "info" | "tool_use" | "result" | "error" | "progress", content: string) {
    if (!projectId) return;
    db.insert(executionLogs)
      .values({ projectId, taskId, type, content })
      .catch(() => {});
  }

  // Helper to update a task in DB (fire-and-forget)
  function persistTask(taskId: string, updates: Record<string, unknown>) {
    if (!projectId) return;
    db.update(tasksTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tasksTable.id, taskId))
      .catch(() => {});
  }

  // Helper to update project status in DB (fire-and-forget)
  function persistProjectStatus(status: string) {
    if (!projectId) return;
    db.update(projects)
      .set({ status: status as "idle" | "executing" | "completed" | "failed" })
      .where(eq(projects.id, projectId))
      .catch(() => {});
  }

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      }

      try {
        Sentry.metrics.count("execution.started", 1, {
          attributes: { mode: isResearch ? "research" : "build" },
        });
        Sentry.metrics.gauge("execution.task_count", tasks.length, {
          attributes: { mode: isResearch ? "research" : "build" },
        });

        if (isResearch) {
          send({ type: "log", content: "Mode: Research" });
          persistLog("", "info", "Mode: Research");
        } else {
          send({ type: "log", content: `Workspace: ${projectDir}` });
          persistLog("", "info", `Workspace: ${projectDir}`);
        }

        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];

          send({
            type: "task_start",
            taskId: task.id,
            content: `Starting: ${task.title}`,
          });
          persistLog(task.id, "info", `Starting: ${task.title}`);
          persistTask(task.id, { status: "in_progress" });

          const prompt = isResearch
            ? buildResearchPrompt(task, projectName, i, tasks.length)
            : buildTaskPrompt(task, projectName, i, tasks.length, projectDir);

          const taskStartTime = performance.now();

          try {
            const agentQuery = query({
              prompt,
              options: {
                ...(isResearch ? {} : { cwd: projectDir }),
                allowedTools: isResearch
                  ? ["WebSearch", "WebFetch", "Read", "Grep", "Glob"]
                  : ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
                permissionMode: "bypassPermissions",
                allowDangerouslySkipPermissions: true,
                maxTurns: isResearch ? 30 : 50,
                model: "claude-sonnet-4-6",
              },
            });

            let resultText = "";

            for await (const message of agentQuery) {
              if (message.type === "assistant") {
                const content = message.message?.content;
                if (Array.isArray(content)) {
                  for (const block of content) {
                    if (block.type === "text" && block.text) {
                      resultText += block.text;
                      send({
                        type: "task_progress",
                        taskId: task.id,
                        content: block.text.slice(0, 200),
                      });
                      persistLog(task.id, "progress", block.text.slice(0, 200));
                    } else if (block.type === "tool_use") {
                      send({
                        type: "log",
                        taskId: task.id,
                        content: `Using tool: ${block.name}`,
                      });
                      persistLog(task.id, "tool_use", `Using tool: ${block.name}`);
                    }
                  }
                }
              } else if (message.type === "result") {
                if ("result" in message && message.result) {
                  resultText = message.result;
                }
              }
            }

            const output = resultText || "Task completed successfully.";
            const taskDuration = performance.now() - taskStartTime;

            Sentry.metrics.count("execution.task.completed", 1, {
              attributes: { mode: isResearch ? "research" : "build" },
            });
            Sentry.metrics.distribution("execution.task.duration", taskDuration, {
              unit: "millisecond",
              attributes: { mode: isResearch ? "research" : "build" },
            });

            send({
              type: "task_complete",
              taskId: task.id,
              output,
              content: `Completed: ${task.title}`,
            });
            persistLog(task.id, "result", `Completed: ${task.title}`);
            persistTask(task.id, { status: "done", output });

            // For research mode, persist the result as a research sheet
            if (isResearch && projectId) {
              try {
                await db
                  .insert(researchSheets)
                  .values({
                    projectId,
                    taskId: task.id,
                    content: output,
                  });
                send({
                  type: "research_result",
                  taskId: task.id,
                  markdown: output,
                  content: `Research complete: ${task.title}`,
                });
              } catch {
                // Non-critical - sheet persistence failure shouldn't block execution
              }
            }
          } catch (taskError) {
            Sentry.metrics.count("execution.task.failed", 1, {
              attributes: { mode: isResearch ? "research" : "build" },
            });

            const errorMessage =
              taskError instanceof Error
                ? taskError.message
                : "Unknown error occurred";
            send({
              type: "task_failed",
              taskId: task.id,
              content: `Failed: ${errorMessage}`,
              output: errorMessage,
            });
            persistLog(task.id, "error", `Failed: ${errorMessage}`);
            persistTask(task.id, { status: "failed", output: errorMessage });
          }
        }

        send({ type: "done", content: "All tasks completed." });
        persistLog("", "result", "All tasks completed.");
        // Determine final project status
        if (projectId) {
          const projectTasks = await db.query.tasks.findMany({
            where: eq(tasksTable.projectId, projectId),
          });
          const hasFailed = projectTasks.some((t) => t.status === "failed");
          persistProjectStatus(hasFailed ? "failed" : "completed");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Execution failed";
        send({ type: "error", content: errorMessage });
        persistLog("", "error", errorMessage);
        persistProjectStatus("failed");
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function buildTaskPrompt(
  task: { title: string; description: string },
  projectName: string,
  index: number,
  total: number,
  projectDir: string
): string {
  return `You are an AI agent executing task ${index + 1} of ${total} for the project "${projectName}".

## Working Directory
Your working directory is: ${projectDir}
All files you create or modify MUST be within this directory. Do not navigate outside of it.

## Task: ${task.title}

${task.description}

## Instructions
- Execute this task thoroughly and completely.
- If the task involves creating files, write them with production-quality code.
- If the task involves configuration, ensure it is correct and complete.
- Provide a clear summary of what you accomplished when done.
- All work must stay within ${projectDir}.`;
}

function buildResearchPrompt(
  task: { title: string; description: string },
  projectName: string,
  index: number,
  total: number
): string {
  return `You are a research agent executing research task ${index + 1} of ${total} for the project "${projectName}".

## Research Topic: ${task.title}

${task.description}

## Instructions
You must research this topic thoroughly using web search and web fetch tools. Your final response MUST be well-structured markdown with the following sections:

## Summary
A concise 2-3 paragraph overview of the research findings.

## Key Findings
- Bullet points of the most important discoveries
- Include specific data, statistics, or facts where available
- Note any emerging trends or patterns

## Details
Provide deeper analysis organized into logical subsections. Use headers, lists, and tables as appropriate.

## Sources
List the key sources you consulted with brief descriptions of what each provided.

## Important Guidelines
- Focus on accuracy and recency of information
- Cite specific sources when making claims
- Include relevant code examples, specifications, or technical details when applicable
- Structure your response for easy reading with proper markdown formatting
- Your entire final response will be saved as the research result, so make it comprehensive`;
}
