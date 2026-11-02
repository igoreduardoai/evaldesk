import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  IconArrowBackUp,
  IconChevronLeft,
  IconDownload,
  IconMessageCircle,
  IconRobot,
  IconUser,
  IconWand,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
  const regressions = useActionQuery("export-regressions", { suiteId });

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

  function askAgentToGrade() {
    sendToAgentChat({
      message: `Grade every ungraded case in the EvalDesk suite "${data?.suite.name}" (suiteId ${suiteId}) against the suite policy. Call list-cases with status "ungraded", then call record-verdict once per case with an exact quote from the answer as evidence. Do not record human verdicts. Finish with a one-line summary of how many PASS and FAIL you proposed.`,
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
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={askAgentToGrade}>
            <IconWand className="size-4" /> Ask agent to grade
          </Button>
          <Button size="sm" variant="outline" onClick={downloadRegressions}>
            <IconDownload className="size-4" /> Export regressions ({regressions.data?.count ?? 0})
          </Button>
        </div>
      </header>

      <section
        aria-label="Scoreboard"
        className="grid grid-cols-2 gap-px border-b bg-border text-sm sm:grid-cols-5"
      >
        {[
          ["Agent graded", report ? `${report.agentGraded}/${report.total}` : "—"],
          ["Human reviewed", report ? `${report.humanReviewed}/${report.total}` : "—"],
          ["Agent vs human", pct(report?.agentAgreement)],
          ["Keyword baseline vs human", pct(report?.baselineAgreement)],
          ["Regressions", report ? String(report.regressions) : "—"],
        ].map(([label, value]) => (
          <div key={label} className="bg-background px-4 py-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="text-base font-semibold tabular-nums">{value}</div>
          </div>
        ))}
      </section>

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
                <p className="rounded-lg border bg-card p-3 text-sm leading-relaxed">
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
    </main>
  );
}
