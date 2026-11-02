import { createGetDb } from "@agent-native/core/db";
import { registerShareableResource } from "@agent-native/core/sharing";

import * as schema from "./schema.js";

export const getDb = createGetDb(schema);
export { schema };

registerShareableResource({
  type: "suite",
  resourceTable: schema.suites,
  sharesTable: schema.suiteShares,
  displayName: "Eval suite",
  titleColumn: "name",
  getResourcePath: (suite) => `/desk/${suite.id}`,
  getDb,
});
