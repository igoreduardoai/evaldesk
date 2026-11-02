import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";

const INITIAL_TOOL_NAMES = [
  "view-screen",
  "navigate",
  "list-suites",
  "list-cases",
  "record-verdict",
  "review-case",
  "add-cases",
  "create-suite",
  "seed-demo-suite",
  "export-regressions",
  "list-audit",
  "ask-question",
];

export default createAgentChatPlugin({
  appId: "evaldesk",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  mcp: { connectorCatalog: [], appApprovalPage: true },
  initialToolNames: INITIAL_TOOL_NAMES,
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  systemPrompt: `You are the EvalDesk agent. You grade LLM answers against a written policy, and a human approves or overrules every verdict.

Workflow: read the suite policy and cases with list-cases, then call record-verdict once per case. Each verdict needs a short reason that cites the policy rule number and an EXACT quote from the answer as evidence; if record-verdict fails with evidence_not_found, re-read the answer and quote it verbatim. Never fabricate. Never call review-case unless the user explicitly asks you to record THEIR verdict; human verdicts are theirs. A human_locked error means a person already decided: report it and move on. When the user asks about a case, read it with list-cases and the current screen (suiteId/caseId in navigation).`,
});
