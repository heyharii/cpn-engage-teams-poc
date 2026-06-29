import { type BootstrapResponse } from "@cpn-engage/shared";
import { useEffect, useState } from "react";
import { app as teamsApp, authentication } from "@microsoft/teams-js";

type TeamsState = {
  host: string;
  frame: string;
  userObjectId?: string;
} | null;

type SsoUser = { id: string; name: string | null; email: string | null } | null;
type SsoStatus = "checking" | "verified" | "unverified";

export function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [teamsState, setTeamsState] = useState<TeamsState>(null);
  const [teamsStatus, setTeamsStatus] = useState<"checking" | "teams" | "browser">("checking");
  const [ssoUser, setSsoUser] = useState<SsoUser>(null);
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

  useEffect(() => {
    let cancelled = false;
    async function loadBootstrap() {
      const response = await fetch(`${apiBaseUrl}/api/bootstrap`);
      const data = (await response.json()) as BootstrapResponse;
      if (!cancelled) setBootstrap(data);
    }
    void loadBootstrap();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    let cancelled = false;
    async function initTeams() {
      try {
        await teamsApp.initialize();
        const context = await teamsApp.getContext();
        if (!cancelled) {
          setTeamsState({
            host: context.app.host.name,
            frame: context.page.frameContext,
            userObjectId: context.user?.id
          });
          setTeamsStatus("teams");
        }

        // SSO (silent): exchange the Teams identity for an AAD token — no login
        // screen — then have the backend VERIFY it before trusting who we are.
        try {
          const token = await authentication.getAuthToken();
          const res = await fetch(`${apiBaseUrl}/api/profile/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = (await res.json()) as { user: { id: string; name: string | null; email: string | null } };
            if (!cancelled) {
              setSsoUser(data.user);
              setSsoStatus("verified");
            }
          } else if (!cancelled) {
            setSsoStatus("unverified");
          }
        } catch {
          if (!cancelled) setSsoStatus("unverified");
        }
      } catch {
        if (!cancelled) {
          setTeamsStatus("browser");
          setSsoStatus("unverified");
        }
      }
    }
    void initTeams();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshBootstrap() {
    setRefreshing(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/bootstrap`);
      const data = (await response.json()) as BootstrapResponse;
      setBootstrap(data);
    } finally {
      setRefreshing(false);
    }
  }

  const nextModule = bootstrap?.modules.find((item) => item.status === "assigned") ?? bootstrap?.modules[0];

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
              This is your personal progress dashboard. The daily drop, quizzes, and recognition all
              happen in the <strong>Chat</strong> tab with the CPN Engage bot — this view shows how
              far you've come.
            </p>
            {ssoStatus === "verified" && ssoUser ? (
              <p className="subtle">
                Signed in as <strong>{ssoUser.name ?? ssoUser.email}</strong>
                {ssoUser.email ? ` (${ssoUser.email})` : ""}.
              </p>
            ) : bootstrap ? (
              <p className="subtle">
                Signed in as {bootstrap.currentUser.name} from {bootstrap.currentUser.businessUnit}.
              </p>
            ) : null}
            <div className="runtime-badges">
              <span className="runtime-badge">
                {teamsStatus === "teams" ? "Teams host detected" : "Browser preview mode"}
              </span>
              {ssoStatus === "verified" ? (
                <span className="runtime-badge">✓ Verified via SSO</span>
              ) : ssoStatus === "unverified" ? (
                <span className="runtime-badge muted">SSO unavailable — unverified</span>
              ) : (
                <span className="runtime-badge muted">Verifying…</span>
              )}
              {teamsState ? (
                <>
                  <span className="runtime-badge muted">{teamsState.host}</span>
                  <span className="runtime-badge muted">{teamsState.frame}</span>
                </>
              ) : null}
            </div>
            <div className="hero-actions">
              <button onClick={() => void refreshBootstrap()}>
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>
          <div className="hero-stat">
            <span>{bootstrap?.passport.score ?? "--"}</span>
            <small>Total points</small>
            <strong>{bootstrap?.currentUser.businessUnit ?? ""}</strong>
          </div>
        </header>

        <section className="bot-pointer">
          <div className="bot-pointer-icon">💬</div>
          <div>
            <strong>Today's drop is waiting in Chat</strong>
            <p>
              {bootstrap?.dailyDrop.status === "completed"
                ? "Nice — you've completed today's daily drop. Come back tomorrow for the next one."
                : `“${bootstrap?.dailyDrop.question ?? "Loading today's scenario…"}” — open the Chat tab and message the bot “daily drop” to play.`}
            </p>
          </div>
          <span className={bootstrap?.dailyDrop.status === "completed" ? "pointer-state done" : "pointer-state"}>
            {bootstrap?.dailyDrop.status ?? "pending"}
          </span>
        </section>

        <section className="grid">
          <article className="panel passport-panel" id="progress">
            <div className="panel-title">
              <h2>My progress</h2>
              <span>{bootstrap?.passport.score ?? 0} pts</span>
            </div>
            <div className="passport-score-row">
              <div>
                <strong className="passport-score">{bootstrap?.stats.progress ?? "--"}%</strong>
                <small>Completion</small>
              </div>
              <div>
                <strong className="passport-score">
                  {bootstrap?.passport.modulesCompleted ?? "--"}/{bootstrap?.passport.modulesTotal ?? "--"}
                </strong>
                <small>Modules</small>
              </div>
            </div>
            <div className="passport-values">
              {(bootstrap?.passport.valuesProgress ?? []).map((item) => (
                <div key={item.name} className="passport-value">
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.points} pts</small>
                  </div>
                  <span className={item.status === "completed" ? "state-tag done" : "state-tag"}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel module-panel" id="learning">
            <div className="panel-title">
              <h2>Next module</h2>
              <span>{nextModule?.duration ?? "Loading"}</span>
            </div>
            <strong>{nextModule?.title ?? "Loading module…"}</strong>
            <p>{nextModule?.summary ?? "Fetching assigned learning journey."}</p>
            <p className="chat-hint">▶ Start it from the Chat tab</p>
          </article>

          <article className="panel passport-entries-panel">
            <div className="panel-title">
              <h2>Recent activity</h2>
              <span>Live record</span>
            </div>
            <div className="entry-list">
              {(bootstrap?.passport.recentEntries ?? []).map((entry) => (
                <div key={entry.id} className="entry-item">
                  <div>
                    <strong>{entry.title}</strong>
                    <p>
                      {entry.behavior} • {entry.date}
                    </p>
                  </div>
                  <span className="entry-points">+{entry.points}</span>
                </div>
              ))}
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
