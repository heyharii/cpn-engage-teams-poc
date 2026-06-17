import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
export function App() {
    const [bootstrap, setBootstrap] = useState(null);
    const [cardTemplates, setCardTemplates] = useState([]);
    const [scenarios, setScenarios] = useState([]);
    const [lastCardPreview, setLastCardPreview] = useState(null);
    const [lastScenarioRun, setLastScenarioRun] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";
    const botBaseUrl = import.meta.env.VITE_BOT_BASE_URL ?? "http://127.0.0.1:4177";
    async function loadBootstrap(cancelled = false) {
        const response = await fetch(`${apiBaseUrl}/api/bootstrap`);
        const data = (await response.json());
        if (!cancelled) {
            setBootstrap(data);
        }
    }
    async function loadCardTemplates(cancelled = false) {
        const response = await fetch(`${botBaseUrl}/api/cards`);
        const data = (await response.json());
        if (!cancelled) {
            setCardTemplates(data.templates);
        }
    }
    async function loadScenarios(cancelled = false) {
        const response = await fetch(`${apiBaseUrl}/api/admin/demo/scenarios`);
        const data = (await response.json());
        if (!cancelled) {
            setScenarios(data.scenarios);
        }
    }
    useEffect(() => {
        let cancelled = false;
        async function init() {
            try {
                await loadBootstrap(cancelled);
                await loadCardTemplates(cancelled);
                await loadScenarios(cancelled);
            }
            catch {
                if (!cancelled) {
                    setBootstrap(null);
                }
            }
        }
        void init();
        return () => {
            cancelled = true;
        };
    }, [apiBaseUrl, botBaseUrl]);
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
            const response = await fetch(`${apiBaseUrl}/api/admin/demo/reset`, {
                method: "POST"
            });
            const data = (await response.json());
            setBootstrap(data.bootstrap ?? data);
        }
        finally {
            setBusyId(null);
        }
    }
    async function triggerCardPreview(template) {
        setBusyId(`card:${template}`);
        try {
            const response = await fetch(`${botBaseUrl}/api/messages/demo/${template}`, {
                method: "POST"
            });
            const data = (await response.json());
            setLastCardPreview(`${data.notification.title}: ${data.preview.summary}`);
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
    return (_jsxs("div", { className: "console", children: [_jsxs("header", { className: "topbar", children: [_jsxs("div", { children: [_jsx("p", { className: "kicker", children: "Admin console" }), _jsx("h1", { children: "Campaigns, moderation, and engagement visibility." })] }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { onClick: () => {
                                    void loadBootstrap();
                                    void loadCardTemplates();
                                    void loadScenarios();
                                }, children: busyId ? "Working..." : "Refresh" }), _jsx("button", { className: "primary", onClick: () => void resetDemo(), children: "Reset demo" })] })] }), _jsx("section", { className: "metric-grid", children: (bootstrap?.metrics ?? []).map((metric) => (_jsxs("article", { className: "metric", children: [_jsx("span", { children: metric.label }), _jsx("strong", { children: metric.value }), _jsx("small", { children: metric.note })] }, metric.label))) }), _jsxs("section", { className: "two-up", children: [_jsxs("article", { className: "sheet", children: [_jsxs("div", { className: "sheet-head", children: [_jsx("h2", { children: "Moderation queue" }), _jsxs("span", { children: [bootstrap?.recognitionQueue.length ?? 0, " pending"] })] }), (bootstrap?.recognitionQueue ?? []).map((item) => (_jsxs("div", { className: "queue-item", children: [_jsxs("strong", { children: ["Recognition: ", item.behavior] }), _jsxs("p", { children: [item.employee, " praised ", item.target, " for behavior aligned to ", item.behavior, "."] }), _jsxs("div", { className: "actions", children: [_jsx("button", { children: "Reject" }), _jsx("button", { className: "primary", disabled: busyId === item.id, onClick: () => void approveRecognition(item.id), children: busyId === item.id ? "Approving..." : "Approve" })] })] }, item.id)))] }), _jsxs("article", { className: "sheet", children: [_jsxs("div", { className: "sheet-head", children: [_jsx("h2", { children: "Publishing destinations" }), _jsx("span", { children: "Current recommendation" })] }), _jsx("ul", { children: (bootstrap?.publishingDestinations ?? []).map((item) => (_jsx("li", { children: item }, item))) })] })] }), _jsxs("section", { className: "sheet card-lab", children: [_jsxs("div", { className: "sheet-head", children: [_jsx("h2", { children: "Bot card lab" }), _jsxs("span", { children: [cardTemplates.length, " templates ready"] })] }), lastCardPreview ? _jsxs("p", { className: "preview-note", children: ["Last preview: ", lastCardPreview] }) : null, _jsx("div", { className: "card-template-grid", children: cardTemplates.map((item) => (_jsxs("div", { className: "card-template", children: [_jsx("strong", { children: item.title }), _jsx("p", { children: item.description }), _jsx("div", { className: "actions", children: _jsx("button", { className: "primary", disabled: busyId === `card:${item.template}`, onClick: () => void triggerCardPreview(item.template), children: busyId === `card:${item.template}` ? "Triggering..." : "Queue demo card" }) })] }, item.template))) })] }), _jsxs("section", { className: "sheet scenario-lab", children: [_jsxs("div", { className: "sheet-head", children: [_jsx("h2", { children: "End-to-end demo lab" }), _jsxs("span", { children: [scenarios.length, " scenarios ready"] })] }), lastScenarioRun ? _jsxs("p", { className: "preview-note", children: ["Last scenario: ", lastScenarioRun] }) : null, _jsx("div", { className: "card-template-grid", children: scenarios.map((item) => (_jsxs("div", { className: "card-template", children: [_jsx("strong", { children: item.title }), _jsx("p", { children: item.description }), _jsx("div", { className: "actions", children: _jsx("button", { className: "primary", disabled: busyId === `scenario:${item.name}`, onClick: () => void runScenario(item.name), children: busyId === `scenario:${item.name}` ? "Running..." : "Run scenario" }) })] }, item.name))) })] })] }));
}
