"use client";

import { useState } from "react";
import {
  Plus,
  Play,
  Square,
  CheckCircle2,
  Clock,
  AlertCircle,
  ListTodo,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import type { Project, Task, TaskPriority, ExecutionLogEntry, ResearchSheet } from "@/lib/types";
import TaskRow from "./TaskRow";
import ExecutionLog from "./ExecutionLog";
import ResearchPanel from "./ResearchPanel";

interface ProjectViewProps {
  project: Project;
  logs: ExecutionLogEntry[];
  researchSheets: ResearchSheet[];
  onUpdateProject: (project: Project) => void;
  onAddTask: (task: { title: string; description: string; priority: string }) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onExecute: (project: Project) => void;
  onStopExecution: () => void;
}

export default function ProjectView({
  project,
  logs,
  researchSheets,
  onUpdateProject,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onExecute,
  onStopExecution,
}: ProjectViewProps) {
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const isExecuting = project.status === "executing";
  const todoTasks = project.tasks.filter(
    (t) => t.status === "backlog" || t.status === "todo"
  );
  const inProgressTasks = project.tasks.filter(
    (t) => t.status === "in_progress"
  );
  const doneTasks = project.tasks.filter((t) => t.status === "done");
  const failedTasks = project.tasks.filter((t) => t.status === "failed");

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onAddTask({
      title: newTitle.trim(),
      description: newDesc.trim(),
      priority: newPriority,
    });

    setNewTitle("");
    setNewDesc("");
    setNewPriority("medium");
    setShowAddTask(false);
  }

  function handleUpdateTask(id: string, updates: Partial<Task>) {
    // Optimistic local update
    onUpdateProject({
      ...project,
      tasks: project.tasks.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
      ),
    });
    // Persist to DB
    onUpdateTask(id, updates);
  }

  function handleDeleteTask(id: string) {
    onDeleteTask(id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const x: any = null; x.crash(); 
    
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = project.tasks.findIndex((t) => t.id === active.id);
    const newIndex = project.tasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(project.tasks, oldIndex, newIndex);

    // Optimistic update
    onUpdateProject({ ...project, tasks: reordered });

    // Persist to backend
    fetch(`/api/projects/${project.id}/tasks/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((t) => t.id) }),
    });
  }

  const canExecute =
    project.tasks.length > 0 &&
    !isExecuting &&
    project.tasks.some((t) => t.status !== "done");

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Project header */}
      <header className="px-6 h-[52px] flex items-center justify-between border-b border-border-primary bg-bg-secondary">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-text-primary">
            {project.name}
          </h1>
          {project.description && (
            <span className="text-xs text-text-tertiary">
              {project.description}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Stats */}
          <div className="flex items-center gap-3 mr-4 text-[11px]">
            {todoTasks.length > 0 && (
              <span className="flex items-center gap-1 text-text-secondary">
                <ListTodo size={12} /> {todoTasks.length}
              </span>
            )}
            {inProgressTasks.length > 0 && (
              <span className="flex items-center gap-1 text-accent-primary">
                <Clock size={12} /> {inProgressTasks.length}
              </span>
            )}
            {doneTasks.length > 0 && (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 size={12} /> {doneTasks.length}
              </span>
            )}
            {failedTasks.length > 0 && (
              <span className="flex items-center gap-1 text-error">
                <AlertCircle size={12} /> {failedTasks.length}
              </span>
            )}
          </div>

          {/* Execute button */}
          {isExecuting ? (
            <button
              onClick={onStopExecution}
              className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium bg-error text-white hover:bg-red-600 transition-colors"
            >
              <Square size={14} />
              Stop
            </button>
          ) : (
            <button
              onClick={() => canExecute && onExecute(project)}
              disabled={!canExecute}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                canExecute
                  ? "bg-accent-primary text-white hover:bg-accent-hover"
                  : "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
              }`}
            >
              <Play size={14} />
              {project.mode === "research" ? "Execute Research" : "Execute Build"}
            </button>
          )}
        </div>
      </header>

      {/* Content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Task list */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Progress bar */}
          {project.tasks.length > 0 && (
            <div className="px-6 py-2 bg-bg-secondary border-b border-border-primary">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-primary rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${
                        (doneTasks.length / project.tasks.length) * 100
                      }%`,
                    }}
                  />
                </div>
                <span className="text-[11px] text-text-tertiary font-mono">
                  {doneTasks.length}/{project.tasks.length}
                </span>
              </div>
            </div>
          )}

          {/* Task list scrollable */}
          <div className="flex-1 overflow-y-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={project.tasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {project.tasks.map((task, idx) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    index={idx}
                    projectIdentifier={project.identifier}
                    isExecuting={isExecuting}
                    onUpdate={handleUpdateTask}
                    onDelete={handleDeleteTask}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {/* Add task */}
            {showAddTask ? (
              <form
                onSubmit={addTask}
                className="px-4 py-3 border-b border-border-primary bg-bg-tertiary animate-fade-in"
              >
                <div className="flex gap-3 items-start">
                  <div className="flex-1 space-y-2">
                    <input
                      autoFocus
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Task title"
                      className="w-full text-sm"
                    />
                    <input
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Describe what this task should accomplish..."
                      className="w-full text-xs"
                    />
                    <div className="flex items-center gap-2">
                      <select
                        value={newPriority}
                        onChange={(e) =>
                          setNewPriority(e.target.value as TaskPriority)
                        }
                        className="text-xs bg-bg-secondary border border-border-primary rounded px-2 py-1 text-text-secondary"
                      >
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="text-xs font-medium py-1.5 px-3 rounded-md bg-accent-primary text-white hover:bg-accent-hover transition-colors"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddTask(false)}
                      className="text-xs font-medium py-1.5 px-3 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              !isExecuting && (
                <button
                  onClick={() => setShowAddTask(true)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-colors border-b border-border-primary"
                >
                  <Plus size={14} />
                  Add task
                </button>
              )
            )}

            {/* Empty state */}
            {project.tasks.length === 0 && !showAddTask && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ListTodo
                  size={40}
                  className="text-text-tertiary mb-4"
                />
                <h3 className="text-sm font-medium text-text-secondary mb-1">
                  No tasks yet
                </h3>
                <p className="text-xs text-text-tertiary mb-4">
                  Add tasks that the AI agent will execute sequentially
                </p>
                <button
                  onClick={() => setShowAddTask(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-accent-primary text-white hover:bg-accent-hover transition-colors"
                >
                  <Plus size={14} />
                  Add first task
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right panel: Research results or Execution log */}
        {project.mode === "research" && researchSheets.length > 0 && !isExecuting ? (
          <ResearchPanel sheets={researchSheets} tasks={project.tasks} />
        ) : (isExecuting || logs.length > 0 || project.status === "completed" || project.status === "failed") ? (
          <ExecutionLog logs={logs} isExecuting={isExecuting} />
        ) : null}
      </div>
    </div>
  );
}
