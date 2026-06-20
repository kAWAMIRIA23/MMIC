"""Fraud feature engineering (mirrors model_training/src/train_fraud_model.py)."""

import numpy as np
import pandas as pd


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)

    df["hour_of_day"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
    df["is_night"] = ((df["hour_of_day"] >= 0) & (df["hour_of_day"] <= 5)).astype(int)

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

    df["seconds_since_last_txn"] = df.groupby("account_id")["timestamp"].diff().dt.total_seconds()
    df["seconds_since_last_txn"] = df["seconds_since_last_txn"].fillna(99999)

    account_avg = df.groupby("account_id")["amount"].transform("mean")
    df["amount_to_account_avg_ratio"] = df["amount"] / account_avg.replace(0, np.nan)
    df["amount_to_account_avg_ratio"] = df["amount_to_account_avg_ratio"].fillna(1.0)

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
                seen: dict = {}
                for right in range(len(idx)):
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


def apply_freq_encoders(df: pd.DataFrame, cat_cols: list, encoders: dict) -> pd.DataFrame:
    df = df.copy()
    for col in cat_cols:
        if col in df.columns and col in encoders:
            df[f"{col}_freq_enc"] = df[col].map(encoders[col]).fillna(0)
            df = df.drop(columns=[col])
    return df
