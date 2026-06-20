from typing import Literal

from pydantic import BaseModel, Field


class TopFeature(BaseModel):
    name: str
    impact: float


class VelocityFeature(BaseModel):
    window: Literal["1min", "10min", "1hr", "24hr"]
    count: int
    sumAmount: float


class FraudScoreRequest(BaseModel):
    transaction_id: str | None = None
    account_id: str
    timestamp: str | None = None
    amount: float
    merchant: str | None = None
    country: str | None = None
    device_id: str | None = None


class FraudScoreResponse(BaseModel):
    fraud_score: float
    risk_tier: str
    threshold: float
    top_features: list[TopFeature]
    velocity_features: list[VelocityFeature]
    ai_recommendation: str | None = None
    confidence: int | None = None


class ScorecardBin(BaseModel):
    feature: str
    bin: str
    woe: float
    points: float


class CreditScoreRequest(BaseModel):
    applicant_id: str | None = None
    revolving_utilization: float | None = None
    age: float | None = None
    past_due_30_59: float | None = None
    debt_ratio: float | None = None
    monthly_income: float | None = None
    open_credit_lines: float | None = None
    past_due_90: float | None = None
    real_estate_loans: float | None = None
    past_due_60_89: float | None = None
    dependents: float | None = None


class CreditScoreResponse(BaseModel):
    credit_score: int
    risk_grade: str
    decision: str
    scorecard_bins: list[ScorecardBin]
    adverse_action_reasons: list[str] | None = None


class Alert(BaseModel):
    id: str
    timestamp: str
    accountId: str
    amount: float
    fraudScore: float
    creditScore: int | None = None
    riskTier: str
    aiRecommendation: str
    confidence: int
    status: Literal["pending", "resolved", "escalated"]
    merchant: str
    location: str
    device: str
    topFeatures: list[TopFeature]
    velocityFeatures: list[VelocityFeature]
    agentReasoning: list[dict] = Field(default_factory=list)


class CreditApplication(BaseModel):
    id: str
    applicantId: str
    requestedAmount: float
    creditScore: int
    riskGrade: str
    decision: str
    date: str
    scorecardBins: list[ScorecardBin]
    adverseActionReasons: list[str] | None = None


class MonitoringMetric(BaseModel):
    date: str
    psiFraud: float
    psiCredit: float
    aucFraud: float
    ksCredit: float
    latencyP50: float
    latencyP95: float
    latencyP99: float
