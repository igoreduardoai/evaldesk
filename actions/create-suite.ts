import { defineAction, fail } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description:
    "Create an eval suite: a named set of LLM answers graded against one written policy. Org-visible when an org is active, otherwise private.",
  schema: z.object({
    name: z.string().min(1).max(120).describe('Suite name, e.g. "Refund bot v3"'),
    description: z.string().max(500).default("").describe("What the graded model does"),
    policy: z
      .string()
      .max(4000)
      .default("")
      .describe("The ground-truth policy or rubric every answer is graded against"),
  }),
  link: ({ result }) => ({
    url: buildDeepLink({
      view: "desk",
      to: `/desk/${encodeURIComponent(result.id)}`,
      params: { suiteId: result.id },
    }),
    label: `Open ${result.name}`,
  }),
  run: async (args, ctx) => {
    const ownerEmail =
      ctx?.userEmail ?? fail("Sign in to create suites.", { statusCode: 401 });
    const orgId = ctx?.orgId ?? null;
    const suite = {
      id: crypto.randomUUID(),
      name: args.name,
      description: args.description,
      policy: args.policy,
      ownerEmail,
      orgId,
      visibility: orgId ? ("org" as const) : ("private" as const),
    };
    await getDb().insert(schema.suites).values(suite);
    return { id: suite.id, name: suite.name };
  },
});
