"""
train_fraud_model.py
=====================
End-to-end training pipeline for the fraud detection model.

Usage:
    python train_fraud_model.py --data path/to/transactions.csv

Expects a CSV with at minimum:
    - transaction_id, account_id, timestamp, amount
    - a binary target column named 'is_fraud' (1 = fraud, 0 = legit)
    - any additional raw features (merchant, device_id, country, etc.)

If you don't have a labelled dataset yet, point --data at the Kaggle
IEEE-CIS Fraud Detection train_transaction.csv (merge train_identity.csv
on TransactionID first) and rename the target column to 'is_fraud'.

Outputs (saved to ./models/):
    - fraud_model.joblib       -> dict with model, feature list, threshold, metadata
    - fraud_model_shap.png     -> SHAP summary plot for sanity-checking features
    - training_report.json     -> metrics for the run
"""

import argparse
import json
import warnings
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
import xgboost as xgb
from sklearn.metrics import (
    roc_auc_score, average_precision_score, precision_recall_curve,
    f1_score, confusion_matrix, classification_report
)

warnings.filterwarnings("ignore")

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
MODELS_DIR.mkdir(exist_ok=True)


# ──────────────────────────────────────────────────────────────────────────
# 1. Feature engineering
# ──────────────────────────────────────────────────────────────────────────
def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build velocity, aggregation, and time-based features from raw transactions.
    Assumes df is sorted by timestamp already (caller's responsibility, but we
    re-sort defensively).
    """
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)

    # --- Time-based features ---
    df["hour_of_day"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
    df["is_night"] = ((df["hour_of_day"] >= 0) & (df["hour_of_day"] <= 5)).astype(int)

    # --- Velocity features per account (rolling time windows) ---
    df = df.set_index("timestamp")
    velocity_frames = []
    for window, label in [("1min", "1m"), ("10min", "10m"), ("1h", "1h"), ("24h", "24h")]:
        grp = (
            df.groupby("account_id")["amount"]
            .rolling(window, closed="left")
            .agg(["count", "sum"])
            .rename(columns={"count": f"txn_count_{label}", "sum": f"txn_sum_{label}"})
        )
        velocity_frames.append(grp)

    df = df.reset_index()
    for vf in velocity_frames:
        vf = vf.reset_index()
        df = df.merge(vf, on=["account_id", "timestamp"], how="left")

    velocity_cols = [c for c in df.columns if c.startswith("txn_count_") or c.startswith("txn_sum_")]
    df[velocity_cols] = df[velocity_cols].fillna(0)

    # --- Time since last transaction per account ---
    df["seconds_since_last_txn"] = (
        df.groupby("account_id")["timestamp"].diff().dt.total_seconds()
    )
    df["seconds_since_last_txn"] = df["seconds_since_last_txn"].fillna(99999)

    # --- Amount-based ratio features ---
    account_avg = df.groupby("account_id")["amount"].transform("mean")
    df["amount_to_account_avg_ratio"] = df["amount"] / account_avg.replace(0, np.nan)
    df["amount_to_account_avg_ratio"] = df["amount_to_account_avg_ratio"].fillna(1.0)

    # --- Distinct merchant / country / device counts in last 24h (if columns exist) ---
    for col in ["merchant", "country", "device_id"]:
        if col in df.columns:
            df = df.sort_values("timestamp").reset_index(drop=True)
            distinct_counts = np.zeros(len(df), dtype=int)
            window = pd.Timedelta("24h")

            for account, group in df.groupby("account_id"):
                idx = group.index.to_numpy()
                times = group["timestamp"].to_numpy()
                vals = group[col].to_numpy()
                left = 0
                seen = {}
                for right in range(len(idx)):
                    # slide left pointer to maintain a 24h trailing window (exclusive of current row)
                    while times[left] <= times[right] - window:
                        seen_val = vals[left]
                        seen[seen_val] -= 1
                        if seen[seen_val] == 0:
                            del seen[seen_val]
                        left += 1
                    distinct_counts[idx[right]] = len(seen)
                    seen[vals[right]] = seen.get(vals[right], 0) + 1

            df[f"distinct_{col}_24h"] = distinct_counts

    return df


# ──────────────────────────────────────────────────────────────────────────
# 2. Preprocessing
# ──────────────────────────────────────────────────────────────────────────
def fit_freq_encoders(df: pd.DataFrame, cat_cols: list) -> dict[str, pd.Series]:
    encoders: dict[str, pd.Series] = {}
    for col in cat_cols:
        if col in df.columns:
            encoders[col] = df[col].value_counts(normalize=True)
    return encoders


def apply_freq_encoders(df: pd.DataFrame, cat_cols: list, encoders: dict[str, pd.Series]) -> pd.DataFrame:
    df = df.copy()
    for col in cat_cols:
        if col in df.columns and col in encoders:
            df[f"{col}_freq_enc"] = df[col].map(encoders[col]).fillna(0)
            df = df.drop(columns=[col])
    return df


def time_based_split(df: pd.DataFrame, timestamp_col="timestamp", test_size=0.2):
    """Split chronologically: train on earlier data, test on later. Avoids leakage from shuffled time series."""
    df = df.sort_values(timestamp_col)
    split_idx = int(len(df) * (1 - test_size))
    train_df = df.iloc[:split_idx].copy()
    test_df = df.iloc[split_idx:].copy()
    return train_df, test_df


# ──────────────────────────────────────────────────────────────────────────
# 3. Training
# ──────────────────────────────────────────────────────────────────────────
def train_model(X_train, y_train, X_val, y_val):
    """Train XGBoost with class imbalance handling via scale_pos_weight."""
    scale_pos_weight = (y_train == 0).sum() / max((y_train == 1).sum(), 1)
    print(f"  scale_pos_weight = {scale_pos_weight:.2f}  (fraud rate: {y_train.mean()*100:.3f}%)")

    model = xgb.XGBClassifier(
        n_estimators=400,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos_weight,
        eval_metric="aucpr",
        early_stopping_rounds=30,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )
    return model


def cross_validate_time_series(X, y, n_splits=5):
    """Expanding-window time-series CV on chronologically ordered training data."""
    n = len(X)
    min_train = max(n // (n_splits + 2), 1000)
    fold_size = max((n - min_train) // n_splits, 1)
    auc_scores, ap_scores = [], []

    for fold in range(n_splits):
        val_start = min_train + fold * fold_size
        val_end = min(val_start + fold_size, n)
        if val_start >= n or val_end <= val_start:
            break

        X_tr, X_val = X.iloc[:val_start], X.iloc[val_start:val_end]
        y_tr, y_val = y.iloc[:val_start], y.iloc[val_start:val_end]

        scale_pos_weight = (y_tr == 0).sum() / max((y_tr == 1).sum(), 1)
        model = xgb.XGBClassifier(
            n_estimators=300, max_depth=6, learning_rate=0.05,
            scale_pos_weight=scale_pos_weight, eval_metric="aucpr",
            random_state=42, n_jobs=-1,
        )
        model.fit(X_tr, y_tr)
        preds = model.predict_proba(X_val)[:, 1]

        auc = roc_auc_score(y_val, preds)
        ap = average_precision_score(y_val, preds)
        auc_scores.append(auc)
        ap_scores.append(ap)
        print(f"  Fold {fold+1}: AUC={auc:.4f}  PR-AUC={ap:.4f}  (train={len(X_tr):,}, val={len(X_val):,})")

    if not auc_scores:
        return {"mean_auc": 0.0, "mean_pr_auc": 0.0}

    print(f"  Mean AUC: {np.mean(auc_scores):.4f} (+/- {np.std(auc_scores):.4f})")
    print(f"  Mean PR-AUC: {np.mean(ap_scores):.4f} (+/- {np.std(ap_scores):.4f})")
    return {"mean_auc": float(np.mean(auc_scores)), "mean_pr_auc": float(np.mean(ap_scores))}


def find_optimal_threshold(y_true, y_proba, cost_fn=500, cost_fp=5):
    """
    Pick the threshold that minimises total business cost.
    cost_fn: average $ cost of a missed fraud (false negative)
    cost_fp: average $ cost of wrongly blocking a legit txn (false positive, e.g. customer friction)
    """
    precisions, recalls, thresholds = precision_recall_curve(y_true, y_proba)
    best_threshold, best_cost = 0.5, float("inf")

    for t in thresholds:
        preds = (y_proba >= t).astype(int)
        tn, fp, fn, tp = confusion_matrix(y_true, preds).ravel()
        total_cost = fn * cost_fn + fp * cost_fp
        if total_cost < best_cost:
            best_cost = total_cost
            best_threshold = t

    return float(best_threshold), float(best_cost)


# ──────────────────────────────────────────────────────────────────────────
# 4. Main pipeline
# ──────────────────────────────────────────────────────────────────────────
def main(data_path: str, target_col: str = "is_fraud"):
    print("=" * 70)
    print("FRAUD MODEL TRAINING PIPELINE")
    print("=" * 70)

    # --- Load ---
    print("\n[1/8] Loading data...")
    df = pd.read_csv(data_path)
    print(f"  Loaded {len(df):,} rows, fraud rate: {df[target_col].mean()*100:.3f}%")

    required = {"timestamp", "account_id", "amount", target_col}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # --- Feature engineering ---
    print("\n[2/8] Engineering features (velocity, time, ratios)...")
    df = engineer_features(df)
    print(f"  {df.shape[1]} columns after feature engineering")

    # --- Time-based split (before encoding — fit encoders on train only) ---
    print("\n[3/8] Splitting train/test chronologically...")
    train_df, test_df = time_based_split(df, test_size=0.2)
    print(f"  Train: {len(train_df):,} rows | Test: {len(test_df):,} rows")

    print("\n[4/8] Encoding categoricals (train-fit)...")
    cat_cols = [c for c in ["merchant", "country", "device_id", "card_type"] if c in df.columns]
    freq_encoders = fit_freq_encoders(train_df, cat_cols)
    train_df = apply_freq_encoders(train_df, cat_cols, freq_encoders)
    test_df = apply_freq_encoders(test_df, cat_cols, freq_encoders)

    drop_cols = ["transaction_id", "account_id", "timestamp", target_col]
    feature_cols = [c for c in train_df.columns if c not in drop_cols]
    feature_cols = [
        c for c in feature_cols
        if train_df[c].dtype in [np.float64, np.int64, np.float32, np.int32]
    ]

    X_train, y_train = train_df[feature_cols], train_df[target_col]
    X_test, y_test = test_df[feature_cols], test_df[target_col]

    # Further split train into train/val for early stopping
    val_split = int(len(X_train) * 0.85)
    X_tr, X_val = X_train.iloc[:val_split], X_train.iloc[val_split:]
    y_tr, y_val = y_train.iloc[:val_split], y_train.iloc[val_split:]

    # --- Cross-validation (on train set only, for honest generalisation estimate) ---
    print("\n[5/8] Running 5-fold time-series cross-validation...")
    cv_results = cross_validate_time_series(X_train, y_train)

    # --- Final model training ---
    print("\n[6/8] Training final model on full training set...")
    model = train_model(X_tr, y_tr, X_val, y_val)

    # --- Evaluation on held-out test set ---
    print("\n[7/8] Evaluating on held-out test set...")
    test_proba = model.predict_proba(X_test)[:, 1]
    test_auc = roc_auc_score(y_test, test_proba)
    test_ap = average_precision_score(y_test, test_proba)

    threshold, est_cost = find_optimal_threshold(y_test.values, test_proba)
    test_preds = (test_proba >= threshold).astype(int)
    f1 = f1_score(y_test, test_preds)

    print(f"  Test AUC-ROC:  {test_auc:.4f}")
    print(f"  Test PR-AUC:   {test_ap:.4f}")
    print(f"  Optimal threshold: {threshold:.4f}")
    print(f"  F1 @ threshold: {f1:.4f}")
    print("\n" + classification_report(y_test, test_preds, target_names=["legit", "fraud"]))

    # --- SHAP explainability sanity check ---
    print("\n[8/8] Generating SHAP explainability plot...")
    explainer = shap.TreeExplainer(model)
    sample = X_test.sample(min(2000, len(X_test)), random_state=42)
    shap_values = explainer.shap_values(sample)

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    shap.summary_plot(shap_values, sample, show=False, max_display=15)
    plt.tight_layout()
    plt.savefig(MODELS_DIR / "fraud_model_shap.png", dpi=150)
    plt.close()

    mean_abs_shap = np.abs(shap_values).mean(axis=0)
    top_features = sorted(zip(feature_cols, mean_abs_shap), key=lambda x: -x[1])[:10]
    print("  Top 10 features by mean |SHAP|:")
    for feat, val in top_features:
        print(f"    {feat}: {val:.4f}")

    # --- Save artifact bundle ---
    artifact = {
        "model": model,
        "feature_cols": feature_cols,
        "threshold": threshold,
        "freq_encoders": freq_encoders,
        "cat_cols": cat_cols,
        "metadata": {
            "trained_at": datetime.utcnow().isoformat(),
            "test_auc": float(test_auc),
            "test_pr_auc": float(test_ap),
            "cv_mean_auc": cv_results["mean_auc"],
            "f1_at_threshold": float(f1),
            "n_train_rows": len(X_train),
            "n_test_rows": len(X_test),
            "fraud_rate": float(df[target_col].mean()),
            "top_features": [f for f, _ in top_features],
        },
    }
    joblib.dump(artifact, MODELS_DIR / "fraud_model.joblib")
    print(f"\n[OK] Model artifact saved to {MODELS_DIR / 'fraud_model.joblib'}")

    with open(MODELS_DIR / "training_report.json", "w") as f:
        json.dump(artifact["metadata"], f, indent=2)
    print(f"[OK] Training report saved to {MODELS_DIR / 'training_report.json'}")

    print("\n" + "=" * 70)
    print("DONE. Load this artifact in FastAPI with:")
    print('  artifact = joblib.load("models/fraud_model.joblib")')
    print('  model, features, threshold = artifact["model"], artifact["feature_cols"], artifact["threshold"]')
    print("=" * 70)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="Path to labelled transactions CSV")
    parser.add_argument("--target", default="is_fraud", help="Name of the binary target column")
    args = parser.parse_args()
    main(args.data, args.target)
