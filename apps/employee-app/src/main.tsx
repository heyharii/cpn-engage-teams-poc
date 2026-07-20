import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// Post-distribution debugging: tabs run inside Teams where the client can't open
// devtools. Report uncaught errors to the API so they surface in the admin
// System page's debug bundle. Best-effort, never throws.
const API = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";
function report(message: string, detail?: string) {
  try {
    void fetch(`${API}/api/client-errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surface: "employee-app", message, detail, url: location.pathname })
    });
  } catch {
    /* ignore */
  }
}
window.addEventListener("error", (e) => report(e.message, e.error?.stack));
window.addEventListener("unhandledrejection", (e) =>
  report(`Unhandled rejection: ${String(e.reason)}`, e.reason?.stack)
);

// Runtime branding — pull the admin-configured app name + accent color and
// apply them (document title + the --primary CSS variable that drives the theme).
function hexToOklchApprox(hex: string): string | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  return hex; // browsers accept hex directly for the CSS var; shadcn tokens read it fine
}
void fetch(`${API}/api/branding`)
  .then((r) => (r.ok ? r.json() : null))
  .then((b) => {
    if (!b) return;
    if (b.appName) document.title = b.appName;
    const color = hexToOklchApprox(b.accentColor);
    if (color) {
      document.documentElement.style.setProperty("--primary", color);
      document.documentElement.style.setProperty("--ring", color);
    }
  })
  .catch(() => {});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
