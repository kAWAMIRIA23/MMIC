import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { loadAgentLog } from "@/lib/api/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/agent-log")({
  head: () => ({ meta: [{ title: "Agent Activity Log — Sentinel" }] }),
  loader: () => loadAgentLog(),
  component: AgentLogPage,
});

function AgentLogPage() {
  const agentLog = Route.useLoaderData();
  const [filter, setFilter] = useState<string>("all");
  const filtered = agentLog.filter((e) => filter === "all" || e.action === filter);

  const today = agentLog.filter((e) => new Date(e.timestamp).getUTCDate() === new Date().getUTCDate());
  const auto = agentLog.filter((e) => e.action === "auto_resolved").length;
  const overridden = agentLog.filter((e) => e.humanOverride).length;
  const autoPct = ((auto / agentLog.length) * 100).toFixed(1);
  const overPct = ((overridden / agentLog.length) * 100).toFixed(1);

  return (
    <AppShell>
      <PageHeader title="Agent Activity Log" subtitle="Audit trail of every action the AI agent has taken." />
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Actions today</div><div className="mt-1 text-2xl font-semibold tabular-nums">{today.length}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Auto-resolved</div><div className="mt-1 text-2xl font-semibold tabular-nums">{autoPct}%</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Human overrides</div><div className="mt-1 text-2xl font-semibold tabular-nums">{overPct}%</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Avg time-to-resolution</div><div className="mt-1 text-2xl font-semibold tabular-nums">42s</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Activity</CardTitle>
            <select value={filter} onChange={(e)=>setFilter(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-xs">
              <option value="all">All actions</option>
              <option value="auto_resolved">Auto-resolved</option>
              <option value="escalated">Escalated</option>
              <option value="recommendation_made">Recommendation made</option>
            </select>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-secondary/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-3 py-2">Time</th><th className="px-3 py-2">Log ID</th><th className="px-3 py-2">Alert</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Reasoning</th><th className="px-3 py-2">Human</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.slice(0, 80).map((e) => (
                  <tr key={e.id} className="hover:bg-secondary/30">
                    <td className="px-3 py-2 text-muted-foreground">{new Date(e.timestamp).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono">{e.id}</td>
                    <td className="px-3 py-2 font-mono" style={{color:"#2DD4BF"}}>{e.alertId}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${e.action==="auto_resolved" ? "bg-emerald-500/15 text-emerald-400" : e.action==="escalated" ? "bg-rose-500/15 text-rose-400" : "bg-sky-500/15 text-sky-400"}`}>
                        {e.action.replace("_"," ")}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{e.reasoning}</td>
                    <td className="px-3 py-2">{e.humanOverride ? <span className="text-amber-400">Overridden</span> : <span className="text-muted-foreground">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
