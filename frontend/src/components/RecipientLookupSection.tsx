import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FileSearch,
  Landmark,
  Phone,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  XCircle,
} from "lucide-react";
import { api } from "../services/api";
import { GoogleGeoMap } from "./GoogleGeoMap";
import { InstitutionLogo } from "./InstitutionLogo";
import { RiskGauge } from "./RiskGauge";

const BD_BANKS = [
  { code: "city_bank", name: "City Bank" },
  { code: "dbbl", name: "Dutch-Bangla Bank Limited" },
  { code: "dhaka_bank", name: "Dhaka Bank" },
  { code: "islami_bank", name: "Islami Bank Bangladesh" },
  { code: "trust_bank", name: "Trust Bank" },
  { code: "ebl", name: "Eastern Bank Limited (EBL)" },
  { code: "brac_bank", name: "BRAC Bank" },
  { code: "bank_asia", name: "Bank Asia" },
  { code: "prime_bank", name: "Prime Bank" },
  { code: "scb_bd", name: "Standard Chartered Bangladesh" },
];

const TEAM_DEMO_CHIPS = [
  { phone: "01782670589", label: "01782670589 · Srabon (24)" },
  { phone: "01858500761", label: "01858500761 · Hasibur Rahman (25)" },
  { phone: "01788930055", label: "01788930055 · Nazia Islam (23)" },
  { phone: "01776277356", label: "01776277356 · Mehedi Minhaz (25)" },
  { phone: "01315244948", label: "01315244948 · Nihar Ranjan Roy (24)" },
];

const JUDGE_SCENARIOS = [
  {
    id: "A",
    label: "Scenario A: Low Risk",
    cls: "bg-emerald-500/15 border-emerald-500/35 text-emerald-300",
    phone: "01782670589",
    bankCode: "brac_bank",
    bankName: "BRAC Bank",
    account: "100234567890",
  },
  {
    id: "B",
    label: "Scenario B: Medium Risk",
    cls: "bg-orange-500/15 border-orange-500/35 text-orange-300",
    phone: "01855992211",
    bankCode: "dhaka_bank",
    bankName: "Dhaka Bank",
    account: "300998877665",
  },
  {
    id: "C",
    label: "Scenario C: High Risk",
    cls: "bg-red-500/15 border-red-500/35 text-red-300",
    phone: "01999884433",
    bankCode: "islami_bank",
    bankName: "Islami Bank Bangladesh",
    account: "400999884491",
  },
];

export const RecipientLookupSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"phone" | "bank">("phone");
  const [demoMode, setDemoMode] = useState(true);

  // Phone Lookup State
  const [phoneInput, setPhoneInput] = useState("01782670589");
  const [phoneData, setPhoneData] = useState<any | null>(null);
  const [txFilter, setTxFilter] = useState("");
  const [loadingPhone, setLoadingPhone] = useState(false);

  // Bank Lookup State
  const [bankSearch, setBankSearch] = useState("");
  const [selectedBankCode, setSelectedBankCode] = useState("brac_bank");
  const [accountNumber, setAccountNumber] = useState("100234567890");
  const [holderName, setHolderName] = useState("");
  const [accountType, setAccountType] = useState("Savings Account");
  const [bankData, setBankData] = useState<any | null>(null);
  const [loadingBank, setLoadingBank] = useState(false);

  // AI Intelligence Report & Privacy Consent
  const [aiConsent, setAiConsent] = useState(false);
  const [aiReport, setAiReport] = useState<{
    summary: string;
    engine: string;
    source_type: string;
    disclaimer: string;
  } | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupPhone = async (phoneVal: string, useDemo = demoMode) => {
    const cleaned = phoneVal.trim();
    if (cleaned.length < 6) {
      setError("Please enter a valid Bangladeshi mobile number (01XXXXXXXXX or +8801XXXXXXXXX).");
      return;
    }
    setError(null);
    setAiReport(null);
    setLoadingPhone(true);
    try {
      const res = await api.request<any>(
        `/api/v1/recipient-intel/phone?phone=${encodeURIComponent(cleaned)}&demo_mode=${useDemo}`
      );
      setPhoneData(res);
    } catch (err: any) {
      setError(err.message || "Phone lookup failed.");
    } finally {
      setLoadingPhone(false);
    }
  };

  const lookupBank = async (
    bCode = selectedBankCode,
    acct = accountNumber,
    hName = holderName,
    aType = accountType
  ) => {
    const bankObj = BD_BANKS.find((b) => b.code === bCode) || BD_BANKS[0];
    setError(null);
    setAiReport(null);
    setLoadingBank(true);
    try {
      const res = await api.request<any>("/api/v1/recipient-intel/bank", {
        method: "POST",
        body: JSON.stringify({
          bank_code: bankObj.code,
          bank_name: bankObj.name,
          account_number: acct,
          account_holder_name: hName || null,
          account_type: aType || null,
        }),
      });
      setBankData(res);
    } catch (err: any) {
      setError(err.message || "Bank account verification failed.");
    } finally {
      setLoadingBank(false);
    }
  };

  useEffect(() => {
    lookupPhone("01782670589", true);
    lookupBank("brac_bank", "100234567890", "", "Savings Account");
  }, []);

  const generateAiSummary = async () => {
    if (!aiConsent) {
      setError("Please check the privacy consent box before generating an AI Intelligence Report.");
      return;
    }
    setError(null);
    setLoadingAi(true);
    try {
      const isPhone = activeTab === "phone" && phoneData;
      const payload = isPhone
        ? {
            subject_type: "phone",
            masked_identifier: `****${phoneData.profile.mobile_number.slice(-4)}`,
            risk_score: phoneData.risk_analysis.risk_score,
            risk_level: phoneData.risk_analysis.risk_level,
            verification_status: phoneData.profile.account_verification_status,
            factors: phoneData.risk_analysis.risk_factors,
            consent_granted: true,
          }
        : {
            subject_type: "bank",
            masked_identifier: bankData.masked_account,
            risk_score: bankData.risk_score,
            risk_level: bankData.risk_level,
            verification_status: bankData.account_verification_status,
            factors: bankData.risk_factors,
            consent_granted: true,
          };
      const res = await api.request<any>("/api/v1/recipient-intel/ai-report", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setAiReport(res);
    } catch (err: any) {
      setError(err.message || "Failed to generate AI report.");
    } finally {
      setLoadingAi(false);
    }
  };

  const exportReportJson = () => {
    const payload = activeTab === "phone" ? phoneData : bankData;
    if (!payload) return;
    const blob = new Blob([JSON.stringify({ generated_at: new Date().toISOString(), ai_report: aiReport, report: payload }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fraudshield_${activeTab}_intelligence_report.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const filteredBanks = BD_BANKS.filter((b) =>
    b.name.toLowerCase().includes(bankSearch.trim().toLowerCase())
  );
  const activeBankObj = BD_BANKS.find((b) => b.code === selectedBankCode) || BD_BANKS[0];

  const filteredPhoneTxs = (phoneData?.transaction_intelligence?.transactions || []).filter((tx: any) => {
    if (!txFilter.trim()) return true;
    const q = txFilter.toLowerCase();
    return (
      tx.tx_ref.toLowerCase().includes(q) ||
      tx.provider.toLowerCase().includes(q) ||
      tx.recipient_name.toLowerCase().includes(q) ||
      tx.location.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Header + Judge Demo Mode Toggle */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-purple-400">
            <FileSearch className="w-3.5 h-3.5" />
            <span>Recipient Intelligence Center</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-0.5">
            Phone &amp; Bank Account Risk Lookup
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Evaluate recipient trustworthiness, verify supported bank accounts, inspect authorized or
            demonstration transaction relationships, and review explainable evidence before transferring funds.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0d1322] border border-[#1d2842] text-xs text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(e) => {
                const next = e.target.checked;
                setDemoMode(next);
                if (activeTab === "phone") lookupPhone(phoneInput, next);
              }}
            />
            <span>Judge Demo Mode (DEMO DATA)</span>
          </label>
          <button
            type="button"
            onClick={exportReportJson}
            className="px-3 py-2 rounded-lg bg-[#141c30] hover:bg-[#1c2742] border border-[#243252] text-xs font-medium text-slate-200 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Mode Tabs + Judge Scenarios */}
      <div className="bg-[#0d1322] border border-[#1d2842] rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex p-1 rounded-lg bg-[#080c17] border border-[#1d2842]">
            <button
              type="button"
              onClick={() => setActiveTab("phone")}
              className={`px-4 py-2 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors ${
                activeTab === "phone" ? "bg-[#2e2259] text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Phone Number Intelligence</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("bank")}
              className={`px-4 py-2 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors ${
                activeTab === "bank" ? "bg-[#2e2259] text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>Bank Account Verification &amp; Risk Lookup</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-slate-400 font-semibold">Judge Scenarios:</span>
            {JUDGE_SCENARIOS.map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => {
                  setDemoMode(true);
                  if (activeTab === "phone") {
                    setPhoneInput(sc.phone);
                    lookupPhone(sc.phone, true);
                  } else {
                    setSelectedBankCode(sc.bankCode);
                    setAccountNumber(sc.account);
                    lookupBank(sc.bankCode, sc.account, "", accountType);
                  }
                }}
                className={`px-2.5 py-1 rounded-md border font-semibold ${sc.cls}`}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab 1 Search Bar + Team Demo Profiles */}
        {activeTab === "phone" && (
          <div className="space-y-3 pt-2 border-t border-[#182238]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                lookupPhone(phoneInput);
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <div className="relative flex-1 min-w-[260px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="Enter BD mobile number (01XXXXXXXXX or +8801XXXXXXXXX)"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#080c17] border border-[#243252] text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>
              <button
                type="submit"
                disabled={loadingPhone}
                className="px-4 py-2 rounded-lg bg-[#4c3599] hover:bg-[#5e42bd] text-xs font-semibold text-white"
              >
                {loadingPhone ? "Analyzing..." : "Inspect Phone Number"}
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-slate-400 font-medium">Consented Demo Profiles (DEMO DATA):</span>
              {TEAM_DEMO_CHIPS.map((c) => (
                <button
                  key={c.phone}
                  type="button"
                  onClick={() => {
                    setDemoMode(true);
                    setPhoneInput(c.phone);
                    lookupPhone(c.phone, true);
                  }}
                  className={`px-2.5 py-1 rounded-md border transition-colors ${
                    phoneInput === c.phone
                      ? "bg-[#2e2259] border-[#6b4ee6] text-white"
                      : "bg-[#080c17] border-[#1d2842] text-slate-300 hover:text-white"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Bank Account Verification Form */}
        {activeTab === "bank" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              lookupBank();
            }}
            className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-[#182238] text-xs"
          >
            <div className="md:col-span-4 space-y-1.5">
              <label className="text-slate-400 block">Step 1: Search &amp; Select Bank</label>
              <input
                type="text"
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                placeholder="Filter bank name..."
                className="w-full px-3 py-1.5 rounded-lg bg-[#080c17] border border-[#1d2842] text-white mb-1"
              />
              <div className="flex items-center gap-2">
                <InstitutionLogo code={activeBankObj.code} name={activeBankObj.name} />
                <select
                  value={selectedBankCode}
                  onChange={(e) => setSelectedBankCode(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#080c17] border border-[#243252] text-white"
                >
                  {filteredBanks.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <label className="text-slate-400 block">Step 2: Bank Account Number</label>
              <input
                type="text"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g. 100234567890"
                className="w-full px-3 py-2 rounded-lg bg-[#080c17] border border-[#243252] text-white font-mono"
              />
              <div className="text-[10px] text-slate-500">Masked automatically in logs</div>
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <label className="text-slate-400 block">Account Holder (Optional) &amp; Type</label>
              <input
                type="text"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                placeholder="Optional authorized name"
                className="w-full px-3 py-1.5 rounded-lg bg-[#080c17] border border-[#1d2842] text-white mb-1"
              />
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#080c17] border border-[#1d2842] text-slate-200"
              >
                <option>Savings Account</option>
                <option>Current Account</option>
                <option>Merchant Current</option>
                <option>Corporate Account</option>
              </select>
            </div>

            <div className="md:col-span-2 flex items-end">
              <button
                type="submit"
                disabled={loadingBank}
                className="w-full py-2.5 rounded-lg bg-[#4c3599] hover:bg-[#5e42bd] text-white font-semibold"
              >
                {loadingBank ? "Verifying..." : "Verify & Analyze"}
              </button>
            </div>
          </form>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* ==================== PHONE NUMBER INTELLIGENCE REPORT ==================== */}
      {activeTab === "phone" && phoneData && (
        <div className="space-y-4">
          {/* Top 4-Panel Grid: Profile + Risk Gauge + Map + Risk Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Recipient Profile */}
            <div className="lg:col-span-5 bg-[#0d1322] border border-[#1d2842] rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-purple-400" />
                  Recipient Profile
                </span>
                {phoneData.profile.is_demo_data ? (
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold">
                    DEMO DATA (CONSENTED)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-semibold">
                    LIVE FORMAT CHECK
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 bg-[#080c17] p-3.5 rounded-lg border border-[#182238] text-xs">
                <div>
                  <div className="text-slate-400">Mobile Number</div>
                  <div className="font-mono font-bold text-blue-300 mt-0.5">
                    {phoneData.profile.mobile_number}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Verified Name</div>
                  <div className="font-bold text-white mt-0.5">{phoneData.profile.verified_name}</div>
                </div>
                <div>
                  <div className="text-slate-400">Age (Consented)</div>
                  <div className="text-slate-200 mt-0.5">{phoneData.profile.age}</div>
                </div>
                <div>
                  <div className="text-slate-400">Network Operator</div>
                  <div className="text-emerald-300 font-semibold mt-0.5">
                    {phoneData.profile.mobile_operator}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Number Validation</div>
                  <div className="mt-0.5">
                    {phoneData.profile.format_valid ? (
                      <span className="text-emerald-400 font-semibold">Valid BD Format</span>
                    ) : (
                      <span className="text-red-400 font-semibold">Invalid Format</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Account Verification</div>
                  <div className="font-semibold text-white mt-0.5">
                    {phoneData.profile.account_verification_status}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-slate-400">Address / Region</div>
                  <div className="text-slate-200 mt-0.5">
                    {phoneData.profile.address} ({phoneData.profile.city})
                  </div>
                </div>
                <div className="col-span-2 text-[11px] text-slate-400 border-t border-[#182238] pt-2">
                  <strong className="text-slate-300">Public Risk Info:</strong>{" "}
                  {phoneData.profile.public_risk_info}
                </div>
              </div>
              <div className="text-[10.5px] text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Last Checked: {new Date(phoneData.profile.last_verified_at).toLocaleString()}</span>
              </div>
            </div>

            {/* Risk Score Gauge & Breakdown */}
            <div className="lg:col-span-4 bg-[#0d1322] border border-[#1d2842] rounded-xl p-5 flex flex-col justify-between space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Recipient Risk Analysis
              </div>
              <div className="h-36">
                <RiskGauge
                  score={phoneData.risk_analysis.risk_score}
                  riskLevel={phoneData.risk_analysis.risk_level}
                />
              </div>
              <div className="space-y-2 pt-2 border-t border-[#182238]">
                {phoneData.risk_analysis.risk_factors.map((f: any) => (
                  <div key={f.factor} className="text-[11px] space-y-1">
                    <div className="flex justify-between text-slate-300">
                      <span>{f.factor}</span>
                      <span className="font-mono text-white">{f.score}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#151e33] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          f.severity === "high"
                            ? "bg-red-500"
                            : f.severity === "medium"
                            ? "bg-orange-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.max(4, Math.min(100, f.score))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[11px] p-2.5 rounded bg-[#080c17] border border-[#182238] text-slate-300">
                <strong className="text-white">Recommendation:</strong>{" "}
                {phoneData.risk_analysis.recommended_action}
              </div>
            </div>

            {/* Google Maps Location Preview */}
            <div className="lg:col-span-3 bg-[#0d1322] border border-[#1d2842] rounded-xl p-4 flex flex-col justify-between space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Location Context
              </div>
              <GoogleGeoMap
                latitude={phoneData.profile.latitude}
                longitude={phoneData.profile.longitude}
                city={phoneData.profile.city.split(",")[0]}
                region={phoneData.profile.city}
                country="Bangladesh"
                ipAddress={phoneData.profile.mobile_number}
                riskLevel={phoneData.risk_analysis.risk_level}
              />
              <div className="text-[10.5px] text-slate-400">
                Confidence: <strong className="text-white">{phoneData.risk_analysis.confidence}%</strong>{" "}
                · Complaints: <strong className="text-white">{phoneData.risk_analysis.complaints_count}</strong>
              </div>
            </div>
          </div>

          {/* Recipient Transaction Intelligence */}
          <div className="bg-[#0d1322] border border-[#1d2842] rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Authorized &amp; Demo Transaction Relationship History
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {phoneData.transaction_intelligence.privacy_notice}
                </p>
              </div>
              <input
                type="text"
                value={txFilter}
                onChange={(e) => setTxFilter(e.target.value)}
                placeholder="Filter ref, bank, location..."
                className="px-3 py-1.5 rounded-lg bg-[#080c17] border border-[#1d2842] text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#080c17] border border-[#182238]">
                <div className="text-slate-400">Transactions</div>
                <div className="text-base font-bold text-white mt-0.5">
                  {phoneData.transaction_intelligence.total_transactions}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#080c17] border border-[#182238]">
                <div className="text-slate-400">Total Volume</div>
                <div className="text-base font-bold text-blue-300 mt-0.5">
                  BDT {phoneData.transaction_intelligence.total_volume.toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#080c17] border border-[#182238]">
                <div className="text-slate-400">Suspicious Links</div>
                <div className="text-base font-bold text-red-400 mt-0.5">
                  {phoneData.transaction_intelligence.suspicious_relationships}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#080c17] border border-[#182238]">
                <div className="text-slate-400">Previous Recipients</div>
                <div className="text-xs font-semibold text-slate-200 mt-1 truncate">
                  {phoneData.transaction_intelligence.previous_recipients.join(", ") || "None"}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-[#182238] bg-[#080c17]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#182238] text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5">Ref &amp; Origin</th>
                    <th className="px-3 py-2.5">Date &amp; Time</th>
                    <th className="px-3 py-2.5">Sender &rarr; Recipient</th>
                    <th className="px-3 py-2.5">Method / Provider</th>
                    <th className="px-3 py-2.5">Location</th>
                    <th className="px-3 py-2.5">Amount</th>
                    <th className="px-3 py-2.5">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141d33]">
                  {filteredPhoneTxs.map((tx: any) => (
                    <tr key={tx.tx_ref} className="hover:bg-[#11192e]">
                      <td className="px-3 py-2.5 font-mono text-blue-300">
                        <div>{tx.tx_ref}</div>
                        <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                          {tx.data_origin}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">
                        <div>{tx.date}</div>
                        <div className="text-[10.5px] text-slate-500">{tx.time}</div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-200">
                        <div>
                          {tx.sender_masked} &rarr; {tx.recipient_masked}
                        </div>
                        <div className="text-[10.5px] text-slate-400">{tx.recipient_name}</div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">
                        <div>{tx.payment_method}</div>
                        <div className="text-[10.5px] text-slate-400">{tx.provider}</div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">{tx.location}</td>
                      <td className="px-3 py-2.5 font-semibold text-white">
                        {tx.currency} {Number(tx.amount).toLocaleString()}
                        <div className="text-[10.5px] font-normal text-slate-400">{tx.status}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded font-semibold ${
                            tx.risk_score >= 70
                              ? "bg-red-500/15 text-red-400"
                              : tx.risk_score >= 31
                              ? "bg-orange-500/15 text-orange-400"
                              : "bg-emerald-500/15 text-emerald-400"
                          }`}
                        >
                          {tx.risk_score}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredPhoneTxs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                        No authorized or demonstration transactions found for this number.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== BANK ACCOUNT VERIFICATION REPORT ==================== */}
      {activeTab === "bank" && bankData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 bg-[#0d1322] border border-[#1d2842] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <InstitutionLogo code={bankData.bank_code} name={bankData.bank_name} />
                <div>
                  <h3 className="text-base font-bold text-white">{bankData.bank_name}</h3>
                  <div className="text-xs font-mono text-blue-300">
                    Account: {bankData.masked_account} · {bankData.account_type}
                  </div>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-md text-xs font-bold border ${
                  bankData.account_verification_status === "Verified"
                    ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                    : bankData.account_verification_status === "Pending Verification"
                    ? "bg-orange-500/15 border-orange-500/35 text-orange-300"
                    : "bg-red-500/15 border-red-500/35 text-red-300"
                }`}
              >
                {bankData.account_verification_status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-[#080c17] p-4 rounded-lg border border-[#182238] text-xs">
              <div>
                <div className="text-slate-400">Account Holder</div>
                <div className="font-bold text-white mt-0.5">{bankData.account_holder_name}</div>
              </div>
              <div>
                <div className="text-slate-400">Verification Timestamp</div>
                <div className="text-slate-200 mt-0.5">
                  {new Date(bankData.verified_at).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Available Bank Risk Indicators
              </div>
              {bankData.risk_indicators.map((ind: string) => (
                <div
                  key={ind}
                  className="p-2.5 rounded-lg bg-[#080c17] border border-[#182238] text-xs text-slate-300 flex items-center gap-2"
                >
                  <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>{ind}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#0d1322] border border-[#1d2842] rounded-xl p-5 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Bank Account Risk Score
            </div>
            <div className="h-36">
              <RiskGauge score={bankData.risk_score} riskLevel={bankData.risk_level} />
            </div>
            <div className="space-y-2 pt-2 border-t border-[#182238]">
              {bankData.risk_factors.map((f: any) => (
                <div key={f.factor} className="text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>{f.factor}</span>
                    <span className="font-mono text-white">{f.score}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#151e33] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        f.severity === "high"
                          ? "bg-red-500"
                          : f.severity === "medium"
                          ? "bg-orange-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.max(4, Math.min(100, f.score))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== EVIDENCE SOURCES + AI INTELLIGENCE REPORT ==================== */}
      {(phoneData || bankData) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Evidence & Source Transparency Table */}
          <div className="lg:col-span-7 bg-[#0d1322] border border-[#1d2842] rounded-xl p-5 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Evidence &amp; Source Transparency</span>
            </div>
            <div className="space-y-2">
              {((activeTab === "phone" ? phoneData?.evidence_sources : bankData?.evidence_sources) || []).map(
                (src: any) => (
                  <div
                    key={src.source_name}
                    className="p-3 rounded-lg bg-[#080c17] border border-[#182238] text-xs space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-white">{src.source_name}</span>
                      <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 text-[10px] font-semibold">
                        {src.source_type}
                      </span>
                    </div>
                    <div className="text-slate-400">
                      Status: <strong className="text-slate-200">{src.verification_status}</strong> ·
                      Confidence: <strong className="text-slate-200">{src.confidence}</strong>
                    </div>
                    <div className="text-[11px] text-slate-400">{src.details}</div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Consent-Gated AI Intelligence Report (OpenAI + Explainable Fallback) */}
          <div className="lg:col-span-5 bg-[#0d1322] border border-[#1d2842] rounded-xl p-5 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>AI Intelligence Report (Consent-Gated)</span>
            </div>

            <label className="flex items-start gap-2 text-[11px] text-slate-300 bg-[#080c17] p-3 rounded-lg border border-[#182238] cursor-pointer">
              <input
                type="checkbox"
                checked={aiConsent}
                onChange={(e) => setAiConsent(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I explicitly authorize generating an AI summary using <strong>masked</strong> risk
                signals only (no raw phone/bank numbers sent externally without consent).
              </span>
            </label>

            <button
              type="button"
              disabled={loadingAi}
              onClick={generateAiSummary}
              className="w-full py-2 rounded-lg bg-[#4c3599] hover:bg-[#5e42bd] text-xs font-semibold text-white flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{loadingAi ? "Generating AI Summary..." : "Generate AI Intelligence Report"}</span>
            </button>

            {aiReport ? (
              <div className="p-3.5 rounded-lg bg-[#080c17] border border-purple-500/30 text-xs space-y-2">
                <div className="text-[10.5px] font-semibold text-purple-300">{aiReport.source_type}</div>
                <p className="text-slate-200 whitespace-pre-line leading-relaxed">{aiReport.summary}</p>
                <div className="text-[10px] text-amber-300/90 border-t border-[#182238] pt-2">
                  {aiReport.disclaimer}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 text-center py-3">
                Check consent above and click Generate to produce an explainable AI summary.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
