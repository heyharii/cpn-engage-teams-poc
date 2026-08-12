import { useEffect, useState } from "react";
import { Loader2, Palette, Trophy, ShieldCheck, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  getSettings,
  saveSettings,
  getPendingRecognitions,
  approveRecognition,
  rejectRecognition,
  type AppSettings,
  type PendingRecognition
} from "@/lib/api";

const TZ_OPTIONS = ["Asia/Bangkok", "Asia/Jakarta", "Asia/Singapore", "UTC", "America/New_York", "Europe/London"];

export function SettingsView() {
  const [s, setS] = useState<AppSettings | null>(null);
  const [pending, setPending] = useState<PendingRecognition[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function load() {
    const [set, p] = await Promise.all([getSettings(), getPendingRecognitions()]);
    if (set) setS(set);
    if (p?.pending) setPending(p.pending);
  }
  useEffect(() => {
    void load();
  }, []);

  function patch(p: Partial<AppSettings>) {
    setS((prev) => (prev ? { ...prev, ...p } : prev));
  }

  async function save(section: string, body: Partial<AppSettings>) {
    setSaving(section);
    const r = await saveSettings(body);
    setSaving(null);
    if (r) {
      setS(r);
      setSaved(section);
      setTimeout(() => setSaved((cur) => (cur === section ? null : cur)), 1800);
    }
  }

  async function approve(id: string) {
    await approveRecognition(id);
    await load();
  }
  async function reject(id: string) {
    await rejectRecognition(id);
    await load();
  }

  if (!s) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const SaveBtn = (props: { section: string; body: Partial<AppSettings> }) => (
    <Button size="sm" disabled={saving !== null} onClick={() => void save(props.section, props.body)}>
      {saving === props.section ? (
        <Loader2 className="size-4 animate-spin" />
      ) : saved === props.section ? (
        <Check className="size-4" />
      ) : null}
      {saved === props.section ? "Saved" : "Save"}
    </Button>
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure branding, schedule, scoring, and moderation.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Branding */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="size-4" /> Branding
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">App name</label>
              <Input value={s.appName} onChange={(e) => patch({ appName: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Accent color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent"
                  value={s.accentColor}
                  onChange={(e) => patch({ accentColor: e.target.value })}
                />
                <Input className="w-32" value={s.accentColor} onChange={(e) => patch({ accentColor: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <SaveBtn section="branding" body={{ appName: s.appName, accentColor: s.accentColor }} />
              <span className="text-xs text-muted-foreground">Applies to the employee tabs after reload.</span>
            </div>
          </CardContent>
        </Card>

        {/* Scoring */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-4" /> Scoring
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm">Leaderboard period</label>
              <select
                className="h-9 w-40 rounded-md border border-input bg-transparent px-3 text-sm"
                value={s.leaderboardPeriod}
                onChange={(e) => patch({ leaderboardPeriod: e.target.value as AppSettings["leaderboardPeriod"] })}
              >
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="all">All time</option>
              </select>
            </div>
            <SaveBtn
              section="scoring"
              body={{ leaderboardPeriod: s.leaderboardPeriod }}
            />
          </CardContent>
        </Card>

        {/* Moderation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4" /> Moderation
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <label className="flex items-center justify-between text-sm">
              <span>
                Recognitions require approval
                <span className="block text-xs text-muted-foreground">Hold new recognitions until an admin approves.</span>
              </span>
              <Switch
                checked={s.recognitionRequiresApproval}
                onCheckedChange={(v) => void save("moderation", { recognitionRequiresApproval: v })}
              />
            </label>
            {pending.length > 0 ? (
              <div className="mt-1 flex flex-col gap-2 border-t border-border pt-3">
                <p className="text-sm font-semibold">Pending approval ({pending.length})</p>
                {pending.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <div>
                      <p>
                        <span className="font-medium">{p.author}</span> → <span className="font-medium">{p.target}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{p.message}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => void reject(p.id)}>
                        <X className="size-3.5" /> Reject
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void approve(p.id)}>
                        <Check className="size-3.5" /> Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : s.recognitionRequiresApproval ? (
              <p className="text-xs text-muted-foreground">No recognitions waiting.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
