import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { loadMonitoring } from "@/lib/api/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend } from "recharts";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/monitoring")({
  head: () => ({ meta: [{ title: "Model Monitoring — Sentinel" }] }),
  loader: () => loadMonitoring(),
  component: MonitoringPage,
});

const chartAxis = { stroke: "hsl(215 16% 60%)", fontSize: 10 };
const grid = "hsl(215 20% 25%)";
const tooltip = { contentStyle: { background: "hsl(220 25% 14%)", border: "1px solid hsl(215 20% 25%)", borderRadius: 6, fontSize: 12 } };

function MonitoringPage() {
  const monitoring = Route.useLoaderData();
  const psiBreach = monitoring.some(m => m.psiCredit > 0.25);
  return (
    <AppShell>
      <PageHeader title="Model Monitoring" subtitle="Health, drift, and latency across the fraud and credit models — last 30 days." />
      <div className="space-y-4 p-6">
        {psiBreach && (
          <div className="flex items-center gap-3 rounded-md border p-3 text-xs" style={{borderColor:"var(--amber)", background:"rgba(186,117,23,0.08)"}}>
            <AlertTriangle className="h-4 w-4" style={{color:"var(--amber)"}} />
            <div><strong>PSI for credit model exceeded 0.25</strong> — retraining recommended. Latest value {monitoring[monitoring.length-1].psiCredit.toFixed(3)}.</div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Population Stability Index (PSI)</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monitoring}>
                  <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="date" {...chartAxis} tickFormatter={(d)=>d.slice(5)}/>
                  <YAxis {...chartAxis} width={40}/>
                  <Tooltip {...tooltip}/>
                  <Legend wrapperStyle={{fontSize:10}}/>
                  <ReferenceLine y={0.25} stroke="#dc2626" strokeDasharray="4 4" label={{value:"Retrain threshold",fill:"#dc2626",fontSize:9,position:"insideTopRight"}} />
                  <Line type="monotone" dataKey="psiFraud" name="Fraud" stroke="#0F6E56" strokeWidth={2} dot={false}/>
                  <Line type="monotone" dataKey="psiCredit" name="Credit" stroke="#BA7517" strokeWidth={2} dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Model performance (AUC-ROC / KS)</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monitoring}>
                  <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="date" {...chartAxis} tickFormatter={(d)=>d.slice(5)}/>
                  <YAxis {...chartAxis} width={40} domain={[0.4, 1]}/>
                  <Tooltip {...tooltip}/>
                  <Legend wrapperStyle={{fontSize:10}}/>
                  <Line type="monotone" dataKey="aucFraud" name="Fraud AUC" stroke="#3B82F6" strokeWidth={2} dot={false}/>
                  <Line type="monotone" dataKey="ksCredit" name="Credit KS" stroke="#a855f7" strokeWidth={2} dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Scoring latency percentiles (ms)</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monitoring}>
                  <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="date" {...chartAxis} tickFormatter={(d)=>d.slice(5)}/>
                  <YAxis {...chartAxis} width={40}/>
                  <Tooltip {...tooltip}/>
                  <Legend wrapperStyle={{fontSize:10}}/>
                  <Line type="monotone" dataKey="latencyP50" name="p50" stroke="#0F6E56" strokeWidth={2} dot={false}/>
                  <Line type="monotone" dataKey="latencyP95" name="p95" stroke="#BA7517" strokeWidth={2} dot={false}/>
                  <Line type="monotone" dataKey="latencyP99" name="p99" stroke="#dc2626" strokeWidth={2} dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Champion vs Challenger</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded border border-border bg-secondary/30 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Champion · v4.2</div>
                  <div className="mt-2 space-y-1">
                    <Row label="AUC" value="0.932"/><Row label="KS" value="0.51"/><Row label="p95 latency" value="34ms"/>
                  </div>
                </div>
                <div className="rounded border p-3" style={{borderColor:"var(--teal)", background:"rgba(15,110,86,0.08)"}}>
                  <div className="text-[10px] uppercase tracking-wider" style={{color:"var(--teal)"}}>Challenger · v4.3</div>
                  <div className="mt-2 space-y-1">
                    <Row label="AUC" value="0.941"/><Row label="KS" value="0.55"/><Row label="p95 latency" value="38ms"/>
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>Traffic split</span><span>Champion 90% / Challenger 10%</span></div>
                <div className="flex h-2 overflow-hidden rounded-full bg-secondary">
                  <div style={{width:"90%", background:"var(--navy)"}}/>
                  <div style={{width:"10%", background:"var(--teal)"}}/>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Row({label,value}:{label:string;value:string}){return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-mono tabular-nums">{value}</span></div>}
