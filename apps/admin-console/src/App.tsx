import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Send,
  Heart,
  Trophy,
  BookOpen,
  Zap,
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
  type RosterUser,
  type LeaderRow
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
  | "system";
const NAV: { id: NavId; label: string; icon: typeof Users }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "content", label: "Content", icon: BookOpen },
  { id: "challenges", label: "Challenges", icon: Zap },
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
  const { boot, audienceCount, leaders } = props;
  const recognitions = (boot?.feed ?? []).filter((f) => f.kind === "recognition").length;
  return (
    <div>
      <PageHeader title="Overview" subtitle="Engagement at a glance across CPN Engage." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Reachable audience" value={audienceCount} hint="captured conversations" />
        <StatCard label="Recognitions" value={recognitions} hint="posted to the feed" />
        <StatCard label="Top scorer" value={leaders[0]?.name ?? "—"} hint={leaders[0] ? `${leaders[0].points} pts` : ""} />
        <StatCard label="Modules" value={boot?.modules.length ?? 0} hint="in the learning journey" />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(boot?.notifications ?? []).slice(0, 6).map((n) => (
            <div key={n.id} className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
              <Badge variant="secondary">{n.type.replace(/-/g, " ")}</Badge>
              <div>
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.summary}</p>
              </div>
            </div>
          ))}
          {(boot?.notifications ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : null}
        </CardContent>
      </Card>
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

  const selectedModule = modules.find((m) => m.id === moduleId) ?? modules[0] ?? null;
  const drop = boot?.dailyDrop ?? null;

  return (
    <div>
      <PageHeader
        title="Broadcast"
        subtitle="Compose a proactive card, preview it, and send it to every reachable user's Teams chat."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Composer */}
        <Card>
          <CardHeader>
            <CardTitle>Compose</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">What to send</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setKind("challenge")}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    kind === "challenge" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  )}
                >
                  <p className="text-sm font-semibold">Daily challenge</p>
                  <p className="text-xs text-muted-foreground">Today's drop as a quiz card</p>
                </button>
                <button
                  type="button"
                  onClick={() => setKind("module")}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    kind === "module" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  )}
                >
                  <p className="text-sm font-semibold">Learning module</p>
                  <p className="text-xs text-muted-foreground">Assign a module to everyone</p>
                </button>
              </div>
            </div>

            {kind === "module" ? (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Module</p>
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

            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-sm text-muted-foreground">Audience</p>
              <p className="text-sm font-semibold">{audienceCount} reachable users</p>
            </div>

            <Button
              className="self-start"
              disabled={busy !== null || audienceCount === 0 || (kind === "module" && !selectedModule)}
              onClick={() =>
                void run("send", async () => {
                  const r = await pushBroadcast(kind, kind === "module" ? selectedModule?.id : undefined);
                  return r?.ok ? `Delivered to ${r.sent} of ${r.total} users.` : "Push failed — check the bot logs.";
                })
              }
            >
              {busy === "send" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send to {audienceCount} users
            </Button>
            {msg ? <p className="text-sm font-medium text-emerald-600">{msg}</p> : null}
            {audienceCount === 0 ? (
              <p className="text-xs text-muted-foreground">
                No reachable users yet — employees appear here after they open the bot chat once.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* Card preview — what lands in the employee's Teams chat */}
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Teams card preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              {kind === "challenge" ? (
                drop ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Daily challenge</p>
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
                    <div className="mt-2 rounded-md bg-primary px-3 py-1.5 text-center text-sm font-medium text-primary-foreground">
                      Play now
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Loading today's drop…</p>
                )
              ) : selectedModule ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">New module assigned</p>
                  <p className="font-semibold">{selectedModule.title}</p>
                  <p className="text-sm text-muted-foreground">{selectedModule.summary}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary">{selectedModule.track}</Badge>
                    <span className="text-xs text-muted-foreground">{selectedModule.durationMin} min</span>
                    <span className="text-xs text-muted-foreground">· {selectedModule.questions.length} questions</span>
                  </div>
                  <div className="mt-2 rounded-md bg-primary px-3 py-1.5 text-center text-sm font-medium text-primary-foreground">
                    Start module
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No module selected.</p>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Employees receive this as an Adaptive Card in their 1:1 chat with the CPN Engage bot.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Utilities */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Scheduler test</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Fire a one-off scheduled push in 30 seconds to verify the cron path end-to-end.
          </p>
          <Button
            variant="outline"
            className="ml-auto shrink-0"
            disabled={busy !== null}
            onClick={() =>
              void run("schedule", async () => {
                const r = await scheduleTest(30);
                return r?.ok ? "Scheduled — watch your Teams DM in ~30s." : "Scheduler not running.";
              })
            }
          >
            {busy === "schedule" ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
            Schedule test push
          </Button>
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
