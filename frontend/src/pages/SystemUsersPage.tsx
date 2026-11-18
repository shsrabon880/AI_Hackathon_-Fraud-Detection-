import React, { useEffect, useState } from "react";
import { ShieldCheck, UserCheck, Users } from "lucide-react";
import { api } from "../services/api";

interface SystemUserItem {
  id: number;
  user_code: string;
  full_name: string;
  email: string;
  role: "user" | "analyst" | "admin";
  status: "active" | "suspended" | "locked";
  mfa_enabled: boolean;
  connected_accounts_count: number;
  security_status: string;
  open_alerts_count: number;
  permissions: string[];
  created_at: string;
  last_login_at: string | null;
}

export const SystemUsersPage: React.FC = () => {
  const [users, setUsers] = useState<SystemUserItem[]>([]);
  const [isAdminView, setIsAdminView] = useState(false);

  const load = async () => {
    const res = await api.request<{ items: SystemUserItem[]; is_admin_view: boolean }>("/api/v1/users");
    setUsers(res.items);
    setIsAdminView(res.is_admin_view);
  };

  useEffect(() => {
    load();
  }, []);

  const updateUser = async (id: number, patch: { role?: string; status?: string }) => {
    await api.request(`/api/v1/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">System Users</h1>
          <p className="text-xs text-slate-400 mt-1">
            Role-Based Access Control (RBAC), account status, connected accounts, and security posture.
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-lg bg-[#0d1322] border border-[#1d2842] text-xs text-slate-300 flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" />
          {isAdminView ? "Admin Directory View" : "Personal Profile View (Owner Isolated)"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {users.map((u) => (
          <div key={u.id} className="bg-[#0d1322] border border-[#1d2842] rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#2e2259] border border-[#5b43b8]/40 flex items-center justify-center text-purple-200 font-bold">
                  {u.full_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{u.full_name}</h3>
                    <span className="text-[11px] font-mono text-blue-400">{u.user_code}</span>
                  </div>
                  <div className="text-xs text-slate-400">{u.email}</div>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  u.status === "active"
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : "bg-red-500/15 text-red-300 border-red-500/30"
                }`}
              >
                {u.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-[#080c17] p-3.5 rounded-lg border border-[#182238]">
              <div>
                <div className="text-slate-400">Security Status</div>
                <div className="text-white font-medium mt-0.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  {u.security_status}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Connected Institutions</div>
                <div className="text-white font-medium mt-0.5">{u.connected_accounts_count} linked</div>
              </div>
              <div>
                <div className="text-slate-400">Registered</div>
                <div className="text-slate-200 mt-0.5">
                  {new Date(u.created_at).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Last Login</div>
                <div className="text-slate-200 mt-0.5">
                  {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "Never"}
                </div>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Active Permissions</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {u.permissions.map((p) => (
                  <span
                    key={p}
                    className="px-2 py-0.5 rounded bg-[#141c30] border border-[#233050] text-[10px] font-mono text-slate-300"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {isAdminView && (
              <div className="pt-3 border-t border-[#182238] flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Role:</span>
                  <select
                    value={u.role}
                    onChange={(e) => updateUser(u.id, { role: e.target.value })}
                    className="px-2.5 py-1 rounded bg-[#080d1a] border border-[#1d2842] text-white"
                  >
                    <option value="user">user</option>
                    <option value="analyst">analyst</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Status:</span>
                  <select
                    value={u.status}
                    onChange={(e) => updateUser(u.id, { status: e.target.value })}
                    className="px-2.5 py-1 rounded bg-[#080d1a] border border-[#1d2842] text-white"
                  >
                    <option value="active">active</option>
                    <option value="suspended">suspended</option>
                    <option value="locked">locked</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
