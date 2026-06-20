from fastapi import APIRouter

from app.api.v1 import agent_log, alerts, credit, health, monitoring, overview, scoring

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(scoring.router)
api_router.include_router(alerts.router)
api_router.include_router(credit.router)
api_router.include_router(monitoring.router)
api_router.include_router(overview.router)
api_router.include_router(agent_log.router)
