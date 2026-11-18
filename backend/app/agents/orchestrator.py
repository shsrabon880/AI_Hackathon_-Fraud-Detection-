from typing import Any, Dict, List


def run_agentic_decision_workflow(
    *,
    ml_score: float,
    graph_score: float,
    ip_risk_score: float,
    device_trust_status: str,
    amount: float,
    feature_explanations: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Controlled Agentic Orchestration Pipeline:
    1. RiskAnalysisAgent -> fuses ML, Graph, IP, and Device signals.
    2. DecisionAgent -> selects a bounded, policy-compliant recommendation.
    3. CommunicationAgent -> generates clear human-readable security guidance.

    GUARDRAIL: AI never executes autonomous real-bank holds without an explicit
    authorized provider API and human approval.
    """
    # Weighted ensemble score
    rule_score = 15.0
    if device_trust_status in ("suspicious", "blocked"):
        rule_score += 45.0
    elif device_trust_status == "unverified":
        rule_score += 20.0
    if ip_risk_score >= 70:
        rule_score += 30.0
    if amount >= 100000:
        rule_score += 15.0
    rule_score = min(100.0, rule_score)

    overall_score = round(min(100.0, (0.55 * ml_score) + (0.20 * graph_score) + (0.25 * rule_score)), 1)

    if overall_score <= 30:
        risk_level = "Low Risk"
        recommended_action = "Approve"
        notification_title = "Transaction Verified (Low Risk)"
        rationale = (
            "ML behavioral scoring, device trust, and network IP checks all fall within normal bounds. "
            "No suspicious graph patterns detected."
        )
    elif overall_score <= 69:
        risk_level = "Medium Risk"
        recommended_action = "Request Additional Verification"
        notification_title = "Step-Up Verification Recommended"
        top_drivers = ", ".join(f["label"] for f in feature_explanations[:2])
        rationale = (
            f"Moderate anomaly detected (score {overall_score}/100) driven primarily by: {top_drivers}. "
            "Recommend user confirmation before finalizing or trusting this activity."
        )
    else:
        risk_level = "High Risk"
        if ip_risk_score >= 75 or device_trust_status == "blocked":
            recommended_action = "Escalate to Human Investigation"
        else:
            recommended_action = "Flag for Review"
        notification_title = "High-Risk Financial Activity Flagged"
        top_drivers = ", ".join(f["label"] for f in feature_explanations[:3])
        rationale = (
            f"High fraud probability ({overall_score}/100) triggered by {top_drivers}. "
            "Human analyst review required. Note: External bank/MFS holds require an authorized provider API and user approval."
        )

    return {
        "overall_score": overall_score,
        "risk_level": risk_level,
        "ml_score": ml_score,
        "graph_score": round(graph_score, 1),
        "rule_score": round(rule_score, 1),
        "recommended_action": recommended_action,
        "agent_rationale": rationale,
        "communication_preview": {
            "title": notification_title,
            "requires_human_approval": overall_score >= 70,
            "automated_bank_hold_executed": False,
        },
    }
