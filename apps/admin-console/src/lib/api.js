const API = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";
const BOT = import.meta.env.VITE_BOT_BASE_URL ?? "http://127.0.0.1:4177";
async function get(url) {
    try {
        const r = await fetch(url);
        if (!r.ok)
            return null;
        return (await r.json());
    }
    catch {
        return null;
    }
}
async function post(url, body) {
    try {
        const r = await fetch(url, {
            method: "POST",
            headers: body ? { "Content-Type": "application/json" } : {},
            body: body ? JSON.stringify(body) : undefined
        });
        if (!r.ok)
            return null;
        return (await r.json());
    }
    catch {
        return null;
    }
}
// --- API (shared state) ---
export const getBootstrap = () => get(`${API}/api/bootstrap`);
export const getLeaderboard = () => get(`${API}/api/leaderboard`);
// --- Bot (operations) ---
export const getAudience = () => get(`${BOT}/internal/audience`);
export const syncDirectory = () => post(`${BOT}/internal/sync-directory`);
export const enrichAudience = () => post(`${BOT}/internal/enrich`);
export const pushBroadcast = (type) => post(`${BOT}/internal/push?type=${type}`);
export const scheduleTest = (seconds) => post(`${BOT}/internal/schedule-test?seconds=${seconds}`);
