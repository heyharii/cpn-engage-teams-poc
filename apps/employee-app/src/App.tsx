import { type BootstrapResponse } from "@cpn-engage/shared";
import { useEffect, useState } from "react";
import { app as teamsApp } from "@microsoft/teams-js";

type TeamsState = {
  host: string;
  frame: string;
  userObjectId?: string;
} | null;

export function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [teamsState, setTeamsState] = useState<TeamsState>(null);
  const [teamsStatus, setTeamsStatus] = useState<"checking" | "teams" | "browser">("checking");
  const [refreshing, setRefreshing] = useState(false);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";

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
      } catch {
        if (!cancelled) setTeamsStatus("browser");
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
  const leadingName = bootstrap?.leaderboard[0]?.name;
  const myName = bootstrap?.currentUser.name;
  const myRank = bootstrap?.leaderboard.findIndex((e) => e.name === myName);

  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="brand">CP</div>
        <nav>
          {["Overview", "Learning", "Passport", "Profile"].map((item) => (
            <button key={item} className={item === "Overview" ? "nav-item active" : "nav-item"}>
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Central Pattana Engage</p>
            <h1>Your culture journey, at a glance.</h1>
            <p className="subtle">
              This is your personal progress dashboard. The daily drop, quizzes, and recognition all
              happen in the <strong>Chat</strong> tab with the CPN Engage bot — this view shows how
              far you've come.
            </p>
            {bootstrap ? (
              <p className="subtle">
                Signed in as {bootstrap.currentUser.name} from {bootstrap.currentUser.businessUnit}.
              </p>
            ) : null}
            <div className="runtime-badges">
              <span className="runtime-badge">
                {teamsStatus === "teams" ? "Teams host detected" : "Browser preview mode"}
              </span>
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
            <small>Passport score</small>
            <strong>{bootstrap?.persona.title ?? "Persona loading"}</strong>
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
          <article className="panel passport-panel">
            <div className="panel-title">
              <h2>Progress passport</h2>
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
              <div>
                <strong className="passport-score">{bootstrap?.passport.badges ?? "--"}</strong>
                <small>Badges</small>
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

          <article className="panel streak-panel">
            <div className="panel-title">
              <h2>Current streak</h2>
              <span>Best {bootstrap?.streakSummary.best ?? "--"} days</span>
            </div>
            <strong className="big-number">{bootstrap?.streakSummary.current ?? "--"} days</strong>
            <p>
              Next milestone: {bootstrap?.streakSummary.nextMilestone ?? "--"} days.{" "}
              {bootstrap?.streakSummary.daysLeft ?? "--"} day(s) left for{" "}
              {bootstrap?.streakSummary.reward ?? "reward"}.
            </p>
          </article>

          <article className="panel rank-panel">
            <div className="panel-title">
              <h2>Leaderboard standing</h2>
              <span>This week</span>
            </div>
            <strong className="big-number">
              {myRank != null && myRank >= 0 ? `#${myRank + 1}` : "—"}
            </strong>
            <p>{leadingName ? <>Leader this week: <strong>{leadingName}</strong>.</> : "Climb the weekly board."}</p>
          </article>

          <article className="panel module-panel">
            <div className="panel-title">
              <h2>Next module</h2>
              <span>{nextModule?.duration ?? "Loading"}</span>
            </div>
            <strong>{nextModule?.title ?? "Loading module…"}</strong>
            <p>{nextModule?.summary ?? "Fetching assigned learning journey."}</p>
            <p className="chat-hint">▶ Start it from the Chat tab</p>
          </article>

          <article className="panel capstone-panel">
            <div className="panel-title">
              <h2>Capstone</h2>
              <span>{bootstrap?.capstone.difficulty ?? "Extreme"}</span>
            </div>
            <strong>{bootstrap?.capstone.title ?? "Capstone Challenge"}</strong>
            <p>{bootstrap?.capstone.summary ?? "Preparing final-week scenario."}</p>
            <div className="capstone-meta">
              <span>{bootstrap?.capstone.timeLimit ?? "05:00"}</span>
              <span>{bootstrap?.capstone.reward ?? "Reward"}</span>
              <span className={bootstrap?.capstone.unlocked ? "state-tag done" : "state-tag"}>
                {bootstrap?.capstone.unlocked ? "unlocked" : "locked"}
              </span>
            </div>
          </article>

          <article className="panel persona-panel">
            <div className="panel-title">
              <h2>Work persona</h2>
              <span>Level {bootstrap?.persona.level ?? "--"}</span>
            </div>
            <strong>{bootstrap?.persona.title ?? "Persona loading"}</strong>
            <p>{bootstrap?.persona.points ?? "--"} total points accumulated across the journey.</p>
            <div className="trait-list">
              {(bootstrap?.persona.traits ?? []).map((trait) => (
                <span key={trait} className="trait-pill">
                  {trait}
                </span>
              ))}
            </div>
          </article>

          <article className="panel passport-entries-panel">
            <div className="panel-title">
              <h2>Recent passport entries</h2>
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

          <article className="panel notifications-panel">
            <div className="panel-title">
              <h2>Teams nudges</h2>
              <span>{bootstrap?.notifications.length ?? 0} queued</span>
            </div>
            <div className="notification-list">
              {(bootstrap?.notifications ?? []).slice(0, 3).map((item) => (
                <div key={item.id} className="notification-item">
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="panel behaviors">
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
