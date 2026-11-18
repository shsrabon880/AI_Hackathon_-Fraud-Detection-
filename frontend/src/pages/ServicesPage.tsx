import React, { useEffect, useState } from "react";
import { Activity, RefreshCw, Server } from "lucide-react";
import { api } from "../services/api";

interface ServiceItem {
  id: number;
  service_name: string;
  display_name: string;
  description: string;
  status: string;
  latency_ms: number;
  last_run_at: string;
  last_error: string | null;
  records_processed: number;
}

export const ServicesPage: React.FC = () => {
  const [services, setServices] = useState<ServiceItem[]>([]);

  const load = async () => {
    const res = await api.request<{ items: ServiceItem[] }>("/api/v1/services");
    setServices(res.items);
  };

  useEffect(() => {
    load();
  }, []);

  const runCheck = async (name: string) => {
    await api.request(`/api/v1/services/${name}/check`, { method: "POST" });
    await load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Services</h1>
        <p className="text-xs text-slate-400 mt-1">
          Live operational health, latency, and throughput of FraudShield backend services.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {services.map((s) => (
          <div key={s.service_name} className="bg-[#0d1322] border border-[#1d2842] rounded-xl p-5 flex flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#161f38] border border-[#283860] flex items-center justify-center">
                  <Server className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{s.display_name}</h3>
                  <div className="text-[11px] font-mono text-slate-500">{s.service_name}</div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
                {s.status}
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">{s.description}</p>

            <div className="grid grid-cols-3 gap-2 text-[11px] bg-[#080c17] p-3 rounded-lg border border-[#182238]">
              <div>
                <div className="text-slate-400">Latency</div>
                <div className="font-mono font-semibold text-white">{s.latency_ms} ms</div>
              </div>
              <div>
                <div className="text-slate-400">Processed</div>
                <div className="font-mono font-semibold text-blue-300">{s.records_processed}</div>
              </div>
              <div>
                <div className="text-slate-400">Errors</div>
                <div className="font-semibold text-emerald-400">{s.last_error || "None"}</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#182238] text-[11px]">
              <span className="text-slate-400 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                {new Date(s.last_run_at).toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => runCheck(s.service_name)}
                className="px-2.5 py-1 rounded bg-[#141c30] hover:bg-[#1e2a45] border border-[#243252] text-slate-200 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Health Check</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
