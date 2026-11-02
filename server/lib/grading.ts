// Pure grading helpers shared by actions and tests. No I/O, no LLM.

export type Verdict = "pass" | "fail";

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** True when `quote` appears verbatim (case/whitespace-insensitive) in `answer`. */
export function evidenceFound(answer: string, quote: string): boolean {
  const q = normalize(quote);
  if (q.length < 8) return false;
  return normalize(answer).includes(q);
}

export function parseMustInclude(raw: string): string[] {
  return raw
    .split(/[;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Keyword baseline: pass only if every required phrase appears in the answer. */
export function baselineVerdict(answer: string, mustInclude: string): Verdict | null {
  const phrases = parseMustInclude(mustInclude);
  if (phrases.length === 0) return null;
  const a = normalize(answer);
  return phrases.every((p) => a.includes(normalize(p))) ? "pass" : "fail";
}

export interface ReportRow {
  answer: string;
  mustInclude: string;
  agentVerdict: string | null;
  humanVerdict: string | null;
  isRegression: boolean;
}

export interface SuiteReport {
  total: number;
  agentGraded: number;
  humanReviewed: number;
  pending: number;
  overrules: number;
  regressions: number;
  agentAgreement: number | null;
  baselineAgreement: number | null;
  comparedCases: number;
}

function ratio(hit: number, n: number): number | null {
  return n === 0 ? null : Math.round((hit / n) * 1000) / 10;
}

/** Agreement with the human verdict, for cases a human has reviewed. */
export function computeReport(rows: ReportRow[]): SuiteReport {
  let agentGraded = 0;
  let humanReviewed = 0;
  let overrules = 0;
  let regressions = 0;
  let agentHit = 0;
  let agentN = 0;
  let baseHit = 0;
  let baseN = 0;
  for (const row of rows) {
    if (row.agentVerdict) agentGraded++;
    if (row.isRegression) regressions++;
    if (!row.humanVerdict) continue;
    humanReviewed++;
    if (row.agentVerdict) {
      agentN++;
      if (row.agentVerdict === row.humanVerdict) agentHit++;
      else overrules++;
    }
    const base = baselineVerdict(row.answer, row.mustInclude);
    if (base) {
      baseN++;
      if (base === row.humanVerdict) baseHit++;
    }
  }
  return {
    total: rows.length,
    agentGraded,
    humanReviewed,
    pending: rows.length - humanReviewed,
    overrules,
    regressions,
    agentAgreement: ratio(agentHit, agentN),
    baselineAgreement: ratio(baseHit, baseN),
    comparedCases: agentN,
  };
}

export interface RegressionCase {
  id: string;
  title: string;
  prompt: string;
  answer: string;
  humanVerdict: string | null;
  agentVerdict: string | null;
  humanNote: string | null;
}

/** One JSON object per line: a test the grader must now get right. */
export function toRegressionJsonl(suiteName: string, rows: RegressionCase[], policy = ""): string {
  return rows
    .filter((r) => r.humanVerdict)
    .map((r) =>
      JSON.stringify({
        suite: suiteName,
        ...(policy ? { policy } : {}),
        case_id: r.id,
        title: r.title,
        prompt: r.prompt,
        answer: r.answer,
        expected_verdict: r.humanVerdict,
        grader_said: r.agentVerdict,
        why: r.humanNote ?? "",
      }),
    )
    .join("\n");
}

// ---------- Second reviewer, inter-rater agreement, prompt diffs ----------

/**
 * Deterministic "simulated reviewer" for ABCD return chats. It is NOT a person:
 * it checks the conversation's action log for the guideline's required steps.
 */
export function abcdChecklist(answer: string): { verdict: Verdict; note: string } {
  const checks: Array<[string, RegExp]> = [
    ["Pull up Account", /\[action\] Account has been pulled up/i],
    ["Validate Purchase", /\[action\] Purchase validation/i],
    ["Membership Privileges", /\[action\] Membership level of .+ has been noted/i],
  ];
  const missing = checks.filter(([, re]) => !re.test(answer)).map(([name]) => name);
  return missing.length === 0
    ? { verdict: "pass", note: "Checklist: all required guideline steps appear in the action log." }
    : { verdict: "fail", note: `Checklist: missing guideline step(s) in the action log: ${missing.join(", ")}.` };
}

export interface KappaResult {
  n: number;
  agree: number;
  observed: number | null;
  kappa: number | null;
}

/** Cohen's kappa for two raters over pass/fail labels (pairs where both rated). */
export function cohenKappa(pairs: Array<[Verdict, Verdict]>): KappaResult {
  const n = pairs.length;
  if (n === 0) return { n, agree: 0, observed: null, kappa: null };
  let agree = 0;
  let aPass = 0;
  let bPass = 0;
  for (const [a, b] of pairs) {
    if (a === b) agree++;
    if (a === "pass") aPass++;
    if (b === "pass") bPass++;
  }
  const po = agree / n;
  const pe = (aPass / n) * (bPass / n) + (1 - aPass / n) * (1 - bPass / n);
  const kappa = pe === 1 ? (po === 1 ? 1 : 0) : (po - pe) / (1 - pe);
  return {
    n,
    agree,
    observed: Math.round(po * 1000) / 10,
    kappa: Math.round(kappa * 100) / 100,
  };
}

export type DiffLine = { op: "same" | "add" | "del"; text: string };

/** Line diff (LCS) between two prompt versions. */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const m = a.length;
  const n = b.length;
  const w = n + 1;
  const dp = new Array<number>((m + 1) * w).fill(0);
  const at = (i: number, j: number) => dp[i * w + j] ?? 0;
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i * w + j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    const x = a[i] ?? "";
    const y = b[j] ?? "";
    if (x === y) {
      out.push({ op: "same", text: x });
      i++;
      j++;
    } else if (at(i + 1, j) >= at(i, j + 1)) {
      out.push({ op: "del", text: x });
      i++;
    } else {
      out.push({ op: "add", text: y });
      j++;
    }
  }
  for (; i < m; i++) out.push({ op: "del", text: a[i] ?? "" });
  for (; j < n; j++) out.push({ op: "add", text: b[j] ?? "" });
  return out;
}

/** Default grader instruction (version 1 of every suite's prompt). */
export const DEFAULT_GRADER_PROMPT = [
  "Grade every ungraded case in this suite against the suite policy.",
  "For each case, decide pass or fail.",
  "Quote the exact sentence from the answer that decides the verdict as evidence.",
  "Give a one-sentence reason that names the policy rule.",
].join("\n");
