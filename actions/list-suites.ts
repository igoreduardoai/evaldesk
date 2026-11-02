import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { accessFilter } from "@agent-native/core/sharing";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description: "List the eval suites the current user can see.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  link: () => ({
    url: buildDeepLink({ view: "desk", to: "/desk" }),
    label: "Open EvalDesk",
  }),
  run: async () => {
    const { suites, suiteShares } = schema;
    const rows = await getDb()
      .select({
        id: suites.id,
        name: suites.name,
        description: suites.description,
        createdAt: suites.createdAt,
      })
      .from(suites)
      .where(accessFilter(suites, suiteShares))
      .orderBy(suites.name)
      .limit(200);
    return { suites: rows };
  },
});
