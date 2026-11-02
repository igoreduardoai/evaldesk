import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { actorFor, auditRow, loadCase } from "../server/lib/suites.js";

export default defineAction({
  description: "Undo the human verdict on a case so it can be reviewed again.",
  schema: z.object({ caseId: z.string().describe("Case id from list-cases") }),
  needsApproval: true,
  run: async (args, ctx) => {
    const ownerEmail = ctx?.userEmail ?? fail("Sign in first.", { statusCode: 401 });
    const { row, suite } = await loadCase(args.caseId);
    if (!row.humanVerdict)
      fail("This case has no human verdict to undo.", { errorCode: "not_reviewed", statusCode: 409 });
    const c = schema.evalCases;
    return getDb().transaction(async (tx) => {
      await tx
        .update(c)
        .set({ humanVerdict: null, humanNote: null, reviewedAt: null, isRegression: false })
        .where(eq(c.id, row.id));
      await tx.insert(schema.auditEvents).values(
        auditRow({
          suiteId: suite.id,
          caseId: row.id,
          actor: actorFor(ctx),
          kind: "human_reopen",
          detail: "verdict undone",
          ownerEmail,
          orgId: suite.orgId,
        }),
      );
      return { id: row.id, suiteId: suite.id };
    });
  },
});
