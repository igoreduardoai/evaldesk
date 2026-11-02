import { defineAction, fail } from "@agent-native/core/action";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { actorFor, auditRow, loadSuite } from "../server/lib/suites.js";

export default defineAction({
  description:
    "Save a new version of the suite's grader prompt (the grading instruction). Requires the person's approval when the agent proposes it. Run the release gate (scripts/release-gate.mjs) against the exported regressions before shipping a new version.",
  schema: z.object({
    suiteId: z.string(),
    text: z.string().min(10).max(4000).describe("Full grader prompt text"),
    note: z.string().max(200).default("").describe("What changed and why"),
  }),
  needsApproval: true,
  run: async (args, ctx) => {
    const ownerEmail = ctx?.userEmail ?? fail("Sign in first.", { statusCode: 401 });
    const suite = await loadSuite(args.suiteId);
    const p = schema.promptVersions;
    const db = getDb();
    const [last] = await db
      .select({ version: p.version })
      .from(p)
      .where(eq(p.suiteId, suite.id))
      .orderBy(desc(p.version))
      .limit(1);
    const version = (last?.version ?? 1) + 1;
    await db.transaction(async (tx) => {
      await tx.insert(p).values({
        id: crypto.randomUUID(),
        suiteId: suite.id,
        version,
        text: args.text,
        note: args.note,
        ownerEmail,
        orgId: suite.orgId,
        createdAt: new Date().toISOString(),
      });
      await tx.insert(schema.auditEvents).values(
        auditRow({
          suiteId: suite.id,
          actor: actorFor(ctx),
          kind: "prompt_version",
          detail: `Grader prompt v${version}${args.note ? `: ${args.note}` : ""}`,
          ownerEmail,
          orgId: suite.orgId,
        }),
      );
    });
    return { suiteId: suite.id, version };
  },
});
