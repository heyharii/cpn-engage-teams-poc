import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { app as teamsApp } from "@microsoft/teams-js";
import { useEffect, useState } from "react";
export function App() {
    const [host, setHost] = useState("Browser preview");
    const [bootstrap, setBootstrap] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";
    async function loadBootstrap(cancelled = false) {
        const response = await fetch(`${apiBaseUrl}/api/bootstrap`);
        const data = (await response.json());
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
            }
            catch {
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
        }
        finally {
            setRefreshing(false);
        }
    }
    return (_jsxs("main", { className: "feed-shell", children: [_jsxs("header", { className: "feed-header", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Community Feed" }), _jsx("h1", { children: "Public recognition, announcements, and the weekly leaderboard." }), _jsx("p", { className: "subtle", children: "The company-wide social surface for the four Beliefs. Recognitions are moderated in the Admin Console before they appear here, where everyone can react and comment." })] }), _jsxs("div", { className: "header-actions", children: [_jsx("span", { className: "host-badge", children: host }), _jsx("button", { className: "refresh-button", onClick: () => void refreshFeed(), children: refreshing ? "Refreshing..." : "Refresh feed" })] })] }), _jsxs("section", { className: "feed-layout", children: [_jsxs("aside", { className: "sidebar panel", children: [_jsx("h2", { children: "Weekly leaders" }), _jsx("ol", { className: "leaderboard", children: (bootstrap?.leaderboard ?? []).map((entry) => (_jsxs("li", { children: [_jsx("strong", { children: entry.name }), _jsxs("span", { children: [entry.points, " pts"] })] }, entry.name))) }), _jsxs("div", { className: "leader-callout", children: [_jsx("strong", { children: bootstrap?.leaderboard[0]?.name ?? "Loading leader" }), _jsx("p", { children: "Currently leading the company-wide momentum board." })] })] }), _jsx("section", { className: "timeline", children: (bootstrap?.feed ?? []).map((item) => (_jsxs("article", { className: "post panel", children: [_jsx("div", { className: `post-type post-type--${item.kind}`, children: item.kind }), _jsx("h3", { children: item.title }), _jsx("p", { children: item.summary }), _jsxs("div", { className: "post-meta", children: [_jsx("span", { children: "\uD83D\uDCAC Comments ready" }), _jsx("span", { children: "\uD83D\uDC4D Reactions ready" }), _jsx("span", { children: "\uD83E\uDD16 Bot amplification" })] })] }, item.id))) }), _jsxs("aside", { className: "spotlight panel", children: [_jsx("h2", { children: "Spotlight" }), _jsx("strong", { children: bootstrap?.spotlight.title ?? "Preparing spotlight..." }), _jsx("p", { children: bootstrap?.spotlight.summary ?? "Loading public announcement preview." })] })] })] }));
}
