import { type BootstrapResponse } from "@cpn-engage/shared";
import { useEffect, useState } from "react";

type CardTemplateSummary = {
  template: string;
  title: string;
  description: string;
};

type DemoScenarioSummary = {
  name: string;
  title: string;
  description: string;
};

export function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [cardTemplates, setCardTemplates] = useState<CardTemplateSummary[]>([]);
  const [scenarios, setScenarios] = useState<DemoScenarioSummary[]>([]);
  const [lastCardPreview, setLastCardPreview] = useState<string | null>(null);
  const [lastScenarioRun, setLastScenarioRun] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";
  const botBaseUrl = import.meta.env.VITE_BOT_BASE_URL ?? "http://127.0.0.1:4177";

  async function loadBootstrap(cancelled = false) {
    const response = await fetch(`${apiBaseUrl}/api/bootstrap`);
    const data = (await response.json()) as BootstrapResponse;

    if (!cancelled) {
      setBootstrap(data);
    }
  }

  async function loadCardTemplates(cancelled = false) {
    const response = await fetch(`${botBaseUrl}/api/cards`);
    const data = (await response.json()) as { templates: CardTemplateSummary[] };

    if (!cancelled) {
      setCardTemplates(data.templates);
    }
  }

  async function loadScenarios(cancelled = false) {
    const response = await fetch(`${apiBaseUrl}/api/admin/demo/scenarios`);
    const data = (await response.json()) as { scenarios: DemoScenarioSummary[] };

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
      } catch {
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
      const response = await fetch(`${apiBaseUrl}/api/admin/demo/reset`, {
        method: "POST"
      });
      const data = (await response.json()) as BootstrapResponse;
      setBootstrap((data as unknown as { bootstrap?: BootstrapResponse }).bootstrap ?? data);
    } finally {
      setBusyId(null);
    }
  }

  async function triggerCardPreview(template: string) {
    setBusyId(`card:${template}`);
    try {
      const response = await fetch(`${botBaseUrl}/api/messages/demo/${template}`, {
        method: "POST"
      });
      const data = (await response.json()) as {
        notification: { title: string };
        preview: { summary: string };
      };
      setLastCardPreview(`${data.notification.title}: ${data.preview.summary}`);
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

  return (
    <div className="console">
      <header className="topbar">
        <div>
          <p className="kicker">Admin console</p>
          <h1>Campaigns, moderation, and engagement visibility.</h1>
        </div>
        <div className="toolbar">
          <button
            onClick={() => {
              void loadBootstrap();
              void loadCardTemplates();
              void loadScenarios();
            }}
          >
            {busyId ? "Working..." : "Refresh"}
          </button>
          <button className="primary" onClick={() => void resetDemo()}>
            Reset demo
          </button>
        </div>
      </header>

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
            <span>{bootstrap?.recognitionQueue.length ?? 0} pending</span>
          </div>
          {(bootstrap?.recognitionQueue ?? []).map((item) => (
            <div className="queue-item" key={item.id}>
              <strong>Recognition: {item.behavior}</strong>
              <p>
                {item.employee} praised {item.target} for behavior aligned to {item.behavior}.
              </p>
              <div className="actions">
                <button>Reject</button>
                <button
                  className="primary"
                  disabled={busyId === item.id}
                  onClick={() => void approveRecognition(item.id)}
                >
                  {busyId === item.id ? "Approving..." : "Approve"}
                </button>
              </div>
            </div>
          ))}
        </article>

        <article className="sheet">
          <div className="sheet-head">
            <h2>Publishing destinations</h2>
            <span>Current recommendation</span>
          </div>
          <ul>
            {(bootstrap?.publishingDestinations ?? []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="sheet card-lab">
        <div className="sheet-head">
          <h2>Bot card lab</h2>
          <span>{cardTemplates.length} templates ready</span>
        </div>
        {lastCardPreview ? <p className="preview-note">Last preview: {lastCardPreview}</p> : null}
        <div className="card-template-grid">
          {cardTemplates.map((item) => (
            <div className="card-template" key={item.template}>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
              <div className="actions">
                <button
                  className="primary"
                  disabled={busyId === `card:${item.template}`}
                  onClick={() => void triggerCardPreview(item.template)}
                >
                  {busyId === `card:${item.template}` ? "Triggering..." : "Queue demo card"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="sheet scenario-lab">
        <div className="sheet-head">
          <h2>End-to-end demo lab</h2>
          <span>{scenarios.length} scenarios ready</span>
        </div>
        {lastScenarioRun ? <p className="preview-note">Last scenario: {lastScenarioRun}</p> : null}
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
                  {busyId === `scenario:${item.name}` ? "Running..." : "Run scenario"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
