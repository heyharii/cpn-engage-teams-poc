import { useEffect, useState, type ReactNode } from "react";
import { Plus, Pencil, Trash2, GripVertical, Loader2 } from "lucide-react";
import type { ModuleContent, QuizQuestion } from "@cpn-engage/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { getAdminModules, saveModule, deleteModuleApi } from "@/lib/api";

const BELIEFS = ["Dynamism", "Customers", "Communities", "Collaboration"];
const OPTION_KEYS = ["A", "B", "C", "D"];

function slugId(title: string): string {
  return `mod-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}-${Math.abs(hash(title + BELIEFS.length))}`;
}
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h % 100000;
}

function blankQuestion(n: number): QuizQuestion {
  return {
    id: `q${n}-${hash(String(n) + Math.floor(performance.now()))}`,
    number: n,
    question: "",
    options: ["A", "B", "C"].map((key) => ({ key, text: "", correct: key === "A" }))
  };
}

function blankModule(): ModuleContent {
  return {
    id: "",
    title: "",
    summary: "",
    track: BELIEFS[0],
    durationMin: 10,
    videoUrl: "",
    outcome: "",
    lesson: { heading: "", body: "" },
    questions: [blankQuestion(1)],
    isLive: true,
    orderIdx: 0
  };
}

export function ContentView() {
  const [modules, setModules] = useState<ModuleContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ModuleContent | null>(null);

  async function load() {
    setLoading(true);
    const m = await getAdminModules();
    setModules(m ?? []);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this module?")) return;
    await deleteModuleApi(id);
    await load();
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Learning content</h1>
          <p className="text-sm text-muted-foreground">Author modules, lessons, and quizzes for the four Beliefs.</p>
        </div>
        <Button onClick={() => setEditing(blankModule())}>
          <Plus className="size-4" /> New module
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-6">
          {BELIEFS.map((belief) => {
            const items = modules.filter((m) => m.track === belief);
            return (
              <div key={belief}>
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="secondary">{belief}</Badge>
                  <span className="text-xs text-muted-foreground">{items.length} module(s)</span>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((m) => (
                    <Card key={m.id}>
                      <CardContent className="flex items-center gap-3 py-3">
                        <GripVertical className="size-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium">{m.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {m.durationMin} min · {m.questions.length} question(s)
                            {m.videoUrl ? " · video" : ""}
                          </p>
                        </div>
                        {m.isLive === false ? <Badge variant="outline">Draft</Badge> : <Badge>Live</Badge>}
                        <Button size="icon" variant="ghost" onClick={() => setEditing(m)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => void remove(m.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {items.length === 0 ? (
                    <p className="px-1 text-sm text-muted-foreground">No modules yet.</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing ? (
        <ModuleEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function ModuleEditor(props: { initial: ModuleContent; onClose: () => void; onSaved: () => Promise<void> }) {
  const [m, setM] = useState<ModuleContent>(props.initial);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<ModuleContent>) => setM((prev) => ({ ...prev, ...patch }));

  function setQuestion(idx: number, q: QuizQuestion) {
    setM((prev) => ({ ...prev, questions: prev.questions.map((x, i) => (i === idx ? q : x)) }));
  }
  function addQuestion() {
    setM((prev) => ({ ...prev, questions: [...prev.questions, blankQuestion(prev.questions.length + 1)] }));
  }
  function removeQuestion(idx: number) {
    setM((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== idx).map((q, i) => ({ ...q, number: i + 1 }))
    }));
  }

  async function save() {
    setSaving(true);
    const payload: ModuleContent = { ...m, id: m.id || slugId(m.title || "module") };
    await saveModule(payload);
    setSaving(false);
    await props.onSaved();
  }

  const valid = m.title.trim() && m.track && m.questions.every((q) => q.question.trim());

  return (
    <Sheet open onOpenChange={(o) => !o && props.onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{props.initial.id ? "Edit module" : "New module"}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <Field label="Title">
            <Input value={m.title} onChange={(e) => set({ title: e.target.value })} placeholder="Building Customer Empathy" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Belief">
              <select
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={m.track}
                onChange={(e) => set({ track: e.target.value })}
              >
                {BELIEFS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Duration (min)">
              <Input
                type="number"
                value={m.durationMin}
                onChange={(e) => set({ durationMin: Number(e.target.value) || 0 })}
              />
            </Field>
          </div>
          <Field label="Summary">
            <Textarea value={m.summary} onChange={(e) => set({ summary: e.target.value })} rows={2} />
          </Field>
          <Field label="Video URL (optional)">
            <Input value={m.videoUrl ?? ""} onChange={(e) => set({ videoUrl: e.target.value })} placeholder="https://…" />
          </Field>

          <Separator />
          <p className="text-sm font-semibold">Lesson</p>
          <Field label="Heading">
            <Input value={m.lesson.heading} onChange={(e) => set({ lesson: { ...m.lesson, heading: e.target.value } })} />
          </Field>
          <Field label="Body">
            <Textarea value={m.lesson.body} onChange={(e) => set({ lesson: { ...m.lesson, body: e.target.value } })} rows={3} />
          </Field>

          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Quiz ({m.questions.length})</p>
            <Button size="sm" variant="outline" onClick={addQuestion}>
              <Plus className="size-3.5" /> Add question
            </Button>
          </div>
          {m.questions.map((q, qi) => (
            <QuestionEditor
              key={q.id}
              q={q}
              onChange={(nq) => setQuestion(qi, nq)}
              onRemove={() => removeQuestion(qi)}
            />
          ))}

          <Separator />
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={m.isLive ?? true} onCheckedChange={(v) => set({ isLive: v })} />
            Live (visible to learners)
          </label>
        </div>

        <SheetFooter>
          <Button disabled={!valid || saving} onClick={() => void save()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save module
          </Button>
          <Button variant="outline" onClick={props.onClose}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function QuestionEditor(props: { q: QuizQuestion; onChange: (q: QuizQuestion) => void; onRemove: () => void }) {
  const { q, onChange, onRemove } = props;
  function setOpt(key: string, patch: Partial<{ text: string; explanation: string }>) {
    onChange({
      ...q,
      options: q.options.map((o) => (o.key === key ? { ...o, ...patch } : o))
    });
  }
  function setCorrect(key: string) {
    onChange({ ...q, options: q.options.map((o) => ({ ...o, correct: o.key === key })) });
  }
  function addOption() {
    const nextKey = OPTION_KEYS[q.options.length];
    if (!nextKey) return;
    onChange({ ...q, options: [...q.options, { key: nextKey, text: "" }] });
  }

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col gap-2 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">Q{q.number}</span>
          <Button size="icon" variant="ghost" className="ml-auto size-7" onClick={onRemove}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
        <Textarea
          value={q.question}
          onChange={(e) => onChange({ ...q, question: e.target.value })}
          placeholder="Question text…"
          rows={2}
        />
        {q.options.map((o) => (
          <div key={o.key} className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => setCorrect(o.key)}
              title="Mark correct"
              className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                o.correct ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground"
              }`}
            >
              {o.key}
            </button>
            <div className="flex-1">
              <Input value={o.text} onChange={(e) => setOpt(o.key, { text: e.target.value })} placeholder={`Option ${o.key}`} />
              {o.correct ? (
                <Input
                  className="mt-1"
                  value={o.explanation ?? ""}
                  onChange={(e) => setOpt(o.key, { explanation: e.target.value })}
                  placeholder="Why this is correct (shown after answering)"
                />
              ) : null}
            </div>
          </div>
        ))}
        {q.options.length < 4 ? (
          <Button size="sm" variant="ghost" className="self-start" onClick={addOption}>
            <Plus className="size-3.5" /> Add option
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{props.label}</label>
      {props.children}
    </div>
  );
}
