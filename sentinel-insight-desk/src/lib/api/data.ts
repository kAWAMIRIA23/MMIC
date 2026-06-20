import { api } from "@/lib/api/client";
import { graphEdges, graphNodes, fraudRings } from "@/lib/mockData";

const FALLBACK = {
  alerts: [] as import("@/lib/mockData").Alert[],
  creditApplications: [] as import("@/lib/mockData").CreditApplication[],
  monitoring: [] as import("@/lib/mockData").MonitoringMetric[],
  kpis: { tps: 0, fraudRate: 0, approvalRate: 0, avgLatencyMs: 0, autoResolvedPct: 0 },
  txVolume24h: [] as import("@/lib/api/types").TxVolumePoint[],
  fraudScoreHist: [] as import("@/lib/api/types").FraudScoreBucket[],
  agentLog: [] as import("@/lib/mockData").AgentLogEntry[],
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function loadAlerts() {
  return safe(() => api.getAlerts(), FALLBACK.alerts);
}

export async function loadAlert(id: string) {
  return api.getAlert(id);
}

export async function loadCreditApplications() {
  return safe(() => api.getCreditApplications(), FALLBACK.creditApplications);
}

export async function loadMonitoring() {
  return safe(() => api.getMonitoring(), FALLBACK.monitoring);
}

export async function loadKpis() {
  return safe(() => api.getKpis(), FALLBACK.kpis);
}

export async function loadTxVolume24h() {
  return safe(() => api.getTxVolume24h(), FALLBACK.txVolume24h);
}

export async function loadFraudScoreHist() {
  return safe(() => api.getFraudScoreHist(), FALLBACK.fraudScoreHist);
}

export async function loadAgentLog() {
  return safe(() => api.getAgentLog(), FALLBACK.agentLog);
}

export { graphNodes, graphEdges, fraudRings };
