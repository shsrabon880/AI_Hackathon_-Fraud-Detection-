import React, { useEffect, useState } from "react";
import {
  ArrowUpDown,
  Download,
  FileSpreadsheet,
  Plus,
  Search,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useRiskDecision } from "../context/RiskDecisionContext";
import { api } from "../services/api";

interface TxItem {
  id: number;
  tx_ref: string;
  date: string;
  time: string;
  amount: number;
  currency: string;
  tx_type: string;
  sender_name: string;
  recipient_name: string;
  recipient_account_masked: string;
  source_institution: string;
  dest_institution: string;
  status: string;
  device_label: string;
  ip_address: string;
  location_label: string;
  risk_score: number;
  risk_level: string;
  is_demo_data: boolean;
}

interface TxAnalytics {
  total_transactions: number;
  total_volume: number;
  successful_transactions: number;
  failed_transactions: number;
  suspicious_transactions: number;
  average_amount: number;
  daily_series: { date: string; count: number; volume: number; suspicious: number }[];
}

interface TxDetail extends TxItem {
  assessment?: {
    overall_score: number;
    risk_level: string;
    ml_score: number;
    graph_score: number;
    rule_score: number;
    feature_explanations: {
      feature: string;
      label: string;
      raw_value: string;
      contribution_points: number;
      severity: string;
      explanation: string;
    }[];
    recommended_action: string;
    agent_rationale: string;
    human_decision: string | null;
    reviewed_by: string | null;
  };
}

export const TransactionHistoryPage: React.FC = () => {
  const { submitAndRouteTransaction, lastUpdateTick } = useRiskDecision();
  const [range, setRange] = useState<"7d" | "30d" | "all">("all");
  const [search, setSearch] = useState("");
  const [institution, setInstitution] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [sortBy, setSortBy] = useState("tx_timestamp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [items, setItems] = useState<TxItem[]>([]);
  const [analytics, setAnalytics] = useState<TxAnalytics | null>(null);
  const [detail, setDetail] = useState<TxDetail | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadInst, setUploadInst] = useState("bKash");
  const [notice, setNotice] = useState<string | null>(null);

  const [newTx, setNewTx] = useState({
    amount: "25000",
    tx_type: "Transfer",
    recipient_name: "Rahim Enterprise",
    recipient_account: "01711889900",
    source_institution: "bKash",
    dest_institution: "BRAC Bank",
    ip_address: "103.148.72.14",
    location_label: "Dhaka, Bangladesh",
  });

  const load = async () => {
    const params = new URLSearchParams({ range, sort_by: sortBy, sort_dir: sortDir });
    if (search) params.set("search", search);
    if (institution) params.set("institution", institution);
    if (statusFilter) params.set("status", statusFilter);
    if (riskLevel) params.set("risk_level", riskLevel);

    const res = await api.request<{ analytics: TxAnalytics; items: TxItem[] }>(
      `/api/v1/transactions?${params.toString()}`
    );
    setItems(res.items);
    setAnalytics(res.analytics);
  };

  useEffect(() => {
    load();
  }, [range, search, institution, statusFilter, riskLevel, sortBy, sortDir, lastUpdateTick]);

  const openDetail = async (id: number) => {
    const res = await api.request<TxDetail>(`/api/v1/transactions/${id}`);
    setDetail(res);
  };

  const handleDecision = async (id: number, decision: string) => {
    const res = await api.request<TxDetail>(`/api/v1/transactions/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    });
    setDetail(res);
    setNotice(`Human decision "${decision}" recorded in audit log.`);
    await load();
  };

  const handleCreateTx = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await submitAndRouteTransaction({
      ...newTx,
      amount: Number(newTx.amount),
    });
    setShowNewModal(false);
    setNotice(
      `Transaction ${res.tx_ref} routed to Tier ${res.tier_number} (${res.tier}) with Risk Score ${res.risk_score}%.`
    );
    await load();
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    const fd = new FormData();
    fd.append("institution", uploadInst);
    fd.append("file", uploadFile);
    const res = await api.request<{ imported_count: number; skipped_duplicates: number }>(
      "/api/v1/transactions/upload-statement",
      { method: "POST", body: fd }
    );
    setShowUploadModal(false);
    setUploadFile(null);
    setNotice(`Imported ${res.imported_count} record(s), skipped ${res.skipped_duplicates} duplicate(s).`);
    await load();
  };

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Top 3 Time Filter Pills (7d / 30d / All) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Transaction History</h1>
          <p className="text-xs text-slate-400 mt-1">
            Monitor financial transfers across connected banks & MFS wallets with AI explainability.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 rounded-lg bg-[#0d1322] border border-[#1d2842]">
            {([
              ["7d", "Last 7 Days"],
              ["30d", "Last 30 Days"],
              ["all", "All Transactions"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  range === key ? "bg-[#2e2259] text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="px-3 py-2 rounded-lg bg-[#121a2e] hover:bg-[#1a2540] border border-[#243252] text-xs font-medium text-slate-200 flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV/PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="px-3 py-2 rounded-lg bg-[#4c3599] hover:bg-[#5e42bd] text-xs font-semibold text-white flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Evaluate Transfer</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            ["Transactions", analytics.total_transactions.toString(), "text-white"],
            ["Total Volume", `BDT ${analytics.total_volume.toLocaleString()}`, "text-blue-400"],
            ["Successful", analytics.successful_transactions.toString(), "text-emerald-400"],
            ["Failed", analytics.failed_transactions.toString(), "text-orange-400"],
            ["Suspicious", analytics.suspicious_transactions.toString(), "text-red-400"],
            ["Average Tx", `BDT ${analytics.average_amount.toLocaleString()}`, "text-purple-300"],
          ].map(([label, val, color]) => (
            <div key={label} className="bg-[#0d1322] border border-[#1d2842] rounded-xl p-4">
              <div className="text-[11px] text-slate-400">{label}</div>
              <div className={`text-lg font-bold mt-1 ${color}`}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Daily Frequency & Volume Chart + Export Controls */}
      {analytics && analytics.daily_series.length > 0 && (
        <div className="bg-[#0d1322] border border-[#1d2842] rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Daily Transaction Volume & Frequency
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  api.downloadFile(
                    `/api/v1/transactions/export/csv?range=${range}`,
                    `fraudshield_statement_${range}.csv`
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-[#141c30] hover:bg-[#1c2742] border border-[#243252] text-xs text-slate-200 flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  api.downloadFile(
                    `/api/v1/transactions/export/pdf?range=${range}`,
                    `fraudshield_statement_${range}.pdf`
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-[#141c30] hover:bg-[#1c2742] border border-[#243252] text-xs text-slate-200 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-red-400" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.daily_series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#182238" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
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
                <Bar dataKey="volume" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Volume (BDT)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Search & Multi-Facet Filter Bar */}
      <div className="bg-[#0d1322] border border-[#1d2842] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Ref, recipient, bank..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#080d1a] border border-[#1d2842] text-xs text-white"
          />
        </div>
        <select
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[#080d1a] border border-[#1d2842] text-xs text-slate-200"
        >
          <option value="">All Banks & Wallets</option>
          <option value="bKash">bKash</option>
          <option value="Nagad">Nagad</option>
          <option value="upay">upay</option>
          <option value="City Bank">City Bank</option>
          <option value="BRAC Bank">BRAC Bank</option>
          <option value="Dutch-Bangla">Dutch-Bangla Bank</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[#080d1a] border border-[#1d2842] text-xs text-slate-200"
        >
          <option value="">All Statuses</option>
          <option value="Completed">Completed</option>
          <option value="Flagged">Flagged</option>
          <option value="Pending Review">Pending Review</option>
          <option value="Failed">Failed</option>
        </select>
        <select
          value={riskLevel}
          onChange={(e) => setRiskLevel(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[#080d1a] border border-[#1d2842] text-xs text-slate-200"
        >
          <option value="">All Risk Levels</option>
          <option value="Low Risk">Low Risk (0–30)</option>
          <option value="Medium Risk">Medium Risk (31–69)</option>
          <option value="High Risk">High Risk (70–100)</option>
        </select>
      </div>

      {/* Responsive Transactions Table */}
      <div className="bg-[#0d1322] border border-[#1d2842] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#080c17] border-b border-[#1d2842] text-slate-400">
              <tr>
                <th className="px-4 py-3">Transaction ID</th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort("tx_timestamp")}>
                  <span className="inline-flex items-center gap-1">
                    Date & Time <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort("amount")}>
                  <span className="inline-flex items-center gap-1">
                    Amount <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Device / IP</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort("risk_score")}>
                  <span className="inline-flex items-center gap-1">
                    Risk <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#161f33]">
              {items.map((tx) => {
                const riskBadge =
                  tx.risk_score >= 70
                    ? "bg-red-500/15 text-red-400 border-red-500/30"
                    : tx.risk_score >= 31
                    ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                    : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
                return (
                  <tr
                    key={tx.id}
                    onClick={() => openDetail(tx.id)}
                    className="hover:bg-[#131b30] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-blue-300">
                      <div>{tx.tx_ref}</div>
                      {tx.is_demo_data && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">
                          DEMO DATA
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <div>{tx.date}</div>
                      <div className="text-[11px] text-slate-500">{tx.time}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">
                      {tx.currency} {tx.amount.toLocaleString()}
                      <div className="text-[11px] font-normal text-slate-400">{tx.tx_type}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <div>{tx.source_institution}</div>
                      <div className="text-[11px] text-slate-500">→ {tx.dest_institution}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      <div>{tx.recipient_name}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {tx.recipient_account_masked}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      <div className="truncate max-w-[140px]">{tx.device_label}</div>
                      <div className="text-[11px] font-mono text-slate-500">{tx.ip_address}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-[#141d33] border border-[#243252] text-slate-200">
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded border font-semibold ${riskBadge}`}>
                        {tx.risk_score} · {tx.risk_level}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No transactions match your current filter. Import a CSV/PDF statement or evaluate
                    a transfer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explainable AI Detail Drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/70 flex justify-end">
          <div className="w-full max-w-xl bg-[#0d1322] border-l border-[#243252] h-full overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#1d2842] pb-4">
              <div>
                <div className="text-xs font-mono text-blue-400">{detail.tx_ref}</div>
                <h3 className="text-lg font-bold text-white">
                  {detail.currency} {detail.amount.toLocaleString()} → {detail.recipient_name}
                </h3>
              </div>
              <button type="button" onClick={() => setDetail(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-[#080c17] p-4 rounded-xl border border-[#1a243d]">
              <div>
                <span className="text-slate-400">Source:</span>{" "}
                <span className="text-white font-medium">{detail.source_institution}</span>
              </div>
              <div>
                <span className="text-slate-400">Destination:</span>{" "}
                <span className="text-white font-medium">{detail.dest_institution}</span>
              </div>
              <div>
                <span className="text-slate-400">IP / Location:</span>{" "}
                <span className="text-white font-mono">
                  {detail.ip_address} ({detail.location_label})
                </span>
              </div>
              <div>
                <span className="text-slate-400">Device:</span>{" "}
                <span className="text-white">{detail.device_label}</span>
              </div>
            </div>

            {detail.assessment && (
              <>
                <div className="p-4 rounded-xl bg-[#080c17] border border-[#1d2842] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-purple-400" />
                      Agentic Decision Recommendation
                    </span>
                    <span className="text-xs font-bold text-amber-300">
                      {detail.assessment.recommended_action}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {detail.assessment.agent_rationale}
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-2 text-[11px]">
                    <div className="p-2 rounded bg-[#0d1322] border border-[#1a243d]">
                      ML Score: <strong className="text-white">{detail.assessment.ml_score}</strong>
                    </div>
                    <div className="p-2 rounded bg-[#0d1322] border border-[#1a243d]">
                      Graph Score: <strong className="text-white">{detail.assessment.graph_score}</strong>
                    </div>
                    <div className="p-2 rounded bg-[#0d1322] border border-[#1a243d]">
                      Rule Score: <strong className="text-white">{detail.assessment.rule_score}</strong>
                    </div>
                  </div>
                </div>

                {/* Explainable Feature Contributions */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Explainable AI Feature Attribution
                  </h4>
                  {detail.assessment.feature_explanations.map((f) => (
                    <div
                      key={f.feature}
                      className="p-3 rounded-lg bg-[#080c17] border border-[#19233b] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">{f.label}</span>
                        <span className="font-mono text-purple-300">
                          +{f.contribution_points} pts ({f.raw_value})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{f.explanation}</p>
                    </div>
                  ))}
                </div>

                {/* Human-in-the-Loop Approval */}
                <div className="pt-3 border-t border-[#1d2842] space-y-2">
                  <div className="text-xs text-slate-400">
                    Human Review Status:{" "}
                    <strong className="text-white">
                      {detail.assessment.human_decision || "Awaiting Human Decision"}
                    </strong>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["Approved", "Confirmed Fraud", "Escalated"] as const).map((dec) => (
                      <button
                        key={dec}
                        type="button"
                        onClick={() => handleDecision(detail.id, dec)}
                        className="px-3 py-1.5 rounded-lg bg-[#141c30] hover:bg-[#2e2259] border border-[#243252] text-xs font-semibold text-white"
                      >
                        Mark {dec}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Evaluate New Transfer Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0d1322] border border-[#243252] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Evaluate Transfer via AI Pipeline</h3>
              <button type="button" onClick={() => setShowNewModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateTx} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Amount (BDT)</label>
                  <input
                    type="number"
                    required
                    value={newTx.amount}
                    onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#080d1a] border border-[#1d2842] text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Type</label>
                  <select
                    value={newTx.tx_type}
                    onChange={(e) => setNewTx({ ...newTx, tx_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#080d1a] border border-[#1d2842] text-white"
                  >
                    <option>Transfer</option>
                    <option>Cash Out</option>
                    <option>Payment</option>
                    <option>Bill Pay</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Recipient Name</label>
                  <input
                    type="text"
                    required
                    value={newTx.recipient_name}
                    onChange={(e) => setNewTx({ ...newTx, recipient_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#080d1a] border border-[#1d2842] text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Recipient Account</label>
                  <input
                    type="text"
                    required
                    value={newTx.recipient_account}
                    onChange={(e) => setNewTx({ ...newTx, recipient_account: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#080d1a] border border-[#1d2842] text-white font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Source Bank/MFS</label>
                  <input
                    type="text"
                    required
                    value={newTx.source_institution}
                    onChange={(e) => setNewTx({ ...newTx, source_institution: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#080d1a] border border-[#1d2842] text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Origin IP</label>
                  <select
                    value={newTx.ip_address}
                    onChange={(e) => setNewTx({ ...newTx, ip_address: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#080d1a] border border-[#1d2842] text-white font-mono"
                  >
                    <option value="103.148.72.14">103.148.72.14 (Dhaka Low Risk)</option>
                    <option value="172.104.180.55">172.104.180.55 (SG VPN Medium)</option>
                    <option value="103.21.244.0">103.21.244.0 (Moscow TOR High)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#141c30] text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#4c3599] hover:bg-[#5e42bd] text-white font-semibold"
                >
                  Score & Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Statement Import Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0d1322] border border-[#243252] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Import Bank / MFS Statement</h3>
              <button type="button" onClick={() => setShowUploadModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleUpload} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Institution</label>
                <select
                  value={uploadInst}
                  onChange={(e) => setUploadInst(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#080d1a] border border-[#1d2842] text-white"
                >
                  <option>bKash</option>
                  <option>Nagad</option>
                  <option>upay</option>
                  <option>City Bank</option>
                  <option>BRAC Bank</option>
                  <option>Dutch-Bangla Bank Limited</option>
                </select>
              </div>
              <input
                type="file"
                accept=".csv,.pdf"
                required
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#2e2259] file:text-white"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#141c30] text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#4c3599] hover:bg-[#5e42bd] text-white font-semibold"
                >
                  Upload & Deduplicate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
