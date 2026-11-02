import { defineAction } from "@agent-native/core/action";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { DEFAULT_GRADER_PROMPT } from "../server/lib/grading.js";
import { loadSuite } from "../server/lib/suites.js";

export default defineAction({
  description:
    "List the grader prompt versions for a suite (version 1 is the built-in default). The latest version is the instruction to follow when grading.",
  schema: z.object({ suiteId: z.string() }),
  http: { method: "GET" },
  readOnly: true,
  run: async (args) => {
    const suite = await loadSuite(args.suiteId);
    const p = schema.promptVersions;
    const rows = await getDb()
      .select({ version: p.version, text: p.text, note: p.note, createdAt: p.createdAt })
      .from(p)
      .where(eq(p.suiteId, suite.id))
      .orderBy(asc(p.version));
    const versions = [
      { version: 1, text: DEFAULT_GRADER_PROMPT, note: "Built-in default", createdAt: null as string | null },
      ...rows,
    ];
    return { suiteId: suite.id, versions, latest: versions[versions.length - 1] };
  },
});
