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
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";

  useEffect(() => {
    let cancelled = false;

    async function loadBootstrap() {
      const response = await fetch(`${apiBaseUrl}/api/bootstrap`);
      const data = (await response.json()) as BootstrapResponse;

      if (!cancelled) {
        setBootstrap(data);
      }
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
        if (!cancelled) {
          setTeamsStatus("browser");
        }
      }
    }

    void initTeams();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshBootstrap() {
    const response = await fetch(`${apiBaseUrl}/api/bootstrap`);
    const data = (await response.json()) as BootstrapResponse;
    setBootstrap(data);
  }

  async function completeModule(id: string) {
    setBusyAction(`module:${id}`);
    try {
      const response = await fetch(`${apiBaseUrl}/api/modules/${id}/complete`, {
        method: "POST"
      });
      const data = (await response.json()) as { bootstrap: BootstrapResponse };
      setBootstrap(data.bootstrap);
      setStatusMessage("Learning completion recorded.");
    } finally {
      setBusyAction(null);
    }
  }

  async function submitChallenge(id: string) {
    setBusyAction(`challenge:${id}`);
    try {
      const response = await fetch(`${apiBaseUrl}/api/challenges/${id}/submit`, {
        method: "POST"
      });
      const data = (await response.json()) as { bootstrap: BootstrapResponse };
      setBootstrap(data.bootstrap);
      setStatusMessage("Challenge submission recorded.");
    } finally {
      setBusyAction(null);
    }
  }

  async function submitRecognition() {
    setBusyAction("recognition");
    try {
      const response = await fetch(`${apiBaseUrl}/api/recognitions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          employee: bootstrap?.currentUser.name ?? "Narin",
          target: "Patcharaporn K.",
          behavior: bootstrap?.behaviors[0]?.name ?? "Customer First",
          message: "Thank you for coordinating the floor handover and helping the team recover quickly."
        })
      });
      const data = (await response.json()) as { bootstrap: BootstrapResponse };
      setBootstrap(data.bootstrap);
      setStatusMessage("Recognition submitted for approval.");
    } finally {
      setBusyAction(null);
    }
  }

  const nextModule = bootstrap?.modules.find((item) => item.status === "assigned") ?? bootstrap?.modules[0];
  const nextChallenge = bootstrap?.dailyDrop;
  const leadingTeam = bootstrap?.leaderboard[0];

  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="brand">CP</div>
        <nav>
          {["Home", "Learning", "Daily Drop", "Recognition", "Passport", "Profile"].map((item) => (
            <button key={item} className={item === "Home" ? "nav-item active" : "nav-item"}>
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Central Pattana Engage</p>
            <h1>Teams-first culture rollout with daily action, score, and momentum.</h1>
            <p className="subtle">
              This POC combines private Teams experiences, bot-style daily drops, personal
              passports, and recognition workflows without losing the option to publish into public
              community spaces.
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
                {busyAction ? "Working..." : "Refresh state"}
              </button>
            </div>
            {statusMessage ? <p className="status-note">{statusMessage}</p> : null}
          </div>
          <div className="hero-stat">
            <span>{bootstrap?.passport.score ?? "--"}</span>
            <small>Passport score</small>
            <strong>{bootstrap?.persona.title ?? "Persona loading"}</strong>
          </div>
        </header>

        <section className="grid">
          <article className="panel daily-drop-panel">
            <div className="panel-title">
              <h2>{bootstrap?.dailyDrop.title ?? "Daily Drop Challenge"}</h2>
              <span>{bootstrap?.dailyDrop.timeLimit ?? "30 sec"}</span>
            </div>
            <div className="challenge-badges">
              <span className="mini-pill">{bootstrap?.dailyDrop.behavior ?? "Behavior"}</span>
              <span className="mini-pill reward">{bootstrap?.dailyDrop.rewardLabel ?? "Reward"}</span>
            </div>
            <h3>{bootstrap?.dailyDrop.question ?? "Loading challenge..."}</h3>
            <div className="option-list">
              {(bootstrap?.dailyDrop.options ?? []).map((option) => (
                <div key={option.id} className="option-item">
                  <span className="option-marker" />
                  <p>{option.label}</p>
                </div>
              ))}
            </div>
            <div className="action-row">
              <button
                className="cta"
                disabled={!nextChallenge || busyAction === `challenge:${nextChallenge.id}`}
                onClick={() => nextChallenge && void submitChallenge(nextChallenge.id)}
              >
                {nextChallenge?.status === "completed"
                  ? "Already completed"
                  : busyAction === `challenge:${nextChallenge?.id}`
                    ? "Submitting..."
                    : "Complete today's challenge"}
              </button>
              <span className="mini-state">{nextChallenge?.status ?? "pending"}</span>
            </div>
          </article>

          <article className="panel passport-panel">
            <div className="panel-title">
              <h2>SIAM progress passport</h2>
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

          <article className="panel module-panel">
            <div className="panel-title">
              <h2>Next module</h2>
              <span>{nextModule?.duration ?? "Loading"}</span>
            </div>
            <strong>{nextModule?.title ?? "Loading module..."}</strong>
            <p>{nextModule?.summary ?? "Fetching assigned learning journey."}</p>
            <div className="action-row">
              <button
                className="secondary-cta"
                disabled={!nextModule || busyAction === `module:${nextModule.id}`}
                onClick={() => nextModule && void completeModule(nextModule.id)}
              >
                {nextModule?.status === "completed"
                  ? "Already completed"
                  : busyAction === `module:${nextModule?.id}`
                    ? "Saving..."
                    : "Mark complete"}
              </button>
            </div>
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
            </div>
            <div className="action-row">
              <button className="cta" onClick={() => void refreshBootstrap()}>
                {bootstrap?.capstone.unlocked ? "View capstone brief" : "Locked"}
              </button>
            </div>
          </article>

          <article className="panel recognition-panel">
            <div className="panel-title">
              <h2>Recognition</h2>
              <span>{bootstrap?.recognitionQueue.length ?? 0} pending approvals</span>
            </div>
            <h3>Send a moment capture</h3>
            <p>
              Submit a sample peer recognition into the moderation queue, then surface it in the
              public community feed.
            </p>
            <div className="action-row">
              <button
                className="secondary-cta"
                disabled={busyAction === "recognition"}
                onClick={() => void submitRecognition()}
              >
                {busyAction === "recognition" ? "Submitting..." : "Send recognition"}
              </button>
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

          <article className="panel behaviors">
            <div className="panel-title">
              <h2>Four behaviors</h2>
              <span>Core campaign frame • leader this week: {leadingTeam?.name ?? "Loading"}</span>
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
