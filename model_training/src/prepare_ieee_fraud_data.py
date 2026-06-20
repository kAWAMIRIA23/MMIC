"""
prepare_ieee_fraud_data.py
Map IEEE-CIS Fraud Detection CSVs to the schema expected by train_fraud_model.py.
"""

import argparse
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
IEEE_EPOCH = pd.Timestamp("2017-12-01")


def prepare(
    transactions_path: Path,
    identity_path: Path | None,
    output_path: Path,
    sample: int | None = None,
) -> None:
    print(f"Loading transactions from {transactions_path}...")
    tx = pd.read_csv(transactions_path)

    if identity_path and identity_path.exists():
        print(f"Merging identity from {identity_path}...")
        ident = pd.read_csv(identity_path)
        tx = tx.merge(ident, on="TransactionID", how="left")

    device_col = "DeviceInfo" if "DeviceInfo" in tx.columns else None
    if device_col is None and "id_30" in tx.columns:
        device_col = "id_30"

    out = pd.DataFrame(
        {
            "transaction_id": tx["TransactionID"].astype(str),
            "account_id": tx["card1"].astype(str) + "_" + tx.get("addr1", pd.Series(0, index=tx.index)).astype(str),
            "timestamp": IEEE_EPOCH + pd.to_timedelta(tx["TransactionDT"], unit="s"),
            "amount": tx["TransactionAmt"],
            "is_fraud": tx["isFraud"],
            "merchant": tx["ProductCD"].astype(str),
            "country": tx.get("addr1", pd.Series(0, index=tx.index)).astype(str),
            "device_id": tx[device_col].astype(str) if device_col else "unknown",
            "card_type": tx.get("card4", pd.Series("unknown", index=tx.index)).astype(str),
        }
    )

    if sample and sample < len(out):
        fraud = out[out["is_fraud"] == 1]
        legit = out[out["is_fraud"] == 0]
        fraud_n = min(len(fraud), max(int(sample * out["is_fraud"].mean()), 500))
        legit_n = sample - fraud_n
        out = pd.concat(
            [fraud.sample(n=fraud_n, random_state=42), legit.sample(n=legit_n, random_state=42)],
            ignore_index=True,
        ).sort_values("timestamp")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(output_path, index=False)
    print(f"Saved {len(out):,} rows to {output_path} (fraud rate {out['is_fraud'].mean()*100:.3f}%)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--transactions", required=True)
    parser.add_argument("--identity", default=None)
    parser.add_argument("--output", default=str(ROOT / "data" / "transactions.csv"))
    parser.add_argument("--sample", type=int, default=None, help="Optional row cap for faster training")
    args = parser.parse_args()

    prepare(
        Path(args.transactions),
        Path(args.identity) if args.identity else None,
        Path(args.output),
        args.sample,
    )
