import { defineAction } from "@agent-native/core/action";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { toRegressionJsonl } from "../server/lib/grading.js";
import { loadSuite } from "../server/lib/suites.js";

export default defineAction({
  description:
    "Export the suite's regression tests (cases where a human overruled the agent) as JSONL, one test per line, ready to run in CI against the next grader prompt.",
  schema: z.object({
    suiteId: z.string().describe("Suite id from list-suites"),
    scope: z
      .enum(["regressions", "all_reviewed"])
      .default("regressions")
      .describe("regressions = human overrules only; all_reviewed = every human-reviewed case"),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async (args) => {
    const suite = await loadSuite(args.suiteId);
    const c = schema.evalCases;
    const rows = await getDb()
      .select({
        id: c.id,
        title: c.title,
        prompt: c.prompt,
        answer: c.answer,
        humanVerdict: c.humanVerdict,
        agentVerdict: c.agentVerdict,
        humanNote: c.humanNote,
      })
      .from(c)
      .where(
        and(
          eq(c.suiteId, suite.id),
          args.scope === "regressions" ? eq(c.isRegression, true) : isNotNull(c.humanVerdict),
        ),
      )
      .orderBy(asc(c.position))
      .limit(500);
    const jsonl = toRegressionJsonl(suite.name, rows, suite.policy);
    return {
      suiteId: suite.id,
      count: rows.length,
      filename: `${suite.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase()}-${args.scope === "regressions" ? "regressions" : "reviewed"}.jsonl`,
      jsonl,
    };
  },
});
