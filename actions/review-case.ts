import { defineAction, fail } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { humanReviewKind } from "../server/lib/review-flow.js";
import { actorFor, auditRow, loadCase } from "../server/lib/suites.js";

export default defineAction({
  description:
    "Record the HUMAN verdict for a case (approve or overrule the agent). Requires the person's approval when the agent calls it. An overrule (human verdict differs from the agent's) marks the case as a regression test.",
  schema: z.object({
    caseId: z.string().describe("Case id from list-cases"),
    verdict: z.enum(["pass", "fail"]).describe("The human's final verdict"),
    note: z.string().max(600).default("").describe("Why, in the reviewer's words"),
  }),
  needsApproval: true,
  link: ({ result }) => ({
    url: buildDeepLink({
      view: "desk",
      to: `/desk/${encodeURIComponent(result.suiteId)}?case=${encodeURIComponent(result.id)}`,
      params: { suiteId: result.suiteId, caseId: result.id },
    }),
    label: "Open case",
  }),
  run: async (args, ctx) => {
    const ownerEmail = ctx?.userEmail ?? fail("Sign in first.", { statusCode: 401 });
    const { row, suite } = await loadCase(args.caseId);
    const hadAgentVerdict = Boolean(row.agentVerdict);
    const overrule = hadAgentVerdict && row.agentVerdict !== args.verdict;
    const c = schema.evalCases;
    return getDb().transaction(async (tx) => {
      await tx
        .update(c)
        .set({
          humanVerdict: args.verdict,
          humanNote: args.note,
          reviewedAt: new Date().toISOString(),
          isRegression: overrule,
        })
        .where(eq(c.id, row.id));
      await tx.insert(schema.auditEvents).values(
        auditRow({
          suiteId: suite.id,
          caseId: row.id,
          actor: actorFor(ctx),
          kind: humanReviewKind(row.agentVerdict, overrule),
          detail: `${args.verdict.toUpperCase()}${args.note ? `: ${args.note}` : ""}`,
          ownerEmail,
          orgId: suite.orgId,
        }),
      );
      return {
        id: row.id,
        suiteId: suite.id,
        verdict: args.verdict,
        overrule,
        hadAgentVerdict,
        isRegression: overrule,
      };
    });
  },
});
