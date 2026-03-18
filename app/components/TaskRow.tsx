"use client";

import {
  Circle,
  CircleDot,
  CheckCircle2,
  XCircle,
  Loader2,
  GripVertical,
  Trash2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
  SignalHigh,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task, TaskPriority } from "@/lib/types";

interface TaskRowProps {
  task: Task;
  index: number;
  projectIdentifier: string;
  isExecuting: boolean;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

const STATUS_CONFIG = {
  backlog: {
    icon: Circle,
    color: "text-text-tertiary",
    label: "Backlog",
  },
  todo: {
    icon: CircleDot,
    color: "text-text-secondary",
    label: "Todo",
  },
  in_progress: {
    icon: Loader2,
    color: "text-accent-primary",
    label: "In Progress",
    animate: true,
  },
  done: {
    icon: CheckCircle2,
    color: "text-success",
    label: "Done",
  },
  failed: {
    icon: XCircle,
    color: "text-error",
    label: "Failed",
  },
};

const PRIORITY_CONFIG: Record<
  TaskPriority,
  { icon: React.ElementType; color: string; label: string }
> = {
  urgent: { icon: AlertTriangle, color: "text-urgent", label: "Urgent" },
  high: { icon: SignalHigh, color: "text-warning", label: "High" },
  medium: { icon: ArrowUp, color: "text-accent-primary", label: "Medium" },
  low: { icon: ArrowDown, color: "text-text-secondary", label: "Low" },
  none: { icon: Minus, color: "text-text-tertiary", label: "None" },
};

export default function TaskRow({
  task,
  index,
  projectIdentifier,
  isExecuting,
  onUpdate,
  onDelete,
}: TaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? "relative" as const : undefined,
  };

  const statusCfg = STATUS_CONFIG[task.status];
  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const StatusIcon = statusCfg.icon;
  const PriorityIcon = priorityCfg.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 px-4 py-2.5 border-b border-border-primary hover:bg-bg-hover transition-colors animate-fade-in ${
        task.status === "in_progress" ? "bg-accent-muted" : ""
      } ${task.status === "done" ? "opacity-70" : ""} ${
        task.status === "failed" ? "bg-error-muted" : ""
      }`}
    >
      {/* Drag handle */}
      <GripVertical
        size={14}
        className="text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity cursor-grab"
        {...attributes}
        {...listeners}
      />

      {/* Status icon */}
      <button
        className={`flex-shrink-0 ${statusCfg.color}`}
        disabled={isExecuting}
        title={statusCfg.label}
      >
        <StatusIcon
          size={16}
          className={
            statusCfg.icon === Loader2 ? "animate-spin" : ""
          }
        />
      </button>

      {/* Identifier */}
      <span className="text-[11px] font-mono text-text-tertiary flex-shrink-0 w-16">
        {projectIdentifier}-{index + 1}
      </span>

      {/* Title & description */}
      <div className="flex-1 min-w-0">
        <input
          value={task.title}
          onChange={(e) => onUpdate(task.id, { title: e.target.value })}
          disabled={isExecuting}
          className={`w-full bg-transparent border-0 p-0 text-sm font-medium text-text-primary focus:outline-none ${
            task.status === "done" ? "line-through" : ""
          }`}
          placeholder="Task title"
        />
        {(task.description || !isExecuting) && (
          <input
            value={task.description}
            onChange={(e) =>
              onUpdate(task.id, { description: e.target.value })
            }
            disabled={isExecuting}
            className="w-full bg-transparent border-0 p-0 text-xs text-text-tertiary focus:outline-none mt-0.5"
            placeholder="Add description..."
          />
        )}
      </div>

      {/* Priority badge */}
      <button
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${priorityCfg.color} hover:bg-bg-hover transition-colors`}
        onClick={() => {
          if (isExecuting) return;
          const priorities: TaskPriority[] = [
            "none",
            "low",
            "medium",
            "high",
            "urgent",
          ];
          const currentIdx = priorities.indexOf(task.priority);
          const nextIdx = (currentIdx + 1) % priorities.length;
          onUpdate(task.id, { priority: priorities[nextIdx] });
        }}
        disabled={isExecuting}
        title={`Priority: ${priorityCfg.label}`}
      >
        <PriorityIcon size={12} />
        <span className="hidden sm:inline">{priorityCfg.label}</span>
      </button>

      {/* Output preview for completed/failed tasks */}
      {task.output && (task.status === "done" || task.status === "failed") && (
        <div
          className={`text-[11px] max-w-[200px] truncate ${
            task.status === "done" ? "text-success" : "text-error"
          }`}
          title={task.output}
        >
          {task.output.slice(0, 80)}
        </div>
      )}

      {/* Delete button */}
      {!isExecuting && (
        <button
          onClick={() => onDelete(task.id)}
          className="p-1 rounded opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-error hover:bg-error-muted transition-all"
          title="Delete task"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}
