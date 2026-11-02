#!/usr/bin/env node
// EvalDesk release gate: re-grade the exported regression tests with a NEW grader
// prompt and block the release (exit code 1) if any test fails.
//
// Usage:
//   node scripts/release-gate.mjs --tests regressions.jsonl --prompt prompts/grader-v2.txt \
//     [--model nvidia/nemotron-3-ultra-550b-a55b:free] [--out gate-report.json]
// Uses OpenRouter by default (OPENROUTER_API_KEY). Any OpenAI-compatible endpoint
// works: set GATE_BASE_URL and GATE_API_KEY (e.g. Nebius AI Studio). A test passes when the model's verdict equals the
// human's expected_verdict AND its evidence quote appears verbatim in the answer.
import { readFileSync, writeFileSync } from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), all[i + 1]]);
    return acc;
  }, []),
);
if (!args.tests || !args.prompt) {
  console.error("Usage: node scripts/release-gate.mjs --tests file.jsonl --prompt prompt.txt [--model id] [--out report.json]");
  process.exit(2);
}
const baseUrl = (args["base-url"] ?? process.env.GATE_BASE_URL ?? "https://openrouter.ai/api/v1").replace(/\/$/, ""); // guard:allow-env-credential — standalone CI script run with CI secrets, outside the app (no user context)
const key = process.env.GATE_API_KEY ?? process.env.OPENROUTER_API_KEY; // guard:allow-env-credential — standalone CI script run with CI secrets, outside the app (no user context)
if (!key) {
  console.error("Set GATE_API_KEY (or OPENROUTER_API_KEY).");
  process.exit(2);
}
const envModel = process.env.GATE_MODEL; // guard:allow-env-credential — standalone CI script run with CI secrets, outside the app (no user context)
const models = (args.model ?? envModel ?? "nvidia/nemotron-3-ultra-550b-a55b:free").split(",");
const grader = readFileSync(args.prompt, "utf8").trim();
const tests = readFileSync(args.tests, "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

const norm = (t) =>
  String(t ?? "")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
const found = (answer, quote) => norm(quote).length >= 8 && norm(answer).includes(norm(quote));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function grade(test) {
  const system = `${grader}\n\nPolicy:\n${test.policy ?? "(policy missing from export)"}\n\nReply with JSON only: {"verdict":"pass"|"fail","evidence":"<exact quote from the answer>","reason":"<one sentence naming the rule>"}`;
  const user = `User asked:\n${test.prompt}\n\nModel answered:\n${test.answer}`;
  let lastErr = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const model = models[Math.min(attempt, models.length - 1)];
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (res.status === 429 || res.status >= 500) {
      lastErr = `${model}: HTTP ${res.status}`;
      await sleep(4000 * (attempt + 1));
      continue;
    }
    const body = await res.json();
    if (!res.ok) throw new Error(`${model}: HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
    const text = body.choices?.[0]?.message?.content ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) {
      lastErr = `${model}: no JSON in reply`;
      continue;
    }
    try {
      return { model, ...JSON.parse(m[0]) };
    } catch {
      lastErr = `${model}: unparseable JSON`;
    }
  }
  throw new Error(lastErr || "grading failed");
}

const results = [];
for (const t of tests) {
  let r;
  try {
    const g = await grade(t);
    const verdict = String(g.verdict ?? "").toLowerCase();
    const evidenceOk = found(t.answer, g.evidence);
    const ok = verdict === t.expected_verdict && evidenceOk;
    r = { case_id: t.case_id, title: t.title, expected: t.expected_verdict, got: verdict, evidence_ok: evidenceOk, ok, model: g.model, reason: g.reason, evidence: g.evidence };
  } catch (err) {
    r = { case_id: t.case_id, title: t.title, expected: t.expected_verdict, got: null, ok: false, error: String(err.message ?? err) };
  }
  results.push(r);
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.title}  expected=${r.expected} got=${r.got ?? "error"}${r.evidence_ok === false ? " (evidence not verbatim)" : ""}${r.error ? ` ${r.error}` : ""}`);
}
const failed = results.filter((r) => !r.ok).length;
const report = {
  ran_at: new Date().toISOString(),
  prompt_file: args.prompt,
  tests_file: args.tests,
  endpoint: baseUrl,
  models,
  total: results.length,
  failed,
  release: failed === 0 ? "ALLOWED" : "BLOCKED",
  results,
};
if (args.out) writeFileSync(args.out, JSON.stringify(report, null, 2));
console.log(`\n${results.length - failed}/${results.length} regression tests pass. Release ${report.release}.`);
process.exit(failed === 0 ? 0 : 1);
