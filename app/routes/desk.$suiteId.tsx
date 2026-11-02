import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  IconArrowBackUp,
  IconChevronLeft,
  IconDatabase,
  IconDownload,
  IconFileDiff,
  IconKeyboard,
  IconUsers,
  IconMessageCircle,
  IconRobot,
  IconUser,
  IconWand,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_GRADER_PROMPT, lineDiff } from "../../server/lib/grading";
import { cn } from "@/lib/utils";

type Verdict = "pass" | "fail" | null | undefined;
type Filter = "all" | "ungraded" | "needs_review" | "regressions";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "needs_review", label: "Needs review" },
  { id: "regressions", label: "Regressions" },
];

function Chip({ verdict, label }: { verdict: Verdict; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
        verdict === "pass" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        verdict === "fail" && "bg-rose-500/15 text-rose-700 dark:text-rose-300",
        !verdict && "bg-muted text-muted-foreground",
      )}
      title={label}
    >
      {label} {verdict ? verdict.toUpperCase() : "—"}
    </span>
  );
}

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

function kappa(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : value.toFixed(2);
}

function DataBadge({
  kind,
  name,
  url,
  license,
}: {
  kind?: string;
  name?: string;
  url?: string;
  license?: string;
}) {
  if (kind === "public") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-300"
        title={name}
      >
        <IconDatabase className="size-3.5" /> Real public data · {name?.split(":")[0]} · {license} License
      </a>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
      <IconDatabase className="size-3.5" /> Synthetic data
    </span>
  );
}

type PromptVersion = { version: number; text: string; note: string; createdAt: string | null };

function PromptPanel({ suiteId }: { suiteId: string }) {
  const versions = useActionQuery("list-prompt-versions", { suiteId });
  const list: PromptVersion[] = versions.data?.versions ?? [];
  const latest = list[list.length - 1];
  const [left, setLeft] = useState<number | null>(null);
  const [right, setRight] = useState<number | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const save = useActionMutation("save-prompt-version", {
    onError: (err) => toast.error(actionErrorMessage(err) ?? "Could not save"),
    onSuccess: (r) => {
      toast.success(`Saved grader prompt v${r.version}`);
      setDraft(null);
      setNote("");
      setLeft(null);
      setRight(null);
    },
  });
  const a = list.find((v) => v.version === (left ?? Math.max(1, (latest?.version ?? 1) - 1)));
  const b = list.find((v) => v.version === (right ?? latest?.version ?? 1));
  const diff = a && b ? lineDiff(a.text, b.text) : [];
  const text = draft ?? latest?.text ?? DEFAULT_GRADER_PROMPT;
  return (
    <div className="mx-auto grid max-w-4xl gap-5 p-5">
      <div className="grid gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <IconFileDiff className="size-4" /> Grader prompt diff
          <select
            aria-label="From version"
            className="ml-auto rounded border bg-background px-1 py-0.5 text-xs"
            value={a?.version ?? 1}
            onChange={(e) => setLeft(Number(e.target.value))}
          >
            {list.map((v) => (
              <option key={v.version} value={v.version}>v{v.version}</option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">→</span>
          <select
            aria-label="To version"
            className="rounded border bg-background px-1 py-0.5 text-xs"
            value={b?.version ?? 1}
            onChange={(e) => setRight(Number(e.target.value))}
          >
            {list.map((v) => (
              <option key={v.version} value={v.version}>v{v.version}</option>
            ))}
          </select>
        </div>
        <pre aria-label="Prompt diff" className="whitespace-pre-wrap break-words rounded-lg border bg-card p-3 text-xs leading-relaxed">
          {diff.map((d, i) => (
            <div
              key={i}
              className={cn(
                d.op === "add" && "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
                d.op === "del" && "bg-rose-500/15 text-rose-800 line-through dark:text-rose-200",
              )}
            >
              {d.op === "add" ? "+ " : d.op === "del" ? "- " : "  "}
              {d.text}
            </div>
          ))}
        </pre>
        <ul className="grid gap-0.5 text-xs text-muted-foreground">
          {list.map((v) => (
            <li key={v.version}>
              v{v.version}: {v.note || "(no note)"}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-2">
        <div className="text-sm font-medium">New version (based on v{latest?.version ?? 1})</div>
        <Textarea aria-label="Grader prompt" rows={8} value={text} onChange={(e) => setDraft(e.target.value)} />
        <input
          aria-label="Version note"
          className="rounded border bg-background px-2 py-1 text-sm"
          placeholder="What changed and why"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Before shipping a new version, run the release gate: export the regressions, then{" "}
          <code>node scripts/release-gate.mjs --tests file.jsonl --prompt new-prompt.txt</code>. Any failing test blocks
          the release.
        </p>
        <Button
          size="sm"
          className="justify-self-start"
          disabled={save.isPending || text === latest?.text}
          onClick={() => save.mutate({ suiteId, text, note })}
        >
          Save as v{(latest?.version ?? 1) + 1}
        </Button>
      </div>
    </div>
  );
}

function pct(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${value}%`;
}

export default function SuiteRoute() {
  const { suiteId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>("all");
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();
  const params = useMemo(() => ({ suiteId, status: "all" as const }), [suiteId]);
  const queryKey = ["action", "list-cases", params];
  const { data, isPending, error } = useActionQuery("list-cases", params);
  const audit = useActionQuery("list-audit", { suiteId, limit: 50 });
  const regressions = useActionQuery("export-regressions", { suiteId, scope: "regressions" });
  const prompts = useActionQuery("list-prompt-versions", { suiteId });
  const tab = searchParams.get("tab") === "prompt" ? "prompt" : "review";
  const [secondName, setSecondName] = useState("");

  const cases = data?.cases ?? [];
  const visible = cases.filter((c) =>
    filter === "needs_review"
      ? !c.humanVerdict
      : filter === "regressions"
        ? c.isRegression
        : true,
  );
  const requestedId = searchParams.get("case");
  const selectedId =
    requestedId && visible.some((c) => c.id === requestedId)
      ? requestedId
      : (visible[0]?.id ?? null);
  const selected = cases.find((c) => c.id === selectedId) ?? null;
  const report = data?.report;

  const review = useActionMutation("review-case", {
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: typeof data) =>
        old && {
          ...old,
          cases: old.cases.map((c) =>
            c.id === input.caseId
              ? {
                  ...c,
                  humanVerdict: input.verdict,
                  humanNote: input.note ?? "",
                  isRegression: Boolean(c.agentVerdict && c.agentVerdict !== input.verdict),
                }
              : c,
          ),
        },
      );
      return { previous };
    },
    onError: (err, _input, context) => {
      queryClient.setQueryData(queryKey, (context as { previous?: unknown })?.previous);
      toast.error(actionErrorMessage(err) ?? "Could not save the verdict");
    },
    onSuccess: (result) => {
      setNote("");
      toast.success(result.overrule ? "Overruled: saved as a regression test" : "Verdict approved");
      const next = cases.find((c) => !c.humanVerdict && c.id !== result.id);
      if (next) setSearchParams({ case: next.id });
    },
  });
  const reopen = useActionMutation("reopen-case", {
    onError: (err) => toast.error(actionErrorMessage(err) ?? "Could not undo"),
    onSuccess: () => toast.success("Verdict undone"),
  });

  const simulate = useActionMutation("run-simulated-reviewer", {
    onError: (err) => toast.error(actionErrorMessage(err) ?? "Could not run the simulated reviewer"),
    onSuccess: (r) => toast.success(`Simulated reviewer: ${r.pass} PASS / ${r.fail} FAIL (rule-based, not a person)`),
  });
  const addReview = useActionMutation("add-review", {
    onError: (err) => toast.error(actionErrorMessage(err) ?? "Could not save the review"),
    onSuccess: (r) => toast.success(`Second review saved (${r.reviewer})`),
  });

  // Keyboard review: P = pass, F = fail, J/K = next/previous case, U = undo.
  const keyState = useRef({ visible, selected, note, busy: false });
  keyState.current = { visible, selected, note, busy: review.isPending || reopen.isPending };
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (tab !== "review" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const { visible: vis, selected: sel, note: n, busy } = keyState.current;
      const key = e.key.toLowerCase();
      if (key === "j" || key === "k") {
        const i = vis.findIndex((c) => c.id === sel?.id);
        const next = vis[Math.min(vis.length - 1, Math.max(0, i + (key === "j" ? 1 : -1)))];
        if (next) setSearchParams({ case: next.id });
        e.preventDefault();
      } else if ((key === "p" || key === "f") && sel && !sel.humanVerdict && !busy) {
        review.mutate({ caseId: sel.id, verdict: key === "p" ? "pass" : "fail", note: n });
        e.preventDefault();
      } else if (key === "u" && sel?.humanVerdict && !busy) {
        reopen.mutate({ caseId: sel.id });
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function askAgentToGrade() {
    const latest = prompts.data?.latest;
    sendToAgentChat({
      message: `Grade every ungraded case in the EvalDesk suite "${data?.suite.name}" (suiteId ${suiteId}) using grader prompt v${latest?.version ?? 1}:\n${latest?.text ?? DEFAULT_GRADER_PROMPT}\n\nCall list-cases with status "ungraded", then call record-verdict once per case with an exact quote from the answer as evidence. Do not record human verdicts. Finish with a one-line summary of how many PASS and FAIL you proposed.`,
      submit: true,
      openSidebar: true,
      newTab: true,
    });
  }

  function askAgentAboutCase() {
    if (!selected) return;
    sendToAgentChat({
      message: `Explain your verdict on case "${selected.title}" (caseId ${selected.id}) in suite ${suiteId}, rule by rule against the policy. If you now think it is wrong, record a corrected verdict with record-verdict.`,
      submit: true,
      openSidebar: true,
    });
  }

  function downloadRegressions() {
    const out = regressions.data;
    if (!out || out.count === 0) {
      toast.error("No regressions yet: overrule a verdict first");
      return;
    }
    const blob = new Blob([out.jsonl + "\n"], { type: "application/jsonl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = out.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">{actionErrorMessage(error) ?? "Suite not found."}</p>
        <Link to="/desk" className="text-sm underline">Back to suites</Link>
      </main>
    );
  }

  const caseAudit = (audit.data?.events ?? []).filter((e) => e.caseId === selected?.id);

  return (
    <main className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
        <Link to="/desk" className="text-muted-foreground hover:text-foreground" aria-label="Back">
          <IconChevronLeft className="size-5" />
        </Link>
        {isPending ? (
          <Skeleton className="h-6 w-64" />
        ) : (
          <h1 className="text-lg font-semibold">{data?.suite.name}</h1>
        )}
        {data ? (
          <DataBadge
            kind={data.suite.dataKind}
            name={data.suite.sourceName}
            url={data.suite.sourceUrl}
            license={data.suite.sourceLicense}
          />
        ) : null}
        <nav className="flex gap-1 text-xs" aria-label="Suite tabs">
          {(["review", "prompt"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSearchParams(t === "prompt" ? { tab: "prompt" } : {})}
              className={cn("rounded px-2 py-1", tab === t ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent")}
            >
              {t === "review" ? "Review" : `Grader prompt v${prompts.data?.latest?.version ?? 1}`}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={askAgentToGrade}>
            <IconWand className="size-4" /> Ask agent to grade
          </Button>
          {data?.suite.dataKind === "public" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={simulate.isPending}
              onClick={() => simulate.mutate({ suiteId })}
              title="Deterministic checklist from the dataset guideline. Not a person."
            >
              <IconUsers className="size-4" /> Run simulated reviewer
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={downloadRegressions}>
            <IconDownload className="size-4" /> Export regressions ({regressions.data?.count ?? 0})
          </Button>
        </div>
      </header>

      <section
        aria-label="Scoreboard"
        className="grid grid-cols-2 gap-px border-b bg-border text-sm sm:grid-cols-4 xl:grid-cols-7"
      >
        {[
          ...(data?.interRater ?? []).map(
            (r) =>
              [
                `${r.kind === "simulated" ? "Simulated reviewer" : r.reviewer} κ vs human`,
                r.n ? `${kappa(r.kappa)} (${r.agree}/${r.n})` : "—",
              ] as [string, string],
          ),
          ["Agent graded", report ? `${report.agentGraded}/${report.total}` : "—"],
          ["Human reviewed", report ? `${report.humanReviewed}/${report.total}` : "—"],
          ["Agent vs human", pct(report?.agentAgreement)],
          ["Agent κ vs human", kappa(report?.agentKappa)],
          ["Keyword baseline vs human", pct(report?.baselineAgreement)],
          ["Regressions", report ? String(report.regressions) : "—"],
        ].map(([label, value]) => (
          <div key={label} className="bg-background px-4 py-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="text-base font-semibold tabular-nums">{value}</div>
          </div>
        ))}
      </section>

      {tab === "prompt" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PromptPanel suiteId={suiteId} />
        </div>
      ) : (
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[320px_1fr]">
        <aside className="min-h-0 overflow-y-auto border-r">
          <div className="flex gap-1 border-b p-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded px-2 py-1 text-xs",
                  filter === f.id ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          {isPending ? (
            <div className="grid gap-2 p-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <ul>
              {visible.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSearchParams({ case: c.id })}
                    className={cn(
                      "grid w-full gap-1 border-b px-3 py-2 text-left hover:bg-accent",
                      c.id === selectedId && "bg-accent",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span className="text-xs tabular-nums text-muted-foreground">#{c.position}</span>
                      {c.title}
                      {c.isRegression ? (
                        <span className="ml-auto rounded bg-amber-500/20 px-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          REGRESSION
                        </span>
                      ) : null}
                    </span>
                    <span className="flex flex-wrap gap-1">
                      <Chip verdict={c.agentVerdict as Verdict} label="Agent" />
                      <Chip verdict={c.humanVerdict as Verdict} label="Human" />
                      <Chip verdict={c.baselineVerdict} label="Keyword" />
                      {c.reviews.map((r) => (
                        <Chip
                          key={r.reviewer}
                          verdict={r.verdict as Verdict}
                          label={r.reviewerKind === "simulated" ? "Sim" : "2nd"}
                        />
                      ))}
                    </span>
                  </button>
                </li>
              ))}
              {visible.length === 0 ? (
                <li className="p-6 text-center text-xs text-muted-foreground">Nothing here.</li>
              ) : null}
            </ul>
          )}
        </aside>

        <section className="min-h-0 overflow-y-auto p-5">
          {!selected ? (
            isPending ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <p className="text-sm text-muted-foreground">Select a case.</p>
            )
          ) : (
            <div className="mx-auto grid max-w-3xl gap-5">
              <div className="grid gap-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">User asked</div>
                <p className="text-sm">{selected.prompt}</p>
              </div>
              <div className="grid gap-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Model answered {selected.agentEvidence ? "(agent's evidence highlighted)" : ""}
                </div>
                <p className="max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-lg border bg-card p-3 text-sm leading-relaxed">
                  <Highlight text={selected.answer} quote={selected.agentEvidence} />
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1 rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <IconRobot className="size-4" /> Agent
                    <Chip verdict={selected.agentVerdict as Verdict} label="" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selected.agentReason ?? "Not graded yet. Click “Ask agent to grade”."}
                  </p>
                  <Button size="sm" variant="ghost" className="justify-self-start" onClick={askAgentAboutCase}>
                    <IconMessageCircle className="size-4" /> Ask the agent why
                  </Button>
                </div>
                <div className="grid gap-1 rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    Keyword baseline <Chip verdict={selected.baselineVerdict} label="" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Passes when every required phrase appears:{" "}
                    <code className="text-xs">{selected.mustInclude || "(none)"}</code>
                  </p>
                </div>
              </div>

              <div className="grid gap-2 rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <IconUser className="size-4" /> Your verdict
                  {selected.humanVerdict ? (
                    <Chip verdict={selected.humanVerdict as Verdict} label="" />
                  ) : null}
                </div>
                {selected.humanVerdict ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {selected.isRegression
                        ? "You overruled the agent. This case is now a regression test."
                        : "You approved the agent's verdict."}
                      {selected.humanNote ? ` Note: ${selected.humanNote}` : ""}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={reopen.isPending}
                      onClick={() => reopen.mutate({ caseId: selected.id })}
                    >
                      <IconArrowBackUp className="size-4" /> Undo
                    </Button>
                  </div>
                ) : (
                  <>
                    <Textarea
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Why (optional, saved with the regression test)"
                    />
                    <div className="flex flex-wrap gap-2">
                      {(["pass", "fail"] as const).map((v) => {
                        const agrees = selected.agentVerdict === v;
                        return (
                          <Button
                            key={v}
                            size="sm"
                            variant={v === "pass" ? "default" : "destructive"}
                            disabled={review.isPending}
                            onClick={() => review.mutate({ caseId: selected.id, verdict: v, note })}
                          >
                            {selected.agentVerdict
                              ? `${agrees ? "Approve" : "Overrule →"} ${v.toUpperCase()}`
                              : `Mark ${v.toUpperCase()}`}
                          </Button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="grid gap-2 rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <IconUsers className="size-4" /> Second reviewers
                </div>
                {selected.reviews.length ? (
                  <ul className="grid gap-1 text-sm">
                    {selected.reviews.map((r) => (
                      <li key={r.reviewer} className="flex flex-wrap items-center gap-2">
                        <Chip verdict={r.verdict as Verdict} label="" />
                        <span className="font-medium">{r.reviewer}</span>
                        <span
                          className={cn(
                            "rounded px-1 text-[10px] font-semibold uppercase",
                            r.reviewerKind === "simulated" ? "bg-muted text-muted-foreground" : "bg-sky-500/15 text-sky-700",
                          )}
                        >
                          {r.reviewerKind === "simulated" ? "simulated reviewer · not a person" : "human"}
                        </span>
                        <span className="text-muted-foreground">{r.note}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No second review yet.</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    aria-label="Second reviewer name"
                    className="rounded border bg-background px-2 py-1 text-xs"
                    placeholder="Second reviewer name"
                    value={secondName}
                    onChange={(e) => setSecondName(e.target.value)}
                  />
                  {(["pass", "fail"] as const).map((v) => (
                    <Button
                      key={v}
                      size="sm"
                      variant="outline"
                      disabled={!secondName.trim() || addReview.isPending}
                      onClick={() => addReview.mutate({ caseId: selected.id, reviewer: secondName.trim(), verdict: v, note: "" })}
                    >
                      {v.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>

              <details className="rounded-lg border p-3 text-sm">
                <summary className="cursor-pointer font-medium">Suite policy</summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-muted-foreground">
                  {data?.suite.policy}
                </pre>
              </details>

              <div className="grid gap-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Audit trail</div>
                {caseAudit.length ? (
                  <ul className="grid gap-1 text-xs">
                    {caseAudit.map((e) => (
                      <li key={e.id} className="flex gap-2">
                        <span className="tabular-nums text-muted-foreground">
                          {new Date(e.createdAt).toLocaleTimeString()}
                        </span>
                        <span className="font-medium">{e.actor}</span>
                        <span className="text-muted-foreground">{e.kind}</span>
                        <span className="truncate">{e.detail}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No events for this case yet.</p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
      )}
      <footer className="flex items-center gap-2 border-t px-5 py-1.5 text-[11px] text-muted-foreground">
        <IconKeyboard className="size-3.5" /> Shortcuts: <kbd className="font-semibold">P</kbd> pass ·{" "}
        <kbd className="font-semibold">F</kbd> fail · <kbd className="font-semibold">J</kbd>/<kbd className="font-semibold">K</kbd> next/previous ·{" "}
        <kbd className="font-semibold">U</kbd> undo
      </footer>
    </main>
  );
}
