import { type BootstrapResponse, type FeedItem } from "@cpn-engage/shared";
import { app as teamsApp, authentication } from "@microsoft/teams-js";
import { useEffect, useMemo, useState } from "react";

const REACTIONS = ["👍", "🎉", "❤️", "👏", "🔥"];
type View = "recognitions" | "leaderboard";

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function initials(name?: string): string {
  if (!name) return "??";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [leaders, setLeaders] = useState<{ name: string; points: number; department?: string }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<View>("recognitions");
  const [token, setToken] = useState<string | null>(null);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";

  async function loadBootstrap() {
    const [b, l] = await Promise.all([
      fetch(`${apiBaseUrl}/api/bootstrap`).then((r) => r.json() as Promise<BootstrapResponse>),
      fetch(`${apiBaseUrl}/api/leaderboard`).then((r) => r.json()).catch(() => [])
    ]);
    setBootstrap(b);
    setLeaders(Array.isArray(l) ? l : []);
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await teamsApp.initialize();
        // Silent SSO token — needed only to WRITE (react); reading stays open.
        try {
          const t = await authentication.getAuthToken();
          if (!cancelled) setToken(t);
        } catch {
          /* not in Teams / consent missing — reactions disabled */
        }
      } catch {
        /* browser preview */
      }
    }
    void init();
    void loadBootstrap();
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

  async function react(feedId: string, emoji: string) {
    if (!token) return;
    const res = await fetch(`${apiBaseUrl}/api/feed/${encodeURIComponent(feedId)}/react`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ emoji })
    });
    if (!res.ok) return;
    const data = (await res.json()) as { reactions: { emoji: string; count: number }[] };
    setBootstrap((prev) =>
      prev
        ? { ...prev, feed: prev.feed.map((f) => (f.id === feedId ? { ...f, reactions: data.reactions } : f)) }
        : prev
    );
  }

  const recognitions = useMemo(
    () => (bootstrap?.feed ?? []).filter((f) => f.kind !== "leaderboard"),
    [bootstrap]
  );
  const leaderboard = leaders.length > 0 ? leaders : bootstrap?.leaderboard ?? [];

  return (
    <main className="feed-shell">
      <header className="feed-header">
        <div>
          <p className="eyebrow">Community Feed</p>
          <h1>Recognition &amp; the four Beliefs, shared with everyone.</h1>
        </div>
        <button className="refresh-button" onClick={() => void refreshFeed()}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {/* View toggle */}
      <div className="feed-toggle" role="tablist">
        <button
          className={`feed-toggle-btn${view === "recognitions" ? " active" : ""}`}
          onClick={() => setView("recognitions")}
        >
          🎉 Recognitions
        </button>
        <button
          className={`feed-toggle-btn${view === "leaderboard" ? " active" : ""}`}
          onClick={() => setView("leaderboard")}
        >
          🏆 Leaderboard
        </button>
      </div>

      {view === "recognitions" ? (
        <section className="feed-single">
          {recognitions.length === 0 ? (
            <p className="subtle">No recognitions yet — send one from the Chat tab.</p>
          ) : (
            recognitions.map((item) => (
              <RecognitionPost key={item.id} item={item} canReact={Boolean(token)} onReact={react} />
            ))
          )}
        </section>
      ) : (
        <section className="feed-single">
          <div className="leaderboard-full panel">
            <h2>Weekly leaders</h2>
            <ol className="leaderboard-ranked">
              {leaderboard.map((entry, i) => {
                const dept = (entry as { department?: string }).department;
                return (
                  <li key={`${entry.name}-${i}`}>
                    <span className={`rank rank-${i + 1}`}>{i + 1}</span>
                    <span className="rank-avatar">{initials(entry.name)}</span>
                    <span className="rank-name">
                      {entry.name}
                      {dept ? <small className="rank-dept">{dept}</small> : null}
                    </span>
                    <span className="rank-points">{entry.points} pts</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      )}
    </main>
  );
}

function RecognitionPost(props: {
  item: FeedItem;
  canReact: boolean;
  onReact: (id: string, emoji: string) => void;
}) {
  const { item, canReact, onReact } = props;
  const isRecognition = item.kind === "recognition";
  return (
    <article className="post panel">
      <div className="post-head">
        <span className="post-avatar">{initials(item.author ?? item.title)}</span>
        <div className="post-headtext">
          <strong>
            {isRecognition ? (
              <>
                {item.author} <span className="muted">recognised</span> {item.target}
              </>
            ) : (
              item.title
            )}
          </strong>
          <span className="post-sub">
            {item.belief ? <span className="belief-chip">{item.belief}</span> : null}
            {item.createdAt ? <span className="post-time">{timeAgo(item.createdAt)}</span> : null}
          </span>
        </div>
      </div>

      <p className="post-body">{item.message ?? item.summary}</p>

      <div className="post-reactions">
        {REACTIONS.map((emoji) => {
          const count = item.reactions?.find((r) => r.emoji === emoji)?.count ?? 0;
          return (
            <button
              key={emoji}
              className={`reaction${count > 0 ? " has" : ""}`}
              disabled={!canReact}
              title={canReact ? "React" : "Open in Teams to react"}
              onClick={() => onReact(item.id, emoji)}
            >
              {emoji}
              {count > 0 ? <span className="reaction-count">{count}</span> : null}
            </button>
          );
        })}
      </div>
    </article>
  );
}
