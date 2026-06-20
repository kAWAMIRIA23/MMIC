# Model training data

## Fraud (IEEE-CIS)

Place Kaggle IEEE-CIS Fraud Detection files under `archive (8)/` or run:

```bash
python src/prepare_ieee_fraud_data.py \
  --transactions "data/archive (8)/train_transaction.csv" \
  --identity "data/archive (8)/train_identity.csv" \
  --output data/transactions.csv \
  --sample 100000
```

## Credit (Give Me Some Credit)

```bash
python src/prepare_gmsc_credit_data.py --output data/applications.csv
```

Downloads the public GMSC training CSV and maps `SeriousDlqin2yrs` → `default`.
