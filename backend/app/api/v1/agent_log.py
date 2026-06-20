from fastapi import APIRouter

from app.services.data_store import get_alerts

router = APIRouter(prefix="/agent-log", tags=["agent-log"])


@router.get("")
def agent_log():
    alerts = get_alerts()
    entries = []
    actions = ["auto_resolved", "escalated", "recommendation_made"]
    for i, alert in enumerate(alerts[:50]):
        action = actions[i % len(actions)]
        entries.append(
            {
                "id": f"LOG-{900000 + i:06d}",
                "timestamp": alert.timestamp,
                "alertId": alert.id,
                "action": action,
                "reasoning": f"Fraud score {alert.fraudScore}; action {action.replace('_', ' ')}.",
                "humanOverride": action != "auto_resolved" and i % 5 == 0,
            }
        )
    return entries
