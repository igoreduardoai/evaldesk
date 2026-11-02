import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { IconFlask, IconPlus, IconSparkles } from "@tabler/icons-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export default function DeskIndex() {
  const navigate = useNavigate();
  const { data, isPending } = useActionQuery("list-suites", {});
  const [name, setName] = useState("");
  const [policy, setPolicy] = useState("");
  const create = useActionMutation("create-suite", {
    onSuccess: (result) => {
      toast.success("Suite created");
      navigate(`/desk/${result.id}`);
    },
    onError: (error) => toast.error(actionErrorMessage(error) ?? "Could not create suite"),
  });
  const seed = useActionMutation("seed-demo-suite", {
    onSuccess: (result) => navigate(`/desk/${result.id}`),
    onError: (error) => toast.error(actionErrorMessage(error) ?? "Could not create demo"),
  });

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-8 p-6">
      <section className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">EvalDesk</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          The agent grades your LLM&apos;s answers against your written policy and must quote
          the answer as evidence. You approve or overrule each verdict. Every overrule becomes a
          regression test you can export.
        </p>
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Suites
          </h2>
          <Button
            variant="outline"
            size="sm"
            disabled={seed.isPending}
            onClick={() => seed.mutate({})}
          >
            <IconSparkles className="size-4" /> Load synthetic demo suite
          </Button>
        </div>
        {isPending ? (
          <div className="grid gap-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : data?.suites.length ? (
          <ul className="grid gap-2">
            {data.suites.map((suite) => (
              <li key={suite.id}>
                <Link
                  to={`/desk/${suite.id}`}
                  className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-accent"
                >
                  <IconFlask className="size-4 text-muted-foreground" />
                  <span className="font-medium">{suite.name}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {suite.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No suites yet. Load the synthetic demo or create one below.
          </p>
        )}
      </section>

      <form
        className="grid gap-3 rounded-lg border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          create.mutate({ name: name.trim(), description: "", policy });
        }}
      >
        <h2 className="text-sm font-semibold">New suite</h2>
        <div className="grid gap-1.5">
          <Label htmlFor="suite-name">Name</Label>
          <Input
            id="suite-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Support bot v4"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="suite-policy">Policy the answers must follow</Label>
          <Textarea
            id="suite-policy"
            rows={4}
            value={policy}
            onChange={(e) => setPolicy(e.target.value)}
            placeholder="1. Refunds within 30 days..."
          />
        </div>
        <div>
          <Button type="submit" disabled={create.isPending || !name.trim()}>
            <IconPlus className="size-4" /> Create suite
          </Button>
        </div>
      </form>
    </main>
  );
}
