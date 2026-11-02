import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { abcdChecklist } from "../server/lib/grading.js";
import { SIMULATED_REVIEWER, actorFor, auditRow, loadSuite } from "../server/lib/suites.js";

export default defineAction({
  description:
    "Run the SIMULATED second reviewer on a real-data (ABCD) suite. It is a deterministic rule-based checklist, not a person: it checks each chat's action log for the guideline's required steps (Pull up Account, Validate Purchase, Membership Privileges). Its labels are stored separately from the human verdict and used for inter-rater agreement.",
  schema: z.object({ suiteId: z.string().describe("Suite id from list-suites") }),
  run: async (args, ctx) => {
    const ownerEmail = ctx?.userEmail ?? fail("Sign in first.", { statusCode: 401 });
    const suite = await loadSuite(args.suiteId);
    if (suite.dataKind !== "public")
      fail("The simulated checklist reviewer only knows the ABCD guideline. Use it on the ABCD suite.", {
        errorCode: "no_checklist",
        statusCode: 422,
      });
    const db = getDb();
    const cases = await db
      .select({ id: schema.evalCases.id, answer: schema.evalCases.answer })
      .from(schema.evalCases)
      .where(eq(schema.evalCases.suiteId, suite.id));
    let pass = 0;
    await db.transaction(async (tx) => {
      for (const item of cases) {
        const r = abcdChecklist(item.answer);
        if (r.verdict === "pass") pass++;
        await tx
          .delete(schema.reviews)
          .where(and(eq(schema.reviews.caseId, item.id), eq(schema.reviews.reviewer, SIMULATED_REVIEWER)));
        await tx.insert(schema.reviews).values({
          id: crypto.randomUUID(),
          suiteId: suite.id,
          caseId: item.id,
          reviewer: SIMULATED_REVIEWER,
          reviewerKind: "simulated",
          verdict: r.verdict,
          note: r.note,
          ownerEmail,
          orgId: suite.orgId,
          createdAt: new Date().toISOString(),
        });
      }
      await tx.insert(schema.auditEvents).values(
        auditRow({
          suiteId: suite.id,
          actor: actorFor(ctx),
          kind: "simulated_review",
          detail: `${SIMULATED_REVIEWER}: ${pass} PASS / ${cases.length - pass} FAIL (rule-based, not a person)`,
          ownerEmail,
          orgId: suite.orgId,
        }),
      );
    });
    return { suiteId: suite.id, reviewer: SIMULATED_REVIEWER, kind: "simulated", pass, fail: cases.length - pass };
  },
});
