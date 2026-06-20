from fastapi import APIRouter, HTTPException

from app.services.data_store import get_alert, get_alerts

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
def list_alerts():
    return get_alerts()


@router.get("/{alert_id}")
def get_alert_by_id(alert_id: str):
    alert = get_alert(alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert
