import React, { useEffect, useState } from "react";
import { Activity, LogOut, ShieldAlert, X } from "lucide-react";
import { api } from "../services/api";

interface SessionItem {
  id: number;
  session_id: string;
  device: string;
  browser: string;
  os: string;
  ip_address: string;
  approx_location: string;
  login_at: string;
  last_active_at: string;
  status: string;
  is_current: boolean;
}

export const SessionsPage: React.FC = () => {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [reauthAction, setReauthAction] = useState<{ type: "single" | "others"; id?: number } | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    const res = await api.request<{ items: SessionItem[] }>("/api/v1/sessions");
    setSessions(res.items);
  };

  useEffect(() => {
    load();
  }, []);

  const confirmRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reauthAction) return;
    setError(null);
    try {
      if (reauthAction.type === "single" && reauthAction.id) {
        await api.request(`/api/v1/sessions/${reauthAction.id}/revoke`, {
          method: "POST",
          body: JSON.stringify({ password }),
        });
        setNotice("Session revoked securely.");
      } else {
        const res = await api.request<{ message: string }>("/api/v1/sessions/revoke-others", {
          method: "POST",
          body: JSON.stringify({ password }),
        });
        setNotice(res.message);
      }
      setReauthAction(null);
      setPassword("");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Sessions</h1>
          <p className="text-xs text-slate-400 mt-1">
            Inspect active and historical sessions. Revoking sessions requires password re-authentication.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setReauthAction({ type: "others" })}
          className="px-3.5 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-xs font-semibold text-red-300 flex items-center gap-1.5"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out All Other Devices</span>
        </button>
      </div>

      {notice && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
          {notice}
        </div>
      )}

      <div className="bg-[#0d1322] border border-[#1d2842] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#080c17] border-b border-[#1d2842] text-slate-400">
              <tr>
                <th className="px-4 py-3">Session ID</th>
                <th className="px-4 py-3">Device / OS / Browser</th>
                <th className="px-4 py-3">IP & Approx Location</th>
                <th className="px-4 py-3">Login Time</th>
                <th className="px-4 py-3">Last Active</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#161f33]">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-[#131b30]">
                  <td className="px-4 py-3 font-mono text-blue-300">
                    {s.session_id}
                    {s.is_current && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px]">
                        CURRENT
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    <div className="font-semibold">{s.device}</div>
                    <div className="text-[11px] text-slate-400">
                      {s.os} · {s.browser}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-slate-200">{s.ip_address}</div>
                    <div className="text-[11px] text-slate-400">{s.approx_location}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {new Date(s.login_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {new Date(s.last_active_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        s.status === "active"
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.status === "active" ? (
                      <button
                        type="button"
                        onClick={() => setReauthAction({ type: "single", id: s.id })}
                        className="px-2.5 py-1 rounded bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 font-semibold"
                      >
                        Revoke
                      </button>
                    ) : (
                      <span className="text-slate-500 inline-flex items-center gap-1">
                        <Activity className="w-3 h-3" /> Ended
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Password Re-authentication Modal */}
      {reauthAction && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0d1322] border border-[#243252] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Re-Authentication Required</span>
              </div>
              <button type="button" onClick={() => setReauthAction(null)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Confirm your account password to revoke{" "}
              {reauthAction.type === "others" ? "all other active sessions" : "this session"}.
            </p>
            {error && (
              <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                {error}
              </div>
            )}
            <form onSubmit={confirmRevoke} className="space-y-3">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-3 py-2 rounded-lg bg-[#080d1a] border border-[#1d2842] text-xs text-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReauthAction(null)}
                  className="px-3 py-1.5 rounded-lg bg-[#141c30] text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white"
                >
                  Confirm Revocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
