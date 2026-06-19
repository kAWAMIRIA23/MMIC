import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell, PageHeader, RiskBadge } from "@/components/layout/AppShell";
import { alerts } from "@/lib/mockData";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/alerts/")({
  head: () => ({ meta: [{ title: "Alert Queue — Sentinel" }] }),
  component: AlertQueue,
});

function AlertQueue() {
  const [tier, setTier] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<"timestamp" | "fraudScore" | "amount">("timestamp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let r = alerts.filter((a) => (tier === "all" || a.riskTier === tier) && (status === "all" || a.status === status) && (q === "" || a.accountId.toLowerCase().includes(q.toLowerCase()) || a.id.toLowerCase().includes(q.toLowerCase())));
    r = [...r].sort((a, b) => {
      const av = a[sortKey] as any, bv = b[sortKey] as any;
      const cmp = sortKey === "timestamp" ? +new Date(av) - +new Date(bv) : av - bv;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [tier, status, q, sortKey, sortDir]);

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  const Select = ({ value, onChange, children }: any) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
      {children}
    </select>
  );

  return (
    <AppShell>
      <PageHeader title="Alert Queue" subtitle={`${filtered.length} alerts shown · ${alerts.filter(a => a.status === "pending").length} pending review`} />
      <div className="space-y-4 p-6">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search account or alert ID…" className="rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
            <Select value={tier} onChange={setTier}>
              <option value="all">All risk tiers</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </Select>
            <Select value={status} onChange={setStatus}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
              <option value="escalated">Escalated</option>
            </Select>
            <Select value="7d" onChange={() => {}}>
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7d</option>
              <option value="30d">Last 30d</option>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-border bg-secondary/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Alert</th>
                    <th className="cursor-pointer px-3 py-2.5" onClick={() => toggleSort("timestamp")}>Time</th>
                    <th className="px-3 py-2.5">Account</th>
                    <th className="cursor-pointer px-3 py-2.5 text-right" onClick={() => toggleSort("amount")}>Amount</th>
                    <th className="cursor-pointer px-3 py-2.5 text-right" onClick={() => toggleSort("fraudScore")}>Fraud</th>
                    <th className="px-3 py-2.5 text-right">Credit</th>
                    <th className="px-3 py-2.5">AI Recommendation</th>
                    <th className="px-3 py-2.5 text-right">Conf.</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((a) => (
                    <tr key={a.id} className="hover:bg-secondary/30">
                      <td className="px-3 py-2"><Link to="/alerts/$id" params={{ id: a.id }} className="font-mono text-teal-400 hover:underline" style={{color:"#2DD4BF"}}>{a.id}</Link></td>
                      <td className="px-3 py-2 text-muted-foreground">{new Date(a.timestamp).toLocaleString()}</td>
                      <td className="px-3 py-2 font-mono">{a.accountId}</td>
                      <td className="px-3 py-2 text-right tabular-nums">${a.amount.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="tabular-nums">{a.fraudScore.toFixed(3)}</span>
                          <RiskBadge tier={a.riskTier} />
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{a.creditScore ?? "—"}</td>
                      <td className="px-3 py-2 capitalize">{a.aiRecommendation.replace("_", " ")}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{a.confidence}%</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${a.status === "pending" ? "bg-amber-500/15 text-amber-400" : a.status === "escalated" ? "bg-rose-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400"}`}>{a.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
