import React, { useState } from "react";
import { Lock, Mail, ShieldCheck, User, AlertCircle, KeyRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const LoginPage: React.FC = () => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("srabon@finsphere.ai");
  const [password, setPassword] = useState("FraudShield#2026");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      if (mode === "register") {
        await register(fullName, email, password);
        setMode("login");
        setNotice("Account created with Argon2id security. You can sign in now.");
      } else {
        const res = await login(email, password, mfaRequired ? mfaCode : undefined);
        if (res.mfa_required) {
          setMfaRequired(true);
          setNotice("Enter your 6-digit authenticator MFA code to complete sign-in.");
        }
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060913] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle radial glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-700/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#0d1322] border border-[#1d2842] rounded-2xl p-7 shadow-2xl relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-red-400">
              FinSphere AI
            </div>
            <h1 className="text-xl font-bold text-white">FraudShield Security</h1>
          </div>
        </div>

        <div className="flex gap-2 p-1 rounded-lg bg-[#080d1a] border border-[#1a243d] mb-5">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
              mode === "login" ? "bg-[#2e2259] text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setMfaRequired(false);
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
              mode === "register" ? "bg-[#2e2259] text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
            {notice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#080d1a] border border-[#1e2a45] text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#080d1a] border border-[#1e2a45] text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#080d1a] border border-[#1e2a45] text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {mfaRequired && mode === "login" && (
            <div>
              <label className="block text-xs font-medium text-purple-300 mb-1.5">
                Authenticator MFA Code
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-purple-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="6-digit code"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#080d1a] border border-purple-500/50 text-sm text-white font-mono tracking-widest focus:outline-none"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-[#4c3599] hover:bg-[#5c41b8] disabled:opacity-60 text-white text-sm font-semibold transition-colors"
          >
            {submitting
              ? "Verifying..."
              : mode === "register"
              ? "Create Secure Account"
              : mfaRequired
              ? "Verify MFA & Sign In"
              : "Sign In to FraudShield"}
          </button>
        </form>

        {mode === "login" && (
          <div className="mt-5 p-3 rounded-lg bg-[#080d1a] border border-[#19233b] text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-amber-300/90">
              DEMO CREDENTIALS (Synthetic Development Account)
            </div>
            <div>
              Admin: <code className="text-slate-200">srabon@finsphere.ai</code> /{" "}
              <code className="text-slate-200">FraudShield#2026</code>
            </div>
            <div>
              Standard User: <code className="text-slate-200">ayesha@finsphere.ai</code> /{" "}
              <code className="text-slate-200">AyeshaSafe#2026</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
