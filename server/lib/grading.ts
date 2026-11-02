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
export function toRegressionJsonl(suiteName: string, rows: RegressionCase[]): string {
  return rows
    .filter((r) => r.humanVerdict)
    .map((r) =>
      JSON.stringify({
        suite: suiteName,
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
