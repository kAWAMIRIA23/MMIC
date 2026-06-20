const API_BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api/v1";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getAlerts: () => fetchJson<import("./types").Alert[]>("/alerts"),
  getAlert: (id: string) => fetchJson<import("./types").Alert>(`/alerts/${id}`),
  getCreditApplications: () => fetchJson<import("./types").CreditApplication[]>("/credit/applications"),
  getMonitoring: () => fetchJson<import("./types").MonitoringMetric[]>("/monitoring/metrics"),
  getKpis: () => fetchJson<import("./types").Kpis>("/overview/kpis"),
  getTxVolume24h: () => fetchJson<import("./types").TxVolumePoint[]>("/overview/tx-volume-24h"),
  getFraudScoreHist: () => fetchJson<import("./types").FraudScoreBucket[]>("/overview/fraud-score-hist"),
  getAgentLog: () => fetchJson<import("./types").AgentLogEntry[]>("/agent-log"),
  scoreFraud: (body: Record<string, unknown>) =>
    fetchJson<import("./types").FraudScoreResult>("/score/fraud", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  scoreCredit: (body: Record<string, unknown>) =>
    fetchJson<import("./types").CreditScoreResult>("/score/credit", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export { API_BASE };
