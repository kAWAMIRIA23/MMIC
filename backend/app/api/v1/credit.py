from fastapi import APIRouter

from app.services.data_store import get_credit_applications

router = APIRouter(prefix="/credit", tags=["credit"])


@router.get("/applications")
def list_credit_applications():
    return get_credit_applications()
