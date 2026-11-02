import { defineAction } from "@agent-native/core/action";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadSuite } from "../server/lib/suites.js";

export default defineAction({
  description: "List the latest audit events (agent verdicts, human approvals and overrules) for a suite.",
  schema: z.object({
    suiteId: z.string().describe("Suite id from list-suites"),
    limit: z.coerce.number().int().min(1).max(200).default(50).describe("Max events"),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async (args) => {
    const suite = await loadSuite(args.suiteId);
    const a = schema.auditEvents;
    const events = await getDb()
      .select({
        id: a.id,
        caseId: a.caseId,
        actor: a.actor,
        kind: a.kind,
        detail: a.detail,
        createdAt: a.createdAt,
      })
      .from(a)
      .where(eq(a.suiteId, suite.id))
      .orderBy(desc(a.createdAt))
      .limit(args.limit);
    return { events };
  },
});
