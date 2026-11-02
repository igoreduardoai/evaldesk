import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { auditRow, loadCase } from "../server/lib/suites.js";

export default defineAction({
  description:
    "Record a SECOND HUMAN reviewer's verdict on a case (for inter-rater agreement). Only people can call this from the UI or CLI; the agent cannot act as a reviewer.",
  schema: z.object({
    caseId: z.string().describe("Case id"),
    reviewer: z.string().min(1).max(80).describe("Reviewer display name"),
    verdict: z.enum(["pass", "fail"]),
    note: z.string().max(600).default(""),
  }),
  run: async (args, ctx) => {
    const ownerEmail = ctx?.userEmail ?? fail("Sign in first.", { statusCode: 401 });
    if (!(ctx?.caller === "frontend" || ctx?.caller === "cli"))
      fail("Only a person can record a reviewer verdict.", { errorCode: "human_only", statusCode: 403 });
    const { row, suite } = await loadCase(args.caseId);
    await getDb().transaction(async (tx) => {
      await tx
        .delete(schema.reviews)
        .where(and(eq(schema.reviews.caseId, row.id), eq(schema.reviews.reviewer, args.reviewer)));
      await tx.insert(schema.reviews).values({
        id: crypto.randomUUID(),
        suiteId: suite.id,
        caseId: row.id,
        reviewer: args.reviewer,
        reviewerKind: "human",
        verdict: args.verdict,
        note: args.note,
        ownerEmail,
        orgId: suite.orgId,
        createdAt: new Date().toISOString(),
      });
      await tx.insert(schema.auditEvents).values(
        auditRow({
          suiteId: suite.id,
          caseId: row.id,
          actor: "human",
          kind: "second_review",
          detail: `${args.reviewer}: ${args.verdict.toUpperCase()}${args.note ? `: ${args.note}` : ""}`,
          ownerEmail,
          orgId: suite.orgId,
        }),
      );
    });
    return { caseId: row.id, reviewer: args.reviewer, verdict: args.verdict };
  },
});
