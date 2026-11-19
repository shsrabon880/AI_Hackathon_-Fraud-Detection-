import React, { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, Search, ShieldAlert, Upload, X } from "lucide-react";
import { InstitutionLogo } from "../components/InstitutionLogo";
import { api } from "../services/api";

interface ConnectorItem {
  id: number;
  institution_code: string;
  institution_name: string;
  category: "bank" | "mfs";
  connection_status: "Connected" | "Not Connected" | "Synchronizing" | "Connection Error";
  connection_method: string;
  is_sandbox: boolean;
  masked_account: string | null;
  data_sources: string[];
  last_sync_at: string | null;
  security_notice: string;
}

export const ConnectorsPage: React.FC = () => {
  const [items, setItems] = useState<ConnectorItem[]>([]);
  const [tab, setTab] = useState<"explore" | "connected">("explore");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "bank" | "mfs">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ConnectorItem | null>(null);
  const [maskedAcctInput, setMaskedAcctInput] = useState("");
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await api.request<{ items: ConnectorItem[] }>("/api/v1/connectors");
    setItems(res.items);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = items.filter((item) => {
    if (tab === "connected" && item.connection_status !== "Connected") return false;
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    if (search && !item.institution_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      await api.request(`/api/v1/connectors/${selected.institution_code}/connect`, {
        method: "POST",
        body: JSON.stringify({
          masked_account: maskedAcctInput || "00001234",
          is_sandbox: true,
        }),
      });
      setSelected(null);
      setMaskedAcctInput("");
      setFeedback(`Connected ${selected.institution_name} in Sandbox mode (no PIN or password stored).`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async (code: string) => {
    await api.request(`/api/v1/connectors/${code}/sync`, { method: "POST" });
    setFeedback("Synchronization completed.");
    await load();
  };

  const handleDisconnect = async (code: string) => {
    await api.request(`/api/v1/connectors/${code}/disconnect`, { method: "POST" });
    setFeedback("Connector disconnected.");
    await load();
  };

  const handleUploadStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadTarget) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("institution", uploadTarget);
      fd.append("file", uploadFile);
      const res = await api.request<{ imported_count: number; skipped_duplicates: number }>(
        "/api/v1/transactions/upload-statement",
        { method: "POST", body: fd }
      );
      setUploadTarget(null);
      setUploadFile(null);
      setFeedback(
        `Statement processed: ${res.imported_count} new transaction(s) imported, ${res.skipped_duplicates} duplicate(s) skipped.`
      );
    } catch (err: any) {
      setFeedback(`Upload failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Connections</h1>
          <p className="text-xs text-slate-400 mt-1">
            Connect Bangladesh banks & MFS wallets via authorized sandbox APIs or upload CSV/PDF
            statements.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Zero Credential Policy: We never ask for bank passwords, PINs, or OTP codes.</span>
        </div>
      </div>

      {/* Tabs matching Image 3 structure adapted to FraudShield dark theme */}
      <div className="flex items-center gap-6 border-b border-[#1d2842] text-sm">
        <button
          type="button"
          onClick={() => setTab("explore")}
          className={`pb-3 font-semibold border-b-2 transition-colors ${
            tab === "explore"
              ? "border-[#a78bfa] text-white"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Explore connections ({items.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("connected")}
          className={`pb-3 font-semibold border-b-2 transition-colors ${
            tab === "connected"
              ? "border-[#a78bfa] text-white"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Your connections ({items.filter((i) => i.connection_status === "Connected").length})
        </button>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bank or MFS wallet..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0d1322] border border-[#1d2842] text-xs text-white focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {(["all", "bank", "mfs"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                categoryFilter === cat
                  ? "bg-[#2e2259] border-[#5b43b8] text-white"
                  : "bg-[#0d1322] border-[#1d2842] text-slate-400 hover:text-white"
              }`}
            >
              {cat === "all" ? "All Institutions" : cat === "bank" ? "Banks" : "Mobile Financial Services"}
            </button>
          ))}
        </div>
      </div>

      {/* 3-Column Connector Card Grid (Matches Image 3 Layout) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((item) => {
          const isConnected = item.connection_status === "Connected";
          return (
            <div
              key={item.institution_code}
              className={`bg-[#0d1322] rounded-xl p-5 border transition-colors flex flex-col justify-between gap-4 ${
                isConnected
                  ? "border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.06)]"
                  : "border-[#1d2842] hover:border-[#364975]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <InstitutionLogo code={item.institution_code} name={item.institution_name} />
                  <div>
                    <h3 className="text-sm font-bold text-white">{item.institution_name}</h3>
                    <div className="text-[11px] text-slate-400 mt-0.5">{item.connection_method}</div>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${
                    isConnected
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                      : "bg-slate-800/70 border-slate-700 text-slate-400"
                  }`}
                >
                  {item.connection_status}
                </span>
              </div>

              <div className="text-[11px] text-slate-400 space-y-1">
                <div>
                  Data Sources: <span className="text-slate-300">{item.data_sources.join(", ")}</span>
                </div>
                {item.masked_account && (
                  <div>
                    Account: <span className="font-mono text-slate-200">{item.masked_account}</span>{" "}
                    {item.is_sandbox && (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 text-[10px]">
                        SANDBOX
                      </span>
                    )}
                  </div>
                )}
                <div>
                  Last Sync:{" "}
                  <span className="text-slate-300">
                    {item.last_sync_at ? new Date(item.last_sync_at).toLocaleString() : "Never"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#182238]">
                <span className="px-2 py-1 rounded-md bg-[#131b2e] border border-[#223052] text-[10.5px] font-medium text-slate-300">
                  {item.category === "bank" ? "Bank" : "MFS Wallet"}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setUploadTarget(item.institution_name)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#141c30] hover:bg-[#1c2742] border border-[#253356] text-xs font-medium text-slate-200 flex items-center gap-1"
                    title="Upload CSV/PDF statement"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Statement</span>
                  </button>

                  {isConnected ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSync(item.institution_code)}
                        className="p-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30"
                        title="Sync now"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDisconnect(item.institution_code)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-xs font-semibold"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelected(item)}
                      className="px-3.5 py-1.5 rounded-lg bg-[#4c3599] hover:bg-[#5e42bd] text-white text-xs font-semibold"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Secure Sandbox Connect Modal (Never requests password/PIN/OTP) */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0d1322] border border-[#243252] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Connect {selected.institution_name}</h3>
              <button type="button" onClick={() => setSelected(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Authorized OAuth / Sandbox connection. Only enter the last 4 digits or a masked reference
              identifier for labeling. <strong className="text-amber-300">Never enter banking passwords, PINs, or OTPs.</strong>
            </p>
            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Account / Wallet Label (Last 4 digits)
                </label>
                <input
                  type="text"
                  maxLength={16}
                  required
                  value={maskedAcctInput}
                  onChange={(e) => setMaskedAcctInput(e.target.value)}
                  placeholder="e.g. 5678"
                  className="w-full px-3 py-2 rounded-lg bg-[#080d1a] border border-[#1d2842] text-sm text-white font-mono"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="px-4 py-2 rounded-lg bg-[#141c30] text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-[#4c3599] hover:bg-[#5e42bd] text-xs font-semibold text-white flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Authorize Sandbox Link</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Statement Upload Modal */}
      {uploadTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0d1322] border border-[#243252] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Upload Statement ({uploadTarget})</h3>
              <button type="button" onClick={() => setUploadTarget(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Upload a `.csv` or text-based `.pdf` statement (max 5 MB). Records are validated,
              deduplicated by transaction reference, and scored by FraudShield AI.
            </p>
            <form onSubmit={handleUploadStatement} className="space-y-4">
              <input
                type="file"
                accept=".csv,.pdf"
                required
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#2e2259] file:text-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUploadTarget(null)}
                  className="px-4 py-2 rounded-lg bg-[#141c30] text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !uploadFile}
                  className="px-4 py-2 rounded-lg bg-[#4c3599] hover:bg-[#5e42bd] text-xs font-semibold text-white"
                >
                  {busy ? "Processing..." : "Import & Analyze"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
