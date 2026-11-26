import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  FileSearch,
  Globe,
  KeyRound,
  Lock,
  Mail,
  Phone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  User,
  Volume2,
} from "lucide-react";
import { InstitutionLogo } from "../components/InstitutionLogo";
import { LanguageSelector } from "../components/LanguageSelector";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { LangCode, SUPPORTED_LANGUAGES } from "../i18n/translations";

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
  const { login, register, verifySignupOtp, resendSignupOtp, forgotPassword, resetPassword } = useAuth();
  const { t, lang, setLanguage } = useLanguage();

  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("srabon@finsphere.ai");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [country, setCountry] = useState("Bangladesh");
  const [password, setPassword] = useState("FraudShield#2026");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);

  // Sign-Up Email OTP Verification state (ONLY used during Sign Up)
  const [otpStep, setOtpStep] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [signupOtp, setSignupOtp] = useState("");
  const [otpExpiresLeft, setOtpExpiresLeft] = useState(0);
  const [resendCooldownLeft, setResendCooldownLeft] = useState(0);

  // Forgot Password state
  const [forgotOtpSent, setForgotOtpSent] = useState(false);
  const [resetOtp, setResetOtp] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const authCardRef = useRef<HTMLDivElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!otpStep) return;
    const timer = window.setInterval(() => {
      setOtpExpiresLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldownLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpStep]);

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  const openAuthMode = (target: "login" | "register" | "forgot") => {
    setMode(target);
    setOtpStep(false);
    setForgotOtpSent(false);
    setSignupOtp("");
    setResetOtp("");
    setError(null);
    setNotice(null);
    if (target === "register") {
      setMfaRequired(false);
      if (email === "srabon@finsphere.ai") {
        setEmail("");
        setPassword("");
        setConfirmPassword("");
      }
    } else if (target === "login" && !email) {
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

    if (mode === "register" && password !== confirmPassword) {
      setError("Password and Confirm Password do not match.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "register") {
        const res = await register({
          fullName,
          email,
          phoneNumber,
          country,
          preferredLanguage: lang,
          password,
          confirmPassword,
        });
        setPendingEmail(res.email || email.trim().toLowerCase());
        setSignupOtp("");
        setOtpExpiresLeft(res.expires_in_seconds || 300);
        setResendCooldownLeft(res.resend_cooldown_seconds || 60);
        setOtpStep(true);
        setNotice(res.message);
      } else if (mode === "forgot") {
        if (!forgotOtpSent) {
          const res = await forgotPassword(email);
          setForgotOtpSent(true);
          setNotice(res.message);
        } else {
          if (password !== confirmPassword) {
            setError("New password and confirm password do not match.");
            setSubmitting(false);
            return;
          }
          const res = await resetPassword(email, resetOtp, password, confirmPassword);
          setMode("login");
          setForgotOtpSent(false);
          setPassword("");
          setConfirmPassword("");
          setNotice(res.message);
        }
      } else {
        const res = await login(email, password, mfaRequired ? mfaCode : undefined, rememberMe);
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

  const handleVerifySignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (signupOtp.trim().length !== 6) {
      setError("Please enter the 6-digit numeric verification OTP sent to your email.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await verifySignupOtp(pendingEmail, signupOtp.trim());
      setOtpStep(false);
      setSignupOtp("");
      setMode("login");
      setEmail(pendingEmail);
      setPassword("");
      setConfirmPassword("");
      setNotice(res.message || "Email verified and account activated. Sign in with your email and password.");
    } catch (err: any) {
      setError(err.message || "Invalid or expired verification code.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendSignupOtp = async () => {
    if (resendCooldownLeft > 0 || submitting) return;
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      const res = await resendSignupOtp(pendingEmail);
      setOtpExpiresLeft(res.expires_in_seconds || 300);
      setResendCooldownLeft(res.resend_cooldown_seconds || 60);
      setNotice(res.message);
    } catch (err: any) {
      setError(err.message || "Unable to resend verification code.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 relative overflow-x-hidden flex flex-col">
      <div className="absolute -top-40 -left-40 w-[520px] h-[520px] bg-purple-700/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-[480px] h-[480px] bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navigation Bar */}
      <header className="relative z-10 border-b border-[#1a2238] bg-[#080c17]/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#2e2259] border border-[#5b43b8]/50 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-[#a78bfa]" />
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-tight">FinSphere AI</div>
              <div className="text-[10px] font-semibold tracking-wider uppercase text-[#a78bfa]">
                {t("brand_sub")}
              </div>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-2 text-xs text-slate-300">
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
              <span>{t("nav_lookup")}</span>
            </a>
            <a
              href="#institutions-showcase"
              className="px-3 py-1.5 rounded-full bg-[#101729] border border-[#1e2a45] hover:border-purple-500/50 transition-colors"
            >
              {t("nav_connectors")}
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSelector compact />
            <button
              type="button"
              onClick={() => openAuthMode("login")}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                mode === "login"
                  ? "bg-[#1a1635] border-purple-500/60 text-white"
                  : "bg-transparent border-[#253152] text-slate-300 hover:text-white"
              }`}
            >
              {t("sign_in")}
            </button>
            <button
              type="button"
              onClick={() => openAuthMode("register")}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#4c3599] hover:bg-[#5e42bd] text-white shadow-lg shadow-purple-900/30 transition-colors flex items-center gap-1.5"
            >
              <span>{t("sign_up")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Hero & Auth Split Grid */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-5 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: Hero Showcase + 3-Tier Engine + Official Logos */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-[11px] font-semibold uppercase tracking-wider text-red-300">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span>{t("tagline")}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
            {t("hero_title")}
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
            {t("hero_subtitle")}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => openAuthMode("login")}
              className="px-5 py-2.5 rounded-lg bg-[#4c3599] hover:bg-[#5e42bd] text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-colors"
            >
              <span>{t("sign_in")}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => openAuthMode("register")}
              className="px-5 py-2.5 rounded-lg bg-[#0d1322] hover:bg-[#141c32] border border-[#2a385c] text-slate-200 text-xs font-semibold transition-colors"
            >
              {t("sign_up")}
            </button>
          </div>

          {/* 3-Tier Visual Cards */}
          <div id="tiers-showcase" className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-[#0d1322]/90 border border-emerald-500/35 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  0–29% {t("risk_low")}
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-sm font-bold text-white">Normal Flow</div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Safe transfers proceed cleanly without blocking alerts.
              </p>
            </div>

            <div className="bg-[#0d1322]/90 border border-orange-500/40 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400">
                  30–79% {t("risk_medium")}
                </span>
                <AlertTriangle className="w-4 h-4 text-orange-400" />
              </div>
              <div className="text-sm font-bold text-white">Confirm / Reject</div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Interactive FRAUD ALERT requires explicit Confirm or Reject.
              </p>
            </div>

            <div className="bg-[#180d14]/95 border border-red-500/50 rounded-xl p-4 space-y-1.5 shadow-[0_0_24px_rgba(239,68,68,0.12)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">
                  80–100% {t("risk_critical")}
                </span>
                <Volume2 className="w-4 h-4 text-red-400 animate-pulse" />
              </div>
              <div className="text-sm font-bold text-white">5s Auto-Reject + Alarm</div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Backend auto-rejection + 5-second critical takeover &amp; alarm.
              </p>
            </div>
          </div>

          {/* Official Bangladesh Institutions Showcase */}
          <div id="institutions-showcase" className="pt-2 space-y-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t("nav_connectors")}
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

        {/* Right: Email Authentication Portal */}
        <div
          ref={authCardRef}
          className="lg:col-span-5 w-full max-w-md mx-auto bg-[#0d1322] border border-[#1d2842] rounded-2xl p-6 sm:p-7 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
                  FinSphere AI
                </div>
                <h2 className="text-lg font-bold text-white">
                  {otpStep
                    ? t("verify_email")
                    : mode === "register"
                    ? t("sign_up")
                    : mode === "forgot"
                    ? t("reset_password_title")
                    : t("sign_in")}
                </h2>
              </div>
            </div>
          </div>

          {!otpStep && mode !== "forgot" && (
            <div className="flex gap-2 p-1 rounded-lg bg-[#080d1a] border border-[#1a243d] mb-5">
              <button
                type="button"
                onClick={() => openAuthMode("login")}
                className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
                  mode === "login" ? "bg-[#2e2259] text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {t("sign_in")}
              </button>
              <button
                type="button"
                onClick={() => openAuthMode("register")}
                className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
                  mode === "register" ? "bg-[#2e2259] text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {t("sign_up")}
              </button>
            </div>
          )}

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

          {otpStep ? (
            <form onSubmit={handleVerifySignupOtp} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#080d1a] border border-[#1d2842] text-xs space-y-1.5">
                <div className="text-slate-400">6-digit verification code sent to:</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-white truncate">{pendingEmail}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep(false);
                      setError(null);
                      setNotice(null);
                    }}
                    className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 underline shrink-0"
                  >
                    {t("change_email")}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300">6-Digit OTP</label>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-mono ${
                      otpExpiresLeft > 0 ? "text-amber-300" : "text-red-400"
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {otpExpiresLeft > 0 ? formatCountdown(otpExpiresLeft) : "Expired"}
                  </span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  value={signupOtp}
                  onChange={(e) => setSignupOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3 rounded-lg bg-[#080d1a] border border-purple-500/50 text-center text-lg text-white font-mono tracking-[0.45em] focus:outline-none focus:border-purple-400"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || signupOtp.length !== 6 || otpExpiresLeft === 0}
                className="w-full py-2.5 rounded-lg bg-[#4c3599] hover:bg-[#5c41b8] disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {submitting ? "..." : t("verify_email")}
              </button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-slate-400">Didn&apos;t receive the code?</span>
                <button
                  type="button"
                  disabled={resendCooldownLeft > 0 || submitting}
                  onClick={handleResendSignupOtp}
                  className="inline-flex items-center gap-1.5 font-semibold text-purple-400 hover:text-purple-300 disabled:text-slate-500"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>
                    {resendCooldownLeft > 0 ? `${t("resend_otp")} (${resendCooldownLeft}s)` : t("resend_otp")}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === "register" && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t("full_name")}</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={t("full_name")}
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#080d1a] border border-[#1e2a45] text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t("email_address")}</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    ref={emailInputRef}
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gmail.com"
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#080d1a] border border-[#1e2a45] text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {mode === "register" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        {t("phone_number")}
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="+88017XXXXXXXX"
                          className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#080d1a] border border-[#1e2a45] text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        {t("country")}
                      </label>
                      <div className="relative">
                        <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          required
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#080d1a] border border-[#1e2a45] text-sm text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      {t("preferred_language")}
                    </label>
                    <select
                      value={lang}
                      onChange={(e) => setLanguage(e.target.value as LangCode, false)}
                      className="w-full px-3 py-2 rounded-lg bg-[#080d1a] border border-[#1e2a45] text-sm text-white focus:outline-none focus:border-purple-500"
                    >
                      {SUPPORTED_LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.nativeLabel} ({l.englishName})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {mode === "forgot" && forgotOtpSent && (
                <div>
                  <label className="block text-xs font-medium text-purple-300 mb-1">
                    6-Digit Password Reset OTP
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-3 py-2 rounded-lg bg-[#080d1a] border border-purple-500/50 text-sm text-white font-mono tracking-widest"
                  />
                </div>
              )}

              {(mode !== "forgot" || forgotOtpSent) && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {mode === "forgot" ? "New Password" : t("password")}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Upper, lower, digit, symbol (8+)"
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#080d1a] border border-[#1e2a45] text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              )}

              {(mode === "register" || (mode === "forgot" && forgotOtpSent)) && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {t("confirm_password")}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t("confirm_password")}
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#080d1a] border border-[#1e2a45] text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              )}

              {mode === "login" && (
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <label className="inline-flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="accent-purple-500 rounded"
                    />
                    <span>{t("remember_me")}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => openAuthMode("forgot")}
                    className="text-purple-400 hover:text-purple-300 font-medium"
                  >
                    {t("forgot_password")}
                  </button>
                </div>
              )}

              {mfaRequired && mode === "login" && (
                <div>
                  <label className="block text-xs font-medium text-purple-300 mb-1">
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
                  ? "..."
                  : mode === "register"
                  ? t("sign_up")
                  : mode === "forgot"
                  ? forgotOtpSent
                    ? t("reset_password_btn")
                    : t("send_reset_otp")
                  : mfaRequired
                  ? "Verify MFA & Sign In"
                  : t("sign_in")}
              </button>

              {mode === "forgot" && (
                <button
                  type="button"
                  onClick={() => openAuthMode("login")}
                  className="w-full py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  {t("back_to_signin")}
                </button>
              )}
            </form>
          )}

          {/* One-click Demo Account Fill */}
          <div className="mt-5 p-3.5 rounded-xl bg-[#080d1a] border border-[#19233b] text-[11px] text-slate-400 space-y-2">
            <div className="font-semibold text-amber-300/90">
              JUDGE DEMO ACCOUNTS (Click to auto-fill)
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  openAuthMode("login");
                  setEmail("srabon@finsphere.ai");
                  setPassword("FraudShield#2026");
                }}
                className="px-2.5 py-1.5 rounded-md bg-[#121a2e] hover:bg-[#1a2542] border border-[#253256] text-slate-200 transition-colors"
              >
                Admin: <code className="text-purple-300">srabon@finsphere.ai</code>
              </button>
              <button
                type="button"
                onClick={() => {
                  openAuthMode("login");
                  setEmail("ayesha@finsphere.ai");
                  setPassword("AyeshaSafe#2026");
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
