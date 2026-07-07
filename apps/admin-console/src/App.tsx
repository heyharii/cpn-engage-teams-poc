import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Send,
  Heart,
  Trophy,
  RefreshCw,
  Sparkles,
  UserPlus,
  Loader2
} from "lucide-react";
import type { BootstrapResponse, FeedItem } from "@cpn-engage/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  getAudience,
  syncDirectory,
  enrichAudience,
  pushBroadcast,
  scheduleTest,
  type AudienceUser,
  type LeaderRow
} from "@/lib/api";

type NavId = "overview" | "audience" | "broadcast" | "recognitions" | "leaderboard";
const NAV: { id: NavId; label: string; icon: typeof Users }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "audience", label: "Audience", icon: Users },
  { id: "broadcast", label: "Broadcast", icon: Send },
  { id: "recognitions", label: "Recognitions", icon: Heart },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy }
];

export function App() {
  const [nav, setNav] = useState<NavId>("overview");
  const [boot, setBoot] = useState<BootstrapResponse | null>(null);
  const [audience, setAudience] = useState<AudienceUser[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);

  async function loadAll() {
    const [b, a, l] = await Promise.all([getBootstrap(), getAudience(), getLeaderboard()]);
    if (b) setBoot(b);
    if (a) setAudience(a.users);
    if (l) setLeaders(l);
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
        {nav === "overview" && <Overview boot={boot} audienceCount={audience.length} leaders={leaders} />}
        {nav === "audience" && <Audience users={audience} onReload={loadAll} />}
        {nav === "broadcast" && <Broadcast audienceCount={audience.length} />}
        {nav === "recognitions" && <Recognitions feed={boot?.feed ?? []} />}
        {nav === "leaderboard" && <Leaderboard leaders={leaders} />}
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

function Audience(props: { users: AudienceUser[]; onReload: () => Promise<void> }) {
  const { users, onReload } = props;
  const { busy, msg, run } = useAction();
  return (
    <div>
      <PageHeader title="Audience" subtitle="Everyone the bot can reach, resolved from the directory." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
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
        {msg ? <span className="text-sm text-muted-foreground">{msg}</span> : null}
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Job title</TableHead>
                <TableHead>Department</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u, i) => (
                <TableRow key={`${u.name}-${i}`}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.jobTitle ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {u.department ? (
                      <Badge variant="secondary">{u.department}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No audience yet — install the app for users, then Sync directory.
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

function Broadcast(props: { audienceCount: number }) {
  const { audienceCount } = props;
  const { busy, msg, run } = useAction();
  return (
    <div>
      <PageHeader title="Broadcast" subtitle={`Send a proactive card to all ${audienceCount} reachable users.`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily challenge</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">Push the current daily drop to everyone now.</p>
            <Button
              disabled={busy !== null}
              onClick={() =>
                void run("challenge", async () => {
                  const r = await pushBroadcast("challenge");
                  return r?.ok ? `Sent to ${r.sent}/${r.total}.` : "Push failed.";
                })
              }
            >
              {busy === "challenge" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send challenge
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Learning module</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">Assign the first module to everyone now.</p>
            <Button
              disabled={busy !== null}
              onClick={() =>
                void run("module", async () => {
                  const r = await pushBroadcast("module");
                  return r?.ok ? `Sent to ${r.sent}/${r.total}.` : "Push failed.";
                })
              }
            >
              {busy === "module" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send module
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Test the scheduler</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">Fire a scheduled push in 30 seconds (pg-boss cron demo).</p>
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() =>
              void run("schedule", async () => {
                const r = await scheduleTest(30);
                return r?.ok ? "Scheduled — watch your DM in ~30s." : "Scheduler not running.";
              })
            }
          >
            {busy === "schedule" ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Schedule test push
          </Button>
        </CardContent>
      </Card>
      {msg ? <p className="mt-4 text-sm text-muted-foreground">{msg}</p> : null}
    </div>
  );
}

function Recognitions(props: { feed: FeedItem[] }) {
  const recognitions = props.feed.filter((f) => f.kind === "recognition");
  return (
    <div>
      <PageHeader title="Recognitions" subtitle="Live recognition posts from the Community Feed (no approval needed)." />
      <div className="flex flex-col gap-3">
        {recognitions.map((r) => (
          <Card key={r.id}>
            <CardContent className="pt-6">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-semibold">{r.author}</span>
                <span className="text-sm text-muted-foreground">recognised</span>
                <span className="font-semibold">{r.target}</span>
                {r.belief ? <Badge variant="secondary">{r.belief}</Badge> : null}
              </div>
              <p className="text-sm">{r.message ?? r.summary}</p>
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
