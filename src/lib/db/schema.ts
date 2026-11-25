/**
 * Database schema (Drizzle ORM, Postgres / Neon).
 * The first four tables are required by Better Auth (names and columns must match its expectations).
 * After changing this file run `npm run db:generate` and commit the new migration in /drizzle.
 */
import { boolean, index, jsonb, pgTable, integer, text, timestamp, uniqueIndex, bigint, primaryKey } from "drizzle-orm/pg-core";
import type { BrandHit, Source, TrackedBrand } from "../seo/visibility";

// ---------- Better Auth ----------
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // SEO & GEO Studio access control
  role: text("role", { enum: ["admin", "member", "client"] }).notNull().default("member"),
  status: text("status", { enum: ["pending", "active", "disabled"] }).notNull().default("pending"),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (t) => [index("session_user_idx").on(t.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [index("account_user_idx").on(t.userId)]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Better Auth rate-limit counters (rateLimit.storage = "database"). */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// ---------- SEO & GEO Studio ----------
/**
 * "Forgot password" requests (we can't send email). The person requests a reset and gets a short
 * code; an admin checks the code with them and approves; then the SAME browser (it holds the secret
 * token; only its hash is stored) picks a new password.
 */
export const passwordReset = pgTable("password_reset", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  code: text("code").notNull(),
  status: text("status", { enum: ["pending", "approved", "denied", "used"] }).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  decidedAt: timestamp("decided_at"),
  decidedBy: text("decided_by").references(() => user.id, { onDelete: "set null" }),
  /** Pending requests and approvals both lapse after this. */
  expiresAt: timestamp("expires_at").notNull(),
}, (t) => [index("password_reset_user_idx").on(t.userId)]);

/** Emails an admin has invited. Signing in with an invited email activates the account. */
export const invite = pgTable("invite", {
  email: text("email").primaryKey(), // stored lowercase
  role: text("role", { enum: ["admin", "member", "client"] }).notNull().default("member"),
  invitedBy: text("invited_by").references(() => user.id, { onDelete: "set null" }),
  /** For client invites: the project they get read-only access to on sign-up. */
  projectId: text("project_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const project = pgTable("project", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain"), // e.g. "shop.example.com"
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("project_name_idx").on(t.name)]);

/** A saved result from any tool. `data` holds the full report so it can be re-rendered later. */
export const audit = pgTable("audit", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["page", "site"] }).notNull(),
  url: text("url").notNull(),
  keyword: text("keyword"),
  score: integer("score").notNull(),
  issueCount: integer("issue_count").notNull().default(0),
  data: jsonb("data").notNull(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("audit_project_idx").on(t.projectId, t.createdAt), index("audit_url_idx").on(t.projectId, t.url, t.createdAt)]);

// ---------- AI usage (cost guardrails) ----------
/** One row per Claude API request. userId is null for scheduled (system) runs. */
export const aiUsage = pgTable("ai_usage", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  projectId: text("project_id").references(() => project.id, { onDelete: "set null" }),
  feature: text("feature").notNull(), // e.g. "ai-visibility"
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
  webSearches: integer("web_searches").notNull().default(0),
  costMicros: integer("cost_micros").notNull().default(0), // USD * 1e6
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("ai_usage_user_idx").on(t.userId, t.createdAt), index("ai_usage_created_idx").on(t.createdAt)]);

// ---------- AI Visibility ----------
/** Per-project prompt set and tracked brands (TrackedBrand[] from src/lib/seo/visibility.ts). */
export const visibilitySetup = pgTable("visibility_setup", {
  projectId: text("project_id").primaryKey().references(() => project.id, { onDelete: "cascade" }),
  prompts: jsonb("prompts").$type<string[]>().notNull(),
  brands: jsonb("brands").$type<TrackedBrand[]>().notNull(),
  schedule: text("schedule", { enum: ["off", "weekly"] }).notNull().default("off"),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** One run = every prompt in the set asked once. Brands are snapshotted so old runs stay comparable. */
export const visibilityRun = pgTable("visibility_run", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["running", "done", "stopped"] }).notNull().default("running"),
  trigger: text("trigger", { enum: ["manual", "scheduled"] }).notNull().default("manual"),
  model: text("model").notNull(),
  brands: jsonb("brands").$type<TrackedBrand[]>().notNull(),
  promptCount: integer("prompt_count").notNull(),
  estimatedCostMicros: integer("estimated_cost_micros").notNull().default(0),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (t) => [index("visibility_run_project_idx").on(t.projectId, t.createdAt)]);

/** One prompt's answer within a run. Rows start "pending" and are processed one per request. */
export const visibilityResult = pgTable("visibility_result", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => visibilityRun.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  prompt: text("prompt").notNull(),
  status: text("status", { enum: ["pending", "running", "done", "error", "skipped"] }).notNull().default("pending"),
  answer: text("answer"),
  citations: jsonb("citations").$type<Source[]>(),
  sources: jsonb("sources").$type<Source[]>(),
  hits: jsonb("hits").$type<BrandHit[]>(),
  model: text("model"),
  error: text("error"),
  costMicros: integer("cost_micros").notNull().default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (t) => [index("visibility_result_run_idx").on(t.runId, t.position)]);

// ---------- Clients, abuse controls, admin activity ----------
/** Projects a read-only client can see (members and admins see every project). */
export const projectMember = pgTable("project_member", {
  projectId: text("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.projectId, t.userId] }), index("project_member_user_idx").on(t.userId)]);

/** Fixed-window request counters for the public tool APIs (key = "<bucket>:<ip>"). */
export const apiRate = pgTable("api_rate", {
  key: text("key").primaryKey(),
  windowStart: bigint("window_start", { mode: "number" }).notNull(),
  count: integer("count").notNull(),
});

/** What admins changed and when (invites, roles, access, password resets, email tests). */
export const adminAudit = pgTable("admin_audit", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),
  target: text("target"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("admin_audit_created_idx").on(t.createdAt)]);

/** Monthly AI budget alerts already sent (id = "2026-11:80"), so each fires once. */
export const aiAlert = pgTable("ai_alert", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof user.$inferSelect;
export type Project = typeof project.$inferSelect;
export type Audit = typeof audit.$inferSelect;
export type Invite = typeof invite.$inferSelect;
export type PasswordReset = typeof passwordReset.$inferSelect;
export type VisibilitySetup = typeof visibilitySetup.$inferSelect;
export type VisibilityRun = typeof visibilityRun.$inferSelect;
export type VisibilityResult = typeof visibilityResult.$inferSelect;
export type AdminAuditEntry = typeof adminAudit.$inferSelect;
