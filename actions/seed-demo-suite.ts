import { defineAction, fail } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { DEMO_CASES, DEMO_POLICY } from "../server/lib/demo-suite.js";
import { actorFor, auditRow } from "../server/lib/suites.js";

export default defineAction({
  description:
    "Create the synthetic demo suite: 12 answers from a fictional store's refund bot, graded against a 5-rule policy. Use when the user wants to try EvalDesk without their own data.",
  schema: z.object({}),
  link: ({ result }) => ({
    url: buildDeepLink({
      view: "desk",
      to: `/desk/${encodeURIComponent(result.id)}`,
      params: { suiteId: result.id },
    }),
    label: "Open demo suite",
  }),
  run: async (_args, ctx) => {
    const ownerEmail = ctx?.userEmail ?? fail("Sign in first.", { statusCode: 401 });
    const orgId = ctx?.orgId ?? null;
    const suiteId = crypto.randomUUID();
    const name = "Refund bot v3 (synthetic demo)";
    await getDb().transaction(async (tx) => {
      await tx.insert(schema.suites).values({
        id: suiteId,
        name,
        description: "Support-bot answers about refunds for a fictional store. All data is synthetic.",
        policy: DEMO_POLICY,
        dataKind: "synthetic",
        sourceName: "Synthetic: written for this demo (fictional store)",
        ownerEmail,
        orgId,
        visibility: orgId ? "org" : "private",
      });
      await tx.insert(schema.evalCases).values(
        DEMO_CASES.map((item, i) => ({
          id: crypto.randomUUID(),
          suiteId,
          position: i + 1,
          ...item,
          ownerEmail,
          orgId,
        })),
      );
      await tx.insert(schema.auditEvents).values(
        auditRow({
          suiteId,
          actor: actorFor(ctx),
          kind: "suite_seeded",
          detail: `${DEMO_CASES.length} synthetic cases`,
          ownerEmail,
          orgId,
        }),
      );
    });
    return { id: suiteId, name, cases: DEMO_CASES.length };
  },
});
