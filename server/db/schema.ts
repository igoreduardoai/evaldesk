import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";
import {
  createSharesTable,
  ownableColumns,
} from "@agent-native/core/db/schema";

// An eval suite is a team resource: org-visible when an org is active.
export const suites = pgTable("suites", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  policy: text("policy").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  ...ownableColumns(),
});
export const suiteShares = createSharesTable("suite_shares");

// One LLM answer to grade. Child of a suite; inherits the suite's access.
export const evalCases = pgTable("eval_cases", {
  id: text("id").primaryKey(),
  suiteId: text("suite_id").notNull(),
  position: integer("position").notNull().default(0),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  answer: text("answer").notNull(),
  mustInclude: text("must_include").notNull().default(""),
  agentVerdict: text("agent_verdict"),
  agentReason: text("agent_reason"),
  agentEvidence: text("agent_evidence"),
  agentGradedAt: text("agent_graded_at"),
  humanVerdict: text("human_verdict"),
  humanNote: text("human_note"),
  reviewedAt: text("reviewed_at"),
  isRegression: boolean("is_regression").notNull().default(false),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});

// Append-only audit trail: who (agent or human) did what to which case.
export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  suiteId: text("suite_id").notNull(),
  caseId: text("case_id"),
  actor: text("actor").notNull(),
  kind: text("kind").notNull(),
  detail: text("detail").notNull().default(""),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
  createdAt: text("created_at").notNull(),
});
