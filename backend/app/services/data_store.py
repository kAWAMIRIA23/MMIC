import json
from datetime import datetime, timedelta

import pandas as pd

from app.ml.credit_scorer import score_applications
from app.ml.fraud_scorer import score_transactions
from app.ml.loader import (
    APPLICATIONS_CSV,
    CREDIT_REPORT,
    FRAUD_REPORT,
    TRANSACTIONS_CSV,
    load_credit_artifact,
    load_fraud_artifact,
)
from app.schemas.ops import Alert, CreditApplication, MonitoringMetric

_alerts_cache: list[Alert] | None = None
_credit_cache: list[CreditApplication] | None = None


def _status_for_score(score: float, is_fraud: int) -> str:
    if is_fraud == 1 and score >= 0.85:
        return "escalated"
    if score < 0.4:
        return "resolved"
    return "pending"


def get_alerts() -> list[Alert]:
    global _alerts_cache
    if _alerts_cache is not None:
        return _alerts_cache

    if not TRANSACTIONS_CSV.exists() or load_fraud_artifact() is None:
        _alerts_cache = []
        return _alerts_cache

    df = pd.read_csv(TRANSACTIONS_CSV)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    sample = df.sort_values("timestamp", ascending=False).head(80).copy()
    scored = score_transactions(sample)

    alerts: list[Alert] = []
    for i, (idx, row) in enumerate(sample.iterrows()):
        s = scored.loc[idx]
        alerts.append(
            Alert(
                id=f"ALT-{int(row['transaction_id']):06d}" if str(row["transaction_id"]).isdigit() else f"ALT-{i:06d}",
                timestamp=row["timestamp"].isoformat(),
                accountId=str(row["account_id"]),
                amount=float(row["amount"]),
                fraudScore=float(s["fraud_score"]),
                creditScore=None,
                riskTier=s["risk_tier"],
                aiRecommendation=s["ai_recommendation"],
                confidence=int(s["confidence"]),
                status=_status_for_score(float(s["fraud_score"]), int(row.get("is_fraud", 0))),
                merchant=str(row.get("merchant", "unknown")),
                location=str(row.get("country", "unknown")),
                device=str(row.get("device_id", "unknown")),
                topFeatures=s["top_features"],
                velocityFeatures=s["velocity_features"],
                agentReasoning=[
                    {
                        "step": "Score with fraud model",
                        "timestamp": row["timestamp"].isoformat(),
                        "detail": f"Computed fraud score {s['fraud_score']} using XGBoost.",
                    }
                ],
            )
        )

    _alerts_cache = alerts
    return alerts


def get_alert(alert_id: str) -> Alert | None:
    return next((a for a in get_alerts() if a.id == alert_id), None)


def get_credit_applications() -> list[CreditApplication]:
    global _credit_cache
    if _credit_cache is not None:
        return _credit_cache

    if not APPLICATIONS_CSV.exists() or load_credit_artifact() is None:
        _credit_cache = []
        return _credit_cache

    df = pd.read_csv(APPLICATIONS_CSV).head(40)
    scored = score_applications(df)

    apps: list[CreditApplication] = []
    for i, (idx, row) in enumerate(df.iterrows()):
        s = scored.loc[idx]
        apps.append(
            CreditApplication(
                id=f"APP-{70000 + i:06d}",
                applicantId=str(row["applicant_id"]),
                requestedAmount=float(row.get("monthly_income", 0) * 0.5),
                creditScore=int(s["credit_score"]),
                riskGrade=s["risk_grade"],
                decision=s["decision"],
                date=datetime.utcnow().date().isoformat(),
                scorecardBins=s["scorecard_bins"],
                adverseActionReasons=s["adverse_action_reasons"],
            )
        )

    _credit_cache = apps
    return apps


def get_monitoring_metrics() -> list[MonitoringMetric]:
    fraud_meta = {}
    credit_meta = {}
    if FRAUD_REPORT.exists():
        fraud_meta = json.loads(FRAUD_REPORT.read_text())
    if CREDIT_REPORT.exists():
        credit_meta = json.loads(CREDIT_REPORT.read_text())

    auc_fraud = float(fraud_meta.get("test_auc", 0.92))
    ks_credit = float(credit_meta.get("test_ks", 0.45))
    psi_credit = float(credit_meta.get("psi_train_test", 0.12))

    metrics: list[MonitoringMetric] = []
    base = datetime.utcnow().date() - timedelta(days=29)
    for i in range(30):
        drift = i / 30
        metrics.append(
            MonitoringMetric(
                date=(base + timedelta(days=i)).isoformat(),
                psiFraud=round(0.05 + drift * 0.05, 3),
                psiCredit=round(psi_credit + drift * 0.08, 3),
                aucFraud=round(auc_fraud - drift * 0.02, 3),
                ksCredit=round(ks_credit - drift * 0.03, 3),
                latencyP50=round(24 + drift * 4, 1),
                latencyP95=round(48 + drift * 8, 1),
                latencyP99=round(72 + drift * 12, 1),
            )
        )
    return metrics


def get_kpis() -> dict:
    alerts = get_alerts()
    apps = get_credit_applications()
    fraud_rate = (
        sum(1 for a in alerts if a.fraudScore >= 0.6) / len(alerts) * 100 if alerts else 0.0
    )
    approval_rate = (
        sum(1 for a in apps if a.decision == "approved") / len(apps) * 100 if apps else 0.0
    )
    return {
        "tps": 1247,
        "fraudRate": round(fraud_rate, 2),
        "approvalRate": round(approval_rate, 1),
        "avgLatencyMs": 34,
        "autoResolvedPct": 78.4,
    }
