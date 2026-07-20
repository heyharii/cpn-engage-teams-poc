import { type BootstrapResponse, type FeedItem } from "@cpn-engage/shared";
import { app as teamsApp, authentication } from "@microsoft/teams-js";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

function localReactorId(): string {
  try {
    const k = "cpn-reactor-id";
    let v = localStorage.getItem(k);
    if (!v) {
      v = `web-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return "web-anon";
  }
}

export function FeedsPage() {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [leaders, setLeaders] = useState<{ name: string; points: number; department?: string }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<View>("recognitions");
  const [token, setToken] = useState<string | null>(null);
  const [reactorId, setReactorId] = useState<string>(localReactorId());
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
        try {
          const ctx = await teamsApp.getContext();
          if (!cancelled && ctx.user?.id) setReactorId(ctx.user.id);
        } catch {
          /* keep local reactor id */
        }
        try {
          const t = await authentication.getAuthToken();
          if (!cancelled) setToken(t);
        } catch {
          /* SSO optional for reactions */
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
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${apiBaseUrl}/api/feed/${encodeURIComponent(feedId)}/react`, {
      method: "POST",
      headers,
      body: JSON.stringify({ emoji, reactor: reactorId })
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
    <main className="mx-auto min-h-screen w-full max-w-2xl bg-background px-4 pb-16 pt-7 text-foreground">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Community Feed</p>
          <h1 className="mt-1 text-xl font-bold tracking-tight">Recognition & the four Beliefs.</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refreshFeed()}>
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
          {refreshing ? "…" : "Refresh"}
        </Button>
      </header>

      {/* View toggle */}
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-border bg-card p-1">
        {(["recognitions", "leaderboard"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "rounded-md py-2 text-sm font-medium capitalize transition-colors",
              view === v ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {v === "recognitions" ? "🎉 Recognitions" : "🏆 Leaderboard"}
          </button>
        ))}
      </div>

      {view === "recognitions" ? (
        <section className="flex flex-col gap-3">
          {recognitions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No recognitions yet — send one from the Chat tab.
            </p>
          ) : (
            recognitions.map((item) => <RecognitionPost key={item.id} item={item} onReact={react} />)
          )}
        </section>
      ) : (
        <Card>
          <CardContent>
            <h2 className="mb-4 text-base font-semibold">Weekly leaders</h2>
            <ol className="flex flex-col">
              {leaderboard.map((entry, i) => {
                const dept = (entry as { department?: string }).department;
                return (
                  <li
                    key={`${entry.name}-${i}`}
                    className="flex items-center gap-3 border-b border-border py-3 last:border-0"
                  >
                    <span
                      className={cn(
                        "w-6 text-center text-sm font-bold",
                        i === 0 ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                      {initials(entry.name)}
                    </span>
                    <span className="flex-1 text-sm font-medium">
                      {entry.name}
                      {dept ? <small className="block text-xs font-normal text-muted-foreground">{dept}</small> : null}
                    </span>
                    <span className="text-sm font-bold text-primary">{entry.points} pts</span>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

type Burst = { id: number; emoji: string };

function RecognitionPost(props: { item: FeedItem; onReact: (id: string, emoji: string) => void }) {
  const { item, onReact } = props;
  const isRecognition = item.kind === "recognition";
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [burstSeed, setBurstSeed] = useState(0);

  function handleReact(emoji: string) {
    const id = burstSeed + 1;
    setBurstSeed(id);
    setBursts((b) => [...b, { id, emoji }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 900);
    onReact(item.id, emoji);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
            {initials(item.author ?? item.title)}
          </span>
          <div className="flex flex-col gap-0.5">
            <strong className="text-sm font-semibold">
              {isRecognition ? (
                <>
                  {item.author} <span className="font-normal text-muted-foreground">recognised</span>{" "}
                  {item.target}
                </>
              ) : (
                item.title
              )}
            </strong>
            <span className="flex items-center gap-2">
              {item.belief ? (
                <Badge variant="secondary" className="h-5 px-2 text-[11px]">
                  {item.belief}
                </Badge>
              ) : null}
              {item.createdAt ? (
                <span className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
              ) : null}
            </span>
          </div>
        </div>

        <p className="text-sm leading-relaxed">{item.message ?? item.summary}</p>

        <div className="flex gap-1.5 border-t border-border pt-3">
          {REACTIONS.map((emoji) => {
            const count = item.reactions?.find((r) => r.emoji === emoji)?.count ?? 0;
            return (
              <motion.button
                key={emoji}
                type="button"
                className={cn(
                  "relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[15px] leading-none",
                  count > 0 ? "border-primary bg-accent" : "border-border bg-card"
                )}
                onClick={() => handleReact(emoji)}
                whileHover={{ scale: 1.15, y: -2 }}
                whileTap={{ scale: 0.85 }}
                transition={{ type: "spring", stiffness: 500, damping: 18 }}
              >
                <span>{emoji}</span>
                <AnimatePresence mode="popLayout">
                  {count > 0 ? (
                    <motion.span
                      key={count}
                      className="text-xs font-bold text-primary"
                      initial={{ y: 8, opacity: 0, scale: 0.6 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      exit={{ y: -8, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 600, damping: 20 }}
                    >
                      {count}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
                <AnimatePresence>
                  {bursts
                    .filter((b) => b.emoji === emoji)
                    .map((b) => (
                      <motion.span
                        key={b.id}
                        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 text-lg"
                        initial={{ y: 0, opacity: 1, scale: 1 }}
                        animate={{ y: -42, opacity: 0, scale: 1.6 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.85, ease: "easeOut" }}
                      >
                        {emoji}
                      </motion.span>
                    ))}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
