import { defineAction, fail } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { count, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { actorFor, auditRow, loadSuite } from "../server/lib/suites.js";

export default defineAction({
  description:
    "Add LLM answers (cases) to a suite in one batch. Each case is a prompt, the model's answer, and optional required phrases for the keyword baseline.",
  schema: z.object({
    suiteId: z.string().describe("Suite id from list-suites"),
    cases: z
      .array(
        z.object({
          title: z.string().min(1).max(120).describe("Short case label"),
          prompt: z.string().min(1).max(4000).describe("What the user asked the graded model"),
          answer: z.string().min(1).max(8000).describe("What the graded model answered"),
          mustInclude: z
            .string()
            .max(500)
            .default("")
            .describe("Required phrases for the keyword baseline, separated by ';'"),
        }),
      )
      .min(1)
      .max(100)
      .describe("Cases to add"),
  }),
  link: ({ args }) => ({
    url: buildDeepLink({
      view: "desk",
      to: `/desk/${encodeURIComponent(args.suiteId)}`,
      params: { suiteId: args.suiteId },
    }),
    label: "Open suite",
  }),
  run: async (args, ctx) => {
    const ownerEmail = ctx?.userEmail ?? fail("Sign in first.", { statusCode: 401 });
    const suite = await loadSuite(args.suiteId);
    const c = schema.evalCases;
    return getDb().transaction(async (tx) => {
      const [counted] = await tx
        .select({ n: count() })
        .from(c)
        .where(eq(c.suiteId, suite.id));
      const n = Number(counted?.n ?? 0);
      if (n + args.cases.length > 500)
        fail("A suite holds at most 500 cases.", { errorCode: "suite_full", statusCode: 409 });
      const rows = args.cases.map((item, i) => ({
        id: crypto.randomUUID(),
        suiteId: suite.id,
        position: n + i + 1,
        title: item.title,
        prompt: item.prompt,
        answer: item.answer,
        mustInclude: item.mustInclude,
        ownerEmail,
        orgId: suite.orgId,
      }));
      await tx.insert(c).values(rows);
      await tx.insert(schema.auditEvents).values(
        auditRow({
          suiteId: suite.id,
          actor: actorFor(ctx),
          kind: "cases_added",
          detail: `${rows.length} case(s) added`,
          ownerEmail,
          orgId: suite.orgId,
        }),
      );
      return { suiteId: suite.id, added: rows.length, ids: rows.map((r) => r.id) };
    });
  },
});
