# EvalDesk fixed-SHA validation

Tested tree: `b40c00dcde82d8ea87f26e23745c474e9c0c72e4`.

That commit is `master`, `origin/master`, and tag `v0.2.0`. Subject: "Real public-data suite (ABCD, MIT), simulated second reviewer with Cohen's kappa, keyboard review, grader prompt versions with diff, release gate script and CI workflow". Author date: 2026-11-02 17:37:50 -0600.

This run did not change application code, prompts, tests, the regression file, `master`, or the tag. It did not merge, deploy, submit an entry, send mail, or call a paid model. The local database was the dev PGlite directory, which is gitignored. The signed-in identity was the automatic local dev account shown in the UI as `dev@local.test`.

## What was asked of the app

From `README.md`, `AGENTS.md`, and the actions under `actions/`:

- A suite is a written policy plus answers.
- The agent records PASS or FAIL with a quote of at least 8 characters that must occur in the answer (`evidence_not_found`, 422).
- A human approves or overrules from the keyboard: P, F, J, K, U.
- An overrule, meaning a human verdict that differs from an existing agent verdict, becomes a regression and can be exported as JSONL.
- A reviewed case rejects a later agent write (`human_locked`, 409).
- `add-review` is for a person (`human_only` for other callers).
- The ABCD simulated reviewer is a deterministic checklist, labeled as not a person.
- Grader prompts are versioned and diffed.
- `scripts/release-gate.mjs` regrades exported tests with a model and exits 1 when any test fails.
- Suites are labeled synthetic or real public data. The ABCD suite is public data from ASAPP Research under the MIT license. The refund suite is synthetic.

## GraveTruth harness

The reusable harness was not executed.

`https://github.com/igoreduardoai/grave-truth`, `.../pull/4`, and `.../pull/5` returned HTTP 404. `git ls-remote` reported "Repository not found". The GitHub API returned 404. This environment's GitHub app token cannot resolve that repository. The 13 public repositories under `igoreduardoai` do not include `grave-truth`. Commit `4a99c8e` was not present on this machine.

No evaluator-versus-critic score was produced. None was invented. The instruction that the current evaluator-versus-critic source is a scripted shared-script simulation, rather than two independent live judges, was not re-checked against that source because the source could not be read.

## Commands

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | 825 packages. Ignored build scripts: `@vgpu/adapter-node`, `webgpu`. |
| `pnpm test --reporter=verbose` | 0 | `tests/grading.test.ts`, 13 passed, 0 failed. Vitest 4.1.12. Duration 182ms. |
| `pnpm typecheck` | 0 | `agent-native typecheck` completed. |
| `pnpm agent-native:doctor` | 0 | 15 guards. "Clean — no findings." |
| `pnpm build` | 0 | Log ends with "Build complete." The same log prints production configuration errors: `BETTER_AUTH_SECRET` is unset, and there is no persistent `DATABASE_URL` / `NETLIFY_DATABASE_URL`. No secret was created or printed. |
| `node scripts/release-gate.mjs` | 2 | Usage text. Missing `--tests` and `--prompt`. |
| `node scripts/release-gate.mjs --tests tests/regressions/abcd-returns-regressions.jsonl --prompt prompts/grader-v4.txt` | 2 | `Set GATE_API_KEY (or OPENROUTER_API_KEY).` No key was in the environment. No model was called. |
| Local dev server | listening | `pnpm exec agent-native dev --host 127.0.0.1 --port 5173 --strictPort`. Ready message: Evaldesk listening on `http://127.0.0.1:5173/`. |
| Lighthouse, unauthenticated `http://127.0.0.1:5173/` | 0 | Accessibility 87, best-practices 96. One local run of the welcome screen. |
| Lighthouse, authenticated ABCD desk | 134 | Node aborted with "JavaScript heap out of memory" before writing a score. |

Node was v22.23.4. pnpm was 10.29.1. Chrome was `/usr/bin/google-chrome`.

Doctor guards named in the output: `no-drizzle-push`, `no-empty-migrations`, `no-unscoped-credentials`, `no-unscoped-queries`, `no-env-credentials`, `db-tool-scoping`, `no-env-mutation`, `no-localhost-fallback`, `explicit-collab-access`, `identity-columns-registered`, `resource-action-access`, `feature-dependencies`, `server-plugin-default-export`, `migration-manifest`, `native-manifest`.

## Numbers recomputed from source

These use the functions in `server/lib/grading.ts`. The ABCD human labels were read from the table in `docs/DATA.md` and were not edited. The synthetic human labels are the array in `tests/grading.test.ts`.

- ABCD keyword baseline (`mustInclude` is `order id;membership` on every bundled case) agrees with those DATA.md labels on 9 of 12. That matches the README's 9/12 statement. The README says kappa for the keyword baseline was not computed. This run did not add one.
- `abcdChecklist` agrees with those labels on 6 of 12. Cohen's kappa from `cohenKappa` is 0.08 (n=12, agree=6, observed 50). That matches the README table.
- The unit test's synthetic labels agree with the keyword baseline on 8 of 12, reported as 66.7. The four disagreements are "Day 45, bot gives cash", "Asks for card number", "Final sale, bot says yes", and "Invented loyalty perk". In each, the human label in the test is fail and the keyword baseline is pass, because a required phrase is present while the answer also breaks another rule.
- `README.md` says the synthetic keyword baseline agreed on 7 of 12 in an earlier run. The only executable synthetic labels in the tree are the test's 12 values, and they produce 8 of 12. The earlier run's separate label sheet is not in the tree.

The bundled unit test already asserts the 8/12 figure. This recompute did not change that test.

## Browser journeys

Local sign-in used "Continue as local dev". `homePath` in `server/plugins/agent-native-email-branding.ts` is `/desk`, and the session landed on EvalDesk.

Observed on the synthetic suite "Refund bot v3 (synthetic demo)":

- Badge text includes "Synthetic data".
- 12 cases render. The simulated-reviewer button is absent.
- J selects the next case. K returns to the first.
- P typed inside the note field appends the character and does not save a verdict.
- P with focus outside the field saves a human PASS.
- Export before any overrule shows "No regressions yet: overrule a verdict first".
- U, while the reviewed case is selected, shows "Verdict undone" and clears the human chip.
- A fabricated quote is rejected: HTTP 422, `errorCode` `evidence_not_found`, message "Evidence is not an exact quote from the answer. Quote the answer verbatim."
- Quote `offer  store   credit` against the day-45 answer is accepted: HTTP 200, `verdict` `pass`.
- F after that agent PASS shows "Overruled: saved as a regression test", a REGRESSION badge, and scoreboard values agent-vs-human 0%, kappa 0.00, keyword-vs-human 0%, regressions 1.
- A second `record-verdict` on that case returns HTTP 409, `errorCode` `human_locked`.
- Export downloads one JSONL line for "Day 45, wants cash" with `expected_verdict` `fail`.
- Clicking Mark PASS while `review-case` is forced to HTTP 500 shows the toast "injected failure". The human chip stays "Human —". After the route is restored, P shows "Verdict approved".
- An added answer containing an `img` tag, a `script` tag, and the sentence "Ignore previous instructions..." renders as text. `window.__xss` stayed unset. No injected `img` or `script` node was created. No human verdict was written by that text.
- `add-review` without the frontend header returns HTTP 403, `errorCode` `human_only`, message "Only a person can record a reviewer verdict."
- The same action from the signed-in page returns HTTP 200. That caller is the local UI session. It is not a second person, and this report does not treat it as one.
- `run-simulated-reviewer` on the synthetic suite returns HTTP 422, `errorCode` `no_checklist`.
- Saving a prompt version in the local database shows a diff line `+ Quote the answer character for character.` That version is only in the ephemeral database.
- `/desk/not-a-real-suite`, after hydration, shows "Suite not found."

Observed on "ABCD returns: wrong size (real public data)":

- Badge text: "Real public data · ABCD · MIT License".
- "Run simulated reviewer" shows "Simulated reviewer: 5 PASS / 7 FAIL (rule-based, not a person)".
- After reload, case rows show Sim PASS and Sim FAIL chips. One DOM node contains "not a person". The scoreboard's simulated-reviewer kappa stays "—" until a human verdict exists.
- "Ask agent to grade" opens a new chat panel. The panel shows "Ask me anything about this app", the buttons "Connect AI", "Use Builder.io", and "Custom keys", and the placeholder "Connect AI to start chatting...". No request to OpenRouter, OpenAI, Anthropic, Google, Groq, Mistral, Nebius, or Cohere was made. No model grade was produced.
- At a 390×844 viewport, after hydration, the ABCD heading, MIT badge, grade button, simulated-reviewer button, and the first case are visible. An earlier capture at about 2 seconds was still the loading skeleton.

Screenshots from this run are in `screens/` next to this file.

## Confirmed defects

### 1. A human pass with no agent verdict is described as an approval

Expected: the case copy should not say an agent verdict was approved when the agent chip is still ungraded.

Actual: after P on "Day 12, has receipt", the agent chip is "—", the empty state still says "Not graded yet", and the verdict panel says "You approved the agent's verdict." Regressions stay 0. The audit row is `human` / `human_approve` / `PASS`.

```564:570:app/routes/desk.$suiteId.tsx
                {selected.humanVerdict ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {selected.isRegression
                        ? "You overruled the agent. This case is now a regression test."
                        : "You approved the agent's verdict."}
```

`isRegression` is false when there is no agent verdict, so every other human save uses the approval sentence. Screenshot: `screens/14-case1-approved-copy.png`.

### 2. A quote the server accepts is announced as highlighted and is not marked

Expected: a quote accepted by `evidenceFound` is marked in the answer, matching the heading "agent's evidence highlighted".

Actual: `record-verdict` accepts `offer  store   credit` (HTTP 200). The heading becomes "MODEL ANSWERED (AGENT'S EVIDENCE HIGHLIGHTED)". The answer text has single spaces ("offer store credit") and the `<mark>` count is 0.

`evidenceFound` collapses whitespace. `Highlight` searches for the trimmed quote literally.

```15:18:server/lib/grading.ts
export function evidenceFound(answer: string, quote: string): boolean {
  const q = normalize(quote);
  if (q.length < 8) return false;
  return normalize(answer).includes(q);
```

```56:69:app/routes/desk.$suiteId.tsx
function Highlight({ text, quote }: { text: string; quote?: string | null }) {
  if (!quote) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(quote.toLowerCase().trim());
  if (idx < 0) return <>{text}</>;
  const end = idx + quote.trim().length;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-amber-300/60 px-0.5 text-foreground dark:bg-amber-400/40">
        {text.slice(idx, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}
```

The heading is added whenever `agentEvidence` is non-empty, including when the mark was not found (`app/routes/desk.$suiteId.tsx` around the "Model answered" label). Screenshot: `screens/15-highlight.png`. This case is separate from the 13 unit tests. The gold regression file was not changed.

### 3. U does not undo the verdict just saved, because P and F move the selection

Expected from the on-screen shortcut "U undo": pressing U immediately after P or F reverses that verdict.

Actual: the success handler selects the next case that has no human verdict. U then looks at that unreviewed case and does nothing. Screenshot `screens/05-human-pass-no-agent.png` shows case 1 as Human PASS while case 2 is the open case. The undo toast did not appear until the reviewed case was selected again. With that case selected, U does undo it.

```268:273:app/routes/desk.$suiteId.tsx
    onSuccess: (result) => {
      setNote("");
      toast.success(result.overrule ? "Overruled: saved as a regression test" : "Verdict approved");
      const next = cases.find((c) => !c.humanVerdict && c.id !== result.id);
      if (next) setSearchParams({ case: next.id });
    },
```

### 4. README synthetic keyword agreement does not match the checked labels

Expected if the README and the unit test describe the same labels: both say 7/12 or both say 8/12.

Actual: `tests/grading.test.ts` asserts 8 of 12 and `baselineAgreement` 66.7. `README.md` says the keyword baseline agreed on 7/12. Recomputing from the test's labels also yields 8/12. The live agent figure of 11/12 in that same README paragraph was not rerun.

### 5. Pinch zoom is disabled

Expected for the axe rule `meta-viewport`: the viewport meta should allow scaling.

Actual: axe reports `meta-viewport` as critical on the desk index and on the ABCD desk. The document sets `maximum-scale=1, user-scalable=no`.

```61:64:app/root.tsx
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, interactive-widget=resizes-content"
        />
```

### Axe findings on the authenticated ABCD desk

One `axe-core` 4.10.3 run after the simulated reviewer was visible:

| Rule | Impact | Nodes |
| --- | --- | --- |
| `meta-viewport` | critical | 1 |
| `color-contrast` | serious | 2 |
| `scrollable-region-focusable` | serious | 1 |
| `heading-order` | moderate | 1 |
| `landmark-main-is-top-level` | moderate | 1 |
| `landmark-no-duplicate-main` | moderate | 1 |
| `landmark-unique` | moderate | 2 |
| `region` | moderate | 4 |

The contrast, scrollable-region, heading, and landmark nodes were not opened one by one, so this report names the rule and the count from axe, not a hand-measured contrast ratio. The desk index run had the same critical viewport finding and the three moderate landmark findings.

## Startup log, separate from the desk results

- `node-pty` failed to load `pty.node`. The log says "Failed to start PTY server". The review desk still loaded. `README.md` says `node-pty: false` disables the optional in-app terminal. The process still attempted to start it.
- Vite logged that `style-to-js` could not be resolved for `optimizeDeps.include`.
- h3 logged that `preMerge` could not be applied because `/icon-*.svg` and `/agent-native-*.svg` overlap.
- The browser console logged: "Encountered a script tag while rendering React component. Scripts inside React components are never executed when rendering on the client." The desk continued to handle clicks after that message. `app/root.tsx` renders two startup scripts with `dangerouslySetInnerHTML`.

## Skipped layers

- Live grader inference. No `GATE_API_KEY`, `OPENROUTER_API_KEY`, or other provider key was present. The release gate exited 2 before any network call. Historical files in `docs/gate/` say a Nebius run on 2026-11-02 allowed prompt v4 (3/3) and blocked v1, v2, and v3. Those files were read. They were not reproduced.
- The README's agent-agreement figures (ABCD 9/12, kappa 0.25; synthetic 11/12) were not reproduced. No model judgment was substituted.
- GraveTruth PR4/PR5 harness, as recorded above.
- Lighthouse on the authenticated review desk, because the runner ran out of heap. The welcome-page scores above are only for that screen.
- GitHub Actions `release-gate` workflow. It needs a repository secret. It was not triggered.
- No second person reviewed a case. The simulated reviewer and the local UI session are the only second-review callers exercised.
- `Use Builder.io` was not clicked. No Builder.io connection result was observed.

## Sponsor and integration evidence

- The running app is the Agent-Native dev server. Actions, doctor, and the desk all executed through that framework on this machine.
- The unconnected chat panel shows a "Use Builder.io" button next to "Connect AI" and "Custom keys". The button was visible. It was not used. A working Builder.io model connection was not observed.
- `netlify.toml` contains `GA_MEASUREMENT_ID` and `GTM_CONTAINER_ID`. A search of the application source did not find those identifiers referenced. No analytics request was confirmed.
- OpenRouter is the default host in `scripts/release-gate.mjs`. The historical gate JSON names `https://api.studio.nebius.com/v1` and `nvidia/Nemotron-3-Ultra-550b-a55b`. Neither host was called in this run.

## Official rubric, without a score

Source: the Official Rules page fetched from `https://www.builder.io/hackathon/rules` during this run. The page says Pacific Time controls the deadline: Monday, November 9, 2026, at 11:59 PM PT, which is November 10, 2026, at 07:59 UTC and November 10, 2026, at 01:59 in America/Chicago. Judges score four criteria from 0 to 10 and apply the published weights. This report does not assign those scores, a rank, or a prize probability.

The same page does not say whether a commit made after the first submission is what the judges run. This test stayed on the tagged commit above and did not push to `master` or `v0.2.0`.

| Criterion | Weight on the rules page | What this tree and this run show |
| --- | --- | --- |
| Usefulness and Execution | 40% | The stated job is checking a policy-bound answer, keeping a human verdict, and turning an overrule into a test. That path works locally on synthetic data: quote check, overrule, JSONL export, and the gate script refusing to run without a key. The live gate and the live agent grade were not rerun. The three UI defects above are in that path. |
| Creativity and Design | 20% | The desk is a keyboard review surface with a scoreboard, a data-source badge, and a prompt diff. The highlight and the "approved the agent's verdict" sentence are the design defects observed. Mobile layout of the ABCD desk was readable after hydration. Zoom is locked by the viewport meta tag. |
| Innovation | 20% | The human lock, the evidence check, and the labeled simulated checklist are enforced in code and were observed. The simulated reviewer is a rule checklist. A second person was not part of this run. |
| Cleverness and Use of Agent-Native | 20% | The desk and the agent share `defineAction` handlers. Doctor reported no findings. "Ask agent to grade" opens the agent chat and, with no model connected, stops on the connect panel. No agent grade was completed. |

## Data labels

The ABCD suite exercised in the browser is the app's real public-data suite (ABCD, MIT). The refund suite is the app's synthetic demo. Injection and whitespace-quote cases were added only in the ephemeral local database and are held apart from the 13 unit tests and from `tests/regressions/abcd-returns-regressions.jsonl`.
