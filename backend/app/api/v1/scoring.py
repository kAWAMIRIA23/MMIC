from fastapi import APIRouter, HTTPException

from app.ml.credit_scorer import score_single as score_credit
from app.ml.fraud_scorer import score_single as score_fraud
from app.schemas.ops import CreditScoreRequest, CreditScoreResponse, FraudScoreRequest, FraudScoreResponse

router = APIRouter(prefix="/score", tags=["scoring"])


@router.post("/fraud", response_model=FraudScoreResponse)
def fraud_score(payload: FraudScoreRequest) -> FraudScoreResponse:
    try:
        result = score_fraud(payload.model_dump(exclude_none=True))
        return FraudScoreResponse(**result)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/credit", response_model=CreditScoreResponse)
def credit_score(payload: CreditScoreRequest) -> CreditScoreResponse:
    try:
        result = score_credit(payload.model_dump(exclude_none=True))
        return CreditScoreResponse(**result)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
