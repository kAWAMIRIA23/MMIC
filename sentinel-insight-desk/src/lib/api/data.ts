import { api } from "@/lib/api/client";
import {
  alerts as mockAlerts,
  creditApplications as mockCredit,
  monitoring as mockMonitoring,
  kpis as mockKpis,
  txVolume24h as mockTxVolume,
  fraudScoreHist as mockFraudHist,
  agentLog as mockAgentLog,
  graphEdges,
  graphNodes,
  fraudRings,
} from "@/lib/mockData";

const FALLBACK = {
  alerts: mockAlerts,
  creditApplications: mockCredit,
  monitoring: mockMonitoring,
  kpis: mockKpis,
  txVolume24h: mockTxVolume,
  fraudScoreHist: mockFraudHist,
  agentLog: mockAgentLog,
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
  try {
    return await api.getAlert(id);
  } catch {
    return mockAlerts.find((a) => a.id === id) ?? null;
  }
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
