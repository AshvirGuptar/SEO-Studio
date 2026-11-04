/**
 * Database schema (Drizzle ORM, Postgres / Neon).
 * The first four tables are required by Better Auth (names and columns must match its expectations).
 * After changing this file run `npm run db:generate` and commit the new migration in /drizzle.
 */
import { boolean, index, jsonb, pgTable, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// ---------- Better Auth ----------
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // SEO Studio access control
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
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

// ---------- SEO Studio ----------
/** Emails an admin has invited. Signing in with an invited email activates the account. */
export const invite = pgTable("invite", {
  email: text("email").primaryKey(), // stored lowercase
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  invitedBy: text("invited_by").references(() => user.id, { onDelete: "set null" }),
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

export type User = typeof user.$inferSelect;
export type Project = typeof project.$inferSelect;
export type Audit = typeof audit.$inferSelect;
export type Invite = typeof invite.$inferSelect;
