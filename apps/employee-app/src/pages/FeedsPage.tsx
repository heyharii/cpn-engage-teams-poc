import { type BootstrapResponse, type FeedItem } from "@cpn-engage/shared";
import { app as teamsApp, authentication } from "@microsoft/teams-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, Send, MessageCircle, Loader2 } from "lucide-react";
import { guestId } from "@/lib/identity";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const REACTIONS = ["👍", "🎉", "❤️", "👏", "🔥"];
const BELIEFS = ["Dynamism", "Customers", "Communities", "Collaboration"];
type View = "recognitions" | "leaderboard";
type FeedRow = FeedItem & { commentCount?: number };

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

const API = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";

export function FeedsPage() {
  const [posts, setPosts] = useState<FeedRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [leaders, setLeaders] = useState<{ name: string; points: number; department?: string }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<View>("recognitions");
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<{ name: string | null } | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  /** Identity headers: SSO token if we have one, else the stable guest id. */
  const authHeaders = useCallback(
    (extra?: Record<string, string>): Record<string, string> => {
      const h: Record<string, string> = { ...extra };
      if (token) h.Authorization = `Bearer ${token}`;
      else h["x-cpn-guest"] = guestId();
      return h;
    },
    [token]
  );

  const loadFirst = useCallback(async () => {
    setLoading(true);
    const [feedRes, lb] = await Promise.all([
      fetch(`${API}/api/feed/page?limit=15`).then((r) => r.json()),
      fetch(`${API}/api/leaderboard`).then((r) => r.json()).catch(() => [])
    ]);
    setPosts(feedRes.items ?? []);
    setCursor(feedRes.nextCursor ?? null);
    setLeaders(Array.isArray(lb) ? lb : []);
    setLoading(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`${API}/api/feed/page?limit=15&before=${encodeURIComponent(cursor)}`).then((r) =>
        r.json()
      );
      setPosts((prev) => [...prev, ...(res.items ?? [])]);
      setCursor(res.nextCursor ?? null);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await teamsApp.initialize();
        try {
          const t = await authentication.getAuthToken();
          if (!cancelled) setToken(t);
        } catch {
          /* guest */
        }
      } catch {
        /* browser */
      }
    }
    void init();
    void loadFirst();
    return () => {
      cancelled = true;
    };
  }, [loadFirst]);

  // Resolve who "me" is (for the composer avatar/label).
  useEffect(() => {
    void fetch(`${API}/api/me`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMe({ name: d.me?.profile?.name ?? null }))
      .catch(() => {});
  }, [authHeaders]);

  // Infinite scroll: load more when the sentinel enters view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore();
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  async function refreshFeed() {
    setRefreshing(true);
    try {
      await loadFirst();
    } finally {
      setRefreshing(false);
    }
  }

  async function react(feedId: string, emoji: string) {
    const res = await fetch(`${API}/api/feed/${encodeURIComponent(feedId)}/react`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ emoji, reactor: guestId() })
    });
    if (!res.ok) return;
    const data = (await res.json()) as { reactions: { emoji: string; count: number }[] };
    setPosts((prev) => prev.map((f) => (f.id === feedId ? { ...f, reactions: data.reactions } : f)));
  }

  async function submitPost(target: string, belief: string, message: string): Promise<boolean> {
    const res = await fetch(`${API}/api/feed/compose`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ target, belief, message })
    });
    if (!res.ok) return false;
    await loadFirst();
    return true;
  }

  const leaderboard = leaders;

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

      <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-border bg-card p-1">
        {(["recognitions", "leaderboard"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "rounded-md py-2 text-sm font-medium transition-colors",
              view === v ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {v === "recognitions" ? "🎉 Recognitions" : "🏆 Leaderboard"}
          </button>
        ))}
      </div>

      {view === "recognitions" ? (
        <section className="flex flex-col gap-3">
          <Composer meName={me?.name ?? null} onSubmit={submitPost} />

          {loading ? (
            <>
              <PostSkeleton />
              <PostSkeleton />
            </>
          ) : posts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No recognitions yet — be the first with the box above.
            </p>
          ) : (
            posts.map((item) => (
              <RecognitionPost key={item.id} item={item} onReact={react} authHeaders={authHeaders} />
            ))
          )}

          {/* Infinite-scroll sentinel */}
          <div ref={sentinel} className="h-6" />
          {loadingMore ? (
            <p className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </p>
          ) : null}
          {!cursor && posts.length > 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">You're all caught up.</p>
          ) : null}
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
                    <span className={cn("w-6 text-center text-sm font-bold", i === 0 ? "text-primary" : "text-muted-foreground")}>
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
              {leaderboard.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No standings yet.</p>
              ) : null}
            </ol>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

/* ---------- Composer ---------- */
function Composer(props: {
  meName: string | null;
  onSubmit: (target: string, belief: string, message: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [belief, setBelief] = useState(BELIEFS[1]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!target.trim() || !message.trim()) {
      setErr("Add who you're recognising and a message.");
      return;
    }
    setBusy(true);
    setErr(null);
    const ok = await props.onSubmit(target.trim(), belief, message.trim());
    setBusy(false);
    if (ok) {
      setTarget("");
      setMessage("");
      setOpen(false);
    } else {
      setErr("Couldn't post. Try again.");
    }
  }

  return (
    <Card>
      <CardContent>
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="flex w-full items-center gap-3 text-left"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
              {initials(props.meName ?? "You")}
            </span>
            <span className="flex-1 rounded-full border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
              Recognise a colleague…
            </span>
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Who are you recognising? (name)"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-primary"
              autoFocus
            />
            <div className="flex flex-wrap gap-1.5">
              {BELIEFS.map((b) => (
                <button
                  key={b}
                  onClick={() => setBelief(b)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    belief === b ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`How did they live ${belief}?`}
              rows={3}
              className="resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {err ? <p className="text-xs text-destructive">{err}</p> : null}
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void submit()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Post recognition
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Post ---------- */
type Burst = { id: number; emoji: string };
type Comment = { id: string; author: string | null; body: string; createdAt: string };

function RecognitionPost(props: {
  item: FeedRow;
  onReact: (id: string, emoji: string) => void;
  authHeaders: (extra?: Record<string, string>) => Record<string, string>;
}) {
  const { item, onReact, authHeaders } = props;
  const isRecognition = item.kind === "recognition";
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [burstSeed, setBurstSeed] = useState(0);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [commentCount, setCommentCount] = useState(item.commentCount ?? 0);
  const [posting, setPosting] = useState(false);

  const totalReactions = (item.reactions ?? []).reduce((s, r) => s + r.count, 0);
  const topEmojis = [...(item.reactions ?? [])].sort((a, b) => b.count - a.count).slice(0, 3).map((r) => r.emoji);

  function handleReact(emoji: string) {
    const id = burstSeed + 1;
    setBurstSeed(id);
    setBursts((b) => [...b, { id, emoji }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 900);
    onReact(item.id, emoji);
  }

  async function toggleComments() {
    const next = !showComments;
    setShowComments(next);
    if (next && comments === null) {
      const res = await fetch(`${API}/api/feed/${encodeURIComponent(item.id)}/comments`).then((r) => r.json());
      setComments(res.comments ?? []);
    }
  }

  async function submitComment() {
    const body = commentBody.trim();
    if (!body) return;
    setPosting(true);
    try {
      const res = await fetch(`${API}/api/feed/${encodeURIComponent(item.id)}/comments`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ body })
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...(prev ?? []), data.comment]);
        setCommentCount((c) => c + 1);
        setCommentBody("");
      }
    } finally {
      setPosting(false);
    }
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
                  {item.author} <span className="font-normal text-muted-foreground">recognised</span> {item.target}
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
              {item.createdAt ? <span className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span> : null}
            </span>
          </div>
        </div>

        <p className="text-sm leading-relaxed">{item.message ?? item.summary}</p>

        {/* Reaction + comment summary line */}
        {(totalReactions > 0 || commentCount > 0) && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{totalReactions > 0 ? `${topEmojis.join("")} ${totalReactions}` : ""}</span>
            <button onClick={() => void toggleComments()} className="hover:text-foreground">
              {commentCount > 0 ? `${commentCount} comment${commentCount > 1 ? "s" : ""}` : ""}
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 border-t border-border pt-3">
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
                    >
                      {count}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
                <AnimatePresence>
                  {bursts.filter((b) => b.emoji === emoji).map((b) => (
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
          <button
            onClick={() => void toggleComments()}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <MessageCircle className="size-3.5" /> Comment
          </button>
        </div>

        {/* Comments */}
        {showComments ? (
          <div className="flex flex-col gap-3 border-t border-border pt-3">
            {comments === null ? (
              <p className="text-xs text-muted-foreground">Loading comments…</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No comments yet — say something kind.</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                    {initials(c.author ?? "?")}
                  </span>
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-xs font-semibold">{c.author ?? "Someone"}</p>
                    <p className="text-sm">{c.body}</p>
                  </div>
                </div>
              ))
            )}
            <div className="flex items-center gap-2">
              <input
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void submitComment()}
                placeholder="Write a comment…"
                className="h-9 flex-1 rounded-full border border-input bg-transparent px-4 text-sm outline-none focus:border-primary"
              />
              <Button size="icon" variant="ghost" disabled={posting || !commentBody.trim()} onClick={() => void submitComment()}>
                {posting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PostSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  );
}
