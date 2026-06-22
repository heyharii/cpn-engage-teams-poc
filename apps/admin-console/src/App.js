import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
export function App() {
    const [bootstrap, setBootstrap] = useState(null);
    const [scenarios, setScenarios] = useState([]);
    const [lastScenarioRun, setLastScenarioRun] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";
    async function loadBootstrap(cancelled = false) {
        const response = await fetch(`${apiBaseUrl}/api/bootstrap`);
        const data = (await response.json());
        if (!cancelled)
            setBootstrap(data);
    }
    async function loadScenarios(cancelled = false) {
        const response = await fetch(`${apiBaseUrl}/api/admin/demo/scenarios`);
        const data = (await response.json());
        if (!cancelled)
            setScenarios(data.scenarios);
    }
    useEffect(() => {
        let cancelled = false;
        async function init() {
            try {
                await loadBootstrap(cancelled);
                await loadScenarios(cancelled);
            }
            catch {
                if (!cancelled)
                    setBootstrap(null);
            }
        }
        void init();
        return () => {
            cancelled = true;
        };
    }, [apiBaseUrl]);
    async function approveRecognition(id) {
        setBusyId(id);
        try {
            const response = await fetch(`${apiBaseUrl}/api/admin/recognitions/${id}/approve`, {
                method: "POST"
            });
            const data = (await response.json());
            setBootstrap(data.bootstrap);
        }
        finally {
            setBusyId(null);
        }
    }
    async function resetDemo() {
        setBusyId("reset");
        try {
            const response = await fetch(`${apiBaseUrl}/api/admin/demo/reset`, { method: "POST" });
            const data = (await response.json());
            setBootstrap(data.bootstrap ?? data);
        }
        finally {
            setBusyId(null);
        }
    }
    async function runScenario(name) {
        setBusyId(`scenario:${name}`);
        try {
            const response = await fetch(`${apiBaseUrl}/api/admin/demo/scenarios/${name}`, {
                method: "POST"
            });
            const data = (await response.json());
            setBootstrap(data.bootstrap);
            setLastScenarioRun(data.scenario.title);
        }
        finally {
            setBusyId(null);
        }
    }
    const pending = bootstrap?.recognitionQueue.length ?? 0;
    return (_jsxs("div", { className: "console", children: [_jsxs("header", { className: "topbar", children: [_jsxs("div", { children: [_jsx("p", { className: "kicker", children: "Admin command center" }), _jsx("h1", { children: "Campaigns, moderation, and engagement visibility." })] }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { onClick: () => {
                                    void loadBootstrap();
                                    void loadScenarios();
                                }, children: busyId === null ? "Refresh" : "Working…" }), _jsx("button", { className: "ghost", onClick: () => void resetDemo(), disabled: busyId === "reset", children: busyId === "reset" ? "Resetting…" : "Reset demo" })] })] }), _jsxs("section", { className: "guide", children: [_jsxs("div", { className: "guide-head", children: [_jsx("h2", { children: "How this demo works" }), _jsx("span", { children: "One shared state across all three surfaces + the bot" })] }), _jsxs("ol", { className: "guide-steps", children: [_jsxs("li", { children: [_jsx("span", { className: "step-no", children: "1" }), _jsxs("div", { children: [_jsx("strong", { children: "Something happens" }), _jsx("p", { children: "An employee sends a recognition in the Employee App or bot \u2014 or click a scenario below to simulate it." })] })] }), _jsxs("li", { children: [_jsx("span", { className: "step-no", children: "2" }), _jsxs("div", { children: [_jsx("strong", { children: "You moderate it here" }), _jsx("p", { children: "New recognitions land in the moderation queue. Approve one and the shared metrics update live." })] })] }), _jsxs("li", { children: [_jsx("span", { className: "step-no", children: "3" }), _jsxs("div", { children: [_jsx("strong", { children: "It goes public" }), _jsx("p", { children: "Approved recognition appears as a post in the Community Feed tab \u2014 same data, three windows." })] })] })] })] }), _jsx("section", { className: "metric-grid", children: (bootstrap?.metrics ?? []).map((metric) => (_jsxs("article", { className: "metric", children: [_jsx("span", { children: metric.label }), _jsx("strong", { children: metric.value }), _jsx("small", { children: metric.note })] }, metric.label))) }), _jsxs("section", { className: "two-up", children: [_jsxs("article", { className: "sheet", children: [_jsxs("div", { className: "sheet-head", children: [_jsx("h2", { children: "Moderation queue" }), _jsxs("span", { className: pending ? "pill pill-active" : "pill", children: [pending, " pending"] })] }), pending === 0 ? (_jsxs("p", { className: "empty-note", children: ["Nothing waiting. Run the ", _jsx("strong", { children: "\u201CRecognition to feed\u201D" }), " scenario below, or submit a recognition from the Employee App, and it will appear here for approval."] })) : null, (bootstrap?.recognitionQueue ?? []).map((item) => (_jsxs("div", { className: "queue-item", children: [_jsxs("strong", { children: ["Recognition \u00B7 ", item.behavior] }), _jsxs("p", { children: [item.employee, " praised ", item.target, " for behavior aligned to ", item.behavior, "."] }), _jsxs("div", { className: "actions", children: [_jsx("button", { className: "ghost", children: "Reject" }), _jsx("button", { className: "primary", disabled: busyId === item.id, onClick: () => void approveRecognition(item.id), children: busyId === item.id ? "Approving…" : "Approve → publish" })] })] }, item.id)))] }), _jsxs("article", { className: "sheet", children: [_jsxs("div", { className: "sheet-head", children: [_jsx("h2", { children: "Publishing destinations" }), _jsx("span", { children: "Where approved content can go" })] }), _jsx("ul", { className: "destinations", children: (bootstrap?.publishingDestinations ?? []).map((item, i) => (_jsxs("li", { children: [_jsx("span", { className: "dest-name", children: item }), _jsx("span", { className: i === 2 ? "tag tag-soon" : "tag tag-live", children: i === 2 ? "spike" : "live" })] }, item))) }), _jsx("p", { className: "empty-note", children: "\u201CNative Teams Communities\u201D is a validation spike (Viva Engage) \u2014 the live surfaces are the private bot feed and this custom Community Feed." })] })] }), _jsxs("section", { className: "sheet scenario-lab", children: [_jsxs("div", { className: "sheet-head", children: [_jsx("h2", { children: "Run the end-to-end demo" }), _jsxs("span", { children: [scenarios.length, " one-click journeys"] })] }), _jsx("p", { className: "lab-intro", children: "Each button drives the whole platform at once \u2014 fire one, then switch to the Employee App or Community Feed tab and watch the same numbers move." }), lastScenarioRun ? _jsxs("p", { className: "preview-note", children: ["\u2713 Ran: ", lastScenarioRun] }) : null, _jsx("div", { className: "card-template-grid", children: scenarios.map((item) => (_jsxs("div", { className: "card-template", children: [_jsx("strong", { children: item.title }), _jsx("p", { children: item.description }), _jsx("div", { className: "actions", children: _jsx("button", { className: "primary", disabled: busyId === `scenario:${item.name}`, onClick: () => void runScenario(item.name), children: busyId === `scenario:${item.name}` ? "Running…" : "Run scenario" }) })] }, item.name))) })] })] }));
}
