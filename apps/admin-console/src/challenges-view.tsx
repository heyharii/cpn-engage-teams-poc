import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, CheckCircle2, Loader2, ArrowLeft, Star } from "lucide-react";
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
  type AdminDrop,
  type DropOption
} from "@/lib/api";

const BELIEFS = ["Dynamism", "Customers", "Communities", "Collaboration"];

function blankDrop(): AdminDrop {
  return {
    id: "",
    title: "Daily Drop",
    behavior: BELIEFS[1],
    question: "",
    rewardLabel: "Up to 50 points",
    timeLimit: "30 sec",
    options: [
      { id: "o1", label: "", isBest: true },
      { id: "o2", label: "" },
      { id: "o3", label: "" }
    ]
  };
}

export function ChallengesView() {
  const [drops, setDrops] = useState<AdminDrop[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminDrop | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setDrops((await getAdminDrops()) ?? []);
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
    await deleteDropApi(id);
    await load();
  }

  if (editing) {
    return (
      <DropEditor
        initial={editing}
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
            Author the daily drop shown in Teams. One is active at a time — the bot serves that one.
          </p>
        </div>
        <Button onClick={() => setEditing(blankDrop())}>
          <Plus className="size-4" /> New drop
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : drops.length === 0 ? (
        <p className="text-sm text-muted-foreground">No drops yet — create one to publish today's challenge.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {drops.map((d) => (
            <Card key={d.id}>
              <CardContent className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{d.question || d.title}</p>
                    {d.isActive ? (
                      <Badge className="shrink-0">
                        <CheckCircle2 className="size-3" /> Active
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {d.behavior} · {d.options.length} options · {d.rewardLabel}
                  </p>
                </div>
                {!d.isActive ? (
                  <Button size="sm" variant="outline" disabled={busy === d.id} onClick={() => void activate(d.id)}>
                    {busy === d.id ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    Set active
                  </Button>
                ) : null}
                <Button size="icon" variant="ghost" onClick={() => setEditing(d)}>
                  <Pencil className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => void remove(d.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function DropEditor(props: { initial: AdminDrop; onClose: () => void; onSaved: () => Promise<void> }) {
  const [d, setD] = useState<AdminDrop>(props.initial);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<AdminDrop>) => setD((prev) => ({ ...prev, ...patch }));

  function setOption(idx: number, patch: Partial<DropOption>) {
    setD((prev) => ({ ...prev, options: prev.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)) }));
  }
  function setBest(idx: number) {
    setD((prev) => ({ ...prev, options: prev.options.map((o, i) => ({ ...o, isBest: i === idx })) }));
  }
  function addOption() {
    if (d.options.length >= 4) return;
    setD((prev) => ({ ...prev, options: [...prev.options, { id: `o${prev.options.length + 1}`, label: "" }] }));
  }
  function removeOption(idx: number) {
    setD((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }));
  }

  async function save() {
    setSaving(true);
    await saveDrop(d);
    setSaving(false);
    await props.onSaved();
  }

  const valid = d.question.trim() && d.options.filter((o) => o.label.trim()).length >= 2 && d.options.some((o) => o.isBest);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={props.onClose}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{props.initial.id ? "Edit drop" : "New drop"}</h1>
            <p className="text-sm text-muted-foreground">The daily challenge card employees answer in Teams.</p>
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Scenario</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label="Question / scenario">
              <Textarea
                rows={3}
                value={d.question}
                onChange={(e) => set({ question: e.target.value })}
                placeholder="A peak-hour tenant escalation is rising. What is the best next step?"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Belief">
                <select
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={d.behavior}
                  onChange={(e) => set({ behavior: e.target.value })}
                >
                  {BELIEFS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Time limit">
                <Input value={d.timeLimit ?? ""} onChange={(e) => set({ timeLimit: e.target.value })} placeholder="30 sec" />
              </Field>
            </div>
            <Field label="Reward label">
              <Input
                value={d.rewardLabel ?? ""}
                onChange={(e) => set({ rewardLabel: e.target.value })}
                placeholder="Up to 50 points"
              />
            </Field>
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Options — mark the best</CardTitle>
            <Button size="sm" variant="outline" onClick={addOption} disabled={d.options.length >= 4}>
              <Plus className="size-3.5" /> Add
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {d.options.map((o, i) => (
              <div key={o.id} className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => setBest(i)}
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
                  onChange={(e) => setOption(i, { label: e.target.value })}
                  placeholder={`Option ${i + 1}`}
                />
                {d.options.length > 2 ? (
                  <Button size="icon" variant="ghost" className="mt-0.5 size-8" onClick={() => removeOption(i)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            ))}
            <p className="mt-1 text-xs text-muted-foreground">
              The ⭐ option awards the full 50 points; others award 20.
            </p>
          </CardContent>
        </Card>
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
