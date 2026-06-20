import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader, RiskBadge } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadAlerts, loadFraudScoreHist, loadKpis, loadTxVolume24h } from "@/lib/api/data";
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart } from "recharts";
import { ArrowDownRight, ArrowUpRight, Activity, ShieldCheck, Zap, Bot } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Overview — Sentinel Risk Ops" }, { name: "description", content: "Real-time fraud and credit risk operations dashboard." }] }),
  loader: async () => ({
    alerts: await loadAlerts(),
    kpis: await loadKpis(),
    txVolume24h: await loadTxVolume24h(),
    fraudScoreHist: await loadFraudScoreHist(),
  }),
  component: Overview,
});

const chartAxis = { stroke: "hsl(215 16% 60%)", fontSize: 10 };
const grid = "hsl(215 20% 25%)";
const tooltip = { contentStyle: { background: "hsl(220 25% 14%)", border: "1px solid hsl(215 20% 25%)", borderRadius: 6, fontSize: 12 } };

function KPI({ icon: Icon, label, value, delta, deltaUp, hint }: { icon: any; label: string; value: string; delta?: string; deltaUp?: boolean; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{label}</span>
          {delta && (
            <span className={`flex items-center gap-0.5 ${deltaUp ? "text-emerald-400" : "text-rose-400"}`}>
              {deltaUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{delta}
            </span>
          )}
        </div>
        <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Overview() {
  const { alerts, kpis, txVolume24h, fraudScoreHist } = Route.useLoaderData();
  const recent = [...alerts].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)).slice(0, 12);
  return (
    <AppShell>
      <PageHeader title="Operations Overview" subtitle="Real-time signal across the fraud detection and credit risk platform." />
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <KPI icon={Activity} label="Transactions / sec" value={kpis.tps.toLocaleString()} delta="+4.2%" deltaUp />
          <KPI icon={ShieldCheck} label="Fraud rate" value={`${kpis.fraudRate}%`} delta="-0.18%" deltaUp hint="vs 7d avg" />
          <KPI icon={ShieldCheck} label="Approval rate" value={`${kpis.approvalRate}%`} delta="+0.3%" deltaUp />
          <KPI icon={Zap} label="Avg score latency" value={`${kpis.avgLatencyMs}ms`} delta="+2ms" />
          <KPI icon={Bot} label="Auto-resolved by AI" value={`${kpis.autoResolvedPct}%`} delta="+1.7%" deltaUp />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Transaction volume — last 24h</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={txVolume24h}>
                  <defs>
                    <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0F6E56" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#0F6E56" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hour" {...chartAxis} />
                  <YAxis {...chartAxis} width={48} />
                  <Tooltip {...tooltip} />
                  <Area type="monotone" dataKey="volume" stroke="#0F6E56" fill="url(#vol)" strokeWidth={2} />
                  <Line type="monotone" dataKey="fraud" stroke="#BA7517" strokeWidth={1.5} dot={false} yAxisId={0} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Fraud score distribution</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fraudScoreHist}>
                  <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="bucket" {...chartAxis} interval={2} />
                  <YAxis {...chartAxis} width={40} />
                  <Tooltip {...tooltip} />
                  <Bar dataKey="count" fill="#1A3A5C" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Live transaction feed</CardTitle>
            <span className="text-xs text-muted-foreground">streaming</span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {recent.map((a) => (
                <div key={a.id} className="grid grid-cols-12 items-center gap-3 px-4 py-2.5 text-xs hover:bg-secondary/30">
                  <div className="col-span-2 font-mono text-muted-foreground">{a.id}</div>
                  <div className="col-span-2 text-muted-foreground">{new Date(a.timestamp).toLocaleTimeString()}</div>
                  <div className="col-span-2 font-mono">{a.accountId}</div>
                  <div className="col-span-2 tabular-nums">${a.amount.toLocaleString()}</div>
                  <div className="col-span-2">{a.merchant}</div>
                  <div className="col-span-1 tabular-nums">{a.fraudScore.toFixed(3)}</div>
                  <div className="col-span-1 text-right"><RiskBadge tier={a.riskTier} /></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
