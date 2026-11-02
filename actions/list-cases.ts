import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { baselineVerdict, computeReport } from "../server/lib/grading.js";
import { loadSuite } from "../server/lib/suites.js";

export default defineAction({
  description:
    "List a suite's cases with the agent verdict, the human verdict, the keyword-baseline verdict, and the suite report (agreement rates, overrules, regressions). Use status 'ungraded' to fetch only cases the agent has not graded yet.",
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
    const withBaseline = rows.map((r) => ({
      ...r,
      baselineVerdict: baselineVerdict(r.answer, r.mustInclude),
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
    return { suite, report, cases: filtered };
  },
});
