import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, GripVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminBeliefs, saveBelief, deleteBeliefApi, type Belief } from "@/lib/api";

export function BeliefsView() {
  const [beliefs, setBeliefs] = useState<Belief[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setBeliefs((await getAdminBeliefs()) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  function edit(id: string, patch: Partial<Belief>) {
    setBeliefs((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  async function persist(b: Belief) {
    setSaving(b.id);
    await saveBelief(b);
    setSaving(null);
  }

  async function add() {
    const b: Belief = { id: "", name: "New Belief", tagline: "", orderIdx: beliefs.length };
    const r = await saveBelief(b);
    if (r?.belief) await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this belief?")) return;
    await deleteBeliefApi(id);
    await load();
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Beliefs</h1>
          <p className="text-sm text-muted-foreground">
            The CPN values. These power the employee "four behaviours" panel and the Belief picker in
            modules & challenges — edit here, everything else follows.
          </p>
        </div>
        <Button onClick={() => void add()}>
          <Plus className="size-4" /> New belief
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : beliefs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No beliefs yet — add your organization's values.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {beliefs.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex items-center gap-3">
                <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                <Input
                  className="w-48 shrink-0 font-medium"
                  value={b.name}
                  onChange={(e) => edit(b.id, { name: e.target.value })}
                  onBlur={() => void persist(b)}
                  placeholder="Name"
                />
                <Input
                  className="flex-1"
                  value={b.tagline}
                  onChange={(e) => edit(b.id, { tagline: e.target.value })}
                  onBlur={() => void persist(b)}
                  placeholder="Tagline / description"
                />
                {saving === b.id ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : null}
                <Button size="icon" variant="ghost" className="shrink-0" onClick={() => void remove(b.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Changes save when you click away from a field.</p>
    </div>
  );
}
