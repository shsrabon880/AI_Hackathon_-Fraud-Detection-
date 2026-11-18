import React, { useEffect, useState } from "react";
import { AlertTriangle, Info, MonitorSmartphone } from "lucide-react";
import { api } from "../services/api";

interface DeviceItem {
  id: number;
  device_fingerprint: string;
  device_name: string;
  device_model: string;
  os: string;
  browser: string;
  ip_address: string;
  approx_location: string;
  battery_percentage: string;
  sim_operator: string;
  phone_number_masked: string;
  trust_status: "trusted" | "unverified" | "suspicious" | "blocked";
  risk_score: number;
  risk_classification: string;
  unusual_tx_count: number;
  failed_auth_count: number;
  is_new_device: boolean;
  anomalies: string[];
  login_history: { time: string; ip: string; location: string; result: string }[];
  last_active_at: string;
}

export const DevicesPage: React.FC = () => {
  const [devices, setDevices] = useState<DeviceItem[]>([]);

  const load = async () => {
    const res = await api.request<{ items: DeviceItem[] }>("/api/v1/devices");
    setDevices(res.items);
  };

  useEffect(() => {
    load();
  }, []);

  const updateTrust = async (id: number, trustStatus: string) => {
    await api.request(`/api/v1/devices/${id}/trust`, {
      method: "PATCH",
      body: JSON.stringify({ trust_status: trustStatus }),
    });
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Device Intelligence</h1>
          <p className="text-xs text-slate-400 mt-1">
            Detect unknown devices, IP mismatches, failed auth attempts, and suspicious endpoints.
          </p>
        </div>
        <div className="px-3 py-2 rounded-lg bg-[#0d1322] border border-[#1d2842] text-[11px] text-slate-300 flex items-center gap-2 max-w-lg">
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            Browser sessions cannot access SIM, phone numbers, or restricted hardware IDs. Unavailable
            fields honestly display <strong>Not Available</strong> unless supplied by an authorized mobile app.
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {devices.map((d) => {
          const isHigh = d.risk_score >= 70;
          const isMed = d.risk_score >= 31 && d.risk_score < 70;
          return (
            <div key={d.id} className="bg-[#0d1322] border border-[#1d2842] rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center border ${
                      isHigh
                        ? "bg-red-500/10 border-red-500/30 text-red-400"
                        : isMed
                        ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    }`}
                  >
                    <MonitorSmartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{d.device_name}</h3>
                      {d.is_new_device && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-semibold">
                          NEW DEVICE
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {d.device_model} · {d.os} · {d.browser} ·{" "}
                      <span className="font-mono text-slate-500">{d.device_fingerprint}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div
                      className={`text-sm font-bold ${
                        isHigh ? "text-red-400" : isMed ? "text-orange-400" : "text-emerald-400"
                      }`}
                    >
                      Risk {d.risk_score}/100 ({d.risk_classification})
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Last active: {new Date(d.last_active_at).toLocaleString()}
                    </div>
                  </div>

                  <select
                    value={d.trust_status}
                    onChange={(e) => updateTrust(d.id, e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#080d1a] border border-[#1d2842] text-xs font-semibold text-white"
                  >
                    <option value="trusted">Trusted</option>
                    <option value="unverified">Unverified</option>
                    <option value="suspicious">Suspicious</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs bg-[#080c17] p-3.5 rounded-lg border border-[#182238]">
                <div>
                  <div className="text-slate-400">IP Address</div>
                  <div className="font-mono text-blue-300 mt-0.5">{d.ip_address}</div>
                </div>
                <div>
                  <div className="text-slate-400">Approx Location</div>
                  <div className="text-slate-200 mt-0.5">{d.approx_location}</div>
                </div>
                <div>
                  <div className="text-slate-400">Battery</div>
                  <div className="text-slate-200 mt-0.5">{d.battery_percentage}</div>
                </div>
                <div>
                  <div className="text-slate-400">SIM Operator</div>
                  <div className="text-slate-200 mt-0.5">{d.sim_operator}</div>
                </div>
                <div>
                  <div className="text-slate-400">Phone Number</div>
                  <div className="text-slate-200 font-mono mt-0.5">{d.phone_number_masked}</div>
                </div>
                <div>
                  <div className="text-slate-400">Unusual Tx / Failed Auth</div>
                  <div className="text-white font-semibold mt-0.5">
                    {d.unusual_tx_count} / {d.failed_auth_count}
                  </div>
                </div>
              </div>

              {d.anomalies.length > 0 && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/25 space-y-1">
                  <div className="text-[11px] font-bold text-red-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Suspicious Activity & Anomaly Signals</span>
                  </div>
                  <ul className="list-disc list-inside text-xs text-red-200/90 space-y-0.5">
                    {d.anomalies.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {d.login_history.length > 0 && (
                <div className="text-[11px] text-slate-400">
                  <div className="font-semibold text-slate-300 mb-1">Recent Login Timeline</div>
                  <div className="flex flex-wrap gap-2">
                    {d.login_history.map((h, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded bg-[#121a2e] border border-[#1d2842] text-slate-300"
                      >
                        {new Date(h.time).toLocaleString()} · {h.ip} ({h.location}) ·{" "}
                        <strong>{h.result}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
