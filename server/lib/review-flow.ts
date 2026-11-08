// Copy and keyboard targets for the review desk. No I/O.

export function humanVerdictCopy(input: {
  isRegression: boolean;
  agentVerdict: string | null;
}): string {
  if (input.isRegression) return "You overruled the agent. This case is now a regression test.";
  if (!input.agentVerdict) return "You recorded a verdict. The agent has not graded this case.";
  return "You approved the agent's verdict.";
}

export function reviewSavedMessage(input: { overrule: boolean; hadAgentVerdict: boolean }): string {
  if (input.overrule) return "Overruled: saved as a regression test";
  if (!input.hadAgentVerdict) return "Verdict saved";
  return "Verdict approved";
}

/** Audit kind for a human verdict. Approval requires an agent verdict to approve. */
export function humanReviewKind(agentVerdict: string | null, overrule: boolean): "human_overrule" | "human_approve" | "human_verdict" {
  if (overrule) return "human_overrule";
  if (!agentVerdict) return "human_verdict";
  return "human_approve";
}

/**
 * Case id U should undo. The open case wins when it already has a human verdict.
 * After P/F the desk moves to the next unreviewed case, so U then targets the verdict just saved.
 */
export function undoTarget(
  selected: { id: string; humanVerdict: string | null } | null,
  lastReviewedId: string | null,
): string | null {
  if (selected?.humanVerdict) return selected.id;
  return lastReviewedId;
}
