import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Crosshair,
  Globe,
  Info,
  MailWarning,
  Network,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Volume2,
  Wifi,
  Zap,
} from "lucide-react";
import { GoogleGeoMap } from "../components/GoogleGeoMap";
import { RiskGauge } from "../components/RiskGauge";
import { useRiskDecision } from "../context/RiskDecisionContext";
import { api } from "../services/api";

interface DashboardOverview {
  intel: {
    ip_address: string;
    risk_score: number;
    risk_level: string;
    is_demo_data: boolean;
    risk_summary: { key: string; label: string; value: string; status: "danger" | "warning" | "safe" }[];
    geo_location: {
      country: string;
      country_code: string;
      region: string;
      city: string;
      latitude: number;
      longitude: number;
      privacy_notice: string;
    };
    risk_indicators: { label: string; severity: string; explanation: string }[];
    detailed_information: Record<string, string>;
    recommendation: { summary: string; action: string; severity: string };
  };
  available_ips: {
    ip_address: string;
    city: string;
    country: string;
    risk_score: number;
    risk_level: string;
    is_demo_data: boolean;
  }[];
  google_maps_configured: boolean;
  google_maps_api_key: string | null;
  user_summary: {
    monitored_transactions: number;
    high_risk_transactions: number;
  };
}

const SUMMARY_ICONS: Record<string, React.ElementType> = {
  vpn_proxy: Wifi,
  tor_node: Network,
  hosting_dc: Server,
  known_attacker: UserCheck,
  spam_source: MailWarning,
  abuse_confidence: Crosshair,
};

export const DashboardPage: React.FC = () => {
  const { runQuickTest, triggerAlarmTest, lastUpdateTick } = useRiskDecision();
  const [selectedIp, setSelectedIp] = useState("103.21.244.0");
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIndicator, setActiveIndicator] = useState<string | null>(null);
  const [testingPreset, setTestingPreset] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .request<DashboardOverview>(`/api/v1/dashboard/overview?ip_address=${encodeURIComponent(selectedIp)}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [selectedIp, lastUpdateTick]);

  const handleQuickTest = async (preset: "low" | "medium" | "high") => {
    setTestingPreset(preset);
    try {
      await runQuickTest(preset);
    } finally {
      setTestingPreset(null);
    }
  };

  if (loading && !data) {
    return <div className="p-8 text-slate-400 text-sm">Loading FraudShield telemetry...</div>;
  }
  if (!data) return null;

  const { intel } = data;
  const isHigh = intel.risk_score >= 70;
  const isMed = intel.risk_score >= 31 && intel.risk_score < 70;
  const levelTextColor = isHigh
    ? "text-red-400"
    : isMed
    ? "text-orange-400"
    : "text-emerald-400";

  return (
    <div className="space-y-4">
      {/* Top Toolbar: IP selector & clear DEMO DATA label */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {intel.is_demo_data && (
            <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
              DEMO THREAT INTELLIGENCE
            </span>
          )}
          <span>
            Monitored Transactions:{" "}
            <strong className="text-white">{data.user_summary.monitored_transactions}</strong> · Flagged:{" "}
            <strong className="text-red-400">{data.user_summary.high_risk_transactions}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Inspect IP Telemetry:</span>
          <select
            value={selectedIp}
            onChange={(e) => setSelectedIp(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#0d1322] border border-[#1d2842] text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
          >
            {data.available_ips.map((ip) => (
              <option key={ip.ip_address} value={ip.ip_address}>
                {ip.ip_address} — {ip.city}, {ip.country} ({ip.risk_score}/100)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3-Tier Risk Approval Simulator Quick-Test Bar */}
      <div className="bg-[#0d1322] border border-[#1d2842] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Zap className="w-4 h-4 text-purple-400 shrink-0" />
          <span className="font-semibold text-white">3-Tier Risk Approval Simulator:</span>
          <span className="text-slate-400 hidden sm:inline">
            Low (0–29% Safe Flow), Medium/High (30–79% Confirm / Reject Alert), and Critical (80–100% 5s Auto-Reject + Alarm)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={testingPreset !== null}
            onClick={() => handleQuickTest("low")}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-xs font-semibold text-emerald-300 transition-colors"
          >
            {testingPreset === "low" ? "Running..." : "Test Low Risk (25%)"}
          </button>
          <button
            type="button"
            disabled={testingPreset !== null}
            onClick={() => handleQuickTest("medium")}
            className="px-3 py-1.5 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/35 text-xs font-semibold text-orange-300 transition-colors"
          >
            {testingPreset === "medium" ? "Running..." : "Test Medium Risk (65%)"}
          </button>
          <button
            type="button"
            disabled={testingPreset !== null}
            onClick={() => handleQuickTest("high")}
            className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-xs font-semibold text-red-300 transition-colors"
          >
            {testingPreset === "high" ? "Running..." : "Test High Risk (92%)"}
          </button>
          <button
            type="button"
            onClick={triggerAlarmTest}
            title="Unlock & preview Web Audio security alarm"
            className="px-2.5 py-1.5 rounded-lg bg-[#141c30] hover:bg-[#1e2945] border border-[#2a395c] text-xs text-slate-300 flex items-center gap-1"
          >
            <Volume2 className="w-3.5 h-3.5 text-purple-300" />
            <span>Test Audio</span>
          </button>
        </div>
      </div>

      {/* TOP ROW: Hero Card + Risk Gauge (Recreates Image 1) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Hero Card */}
        <div className="lg:col-span-8 bg-[#0d1322] border border-[#1d2842] rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Large Red Shield with Magnifying Glass + Exclamation */}
          <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 96 96" className="w-24 h-24 drop-shadow-[0_0_18px_rgba(239,68,68,0.28)]">
              <path
                d="M48 8L14 22V46C14 68 29 84 48 90C67 84 82 68 82 46V22L48 8Z"
                fill="#ef4444"
                fillOpacity="0.08"
                stroke="#ef4444"
                strokeWidth="4"
                strokeLinejoin="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <Search className="w-10 h-10 text-red-500 stroke-[2.5]" />
                <span className="absolute left-[13px] top-[7px] text-xs font-extrabold text-red-400">
                  !
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-red-400 uppercase mb-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Fraud Detection</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Fraud Detection</h1>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              Identify suspicious activity and high-risk IP addresses in real-time to protect your
              financial platform.
            </p>

            {/* Inline 3-metric bar */}
            <div className="mt-4 inline-grid grid-cols-3 gap-5 px-4 py-3 rounded-lg bg-[#080c17] border border-[#1b253d] whitespace-nowrap">
              <div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <span>IP Address</span>
                </div>
                <div className="text-sm font-mono font-semibold text-blue-400 mt-0.5">
                  {intel.ip_address}
                </div>
              </div>
              <div className="border-l border-[#1b253d] pl-5">
                <div className="text-[11px] text-slate-400">Risk Score</div>
                <div className={`text-sm font-bold mt-0.5 ${levelTextColor}`}>
                  {intel.risk_score} / 100
                </div>
              </div>
              <div className="border-l border-[#1b253d] pl-5">
                <div className="text-[11px] text-slate-400">Risk Level</div>
                <div className={`text-sm font-bold mt-0.5 ${levelTextColor}`}>
                  {intel.risk_level}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Risk Score Gauge Card */}
        <div className="lg:col-span-4 bg-[#0d1322] border border-[#1d2842] rounded-xl p-5 flex items-center justify-center min-h-[210px]">
          <RiskGauge score={intel.risk_score} riskLevel={intel.risk_level} />
        </div>
      </div>

      {/* MIDDLE ROW: Risk Summary | Geo Location (Google Maps) | Risk Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Risk Summary Panel */}
        <div className="lg:col-span-3 bg-[#0d1322] border border-[#1d2842] rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-slate-300 mb-3">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span>Risk Summary</span>
          </div>
          <div className="divide-y divide-[#182238]">
            {intel.risk_summary.map((item) => {
              const Icon = SUMMARY_ICONS[item.key] || AlertTriangle;
              const badgeCls =
                item.status === "danger"
                  ? "bg-red-500/15 text-red-400 border-red-500/25"
                  : item.status === "warning"
                  ? "bg-orange-500/15 text-orange-400 border-orange-500/25"
                  : "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
              return (
                <div key={item.key} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11.5px] text-slate-300 whitespace-nowrap">
                    <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border shrink-0 ${badgeCls}`}
                  >
                    {item.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Location Panel with Google Maps */}
        <div className="lg:col-span-6 bg-[#0d1322] border border-[#1d2842] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-slate-300">
              <Globe className="w-4 h-4 text-blue-400" />
              <span>Location</span>
            </div>
            <span
              className="text-[11px] text-slate-400 flex items-center gap-1"
              title={intel.geo_location.privacy_notice}
            >
              <Info className="w-3.5 h-3.5 text-slate-500" />
              <span>Approximate IP Location</span>
            </span>
          </div>

          <GoogleGeoMap
            apiKey={data.google_maps_api_key}
            latitude={intel.geo_location.latitude}
            longitude={intel.geo_location.longitude}
            city={intel.geo_location.city}
            region={intel.geo_location.region}
            country={intel.geo_location.country}
            ipAddress={intel.ip_address}
            riskLevel={intel.risk_level}
          />

          <div className="grid grid-cols-5 gap-2 pt-3 mt-3 border-t border-[#182238] text-xs">
            <div>
              <div className="text-[11px] text-slate-400">Country</div>
              <div className="font-semibold text-white mt-0.5 truncate">
                {intel.geo_location.country}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Region</div>
              <div className="font-semibold text-white mt-0.5 truncate">
                {intel.geo_location.region}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">City</div>
              <div className="font-semibold text-white mt-0.5 truncate">
                {intel.geo_location.city}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Latitude</div>
              <div className="font-mono font-semibold text-white mt-0.5">
                {intel.geo_location.latitude.toFixed(4)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Longitude</div>
              <div className="font-mono font-semibold text-white mt-0.5">
                {intel.geo_location.longitude.toFixed(4)}
              </div>
            </div>
          </div>
        </div>

        {/* Risk Indicators Panel */}
        <div className="lg:col-span-3 bg-[#0d1322] border border-[#1d2842] rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-slate-300 mb-4">
            <Crosshair className="w-4 h-4 text-blue-400" />
            <span>Risk Indicators</span>
          </div>
          <div className="divide-y divide-[#182238]">
            {intel.risk_indicators.map((ind) => {
              const sevLower = ind.severity.toLowerCase();
              const dotCls =
                sevLower === "high" || sevLower === "listed"
                  ? "bg-red-500"
                  : sevLower === "medium"
                  ? "bg-orange-400"
                  : "bg-emerald-500";
              const textCls =
                sevLower === "high" || sevLower === "listed"
                  ? "text-red-400"
                  : sevLower === "medium"
                  ? "text-orange-400"
                  : "text-emerald-400";
              const expanded = activeIndicator === ind.label;
              return (
                <div key={ind.label} className="py-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveIndicator(expanded ? null : ind.label)}
                    className="w-full flex items-center justify-between text-xs text-left hover:opacity-90"
                    title="Click for explanation"
                  >
                    <span className="text-slate-300">{ind.label}</span>
                    <span className={`inline-flex items-center gap-1.5 font-semibold ${textCls}`}>
                      <span className={`w-2 h-2 rounded-full ${dotCls}`} />
                      {ind.severity}
                    </span>
                  </button>
                  {expanded && (
                    <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed bg-[#080c17] p-2 rounded border border-[#182238]">
                      {ind.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: Detailed Information + Recommendation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Detailed Information */}
        <div className="lg:col-span-7 bg-[#0d1322] border border-[#1d2842] rounded-xl p-5">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-slate-300 mb-4">
            <Info className="w-4 h-4 text-blue-400" />
            <span>Detailed Information</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 text-xs">
            {[
              ["IP Address", intel.detailed_information.ip_address],
              ["Domain", intel.detailed_information.domain],
              ["ASN", intel.detailed_information.asn],
              ["Time Zone", intel.detailed_information.timezone],
              ["ISP / Organization", intel.detailed_information.isp_org],
              ["Local Time", intel.detailed_information.local_time],
              ["Connection Type", intel.detailed_information.connection_type],
              ["IP Age", intel.detailed_information.ip_age],
              ["Usage Type", intel.detailed_information.usage_type],
              ["Last Seen", intel.detailed_information.last_seen],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between py-1.5 border-b border-[#161f33]"
              >
                <span className="text-slate-400">{label}</span>
                <span className="text-slate-100 font-medium font-mono text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendation Card */}
        <div className="lg:col-span-5 bg-[#0d1322] border border-[#1d2842] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-slate-300 mb-4">
            <ShieldCheck className="w-4 h-4 text-slate-300" />
            <span>Recommendation</span>
          </div>

          <div className="flex items-center gap-5 my-auto py-2">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center shrink-0 border-2 ${
                isHigh
                  ? "bg-red-500/10 border-red-500/50 shadow-[0_0_24px_rgba(239,68,68,0.25)]"
                  : isMed
                  ? "bg-orange-500/10 border-orange-500/50"
                  : "bg-emerald-500/10 border-emerald-500/50"
              }`}
            >
              <ShieldCheck
                className={`w-8 h-8 ${
                  isHigh ? "text-red-500" : isMed ? "text-orange-400" : "text-emerald-400"
                }`}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-300 leading-relaxed">
                {intel.recommendation.summary}
              </p>
              <div className="text-xs">
                <div className={`font-semibold ${levelTextColor}`}>Recommended Action:</div>
                <div className={`font-bold ${levelTextColor}`}>{intel.recommendation.action}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
