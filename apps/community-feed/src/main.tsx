import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const API = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";

/**
 * Teams SSO is granted per ORIGIN: the host only issues a token when the tab's
 * domain is the one in the Entra Application ID URI. An older installed app
 * package can still point its Feeds tab at THIS domain, and Teams then refuses
 * the token ("App resource defined in manifest and iframe origin do not match")
 * — the tab silently drops to guest mode with no way for the user to fix it.
 *
 * So when this page is rendered inside Teams from the wrong origin, it hands
 * the frame over to the SSO-capable origin, which serves the same feed. Plain
 * browser visitors are untouched: this only fires inside a frame, and only when
 * a redirect target is configured.
 */
const SSO_ORIGIN_FEED_URL = import.meta.env.VITE_SSO_FEED_URL ?? "";
if (SSO_ORIGIN_FEED_URL && window.top !== window.self) {
  try {
    const target = new URL(SSO_ORIGIN_FEED_URL);
    if (target.host !== location.host) location.replace(target.toString() + location.search);
  } catch {
    /* a malformed target must never stop the feed from rendering */
  }
}

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
