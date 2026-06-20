import { createFileRoute, Link, useParams, notFound } from "@tanstack/react-router";
import { AppShell, PageHeader, RiskBadge } from "@/components/layout/AppShell";
import { graphNodes, graphEdges } from "@/lib/mockData";
import { loadAlert } from "@/lib/api/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, AlertOctagon, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/alerts/$id")({
  head: () => ({ meta: [{ title: "Alert Detail — Sentinel" }] }),
  loader: ({ params }) => loadAlert(params.id),
  component: AlertDetail,
  errorComponent: ({ error }) => <div className="p-8 text-sm">Error: {error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-sm">Alert not found.</div>,
});

function AlertDetail() {
  const alert = Route.useLoaderData();
  if (!alert) throw notFound();

  const relatedNodes = graphNodes.slice(0, 7);
  const relatedEdges = graphEdges.slice(0, 8);

  return (
    <AppShell>
      <PageHeader
        title={`Alert ${alert.id}`}
        subtitle={`${alert.merchant} · ${alert.location} · ${new Date(alert.timestamp).toLocaleString()}`}
        actions={
          <Link to="/alerts" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to queue
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-3">
        {/* Left column: 2/3 */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Transaction details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
              <Field label="Amount" value={`$${alert.amount.toLocaleString()}`} mono />
              <Field label="Merchant" value={alert.merchant} />
              <Field label="Location" value={alert.location} />
              <Field label="Device" value={alert.device} />
              <Field label="Account" value={alert.accountId} mono />
              <Field label="Fraud score" value={alert.fraudScore.toFixed(3)} mono />
              <Field label="Credit score" value={alert.creditScore?.toString() ?? "—"} mono />
              <Field label="Risk tier" value={<RiskBadge tier={alert.riskTier} />} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Score breakdown (top contributing features)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alert.topFeatures.map((f) => {
                  const w = Math.min(100, Math.abs(f.impact) * 100);
                  const pos = f.impact > 0;
                  return (
                    <div key={f.name} className="grid grid-cols-12 items-center gap-2 text-xs">
                      <div className="col-span-4 font-mono text-muted-foreground">{f.name}</div>
                      <div className="col-span-7 flex h-5 items-center">
                        <div className="relative h-2 w-full rounded bg-secondary">
                          <div
                            className="absolute top-0 h-2 rounded"
                            style={{
                              left: pos ? "50%" : `${50 - w / 2}%`,
                              width: `${w / 2}%`,
                              background: pos ? "var(--risk-critical)" : "var(--teal)",
                            }}
                          />
                          <div className="absolute left-1/2 top-[-2px] h-3 w-px bg-border" />
                        </div>
                      </div>
                      <div className={`col-span-1 text-right tabular-nums ${pos ? "text-rose-400" : "text-emerald-400"}`}>{f.impact > 0 ? "+" : ""}{f.impact.toFixed(2)}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{background:"var(--risk-critical)"}}/>Increases risk</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{background:"var(--teal)"}}/>Decreases risk</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Velocity features</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-xs">
                <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr><th className="py-1.5">Window</th><th className="py-1.5 text-right">Tx Count</th><th className="py-1.5 text-right">Sum Amount</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {alert.velocityFeatures.map((v) => (
                    <tr key={v.window}>
                      <td className="py-1.5 font-mono">{v.window}</td>
                      <td className="py-1.5 text-right tabular-nums">{v.count}</td>
                      <td className="py-1.5 text-right tabular-nums">${v.sumAmount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Related entities (mini graph)</CardTitle>
              <Link to="/graph" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">Open Graph Explorer <ExternalLink className="h-3 w-3"/></Link>
            </CardHeader>
            <CardContent>
              <MiniGraph nodes={relatedNodes} edges={relatedEdges} />
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">AI Agent recommendation</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-semibold capitalize">{alert.aiRecommendation.replace("_", " ")}</span>
                <span className="rounded bg-secondary px-2 py-0.5 tabular-nums">{alert.confidence}% conf.</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Based on a fraud score of {alert.fraudScore.toFixed(3)} and {alert.topFeatures.filter(f=>f.impact>0).length} positive risk drivers, the agent recommends to <strong>{alert.aiRecommendation.replace("_", " ")}</strong>. Knowledge-graph lookup did not surface a known fraud cluster, but velocity in the 10-minute window is elevated.
              </p>
              <div className="border-t border-border pt-3">
                <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Audit trail</div>
                <ol className="space-y-2">
                  {alert.agentReasoning.map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{background:"var(--teal)"}}/>
                      <div>
                        <div className="font-medium">{r.step} <span className="text-muted-foreground">· {new Date(r.timestamp).toLocaleTimeString()}</span></div>
                        <div className="text-muted-foreground">{r.detail}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" style={{background:"var(--teal)"}}><CheckCircle2 className="mr-1 h-4 w-4"/>Approve</Button>
                <Button variant="outline" className="flex-1"><AlertOctagon className="mr-1 h-4 w-4"/>Escalate</Button>
              </div>
              <textarea placeholder="Analyst notes…" className="mt-2 min-h-[80px] w-full rounded-md border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function MiniGraph({ nodes, edges }: { nodes: any[]; edges: any[] }) {
  const W = 600, H = 220;
  const positioned = nodes.map((n, i) => {
    const a = (i / nodes.length) * Math.PI * 2;
    return { ...n, x: W / 2 + Math.cos(a) * 80, y: H / 2 + Math.sin(a) * 70 };
  });
  const map = Object.fromEntries(positioned.map((n) => [n.id, n]));
  const colorOf: any = { account: "#0F6E56", device: "#1A3A5C", phone: "#BA7517", ip: "#7c3aed" };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {edges.map((e, i) => {
        const s = map[e.source], t = map[e.target];
        if (!s || !t) return null;
        return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="hsl(215 20% 30%)" strokeWidth={1} />;
      })}
      {positioned.map((n) => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={6 + n.riskScore * 8} fill={colorOf[n.type]} fillOpacity={0.85} stroke="hsl(215 20% 40%)" />
          <text x={n.x} y={n.y + 22} textAnchor="middle" fontSize="9" fill="hsl(215 16% 70%)">{n.label}</text>
        </g>
      ))}
    </svg>
  );
}
