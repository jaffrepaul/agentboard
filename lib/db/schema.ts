import { pgTable, pgEnum, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const projectModeEnum = pgEnum("project_mode", ["build", "research"]);

export const projectStatusEnum = pgEnum("project_status", [
  "idle",
  "executing",
  "completed",
  "failed",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "backlog",
  "todo",
  "in_progress",
  "done",
  "failed",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
]);

export const logTypeEnum = pgEnum("log_type", [
  "info",
  "tool_use",
  "result",
  "error",
  "progress",
]);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  identifier: text("identifier").notNull(),
  mode: projectModeEnum("mode").notNull().default("build"),
  status: projectStatusEnum("status").notNull().default("idle"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: taskStatusEnum("status").notNull().default("todo"),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  output: text("output").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  order: integer("order").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const executionLogs = pgTable("execution_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  taskId: text("task_id").notNull().default(""),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),
  type: logTypeEnum("type").notNull(),
  content: text("content").notNull().default(""),
});

export const researchSheets = pgTable("research_sheets", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Relations
export const projectsRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks),
  executionLogs: many(executionLogs),
  researchSheets: many(researchSheets),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  researchSheets: many(researchSheets),
}));

export const executionLogsRelations = relations(executionLogs, ({ one }) => ({
  project: one(projects, {
    fields: [executionLogs.projectId],
    references: [projects.id],
  }),
}));

export const researchSheetsRelations = relations(researchSheets, ({ one }) => ({
  project: one(projects, {
    fields: [researchSheets.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [researchSheets.taskId],
    references: [tasks.id],
  }),
}));
