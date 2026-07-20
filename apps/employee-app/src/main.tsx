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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
