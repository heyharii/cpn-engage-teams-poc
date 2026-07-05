import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { app as teamsApp, authentication } from "@microsoft/teams-js";
import { useEffect, useMemo, useState } from "react";
const REACTIONS = ["👍", "🎉", "❤️", "👏", "🔥"];
function timeAgo(iso) {
    if (!iso)
        return "";
    const then = new Date(iso).getTime();
    if (Number.isNaN(then))
        return "";
    const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
    if (mins < 1)
        return "just now";
    if (mins < 60)
        return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24)
        return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
}
function initials(name) {
    if (!name)
        return "??";
    return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}
export function App() {
    const [bootstrap, setBootstrap] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [view, setView] = useState("recognitions");
    const [token, setToken] = useState(null);
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";
    async function loadBootstrap() {
        const response = await fetch(`${apiBaseUrl}/api/bootstrap`);
        setBootstrap((await response.json()));
    }
    useEffect(() => {
        let cancelled = false;
        async function init() {
            try {
                await teamsApp.initialize();
                // Silent SSO token — needed only to WRITE (react); reading stays open.
                try {
                    const t = await authentication.getAuthToken();
                    if (!cancelled)
                        setToken(t);
                }
                catch {
                    /* not in Teams / consent missing — reactions disabled */
                }
            }
            catch {
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
        }
        finally {
            setRefreshing(false);
        }
    }
    async function react(feedId, emoji) {
        if (!token)
            return;
        const res = await fetch(`${apiBaseUrl}/api/feed/${encodeURIComponent(feedId)}/react`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ emoji })
        });
        if (!res.ok)
            return;
        const data = (await res.json());
        setBootstrap((prev) => prev
            ? { ...prev, feed: prev.feed.map((f) => (f.id === feedId ? { ...f, reactions: data.reactions } : f)) }
            : prev);
    }
    const recognitions = useMemo(() => (bootstrap?.feed ?? []).filter((f) => f.kind !== "leaderboard"), [bootstrap]);
    const leaderboard = bootstrap?.leaderboard ?? [];
    return (_jsxs("main", { className: "feed-shell", children: [_jsxs("header", { className: "feed-header", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Community Feed" }), _jsx("h1", { children: "Recognition & the four Beliefs, shared with everyone." })] }), _jsx("button", { className: "refresh-button", onClick: () => void refreshFeed(), children: refreshing ? "Refreshing…" : "Refresh" })] }), _jsxs("div", { className: "feed-toggle", role: "tablist", children: [_jsx("button", { className: `feed-toggle-btn${view === "recognitions" ? " active" : ""}`, onClick: () => setView("recognitions"), children: "\uD83C\uDF89 Recognitions" }), _jsx("button", { className: `feed-toggle-btn${view === "leaderboard" ? " active" : ""}`, onClick: () => setView("leaderboard"), children: "\uD83C\uDFC6 Leaderboard" })] }), view === "recognitions" ? (_jsx("section", { className: "feed-single", children: recognitions.length === 0 ? (_jsx("p", { className: "subtle", children: "No recognitions yet \u2014 send one from the Chat tab." })) : (recognitions.map((item) => (_jsx(RecognitionPost, { item: item, canReact: Boolean(token), onReact: react }, item.id)))) })) : (_jsx("section", { className: "feed-single", children: _jsxs("div", { className: "leaderboard-full panel", children: [_jsx("h2", { children: "Weekly leaders" }), _jsx("ol", { className: "leaderboard-ranked", children: leaderboard.map((entry, i) => (_jsxs("li", { children: [_jsx("span", { className: `rank rank-${i + 1}`, children: i + 1 }), _jsx("span", { className: "rank-avatar", children: initials(entry.name) }), _jsx("span", { className: "rank-name", children: entry.name }), _jsxs("span", { className: "rank-points", children: [entry.points, " pts"] })] }, entry.name))) })] }) }))] }));
}
function RecognitionPost(props) {
    const { item, canReact, onReact } = props;
    const isRecognition = item.kind === "recognition";
    return (_jsxs("article", { className: "post panel", children: [_jsxs("div", { className: "post-head", children: [_jsx("span", { className: "post-avatar", children: initials(item.author ?? item.title) }), _jsxs("div", { className: "post-headtext", children: [_jsx("strong", { children: isRecognition ? (_jsxs(_Fragment, { children: [item.author, " ", _jsx("span", { className: "muted", children: "recognised" }), " ", item.target] })) : (item.title) }), _jsxs("span", { className: "post-sub", children: [item.belief ? _jsx("span", { className: "belief-chip", children: item.belief }) : null, item.createdAt ? _jsx("span", { className: "post-time", children: timeAgo(item.createdAt) }) : null] })] })] }), _jsx("p", { className: "post-body", children: item.message ?? item.summary }), _jsx("div", { className: "post-reactions", children: REACTIONS.map((emoji) => {
                    const count = item.reactions?.find((r) => r.emoji === emoji)?.count ?? 0;
                    return (_jsxs("button", { className: `reaction${count > 0 ? " has" : ""}`, disabled: !canReact, title: canReact ? "React" : "Open in Teams to react", onClick: () => onReact(item.id, emoji), children: [emoji, count > 0 ? _jsx("span", { className: "reaction-count", children: count }) : null] }, emoji));
                }) })] }));
}
