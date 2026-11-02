import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { baselineVerdict, cohenKappa, computeReport, type Verdict } from "../server/lib/grading.js";
import { loadSuite } from "../server/lib/suites.js";

export default defineAction({
  description:
    "List a suite's cases with the agent verdict, the human verdict, the keyword-baseline verdict, any second-reviewer verdicts (human or clearly labeled simulated), and the suite report (agreement rates, Cohen's kappa, overrules, regressions). Use status 'ungraded' to fetch only cases the agent has not graded yet.",
  schema: z.object({
    suiteId: z.string().describe("Suite id from list-suites"),
    status: z
      .enum(["all", "ungraded", "needs_review", "regressions"])
      .default("all")
      .describe("Filter: all, ungraded (no agent verdict), needs_review (no human verdict), regressions"),
  }),
  http: { method: "GET" },
  readOnly: true,
  link: ({ args }) => ({
    url: buildDeepLink({
      view: "desk",
      to: `/desk/${encodeURIComponent(args.suiteId)}`,
      params: { suiteId: args.suiteId },
    }),
    label: "Open suite",
  }),
  run: async (args) => {
    const suite = await loadSuite(args.suiteId);
    const c = schema.evalCases;
    const rows = await getDb()
      .select({
        id: c.id,
        position: c.position,
        title: c.title,
        prompt: c.prompt,
        answer: c.answer,
        mustInclude: c.mustInclude,
        agentVerdict: c.agentVerdict,
        agentReason: c.agentReason,
        agentEvidence: c.agentEvidence,
        humanVerdict: c.humanVerdict,
        humanNote: c.humanNote,
        isRegression: c.isRegression,
      })
      .from(c)
      .where(eq(c.suiteId, suite.id))
      .orderBy(asc(c.position))
      .limit(500);
    const report = computeReport(rows);
    const reviewRows = await getDb()
      .select({
        caseId: schema.reviews.caseId,
        reviewer: schema.reviews.reviewer,
        reviewerKind: schema.reviews.reviewerKind,
        verdict: schema.reviews.verdict,
        note: schema.reviews.note,
      })
      .from(schema.reviews)
      .where(eq(schema.reviews.suiteId, suite.id))
      .limit(5000);
    const byCase = new Map<string, typeof reviewRows>();
    for (const r of reviewRows) byCase.set(r.caseId, [...(byCase.get(r.caseId) ?? []), r]);
    // Inter-rater agreement: primary human verdict vs each additional reviewer.
    const reviewers = [...new Set(reviewRows.map((r) => r.reviewer))];
    const interRater = reviewers.map((name) => {
      const kind = reviewRows.find((r) => r.reviewer === name)?.reviewerKind ?? "human";
      const pairs: Array<[Verdict, Verdict]> = [];
      for (const row of rows) {
        const other = byCase.get(row.id)?.find((r) => r.reviewer === name);
        if (row.humanVerdict && other) pairs.push([row.humanVerdict as Verdict, other.verdict as Verdict]);
      }
      return { reviewer: name, kind, ...cohenKappa(pairs) };
    });
    const agentPairs: Array<[Verdict, Verdict]> = rows
      .filter((r) => r.humanVerdict && r.agentVerdict)
      .map((r) => [r.humanVerdict as Verdict, r.agentVerdict as Verdict]);
    const agentKappa = cohenKappa(agentPairs);
    const withBaseline = rows.map((r) => ({
      ...r,
      baselineVerdict: baselineVerdict(r.answer, r.mustInclude),
      reviews: byCase.get(r.id) ?? [],
    }));
    const filtered = withBaseline.filter((r) =>
      args.status === "ungraded"
        ? !r.agentVerdict && !r.humanVerdict
        : args.status === "needs_review"
          ? !r.humanVerdict
          : args.status === "regressions"
            ? r.isRegression
            : true,
    );
    return { suite, report: { ...report, agentKappa: agentKappa.kappa }, interRater, cases: filtered };
  },
});
