export type {
  Alert,
  CreditApplication,
  MonitoringMetric,
  AgentLogEntry,
  GraphNode,
  GraphEdge,
} from "@/lib/mockData";

export interface Kpis {
  tps: number;
  fraudRate: number;
  approvalRate: number;
  avgLatencyMs: number;
  autoResolvedPct: number;
}

export interface TxVolumePoint {
  hour: string;
  volume: number;
  fraud: number;
}

export interface FraudScoreBucket {
  bucket: string;
  count: number;
}

export interface FraudScoreResult {
  fraud_score: number;
  risk_tier: string;
  threshold: number;
  top_features: { name: string; impact: number }[];
  velocity_features: { window: string; count: number; sumAmount: number }[];
}

export interface CreditScoreResult {
  credit_score: number;
  risk_grade: string;
  decision: string;
  scorecard_bins: { feature: string; bin: string; woe: number; points: number }[];
  adverse_action_reasons?: string[];
}
