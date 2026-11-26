# FinSphere AI – FraudShield: References, Documentation & Executive Summary

**Project Name:** FinSphere AI – FraudShield  
**Vision:** *"Predict. Explain. Prevent. Protect."*  
**Team:** Team Innovexis  
**Category:** AI-Powered FinTech & Cybersecurity  

---

## Presentation-Ready Executive Summary

**FinSphere AI – FraudShield** is a full-stack real-time financial fraud detection, explainable risk analysis, and security intelligence platform engineered for Bangladesh's digital financial ecosystem—covering major commercial banks (City Bank, Dutch-Bangla Bank Limited, Dhaka Bank, Islami Bank Bangladesh, Trust Bank, Eastern Bank Limited, BRAC Bank, Bank Asia, Prime Bank, Standard Chartered Bangladesh) and Mobile Financial Services (bKash, Nagad, Rocket, upay).

### Core Problem Addressed
Digital financial crime across Bangladesh frequently succeeds because everyday users and analysts lack pre-transfer recipient verification, unified cross-institution transaction visibility, and transparent explanations for risk decisions. Traditional rule-only systems suffer from rigid thresholds and high false positives, while unsafe third-party lookup tools jeopardize user credentials.

### Implemented Solution Pillars
1. **3-Tier Automated Risk Decision Engine (`transactions.py`, `RiskDecisionContext.tsx`)**:
   - **Tier 1 (0–30% Low Risk):** Auto-approved (`AUTO_APPROVED`) synchronously with an emerald confirmation toast.
   - **Tier 2 (31–79% Medium Risk):** Pauses transfer (`PENDING_USER_APPROVAL`) and opens an interactive **"Approve or Not?"** confirmation interface.
   - **Tier 3 (80–100% High Risk):** Immediately auto-rejects (`AUTO_REJECTED`), triggers a synthesized **Web Audio API** security alarm (`alarmAudio.ts`), and displays a full-screen **FRAUD ALERT** takeover with forensic telemetry.
2. **8-Feature Explainable ML & Weighted Ensemble (`risk_engine.py`, `orchestrator.py`)**:
   - Evaluates `amount_deviation` (Z-score), `velocity_1h`, `ip_reputation`, `device_trust`, `geo_anomaly`, `recipient_history`, `time_of_day`, and `tx_type_risk`.
   - Computes additive feature contribution points (`RiskFeatureContribution`) fused via weighted ensemble: `overall_score = 0.55 * ml_score + 0.20 * graph_score + 0.25 * rule_score`.
3. **Graph Intelligence (`network_analyzer.py`)**:
   - Uses **NetworkX** directed graphs mirroring Neo4j-compatible node/edge schemas (`device -> ip -> institution -> recipient`) to detect High-Fanout IPs, Repeated Recipient Hubs, and Cross-Institution Convergence.
4. **Recipient Intelligence & Bank Account Lookup (`recipient_intel.py`, `RecipientLookupSection.tsx`)**:
   - Validates BD mobile formats (`01XXXXXXXXX` / `+8801XXXXXXXXX`), identifies carriers, searches 10 Bangladeshi banks with masked accounts (`********XXXX`), renders Google Maps location context, provides Consent-Gated AI Summaries (OpenAI `gpt-4o-mini` with deterministic local fallback), and enforces strict anti-fabrication on unconsented third-party numbers.
5. **Enterprise OWASP-Aligned Security & Zero-Credential Policy (`security.py`, `deps.py`)**:
   - Enforces `Argon2id` password hashing, `PyJWT` access/refresh tokens backed by live `user_sessions` DB revocation (`jti`), `Fernet`-encrypted `PyOTP` TOTP MFA, double-submit CSRF tokens, RBAC, sliding-window rate limiting, audit logging, and strict `user_id` owner isolation. Never collects or stores banking passwords, MFS PINs, or OTPs.
6. **Model Context Protocol (`mcp_server.py`)**:
   - Implements `FinSphere-FraudShield-MCP` using Python `mcp 2.3.0` (`MCPServer` over `stdio`) exposing `lookup_recipient_phone`, `lookup_bank_account`, and `list_supported_bd_banks`.

---

## Honest Implementation Verification Matrix

| Component / Feature | Current Verification Status | Evidence in Codebase |
|---|---|---|
| FastAPI REST API + 11 SQLAlchemy ORM Tables | **Fully Implemented** | `backend/app/main.py`, `backend/app/models/models.py` |
| Argon2id + JWT/JTI Sessions + TOTP MFA (Fernet) + CSRF + RBAC | **Fully Implemented** | `backend/app/core/security.py`, `backend/app/api/deps.py` |
| 8-Feature Additive Explainable ML Scorer + Agentic Ensemble | **Fully Implemented** | `backend/app/ml/risk_engine.py`, `backend/app/agents/orchestrator.py` |
| 3-Tier Risk Routing (0–30%, 31–79%, 80–100% FRAUD ALERT + Audio) | **Fully Implemented** | `backend/app/api/v1/transactions.py`, `frontend/src/context/RiskDecisionContext.tsx`, `frontend/src/utils/alarmAudio.ts` |
| NetworkX Fraud Ring Graph Analysis | **Fully Implemented** | `backend/app/graph/network_analyzer.py` |
| CSV & Text-PDF Statement Ingestion (`pypdf`) + SHA-256 Deduplication | **Fully Implemented** | `backend/app/ingestion/statement_parser.py` |
| Recipient Phone & Bank Risk Lookup + 14 BD Institution Logos | **Implemented (Hybrid Owner Data + Labeled Demo Profiles)** | `backend/app/api/v1/recipient_intel.py`, `frontend/src/components/RecipientLookupSection.tsx` |
| Consent-Gated OpenAI `gpt-4o-mini` / Local Summarizer Fallback | **Implemented (Optional Key + Local Fallback)** | `backend/app/api/v1/recipient_intel.py`, `backend/app/core/config.py` |
| MCP Server (`FinSphere-FraudShield-MCP`) | **Fully Implemented (`stdio`)** | `backend/app/mcp_server.py` |
| React 18 + TypeScript + Recharts + Google Maps Embed UI | **Fully Implemented** | `frontend/src/`, `frontend/src/pages/` |
| Automated Backend Suite (`pytest`) & Production Vite Build | **Verified (`7/7` tests passed, `0` build errors)** | `backend/tests/test_fraudshield.py`, `frontend/dist/` |
| Bank/MFS Live Open Banking APIs, IP Threat Feeds (`ip_intelligence`), Device SIM Telemetry | **Synthetic / Sandbox Demo + Explicit `Not Available` Bounds** | `backend/app/db/seed.py`, `backend/app/api/v1/connectors.py` |
| Live Neo4j Cluster, Kafka Streaming, Redis Distributed Cache, XGBoost/SHAP Offline Retraining, Federated Learning | **Planned / Future Enhancement** | Documented as upgrade paths in Chapters 5, 10, 16, 17, and 22 |

---

## IEEE-Style References

[1] OWASP Foundation, *OWASP Top Ten 2021: The Ten Most Critical Web Application Security Risks*, OWASP, 2021. [Online]. Available: https://owasp.org/Top10/  
[2] OWASP Foundation, *Password Storage Cheat Sheet (Argon2id Guidelines)*, OWASP Cheat Sheet Series, 2024. [Online]. Available: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html  
[3] S. Ramirez, *FastAPI: Modern, Fast (High-Performance) Web Framework for Building APIs with Python*, Documentation, 2024. [Online]. Available: https://fastapi.tiangolo.com/  
[4] SQLAlchemy Authors, *SQLAlchemy 2.0 Documentation — Object Relational Mapper & Core*, 2024. [Online]. Available: https://docs.sqlalchemy.org/  
[5] Pydantic Services Inc., *Pydantic v2 Documentation — Data Validation Using Python Type Annotations*, 2024. [Online]. Available: https://docs.pydantic.dev/  
[6] A. Hagberg, D. Schult, and P. Swart, "Exploring network structure, dynamics, and function using NetworkX," in *Proc. 7th Python in Science Conf. (SciPy)*, Pasadena, CA, USA, 2008, pp. 11–15.  
[7] M. Thoma et al., *pypdf: A Pure-Python PDF Library Capable of Splitting, Merging, Cropping, and Transforming PDF Pages*, 2024. [Online]. Available: https://pypdf.readthedocs.io/  
[8] M. B. Jones, J. Bradley, and N. Sakimura, *JSON Web Token (JWT)*, IETF RFC 7519, May 2015.  
[9] D. M'Raihi, S. Machani, M. Pei, and J. Rydell, *TOTP: Time-Based One-Time Password Algorithm*, IETF RFC 6238, May 2011.  
[10] A. Biryukov, D. Dinu, and D. Khovratovich, "Argon2: New generation of memory-hard functions for password hashing and other applications," in *Proc. IEEE Eur. Symp. Security and Privacy (EuroS&P)*, Saarbrücken, Germany, 2016, pp. 292–302.  
[11] Meta Platforms Inc., *React 18 Documentation — A JavaScript Library for Building User Interfaces*, 2024. [Online]. Available: https://react.dev/  
[12] Microsoft Corporation, *TypeScript Documentation — JavaScript with Syntax for Types*, 2024. [Online]. Available: https://www.typescriptlang.org/  
[13] Evan You & Vite Contributors, *Vite: Next Generation Frontend Tooling*, 2024. [Online]. Available: https://vite.dev/  
[14] Tailwind Labs, *Tailwind CSS v3 Documentation*, 2024. [Online]. Available: https://tailwindcss.com/docs  
[15] Recharts Group, *Recharts: A Composable Charting Library Built on React Components*, 2024. [Online]. Available: https://recharts.org/  
[16] Bangladesh Bank (Central Bank of Bangladesh), *Mobile Financial Services (MFS) Comparative Summary Statement*, Payment Systems Department, Dhaka, Bangladesh, 2024. [Online]. Available: https://www.bb.org.bd/  
[17] S. M. Lundberg and S.-I. Lee, "A unified approach to interpreting model predictions," in *Adv. Neural Inf. Process. Syst. (NeurIPS)*, vol. 30, pp. 4765–4774, 2017.  
[18] T. Chen and C. Guestrin, "XGBoost: A scalable tree boosting system," in *Proc. 22nd ACM SIGKDD Int. Conf. Knowledge Discovery and Data Mining*, San Francisco, CA, USA, 2016, pp. 785–794.  
[19] L. Breiman, "Random forests," *Machine Learning*, vol. 45, no. 1, pp. 5–32, Oct. 2001.  
[20] F. T. Liu, K. M. Ting, and Z.-H. Zhou, "Isolation forest," in *Proc. 8th IEEE Int. Conf. Data Mining (ICDM)*, Pisa, Italy, 2008, pp. 413–422.  
[21] A. Dal Pozzolo, O. Caelen, R. A. Johnson, and G. Bontempi, "Calibrating probability with undersampling for unbalanced classification," in *Proc. IEEE Symp. Ser. Comput. Intell. (SSCI)*, Cape Town, South Africa, 2015, pp. 159–166.  
[22] Model Context Protocol Authors, *Model Context Protocol (MCP) Python SDK v2 Documentation*, Anthropic / Open Source Specification, 2025. [Online]. Available: https://modelcontextprotocol.io/  
[23] OpenAI, *OpenAI API Reference — Chat Completions & Responsible AI Usage Guidelines*, 2024. [Online]. Available: https://platform.openai.com/docs/  
[24] Google LLC, *Maps JavaScript API & Embed Documentation*, Google Developers, 2024. [Online]. Available: https://developers.google.com/maps  
[25] W3C Audio Working Group, *Web Audio API Specification*, World Wide Web Consortium (W3C), 2021. [Online]. Available: https://www.w3.org/TR/webaudio/  
[26] Neo4j Inc., *Neo4j Graph Data Science & Cypher Query Language Manual*, 2024. [Online]. Available: https://neo4j.com/docs/  
[27] C. Kreps, N. Narkhede, and J. Rao, "Kafka: A distributed messaging system for log processing," in *Proc. NetDB*, Athens, Greece, 2011, pp. 1–7.  
[28] Vercel Inc. & Render Services Inc., *Production Frontend Rewrites & Managed Python Web Service Deployment Documentation*, 2024. [Online]. Available: https://vercel.com/docs  
