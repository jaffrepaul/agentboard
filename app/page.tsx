"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Project, ProjectMode, ExecutionLogEntry, SSEEvent, ResearchSheet } from "@/lib/types";
import Sidebar from "./components/Sidebar";
import ProjectView from "./components/ProjectView";
import EmptyState from "./components/EmptyState";

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, ExecutionLogEntry[]>>({});
  const [researchSheets, setResearchSheets] = useState<Record<string, ResearchSheet[]>>({});
  const [sidebarCreateOpen, setSidebarCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const selectedProject = projects.find((p) => p.id === selectedId) || null;

  // Load projects from DB on mount
  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data: Project[]) => {
        setProjects(data);
        if (data.length > 0 && !selectedId) {
          setSelectedId(data[0].id);
        }
      })
      .catch((err) => console.error("Failed to load projects:", err))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load logs when selecting a project
  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/projects/${selectedId}/logs`)
      .then((res) => res.json())
      .then((data: ExecutionLogEntry[]) => {
        setLogs((prev) => ({ ...prev, [selectedId]: data }));
      })
      .catch((err) => console.error("Failed to load logs:", err));
  }, [selectedId]);

  // Load research sheets when selecting a research project
  useEffect(() => {
    if (!selectedId) return;
    const project = projects.find((p) => p.id === selectedId);
    if (!project || project.mode !== "research") return;
    fetch(`/api/projects/${selectedId}/research-sheets`)
      .then((res) => res.json())
      .then((data: ResearchSheet[]) => {
        setResearchSheets((prev) => ({ ...prev, [selectedId]: data }));
      })
      .catch((err) => console.error("Failed to load research sheets:", err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function generateIdentifier(name: string): string {
    const base = name
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("")
      .slice(0, 4);
    return base || "PRJ";
  }

  async function createProject(name: string, description: string, mode: ProjectMode = "build") {
    const identifier = generateIdentifier(name);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, identifier, mode }),
      });
      const project: Project = await res.json();
      setProjects((prev) => [project, ...prev]);
      setSelectedId(project.id);
    } catch (err) {
      console.error("Failed to create project:", err);
    }
  }

  function updateProject(updated: Project) {
    setProjects((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );
  }

  async function deleteProject(id: string) {
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  }

  async function addTaskToProject(projectId: string, task: { title: string; description: string; priority: string }) {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
      });
      const newTask = await res.json();
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, tasks: [...p.tasks, newTask] } : p
        )
      );
    } catch (err) {
      console.error("Failed to add task:", err);
    }
  }

  async function updateTask(projectId: string, taskId: string, updates: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const updatedTask = await res.json();
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? updatedTask : t)) }
            : p
        )
      );
    } catch (err) {
      console.error("Failed to update task:", err);
    }
  }

  async function deleteTask(projectId: string, taskId: string) {
    try {
      await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "DELETE",
      });
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId) }
            : p
        )
      );
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  }

  function addLog(projectId: string, entry: Omit<ExecutionLogEntry, "id" | "timestamp">) {
    const logEntry: ExecutionLogEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    setLogs((prev) => ({
      ...prev,
      [projectId]: [...(prev[projectId] || []), logEntry],
    }));
    // Fire-and-forget persist to DB
    fetch(`/api/projects/${projectId}/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: entry.taskId,
        type: entry.type,
        content: entry.content,
      }),
    }).catch(() => {});
  }

  const handleExecute = useCallback(
    async (project: Project) => {
      // Reset logs for this project
      setLogs((prev) => ({ ...prev, [project.id]: [] }));

      // Set project status to executing and reset all non-done tasks to todo
      const executingProject = {
        ...project,
        status: "executing" as const,
        tasks: project.tasks.map((t) =>
          t.status === "done" ? t : { ...t, status: "todo" as const, output: "" }
        ),
      };
      updateProject(executingProject);

      // Persist status to DB
      fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "executing" }),
      }).catch(() => {});

      const workspacePath = `agentboard-workspace/${project.identifier.toLowerCase()}`;
      addLog(project.id, {
        taskId: "",
        type: "info",
        content: `Starting execution for "${project.name}" in ~/${workspacePath}`,
      });

      sessionStorage.setItem('executor-state', JSON.stringify({ isExecuting: true, projectId: project.id }));

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const tasksToSend = project.tasks
          .filter((t) => t.status !== "done")
          .map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
          }));

        const response = await fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tasks: tasksToSend,
            projectId: project.id,
            projectName: project.name,
            projectIdentifier: project.identifier.toLowerCase(),
            mode: project.mode,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Execution failed: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event: SSEEvent = JSON.parse(line.slice(6));
              handleSSEEvent(project.id, event);
            } catch {
              // Skip malformed events
            }
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          addLog(project.id, {
            taskId: "",
            type: "info",
            content: "Execution stopped by user",
          });
          setProjects((prev) =>
            prev.map((p) =>
              p.id === project.id
                ? {
                    ...p,
                    status: "failed",
                    tasks: p.tasks.map((t) =>
                      t.status === "in_progress"
                        ? { ...t, status: "failed", output: "Stopped by user" }
                        : t
                    ),
                  }
                : p
            )
          );
          fetch(`/api/projects/${project.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "failed" }),
          }).catch(() => {});
        } else {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          addLog(project.id, {
            taskId: "",
            type: "error",
            content: `Execution error: ${message}`,
          });
          setProjects((prev) =>
            prev.map((p) =>
              p.id === project.id ? { ...p, status: "failed" } : p
            )
          );
          fetch(`/api/projects/${project.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "failed" }),
          }).catch(() => {});
        }
      } finally {
        abortRef.current = null;
        sessionStorage.removeItem('executor-state');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function handleSSEEvent(projectId: string, event: SSEEvent) {
    switch (event.type) {
      case "task_start":
        addLog(projectId, {
          taskId: event.taskId || "",
          type: "info",
          content: event.content || "Task started",
        });
        if (event.taskId) {
          setProjects((prev) =>
            prev.map((p) =>
              p.id === projectId
                ? {
                    ...p,
                    tasks: p.tasks.map((t) =>
                      t.id === event.taskId
                        ? { ...t, status: "in_progress" }
                        : t
                    ),
                  }
                : p
            )
          );
          // Persist task status
          fetch(`/api/projects/${projectId}/tasks/${event.taskId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "in_progress" }),
          }).catch(() => {});
        }
        break;

      case "task_progress":
        addLog(projectId, {
          taskId: event.taskId || "",
          type: "progress",
          content: event.content || "",
        });
        break;

      case "log":
        addLog(projectId, {
          taskId: event.taskId || "",
          type: "tool_use",
          content: event.content || "",
        });
        break;

      case "task_complete":
        addLog(projectId, {
          taskId: event.taskId || "",
          type: "result",
          content: event.content || "Task completed",
        });
        if (event.taskId) {
          setProjects((prev) =>
            prev.map((p) =>
              p.id === projectId
                ? {
                    ...p,
                    tasks: p.tasks.map((t) =>
                      t.id === event.taskId
                        ? {
                            ...t,
                            status: "done",
                            output: event.output || "Completed",
                          }
                        : t
                    ),
                  }
                : p
            )
          );
          // Persist task completion
          fetch(`/api/projects/${projectId}/tasks/${event.taskId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "done",
              output: event.output || "Completed",
            }),
          }).catch(() => {});
        }
        break;

      case "task_failed":
        addLog(projectId, {
          taskId: event.taskId || "",
          type: "error",
          content: event.content || "Task failed",
        });
        if (event.taskId) {
          setProjects((prev) =>
            prev.map((p) =>
              p.id === projectId
                ? {
                    ...p,
                    tasks: p.tasks.map((t) =>
                      t.id === event.taskId
                        ? {
                            ...t,
                            status: "failed",
                            output: event.output || "Failed",
                          }
                        : t
                    ),
                  }
                : p
            )
          );
          // Persist task failure
          fetch(`/api/projects/${projectId}/tasks/${event.taskId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "failed",
              output: event.output || "Failed",
            }),
          }).catch(() => {});
        }
        break;

      case "done": {
        addLog(projectId, {
          taskId: "",
          type: "result",
          content: event.content || "All tasks completed",
        });
        setProjects((prev) =>
          prev.map((p) => {
            if (p.id !== projectId) return p;
            const finalStatus = p.tasks.some((t) => t.status === "failed")
              ? "failed"
              : "completed";
            // Persist final status
            fetch(`/api/projects/${projectId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: finalStatus }),
            }).catch(() => {});
            return { ...p, status: finalStatus };
          })
        );
        break;
      }

      case "research_result":
        if (event.taskId && event.markdown) {
          const newSheet: ResearchSheet = {
            id: crypto.randomUUID(),
            projectId,
            taskId: event.taskId,
            content: event.markdown,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setResearchSheets((prev) => ({
            ...prev,
            [projectId]: [...(prev[projectId] || []), newSheet],
          }));
        }
        break;

      case "error":
        addLog(projectId, {
          taskId: "",
          type: "error",
          content: event.content || "Execution error",
        });
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId ? { ...p, status: "failed" } : p
          )
        );
        fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "failed" }),
        }).catch(() => {});
        break;
    }
  }

  function stopExecution() {
    abortRef.current?.abort();
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <div className="text-text-tertiary text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-bg-primary">
      <Sidebar
        projects={projects}
        selectedProjectId={selectedId}
        onSelectProject={setSelectedId}
        onCreateProject={createProject}
        onDeleteProject={deleteProject}
        createOpen={sidebarCreateOpen}
        onCreateOpenChange={setSidebarCreateOpen}
      />
      {selectedProject ? (
        <ProjectView
          project={selectedProject}
          logs={logs[selectedProject.id] || []}
          researchSheets={researchSheets[selectedProject.id] || []}
          onUpdateProject={updateProject}
          onAddTask={(task) => addTaskToProject(selectedProject.id, task)}
          onUpdateTask={(taskId, updates) =>
            updateTask(selectedProject.id, taskId, updates)
          }
          onDeleteTask={(taskId) => deleteTask(selectedProject.id, taskId)}
          onExecute={handleExecute}
          onStopExecution={stopExecution}
        />
      ) : (
        <EmptyState
          onCreateProject={() => setSidebarCreateOpen(true)}
        />
      )}
    </div>
  );
}
