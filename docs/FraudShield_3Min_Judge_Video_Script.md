# FinSphere AI – FraudShield
## 3-Minute Judge Presentation & Demo Video Script
**Target Runtime:** `2 minutes 50 seconds` (strictly under the `3:00` limit)  
**Speaking Pace:** ~145–150 words per minute (~420 spoken words total)  
**Product:** FinSphere AI – FraudShield (*Reimagining Global Financial Services*)

---

## Quick Timing Overview

| Segment | Time Window | Duration | On-Screen Focus |
| :--- | :---: | :---: | :--- |
| **1. Hook & Problem Statement** | `0:00 – 0:25` | 25 sec | Title / Login & Problem Overview |
| **2. Solution & Zero-Credential Policy** | `0:25 – 0:50` | 25 sec | Sidebar Navigation & `Connectors` (13 BD Banks & MFS) |
| **3. Dashboard & Threat Intelligence** | `0:50 – 1:20` | 30 sec | `Dashboard` (`0–100` Gauge, Google Maps `Location`, `Devices`) |
| **4. Explainable ML, Graph & Analytics** | `1:20 – 1:55` | 35 sec | `Transaction History`, `Financial Analytics`, `Graph Network` |
| **5. Live 3-Tier Risk Approval Demo** | `1:55 – 2:30` | 35 sec | `25%` Auto-Approve, `65%` Prompt, `92%` `FRAUD ALERT` + Alarm + `FraudShield AI` |
| **6. Security Architecture & Closing** | `2:30 – 2:50` | 20 sec | `Security Policies`, `Sessions`, `Audit Logs` & Closing |

---

## Full Spoken Script & Visual Cues

### [0:00 – 0:25] 1. Hook & The Problem (25 seconds · ~60 words)
**[VISUAL CUE]:** Open on the FraudShield dark-navy Login / Overview screen, highlighting fragmented banking & MFS alerts.  
**[SPEAKER]:**
> "Every day, millions of people manage their money across multiple commercial banks and mobile financial services like bKash, Nagad, and upay. Yet when fraud happens—through account takeover, suspicious IP logins, or mule transfers—users only find out *after* their money is gone. Existing tools are fragmented, give black-box alerts with zero explanation, or worse, ask users for sensitive PINs and passwords."

---

### [0:25 – 0:50] 2. Our Solution: FinSphere AI – FraudShield (25 seconds · ~62 words)
**[VISUAL CUE]:** Click **Sign In**, reveal the left purple-navy sidebar, and briefly open **Connectors** showing all 13 Bangladesh banks and MFS wallets (`City Bank`, `BRAC Bank`, `DBBL`, `bKash`, `Nagad`, `upay`).  
**[SPEAKER]:**
> "Meet **FinSphere AI – FraudShield**: an enterprise-grade, AI-powered financial security platform built to protect ordinary users in real time. Through **Connectors**, users link banks and MFS wallets using authorized sandboxes or validated CSV and PDF statement uploads—with automatic deduplication. Most importantly, FraudShield enforces a strict **zero-credential policy**: we *never* ask for or store banking passwords, MFS PINs, or OTP codes."

---

### [0:50 – 1:20] 3. Real-Time Dashboard & Honest Device Intelligence (30 seconds · ~75 words)
**[VISUAL CUE]:** Switch to **Dashboard** (`103.21.244.0` — `85 High Risk` gauge, **Risk Summary**, **Location** Google Maps view with Map/Satellite toggle, **Risk Indicators**, and briefly **Devices**).  
**[SPEAKER]:**
> "On the **Dashboard**, FraudShield gives an instant cybersecurity command center: a live 0-to-100 Risk Gauge, VPN, TOR, and blacklist checks, plus an interactive **Google Maps Location** panel that transparently marks IP geolocation as approximate. In **Device Intelligence**, we track new devices, failed logins, and location mismatches—and honestly display *Not Available* for restricted SIM or phone hardware data rather than fabricating telemetry."

---

### [1:20 – 1:55] 4. Explainable ML, Analytics & 4-Tier Graph Network (35 seconds · ~86 words)
**[VISUAL CUE]:** Open **Transaction History** (`Last 7 Days` / `30 Days` / `All`, click one row for Explainable AI reason codes), switch to **Financial Analytics** (`24H / 7D / 1M / 1Y` Risk Trend chart), then open **Graph Network** and click a node (`BRAC Bank` or `103.21.244.0`).  
**[SPEAKER]:**
> "Every transaction is scored by our **Explainable ML Engine** across eight behavioral features—like amount deviation, 1-hour velocity, odd-hour timing, and IP reputation—showing exact point-by-point reason codes. In **Transaction History**, users filter across 7 days, 30 days, or all records and export CSV or PDF statements. **Financial Analytics** tracks risk trends from 24 hours to 1 year, while our **4-Tier Graph Relationship Network** traces Devices, IPs, Banks, and Recipients to uncover shared-IP hubs and fraud rings with one click."

---

### [1:55 – 2:30] 5. Live 3-Tier Risk Approval Engine & AI Assistant (35 seconds · ~88 words)
**[VISUAL CUE]:** Return to **Dashboard**. Click **`Test Low Risk (25%)`** (emerald toast), then **`Test Medium Risk (65%)`** (show modal, click **Approve**), then **`Test High Risk (92%)`** (show full-screen **`FRAUD ALERT`** screen + alarm, click **`Click here for more information`**, then **`CONFIRM`**). Briefly click **`FraudShield AI`** at bottom-right.  
**[SPEAKER]:**
> "Our **3-Tier Risk Approval Engine** automates protection without slowing legitimate users down:
> - **Tier 1 (0–50%)** auto-approves in under 50 milliseconds with a subtle toast.
> - **Tier 2 (50–79%)** pauses the transfer across the entire site, asking *'Are you approve or not?'* so the user can approve or block and flag the device.
> - **Tier 3 (80%+)** immediately auto-rejects, sounds an audible Web Audio security alarm, and triggers our full-screen **FRAUD ALERT** takeover with full forensic evidence. And our bottom-right **FraudShield AI Assistant** guides users step by step."

---

### [2:30 – 2:50] 6. Enterprise Security & Closing (20 seconds · ~49 words)
**[VISUAL CUE]:** Briefly flash **Security Policies** (TOTP MFA + OWASP controls) and **Sessions** (re-authenticated revocation), then return to **Dashboard**.  
**[SPEAKER]:**
> "Under the hood, FraudShield is hardened end-to-end with Argon2id hashing, encrypted TOTP MFA, CSRF protection, strict owner-isolated APIs, re-authenticated session revocation, and full audit logging—verified by automated security tests. **FinSphere AI – FraudShield**: transparent, explainable, and real-time financial protection for everyone. Thank you."

---

## Presenter Checklist Before Recording
1. Start backend (`127.0.0.1:8000`) and frontend (`localhost:5173`) and sign in as `srabon@finsphere.ai`.
2. Ensure browser tab audio is unmuted so judges hear the **Tier 3 Web Audio security alarm** when clicking `Test High Risk (92%)`.
3. Keep `103.21.244.0` selected on Dashboard for high visual contrast on the `85 High Risk` gauge.
4. Keep speaking steady and clear (~145 wpm) to finish comfortably around **2 minutes 50 seconds**.
