import React, { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { api } from "../services/api";

interface PolicyData {
  mfa_required: boolean;
  mfa_configured: boolean;
  max_login_attempts: number;
  lockout_minutes: number;
  session_timeout_minutes: number;
  login_alerts_enabled: boolean;
  new_device_alerts_enabled: boolean;
  high_risk_threshold: number;
  enforced_controls: { name: string; detail: string; active: boolean }[];
}

export const SecurityPoliciesPage: React.FC = () => {
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await api.request<PolicyData>("/api/v1/policies");
    setPolicy(res);
  };

  useEffect(() => {
    load();
  }, []);

  const savePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy) return;
    setNotice(null);
    await api.request("/api/v1/policies", {
      method: "PUT",
      body: JSON.stringify({
        max_login_attempts: policy.max_login_attempts,
        lockout_minutes: policy.lockout_minutes,
        session_timeout_minutes: policy.session_timeout_minutes,
        login_alerts_enabled: policy.login_alerts_enabled,
        new_device_alerts_enabled: policy.new_device_alerts_enabled,
        high_risk_threshold: policy.high_risk_threshold,
      }),
    });
    setNotice("Security policies updated and logged in audit trail.");
    await load();
  };

  const setupMfa = async () => {
    setError(null);
    const res = await api.request<{ secret: string }>("/api/v1/auth/mfa/setup", { method: "POST" });
    setMfaSecret(res.secret);
  };

  const enableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.request("/api/v1/auth/mfa/enable", {
        method: "POST",
        body: JSON.stringify({ code: mfaCode }),
      });
      setMfaSecret(null);
      setMfaCode("");
      setNotice("Multi-Factor Authentication (TOTP) is now active on your account.");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const disableMfa = async () => {
    setError(null);
    try {
      await api.request("/api/v1/auth/mfa/disable", {
        method: "POST",
        body: JSON.stringify({ code: mfaCode }),
      });
      setMfaCode("");
      setNotice("MFA disabled.");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!policy) return <div className="p-6 text-slate-400 text-sm">Loading security policies...</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Security Policies</h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure MFA, brute-force lockout, session expiration, alerts, and inspect enforced OWASP protections.
        </p>
      </div>

      {notice && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
          {notice}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Policy Controls Form */}
        <form
          onSubmit={savePolicy}
          className="lg:col-span-7 bg-[#0d1322] border border-[#1d2842] rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Lock className="w-4 h-4 text-purple-400" />
            <span>Authentication & Alert Thresholds</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs items-end">
            <div>
              <label className="block text-slate-400 mb-1">Max Failed Login Attempts</label>
              <input
                type="number"
                min={3}
                max={15}
                value={policy.max_login_attempts}
                onChange={(e) => setPolicy({ ...policy, max_login_attempts: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-[#080d1a] border border-[#1d2842] text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Lockout Duration (Minutes)</label>
              <input
                type="number"
                min={5}
                max={120}
                value={policy.lockout_minutes}
                onChange={(e) => setPolicy({ ...policy, lockout_minutes: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-[#080d1a] border border-[#1d2842] text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Session Expiration (Minutes)</label>
              <input
                type="number"
                min={5}
                max={240}
                value={policy.session_timeout_minutes}
                onChange={(e) =>
                  setPolicy({ ...policy, session_timeout_minutes: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg bg-[#080d1a] border border-[#1d2842] text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">High-Risk Alert Threshold (0–100)</label>
              <input
                type="number"
                min={40}
                max={95}
                value={policy.high_risk_threshold}
                onChange={(e) => setPolicy({ ...policy, high_risk_threshold: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-[#080d1a] border border-[#1d2842] text-white"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 text-xs">
            <label className="flex items-center gap-2.5 text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={policy.login_alerts_enabled}
                onChange={(e) => setPolicy({ ...policy, login_alerts_enabled: e.target.checked })}
              />
              <span>Enable Login Alerts for unrecognized IPs</span>
            </label>
            <label className="flex items-center gap-2.5 text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={policy.new_device_alerts_enabled}
                onChange={(e) => setPolicy({ ...policy, new_device_alerts_enabled: e.target.checked })}
              />
              <span>Enable New Device Alerts</span>
            </label>
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[#4c3599] hover:bg-[#5e42bd] text-xs font-semibold text-white"
          >
            Save Security Policies
          </button>
        </form>

        {/* TOTP Multi-Factor Authentication Panel */}
        <div className="lg:col-span-5 bg-[#0d1322] border border-[#1d2842] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <KeyRound className="w-4 h-4 text-emerald-400" />
              <span>Multi-Factor Authentication (TOTP)</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                policy.mfa_configured
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-amber-500/15 text-amber-300"
              }`}
            >
              {policy.mfa_configured ? "Enabled" : "Not Enabled"}
            </span>
          </div>

          {!policy.mfa_configured ? (
            <>
              <p className="text-xs text-slate-400">
                Protect your account with a time-based 6-digit authenticator code (Google Authenticator
                or Authy). Secrets are encrypted at rest with Fernet AES.
              </p>
              {!mfaSecret ? (
                <button
                  type="button"
                  onClick={setupMfa}
                  className="px-4 py-2 rounded-lg bg-[#2e2259] hover:bg-[#3d2d75] text-xs font-semibold text-white"
                >
                  Generate TOTP Secret
                </button>
              ) : (
                <form onSubmit={enableMfa} className="space-y-3 text-xs">
                  <div className="p-3 rounded bg-[#080d1a] border border-[#1d2842]">
                    <div className="text-slate-400 mb-1">Authenticator Setup Key:</div>
                    <div className="font-mono text-purple-300 break-all font-semibold">{mfaSecret}</div>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="Enter 6-digit authenticator code"
                    className="w-full px-3 py-2 rounded-lg bg-[#080d1a] border border-[#1d2842] text-white font-mono"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                  >
                    Verify & Enable MFA
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="space-y-3 text-xs">
              <p className="text-emerald-300">MFA is actively protecting your sign-ins.</p>
              <input
                type="text"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="Enter current 6-digit code to disable"
                className="w-full px-3 py-2 rounded-lg bg-[#080d1a] border border-[#1d2842] text-white font-mono"
              />
              <button
                type="button"
                onClick={disableMfa}
                className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 font-semibold"
              >
                Disable MFA
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Enforced Backend Security Controls Matrix */}
      <div className="bg-[#0d1322] border border-[#1d2842] rounded-xl p-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 mb-4">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Enforced Backend Security Architecture (OWASP Aligned)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {policy.enforced_controls.map((c) => (
            <div key={c.name} className="p-3.5 rounded-lg bg-[#080c17] border border-[#182238] text-xs">
              <div className="flex items-center justify-between font-semibold text-white">
                <span>{c.name}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-slate-400 mt-1">{c.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
