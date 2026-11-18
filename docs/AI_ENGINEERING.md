# FinSphere AI – FraudShield: Explainable AI, Graph & Agentic Engineering

## 1. Explainable ML Risk Scoring (`backend/app/ml/risk_engine.py`)
- **Thresholds**:
  - `0–30`: **Low Risk**
  - `31–69`: **Medium Risk**
  - `70–100`: **High Risk**
- **8 Interpretable Features**:
  1. `amount_deviation`: Z-score of transaction amount vs. the user's historical mean and standard deviation.
  2. `velocity_1h`: Burst transaction frequency within a 60-minute window.
  3. `ip_reputation`: Threat intelligence score from VPN/TOR/Hosting/Blacklist checks.
  4. `device_trust`: Trusted vs. unverified vs. suspicious/blocked device state.
  5. `geo_anomaly`: Geographic deviation from baseline user locations.
  6. `recipient_history`: First-time recipient vs. recurring verified recipient.
  7. `time_of_day`: Late-night activity window (`01:00–05:00` local time).
  8. `tx_type_risk`: High-liquidity channels (`Cash Out`, `Wire Transfer`) vs. routine bill payments.
- **Transparency**: Every prediction returns additive `contribution_points` and plain-English explanations stored in `risk_assessments.feature_explanations_json`.

## 2. Graph Relationship Analysis (`backend/app/graph/network_analyzer.py`)
- Implemented with `NetworkX` using a Neo4j-compatible node/edge schema (`institution`, `device`, `ip`, `recipient`).
- Identifies:
  - **High-Fanout IP Addresses** (single IP targeting `>= 3` distinct recipients)
  - **Repeated Recipient Hubs**
  - **Cross-Institution Convergence** (multiple banks/wallets funneling to one recipient)

## 3. Controlled Agentic Orchestration (`backend/app/agents/orchestrator.py`)
- **RiskAnalysisAgent**: Fuses `ml_score` (55%), `graph_score` (20%), and `rule_score` (25%).
- **DecisionAgent**: Emits bounded actions (`Approve`, `Request Additional Verification`, `Flag for Review`, `Escalate to Human Investigation`).
- **CommunicationAgent & Guardrails**:
  - Human approval is required for high-impact decisions (`>= 70`).
  - **Strict Honesty Guardrail**: AI never executes or claims autonomous bank/MFS holds unless an authorized provider API explicitly supports it.
