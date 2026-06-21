import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { loadCreditApplications } from "@/lib/api/data";
import type { CreditApplication } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/credit")({
  head: () => ({ meta: [{ title: "Credit Scoring — Sentinel" }] }),
  loader: () => loadCreditApplications(),
  component: CreditPage,
});

const chartAxis = { stroke: "hsl(215 16% 60%)", fontSize: 10 };
const grid = "hsl(215 20% 25%)";
const tooltip = { contentStyle: { background: "hsl(220 25% 14%)", border: "1px solid hsl(215 20% 25%)", borderRadius: 6, fontSize: 12 } };

const trend = Array.from({ length: 30 }, (_, i) => ({ day: i + 1, rate: +(72 + Math.sin(i / 4) * 4 + (i / 30) * 3).toFixed(1) }));

function gradeColor(g: string) {
  const m: any = { A:"#15803d", B:"#16a34a", C:"#65a30d", D:"#BA7517", E:"#c2410c", F:"#dc2626", G:"#991b1b" };
  return m[g];
}

function CreditPage() {
  const creditApplications = Route.useLoaderData();
  const [selected, setSelected] = useState<CreditApplication | null>(null);
  const approvalRate = creditApplications.length
    ? (creditApplications.filter(a => a.decision === "approved").length / creditApplications.length * 100).toFixed(1)
    : "0.0";

  return (
    <AppShell>
      <PageHeader title="Credit Scoring" subtitle={`${creditApplications.length} applications · ${approvalRate}% approval rate`} />
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Gini coefficient</div><div className="mt-1 text-2xl font-semibold tabular-nums">0.682</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">KS statistic</div><div className="mt-1 text-2xl font-semibold tabular-nums">0.51</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Approval rate</div><div className="mt-1 text-2xl font-semibold tabular-nums">{approvalRate}%</div></CardContent></Card>
          <Card>
            <CardContent className="p-2">
              <div className="px-2 text-xs text-muted-foreground">Approval rate — 30d</div>
              <div className="h-14">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}><Line type="monotone" dataKey="rate" stroke="#0F6E56" strokeWidth={2} dot={false}/></LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Applications</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border bg-secondary/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr><th className="px-3 py-2">App ID</th><th className="px-3 py-2">Applicant</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">Score</th><th className="px-3 py-2">Grade</th><th className="px-3 py-2">Decision</th><th className="px-3 py-2">Date</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {creditApplications.map((a) => (
                      <tr key={a.id} onClick={()=>setSelected(a)} className={`hover:bg-secondary/40 ${selected?.id===a.id ? "bg-secondary/40" : ""}`}>
                        <td className="px-3 py-2 font-mono" style={{color:"#2DD4BF"}}>{a.id}</td>
                        <td className="px-3 py-2 font-mono">{a.applicantId}</td>
                        <td className="px-3 py-2 text-right tabular-nums">${a.requestedAmount.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{a.creditScore}</td>
                        <td className="px-3 py-2"><span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{background:gradeColor(a.riskGrade)}}>{a.riskGrade}</span></td>
                        <td className="px-3 py-2 capitalize">{a.decision}</td>
                        <td className="px-3 py-2 text-muted-foreground">{a.date.slice(0,10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {selected ? (
              <>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{selected.id} · Score</CardTitle></CardHeader>
                  <CardContent>
                    <Gauge value={selected.creditScore} />
                    <div className="mt-2 text-center text-xs text-muted-foreground">Grade <span className="font-bold text-foreground">{selected.riskGrade}</span> · {selected.decision}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Scorecard breakdown</CardTitle></CardHeader>
                  <CardContent>
                    <table className="w-full text-xs">
                      <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground"><tr><th className="py-1">Feature</th><th className="py-1">Bin</th><th className="py-1 text-right">WoE</th><th className="py-1 text-right">Pts</th></tr></thead>
                      <tbody className="divide-y divide-border">
                        {selected.scorecardBins.map((b, i) => (
                          <tr key={i}><td className="py-1 font-mono">{b.feature}</td><td className="py-1 text-muted-foreground">{b.bin}</td><td className="py-1 text-right tabular-nums">{b.woe.toFixed(2)}</td><td className={`py-1 text-right tabular-nums ${b.points>0?"text-emerald-400":"text-rose-400"}`}>{b.points>0?"+":""}{b.points}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
                {selected.adverseActionReasons && (
                  <Card style={{borderColor:"var(--risk-high)"}}>
                    <CardHeader className="pb-2"><CardTitle className="text-sm" style={{color:"#fb923c"}}>Adverse action reasons</CardTitle></CardHeader>
                    <CardContent>
                      <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                        {selected.adverseActionReasons.map((r,i)=><li key={i}>{r}</li>)}
                      </ol>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card><CardContent className="p-6 text-center text-xs text-muted-foreground">Select an application to view scorecard.</CardContent></Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Gauge({ value }: { value: number }) {
  const pct = (value - 300) / (850 - 300);
  const angle = -90 + pct * 180;
  const color = value > 720 ? "#15803d" : value > 640 ? "#BA7517" : "#dc2626";
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-full max-w-[240px]">
        <path d="M 20 110 A 80 80 0 0 1 180 110" stroke="hsl(215 20% 25%)" strokeWidth="14" fill="none" strokeLinecap="round"/>
        <path d="M 20 110 A 80 80 0 0 1 180 110" stroke={color} strokeWidth="14" fill="none" strokeLinecap="round" strokeDasharray={`${pct * 251} 251`} />
        <g transform={`rotate(${angle} 100 110)`}><line x1="100" y1="110" x2="100" y2="40" stroke="#fff" strokeWidth="2"/><circle cx="100" cy="110" r="5" fill="#fff"/></g>
        <text x="100" y="100" textAnchor="middle" fontSize="24" fontWeight="600" fill="#fff">{value}</text>
      </svg>
    </div>
  );
}
