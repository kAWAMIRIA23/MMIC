"""
train_credit_scorecard.py
===========================
End-to-end training pipeline for the credit risk scorecard.

Usage:
    python train_credit_scorecard.py --data path/to/applications.csv

Expects a CSV with at minimum:
    - applicant_id
    - a binary target column named 'default' (1 = defaulted, 0 = good)
    - numeric/categorical features (income, age, debt_ratio, employment_length, etc.)

Good public datasets: "Give Me Some Credit" or "Home Credit Default Risk" (Kaggle).
Rename their target columns to 'default' before running.

Outputs (saved to ./models/):
    - credit_scorecard.joblib   -> dict with binning rules, points table, model, metadata
    - scorecard_table.csv       -> human-readable points table (feature, bin, points)
    - scorecard_report.json     -> Gini, KS, IV summary
"""

import argparse
import json
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from optbinning import BinningProcess
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
MODELS_DIR.mkdir(exist_ok=True)

# Standard scorecard scaling constants (industry convention)
BASE_SCORE = 600
BASE_ODDS = 50        # odds of good:bad at base score
PDO = 20               # points to double the odds


# ──────────────────────────────────────────────────────────────────────────
# 1. Metrics
# ──────────────────────────────────────────────────────────────────────────
def ks_statistic(y_true, y_proba):
    """Kolmogorov-Smirnov statistic: max separation between good/bad cumulative distributions."""
    df = pd.DataFrame({"y": y_true, "p": y_proba}).sort_values("p")
    df["cum_good"] = (df["y"] == 0).cumsum() / (df["y"] == 0).sum()
    df["cum_bad"] = (df["y"] == 1).cumsum() / (df["y"] == 1).sum()
    return float(np.max(np.abs(df["cum_good"] - df["cum_bad"])))


def gini_coefficient(y_true, y_proba):
    auc = roc_auc_score(y_true, y_proba)
    return float(2 * auc - 1)


def population_stability_index(expected, actual, bins=10):
    """PSI between two score distributions. >0.25 typically triggers retraining."""
    breakpoints = np.linspace(min(expected.min(), actual.min()),
                               max(expected.max(), actual.max()), bins + 1)
    expected_pct = np.histogram(expected, breakpoints)[0] / len(expected)
    actual_pct = np.histogram(actual, breakpoints)[0] / len(actual)
    expected_pct = np.where(expected_pct == 0, 0.0001, expected_pct)
    actual_pct = np.where(actual_pct == 0, 0.0001, actual_pct)
    psi = np.sum((actual_pct - expected_pct) * np.log(actual_pct / expected_pct))
    return float(psi)


# ──────────────────────────────────────────────────────────────────────────
# 2. WoE binning + Information Value filtering
# ──────────────────────────────────────────────────────────────────────────
def fit_binning(X: pd.DataFrame, y: pd.Series, feature_names: list):
    """Fit optimal WoE binning per feature using optbinning's BinningProcess."""
    binning_process = BinningProcess(variable_names=feature_names)
    binning_process.fit(X[feature_names], y)
    return binning_process


def compute_information_value(binning_process: BinningProcess, feature_names: list) -> pd.DataFrame:
    """Pull IV per feature and rank for feature selection."""
    rows = []
    for name in feature_names:
        try:
            opt_binning_table = binning_process.get_binned_variable(name).binning_table
            opt_binning_table.build()
            iv = opt_binning_table.iv
            rows.append({"feature": name, "iv": iv})
        except Exception:
            rows.append({"feature": name, "iv": 0.0})
    iv_df = pd.DataFrame(rows).sort_values("iv", ascending=False)
    return iv_df


def iv_strength(iv: float) -> str:
    if iv < 0.02:
        return "unpredictive"
    elif iv < 0.1:
        return "weak"
    elif iv < 0.3:
        return "medium"
    else:
        return "strong"


# ──────────────────────────────────────────────────────────────────────────
# 3. Points scorecard conversion
# ──────────────────────────────────────────────────────────────────────────
def build_points_scorecard(binning_process: BinningProcess, logreg: LogisticRegression,
                            feature_names: list) -> pd.DataFrame:
    """
    Convert logistic regression coefficients (fit on WoE-transformed features)
    into a points-based scorecard using the standard PDO scaling formula.
    """
    factor = PDO / np.log(2)
    offset = BASE_SCORE - factor * np.log(BASE_ODDS)

    n_features = len(feature_names)
    intercept = logreg.intercept_[0]
    rows = []

    for i, name in enumerate(feature_names):
        coef = float(logreg.coef_[0][i])
        opt_binning_table = binning_process.get_binned_variable(name).binning_table
        table_df = opt_binning_table.build()

        # Drop the trailing "Totals" summary row and any row without a valid numeric WoE
        table_df = table_df[table_df["Bin"] != "Totals"]

        for _, row in table_df.iterrows():
            bin_label = row.get("Bin", None)
            woe_raw = row.get("WoE", None)
            try:
                woe = float(woe_raw)
            except (TypeError, ValueError):
                continue
            if bin_label is None or pd.isna(woe):
                continue
            # Points formula: -(coef * woe + intercept/n_features) * factor + offset/n_features
            points = -(coef * woe + intercept / n_features) * factor + offset / n_features
            rows.append({
                "feature": name,
                "bin": str(bin_label),
                "woe": round(woe, 4),
                "points": round(float(points), 1),
            })

    return pd.DataFrame(rows)


# ──────────────────────────────────────────────────────────────────────────
# 4. Adverse action reasons (for declined applicants)
# ──────────────────────────────────────────────────────────────────────────
def get_adverse_action_reasons(applicant_row: pd.Series, scorecard_table: pd.DataFrame,
                                top_n: int = 3) -> list:
    """Return the top N lowest-points (most negative contribution) reasons for a declined applicant."""
    applicant_points = scorecard_table[scorecard_table["feature"].isin(applicant_row.index)]
    lowest = applicant_points.sort_values("points").head(top_n)
    return [f"{row['feature']} (bin: {row['bin']})" for _, row in lowest.iterrows()]


# ──────────────────────────────────────────────────────────────────────────
# 5. Main pipeline
# ──────────────────────────────────────────────────────────────────────────
def main(data_path: str, target_col: str = "default", iv_threshold: float = 0.02):
    print("=" * 70)
    print("CREDIT SCORECARD TRAINING PIPELINE")
    print("=" * 70)

    # --- Load ---
    print("\n[1/7] Loading data...")
    df = pd.read_csv(data_path)
    print(f"  Loaded {len(df):,} rows, default rate: {df[target_col].mean()*100:.2f}%")

    id_cols = [c for c in ["applicant_id", "id", "SK_ID_CURR"] if c in df.columns]
    feature_names = [c for c in df.columns if c not in id_cols + [target_col]]
    # Keep only numeric + low-cardinality categorical for simplicity
    feature_names = [c for c in feature_names if df[c].dtype != "object" or df[c].nunique() < 20]
    print(f"  Using {len(feature_names)} candidate features")

    X = df[feature_names].copy()
    y = df[target_col].copy()

    # --- Train/test split ---
    print("\n[2/7] Splitting train/test (80/20, stratified)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )
    print(f"  Train: {len(X_train):,} | Test: {len(X_test):,}")

    # --- WoE binning ---
    print("\n[3/7] Fitting WoE optimal binning per feature...")
    binning_process = fit_binning(X_train, y_train, feature_names)

    # --- Information Value filtering ---
    print("\n[4/7] Computing Information Value and filtering weak features...")
    iv_df = compute_information_value(binning_process, feature_names)
    iv_df["strength"] = iv_df["iv"].apply(iv_strength)
    print(iv_df.to_string(index=False))

    selected_features = iv_df[iv_df["iv"] >= iv_threshold]["feature"].tolist()
    print(f"\n  {len(selected_features)}/{len(feature_names)} features retained (IV >= {iv_threshold})")

    if len(selected_features) < 2:
        print("  WARNING: very few features passed IV threshold. Lowering threshold to 0.0.")
        selected_features = feature_names

    # --- Transform to WoE space ---
    # NOTE: BinningProcess.transform() expects ALL variables it was originally fit on,
    # not just the IV-filtered subset. We transform on the full set, then select columns.
    print("\n[5/7] Transforming features to WoE space...")
    X_train_woe_full = binning_process.transform(X_train[feature_names], metric="woe")
    X_test_woe_full = binning_process.transform(X_test[feature_names], metric="woe")
    X_train_woe = X_train_woe_full[selected_features].fillna(0)
    X_test_woe = X_test_woe_full[selected_features].fillna(0)

    # --- Fit logistic regression on WoE features ---
    print("\n[6/7] Fitting logistic regression on WoE-transformed features...")
    logreg = LogisticRegression(max_iter=1000, random_state=42)
    logreg.fit(X_train_woe, y_train)

    train_proba = logreg.predict_proba(X_train_woe)[:, 1]
    test_proba = logreg.predict_proba(X_test_woe)[:, 1]

    train_gini = gini_coefficient(y_train, train_proba)
    test_gini = gini_coefficient(y_test, test_proba)
    train_ks = ks_statistic(y_train.values, train_proba)
    test_ks = ks_statistic(y_test.values, test_proba)
    psi = population_stability_index(train_proba, test_proba)

    print(f"  Train Gini: {train_gini:.4f}  |  Test Gini: {test_gini:.4f}")
    print(f"  Train KS:   {train_ks:.4f}  |  Test KS:   {test_ks:.4f}")
    print(f"  PSI (train vs test): {psi:.4f}  {'⚠ drift signal' if psi > 0.25 else '(stable)'}")

    # --- Build points scorecard ---
    print("\n[7/7] Building points-based scorecard...")
    scorecard_table = build_points_scorecard(binning_process, logreg, selected_features)
    scorecard_table.to_csv(MODELS_DIR / "scorecard_table.csv", index=False)
    print(scorecard_table.head(15).to_string(index=False))

    # --- Convert probabilities to final scores for reference ---
    factor = PDO / np.log(2)
    offset = BASE_SCORE - factor * np.log(BASE_ODDS)
    test_log_odds = np.log((1 - test_proba) / np.clip(test_proba, 1e-6, None))
    test_scores = offset + factor * test_log_odds
    test_scores = np.clip(test_scores, 300, 850)
    print(f"\n  Sample score distribution (test set): "
          f"min={test_scores.min():.0f}, mean={test_scores.mean():.0f}, max={test_scores.max():.0f}")

    # --- Save artifact bundle ---
    artifact = {
        "binning_process": binning_process,
        "logreg": logreg,
        "selected_features": selected_features,
        "scorecard_table": scorecard_table,
        "scaling": {"base_score": BASE_SCORE, "base_odds": BASE_ODDS, "pdo": PDO},
        "metadata": {
            "trained_at": datetime.utcnow().isoformat(),
            "train_gini": train_gini,
            "test_gini": test_gini,
            "train_ks": train_ks,
            "test_ks": test_ks,
            "psi_train_test": psi,
            "n_train_rows": len(X_train),
            "n_test_rows": len(X_test),
            "default_rate": float(y.mean()),
            "iv_table": iv_df.to_dict(orient="records"),
        },
    }
    joblib.dump(artifact, MODELS_DIR / "credit_scorecard.joblib")
    print(f"\n✓ Scorecard artifact saved to {MODELS_DIR / 'credit_scorecard.joblib'}")

    with open(MODELS_DIR / "scorecard_report.json", "w") as f:
        json.dump(artifact["metadata"], f, indent=2, default=str)
    print(f"✓ Scorecard report saved to {MODELS_DIR / 'scorecard_report.json'}")

    print("\n" + "=" * 70)
    print("DONE. Load this artifact in FastAPI with:")
    print('  artifact = joblib.load("models/credit_scorecard.joblib")')
    print('  binning_process, logreg = artifact["binning_process"], artifact["logreg"]')
    print("=" * 70)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="Path to labelled applications CSV")
    parser.add_argument("--target", default="default", help="Name of the binary target column")
    parser.add_argument("--iv-threshold", type=float, default=0.02, help="Minimum IV to keep a feature")
    args = parser.parse_args()
    main(args.data, args.target, args.iv_threshold)
