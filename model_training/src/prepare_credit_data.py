"""Map credit_risk_dataset.csv to the schema expected by train_credit_scorecard.py."""

import argparse
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]


def prepare(source_path: Path, output_path: Path) -> None:
    df = pd.read_csv(source_path)
    print(f"Loaded {len(df):,} rows from {source_path}")

    out = df.copy()
    out.insert(0, "applicant_id", [f"APL-{i:06d}" for i in range(len(out))])
    out = out.rename(columns={"loan_status": "default"})

    # Clip employment length sentinel values (dataset uses 123.0 for missing)
    if "person_emp_length" in out.columns:
        out["person_emp_length"] = out["person_emp_length"].clip(upper=50)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(output_path, index=False)
    print(f"Saved {len(out):,} rows to {output_path} (default rate {out['default'].mean()*100:.2f}%)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        default=str(ROOT / "data" / "archive (8)" / "credit_risk_dataset.csv"),
    )
    parser.add_argument("--output", default=str(ROOT / "data" / "applications.csv"))
    args = parser.parse_args()
    prepare(Path(args.source), Path(args.output))
