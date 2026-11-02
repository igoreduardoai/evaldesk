import { defineAction, fail } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { ABCD_CASES, ABCD_POLICY, ABCD_SOURCE } from "../server/lib/abcd-suite.js";
import { actorFor, auditRow } from "../server/lib/suites.js";

export default defineAction({
  description:
    "Create the real-data suite: 12 human-written customer-service chats (wrong-size returns) from the public ABCD dataset (ASAPP Research, MIT License), graded against the dataset's own agent guideline. Use when the user wants to evaluate on real public data instead of synthetic data.",
  schema: z.object({}),
  link: ({ result }) => ({
    url: buildDeepLink({
      view: "desk",
      to: `/desk/${encodeURIComponent(result.id)}`,
      params: { suiteId: result.id },
    }),
    label: "Open ABCD suite",
  }),
  run: async (_args, ctx) => {
    const ownerEmail = ctx?.userEmail ?? fail("Sign in first.", { statusCode: 401 });
    const orgId = ctx?.orgId ?? null;
    const suiteId = crypto.randomUUID();
    const name = "ABCD returns: wrong size (real public data)";
    await getDb().transaction(async (tx) => {
      await tx.insert(schema.suites).values({
        id: suiteId,
        name,
        description:
          "Real public data: human-written role-play support chats from ABCD (crowdworkers as agent and customer). Customer names and addresses are fictional dataset scenarios.",
        policy: ABCD_POLICY,
        dataKind: "public",
        sourceName: ABCD_SOURCE.name,
        sourceUrl: ABCD_SOURCE.url,
        sourceLicense: ABCD_SOURCE.license,
        ownerEmail,
        orgId,
        visibility: orgId ? "org" : "private",
      });
      await tx.insert(schema.evalCases).values(
        ABCD_CASES.map((item, i) => ({
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
          detail: `${ABCD_CASES.length} ABCD cases (MIT)`,
          ownerEmail,
          orgId,
        }),
      );
    });
    return { id: suiteId, name, cases: ABCD_CASES.length };
  },
});
