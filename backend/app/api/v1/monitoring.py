from fastapi import APIRouter

from app.services.data_store import get_monitoring_metrics

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/metrics")
def monitoring_metrics():
    return get_monitoring_metrics()
