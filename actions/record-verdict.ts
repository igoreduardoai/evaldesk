import { defineAction, fail } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { evidenceFound } from "../server/lib/grading.js";
import { actorFor, auditRow, loadCase } from "../server/lib/suites.js";

export default defineAction({
  description:
    "Record the AGENT's proposed verdict for one case. The evidence must be an exact quote (8+ chars) copied from the case answer, or the call fails with evidence_not_found (422) — re-read the answer and quote it exactly. Fails with human_locked (409) when a human already reviewed the case; never try to change a human verdict.",
  schema: z.object({
    caseId: z.string().describe("Case id from list-cases"),
    verdict: z.enum(["pass", "fail"]).describe("pass = the answer follows the suite policy"),
    reason: z.string().min(10).max(600).describe("One or two sentences citing the policy rule"),
    evidence: z
      .string()
      .min(8)
      .max(400)
      .describe("Exact quote from the case answer that supports the verdict"),
  }),
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
    if (row.humanVerdict)
      fail("A human already reviewed this case; the agent cannot change it.", {
        errorCode: "human_locked",
        statusCode: 409,
      });
    if (!evidenceFound(row.answer, args.evidence))
      fail("Evidence is not an exact quote from the answer. Quote the answer verbatim.", {
        errorCode: "evidence_not_found",
        statusCode: 422,
      });
    const c = schema.evalCases;
    const now = new Date().toISOString();
    return getDb().transaction(async (tx) => {
      const [updated] = await tx
        .update(c)
        .set({
          agentVerdict: args.verdict,
          agentReason: args.reason,
          agentEvidence: args.evidence,
          agentGradedAt: now,
        })
        .where(and(eq(c.id, row.id), isNull(c.humanVerdict)))
        .returning({ id: c.id });
      if (!updated)
        fail("A human reviewed this case first.", { errorCode: "human_locked", statusCode: 409 });
      await tx.insert(schema.auditEvents).values(
        auditRow({
          suiteId: suite.id,
          caseId: row.id,
          actor: actorFor(ctx),
          kind: "agent_verdict",
          detail: `${args.verdict.toUpperCase()}: ${args.reason}`,
          ownerEmail,
          orgId: suite.orgId,
        }),
      );
      return { id: row.id, suiteId: suite.id, verdict: args.verdict };
    });
  },
});
