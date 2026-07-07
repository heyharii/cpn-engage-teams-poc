import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { LayoutDashboard, Users, Send, Heart, Trophy, RefreshCw, Sparkles, UserPlus, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getBootstrap, getLeaderboard, getAudience, syncDirectory, enrichAudience, pushBroadcast, scheduleTest } from "@/lib/api";
const NAV = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "audience", label: "Audience", icon: Users },
    { id: "broadcast", label: "Broadcast", icon: Send },
    { id: "recognitions", label: "Recognitions", icon: Heart },
    { id: "leaderboard", label: "Leaderboard", icon: Trophy }
];
export function App() {
    const [nav, setNav] = useState("overview");
    const [boot, setBoot] = useState(null);
    const [audience, setAudience] = useState([]);
    const [leaders, setLeaders] = useState([]);
    async function loadAll() {
        const [b, a, l] = await Promise.all([getBootstrap(), getAudience(), getLeaderboard()]);
        if (b)
            setBoot(b);
        if (a)
            setAudience(a.users);
        if (l)
            setLeaders(l);
    }
    useEffect(() => {
        void loadAll();
    }, []);
    return (_jsxs("div", { className: "flex min-h-screen bg-background text-foreground", children: [_jsxs("aside", { className: "flex w-60 flex-col border-r border-border bg-sidebar p-4", children: [_jsxs("div", { className: "mb-8 flex items-center gap-2 px-2", children: [_jsx("div", { className: "flex size-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground", children: "C" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-bold leading-tight", children: "CPN Engage" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Admin Console" })] })] }), _jsx("nav", { className: "flex flex-col gap-1", children: NAV.map((item) => (_jsxs("button", { onClick: () => setNav(item.id), className: cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors", nav === item.id
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"), children: [_jsx(item.icon, { className: "size-4" }), item.label] }, item.id))) }), _jsx("div", { className: "mt-auto px-2 pt-4", children: _jsxs(Button, { variant: "outline", size: "sm", className: "w-full", onClick: () => void loadAll(), children: [_jsx(RefreshCw, { className: "size-3.5" }), " Refresh"] }) })] }), _jsxs("main", { className: "flex-1 overflow-auto p-8", children: [nav === "overview" && _jsx(Overview, { boot: boot, audienceCount: audience.length, leaders: leaders }), nav === "audience" && _jsx(Audience, { users: audience, onReload: loadAll }), nav === "broadcast" && _jsx(Broadcast, { audienceCount: audience.length }), nav === "recognitions" && _jsx(Recognitions, { feed: boot?.feed ?? [] }), nav === "leaderboard" && _jsx(Leaderboard, { leaders: leaders })] })] }));
}
function PageHeader({ title, subtitle }) {
    return (_jsxs("div", { className: "mb-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: title }), _jsx("p", { className: "text-sm text-muted-foreground", children: subtitle })] }));
}
function StatCard({ label, value, hint }) {
    return (_jsx(Card, { children: _jsxs(CardContent, { className: "pt-6", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: label }), _jsx("p", { className: "mt-1 text-3xl font-bold", children: value }), hint ? _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: hint }) : null] }) }));
}
function Overview(props) {
    const { boot, audienceCount, leaders } = props;
    const recognitions = (boot?.feed ?? []).filter((f) => f.kind === "recognition").length;
    return (_jsxs("div", { children: [_jsx(PageHeader, { title: "Overview", subtitle: "Engagement at a glance across CPN Engage." }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", children: [_jsx(StatCard, { label: "Reachable audience", value: audienceCount, hint: "captured conversations" }), _jsx(StatCard, { label: "Recognitions", value: recognitions, hint: "posted to the feed" }), _jsx(StatCard, { label: "Top scorer", value: leaders[0]?.name ?? "—", hint: leaders[0] ? `${leaders[0].points} pts` : "" }), _jsx(StatCard, { label: "Modules", value: boot?.modules.length ?? 0, hint: "in the learning journey" })] }), _jsxs(Card, { className: "mt-6", children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Recent activity" }) }), _jsxs(CardContent, { className: "flex flex-col gap-3", children: [(boot?.notifications ?? []).slice(0, 6).map((n) => (_jsxs("div", { className: "flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0", children: [_jsx(Badge, { variant: "secondary", children: n.type.replace(/-/g, " ") }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium", children: n.title }), _jsx("p", { className: "text-xs text-muted-foreground", children: n.summary })] })] }, n.id))), (boot?.notifications ?? []).length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "No recent activity." })) : null] })] })] }));
}
function useAction() {
    const [busy, setBusy] = useState(null);
    const [msg, setMsg] = useState(null);
    async function run(key, fn) {
        setBusy(key);
        setMsg(null);
        try {
            setMsg(await fn());
        }
        catch (e) {
            setMsg(e instanceof Error ? e.message : "Failed");
        }
        finally {
            setBusy(null);
        }
    }
    return { busy, msg, run };
}
function Audience(props) {
    const { users, onReload } = props;
    const { busy, msg, run } = useAction();
    return (_jsxs("div", { children: [_jsx(PageHeader, { title: "Audience", subtitle: "Everyone the bot can reach, resolved from the directory." }), _jsxs("div", { className: "mb-4 flex flex-wrap items-center gap-2", children: [_jsxs(Button, { disabled: busy !== null, onClick: () => void run("sync", async () => {
                            const r = await syncDirectory();
                            await onReload();
                            return r?.ok ? `Synced ${r.upserted} directory users.` : r?.error ?? "Sync failed.";
                        }), children: [busy === "sync" ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsx(RefreshCw, { className: "size-4" }), "Sync directory"] }), _jsxs(Button, { variant: "outline", disabled: busy !== null, onClick: () => void run("enrich", async () => {
                            const r = await enrichAudience();
                            await onReload();
                            return r?.ok ? `Enriched ${r.named} names, ${r.titled} titles.` : "Enrich failed.";
                        }), children: [busy === "enrich" ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsx(Sparkles, { className: "size-4" }), "Enrich"] }), msg ? _jsx("span", { className: "text-sm text-muted-foreground", children: msg }) : null] }), _jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Name" }), _jsx(TableHead, { children: "Job title" }), _jsx(TableHead, { children: "Department" })] }) }), _jsxs(TableBody, { children: [users.map((u, i) => (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "font-medium", children: u.name }), _jsx(TableCell, { children: u.jobTitle ?? _jsx("span", { className: "text-muted-foreground", children: "\u2014" }) }), _jsx(TableCell, { children: u.department ? (_jsx(Badge, { variant: "secondary", children: u.department })) : (_jsx("span", { className: "text-muted-foreground", children: "\u2014" })) })] }, `${u.name}-${i}`))), users.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 3, className: "text-center text-muted-foreground", children: "No audience yet \u2014 install the app for users, then Sync directory." }) })) : null] })] }) }) })] }));
}
function Broadcast(props) {
    const { audienceCount } = props;
    const { busy, msg, run } = useAction();
    return (_jsxs("div", { children: [_jsx(PageHeader, { title: "Broadcast", subtitle: `Send a proactive card to all ${audienceCount} reachable users.` }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Daily challenge" }) }), _jsxs(CardContent, { children: [_jsx("p", { className: "mb-4 text-sm text-muted-foreground", children: "Push the current daily drop to everyone now." }), _jsxs(Button, { disabled: busy !== null, onClick: () => void run("challenge", async () => {
                                            const r = await pushBroadcast("challenge");
                                            return r?.ok ? `Sent to ${r.sent}/${r.total}.` : "Push failed.";
                                        }), children: [busy === "challenge" ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsx(Send, { className: "size-4" }), "Send challenge"] })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Learning module" }) }), _jsxs(CardContent, { children: [_jsx("p", { className: "mb-4 text-sm text-muted-foreground", children: "Assign the first module to everyone now." }), _jsxs(Button, { disabled: busy !== null, onClick: () => void run("module", async () => {
                                            const r = await pushBroadcast("module");
                                            return r?.ok ? `Sent to ${r.sent}/${r.total}.` : "Push failed.";
                                        }), children: [busy === "module" ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsx(Send, { className: "size-4" }), "Send module"] })] })] })] }), _jsxs(Card, { className: "mt-4", children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Test the scheduler" }) }), _jsxs(CardContent, { children: [_jsx("p", { className: "mb-4 text-sm text-muted-foreground", children: "Fire a scheduled push in 30 seconds (pg-boss cron demo)." }), _jsxs(Button, { variant: "outline", disabled: busy !== null, onClick: () => void run("schedule", async () => {
                                    const r = await scheduleTest(30);
                                    return r?.ok ? "Scheduled — watch your DM in ~30s." : "Scheduler not running.";
                                }), children: [busy === "schedule" ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsx(UserPlus, { className: "size-4" }), "Schedule test push"] })] })] }), msg ? _jsx("p", { className: "mt-4 text-sm text-muted-foreground", children: msg }) : null] }));
}
function Recognitions(props) {
    const recognitions = props.feed.filter((f) => f.kind === "recognition");
    return (_jsxs("div", { children: [_jsx(PageHeader, { title: "Recognitions", subtitle: "Live recognition posts from the Community Feed (no approval needed)." }), _jsxs("div", { className: "flex flex-col gap-3", children: [recognitions.map((r) => (_jsx(Card, { children: _jsxs(CardContent, { className: "pt-6", children: [_jsxs("div", { className: "mb-1 flex items-center gap-2", children: [_jsx("span", { className: "font-semibold", children: r.author }), _jsx("span", { className: "text-sm text-muted-foreground", children: "recognised" }), _jsx("span", { className: "font-semibold", children: r.target }), r.belief ? _jsx(Badge, { variant: "secondary", children: r.belief }) : null] }), _jsx("p", { className: "text-sm", children: r.message ?? r.summary })] }) }, r.id))), recognitions.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "No recognitions yet." })) : null] })] }));
}
function Leaderboard(props) {
    return (_jsxs("div", { children: [_jsx(PageHeader, { title: "Leaderboard", subtitle: "Real per-user standings from earned points." }), _jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { className: "w-12", children: "#" }), _jsx(TableHead, { children: "Name" }), _jsx(TableHead, { children: "Department" }), _jsx(TableHead, { className: "text-right", children: "Points" })] }) }), _jsx(TableBody, { children: props.leaders.map((l, i) => (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "font-bold text-muted-foreground", children: i + 1 }), _jsx(TableCell, { className: "font-medium", children: l.name }), _jsx(TableCell, { children: l.department ? _jsx(Badge, { variant: "secondary", children: l.department }) : _jsx("span", { className: "text-muted-foreground", children: "\u2014" }) }), _jsx(TableCell, { className: "text-right font-bold", children: l.points })] }, `${l.name}-${i}`))) })] }) }) })] }));
}
