import React, { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, FileText, ShieldAlert } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GraphNetworkView } from "../components/GraphNetworkView";
import { useRiskDecision } from "../context/RiskDecisionContext";
import { api } from "../services/api";

/* ---------- 1. Fraud Investigation Center ---------- */
export const InvestigationPage: React.FC = () => {
  const [flagged, setFlagged] = useState<any[]>([]);

  const load = async () => {
    const res = await api.request<{ items: any[] }>("/api/v1/transactions?range=all");
    setFlagged(res.items.filter((t) => t.risk_score >= 31 || t.status !== "Completed"));
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (id: number, decision: string) => {
    await api.request(`/api/v1/transactions/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    });
    await load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-red-400" />
          <span>Fraud Investigation Center</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Human-in-the-loop review queue for medium and high-risk financial anomalies.
        </p>
      </div>

      <div className="space-y-3">
        {flagged.map((tx) => (
          <div
            key={tx.id}
            className="bg-[#0d1322] border border-[#1d2842] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-blue-400">{tx.tx_ref}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    tx.risk_score >= 70
                      ? "bg-red-500/15 text-red-400"
                      : "bg-orange-500/15 text-orange-400"
                  }`}
                >
                  Score {tx.risk_score} · {tx.risk_level}
                </span>
                {tx.is_demo_data && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px]">
                    DEMO DATA
                  </span>
                )}
              </div>
              <div className="text-sm font-bold text-white">
                {tx.currency} {tx.amount.toLocaleString()} → {tx.recipient_name} ({tx.recipient_account_masked})
              </div>
              <div className="text-xs text-slate-400">
                {tx.source_institution} · {tx.device_label} · IP {tx.ip_address} ({tx.location_label})
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => decide(tx.id, "Approved")}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-semibold text-emerald-300"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => decide(tx.id, "Confirmed Fraud")}
                className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-xs font-semibold text-red-300"
              >
                Confirm Fraud
              </button>
              <button
                type="button"
                onClick={() => decide(tx.id, "Escalated")}
                className="px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-xs font-semibold text-purple-300"
              >
                Escalate
              </button>
            </div>
          </div>
        ))}
        {flagged.length === 0 && (
          <div className="bg-[#0d1322] border border-[#1d2842] rounded-xl p-8 text-center text-xs text-slate-400">
            No medium or high-risk transactions currently awaiting review.
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------- 2. Graph Relationship Network ---------- */
export const GraphNetworkPage: React.FC = () => <GraphNetworkView />;

/* ---------- 3. Security Alerts ---------- */
export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);

  const load = async () => {
    const res = await api.request<{ items: any[] }>("/api/v1/intelligence/alerts");
    setAlerts(res.items);
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (id: number, status: string) => {
    await api.request(`/api/v1/intelligence/alerts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-amber-400" />
          <span>Security Alerts</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Real-time notifications generated by the FraudShield Communication Agent.
        </p>
      </div>

      <div className="space-y-3">
        {alerts.map((a) => (
          <div key={a.id} className="bg-[#0d1322] border border-[#1d2842] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    a.severity === "critical" || a.severity === "high"
                      ? "bg-red-500/15 text-red-400"
                      : "bg-orange-500/15 text-orange-400"
                  }`}
                >
                  {a.severity}
                </span>
                <h3 className="text-sm font-bold text-white">{a.title}</h3>
              </div>
              <p className="text-xs text-slate-400">{a.description}</p>
              <div className="text-[11px] text-slate-500">{new Date(a.created_at).toLocaleString()}</div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded bg-[#080c17] border border-[#1d2842] text-slate-300">
                {a.status}
              </span>
              {a.status !== "resolved" && (
                <button
                  type="button"
                  onClick={() => setStatus(a.id, "resolved")}
                  className="px-3 py-1 rounded-lg bg-[#2e2259] hover:bg-[#3d2d75] text-white font-semibold"
                >
                  Resolve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------- 4. Audit Logs ---------- */
export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    api.request<{ items: any[] }>("/api/v1/intelligence/audit-logs").then((r) => setLogs(r.items));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-400" />
          <span>Audit Logs</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Immutable security event trail covering logins, MFA changes, statement imports, and session revocations.
        </p>
      </div>

      <div className="bg-[#0d1322] border border-[#1d2842] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#080c17] border-b border-[#1d2842] text-slate-400">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">IP Address</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#161f33]">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-[#131b30]">
                  <td className="px-4 py-3 text-slate-400">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-200">{l.actor_email}</td>
                  <td className="px-4 py-3 font-mono text-purple-300">{l.action}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {l.resource_type} {l.resource_id ? `(${l.resource_id})` : ""}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-400">{l.ip_address}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        l.status === "success"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-red-500/15 text-red-300"
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ---------- 5. Financial Analytics ---------- */
type RiskTimeframe = "24h" | "7d" | "1m" | "1y";

export const AnalyticsPage: React.FC = () => {
  const { lastUpdateTick } = useRiskDecision();
  const [txs, setTxs] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState<RiskTimeframe>("7d");

  useEffect(() => {
    api.request<{ items: any[] }>("/api/v1/transactions?range=all").then((r) => setTxs(r.items));
  }, [lastUpdateTick]);

  const byRisk = [
    { name: "Low Risk", value: txs.filter((t) => t.risk_score <= 30).length, color: "#22c55e" },
    {
      name: "Medium Risk",
      value: txs.filter((t) => t.risk_score > 30 && t.risk_score < 70).length,
      color: "#f97316",
    },
    { name: "High Risk", value: txs.filter((t) => t.risk_score >= 70).length, color: "#ef4444" },
  ];

  const instMap: Record<string, number> = {};
  txs.forEach((t) => {
    instMap[t.source_institution] = (instMap[t.source_institution] || 0) + t.amount;
  });
  const byInst = Object.entries(instMap).map(([name, volume]) => ({ name, volume }));

  // Build real time-series risk buckets for 24h / 7d (1 Week) / 1m (1 Month) / 1y (1 Year)
  const riskTimeline = useMemo(() => {
    const now = Date.now();
    const hourMs = 3600 * 1000;
    const dayMs = 24 * hourMs;

    const bucketize = (buckets: { label: string; startMs: number; endMs: number }[]) =>
      buckets.map((b) => {
        const matched = txs.filter((t) => {
          const ts = new Date(t.tx_timestamp).getTime();
          return ts >= b.startMs && ts < b.endMs;
        });
        const low = matched.filter((t) => t.risk_score <= 30).length;
        const medium = matched.filter((t) => t.risk_score > 30 && t.risk_score < 70).length;
        const high = matched.filter((t) => t.risk_score >= 70).length;
        const avgRisk = matched.length
          ? Math.round(matched.reduce((s, t) => s + Number(t.risk_score || 0), 0) / matched.length)
          : 0;
        return {
          label: b.label,
          low,
          medium,
          high,
          avgRisk,
          total: matched.length,
        };
      });

    if (timeframe === "24h") {
      const buckets = Array.from({ length: 6 }, (_, i) => {
        const endOffset = (5 - i) * 4;
        const startOffset = endOffset + 4;
        return {
          label: endOffset === 0 ? "Now" : `-${endOffset}h`,
          startMs: now - startOffset * hourMs,
          endMs: now - endOffset * hourMs + (endOffset === 0 ? 60000 : 0),
        };
      });
      return {
        series: bucketize(buckets),
        windowTxs: txs.filter((t) => new Date(t.tx_timestamp).getTime() >= now - dayMs),
      };
    }

    if (timeframe === "7d") {
      const buckets = Array.from({ length: 7 }, (_, i) => {
        const daysAgo = 6 - i;
        const d = new Date(now - daysAgo * dayMs);
        const label =
          daysAgo === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" });
        return {
          label,
          startMs: now - (daysAgo + 1) * dayMs,
          endMs: now - daysAgo * dayMs + (daysAgo === 0 ? 60000 : 0),
        };
      });
      return {
        series: bucketize(buckets),
        windowTxs: txs.filter((t) => new Date(t.tx_timestamp).getTime() >= now - 7 * dayMs),
      };
    }

    if (timeframe === "1m") {
      const buckets = Array.from({ length: 4 }, (_, i) => {
        const weekNum = i + 1;
        const endDays = (4 - weekNum) * 7.5;
        const startDays = endDays + 7.5;
        return {
          label: `Week ${weekNum}`,
          startMs: now - startDays * dayMs,
          endMs: now - endDays * dayMs + (weekNum === 4 ? 60000 : 0),
        };
      });
      return {
        series: bucketize(buckets),
        windowTxs: txs.filter((t) => new Date(t.tx_timestamp).getTime() >= now - 30 * dayMs),
      };
    }

    // 1 Year (12 monthly buckets)
    const cur = new Date(now);
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const offset = 11 - i;
      const start = new Date(cur.getFullYear(), cur.getMonth() - offset, 1);
      const end = new Date(cur.getFullYear(), cur.getMonth() - offset + 1, 1);
      return {
        label: start.toLocaleDateString(undefined, { month: "short" }),
        startMs: start.getTime(),
        endMs: offset === 0 ? now + 60000 : end.getTime(),
      };
    });
    return {
      series: bucketize(buckets),
      windowTxs: txs.filter((t) => new Date(t.tx_timestamp).getTime() >= now - 365 * dayMs),
    };
  }, [txs, timeframe]);

  const windowCount = riskTimeline.windowTxs.length;
  const windowAvgRisk = windowCount
    ? Math.round(
        riskTimeline.windowTxs.reduce((sum, t) => sum + Number(t.risk_score || 0), 0) / windowCount
      )
    : 0;
  const windowHighCount = riskTimeline.windowTxs.filter((t) => t.risk_score >= 70).length;
  const windowPeakRisk = windowCount
    ? Math.max(...riskTimeline.windowTxs.map((t) => Number(t.risk_score || 0)))
    : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-blue-400" />
          <span>Financial Analytics</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Cross-institution volume distribution, risk severity timeline, and ML risk tier breakdown.
        </p>
      </div>

      {/* NEW: Risk Trend & Severity Timeline Chart (24h / 7D (1 Week) / 1 Month / 1 Year) */}
      <div className="bg-[#0d1322] border border-[#1d2842] rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              <span>Risk Trend &amp; Severity Timeline</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Low, Medium, and High risk event distribution across your selected time window
            </p>
          </div>

          {/* Segmented Timeframe Pills */}
          <div className="inline-flex p-1 rounded-lg bg-[#080c17] border border-[#1d2842]">
            {([
              ["24h", "24H"],
              ["7d", "7D (1 Week)"],
              ["1m", "1 Month"],
              ["1y", "1 Year"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTimeframe(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  timeframe === key
                    ? "bg-[#2e2259] text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Timeframe KPI Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-[#080c17] border border-[#182238]">
            <div className="text-[11px] text-slate-400">Events in Window</div>
            <div className="text-base font-bold text-white mt-0.5">{windowCount}</div>
          </div>
          <div className="p-3 rounded-lg bg-[#080c17] border border-[#182238]">
            <div className="text-[11px] text-slate-400">Avg Risk Score</div>
            <div className="text-base font-bold text-orange-400 mt-0.5">{windowAvgRisk}%</div>
          </div>
          <div className="p-3 rounded-lg bg-[#080c17] border border-[#182238]">
            <div className="text-[11px] text-slate-400">High-Risk Flagged</div>
            <div className="text-base font-bold text-red-400 mt-0.5">{windowHighCount}</div>
          </div>
          <div className="p-3 rounded-lg bg-[#080c17] border border-[#182238]">
            <div className="text-[11px] text-slate-400">Peak Risk Score</div>
            <div className="text-base font-bold text-purple-300 mt-0.5">{windowPeakRisk}%</div>
          </div>
        </div>

        {/* Smooth Multi-Tier Area Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={riskTimeline.series} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="gradHigh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradMedium" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.42} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradLow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.38} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#182238" />
              <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  borderRadius: "8px",
                  color: "#f8fafc",
                  fontSize: "12px",
                }}
                itemStyle={{ fontWeight: 600 }}
                labelStyle={{ color: "#cbd5e1", fontWeight: 700, marginBottom: "4px" }}
              />
              <Area
                type="monotone"
                dataKey="low"
                name="Low Risk"
                stroke="#22c55e"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#gradLow)"
              />
              <Area
                type="monotone"
                dataKey="medium"
                name="Medium Risk"
                stroke="#f97316"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#gradMedium)"
              />
              <Area
                type="monotone"
                dataKey="high"
                name="High Risk"
                stroke="#ef4444"
                strokeWidth={2.2}
                fillOpacity={1}
                fill="url(#gradHigh)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-5 pt-1 border-t border-[#182238] text-xs text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Low Risk (0–30)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Medium Risk (31–69)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> High Risk (70–100)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#0d1322] border border-[#1d2842] rounded-xl p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4">
            Volume by Source Institution (BDT)
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byInst}>
                <CartesianGrid strokeDasharray="3 3" stroke="#182238" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "8px",
                    color: "#f8fafc",
                    fontSize: "12px",
                  }}
                  itemStyle={{ color: "#f8fafc", fontWeight: 600 }}
                  labelStyle={{ color: "#cbd5e1", fontWeight: 600 }}
                />
                <Bar dataKey="volume" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0d1322] border border-[#1d2842] rounded-xl p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4">
            Transactions by Risk Tier
          </h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byRisk} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={4}>
                  {byRisk.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "8px",
                    color: "#f8fafc",
                    fontSize: "12px",
                  }}
                  itemStyle={{ color: "#f8fafc", fontWeight: 600 }}
                  labelStyle={{ color: "#cbd5e1", fontWeight: 600 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2 border-t border-[#182238] text-xs">
            {byRisk.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2 text-slate-200">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span>{entry.name}:</span>
                <strong className="text-white">{entry.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
