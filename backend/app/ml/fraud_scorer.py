import numpy as np
import pandas as pd

from app.ml.fraud_features import apply_freq_encoders, engineer_features
from app.ml.loader import load_fraud_artifact


def tier_for_score(score: float) -> str:
    if score < 0.3:
        return "low"
    if score < 0.6:
        return "medium"
    if score < 0.85:
        return "high"
    return "critical"


def recommendation_for_tier(tier: str) -> str:
    if tier == "critical":
        return "escalate"
    if tier == "high":
        return "request_info"
    return "close"


def score_transactions(df: pd.DataFrame) -> pd.DataFrame:
    artifact = load_fraud_artifact()
    if artifact is None:
        raise RuntimeError("Fraud model artifact not found. Run model training first.")

    engineered = engineer_features(df)
    cat_cols = artifact.get("cat_cols", [])
    encoders = artifact.get("freq_encoders", {})
    encoded = apply_freq_encoders(engineered, cat_cols, encoders)

    feature_cols = artifact["feature_cols"]
    missing = [c for c in feature_cols if c not in encoded.columns]
    for col in missing:
        encoded[col] = 0

    X = encoded[feature_cols].reset_index(drop=True)
    model = artifact["model"]
    threshold = artifact["threshold"]
    proba = model.predict_proba(X)[:, 1]

    importances = model.feature_importances_
    top_idx = np.argsort(importances)[::-1][:6]

    results = []
    for pos, (_, row) in enumerate(encoded.reset_index(drop=True).iterrows()):
        score = float(proba[pos])
        tier = tier_for_score(score)
        top_features = [
            {"name": feature_cols[j], "impact": round(float(importances[j]), 3)}
            for j in top_idx
        ]
        velocity = [
            {
                "window": label,
                "count": int(row.get(f"txn_count_{suffix}", 0)),
                "sumAmount": round(float(row.get(f"txn_sum_{suffix}", 0)), 2),
            }
            for label, suffix in [("1min", "1m"), ("10min", "10m"), ("1hr", "1h"), ("24hr", "24h")]
        ]
        results.append(
            {
                "fraud_score": round(score, 3),
                "risk_tier": tier,
                "threshold": threshold,
                "top_features": top_features,
                "velocity_features": velocity,
                "ai_recommendation": recommendation_for_tier(tier),
                "confidence": int(min(99, max(55, score * 100))),
            }
        )

    return pd.DataFrame(results, index=encoded.index)


def score_single(payload: dict) -> dict:
    df = pd.DataFrame([payload])
    if "timestamp" not in df.columns:
        df["timestamp"] = pd.Timestamp.utcnow().isoformat()
    scored = score_transactions(df)
    return scored.iloc[0].to_dict()
