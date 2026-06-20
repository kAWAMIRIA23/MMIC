from pathlib import Path

from app.core.config import get_settings

settings = get_settings()

FRAUD_ARTIFACT = settings.models_dir / "fraud_model.joblib"
CREDIT_ARTIFACT = settings.models_dir / "credit_scorecard.joblib"
FRAUD_REPORT = settings.models_dir / "training_report.json"
CREDIT_REPORT = settings.models_dir / "scorecard_report.json"
TRANSACTIONS_CSV = settings.data_dir / "transactions.csv"
APPLICATIONS_CSV = settings.data_dir / "applications.csv"

_fraud_artifact = None
_credit_artifact = None


def load_fraud_artifact():
    global _fraud_artifact
    if _fraud_artifact is None and FRAUD_ARTIFACT.exists():
        import joblib

        _fraud_artifact = joblib.load(FRAUD_ARTIFACT)
    return _fraud_artifact


def load_credit_artifact():
    global _credit_artifact
    if _credit_artifact is None and CREDIT_ARTIFACT.exists():
        import joblib

        _credit_artifact = joblib.load(CREDIT_ARTIFACT)
    return _credit_artifact
