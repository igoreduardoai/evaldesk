import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { evidenceFound, highlightSpan } from "../server/lib/grading";
import { humanReviewKind, humanVerdictCopy, reviewSavedMessage, undoTarget } from "../server/lib/review-flow";

describe("highlightSpan", () => {
  const answer = "Since it has been 45 days, we can offer store credit for the full amount.";

  it("marks the original words when the accepted quote only differs by whitespace", () => {
    const quote = "offer  store   credit";
    expect(evidenceFound(answer, quote)).toBe(true);
    const span = highlightSpan(answer, quote);
    expect(span).not.toBeNull();
    expect(answer.slice(span!.start, span!.end)).toBe("offer store credit");
  });

  it("marks a case-insensitive quote", () => {
    const text = "Yes. You are within 30 days of delivery.";
    const span = highlightSpan(text, "WITHIN  30   days");
    expect(span).not.toBeNull();
    expect(text.slice(span!.start, span!.end)).toBe("within 30 days");
  });

  it("returns null when the quote is not in the answer", () => {
    expect(highlightSpan(answer, "we refund everything forever today")).toBeNull();
  });

  it("returns null for a quote shorter than 8 characters", () => {
    expect(highlightSpan(answer, "store")).toBeNull();
  });
});

describe("human verdict copy", () => {
  it("does not call a pre-agent human verdict an approval", () => {
    expect(humanVerdictCopy({ isRegression: false, agentVerdict: null })).toBe(
      "You recorded a verdict. The agent has not graded this case.",
    );
  });

  it("keeps the approval sentence when the human matches an agent verdict", () => {
    expect(humanVerdictCopy({ isRegression: false, agentVerdict: "pass" })).toBe(
      "You approved the agent's verdict.",
    );
  });

  it("keeps the overrule sentence when the case is a regression", () => {
    expect(humanVerdictCopy({ isRegression: true, agentVerdict: "pass" })).toBe(
      "You overruled the agent. This case is now a regression test.",
    );
  });
});

describe("review saved message", () => {
  it("does not say approved when there was no agent verdict", () => {
    expect(reviewSavedMessage({ overrule: false, hadAgentVerdict: false })).toBe("Verdict saved");
  });

  it("says approved only when an agent verdict was confirmed", () => {
    expect(reviewSavedMessage({ overrule: false, hadAgentVerdict: true })).toBe("Verdict approved");
  });

  it("keeps the overrule toast", () => {
    expect(reviewSavedMessage({ overrule: true, hadAgentVerdict: true })).toBe(
      "Overruled: saved as a regression test",
    );
  });
});

describe("human review audit kind", () => {
  it("does not record an approval when the agent has not graded", () => {
    expect(humanReviewKind(null, false)).toBe("human_verdict");
  });

  it("records approval and overrule when an agent verdict exists", () => {
    expect(humanReviewKind("pass", false)).toBe("human_approve");
    expect(humanReviewKind("pass", true)).toBe("human_overrule");
  });
});

describe("undoTarget", () => {
  it("undoes the open case when that case has a human verdict", () => {
    expect(undoTarget({ id: "open", humanVerdict: "pass" }, "earlier")).toBe("open");
  });

  it("undoes the verdict just saved after the desk moves to an unreviewed case", () => {
    expect(undoTarget({ id: "next", humanVerdict: null }, "just-saved")).toBe("just-saved");
  });

  it("does nothing when there is no reviewed case to undo", () => {
    expect(undoTarget({ id: "next", humanVerdict: null }, null)).toBeNull();
    expect(undoTarget(null, null)).toBeNull();
  });
});

describe("destructive button contrast", () => {
  it("uses a red dark enough for the near-white label", () => {
    const css = readFileSync(new URL("../app/global.css", import.meta.url), "utf8");
    const root = css.slice(css.indexOf(":root {"), css.indexOf(".dark"));
    const dark = css.slice(css.indexOf(".dark {"));
    expect(root.match(/--destructive:\s*([^;]+);/)?.[1]).toBe("0 72% 42%");
    expect(dark.match(/--destructive:\s*([^;]+);/)?.[1]).toBe("0 72% 42%");
  });
});

describe("viewport zoom", () => {
  it("allows the user to scale the page", () => {
    const root = readFileSync(new URL("../app/root.tsx", import.meta.url), "utf8");
    expect(root).not.toMatch(/user-scalable\s*=\s*no/);
    expect(root).not.toMatch(/maximum-scale\s*=\s*1/);
  });
});
