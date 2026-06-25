import { type BootstrapResponse } from "@cpn-engage/shared";
import { app as teamsApp } from "@microsoft/teams-js";
import { useEffect, useState } from "react";

export function App() {
  const [host, setHost] = useState("Browser preview");
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";

  async function loadBootstrap(cancelled = false) {
    const response = await fetch(`${apiBaseUrl}/api/bootstrap`);
    const data = (await response.json()) as BootstrapResponse;

    if (!cancelled) {
      setBootstrap(data);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function initTeams() {
      try {
        await teamsApp.initialize();
        const context = await teamsApp.getContext();
        if (!cancelled) {
          setHost(`Hosted in ${context.app.host.name}`);
        }
      } catch {
        if (!cancelled) {
          setHost("Browser preview");
        }
      }
    }

    void initTeams();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadBootstrap(cancelled);

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  async function refreshFeed() {
    setRefreshing(true);
    try {
      await loadBootstrap();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <main className="feed-shell">
      <header className="feed-header">
        <div>
          <p className="eyebrow">Community Feed</p>
          <h1>Public recognition, announcements, and the weekly leaderboard.</h1>
          <p className="subtle">
            The company-wide social surface for the four Beliefs. Recognitions are moderated in the
            Admin Console before they appear here, where everyone can react and comment.
          </p>
        </div>
        <div className="header-actions">
          <span className="host-badge">{host}</span>
          <button className="refresh-button" onClick={() => void refreshFeed()}>
            {refreshing ? "Refreshing..." : "Refresh feed"}
          </button>
        </div>
      </header>

      <section className="feed-layout">
        <aside className="sidebar panel">
          <h2>Weekly leaders</h2>
          <ol className="leaderboard">
            {(bootstrap?.leaderboard ?? []).map((entry) => (
              <li key={entry.name}>
                <strong>{entry.name}</strong>
                <span>{entry.points} pts</span>
              </li>
            ))}
          </ol>
          <div className="leader-callout">
            <strong>{bootstrap?.leaderboard[0]?.name ?? "Loading leader"}</strong>
            <p>Currently leading the company-wide momentum board.</p>
          </div>
        </aside>

        <section className="timeline">
          {(bootstrap?.feed ?? []).map((item) => (
            <article className="post panel" key={item.id}>
              <div className={`post-type post-type--${item.kind}`}>{item.kind}</div>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <div className="post-meta">
                <span>💬 Comments ready</span>
                <span>👍 Reactions ready</span>
                <span>🤖 Bot amplification</span>
              </div>
            </article>
          ))}
        </section>

        <aside className="spotlight panel">
          <h2>Spotlight</h2>
          <strong>{bootstrap?.spotlight.title ?? "Preparing spotlight..."}</strong>
          <p>{bootstrap?.spotlight.summary ?? "Loading public announcement preview."}</p>
        </aside>
      </section>
    </main>
  );
}
