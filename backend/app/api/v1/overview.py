from fastapi import APIRouter

from app.services.data_store import get_alerts, get_kpis, get_monitoring_metrics

router = APIRouter(prefix="/overview", tags=["overview"])


@router.get("/kpis")
def kpis():
    return get_kpis()


@router.get("/tx-volume-24h")
def tx_volume_24h():
    alerts = get_alerts()
    buckets = {h: {"hour": f"{h:02d}:00", "volume": 0, "fraud": 0.0} for h in range(24)}
    for alert in alerts:
        hour = int(alert.timestamp[11:13]) if len(alert.timestamp) >= 13 else 0
        buckets[hour]["volume"] += 1
        if alert.fraudScore >= 0.6:
            buckets[hour]["fraud"] += 1
    for b in buckets.values():
        if b["volume"]:
            b["fraud"] = round(b["fraud"] / b["volume"] * 100, 2)
    return list(buckets.values())


@router.get("/fraud-score-hist")
def fraud_score_hist():
    alerts = get_alerts()
    hist = [{"bucket": f"{i * 0.05:.2f}", "count": 0} for i in range(20)]
    for alert in alerts:
        idx = min(19, int(alert.fraudScore / 0.05))
        hist[idx]["count"] += 1
    return hist
