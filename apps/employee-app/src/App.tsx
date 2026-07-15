import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProfilePage } from "./pages/ProfilePage";
import { FeedsPage } from "./pages/FeedsPage";

/**
 * Merged Teams app shell — Profile and Feeds are separate personal tabs in
 * the Teams manifest, but now share one deployed domain/bundle (routed by
 * path) instead of two. This fixes Feeds' Teams SSO: `getAuthToken` requires
 * the page's origin to match the app's Application ID URI, which previously
 * only Profile's domain satisfied.
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProfilePage />} />
        <Route path="/feeds" element={<FeedsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
