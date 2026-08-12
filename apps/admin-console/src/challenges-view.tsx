import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, CheckCircle2, Loader2, ArrowLeft, Star, Clock, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getAdminDrops,
  saveDrop,
  activateDrop,
  deleteDropApi,
  getBeliefs,
  getSettings,
  saveSettings,
  type AdminDrop,
  type AppSettings,
  type DropOption,
  type DropQuestion
} from "@/lib/api";

const DEFAULT_BELIEFS = ["Dynamism", "Customers", "Communities", "Collaboration"];
const TZ_OPTIONS = ["Asia/Bangkok", "Asia/Jakarta", "Asia/Singapore", "UTC", "America/New_York", "Europe/London"];

/**
 * When the bot sends the active drop. It lives here rather than in Settings so
 * the schedule sits with the content it sends.
 */
function DailyScheduleCard() {
  const [s, setS] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getSettings().then((r) => r && setS(r));
  }, []);

  async function save() {
    if (!s) return;
    setSaving(true);
    const r = await saveSettings({ dailyDropTime: s.dailyDropTime, dailyDropTz: s.dailyDropTz });
    setSaving(false);
    if (r) {
      setS(r);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    }
  }

  if (!s) return null;
  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-4" /> Daily challenge schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">When the bot automatically sends the active daily drop.</p>
        <div className="flex gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Time</label>
            <Input
              type="time"
              className="w-32"
              value={s.dailyDropTime}
              onChange={(e) => setS({ ...s, dailyDropTime: e.target.value })}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Timezone</label>
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={s.dailyDropTz}
              onChange={(e) => setS({ ...s, dailyDropTz: e.target.value })}
            >
              {TZ_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button className="self-start" size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
          {saved ? "Saved" : "Save schedule"}
        </Button>
      </CardContent>
    </Card>
  );
}

function blankQuestion(n: number): DropQuestion {
  return {
    id: `q${n}-${Math.random().toString(36).slice(2, 7)}`,
    question: "",
    options: [
      { id: "o1", label: "", isBest: true },
      { id: "o2", label: "" }
    ]
  };
}

function blankDrop(): AdminDrop {
  return {
    id: "",
    title: "Daily Drop",
    behavior: DEFAULT_BELIEFS[1],
    question: "",
    rewardLabel: "Up to 50 points",
    bestPoints: 50,
    options: [],
    questions: [blankQuestion(1)]
  };
}

/** Ensure a drop being edited has a questions[] (migrate legacy single-question). */
function withQuestions(d: AdminDrop): AdminDrop {
  if (d.questions && d.questions.length > 0) return d;
  return { ...d, questions: [{ id: "q1", question: d.question ?? "", options: d.options ?? [] }] };
}

export function ChallengesView() {
  const [drops, setDrops] = useState<AdminDrop[]>([]);
  const [beliefs, setBeliefs] = useState<string[]>(DEFAULT_BELIEFS);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminDrop | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [d, b] = await Promise.all([getAdminDrops(), getBeliefs()]);
    setDrops(d ?? []);
    if (b && b.length > 0) setBeliefs(b.map((x) => x.name));
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function activate(id: string) {
    setBusy(id);
    await activateDrop(id);
    await load();
    setBusy(null);
  }
  async function remove(id: string) {
    if (!confirm("Delete this drop?")) return;
    setError(null);
    const removed = await deleteDropApi(id);
    if (!removed) {
      setError("The active drop cannot be deleted. Activate another drop first.");
      return;
    }
    await load();
  }

  if (editing) {
    return (
      <DropEditor
        initial={editing}
        beliefs={beliefs}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
        }}
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Daily challenges</h1>
          <p className="text-sm text-muted-foreground">
            Author a daily drop (one or more questions). One is active at a time — the bot serves that one.
          </p>
        </div>
        <Button onClick={() => setEditing(blankDrop())}>
          <Plus className="size-4" /> New drop
        </Button>
      </div>

      {error ? <p className="mb-4 rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</p> : null}

      <DailyScheduleCard />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : drops.length === 0 ? (
        <p className="text-sm text-muted-foreground">No drops yet — create one to publish today's challenge.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {drops.map((d) => {
            const qCount = d.questions?.length ?? 1;
            return (
              <Card key={d.id}>
                <CardContent className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{d.questions?.[0]?.question || d.question || d.title}</p>
                      {d.isActive ? (
                        <Badge className="shrink-0">
                          <CheckCircle2 className="size-3" /> Active
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {d.behavior} · {qCount} question{qCount === 1 ? "" : "s"} · {d.rewardLabel}
                    </p>
                  </div>
                  {!d.isActive ? (
                    <Button size="sm" variant="outline" disabled={busy === d.id} onClick={() => void activate(d.id)}>
                      {busy === d.id ? <Loader2 className="size-3.5 animate-spin" /> : null}
                      Set active
                    </Button>
                  ) : null}
                  <Button size="icon" variant="ghost" onClick={() => setEditing(withQuestions(d))}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={d.isActive}
                    title={d.isActive ? "Activate another drop before deleting this one" : "Delete drop"}
                    onClick={() => void remove(d.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DropEditor(props: { initial: AdminDrop; beliefs: string[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [d, setD] = useState<AdminDrop>(withQuestions(props.initial));
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<AdminDrop>) => setD((prev) => ({ ...prev, ...patch }));
  const questions = d.questions ?? [];

  function setQuestion(qi: number, patch: Partial<DropQuestion>) {
    setD((prev) => ({ ...prev, questions: (prev.questions ?? []).map((q, i) => (i === qi ? { ...q, ...patch } : q)) }));
  }
  function addQuestion() {
    setD((prev) => ({ ...prev, questions: [...(prev.questions ?? []), blankQuestion((prev.questions?.length ?? 0) + 1)] }));
  }
  function removeQuestion(qi: number) {
    setD((prev) => ({ ...prev, questions: (prev.questions ?? []).filter((_, i) => i !== qi) }));
  }
  function setOption(qi: number, oi: number, patch: Partial<DropOption>) {
    setQuestion(qi, { options: questions[qi].options.map((o, i) => (i === oi ? { ...o, ...patch } : o)) });
  }
  function setBest(qi: number, oi: number) {
    setQuestion(qi, { options: questions[qi].options.map((o, i) => ({ ...o, isBest: i === oi })) });
  }
  function addOption(qi: number) {
    if (questions[qi].options.length >= 4) return;
    setQuestion(qi, { options: [...questions[qi].options, { id: `o${questions[qi].options.length + 1}`, label: "" }] });
  }
  function removeOption(qi: number, oi: number) {
    setQuestion(qi, { options: questions[qi].options.filter((_, i) => i !== oi) });
  }

  async function save() {
    setSaving(true);
    // Mirror questions[0] into the legacy question/options fields for compatibility.
    const first = questions[0];
    await saveDrop({ ...d, question: first?.question ?? "", options: first?.options ?? [] });
    setSaving(false);
    await props.onSaved();
  }

  const valid =
    questions.length > 0 &&
    questions.every(
      (q) => q.question.trim() && q.options.filter((o) => o.label.trim()).length >= 2 && q.options.some((o) => o.isBest)
    );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={props.onClose}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{props.initial.id ? "Edit drop" : "New drop"}</h1>
            <p className="text-sm text-muted-foreground">
              A daily challenge — add one or more questions employees answer in Teams.
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button variant="outline" onClick={props.onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || saving} onClick={() => void save()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save drop
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        {/* Left: drop meta */}
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label="Title">
              <Input value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Daily Drop" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Belief">
                <select
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={d.behavior}
                  onChange={(e) => set({ behavior: e.target.value })}
                >
                  {props.beliefs.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Points — ⭐ best answer (per question)">
              <Input
                type="number"
                value={d.bestPoints ?? 50}
                onChange={(e) => set({ bestPoints: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Reward label (shown on the card)">
              <Input
                value={d.rewardLabel ?? ""}
                onChange={(e) => set({ rewardLabel: e.target.value })}
                placeholder="Up to 50 points"
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              {questions.length} question{questions.length === 1 ? "" : "s"} · max{" "}
              {(d.bestPoints ?? 50) * questions.length} points. A wrong answer scores nothing.
            </p>
          </CardContent>
        </Card>

        {/* Live preview of the first question as a Teams card */}
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="flex gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  CP
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-xs">
                    <span className="font-semibold">CPN Engage</span>
                    <span className="text-muted-foreground"> · bot · now</span>
                  </p>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                      Daily challenge{questions.length > 1 ? ` · Question 1 of ${questions.length}` : ""}
                    </p>
                    <Badge variant="secondary" className="mt-1 w-fit">
                      {d.behavior}
                    </Badge>
                    <p className="mt-1 text-sm font-medium">{questions[0]?.question || "Your question…"}</p>
                    <div className="mt-1 flex flex-col gap-1">
                      {(questions[0]?.options ?? []).map((o, i) => (
                        <div
                          key={o.id}
                          className={
                            "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs " +
                            (o.isBest ? "border-primary bg-primary/5" : "border-border")
                          }
                        >
                          {o.isBest ? <Star className="size-3 shrink-0 text-primary" /> : <span className="size-3 shrink-0" />}
                          <span>{o.label || `Option ${i + 1}`}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 rounded-md bg-primary px-3 py-1.5 text-center text-sm font-medium text-primary-foreground">
                      {questions.length > 1 ? "Answer" : "Play now"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">How the first question lands in the employee's Teams chat.</p>
          </CardContent>
        </Card>

        {/* Right: questions */}
        <div className="flex flex-col gap-4">
          {questions.map((q, qi) => (
            <Card key={q.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Question {qi + 1}</CardTitle>
                {questions.length > 1 ? (
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => removeQuestion(qi)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Textarea
                  rows={2}
                  value={q.question}
                  onChange={(e) => setQuestion(qi, { question: e.target.value })}
                  placeholder="A peak-hour tenant escalation is rising. What is the best next step?"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Options — mark the ⭐ best</p>
                  <Button size="sm" variant="ghost" onClick={() => addOption(qi)} disabled={q.options.length >= 4}>
                    <Plus className="size-3.5" /> Option
                  </Button>
                </div>
                {q.options.map((o, oi) => (
                  <div key={o.id} className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => setBest(qi, oi)}
                      title="Mark as best answer"
                      className={`mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full border ${
                        o.isBest ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground"
                      }`}
                    >
                      <Star className="size-3" />
                    </button>
                    <Textarea
                      rows={2}
                      value={o.label}
                      onChange={(e) => setOption(qi, oi, { label: e.target.value })}
                      placeholder={`Option ${oi + 1}`}
                    />
                    {q.options.length > 2 ? (
                      <Button size="icon" variant="ghost" className="mt-0.5 size-8" onClick={() => removeOption(qi, oi)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={addQuestion}>
            <Plus className="size-4" /> Add question
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{props.label}</label>
      {props.children}
    </div>
  );
}
