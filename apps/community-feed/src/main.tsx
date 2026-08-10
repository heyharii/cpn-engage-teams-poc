import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const API = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";

function report(message: string, detail?: string) {
  try {
    void fetch(`${API}/api/client-errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surface: "community-feed", message, detail, url: location.pathname })
    });
  } catch {
    /* reporting is best effort */
  }
}

window.addEventListener("error", (event) => report(event.message, event.error?.stack));
window.addEventListener("unhandledrejection", (event) => report(`Unhandled rejection: ${String(event.reason)}`, event.reason?.stack));

void fetch(`${API}/api/branding`)
  .then((response) => (response.ok ? response.json() : null))
  .then((branding) => {
    if (branding?.appName) document.title = `${branding.appName} Community Feed`;
  })
  .catch(() => {});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
