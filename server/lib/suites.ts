import { fail } from "@agent-native/core/action";
import { accessFilter } from "@agent-native/core/sharing";
import { and, eq } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";

/** Load a suite the caller can see, or fail with 404. */
export async function loadSuite(suiteId: string) {
  const { suites, suiteShares } = schema;
  const [suite] = await getDb()
    .select({
      id: suites.id,
      name: suites.name,
      description: suites.description,
      policy: suites.policy,
      dataKind: suites.dataKind,
      sourceName: suites.sourceName,
      sourceUrl: suites.sourceUrl,
      sourceLicense: suites.sourceLicense,
      orgId: suites.orgId,
    })
    .from(suites)
    .where(and(eq(suites.id, suiteId), accessFilter(suites, suiteShares)))
    .limit(1);
  if (!suite) fail("Suite not found.", { errorCode: "not_found", statusCode: 404 });
  return suite;
}

/** Load one case together with its suite access check. */
export async function loadCase(caseId: string) {
  const c = schema.evalCases;
  const [row] = await getDb()
    .select()
    .from(c)
    .where(eq(c.id, caseId))
    .limit(1);
  if (!row) fail("Case not found.", { errorCode: "not_found", statusCode: 404 });
  const suite = await loadSuite(row.suiteId);
  return { row, suite };
}

export function auditRow(input: {
  suiteId: string;
  caseId?: string | null;
  actor: "agent" | "human";
  kind: string;
  detail: string;
  ownerEmail: string;
  orgId: string | null;
}) {
  return {
    id: crypto.randomUUID(),
    suiteId: input.suiteId,
    caseId: input.caseId ?? null,
    actor: input.actor,
    kind: input.kind,
    detail: input.detail.slice(0, 500),
    ownerEmail: input.ownerEmail,
    orgId: input.orgId,
    createdAt: new Date().toISOString(),
  };
}

/** Browser clicks and a person at the CLI are the human; agent tools, MCP and A2A are the agent. */
export function actorFor(ctx: { caller?: string } | undefined): "agent" | "human" {
  return ctx?.caller === "frontend" || ctx?.caller === "cli" ? "human" : "agent";
}

export const SIMULATED_REVIEWER = "Simulated reviewer (guideline checklist)";
