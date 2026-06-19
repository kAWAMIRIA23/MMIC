// Deterministic mock data for the Fraud & Credit ops dashboard.

export interface Alert {
  id: string;
  timestamp: string;
  accountId: string;
  amount: number;
  fraudScore: number;
  creditScore?: number;
  riskTier: "low" | "medium" | "high" | "critical";
  aiRecommendation: "close" | "escalate" | "request_info";
  confidence: number;
  status: "pending" | "resolved" | "escalated";
  merchant: string;
  location: string;
  device: string;
  topFeatures: { name: string; impact: number }[];
  velocityFeatures: { window: "1min" | "10min" | "1hr" | "24hr"; count: number; sumAmount: number }[];
  agentReasoning: { step: string; timestamp: string; detail: string }[];
}

export interface GraphNode {
  id: string;
  type: "account" | "device" | "phone" | "ip";
  riskScore: number;
  label: string;
  x?: number;
  y?: number;
}
export interface GraphEdge { source: string; target: string; relationship: string; }

export interface CreditApplication {
  id: string;
  applicantId: string;
  requestedAmount: number;
  creditScore: number;
  riskGrade: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  decision: "approved" | "declined" | "review";
  date: string;
  scorecardBins: { feature: string; bin: string; woe: number; points: number }[];
  adverseActionReasons?: string[];
}

export interface MonitoringMetric {
  date: string;
  psiFraud: number;
  psiCredit: number;
  aucFraud: number;
  ksCredit: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
}

export interface AgentLogEntry {
  id: string;
  timestamp: string;
  alertId: string;
  action: "auto_resolved" | "escalated" | "recommendation_made";
  reasoning: string;
  humanOverride: boolean;
}

// --- seeded RNG so data is stable across renders ---
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(42);
const pick = <T>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const rng = (min: number, max: number) => min + rnd() * (max - min);
const rint = (min: number, max: number) => Math.floor(rng(min, max + 1));

const merchants = ["Amazon", "Walmart", "Apple Store", "Uber", "Shell", "Target", "Best Buy", "Steam", "Nike", "Zara", "Etsy", "Crypto.com", "Western Union", "Booking.com"];
const locations = ["New York, US", "London, UK", "Lagos, NG", "Singapore, SG", "São Paulo, BR", "Berlin, DE", "Tokyo, JP", "Moscow, RU", "Mumbai, IN", "Mexico City, MX"];
const devices = ["iPhone 15 — iOS 17", "Pixel 8 — Android 14", "MacBook Pro — Safari", "Windows 11 — Chrome", "Galaxy S24 — Android 14", "iPad — Safari"];
const featurePool = [
  "velocity_1h_count", "amount_zscore", "mcc_risk", "device_age_days", "geo_distance_last_tx",
  "merchant_risk_score", "card_present", "shared_device_count", "first_seen_ip", "night_tx_ratio",
  "amount_vs_avg", "failed_attempts_24h",
];

function ts(daysAgo: number, hoursAgo = 0): string {
  const d = new Date(Date.UTC(2026, 5, 13, 12, 0, 0));
  d.setHours(d.getHours() - daysAgo * 24 - hoursAgo - Math.floor(rng(0, 24)));
  d.setMinutes(d.getMinutes() - rint(0, 59));
  return d.toISOString();
}

function tierForScore(s: number): Alert["riskTier"] {
  if (s < 0.3) return "low";
  if (s < 0.6) return "medium";
  if (s < 0.85) return "high";
  return "critical";
}

function buildAlert(i: number): Alert {
  const fraudScore = +Math.min(0.99, Math.max(0.02, rng(0.02, 1))).toFixed(3);
  const tier = tierForScore(fraudScore);
  const rec: Alert["aiRecommendation"] = tier === "critical" ? "escalate" : tier === "high" ? (rnd() > 0.5 ? "escalate" : "request_info") : "close";
  const status: Alert["status"] = rnd() < 0.55 ? "pending" : rnd() < 0.7 ? "resolved" : "escalated";
  const feats = [...featurePool].sort(() => rnd() - 0.5).slice(0, 6).map((n) => ({
    name: n,
    impact: +(rng(-0.6, 0.9) * (n.includes("risk") || n.includes("velocity") ? 1 : 0.7)).toFixed(3),
  }));
  const windows: Array<"1min" | "10min" | "1hr" | "24hr"> = ["1min", "10min", "1hr", "24hr"];
  const velocity = windows.map((w) => ({ window: w, count: rint(w === "1min" ? 0 : 1, w === "24hr" ? 80 : 20), sumAmount: +rng(50, 12000).toFixed(2) }));
  const ts0 = ts(0, i % 24);
  const reasoning = [
    { step: "Ingest transaction", timestamp: ts0, detail: "Received transaction event from card processor; enriched with merchant and device metadata." },
    { step: "Score with fraud model v4.2", timestamp: ts0, detail: `Computed fraud score ${fraudScore} using XGBoost ensemble.` },
    { step: "Query knowledge graph", timestamp: ts0, detail: `Found ${rint(0, 5)} linked accounts within 2 hops via shared device fingerprint.` },
    { step: "Compare to historical alerts", timestamp: ts0, detail: `Matched ${rint(0, 12)} similar past alerts; ${rint(0, 80)}% were chargebacks.` },
    { step: "Generate recommendation", timestamp: ts0, detail: `Recommended action: ${rec.replace("_", " ")} with ${rint(60, 99)}% confidence.` },
  ];
  return {
    id: `ALT-${String(100000 + i).padStart(6, "0")}`,
    timestamp: ts0,
    accountId: `ACC-${String(rint(10000, 99999))}`,
    amount: +rng(10, 12000).toFixed(2),
    fraudScore,
    creditScore: rnd() > 0.4 ? rint(320, 830) : undefined,
    riskTier: tier,
    aiRecommendation: rec,
    confidence: rint(55, 99),
    status,
    merchant: pick(merchants),
    location: pick(locations),
    device: pick(devices),
    topFeatures: feats,
    velocityFeatures: velocity,
    agentReasoning: reasoning,
  };
}

export const alerts: Alert[] = Array.from({ length: 60 }, (_, i) => buildAlert(i));

// --- Graph: ~40 nodes, ~60 edges, with one fraud ring of 9 accounts ---
const nodes: GraphNode[] = [];
const edges: GraphEdge[] = [];
function addNode(n: GraphNode) { nodes.push(n); }

// Fraud ring: 9 accounts, sharing 2 devices, 2 phones, 1 ip
const ringAccounts = Array.from({ length: 9 }, (_, i) => ({ id: `ACC-R${i + 1}`, type: "account" as const, riskScore: +rng(0.82, 0.98).toFixed(2), label: `ACC-R${i + 1}` }));
const ringDevices = [{ id: "DEV-R1", type: "device" as const, riskScore: 0.93, label: "Device R1" }, { id: "DEV-R2", type: "device" as const, riskScore: 0.88, label: "Device R2" }];
const ringPhones = [{ id: "PH-R1", type: "phone" as const, riskScore: 0.9, label: "+1-555-0102" }, { id: "PH-R2", type: "phone" as const, riskScore: 0.85, label: "+1-555-0177" }];
const ringIp = { id: "IP-R1", type: "ip" as const, riskScore: 0.95, label: "185.220.101.4" };
[...ringAccounts, ...ringDevices, ...ringPhones, ringIp].forEach(addNode);
ringAccounts.forEach((a, i) => {
  edges.push({ source: a.id, target: ringDevices[i % 2].id, relationship: "shares_device" });
  edges.push({ source: a.id, target: ringPhones[i % 2].id, relationship: "shares_phone" });
  if (i % 2 === 0) edges.push({ source: a.id, target: ringIp.id, relationship: "shares_ip" });
});
for (let i = 0; i < ringAccounts.length - 1; i++) {
  edges.push({ source: ringAccounts[i].id, target: ringAccounts[i + 1].id, relationship: "transacted_with" });
}

// Background nodes
for (let i = 0; i < 18; i++) addNode({ id: `ACC-${1000 + i}`, type: "account", riskScore: +rng(0.05, 0.7).toFixed(2), label: `ACC-${1000 + i}` });
for (let i = 0; i < 5; i++) addNode({ id: `DEV-${i + 10}`, type: "device", riskScore: +rng(0.05, 0.5).toFixed(2), label: `Device ${i + 10}` });
for (let i = 0; i < 4; i++) addNode({ id: `PH-${i + 10}`, type: "phone", riskScore: +rng(0.05, 0.4).toFixed(2), label: `+1-555-02${i}0` });
for (let i = 0; i < 3; i++) addNode({ id: `IP-${i + 10}`, type: "ip", riskScore: +rng(0.05, 0.5).toFixed(2), label: `10.0.${i}.1` });

const bgAcc = nodes.filter((n) => n.type === "account" && n.id.startsWith("ACC-1"));
const bgOther = nodes.filter((n) => !n.id.endsWith("R1") && n.type !== "account" && !n.id.includes("-R"));
for (let i = 0; i < 35; i++) {
  const s = bgAcc[rint(0, bgAcc.length - 1)];
  const t = bgOther[rint(0, bgOther.length - 1)];
  if (s && t && !edges.some((e) => e.source === s.id && e.target === t.id)) {
    edges.push({ source: s.id, target: t.id, relationship: pick(["shares_device", "shares_phone", "shares_ip", "transacted_with"]) });
  }
}

// Assign deterministic positions (simple polar layout with ring clustered)
nodes.forEach((n, i) => {
  if (n.id.includes("-R") || n.id.endsWith("R1") || n.id.endsWith("R2")) {
    const k = nodes.filter((m) => m.id.includes("-R") || m.id.endsWith("R1") || m.id.endsWith("R2")).indexOf(n);
    const a = (k / 14) * Math.PI * 2;
    n.x = 280 + Math.cos(a) * 110;
    n.y = 320 + Math.sin(a) * 110;
  } else {
    const a = (i / nodes.length) * Math.PI * 2;
    const r = 260 + (i % 3) * 60;
    n.x = 720 + Math.cos(a) * r;
    n.y = 360 + Math.sin(a) * (r * 0.55);
  }
});

export const graphNodes: GraphNode[] = nodes;
export const graphEdges: GraphEdge[] = edges;
export const fraudRings = [
  { id: "RING-001", name: "Synthetic ID Ring — East Coast", size: 9, avgRisk: 0.91, nodes: ringAccounts.map((a) => a.id) },
  { id: "RING-002", name: "Bust-Out Cluster", size: 4, avgRisk: 0.62, nodes: bgAcc.slice(0, 4).map((n) => n.id) },
  { id: "RING-003", name: "Account Takeover Pattern", size: 3, avgRisk: 0.55, nodes: bgAcc.slice(4, 7).map((n) => n.id) },
];

// --- Credit applications ---
const grades: CreditApplication["riskGrade"][] = ["A", "B", "C", "D", "E", "F", "G"];
const adversePool = [
  "Insufficient length of credit history",
  "Too many recent inquiries",
  "High balance-to-limit ratio on revolving accounts",
  "Delinquent past or present credit obligations",
  "Insufficient income relative to requested amount",
  "Limited types of credit in use",
  "Recent derogatory public record",
];
export const creditApplications: CreditApplication[] = Array.from({ length: 32 }, (_, i) => {
  const score = rint(320, 830);
  const grade = grades[Math.min(6, Math.floor((830 - score) / 75))];
  const decision: CreditApplication["decision"] = score > 680 ? "approved" : score > 580 ? "review" : "declined";
  const bins = ["dti", "utilization", "inquiries_6m", "credit_age_months", "delinq_24m", "income_band"].map((f) => ({
    feature: f, bin: pick(["<10%", "10-30%", "30-60%", ">60%", "0", "1-2", "3+", "<12m", "12-60m", ">60m"]),
    woe: +rng(-1.2, 1.2).toFixed(3),
    points: rint(-40, 60),
  }));
  return {
    id: `APP-${String(70000 + i).padStart(6, "0")}`,
    applicantId: `APL-${rint(10000, 99999)}`,
    requestedAmount: rint(500, 50000),
    creditScore: score,
    riskGrade: grade,
    decision,
    date: ts(rint(0, 29)),
    scorecardBins: bins,
    adverseActionReasons: decision === "declined" ? [...adversePool].sort(() => rnd() - 0.5).slice(0, 3) : undefined,
  };
});

// --- 30-day monitoring metrics ---
export const monitoring: MonitoringMetric[] = Array.from({ length: 30 }, (_, i) => {
  const drift = i / 30;
  return {
    date: new Date(Date.UTC(2026, 4, 15 + i)).toISOString().slice(0, 10),
    psiFraud: +(0.05 + rng(0, 0.1) + drift * 0.05).toFixed(3),
    psiCredit: +(0.08 + rng(0, 0.12) + drift * 0.22).toFixed(3),
    aucFraud: +(0.94 - drift * 0.03 + rng(-0.01, 0.01)).toFixed(3),
    ksCredit: +(0.52 - drift * 0.04 + rng(-0.02, 0.02)).toFixed(3),
    latencyP50: +rng(22, 30).toFixed(1),
    latencyP95: +rng(45, 62).toFixed(1),
    latencyP99: +rng(70, 95).toFixed(1),
  };
});

// --- 24h transaction volume ---
export const txVolume24h = Array.from({ length: 24 }, (_, h) => ({
  hour: `${String(h).padStart(2, "0")}:00`,
  volume: Math.round(8000 + Math.sin((h / 24) * Math.PI * 2) * 3500 + rng(-600, 600)),
  fraud: +Math.max(0.2, 1.1 + Math.sin((h / 24) * Math.PI) * 0.6 + rng(-0.2, 0.2)).toFixed(2),
}));

// --- Fraud score histogram ---
export const fraudScoreHist = Array.from({ length: 20 }, (_, i) => ({
  bucket: `${(i * 0.05).toFixed(2)}`,
  count: Math.round(2000 * Math.exp(-i * 0.35) + rng(0, 80)),
}));

// --- Agent log ---
const actions: AgentLogEntry["action"][] = ["auto_resolved", "escalated", "recommendation_made"];
const reasonsPool = [
  "Low risk score and no graph linkage; auto-closed per policy threshold.",
  "Score above critical; escalated to senior analyst with full feature breakdown.",
  "Recommended request-info due to mismatched device fingerprint.",
  "Pattern matched known fraud ring; escalated immediately.",
  "Score within tolerance band; recommended close after KG check.",
  "Velocity spike detected within 10min window; escalated.",
];
export const agentLog: AgentLogEntry[] = Array.from({ length: 110 }, (_, i) => {
  const action = actions[i % actions.length];
  return {
    id: `LOG-${String(900000 + i).padStart(6, "0")}`,
    timestamp: ts(Math.floor(i / 20), i % 20),
    alertId: alerts[i % alerts.length].id,
    action,
    reasoning: pick(reasonsPool),
    humanOverride: action !== "auto_resolved" && rnd() < 0.18,
  };
});

// --- KPI snapshot ---
export const kpis = {
  tps: 1247,
  fraudRate: 1.12,
  approvalRate: 96.8,
  avgLatencyMs: 34,
  autoResolvedPct: 78.4,
};
