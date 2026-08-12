import { type BootstrapResponse } from "@cpn-engage/shared";
import { useEffect, useState } from "react";
import { RefreshCw, Flame, MessageSquare, BookOpen, Target, LayoutGrid, ScrollText } from "lucide-react";
import { guestId } from "@/lib/identity";
import { teamsAuthTokenResult, teamsDisplayName, type TokenResult } from "@/lib/teams";
import { SsoBadge, type SsoInfo, type SsoState } from "@/components/sso-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SsoStatus = "checking" | "verified" | "unverified";

type MeResponse = {
  ok: boolean;
  verified: boolean;
  sso?: SsoInfo;
  me: {
    profile: { oid: string; name: string | null; email: string | null; department: string | null };
    score: { points: number; rank: number | null };
    passport: {
      modulesCompleted: number;
      modulesTotal: number;
      completion: number;
      recentEntries: { id: string; date: string; title: string; points: number; status: string }[];
    };
    streak: { current: number; best: number };
    beliefs: { name: string; points: number }[];
    answeredDropToday: boolean;
    completedModuleIds: string[];
  };
  org: {
    modules: BootstrapResponse["modules"];
    dailyDrop: BootstrapResponse["dailyDrop"];
    feed: BootstrapResponse["feed"];
    capstone: BootstrapResponse["capstone"];
  };
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const NAV = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "progress", label: "Progress", icon: ScrollText },
  { id: "learning", label: "Learning", icon: BookOpen },
  { id: "beliefs", label: "Beliefs", icon: Target }
];

export function ProfilePage() {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [ssoStatus, setSsoStatus] = useState<SsoStatus>("checking");
  const [sso, setSso] = useState<SsoState>({ state: "checking" });
  const [host, setHost] = useState<TokenResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeNav, setActiveNav] = useState("overview");
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";

  function goToSection(id: string) {
    setActiveNav(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadMe(token: string | null, hostResult?: TokenResult | null): Promise<void> {
    const hostInfo = hostResult ?? host;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    else {
      headers["x-cpn-guest"] = guestId();
      // Unverified but inside Teams: pass the host's display name so the
      // profile and anything posted from the tab shows a person, not "A colleague".
      const name = await teamsDisplayName();
      if (name) headers["x-cpn-guest-name"] = name;
    }
    try {
      const res = await fetch(`${apiBaseUrl}/api/me`, { headers });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { sso?: SsoInfo } | null;
        setSso({ state: "ok", verified: false, name: null, sso: body?.sso, host: hostInfo ?? undefined });
        setSsoStatus("unverified");
        return;
      }
      const data = (await res.json()) as MeResponse;
      setMe(data);
      setSsoStatus(data.verified ? "verified" : "unverified");
      setSso({ state: "ok", verified: data.verified, name: data.me?.profile?.name ?? null, sso: data.sso, host: hostInfo ?? undefined });
    } catch (err) {
      // A blocked CORS preflight or a down API lands here — say so instead of
      // leaving the tab looking empty.
      setSso({ state: "unreachable", detail: err instanceof Error ? err.message : "request failed" });
      setSsoStatus("unverified");
    }
  }

  useEffect(() => {
    let cancelled = false;
    void fetch(`${apiBaseUrl}/api/bootstrap`)
      .then((r) => r.json() as Promise<BootstrapResponse>)
      .then((d) => !cancelled && setBootstrap(d));

    async function init() {
      const result = await teamsAuthTokenResult();
      if (cancelled) return;
      setHost(result);
      await loadMe(result.token, result);
    }
    void init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl]);

  async function refresh() {
    setRefreshing(true);
    try {
      // Resolves to a null token outside Teams instead of hanging, so the
      // button always finishes and the guest path still refetches.
      const result = await teamsAuthTokenResult();
      setHost(result);
      await loadMe(result.token, result);
      const b = await fetch(`${apiBaseUrl}/api/bootstrap`).then((r) => r.json() as Promise<BootstrapResponse>);
      setBootstrap(b);
    } finally {
      setRefreshing(false);
    }
  }

  const p = me?.me;
  const org = me?.org;
  const completedIds = new Set(p?.completedModuleIds ?? []);
  const nextModule =
    (org?.modules ?? bootstrap?.modules ?? []).find((m) => !completedIds.has(m.id)) ??
    org?.modules?.[0] ??
    bootstrap?.modules?.[0];
  const drop = org?.dailyDrop ?? bootstrap?.dailyDrop;
  const answeredToday = p?.answeredDropToday ?? false;
  const displayName = p?.profile.name ?? (me?.verified ? "You" : "Guest preview");
  const allDone = (p?.passport.modulesTotal ?? 0) > 0 && completedIds.size >= (p?.passport.modulesTotal ?? 0);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-sidebar p-4 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            CP
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold">CPN Engage</p>
            <p className="text-xs text-muted-foreground">My Journey</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => goToSection(item.id)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                activeNav === item.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="mx-auto w-full max-w-4xl flex-1 p-6 sm:p-8">
        {/* Hero */}
        <section id="overview" className="mb-5">
          <Card>
            <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-stretch sm:justify-between">
              <div className="max-w-xl">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">
                  Central Pattana Engage
                </p>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Your culture journey.</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  The daily drop, quizzes, and recognition happen in the <strong>Chat</strong> tab with the
                  CPN Engage bot — this view shows how far you've come.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {ssoStatus === "verified" ? (
                    <>Signed in as <strong className="text-foreground">{displayName}</strong>.</>
                  ) : ssoStatus === "unverified" ? (
                    <><strong className="text-foreground">{displayName}</strong> · not verified (browser preview).</>
                  ) : (
                    "Loading your profile…"
                  )}
                </p>
                <SsoBadge status={sso} className="mt-3" />
                <Button variant="outline" size="sm" className="mt-4" onClick={() => void refresh()}>
                  <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
                  {refreshing ? "Refreshing…" : "Refresh"}
                </Button>
              </div>
              <div className="flex w-full shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-muted/40 p-6 sm:w-48">
                <span className="text-4xl font-bold text-primary">{p ? p.score.points : "–"}</span>
                <small className="text-sm text-muted-foreground">Total points</small>
                {p?.streak.current ? (
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                    <Flame className="size-3.5 text-primary" /> {p.streak.current}-day streak
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Bot pointer */}
        <Card className="mb-5">
          <CardContent className="flex items-center gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent">
              <MessageSquare className="size-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Today's drop {answeredToday ? "is done" : "is waiting in Chat"}</p>
              <p className="truncate text-sm text-muted-foreground">
                {answeredToday
                  ? "Nice — come back tomorrow for the next one."
                  : `“${drop?.question ?? "Loading today's scenario…"}” — message the bot “daily drop” to play.`}
              </p>
            </div>
            <Badge variant={answeredToday ? "default" : "secondary"} className="shrink-0">
              {answeredToday ? "completed" : "pending"}
            </Badge>
          </CardContent>
        </Card>

        {/* Grid */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Progress */}
          <Card id="progress">
            <CardHeader>
              <CardTitle>My progress</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { v: `${p?.passport.completion ?? 0}%`, l: "Completion" },
                  { v: `${p?.passport.modulesCompleted ?? 0}/${p?.passport.modulesTotal ?? 0}`, l: "Modules" },
                  { v: p?.streak.current ?? 0, l: "Day streak" }
                ].map((s) => (
                  <div key={s.l} className="rounded-lg border border-border bg-muted/40 p-3 text-center">
                    <p className="text-2xl font-bold">{s.v}</p>
                    <p className="text-xs text-muted-foreground">{s.l}</p>
                  </div>
                ))}
              </div>
              {(p?.beliefs ?? []).length > 0 ? (
                <div className="flex flex-col gap-2">
                  {p!.beliefs.map((b) => (
                    <div
                      key={b.name}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                    >
                      <span className="text-sm font-medium">{b.name}</span>
                      <span className="text-sm font-semibold text-primary">{b.points} pts</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Earn points in the Chat tab to build your Beliefs breakdown.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Next module */}
          <Card id="learning">
            <CardHeader>
              <CardTitle>{allDone ? "All modules done 🎉" : "Next module"}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base font-semibold">{nextModule?.title ?? "Loading module…"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {nextModule?.summary ?? "Fetching your learning journey."}
              </p>
              {(nextModule as { deadline?: string | null } | undefined)?.deadline ? (
                <Badge variant="secondary" className="mt-3">
                  Due {(nextModule as { deadline?: string | null }).deadline}
                </Badge>
              ) : null}
              <p className="mt-3 text-sm font-medium text-primary">▶ Start it from the Chat tab</p>
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {(p?.passport.recentEntries ?? []).length > 0 ? (
                <div className="flex flex-col">
                  {p!.passport.recentEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between border-b border-border py-3 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{entry.title}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(entry.date)}</p>
                      </div>
                      <span className="text-sm font-bold text-primary">+{entry.points}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nothing yet — answer today's drop or finish a module in Chat.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Beliefs */}
          <Card id="beliefs">
            <CardHeader>
              <CardTitle>The four behaviours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {(bootstrap?.behaviors ?? []).map((behavior) => (
                  <div key={behavior.name} className="rounded-md border border-border bg-muted/40 p-3">
                    <p className="text-sm font-semibold">{behavior.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{behavior.tagline}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
