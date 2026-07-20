import { type BootstrapResponse } from "@cpn-engage/shared";
import { useEffect, useState } from "react";
import { app as teamsApp, authentication } from "@microsoft/teams-js";
import { guestId } from "../lib/identity";

type SsoStatus = "checking" | "verified" | "unverified";

/** Per-user state from /api/me — the personal truth, keyed to this user. */
type MeResponse = {
  ok: boolean;
  verified: boolean;
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

export function ProfilePage() {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null); // shared org content only
  const [me, setMe] = useState<MeResponse | null>(null);
  const [ssoStatus, setSsoStatus] = useState<SsoStatus>("checking");
  const [refreshing, setRefreshing] = useState(false);
  const [activeNav, setActiveNav] = useState("overview");
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";

  const NAV = [
    { id: "overview", label: "Overview", icon: "◎" },
    { id: "progress", label: "Progress", icon: "📒" },
    { id: "learning", label: "Learning", icon: "📘" },
    { id: "beliefs", label: "Beliefs", icon: "🎯" }
  ];

  function goToSection(id: string) {
    setActiveNav(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /** Fetch per-user /api/me with the best identity we have (SSO token or guest). */
  async function loadMe(token: string | null): Promise<void> {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    else headers["x-cpn-guest"] = guestId();
    const res = await fetch(`${apiBaseUrl}/api/me`, { headers });
    if (res.ok) {
      setMe((await res.json()) as MeResponse);
      setSsoStatus(token ? "verified" : "unverified");
    }
  }

  useEffect(() => {
    let cancelled = false;
    // Shared org content (behaviors list, day's scenario text) stays on bootstrap.
    void fetch(`${apiBaseUrl}/api/bootstrap`)
      .then((r) => r.json() as Promise<BootstrapResponse>)
      .then((d) => !cancelled && setBootstrap(d));

    async function init() {
      let token: string | null = null;
      try {
        await teamsApp.initialize();
        try {
          token = await authentication.getAuthToken();
        } catch {
          /* SSO optional — fall through to guest */
        }
      } catch {
        /* browser preview — guest */
      }
      if (!cancelled) await loadMe(token);
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
      let token: string | null = null;
      try {
        token = await authentication.getAuthToken();
      } catch {
        /* guest */
      }
      await loadMe(token);
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

  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="brand">CP</div>
        <nav>
          {NAV.map((item) => (
            <button
              key={item.id}
              className={activeNav === item.id ? "nav-item active" : "nav-item"}
              onClick={() => goToSection(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="hero" id="overview">
          <div className="hero-copy">
            <p className="eyebrow">Central Pattana Engage</p>
            <h1>Your culture journey, at a glance.</h1>
            <p className="subtle">
              Your personal progress. The daily drop, quizzes, and recognition happen in the{" "}
              <strong>Chat</strong> tab with the CPN Engage bot — this view shows how far you've come.
            </p>
            <p className="subtle">
              {ssoStatus === "verified" ? (
                <>Signed in as <strong>{displayName}</strong>.</>
              ) : ssoStatus === "unverified" ? (
                <><strong>{displayName}</strong> · sign-in not verified (browser preview).</>
              ) : (
                "Loading your profile…"
              )}
            </p>
            <div className="hero-actions">
              <button onClick={() => void refresh()}>{refreshing ? "Refreshing…" : "Refresh"}</button>
            </div>
          </div>
          <div className="hero-stat">
            <span>{p ? p.score.points : "--"}</span>
            <small>Total points</small>
            <strong>{p?.streak.current ? `🔥 ${p.streak.current}-day streak` : ""}</strong>
          </div>
        </header>

        <section className="bot-pointer">
          <div className="bot-pointer-icon">💬</div>
          <div>
            <strong>Today's drop {answeredToday ? "is done" : "is waiting in Chat"}</strong>
            <p>
              {answeredToday
                ? "Nice — you've completed today's daily drop. Come back tomorrow for the next one."
                : `“${drop?.question ?? "Loading today's scenario…"}” — open the Chat tab and message the bot “daily drop” to play.`}
            </p>
          </div>
          <span className={answeredToday ? "pointer-state done" : "pointer-state"}>
            {answeredToday ? "completed" : "pending"}
          </span>
        </section>

        <section className="grid">
          <article className="panel passport-panel" id="progress">
            <div className="panel-title">
              <h2>My progress</h2>
              <span>{p?.score.points ?? 0} pts</span>
            </div>
            <div className="passport-score-row">
              <div>
                <strong className="passport-score">{p?.passport.completion ?? 0}%</strong>
                <small>Completion</small>
              </div>
              <div>
                <strong className="passport-score">
                  {p?.passport.modulesCompleted ?? 0}/{p?.passport.modulesTotal ?? 0}
                </strong>
                <small>Modules</small>
              </div>
              <div>
                <strong className="passport-score">{p?.streak.current ?? 0}</strong>
                <small>Day streak</small>
              </div>
            </div>
            <div className="passport-values">
              {(p?.beliefs ?? []).length > 0 ? (
                p!.beliefs.map((item) => (
                  <div key={item.name} className="passport-value">
                    <div>
                      <strong>{item.name}</strong>
                      <small>{item.points} pts</small>
                    </div>
                  </div>
                ))
              ) : (
                <p className="subtle">Earn points in the Chat tab to build your Beliefs breakdown.</p>
              )}
            </div>
          </article>

          <article className="panel module-panel" id="learning">
            <div className="panel-title">
              <h2>{completedIds.size >= (p?.passport.modulesTotal ?? 0) && (p?.passport.modulesTotal ?? 0) > 0 ? "All modules done 🎉" : "Next module"}</h2>
              <span>{nextModule?.duration ?? ""}</span>
            </div>
            <strong>{nextModule?.title ?? "Loading module…"}</strong>
            <p>{nextModule?.summary ?? "Fetching your learning journey."}</p>
            <p className="chat-hint">▶ Start it from the Chat tab</p>
          </article>

          <article className="panel passport-entries-panel">
            <div className="panel-title">
              <h2>Recent activity</h2>
              <span>Your record</span>
            </div>
            <div className="entry-list">
              {(p?.passport.recentEntries ?? []).length > 0 ? (
                p!.passport.recentEntries.map((entry) => (
                  <div key={entry.id} className="entry-item">
                    <div>
                      <strong>{entry.title}</strong>
                      <p>{fmtDate(entry.date)}</p>
                    </div>
                    <span className="entry-points">+{entry.points}</span>
                  </div>
                ))
              ) : (
                <p className="subtle">Nothing yet — answer today's drop or finish a module in Chat.</p>
              )}
            </div>
          </article>

          <article className="panel behaviors" id="beliefs">
            <div className="panel-title">
              <h2>The four behaviours</h2>
              <span>CPN's Beliefs by 4 Desired Behaviors</span>
            </div>
            <div className="behavior-list">
              {(bootstrap?.behaviors ?? []).map((behavior) => (
                <div key={behavior.name} className="behavior-chip">
                  <strong>{behavior.name}</strong>
                  <small>{behavior.tagline}</small>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
