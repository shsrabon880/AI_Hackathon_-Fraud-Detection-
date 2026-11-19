import React, { createContext, useContext, useState } from "react";
import { AlertTriangle, CheckCircle2, MapPin, ShieldAlert, Volume2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { startFraudAlarm, stopFraudAlarm, unlockAudio } from "../utils/alarmAudio";

export interface EvaluatedTxResult {
  id: number;
  tx_ref: string;
  amount: number;
  currency: string;
  tx_type: string;
  recipient_name: string;
  recipient_account_masked: string;
  source_institution: string;
  dest_institution: string;
  status: string;
  device_label: string;
  ip_address: string;
  location_label: string;
  latitude: number | null;
  longitude: number | null;
  risk_score: number;
  risk_level: string;
  tier: "AUTO_APPROVED" | "PENDING_USER_APPROVAL" | "AUTO_REJECTED";
  tier_number: 1 | 2 | 3;
  evaluation_ms?: number;
  forensics?: {
    device_model: string;
    os: string;
    browser: string;
    sim_operator: string;
    phone_masked: string;
    battery_pct: string;
  };
  assessment?: {
    overall_score: number;
    ml_score: number;
    graph_score: number;
    rule_score: number;
    recommended_action: string;
    agent_rationale: string;
    feature_explanations: {
      feature: string;
      label: string;
      raw_value: string;
      contribution_points: number;
      severity: string;
      explanation: string;
    }[];
  };
}

interface LookupRiskAlertInput {
  risk_score: number;
  recipient_name: string;
  recipient_account_masked: string;
  dest_institution: string;
  source_institution?: string;
  location_label?: string;
  ip_address?: string;
  amount?: number;
}

interface RiskDecisionContextValue {
  submitAndRouteTransaction: (payload: Record<string, any>) => Promise<EvaluatedTxResult>;
  triggerLookupRiskAlert: (info: LookupRiskAlertInput) => Promise<void>;
  runQuickTest: (preset: "low" | "medium" | "high") => Promise<void>;
  triggerAlarmTest: () => Promise<void>;
  lastUpdateTick: number;
}

const RiskDecisionContext = createContext<RiskDecisionContextValue | null>(null);

export const RiskDecisionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [tier1Toast, setTier1Toast] = useState<{ score: number; ref: string; ms: number } | null>(null);
  const [tier2Pending, setTier2Pending] = useState<EvaluatedTxResult | null>(null);
  const [tier3Alert, setTier3Alert] = useState<EvaluatedTxResult | null>(null);
  const [showTier3Forensics, setShowTier3Forensics] = useState(false);
  const [lastUpdateTick, setLastUpdateTick] = useState(0);
  const [busyDecision, setBusyDecision] = useState(false);

  const routeEvaluatedTx = async (res: EvaluatedTxResult) => {
    setLastUpdateTick((t) => t + 1);
    if (res.risk_score <= 30) {
      setTier1Toast({
        score: res.risk_score,
        ref: res.tx_ref,
        ms: res.evaluation_ms || 18,
      });
      window.setTimeout(() => {
        setTier1Toast((curr) => (curr?.ref === res.tx_ref ? null : curr));
      }, 5000);
    } else if (res.risk_score < 80) {
      setTier2Pending(res);
    } else {
      setShowTier3Forensics(false);
      setTier3Alert(res);
      await startFraudAlarm();
    }
  };

  const triggerLookupRiskAlert = async (info: LookupRiskAlertInput) => {
    await unlockAudio();
    const score = info.risk_score;
    const riskLevel = score <= 30 ? "Low Risk" : score < 80 ? "Medium Risk" : "High Risk";
    const tier: EvaluatedTxResult["tier"] =
      score <= 30 ? "AUTO_APPROVED" : score < 80 ? "PENDING_USER_APPROVAL" : "AUTO_REJECTED";
    const tierNum: 1 | 2 | 3 = score <= 30 ? 1 : score < 80 ? 2 : 3;

    const synthetic: EvaluatedTxResult = {
      id: 0,
      tx_ref: `LK-${Date.now().toString(36).toUpperCase()}`,
      amount: info.amount ?? 15000,
      currency: "BDT",
      tx_type: "Recipient Pre-Transfer Check",
      recipient_name: info.recipient_name,
      recipient_account_masked: info.recipient_account_masked,
      source_institution: info.source_institution || "FraudShield Account",
      dest_institution: info.dest_institution,
      status: tier === "AUTO_APPROVED" ? "Completed" : tier === "PENDING_USER_APPROVAL" ? "Pending Review" : "Auto-Rejected",
      device_label: navigator.platform || "Web Client",
      ip_address: info.ip_address || "103.148.72.14",
      location_label: info.location_label || "Dhaka, Bangladesh",
      latitude: null,
      longitude: null,
      risk_score: score,
      risk_level: riskLevel,
      tier,
      tier_number: tierNum,
      evaluation_ms: 14,
    };
    await routeEvaluatedTx(synthetic);
  };

  const submitAndRouteTransaction = async (payload: Record<string, any>) => {
    await unlockAudio();
    const res = await api.request<EvaluatedTxResult>("/api/v1/transactions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await routeEvaluatedTx(res);
    return res;
  };

  const runQuickTest = async (preset: "low" | "medium" | "high") => {
    await unlockAudio();
    const payloads = {
      low: {
        amount: 3500,
        tx_type: "Bill Pay",
        recipient_name: "DESCO Electricity",
        recipient_account: "01711001122",
        source_institution: "bKash",
        dest_institution: "DESCO",
        ip_address: "103.148.72.14",
        location_label: "Dhaka, Bangladesh",
        simulated_risk_score: 25,
      },
      medium: {
        amount: 46500,
        tx_type: "Transfer",
        recipient_name: "New Merchant Hub",
        recipient_account: "01855992211",
        source_institution: "City Bank",
        dest_institution: "BRAC Bank",
        ip_address: "172.104.180.55",
        location_label: "Singapore (VPN Approx)",
        simulated_risk_score: 65,
      },
      high: {
        amount: 145000,
        tx_type: "Cash Out",
        recipient_name: "Unverified Offshore Wallet",
        recipient_account: "01999884433",
        source_institution: "BRAC Bank",
        dest_institution: "Unknown External Gateway",
        ip_address: "103.21.244.0",
        location_label: "Moscow, Russia",
        simulated_risk_score: 92,
      },
    };
    await submitAndRouteTransaction(payloads[preset]);
  };

  const triggerAlarmTest = async () => {
    await startFraudAlarm();
    window.setTimeout(() => stopFraudAlarm(), 1400);
  };

  const handleTier2Action = async (action: "APPROVE" | "NOT_APPROVE") => {
    if (!tier2Pending) return;
    setBusyDecision(true);
    try {
      if (tier2Pending.id > 0) {
        await api.request(`/api/v1/transactions/${tier2Pending.id}/tier-decision`, {
          method: "POST",
          body: JSON.stringify({ action }),
        });
      }
      setTier2Pending(null);
      setLastUpdateTick((t) => t + 1);
    } finally {
      setBusyDecision(false);
    }
  };

  const handleTier3Confirm = async () => {
    stopFraudAlarm();
    if (tier3Alert && tier3Alert.id > 0) {
      try {
        await api.request(`/api/v1/transactions/${tier3Alert.id}/tier-decision`, {
          method: "POST",
          body: JSON.stringify({ action: "CONFIRM_ALERT" }),
        });
      } catch {
        // Ignore network errors during emergency acknowledgement
      }
    }
    setTier3Alert(null);
    setShowTier3Forensics(false);
    setLastUpdateTick((t) => t + 1);
  };

  return (
    <RiskDecisionContext.Provider
      value={{
        submitAndRouteTransaction,
        triggerLookupRiskAlert,
        runQuickTest,
        triggerAlarmTest,
        lastUpdateTick,
      }}
    >
      {children}

      {/* TIER 1: Non-blocking Emerald Auto-Approve Toast */}
      {tier1Toast && (
        <div className="fixed top-5 right-5 z-40 max-w-sm bg-[#0b1f18] border border-emerald-500/50 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs flex-1">
            <div className="font-bold text-white">
              Transaction Auto-Approved (0–30% Low Risk) • Risk Score: {tier1Toast.score}%
            </div>
            <div className="text-emerald-300/90 mt-0.5 font-mono">
              {tier1Toast.ref} · Completed in {tier1Toast.ms}ms (Tier 1)
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTier1Toast(null)}
            className="text-emerald-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TIER 2 (31% - 79%): Full-Site User Approval Modal ("Approve or Not?") */}
      {tier2Pending && (
        <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0d1322] border-2 border-orange-500/60 rounded-2xl p-6 shadow-[0_0_45px_rgba(249,115,22,0.28)] space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-orange-500/15 border border-orange-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-orange-400">
                  Tier 2 Security Check (31–79% Medium Risk) • Risk Score: {tier2Pending.risk_score}%
                </div>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  Suspicious Activity Detected — Approve or Not?
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-[#080c17] p-4 rounded-xl border border-[#1d2842]">
              <div>
                <div className="text-slate-400">Amount</div>
                <div className="text-white font-bold text-sm mt-0.5">
                  {tier2Pending.currency} {tier2Pending.amount.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Bank / MFS Channel</div>
                <div className="text-white font-semibold mt-0.5">
                  {tier2Pending.source_institution} → {tier2Pending.dest_institution}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Recipient</div>
                <div className="text-slate-200 font-medium mt-0.5">
                  {tier2Pending.recipient_name} ({tier2Pending.recipient_account_masked})
                </div>
              </div>
              <div>
                <div className="text-slate-400">Device Name</div>
                <div className="text-slate-200 mt-0.5">{tier2Pending.device_label}</div>
              </div>
              <div>
                <div className="text-slate-400">IP & Location</div>
                <div className="text-blue-300 font-mono mt-0.5">
                  {tier2Pending.ip_address} · {tier2Pending.location_label}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Risk Score</div>
                <div className="text-orange-400 font-bold mt-0.5">
                  {tier2Pending.risk_score}% ({tier2Pending.risk_level})
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
              <button
                type="button"
                disabled={busyDecision}
                onClick={() => handleTier2Action("NOT_APPROVE")}
                className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg transition-colors"
              >
                Not Approve (Reject Transaction)
              </button>
              <button
                type="button"
                disabled={busyDecision}
                onClick={() => handleTier2Action("APPROVE")}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition-colors"
              >
                Approve (Yes, Approve)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TIER 3 (80% - 100%): Full-Screen FRAUD ALERT Takeover (Exact Reference Match) */}
      {tier3Alert && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 overflow-y-auto select-none"
          style={{
            backgroundColor: "#141316",
            backgroundImage:
              "radial-gradient(circle at 50% 44%, rgba(165, 22, 28, 0.72) 0%, rgba(105, 14, 19, 0.48) 32%, rgba(28, 17, 20, 0.92) 64%, #101013 100%)",
          }}
        >
          {/* Wide-spaced uppercase FRAUD ALERT title */}
          <h1 className="text-3xl sm:text-5xl font-light tracking-[0.22em] text-white uppercase mb-8 text-center drop-shadow">
            FRAUD ALERT
          </h1>

          {/* Glossy Crimson-Red Shield with White Border & Solid White Padlock */}
          <div className="relative flex flex-col items-center">
            <svg
              viewBox="0 0 180 210"
              className="w-40 h-44 sm:w-44 sm:h-48 drop-shadow-[0_12px_28px_rgba(0,0,0,0.65)]"
            >
              <defs>
                <linearGradient id="fraudShieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ef5b5b" />
                  <stop offset="48%" stopColor="#d9383a" />
                  <stop offset="100%" stopColor="#8b1419" />
                </linearGradient>
                <linearGradient id="shieldGloss" x1="0%" y1="0%" x2="70%" y2="70%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.34" />
                  <stop offset="55%" stopColor="#ffffff" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Outer White Border Shield */}
              <path
                d="M90 10 L165 36 V96 C165 148 130 184 90 198 C50 184 15 148 15 96 V36 Z"
                fill="url(#fraudShieldGrad)"
                stroke="#ffffff"
                strokeWidth="6.5"
                strokeLinejoin="round"
              />
              {/* Glossy Overlay */}
              <path
                d="M90 16 L158 40 V92 C158 110 148 124 126 142 L22 72 V40 Z"
                fill="url(#shieldGloss)"
              />

              {/* Solid White Closed Padlock Icon inside Shield */}
              <path
                d="M68 92 V77 C68 63 77.5 54 90 54 C102.5 54 112 63 112 77 V92"
                fill="none"
                stroke="#ffffff"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <rect x="57" y="90" width="66" height="52" rx="9" fill="#ffffff" />
              <circle cx="90" cy="112" r="5.5" fill="#b91c1c" />
              <path d="M87.5 114 L92.5 114 L94 127 H86 Z" fill="#b91c1c" />
            </svg>

            {/* Soft horizontal glow shadow beneath the shield */}
            <div
              className="w-44 h-3 rounded-full mt-4 mb-8"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(255,255,255,0.45) 0%, rgba(255,180,180,0.18) 45%, rgba(0,0,0,0) 75%)",
              }}
            />
          </div>

          {/* Active Audio Alarm Indicator */}
          <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/70 border border-red-400/40 text-[11px] text-red-200">
            <Volume2 className="w-3.5 h-3.5 animate-pulse text-red-400" />
            <span>
              Critical Transfer Auto-Rejected ({tier3Alert.risk_score}% Risk • 80–100% High Alert) • Security Alarm Sound Active
            </span>
          </div>

          {/* Rectangular Thin White-Bordered CONFIRM Button */}
          <button
            type="button"
            onClick={handleTier3Confirm}
            className="px-8 py-2.5 border border-white/85 rounded-sm text-xs font-medium tracking-[0.18em] uppercase text-white bg-black/25 hover:bg-white/15 transition-colors"
          >
            CONFIRM
          </button>

          {/* Underlined Click here for more information Link */}
          <button
            type="button"
            onClick={() => {
              stopFraudAlarm();
              setShowTier3Forensics((v) => !v);
            }}
            className="mt-4 text-xs text-white/90 hover:text-white underline underline-offset-4 cursor-pointer"
          >
            Click here for more information
          </button>

          {/* Expandable Forensic Details Drawer */}
          {showTier3Forensics && (
            <div className="mt-6 w-full max-w-2xl bg-[#0d1322]/95 border border-red-500/40 rounded-xl p-5 text-xs text-slate-200 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 font-bold text-red-400">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Blocked Transaction Forensics ({tier3Alert.tx_ref})</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleTier3Confirm();
                    navigate("/transactions");
                  }}
                  className="text-blue-400 hover:underline flex items-center gap-1"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Open in Transaction History</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-slate-400">Amount Blocked</div>
                  <div className="font-bold text-white">
                    {tier3Alert.currency} {tier3Alert.amount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Attacker IP</div>
                  <div className="font-mono text-red-300">{tier3Alert.ip_address}</div>
                </div>
                <div>
                  <div className="text-slate-400">Location (IP Approx)</div>
                  <div className="text-white">{tier3Alert.location_label}</div>
                </div>
                <div>
                  <div className="text-slate-400">Device & Model</div>
                  <div className="text-white">
                    {tier3Alert.device_label} ({tier3Alert.forensics?.device_model || "Unknown"})
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">SIM Operator</div>
                  <div className="text-slate-300">
                    {tier3Alert.forensics?.sim_operator || "Not Available"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Phone Number</div>
                  <div className="font-mono text-slate-300">
                    {tier3Alert.forensics?.phone_masked || "Not Available"}
                  </div>
                </div>
              </div>

              {tier3Alert.assessment?.feature_explanations && (
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <div className="font-semibold text-slate-300">AI Reason Codes:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {tier3Alert.assessment.feature_explanations.slice(0, 4).map((f) => (
                      <div
                        key={f.feature}
                        className="p-2 rounded bg-[#080c17] border border-slate-800"
                      >
                        <div className="flex justify-between font-semibold text-white">
                          <span>{f.label}</span>
                          <span className="text-red-400">+{f.contribution_points} pts</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{f.explanation}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </RiskDecisionContext.Provider>
  );
};

export function useRiskDecision() {
  const ctx = useContext(RiskDecisionContext);
  if (!ctx) throw new Error("useRiskDecision must be used inside RiskDecisionProvider");
  return ctx;
}
