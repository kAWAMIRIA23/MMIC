import numpy as np
import pandas as pd

from app.ml.loader import load_credit_artifact

BASE_SCORE = 600
BASE_ODDS = 50
PDO = 20


def grade_for_score(score: float) -> str:
    grades = ["A", "B", "C", "D", "E", "F", "G"]
    idx = min(6, max(0, int((830 - score) / 75)))
    return grades[idx]


def decision_for_score(score: float) -> str:
    if score > 680:
        return "approved"
    if score > 580:
        return "review"
    return "declined"


def probability_to_score(proba: float, scaling: dict | None = None) -> float:
    scaling = scaling or {"base_score": BASE_SCORE, "base_odds": BASE_ODDS, "pdo": PDO}
    factor = scaling["pdo"] / np.log(2)
    offset = scaling["base_score"] - factor * np.log(scaling["base_odds"])
    clipped = float(np.clip(proba, 1e-6, 1 - 1e-6))
    log_odds = np.log((1 - clipped) / clipped)
    score = offset + factor * log_odds
    return float(np.clip(score, 300, 850))


def score_applications(df: pd.DataFrame) -> pd.DataFrame:
    artifact = load_credit_artifact()
    if artifact is None:
        raise RuntimeError("Credit scorecard artifact not found. Run model training first.")

    binning_process = artifact["binning_process"]
    logreg = artifact["logreg"]
    selected = artifact["selected_features"]
    scorecard_table = artifact["scorecard_table"]
    scaling = artifact.get("scaling")

    feature_names = [c for c in df.columns if c not in {"applicant_id", "default"}]
    X = df[feature_names].copy()
    X_woe_full = binning_process.transform(X[feature_names], metric="woe")
    X_woe = X_woe_full[selected].fillna(0)
    proba = logreg.predict_proba(X_woe)[:, 1]

    rows = []
    for pos, (_, row) in enumerate(df.reset_index(drop=True).iterrows()):
        score = probability_to_score(float(proba[pos]), scaling)
        grade = grade_for_score(score)
        decision = decision_for_score(score)
        bins = _match_scorecard_bins(row, scorecard_table, selected)
        adverse = None
        if decision == "declined":
            adverse = [f"{b['feature']} (bin: {b['bin']})" for b in sorted(bins, key=lambda x: x["points"])[:3]]
        rows.append(
            {
                "credit_score": int(round(score)),
                "risk_grade": grade,
                "decision": decision,
                "scorecard_bins": bins,
                "adverse_action_reasons": adverse,
            }
        )
    return pd.DataFrame(rows, index=df.index)


def _match_scorecard_bins(row: pd.Series, table: pd.DataFrame, features: list) -> list:
    bins = []
    for feat in features:
        feat_bins = table[table["feature"] == feat]
        if feat_bins.empty:
            continue
        best = feat_bins.iloc[0]
        bins.append(
            {
                "feature": feat,
                "bin": str(best["bin"]),
                "woe": float(best["woe"]),
                "points": float(best["points"]),
            }
        )
    return bins


def score_single(payload: dict) -> dict:
    df = pd.DataFrame([payload])
    scored = score_applications(df)
    return scored.iloc[0].to_dict()
