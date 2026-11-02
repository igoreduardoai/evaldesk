import { describe, expect, it } from "vitest";

import { DEMO_CASES } from "../server/lib/demo-suite";
import {
  baselineVerdict,
  computeReport,
  evidenceFound,
  toRegressionJsonl,
} from "../server/lib/grading";

describe("evidenceFound", () => {
  const answer = "Yes. You are within 30 days of delivery, so we refund your original payment method.";
  it("accepts an exact quote, ignoring case and spacing", () => {
    expect(evidenceFound(answer, "WITHIN 30   days of delivery")).toBe(true);
  });
  it("rejects a fabricated quote", () => {
    expect(evidenceFound(answer, "we refund everything forever")).toBe(false);
  });
  it("rejects quotes shorter than 8 characters", () => {
    expect(evidenceFound(answer, "Yes.")).toBe(false);
  });
});

describe("baselineVerdict", () => {
  it("passes only when every required phrase is present", () => {
    expect(baselineVerdict("store credit only", "store credit")).toBe("pass");
    expect(baselineVerdict("cash back", "store credit;cash")).toBe("fail");
  });
  it("returns null without required phrases", () => {
    expect(baselineVerdict("anything", "")).toBeNull();
  });
});

// Human labels for the synthetic demo suite (see README "Demo ground truth").
const HUMAN = ["pass", "pass", "fail", "pass", "fail", "pass", "fail", "pass", "pass", "fail", "pass", "fail"];

describe("demo suite", () => {
  it("keyword baseline agrees with the human on 8 of 12 cases", () => {
    const rows = DEMO_CASES.map((c, i) => ({
      answer: c.answer,
      mustInclude: c.mustInclude,
      agentVerdict: null,
      humanVerdict: HUMAN[i],
      isRegression: false,
    }));
    const report = computeReport(rows);
    expect(report.humanReviewed).toBe(12);
    expect(report.baselineAgreement).toBe(66.7);
  });
});

describe("computeReport", () => {
  it("counts overrules and agreement against human verdicts only", () => {
    const report = computeReport([
      { answer: "a", mustInclude: "", agentVerdict: "pass", humanVerdict: "pass", isRegression: false },
      { answer: "a", mustInclude: "", agentVerdict: "pass", humanVerdict: "fail", isRegression: true },
      { answer: "a", mustInclude: "", agentVerdict: "fail", humanVerdict: null, isRegression: false },
    ]);
    expect(report.agentGraded).toBe(3);
    expect(report.humanReviewed).toBe(2);
    expect(report.overrules).toBe(1);
    expect(report.regressions).toBe(1);
    expect(report.agentAgreement).toBe(50);
    expect(report.pending).toBe(1);
  });
});

describe("toRegressionJsonl", () => {
  it("writes one JSON test per reviewed case", () => {
    const out = toRegressionJsonl("S", [
      { id: "1", title: "t", prompt: "p", answer: "a", humanVerdict: "fail", agentVerdict: "pass", humanNote: "n" },
      { id: "2", title: "t", prompt: "p", answer: "a", humanVerdict: null, agentVerdict: "pass", humanNote: null },
    ]);
    const lines = out.split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ expected_verdict: "fail", grader_said: "pass" });
  });
});
