import { type BootstrapResponse } from "@cpn-engage/shared";
import { useEffect, useState } from "react";

type DemoScenarioSummary = {
  name: string;
  title: string;
  description: string;
};

export function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [scenarios, setScenarios] = useState<DemoScenarioSummary[]>([]);
  const [lastScenarioRun, setLastScenarioRun] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";

  async function loadBootstrap(cancelled = false) {
    const response = await fetch(`${apiBaseUrl}/api/bootstrap`);
    const data = (await response.json()) as BootstrapResponse;
    if (!cancelled) setBootstrap(data);
  }

  async function loadScenarios(cancelled = false) {
    const response = await fetch(`${apiBaseUrl}/api/admin/demo/scenarios`);
    const data = (await response.json()) as { scenarios: DemoScenarioSummary[] };
    if (!cancelled) setScenarios(data.scenarios);
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await loadBootstrap(cancelled);
        await loadScenarios(cancelled);
      } catch {
        if (!cancelled) setBootstrap(null);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  async function approveRecognition(id: string) {
    setBusyId(id);
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/recognitions/${id}/approve`, {
        method: "POST"
      });
      const data = (await response.json()) as { bootstrap: BootstrapResponse };
      setBootstrap(data.bootstrap);
    } finally {
      setBusyId(null);
    }
  }

  async function resetDemo() {
    setBusyId("reset");
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/demo/reset`, { method: "POST" });
      const data = (await response.json()) as BootstrapResponse;
      setBootstrap((data as unknown as { bootstrap?: BootstrapResponse }).bootstrap ?? data);
    } finally {
      setBusyId(null);
    }
  }

  async function runScenario(name: string) {
    setBusyId(`scenario:${name}`);
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/demo/scenarios/${name}`, {
        method: "POST"
      });
      const data = (await response.json()) as {
        bootstrap: BootstrapResponse;
        scenario: DemoScenarioSummary;
      };
      setBootstrap(data.bootstrap);
      setLastScenarioRun(data.scenario.title);
    } finally {
      setBusyId(null);
    }
  }

  const pending = bootstrap?.recognitionQueue.length ?? 0;

  return (
    <div className="console">
      <header className="topbar">
        <div>
          <p className="kicker">Admin command center</p>
          <h1>Campaigns, moderation, and engagement visibility.</h1>
        </div>
        <div className="toolbar">
          <button
            onClick={() => {
              void loadBootstrap();
              void loadScenarios();
            }}
          >
            {busyId === null ? "Refresh" : "Working…"}
          </button>
          <button className="ghost" onClick={() => void resetDemo()} disabled={busyId === "reset"}>
            {busyId === "reset" ? "Resetting…" : "Reset demo"}
          </button>
        </div>
      </header>

      <section className="guide">
        <div className="guide-head">
          <h2>How this demo works</h2>
          <span>One shared state across all three surfaces + the bot</span>
        </div>
        <ol className="guide-steps">
          <li>
            <span className="step-no">1</span>
            <div>
              <strong>Something happens</strong>
              <p>An employee sends a recognition in the Employee App or bot — or click a scenario below to simulate it.</p>
            </div>
          </li>
          <li>
            <span className="step-no">2</span>
            <div>
              <strong>You moderate it here</strong>
              <p>New recognitions land in the moderation queue. Approve one and the shared metrics update live.</p>
            </div>
          </li>
          <li>
            <span className="step-no">3</span>
            <div>
              <strong>It goes public</strong>
              <p>Approved recognition appears as a post in the Community Feed tab — same data, three windows.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="metric-grid">
        {(bootstrap?.metrics ?? []).map((metric) => (
          <article className="metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.note}</small>
          </article>
        ))}
      </section>

      <section className="two-up">
        <article className="sheet">
          <div className="sheet-head">
            <h2>Moderation queue</h2>
            <span className={pending ? "pill pill-active" : "pill"}>{pending} pending</span>
          </div>
          {pending === 0 ? (
            <p className="empty-note">
              Nothing waiting. Run the <strong>“Recognition to feed”</strong> scenario below, or submit a
              recognition from the Employee App, and it will appear here for approval.
            </p>
          ) : null}
          {(bootstrap?.recognitionQueue ?? []).map((item) => (
            <div className="queue-item" key={item.id}>
              <strong>Recognition · {item.behavior}</strong>
              <p>
                {item.employee} praised {item.target} for behavior aligned to {item.behavior}.
              </p>
              <div className="actions">
                <button className="ghost">Reject</button>
                <button
                  className="primary"
                  disabled={busyId === item.id}
                  onClick={() => void approveRecognition(item.id)}
                >
                  {busyId === item.id ? "Approving…" : "Approve → publish"}
                </button>
              </div>
            </div>
          ))}
        </article>

        <article className="sheet">
          <div className="sheet-head">
            <h2>Live in the feed</h2>
            <span>Recently published</span>
          </div>
          <ul className="destinations">
            {(bootstrap?.feed ?? []).slice(0, 5).map((item) => (
              <li key={item.id}>
                <span className="dest-name">{item.title}</span>
                <span className="tag tag-live">{item.kind}</span>
              </li>
            ))}
          </ul>
          {!(bootstrap?.feed ?? []).length ? (
            <p className="empty-note">Approved recognitions and announcements appear here once published.</p>
          ) : null}
        </article>
      </section>

      <section className="sheet scenario-lab">
        <div className="sheet-head">
          <h2>Run the end-to-end demo</h2>
          <span>{scenarios.length} one-click journeys</span>
        </div>
        <p className="lab-intro">
          Each button drives the whole platform at once — fire one, then switch to the Employee App or
          Community Feed tab and watch the same numbers move.
        </p>
        {lastScenarioRun ? <p className="preview-note">✓ Ran: {lastScenarioRun}</p> : null}
        <div className="card-template-grid">
          {scenarios.map((item) => (
            <div className="card-template" key={item.name}>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
              <div className="actions">
                <button
                  className="primary"
                  disabled={busyId === `scenario:${item.name}`}
                  onClick={() => void runScenario(item.name)}
                >
                  {busyId === `scenario:${item.name}` ? "Running…" : "Run scenario"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
