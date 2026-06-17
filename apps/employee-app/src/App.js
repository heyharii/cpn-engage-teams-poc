import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { app as teamsApp } from "@microsoft/teams-js";
export function App() {
    const [bootstrap, setBootstrap] = useState(null);
    const [teamsState, setTeamsState] = useState(null);
    const [teamsStatus, setTeamsStatus] = useState("checking");
    const [busyAction, setBusyAction] = useState(null);
    const [statusMessage, setStatusMessage] = useState(null);
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";
    useEffect(() => {
        let cancelled = false;
        async function loadBootstrap() {
            const response = await fetch(`${apiBaseUrl}/api/bootstrap`);
            const data = (await response.json());
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
            }
            catch {
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
        const data = (await response.json());
        setBootstrap(data);
    }
    async function completeModule(id) {
        setBusyAction(`module:${id}`);
        try {
            const response = await fetch(`${apiBaseUrl}/api/modules/${id}/complete`, {
                method: "POST"
            });
            const data = (await response.json());
            setBootstrap(data.bootstrap);
            setStatusMessage("Learning completion recorded.");
        }
        finally {
            setBusyAction(null);
        }
    }
    async function submitChallenge(id) {
        setBusyAction(`challenge:${id}`);
        try {
            const response = await fetch(`${apiBaseUrl}/api/challenges/${id}/submit`, {
                method: "POST"
            });
            const data = (await response.json());
            setBootstrap(data.bootstrap);
            setStatusMessage("Challenge submission recorded.");
        }
        finally {
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
            const data = (await response.json());
            setBootstrap(data.bootstrap);
            setStatusMessage("Recognition submitted for approval.");
        }
        finally {
            setBusyAction(null);
        }
    }
    const nextModule = bootstrap?.modules.find((item) => item.status === "assigned") ?? bootstrap?.modules[0];
    const nextChallenge = bootstrap?.dailyDrop;
    const leadingTeam = bootstrap?.leaderboard[0];
    return (_jsxs("div", { className: "app-shell", children: [_jsxs("aside", { className: "rail", children: [_jsx("div", { className: "brand", children: "CP" }), _jsx("nav", { children: ["Home", "Learning", "Daily Drop", "Recognition", "Passport", "Profile"].map((item) => (_jsx("button", { className: item === "Home" ? "nav-item active" : "nav-item", children: item }, item))) })] }), _jsxs("main", { className: "main", children: [_jsxs("header", { className: "hero", children: [_jsxs("div", { className: "hero-copy", children: [_jsx("p", { className: "eyebrow", children: "Central Pattana Engage" }), _jsx("h1", { children: "Teams-first culture rollout with daily action, score, and momentum." }), _jsx("p", { className: "subtle", children: "This POC combines private Teams experiences, bot-style daily drops, personal passports, and recognition workflows without losing the option to publish into public community spaces." }), bootstrap ? (_jsxs("p", { className: "subtle", children: ["Signed in as ", bootstrap.currentUser.name, " from ", bootstrap.currentUser.businessUnit, "."] })) : null, _jsxs("div", { className: "runtime-badges", children: [_jsx("span", { className: "runtime-badge", children: teamsStatus === "teams" ? "Teams host detected" : "Browser preview mode" }), teamsState ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "runtime-badge muted", children: teamsState.host }), _jsx("span", { className: "runtime-badge muted", children: teamsState.frame })] })) : null] }), _jsx("div", { className: "hero-actions", children: _jsx("button", { onClick: () => void refreshBootstrap(), children: busyAction ? "Working..." : "Refresh state" }) }), statusMessage ? _jsx("p", { className: "status-note", children: statusMessage }) : null] }), _jsxs("div", { className: "hero-stat", children: [_jsx("span", { children: bootstrap?.passport.score ?? "--" }), _jsx("small", { children: "Passport score" }), _jsx("strong", { children: bootstrap?.persona.title ?? "Persona loading" })] })] }), _jsxs("section", { className: "grid", children: [_jsxs("article", { className: "panel daily-drop-panel", children: [_jsxs("div", { className: "panel-title", children: [_jsx("h2", { children: bootstrap?.dailyDrop.title ?? "Daily Drop Challenge" }), _jsx("span", { children: bootstrap?.dailyDrop.timeLimit ?? "30 sec" })] }), _jsxs("div", { className: "challenge-badges", children: [_jsx("span", { className: "mini-pill", children: bootstrap?.dailyDrop.behavior ?? "Behavior" }), _jsx("span", { className: "mini-pill reward", children: bootstrap?.dailyDrop.rewardLabel ?? "Reward" })] }), _jsx("h3", { children: bootstrap?.dailyDrop.question ?? "Loading challenge..." }), _jsx("div", { className: "option-list", children: (bootstrap?.dailyDrop.options ?? []).map((option) => (_jsxs("div", { className: "option-item", children: [_jsx("span", { className: "option-marker" }), _jsx("p", { children: option.label })] }, option.id))) }), _jsxs("div", { className: "action-row", children: [_jsx("button", { className: "cta", disabled: !nextChallenge || busyAction === `challenge:${nextChallenge.id}`, onClick: () => nextChallenge && void submitChallenge(nextChallenge.id), children: nextChallenge?.status === "completed"
                                                    ? "Already completed"
                                                    : busyAction === `challenge:${nextChallenge?.id}`
                                                        ? "Submitting..."
                                                        : "Complete today's challenge" }), _jsx("span", { className: "mini-state", children: nextChallenge?.status ?? "pending" })] })] }), _jsxs("article", { className: "panel passport-panel", children: [_jsxs("div", { className: "panel-title", children: [_jsx("h2", { children: "SIAM progress passport" }), _jsxs("span", { children: [bootstrap?.passport.score ?? 0, " pts"] })] }), _jsxs("div", { className: "passport-score-row", children: [_jsxs("div", { children: [_jsxs("strong", { className: "passport-score", children: [bootstrap?.stats.progress ?? "--", "%"] }), _jsx("small", { children: "Completion" })] }), _jsxs("div", { children: [_jsxs("strong", { className: "passport-score", children: [bootstrap?.passport.modulesCompleted ?? "--", "/", bootstrap?.passport.modulesTotal ?? "--"] }), _jsx("small", { children: "Modules" })] }), _jsxs("div", { children: [_jsx("strong", { className: "passport-score", children: bootstrap?.passport.badges ?? "--" }), _jsx("small", { children: "Badges" })] })] }), _jsx("div", { className: "passport-values", children: (bootstrap?.passport.valuesProgress ?? []).map((item) => (_jsxs("div", { className: "passport-value", children: [_jsxs("div", { children: [_jsx("strong", { children: item.name }), _jsxs("small", { children: [item.points, " pts"] })] }), _jsx("span", { className: item.status === "completed" ? "state-tag done" : "state-tag", children: item.status })] }, item.name))) })] }), _jsxs("article", { className: "panel streak-panel", children: [_jsxs("div", { className: "panel-title", children: [_jsx("h2", { children: "Current streak" }), _jsxs("span", { children: ["Best ", bootstrap?.streakSummary.best ?? "--", " days"] })] }), _jsxs("strong", { className: "big-number", children: [bootstrap?.streakSummary.current ?? "--", " days"] }), _jsxs("p", { children: ["Next milestone: ", bootstrap?.streakSummary.nextMilestone ?? "--", " days.", " ", bootstrap?.streakSummary.daysLeft ?? "--", " day(s) left for", " ", bootstrap?.streakSummary.reward ?? "reward", "."] })] }), _jsxs("article", { className: "panel module-panel", children: [_jsxs("div", { className: "panel-title", children: [_jsx("h2", { children: "Next module" }), _jsx("span", { children: nextModule?.duration ?? "Loading" })] }), _jsx("strong", { children: nextModule?.title ?? "Loading module..." }), _jsx("p", { children: nextModule?.summary ?? "Fetching assigned learning journey." }), _jsx("div", { className: "action-row", children: _jsx("button", { className: "secondary-cta", disabled: !nextModule || busyAction === `module:${nextModule.id}`, onClick: () => nextModule && void completeModule(nextModule.id), children: nextModule?.status === "completed"
                                                ? "Already completed"
                                                : busyAction === `module:${nextModule?.id}`
                                                    ? "Saving..."
                                                    : "Mark complete" }) })] }), _jsxs("article", { className: "panel capstone-panel", children: [_jsxs("div", { className: "panel-title", children: [_jsx("h2", { children: "Capstone" }), _jsx("span", { children: bootstrap?.capstone.difficulty ?? "Extreme" })] }), _jsx("strong", { children: bootstrap?.capstone.title ?? "Capstone Challenge" }), _jsx("p", { children: bootstrap?.capstone.summary ?? "Preparing final-week scenario." }), _jsxs("div", { className: "capstone-meta", children: [_jsx("span", { children: bootstrap?.capstone.timeLimit ?? "05:00" }), _jsx("span", { children: bootstrap?.capstone.reward ?? "Reward" })] }), _jsx("div", { className: "action-row", children: _jsx("button", { className: "cta", onClick: () => void refreshBootstrap(), children: bootstrap?.capstone.unlocked ? "View capstone brief" : "Locked" }) })] }), _jsxs("article", { className: "panel recognition-panel", children: [_jsxs("div", { className: "panel-title", children: [_jsx("h2", { children: "Recognition" }), _jsxs("span", { children: [bootstrap?.recognitionQueue.length ?? 0, " pending approvals"] })] }), _jsx("h3", { children: "Send a moment capture" }), _jsx("p", { children: "Submit a sample peer recognition into the moderation queue, then surface it in the public community feed." }), _jsx("div", { className: "action-row", children: _jsx("button", { className: "secondary-cta", disabled: busyAction === "recognition", onClick: () => void submitRecognition(), children: busyAction === "recognition" ? "Submitting..." : "Send recognition" }) })] }), _jsxs("article", { className: "panel persona-panel", children: [_jsxs("div", { className: "panel-title", children: [_jsx("h2", { children: "Work persona" }), _jsxs("span", { children: ["Level ", bootstrap?.persona.level ?? "--"] })] }), _jsx("strong", { children: bootstrap?.persona.title ?? "Persona loading" }), _jsxs("p", { children: [bootstrap?.persona.points ?? "--", " total points accumulated across the journey."] }), _jsx("div", { className: "trait-list", children: (bootstrap?.persona.traits ?? []).map((trait) => (_jsx("span", { className: "trait-pill", children: trait }, trait))) })] }), _jsxs("article", { className: "panel notifications-panel", children: [_jsxs("div", { className: "panel-title", children: [_jsx("h2", { children: "Teams nudges" }), _jsxs("span", { children: [bootstrap?.notifications.length ?? 0, " queued"] })] }), _jsx("div", { className: "notification-list", children: (bootstrap?.notifications ?? []).slice(0, 3).map((item) => (_jsxs("div", { className: "notification-item", children: [_jsx("strong", { children: item.title }), _jsx("p", { children: item.summary })] }, item.id))) })] }), _jsxs("article", { className: "panel passport-entries-panel", children: [_jsxs("div", { className: "panel-title", children: [_jsx("h2", { children: "Recent passport entries" }), _jsx("span", { children: "Live record" })] }), _jsx("div", { className: "entry-list", children: (bootstrap?.passport.recentEntries ?? []).map((entry) => (_jsxs("div", { className: "entry-item", children: [_jsxs("div", { children: [_jsx("strong", { children: entry.title }), _jsxs("p", { children: [entry.behavior, " \u2022 ", entry.date] })] }), _jsxs("span", { className: "entry-points", children: ["+", entry.points] })] }, entry.id))) })] }), _jsxs("article", { className: "panel behaviors", children: [_jsxs("div", { className: "panel-title", children: [_jsx("h2", { children: "Four behaviors" }), _jsxs("span", { children: ["Core campaign frame \u2022 leader this week: ", leadingTeam?.name ?? "Loading"] })] }), _jsx("div", { className: "behavior-list", children: (bootstrap?.behaviors ?? []).map((behavior) => (_jsxs("div", { className: "behavior-chip", children: [_jsx("strong", { children: behavior.name }), _jsx("small", { children: behavior.tagline })] }, behavior.name))) })] })] })] })] }));
}
