"""
prepare_gmsc_credit_data.py
Download Give Me Some Credit (GMSC) training data and map to scorecard schema.
"""

import argparse
from pathlib import Path
from urllib.request import urlretrieve

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
GMSC_URL = (
    "https://raw.githubusercontent.com/nsethi31/Kaggle-Credit-Risk-Modeling/master/data/cs-training.csv"
)


def prepare(output_path: Path, source_url: str = GMSC_URL, sample: int | None = None) -> None:
    cache = ROOT / "data" / "cs-training.csv"
    if not cache.exists():
        print(f"Downloading GMSC data from {source_url}...")
        cache.parent.mkdir(parents=True, exist_ok=True)
        urlretrieve(source_url, cache)
    else:
        print(f"Using cached {cache}")

    df = pd.read_csv(cache)
    if "Unnamed: 0" in df.columns:
        df = df.drop(columns=["Unnamed: 0"])

    out = pd.DataFrame(
        {
            "applicant_id": df["Id"].astype(str),
            "default": df["SeriousDlqin2yrs"],
            "revolving_utilization": df["RevolvingUtilizationOfUnsecuredLines"],
            "age": df["age"],
            "past_due_30_59": df["NumberOfTime30-59DaysPastDueNotWorse"],
            "debt_ratio": df["DebtRatio"],
            "monthly_income": df["MonthlyIncome"],
            "open_credit_lines": df["NumberOfOpenCreditLinesAndLoans"],
            "past_due_90": df["NumberOfTimes90DaysLate"],
            "real_estate_loans": df["NumberRealEstateLoansOrLines"],
            "past_due_60_89": df["NumberOfTime60-89DaysPastDueNotWorse"],
            "dependents": df["NumberOfDependents"],
        }
    )
    out = out.fillna(out.median(numeric_only=True))

    if sample and sample < len(out):
        out = out.sample(n=sample, random_state=42)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(output_path, index=False)
    print(f"Saved {len(out):,} rows to {output_path} (default rate {out['default'].mean()*100:.2f}%)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(ROOT / "data" / "applications.csv"))
    parser.add_argument("--sample", type=int, default=None)
    args = parser.parse_args()
    prepare(Path(args.output), sample=args.sample)
