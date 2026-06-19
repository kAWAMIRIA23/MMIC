import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { graphNodes, graphEdges, fraudRings, type GraphNode } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/graph")({
  head: () => ({ meta: [{ title: "Graph Explorer — Sentinel" }] }),
  component: GraphPage,
});

const COLORS: Record<GraphNode["type"], string> = {
  account: "#0F6E56", device: "#1A3A5C", phone: "#BA7517", ip: "#7c3aed",
};

function GraphPage() {
  const [filters, setFilters] = useState({ account: true, device: true, phone: true, ip: true });
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [q, setQ] = useState("");

  const visible = graphNodes.filter((n) => filters[n.type] && (q === "" || n.label.toLowerCase().includes(q.toLowerCase())));
  const visIds = new Set(visible.map((n) => n.id));
  const visibleEdges = graphEdges.filter((e) => visIds.has(e.source) && visIds.has(e.target));
  const map = Object.fromEntries(graphNodes.map((n) => [n.id, n]));
  const connections = selected ? graphEdges.filter((e) => e.source === selected.id || e.target === selected.id) : [];

  return (
    <AppShell>
      <PageHeader title="Knowledge Graph Explorer" subtitle={`${graphNodes.length} entities · ${graphEdges.length} relationships · ${fraudRings.length} suspected rings`} />
      <div className="grid h-[calc(100%-65px)] grid-cols-12 gap-0">
        {/* Filters */}
        <div className="col-span-2 space-y-3 border-r border-border p-3 text-xs">
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search entity…" className="w-full rounded-md border border-input bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring" />
          <div className="space-y-1">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Entity types</div>
            {(Object.keys(filters) as (keyof typeof filters)[]).map((k) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 capitalize">
                <input type="checkbox" checked={filters[k]} onChange={(e)=>setFilters({...filters,[k]:e.target.checked})} />
                <span className="h-2.5 w-2.5 rounded-sm" style={{background:COLORS[k]}} />
                {k}
              </label>
            ))}
          </div>
          <div className="border-t border-border pt-3">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Detected fraud rings</div>
            <div className="space-y-2">
              {fraudRings.map((r) => (
                <div key={r.id} className="rounded border border-border bg-secondary/30 p-2">
                  <div className="font-medium">{r.name}</div>
                  <div className="mt-1 flex justify-between text-muted-foreground">
                    <span>{r.size} accounts</span>
                    <span className="tabular-nums">risk {r.avgRisk.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Graph */}
        <div className="col-span-7 relative bg-gradient-to-br from-background to-secondary/20">
          <svg viewBox="0 0 1100 720" className="h-full w-full">
            {visibleEdges.map((e, i) => {
              const s = map[e.source], t = map[e.target];
              if (!s?.x || !t?.x) return null;
              return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="hsl(215 20% 28%)" strokeWidth={1} />;
            })}
            {visible.map((n) => {
              const isSel = selected?.id === n.id;
              return (
                <g key={n.id} className="cursor-pointer" onClick={() => setSelected(n)}>
                  <circle cx={n.x} cy={n.y} r={6 + n.riskScore * 14} fill={COLORS[n.type]} fillOpacity={0.85} stroke={isSel ? "#fff" : "hsl(215 20% 40%)"} strokeWidth={isSel ? 2 : 1} />
                  {(n.riskScore > 0.7 || isSel) && (
                    <text x={n.x} y={(n.y ?? 0) + 26} textAnchor="middle" fontSize="9" fill="hsl(215 16% 75%)">{n.label}</text>
                  )}
                </g>
              );
            })}
          </svg>
          <div className="absolute bottom-3 left-3 flex gap-3 rounded-md border border-border bg-card/80 px-3 py-2 text-[10px] backdrop-blur">
            {Object.entries(COLORS).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1 capitalize"><span className="h-2 w-2 rounded-full" style={{background:v}}/>{k}</span>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="col-span-3 border-l border-border p-3 text-xs">
          {selected ? (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{selected.label}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="capitalize">{selected.type}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Risk score</span><span className="tabular-nums">{selected.riskScore.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">ID</span><span className="font-mono">{selected.id}</span></div>
                <div className="border-t border-border pt-2">
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Connections ({connections.length})</div>
                  <ul className="space-y-1">
                    {connections.map((c, i) => {
                      const otherId = c.source === selected.id ? c.target : c.source;
                      const other = map[otherId];
                      return (
                        <li key={i} className="flex justify-between gap-2">
                          <button onClick={() => other && setSelected(other)} className="truncate font-mono hover:underline">{otherId}</button>
                          <span className="text-muted-foreground">{c.relationship.replace("_"," ")}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-muted-foreground">Click a node to inspect its connections.</div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
