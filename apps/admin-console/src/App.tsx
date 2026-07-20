import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Send,
  Heart,
  Trophy,
  BookOpen,
  Zap,
  Target,
  Megaphone,
  EyeOff,
  Activity,
  Download,
  CheckCircle2 as CheckIcon,
  XCircle,
  RefreshCw,
  Sparkles,
  Search,
  Clock,
  Loader2,
  CheckCircle2,
  CircleDashed
} from "lucide-react";
import { ContentView } from "@/content-view";
import { ChallengesView } from "@/challenges-view";
import { BeliefsView } from "@/beliefs-view";
import type { BootstrapResponse, FeedItem, ModuleContent } from "@cpn-engage/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  getBootstrap,
  getLeaderboard,
  getUsers,
  getAdminModules,
  syncDirectory,
  enrichAudience,
  pushBroadcast,
  scheduleTest,
  getAdminKey,
  setAdminKey,
  verifyAdminKey,
  postAnnouncement,
  hideFeedPost,
  getDebugBundle,
  getAnalytics,
  getBroadcasts,
  getScheduled,
  scheduleBroadcastApi,
  cancelScheduledApi,
  type RosterUser,
  type LeaderRow,
  type Analytics,
  type BroadcastRow,
  type ScheduledRow
} from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";

type NavId =
  | "overview"
  | "content"
  | "challenges"
  | "users"
  | "broadcast"
  | "recognitions"
  | "leaderboard"
  | "beliefs"
  | "system";
const NAV: { id: NavId; label: string; icon: typeof Users }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "content", label: "Content", icon: BookOpen },
  { id: "challenges", label: "Challenges", icon: Zap },
  { id: "beliefs", label: "Beliefs", icon: Target },
  { id: "users", label: "Users", icon: Users },
  { id: "broadcast", label: "Broadcast", icon: Send },
  { id: "recognitions", label: "Recognitions", icon: Heart },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "system", label: "System", icon: Activity }
];

export function App() {
  // Auth gate — the console needs a valid admin key before it can load anything.
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    const key = getAdminKey();
    if (!key) {
      setAuthed(false);
      return;
    }
    void verifyAdminKey(key).then(setAuthed);
  }, []);

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Checking access…
      </div>
    );
  }
  if (!authed) {
    return <LoginGate onAuthed={() => setAuthed(true)} />;
  }
  return <Console />;
}

function LoginGate(props: { onAuthed: () => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const ok = await verifyAdminKey(key.trim());
    setBusy(false);
    if (ok) {
      setAdminKey(key.trim());
      props.onAuthed();
    } else {
      setError("That key was rejected. Check the key from your installer.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
            C
          </div>
          <CardTitle>CPN Engage Admin</CardTitle>
          <p className="text-sm text-muted-foreground">Enter your admin key to continue.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input
            type="password"
            placeholder="Admin key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            autoFocus
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button disabled={busy || !key.trim()} onClick={() => void submit()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Unlock
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Console() {
  const [nav, setNav] = useState<NavId>("overview");
  const [boot, setBoot] = useState<BootstrapResponse | null>(null);
  const [roster, setRoster] = useState<RosterUser[]>([]);
  const [directoryCount, setDirectoryCount] = useState(0);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [modules, setModules] = useState<ModuleContent[]>([]);

  async function loadAll() {
    const [b, u, l, m] = await Promise.all([getBootstrap(), getUsers(), getLeaderboard(), getAdminModules()]);
    if (b) setBoot(b);
    if (u) {
      setRoster(u.users);
      setDirectoryCount(u.directoryCount);
    }
    if (l) setLeaders(l);
    if (m) setModules(m);
  }
  useEffect(() => {
    void loadAll();
  }, []);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r border-border bg-sidebar p-4">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
            C
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-sidebar-foreground">CPN Engage</p>
            <p className="text-xs text-sidebar-foreground/50">Admin Console</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setNav(item.id)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                nav === item.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto px-2 pt-4">
          <Button variant="outline" size="sm" className="w-full" onClick={() => void loadAll()}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-8">
        {nav === "overview" && (
          <Overview boot={boot} audienceCount={roster.filter((u) => u.reachable).length} leaders={leaders} />
        )}
        {nav === "content" && <ContentView />}
        {nav === "challenges" && <ChallengesView />}
        {nav === "beliefs" && <BeliefsView />}
        {nav === "users" && (
          <UsersView roster={roster} directoryCount={directoryCount} leaders={leaders} onReload={loadAll} />
        )}
        {nav === "broadcast" && (
          <Broadcast
            audienceCount={roster.filter((u) => u.reachable).length}
            boot={boot}
            modules={modules.filter((m) => m.isLive !== false)}
          />
        )}
        {nav === "recognitions" && <Recognitions feed={boot?.feed ?? []} onReload={loadAll} />}
        {nav === "leaderboard" && <Leaderboard leaders={leaders} />}
        {nav === "system" && <SystemView />}
      </main>
    </div>
  );
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-bold">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function Overview(props: { boot: BootstrapResponse | null; audienceCount: number; leaders: LeaderRow[] }) {
  const { audienceCount, leaders } = props;
  const [a, setA] = useState<Analytics | null>(null);
  useEffect(() => {
    void getAnalytics().then((r) => r && setA(r));
  }, []);

  const maxDept = Math.max(1, ...(a?.departmentLeague ?? []).map((d) => d.points));

  return (
    <div>
      <PageHeader title="Overview" subtitle="Engagement at a glance — real numbers from actual activity." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="People" value={a?.totals.users ?? "—"} hint="profiles created" />
        <StatCard label="Reachable" value={audienceCount} hint="can be DM'd by the bot" />
        <StatCard label="Points earned" value={a?.totals.points ?? "—"} hint="across everyone" />
        <StatCard label="Recognitions" value={a?.totals.recognitions ?? "—"} hint="posted to the feed" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Participation trend */}
        <Card>
          <CardHeader>
            <CardTitle>Daily challenge participation</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniBars data={(a?.participationByDay ?? []).map((d) => ({ label: d.day.slice(5), value: d.users }))} />
          </CardContent>
        </Card>

        {/* Recognitions trend */}
        <Card>
          <CardHeader>
            <CardTitle>Recognitions posted</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniBars data={(a?.recognitionsByDay ?? []).map((d) => ({ label: d.day.slice(5), value: d.count }))} />
          </CardContent>
        </Card>

        {/* Department league */}
        <Card>
          <CardHeader>
            <CardTitle>Department league</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(a?.departmentLeague ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No points earned yet.</p>
            ) : (
              a!.departmentLeague.map((d) => (
                <div key={d.department}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{d.department}</span>
                    <span className="text-muted-foreground">
                      {d.points} pts · {d.people} {d.people === 1 ? "person" : "people"}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(d.points / maxDept) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Top learners */}
        <Card>
          <CardHeader>
            <CardTitle>Top learners</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {(a?.topLearners ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No modules completed yet.</p>
            ) : (
              a!.topLearners.map((l, i) => (
                <div key={l.name} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                  <span>
                    <span className="mr-2 font-bold text-muted-foreground">{i + 1}</span>
                    {l.name}
                  </span>
                  <Badge variant="secondary">{l.completed} modules</Badge>
                </div>
              ))
            )}
            {(a?.topLearners ?? []).length === 0 && leaders[0] ? null : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Lightweight flat bar chart (no chart lib needed — pure divs). */
function MiniBars(props: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...props.data.map((d) => d.value));
  const total = props.data.reduce((s, d) => s + d.value, 0);
  return (
    <div>
      <div className="flex h-32 items-end gap-1">
        {props.data.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end" title={`${d.label}: ${d.value}`}>
            <div
              className="w-full rounded-t bg-primary/80"
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{props.data[0]?.label}</span>
        <span>{total} total</span>
        <span>{props.data[props.data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  async function run(key: string, fn: () => Promise<string>) {
    setBusy(key);
    setMsg(null);
    try {
      setMsg(await fn());
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }
  return { busy, msg, run };
}

function UsersView(props: {
  roster: RosterUser[];
  directoryCount: number;
  leaders: LeaderRow[];
  onReload: () => Promise<void>;
}) {
  const { roster, directoryCount, leaders, onReload } = props;
  const { busy, msg, run } = useAction();
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState<string>("all");

  const pointsByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of leaders) map.set(l.name.trim().toLowerCase(), l.points);
    return map;
  }, [leaders]);

  const departments = useMemo(
    () => [...new Set(roster.map((u) => u.department).filter((d): d is string => Boolean(d)))].sort(),
    [roster]
  );

  const filtered = roster.filter((u) => {
    if (dept !== "all" && u.department !== dept) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.jobTitle ?? "").toLowerCase().includes(q)
    );
  });
  const reachable = roster.filter((u) => u.reachable).length;

  return (
    <div>
      <PageHeader title="Users" subtitle="Everyone in the organization — directory, reachability, and points." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="In directory" value={directoryCount || roster.length} hint="synced from Microsoft Graph" />
        <StatCard label="Reachable by bot" value={reachable} hint="opened the app or were captured" />
        <StatCard
          label="Coverage"
          value={roster.length ? `${Math.round((reachable / roster.length) * 100)}%` : "—"}
          hint="reachable / total users"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="w-64 pl-8"
            placeholder="Search name, email, title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={dept}
          onChange={(e) => setDept(e.target.value)}
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() =>
              void run("sync", async () => {
                const r = await syncDirectory();
                await onReload();
                return r?.ok ? `Synced ${r.upserted} directory users.` : r?.error ?? "Sync failed.";
              })
            }
          >
            {busy === "sync" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Sync directory
          </Button>
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() =>
              void run("enrich", async () => {
                const r = await enrichAudience();
                await onReload();
                return r?.ok ? `Enriched ${r.named} names, ${r.titled} titles.` : "Enrich failed.";
              })
            }
          >
            {busy === "enrich" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Enrich
          </Button>
        </div>
      </div>
      {msg ? <p className="mb-3 text-sm text-muted-foreground">{msg}</p> : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Job title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const pts = pointsByName.get(u.name.trim().toLowerCase());
                return (
                  <TableRow key={u.oid}>
                    <TableCell>
                      <p className="font-medium">{u.name}</p>
                      {u.email ? <p className="text-xs text-muted-foreground">{u.email}</p> : null}
                    </TableCell>
                    <TableCell>{u.jobTitle ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      {u.department ? (
                        <Badge variant="secondary">{u.department}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.reachable ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
                          <CheckCircle2 className="size-3.5" /> Reachable
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          <CircleDashed className="size-3.5" /> Not yet
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {pts ?? <span className="font-normal text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    {roster.length === 0
                      ? "No users yet — run Sync directory (needs Graph credentials), or ask employees to open the app once."
                      : "No users match the current search/filter."}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Broadcast(props: { audienceCount: number; boot: BootstrapResponse | null; modules: ModuleContent[] }) {
  const { audienceCount, boot, modules } = props;
  const { busy, msg, run } = useAction();
  const [kind, setKind] = useState<"challenge" | "module">("challenge");
  const [moduleId, setModuleId] = useState<string>("");
  const [history, setHistory] = useState<BroadcastRow[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledRow[]>([]);
  const [scheduleAt, setScheduleAt] = useState<string>("");

  async function loadHistory() {
    const [h, s] = await Promise.all([getBroadcasts(), getScheduled()]);
    if (h?.broadcasts) setHistory(h.broadcasts);
    if (s?.scheduled) setScheduled(s.scheduled);
  }
  useEffect(() => {
    void loadHistory();
  }, [msg]); // refresh after a send

  const selectedModule = modules.find((m) => m.id === moduleId) ?? modules[0] ?? null;
  const drop = boot?.dailyDrop ?? null;

  const canSend = busy === null && audienceCount > 0 && !(kind === "module" && !selectedModule);

  return (
    <div>
      <PageHeader
        title="Broadcast"
        subtitle="Send a card to everyone's Teams chat. Pick what to send on the left — the right shows exactly how it will look."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
        {/* LEFT — pick what to send */}
        <Card>
          <CardHeader>
            <CardTitle>1 · What to send</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setKind("challenge")}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                kind === "challenge" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
              )}
            >
              <Zap className={cn("mt-0.5 size-5 shrink-0", kind === "challenge" ? "text-primary" : "text-muted-foreground")} />
              <div>
                <p className="text-sm font-semibold">Daily challenge</p>
                <p className="text-xs text-muted-foreground">Send today's active drop as a quiz card.</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setKind("module")}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                kind === "module" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
              )}
            >
              <BookOpen className={cn("mt-0.5 size-5 shrink-0", kind === "module" ? "text-primary" : "text-muted-foreground")} />
              <div className="flex-1">
                <p className="text-sm font-semibold">Learning module</p>
                <p className="text-xs text-muted-foreground">Assign one module to everyone.</p>
              </div>
            </button>

            {kind === "module" ? (
              <div className="pl-1">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Which module</label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={selectedModule?.id ?? ""}
                  onChange={(e) => setModuleId(e.target.value)}
                >
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.track} · {m.durationMin} min)
                    </option>
                  ))}
                </select>
                {modules.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">No live modules — author one in Content first.</p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* RIGHT — a Teams-chat mockup so "preview" is unmistakable */}
        <Card className="self-start">
          <CardHeader>
            <CardTitle>2 · How it looks in Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              {/* Chat message row: bot avatar + name + bubble */}
              <div className="flex gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  CP
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-xs">
                    <span className="font-semibold">CPN Engage</span>
                    <span className="text-muted-foreground"> · bot · now</span>
                  </p>
                  {/* The adaptive card bubble */}
                  <div className="rounded-lg border border-border bg-card p-3 shadow-none">
                    {kind === "challenge" ? (
                      drop ? (
                        <div className="flex flex-col gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Daily challenge</p>
                          <p className="font-semibold">{drop.behavior}</p>
                          <p className="text-sm text-muted-foreground">{drop.question}</p>
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Trophy className="size-3.5" /> {drop.rewardLabel}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="size-3.5" /> {drop.timeLimit}
                            </span>
                          </div>
                          <div className="mt-1 rounded-md bg-primary px-3 py-1.5 text-center text-sm font-medium text-primary-foreground">
                            Play now
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Loading today's drop…</p>
                      )
                    ) : selectedModule ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">New module assigned</p>
                        <p className="font-semibold">{selectedModule.title}</p>
                        <p className="text-sm text-muted-foreground">{selectedModule.summary}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{selectedModule.track}</Badge>
                          <span className="text-xs text-muted-foreground">{selectedModule.durationMin} min</span>
                          <span className="text-xs text-muted-foreground">· {selectedModule.questions.length} questions</span>
                        </div>
                        <div className="mt-1 rounded-md bg-primary px-3 py-1.5 text-center text-sm font-medium text-primary-foreground">
                          Start module
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No module selected.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Each employee gets this as an Adaptive Card in their private 1:1 chat with the bot.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* SEND BAR — audience + the actual send action, full width */}
      <Card className="mt-6">
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-accent">
              <Users className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {audienceCount} {audienceCount === 1 ? "person" : "people"} will receive this
              </p>
              <p className="text-xs text-muted-foreground">
                {audienceCount === 0
                  ? "No one is reachable yet — employees appear after they open the bot chat once."
                  : "Everyone who has opened the CPN Engage bot at least once."}
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {msg ? <span className="text-sm font-medium text-emerald-600">{msg}</span> : null}
            <Button
              size="lg"
              disabled={!canSend}
              onClick={() =>
                void run("send", async () => {
                  const r = await pushBroadcast(kind, kind === "module" ? selectedModule?.id : undefined);
                  return r?.ok ? `Delivered to ${r.sent} of ${r.total} people.` : "Push failed — check the bot logs.";
                })
              }
            >
              {busy === "send" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Schedule for later */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Schedule for later</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Send at</label>
              <Input
                type="datetime-local"
                className="w-56"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
              />
            </div>
            <Button
              disabled={busy !== null || !scheduleAt || audienceCount === 0 || (kind === "module" && !selectedModule)}
              onClick={() =>
                void run("sched", async () => {
                  const r = await scheduleBroadcastApi({
                    type: kind,
                    moduleId: kind === "module" ? selectedModule?.id : undefined,
                    label: kind === "module" ? selectedModule?.title : drop?.behavior,
                    at: new Date(scheduleAt).toISOString()
                  });
                  if (r?.ok) {
                    setScheduleAt("");
                    await loadHistory();
                    return "Scheduled.";
                  }
                  return r?.error ?? "Could not schedule.";
                })
              }
            >
              {busy === "sched" ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
              Schedule this {kind === "module" ? "module" : "challenge"}
            </Button>
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() =>
                void run("schedtest", async () => {
                  const r = await scheduleTest(30);
                  await loadHistory();
                  return r?.ok ? "Test push in ~30s." : "Scheduler not running.";
                })
              }
            >
              {busy === "schedtest" ? <Loader2 className="size-4 animate-spin" /> : null}
              Test (30s)
            </Button>
          </div>

          {scheduled.length > 0 ? (
            <div className="flex flex-col">
              <p className="mb-1 text-sm font-semibold">Upcoming</p>
              {scheduled.map((s) => (
                <div key={s.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {s.kind}
                    </Badge>
                    <span className="font-medium">{s.label ?? "—"}</span>
                    <span className="text-muted-foreground">{new Date(s.runAt).toLocaleString()}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void (async () => {
                        await cancelScheduledApi(s.id);
                        await loadHistory();
                      })()
                    }
                  >
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Broadcast history */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Broadcast history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No broadcasts sent yet.</p>
          ) : (
            <div className="flex flex-col">
              {history.map((b, i) => (
                <div key={i} className="flex items-center justify-between border-b border-border py-2.5 text-sm last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {b.kind}
                    </Badge>
                    <span className="font-medium">{b.label ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>
                      {b.sent}/{b.total} delivered
                    </span>
                    <span className="text-xs">{new Date(b.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Recognitions(props: { feed: FeedItem[]; onReload: () => Promise<void> }) {
  const { feed, onReload } = props;
  const recognitions = feed.filter((f) => f.kind === "recognition");
  const announcements = feed.filter((f) => f.kind === "announcement");
  const { busy, msg, run } = useAction();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  async function hide(id: string) {
    if (!confirm("Hide this post from the community feed?")) return;
    await hideFeedPost(id, true);
    await onReload();
  }

  return (
    <div>
      <PageHeader title="Recognitions & announcements" subtitle="Speak to the feed, and moderate what's posted." />

      {/* Announcement composer */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="size-4" /> Post an announcement
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input placeholder="Title (e.g. Q3 Recognition Campaign)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            rows={3}
            placeholder="Write your message to everyone…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <Button
              disabled={busy !== null || !title.trim() || !message.trim()}
              onClick={() =>
                void run("announce", async () => {
                  const r = await postAnnouncement(title.trim(), message.trim());
                  if (r?.ok) {
                    setTitle("");
                    setMessage("");
                    await onReload();
                    return "Announcement posted to the feed.";
                  }
                  return "Failed to post.";
                })
              }
            >
              {busy === "announce" ? <Loader2 className="size-4 animate-spin" /> : <Megaphone className="size-4" />}
              Post to feed
            </Button>
            {msg ? <span className="text-sm text-muted-foreground">{msg}</span> : null}
          </div>
        </CardContent>
      </Card>

      {announcements.length > 0 ? (
        <div className="mb-6">
          <p className="mb-2 text-sm font-semibold">Live announcements</p>
          <div className="flex flex-col gap-2">
            {announcements.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex items-start gap-3">
                  <Megaphone className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{a.title}</p>
                    <p className="text-sm text-muted-foreground">{a.message ?? a.summary}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => void hide(a.id)}>
                    <EyeOff className="size-3.5" /> Hide
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mb-2 text-sm font-semibold">Recognition posts</p>
      <div className="flex flex-col gap-2">
        {recognitions.map((r) => (
          <Card key={r.id}>
            <CardContent className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.author}</span>
                  <span className="text-sm text-muted-foreground">recognised</span>
                  <span className="font-semibold">{r.target}</span>
                  {r.belief ? <Badge variant="secondary">{r.belief}</Badge> : null}
                </div>
                <p className="text-sm">{r.message ?? r.summary}</p>
              </div>
              <Button size="sm" variant="ghost" className="shrink-0" onClick={() => void hide(r.id)}>
                <EyeOff className="size-3.5" /> Hide
              </Button>
            </CardContent>
          </Card>
        ))}
        {recognitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recognitions yet.</p>
        ) : null}
      </div>
    </div>
  );
}

function Leaderboard(props: { leaders: LeaderRow[] }) {
  return (
    <div>
      <PageHeader title="Leaderboard" subtitle="Real per-user standings from earned points." />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.leaders.map((l, i) => (
                <TableRow key={`${l.name}-${i}`}>
                  <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell>
                    {l.department ? <Badge variant="secondary">{l.department}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-bold">{l.points}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

type DebugBundle = {
  version?: string;
  commit?: string | null;
  node?: string;
  uptimeSeconds?: number;
  db?: { reachable?: boolean; rowCounts?: Record<string, number | string>; migrations?: { id: string; name: string }[] };
  config?: Record<string, { set: boolean; sha8?: string; value?: string }>;
  recentClientErrors?: { surface?: string; message?: string; created_at?: string }[];
};

function SystemView() {
  const [bundle, setBundle] = useState<DebugBundle | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setBundle((await getDebugBundle()) as DebugBundle | null);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  function download() {
    if (!bundle) return;
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cpn-engage-debug-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const dbOk = bundle?.db?.reachable;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">System</h1>
          <p className="text-sm text-muted-foreground">
            Health + a one-file debug bundle. When something breaks, download it and send it to support.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Refresh
          </Button>
          <Button size="sm" disabled={!bundle} onClick={download}>
            <Download className="size-3.5" /> Download debug bundle
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !bundle ? (
        <p className="text-sm text-destructive">Could not reach the API.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <Row label="API version" value={bundle.version ?? "—"} />
              <Row label="Node" value={bundle.node ?? "—"} />
              <Row label="Uptime" value={`${Math.round((bundle.uptimeSeconds ?? 0) / 60)} min`} />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Database</span>
                <span className={cn("inline-flex items-center gap-1.5 font-medium", dbOk ? "text-emerald-600" : "text-destructive")}>
                  {dbOk ? <CheckIcon className="size-4" /> : <XCircle className="size-4" />}
                  {dbOk ? "Reachable" : "Down"}
                </span>
              </div>
              <Row label="Migrations applied" value={String(bundle.db?.migrations?.length ?? 0)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {Object.entries(bundle.db?.rowCounts ?? {}).map(([t, n]) => (
                <Row key={t} label={t} value={String(n)} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm">
              {Object.entries(bundle.config ?? {}).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-mono text-xs">
                    {v.set ? (v.value ?? `set · ${v.sha8}`) : <span className="text-destructive">not set</span>}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent client errors ({bundle.recentClientErrors?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {(bundle.recentClientErrors ?? []).length === 0 ? (
                <p className="text-muted-foreground">None reported. 🎉</p>
              ) : (
                bundle.recentClientErrors!.slice(0, 8).map((e, i) => (
                  <div key={i} className="border-b border-border pb-2 last:border-0">
                    <p className="font-medium">{e.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.surface} · {e.created_at?.slice(0, 19).replace("T", " ")}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Row(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{props.label}</span>
      <span className="font-medium">{props.value}</span>
    </div>
  );
}
