import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { app as teamsApp } from "@microsoft/teams-js";
export function App() {
    const [bootstrap, setBootstrap] = useState(null);
    const [teamsState, setTeamsState] = useState(null);
    const [teamsStatus, setTeamsStatus] = useState("checking");
    const [refreshing, setRefreshing] = useState(false);
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";
    useEffect(() => {
        let cancelled = false;
        async function loadBootstrap() {
            const response = await fetch(`${apiBaseUrl}/api/bootstrap`);
            const data = (await response.json());
            if (!cancelled)
                setBootstrap(data);
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
            }
            catch {
                if (!cancelled)
                    setTeamsStatus("browser");
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
            const data = (await response.json());
            setBootstrap(data);
        }
        finally {
            setRefreshing(false);
        }
    }
    const nextModule = bootstrap?.modules.find((item) => item.status === "assigned") ?? bootstrap?.modules[0];
    const leadingName = bootstrap?.leaderboard[0]?.name;
    const myName = bootstrap?.currentUser.name;
    const myRank = bootstrap?.leaderboard.findIndex((e) => e.name === myName);
    return (_jsxs("div", { className: "app-shell", children: [_jsxs("aside", { className: "rail", children: [_jsx("div", { className: "brand", children: "CP" }), _jsx("nav", { children: ["Overview", "Learning", "Passport", "Profile"].map((item) => (_jsx("button", { className: item === "Overview" ? "nav-item active" : "nav-item", children: item }, item))) })] }), _jsxs("main", { className: "main", children: [_jsxs("header", { className: "hero", children: [_jsxs("div", { className: "hero-copy", children: [_jsx("p", { className: "eyebrow", children: "Central Pattana Engage" }), _jsx("h1", { children: "Your culture journey, at a glance." }), _jsxs("p", { className: "subtle", children: ["This is your personal progress dashboard. The daily drop, quizzes, and recognition all happen in the ", _jsx("strong", { children: "Chat" }), " tab with the CPN Engage bot \u2014 this view shows how far you've come."] }), bootstrap ? (_jsxs("p", { className: "subtle", children: ["Signed in as ", bootstrap.currentUser.name, " from ", bootstrap.currentUser.businessUnit, "."] })) : null, _jsxs("div", { className: "runtime-badges", children: [_jsx("span", { className: "runtime-badge", children: teamsStatus === "teams" ? "Teams host detected" : "Browser preview mode" }), teamsState ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "runtime-badge muted", children: teamsState.host }), _jsx("span", { className: "runtime-badge muted", children: teamsState.frame })] })) : null] }), _jsx("div", { className: "hero-actions", children: _jsx("button", { onClick: () => void refreshBootstrap(), children: refreshing ? "Refreshing…" : "Refresh" }) })] }), _jsxs("div", { className: "hero-stat", children: [_jsx("span", { children: bootstrap?.passport.score ?? "--" }), _jsx("small", { children: "Passport score" }), _jsx("strong", { children: bootstrap?.persona.title ?? "Persona loading" })] })] }), _jsxs("section", { className: "bot-pointer", children: [_jsx("div", { className: "bot-pointer-icon", children: "\uD83D\uDCAC" }), _jsxs("div", { children: [_jsx("strong", { children: "Today's drop is waiting in Chat" }), _jsx("p", { children: bootstrap?.dailyDrop.status === "completed"
                                            ? "Nice — you've completed today's daily drop. Come back tomorrow for the next one."
                                            : `“${bootstrap?.dailyDrop.question ?? "Loading today's scenario…"}” — open the Chat tab and message the bot “daily drop” to play.` })] }), _jsx("span", { className: bootstrap?.dailyDrop.status === "completed" ? "pointer-state done" : "pointer-state", children: bootstrap?.dailyDrop.status ?? "pending" })] }), _jsxs("section", { className: "grid", children: [_jsxs("article", { className: "panel passport-panel", children: [_jsxs("div", { className: "panel-title", children: [_jsx("h2", { children: "Progress passport" }), _jsxs("span", { children: [bootstrap?.passport.score ?? 0, " pts"] })] }), _jsxs("div", { className: "passport-score-row", children: [_jsxs("div", { children: [_jsxs("strong", { className: "passport-score", children: [bootstrap?.stats.progress ?? "--", "%"] }), _jsx("small", { children: "Completion" })] }), _jsxs("div", { children: [_jsxs("strong", { className: "passport-score", children: [bootstrap?.passport.modulesCompleted ?? "--", "/", bootstrap?.passport.modulesTotal ?? "--"] }), _jsx("small", { children: "Modules" })] }), _jsxs("div", { children: [_jsx("strong", { className: "passport-score", children: bootstrap?.passport.badges ?? "--" }), _jsx("small", { children: "Badges" })] })] }), _jsx("div", { className: "passport-values", children: (bootstrap?.passport.valuesProgress ?? []).map((item) => (_jsxs("div", { className: "passport-value", children: [_jsxs("div", { children: [_jsx("strong", { children: item.name }), _jsxs("small", { children: [item.points, " pts"] })] }), _jsx("span", { className: item.status === "completed" ? "state-tag done" : "state-tag", children: item.status })] }, item.name))) })] }), _jsxs("article", { className: "panel streak-panel", children: [_jsxs("div", { className: "panel-title", children: [_jsx("h2", { children: "Current streak" }), _jsxs("span", { children: ["Best ", bootstrap?.streakSummary.best ?? "--", " days"] })] }), _jsxs("strong", { className: "big-number", children: [bootstrap?.streakSummary.current ?? "--", " days"] }), _jsxs("p", { children: ["Next milestone: ", bootstrap?.streakSummary.nextMilestone ?? "--", " days.", " ", bootstrap?.streakSummary.daysLeft ?? "--", " day(s) left for", " ", bootstrap?.streakSummary.reward ?? "reward", "."] })] }), _jsxs("article", { className: "panel rank-panel", children: [_jsxs("div", { className: "panel-title", children: [_jsx("h2", { children: "Leaderboard standing" }), _jsx("span", { children: "This week" })] }), _jsx("strong", { className: "big-number", children: myRank != null && myRank >= 0 ? `#${myRank + 1}` : "—" }), _jsx("p", { children: leadingName ? _jsxs(_Fragment, { children: ["Leader this week: ", _jsx("strong", { children: leadingName }), "."] }) : "Climb the weekly board." })] }), _jsxs("article", { className: "panel module-panel", children: [_jsxs("div", { className: "panel-title", children: [_jsx("h2", { children: "Next module" }), _jsx("span", { children: nextModule?.duration ?? "Loading" })] }), _jsx("strong", { children: nextModule?.title ?? "Loading module…" }), _jsx("p", { children: nextModule?.summary ?? "Fetching assigned learning journey." }), _jsx("p", { className: "chat-hint", children: "\u25B6 Start it from the Chat tab" })] }), _jsxs("article", { className: "panel capstone-panel", children: [_jsxs("div", { className: "panel-title", children: [_jsx("h2", { children: "Capstone" }), _jsx("span", { children: bootstrap?.capstone.difficulty ?? "Extreme" })] }), _jsx("strong", { children: bootstrap?.capstone.title ?? "Capstone Challenge" }), _jsx("p", { children: bootstrap?.capstone.summary ?? "Preparing final-week scenario." }), _jsxs("div", { className: "capstone-meta", children: [_jsx("span", { children: bootstrap?.capstone.timeLimit ?? "05:00" }), _jsx("span", { children: bootstrap?.capstone.reward ?? "Reward" }), _jsx("span", { className: bootstrap?.capstone.unlocked ? "state-tag done" : "state-tag", children: bootstrap?.capstone.unlocked ? "unlocked" : "locked" })] })] }), _jsxs("article", { className: "panel persona-panel", children: [_jsxs("div", { className: "panel-title", children: [_jsx("h2", { children: "Work persona" }), _jsxs("span", { children: ["Level ", bootstrap?.persona.level ?? "--"] })] }), _jsx("strong", { children: bootstrap?.persona.title ?? "Persona loading" }), _jsxs("p", { children: [bootstrap?.persona.points ?? "--", " total points accumulated across the journey."] }), _jsx("div", { className: "trait-list", children: (bootstrap?.persona.traits ?? []).map((trait) => (_jsx("span", { className: "trait-pill", children: trait }, trait))) })] }), _jsxs("article", { className: "panel passport-entries-panel", children: [_jsxs("div", { className: "panel-title", children: [_jsx("h2", { children: "Recent passport entries" }), _jsx("span", { children: "Live record" })] }), _jsx("div", { className: "entry-list", children: (bootstrap?.passport.recentEntries ?? []).map((entry) => (_jsxs("div", { className: "entry-item", children: [_jsxs("div", { children: [_jsx("strong", { children: entry.title }), _jsxs("p", { children: [entry.behavior, " \u2022 ", entry.date] })] }), _jsxs("span", { className: "entry-points", children: ["+", entry.points] })] }, entry.id))) })] }), _jsxs("article", { className: "panel notifications-panel", children: [_jsxs("div", { className: "panel-title", children: [_jsx("h2", { children: "Teams nudges" }), _jsxs("span", { children: [bootstrap?.notifications.length ?? 0, " queued"] })] }), _jsx("div", { className: "notification-list", children: (bootstrap?.notifications ?? []).slice(0, 3).map((item) => (_jsxs("div", { className: "notification-item", children: [_jsx("strong", { children: item.title }), _jsx("p", { children: item.summary })] }, item.id))) })] }), _jsxs("article", { className: "panel behaviors", children: [_jsxs("div", { className: "panel-title", children: [_jsx("h2", { children: "The four behaviours" }), _jsx("span", { children: "CPN's Beliefs by 4 Desired Behaviors" })] }), _jsx("div", { className: "behavior-list", children: (bootstrap?.behaviors ?? []).map((behavior) => (_jsxs("div", { className: "behavior-chip", children: [_jsx("strong", { children: behavior.name }), _jsx("small", { children: behavior.tagline })] }, behavior.name))) })] })] })] })] }));
}
