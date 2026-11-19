import React, { useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  FileSearch,
  KeyRound,
  Lock,
  Mail,
  ShieldAlert,
  ShieldCheck,
  User,
  Volume2,
} from "lucide-react";
import { InstitutionLogo } from "../components/InstitutionLogo";
import { useAuth } from "../context/AuthContext";

const SUPPORTED_SHOWCASE = [
  { code: "bkash", name: "bKash" },
  { code: "nagad", name: "Nagad" },
  { code: "rocket", name: "Rocket" },
  { code: "upay", name: "upay" },
  { code: "city_bank", name: "City Bank" },
  { code: "brac_bank", name: "BRAC Bank" },
  { code: "dbbl", name: "Dutch-Bangla Bank" },
  { code: "islami_bank", name: "Islami Bank" },
];

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

  const authCardRef = useRef<HTMLDivElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const openAuthMode = (target: "login" | "register") => {
    setMode(target);
    setError(null);
    setNotice(null);
    if (target === "register") {
      setMfaRequired(false);
      if (email === "srabon@finsphere.ai") {
        setEmail("");
        setPassword("");
      }
    } else if (!email) {
      setEmail("srabon@finsphere.ai");
      setPassword("FraudShield#2026");
    }
    authCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => emailInputRef.current?.focus(), 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      if (mode === "register") {
        await register(fullName, email, password);
        // Automatically sign in so the user enters the platform immediately after email sign-up
        const res = await login(email, password);
        if (res.mfa_required) {
          setMode("login");
          setMfaRequired(true);
          setNotice("Account created! Enter your 6-digit MFA code to continue.");
        }
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
    <div className="min-h-screen bg-[#060913] text-slate-100 relative overflow-x-hidden flex flex-col">
      {/* Background radial glows */}
      <div className="absolute -top-40 -left-40 w-[520px] h-[520px] bg-purple-700/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-[480px] h-[480px] bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navigation Bar */}
      <header className="relative z-10 border-b border-[#1a2238] bg-[#080c17]/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#2e2259] border border-[#5b43b8]/50 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-[#a78bfa]" />
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-tight">FinSphere AI</div>
              <div className="text-[10px] font-semibold tracking-wider uppercase text-[#a78bfa]">
                FraudShield Security
              </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-2 text-xs text-slate-300">
            <a
              href="#tiers-showcase"
              className="px-3 py-1.5 rounded-full bg-[#101729] border border-[#1e2a45] hover:border-purple-500/50 transition-colors"
            >
              3-Tier Risk Engine
            </a>
            <a
              href="#tiers-showcase"
              className="px-3 py-1.5 rounded-full bg-[#101729] border border-[#1e2a45] hover:border-purple-500/50 transition-colors flex items-center gap-1.5"
            >
              <FileSearch className="w-3.5 h-3.5 text-purple-400" />
              <span>Recipient Lookup</span>
            </a>
            <a
              href="#institutions-showcase"
              className="px-3 py-1.5 rounded-full bg-[#101729] border border-[#1e2a45] hover:border-purple-500/50 transition-colors"
            >
              BD Bank &amp; MFS Protection
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => openAuthMode("login")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                mode === "login"
                  ? "bg-[#1a1635] border-purple-500/60 text-white"
                  : "bg-transparent border-[#253152] text-slate-300 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => openAuthMode("register")}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#4c3599] hover:bg-[#5e42bd] text-white shadow-lg shadow-purple-900/30 transition-colors flex items-center gap-1.5"
            >
              <span>Sign Up</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Hero & Auth Split Grid */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-5 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: Hero Showcase + 3-Tier Engine + Official Logos */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-[11px] font-semibold uppercase tracking-wider text-red-300">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span>Real-Time AI Financial Fraud Defense for Bangladesh</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
            Stop Fraud Before Money Leaves Your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#a78bfa] via-purple-400 to-red-400">
              Bank or MFS Account
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
            FinSphere AI – FraudShield inspects recipient mobile numbers and bank accounts before
            transfers, correlates multi-channel statement graphs, and routes every transaction
            through our automated <strong className="text-white">3-Tier Risk Alert Engine</strong>.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => openAuthMode("login")}
              className="px-5 py-2.5 rounded-lg bg-[#4c3599] hover:bg-[#5e42bd] text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-colors"
            >
              <span>Sign In with Email</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => openAuthMode("register")}
              className="px-5 py-2.5 rounded-lg bg-[#0d1322] hover:bg-[#141c32] border border-[#2a385c] text-slate-200 text-xs font-semibold transition-colors"
            >
              Create Account (Email Sign Up)
            </button>
          </div>

          {/* 3-Tier Visual Cards */}
          <div id="tiers-showcase" className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-[#0d1322]/90 border border-emerald-500/35 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  0–30% Risk
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-sm font-bold text-white">Auto-Approve</div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Safe transfers &amp; verified recipients are approved automatically in milliseconds.
              </p>
            </div>

            <div className="bg-[#0d1322]/90 border border-orange-500/40 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400">
                  31–79% Risk
                </span>
                <AlertTriangle className="w-4 h-4 text-orange-400" />
              </div>
              <div className="text-sm font-bold text-white">Approve or Not Prompt</div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Interactive confirmation modal pauses the transfer until you choose Approve or Reject.
              </p>
            </div>

            <div className="bg-[#180d14]/95 border border-red-500/50 rounded-xl p-4 space-y-1.5 shadow-[0_0_24px_rgba(239,68,68,0.12)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">
                  80–100% Risk
                </span>
                <Volume2 className="w-4 h-4 text-red-400 animate-pulse" />
              </div>
              <div className="text-sm font-bold text-white">FRAUD ALERT + Alarm</div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Full-screen FRAUD ALERT takeover, live siren alarm sound, and instant auto-reject.
              </p>
            </div>
          </div>

          {/* Official Bangladesh Institutions Showcase */}
          <div id="institutions-showcase" className="pt-2 space-y-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Supported Bangladesh MFS &amp; Banking Intelligence
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {SUPPORTED_SHOWCASE.map((inst) => (
                <div
                  key={inst.code}
                  title={inst.name}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-[#0d1322] border border-[#1d2842]"
                >
                  <InstitutionLogo code={inst.code} name={inst.name} />
                  <span className="text-[11px] font-medium text-slate-300 pr-1 hidden sm:inline">
                    {inst.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Email Sign In & Sign Up Portal */}
        <div
          ref={authCardRef}
          className="lg:col-span-5 w-full max-w-md mx-auto bg-[#0d1322] border border-[#1d2842] rounded-2xl p-7 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-red-400">
                Email Authentication Portal
              </div>
              <h2 className="text-xl font-bold text-white">
                {mode === "register" ? "Sign Up for FraudShield" : "Sign In to FraudShield"}
              </h2>
            </div>
          </div>

          <div className="flex gap-2 p-1 rounded-lg bg-[#080d1a] border border-[#1a243d] mb-5">
            <button
              type="button"
              onClick={() => openAuthMode("login")}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
                mode === "login" ? "bg-[#2e2259] text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => openAuthMode("register")}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
                mode === "register" ? "bg-[#2e2259] text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Sign Up
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
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  ref={emailInputRef}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
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
                  placeholder="Minimum 8 characters"
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
                ? "Sign Up & Enter FraudShield"
                : mfaRequired
                ? "Verify MFA & Sign In"
                : "Sign In to FraudShield"}
            </button>
          </form>

          {/* One-click Demo Account Fill */}
          <div className="mt-5 p-3.5 rounded-xl bg-[#080d1a] border border-[#19233b] text-[11px] text-slate-400 space-y-2">
            <div className="font-semibold text-amber-300/90">
              JUDGE DEMO ACCOUNTS (Click to auto-fill)
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setEmail("srabon@finsphere.ai");
                  setPassword("FraudShield#2026");
                  setError(null);
                }}
                className="px-2.5 py-1.5 rounded-md bg-[#121a2e] hover:bg-[#1a2542] border border-[#253256] text-slate-200 transition-colors"
              >
                Admin: <code className="text-purple-300">srabon@finsphere.ai</code>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setEmail("ayesha@finsphere.ai");
                  setPassword("AyeshaSafe#2026");
                  setError(null);
                }}
                className="px-2.5 py-1.5 rounded-md bg-[#121a2e] hover:bg-[#1a2542] border border-[#253256] text-slate-200 transition-colors"
              >
                User: <code className="text-purple-300">ayesha@finsphere.ai</code>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
