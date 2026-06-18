"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  FolderKanban,
  Search,
  ChevronDown,
  Hash,
  LayoutDashboard,
  Trash2,
} from "lucide-react";
import type { Project, ProjectMode } from "@/lib/types";

interface SidebarProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onCreateProject: (name: string, description: string, mode: ProjectMode) => void;
  onDeleteProject: (id: string) => void;
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
}

export default function Sidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  createOpen,
  onCreateOpenChange,
}: SidebarProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newMode, setNewMode] = useState<ProjectMode>("build");

  // Sync with parent-controlled open state
  useEffect(() => {
    if (createOpen) {
      setShowCreate(true);
      onCreateOpenChange?.(false);
    }
  }, [createOpen, onCreateOpenChange]);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreateProject(newName.trim(), newDesc.trim(), newMode);
    setNewName("");
    setNewDesc("");
    setNewMode("build");
    setShowCreate(false);
  }

  return (
    <aside className="w-[260px] min-w-[260px] h-screen flex flex-col bg-bg-secondary border-r border-border-primary">
      {/* Header */}
      <div className="px-4 h-[52px] flex items-center gap-2 border-b border-border-primary">
        <LayoutDashboard size={18} className="text-accent-primary" />
        <span className="text-sm font-semibold text-text-primary tracking-tight">
          AgentBoard
        </span>
      </div>

      {/* Projects section */}
      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-3 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-text-secondary">
            <ChevronDown size={12} />
            <span className="text-[11px] font-medium uppercase tracking-wider">
              Projects
            </span>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Create project form */}
        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="mx-2 mb-2 p-3 rounded-lg bg-bg-tertiary border border-border-primary animate-fade-in"
          >
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Project name"
              className="w-full mb-2 text-sm"
            />
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full mb-2 text-sm"
            />
            <div className="flex gap-1.5 mb-3">
              <button
                type="button"
                onClick={() => setNewMode("build")}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${
                  newMode === "build"
                    ? "bg-accent-primary text-white"
                    : "bg-bg-secondary text-text-secondary hover:text-text-primary border border-border-primary"
                }`}
              >
                <FolderKanban size={12} />
                Build
              </button>
              <button
                type="button"
                onClick={() => setNewMode("research")}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${
                  newMode === "research"
                    ? "bg-accent-primary text-white"
                    : "bg-bg-secondary text-text-secondary hover:text-text-primary border border-border-primary"
                }`}
              >
                <Search size={12} />
                Research
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 text-xs font-medium py-1.5 px-3 rounded-md bg-accent-primary text-white hover:bg-accent-hover transition-colors"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-xs font-medium py-1.5 px-3 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Project list */}
        <div className="space-y-0.5 px-1.5">
          {projects.map((project) => {
            const isActive = project.id === selectedProjectId;
            const taskCount = project.tasks.length;
            const doneCount = project.tasks.filter(
              (t) => t.status === "done"
            ).length;

            return (
              <div
                key={project.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectProject(project.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectProject(project.id);
                  }
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors group cursor-pointer ${
                  isActive
                    ? "bg-bg-active text-text-primary"
                    : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                }`}
              >
                {project.mode === "research" ? (
                  <Search
                    size={15}
                    className={
                      isActive
                        ? "text-accent-primary"
                        : "text-text-tertiary group-hover:text-text-secondary"
                    }
                  />
                ) : (
                  <FolderKanban
                    size={15}
                    className={
                      isActive
                        ? "text-accent-primary"
                        : "text-text-tertiary group-hover:text-text-secondary"
                    }
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {project.name}
                  </div>
                  {taskCount > 0 && (
                    <div className="text-[11px] text-text-tertiary">
                      {doneCount}/{taskCount} tasks
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Hash
                    size={10}
                    className="text-text-tertiary"
                  />
                  <span className="text-[10px] text-text-tertiary font-mono">
                    {project.identifier}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteProject(project.id);
                  }}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-error hover:bg-error-muted transition-all"
                  title="Delete project"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>

        {projects.length === 0 && !showCreate && (
          <div className="px-4 py-8 text-center">
            <FolderKanban
              size={32}
              className="mx-auto mb-3 text-text-tertiary"
            />
            <p className="text-sm text-text-secondary mb-1">No projects yet</p>
            <p className="text-xs text-text-tertiary">
              Create your first project to get started
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border-primary">
        <div className="flex items-center">
          <div className="flex items-center gap-2 text-[11px] text-text-tertiary">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse-dot" />
            <span>Claude Agent SDK v0.2.52</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
