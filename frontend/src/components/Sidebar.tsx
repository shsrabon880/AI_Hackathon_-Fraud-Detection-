import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cpu,
  FileSearch,
  FileText,
  History,
  LayoutGrid,
  Link2,
  LogOut,
  MonitorSmartphone,
  Network,
  Server,
  Shield,
  ShieldAlert,
  UserCog,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const PRIMARY_NAV = [
  { label: "Dashboard", to: "/", icon: LayoutGrid },
  { label: "Recipient Lookup", to: "/recipient-lookup", icon: FileSearch },
  { label: "System Users", to: "/users", icon: UserCog },
  { label: "Devices", to: "/devices", icon: MonitorSmartphone },
  { label: "Connectors", to: "/connectors", icon: Link2 },
  { label: "Services", to: "/services", icon: Server },
  { label: "Security Policies", to: "/policies", icon: Shield },
  { label: "Sessions", to: "/sessions", icon: Activity },
  { label: "Transaction History", to: "/transactions", icon: History },
];

const SECONDARY_NAV = [
  { label: "Fraud Investigation", to: "/investigation", icon: ShieldAlert },
  { label: "Graph Network", to: "/graph", icon: Network },
  { label: "Security Alerts", to: "/alerts", icon: AlertTriangle },
  { label: "Audit Logs", to: "/audit-logs", icon: FileText },
  { label: "Financial Analytics", to: "/analytics", icon: BarChart3 },
];

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [intelOpen, setIntelOpen] = useState(true);

  return (
    <aside
      className={`${
        collapsed ? "w-[74px]" : "w-[252px]"
      } shrink-0 bg-[#120f24] border-r border-[#231d42] flex flex-col transition-all duration-200 select-none`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-[#211b3d]">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-[#2e2259] border border-[#5b43b8]/40 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4 text-[#a78bfa]" />
          </div>
          {!collapsed && (
            <div className="leading-tight truncate">
              <div className="text-[13px] font-bold tracking-tight text-white">FinSphere AI</div>
              <div className="text-[10px] font-medium text-[#a78bfa] tracking-wider uppercase">
                FraudShield
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[#1f193d] transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Primary Navigation (Matches Image 2 Dark Purple-Navy Style) */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors ${
                  isActive
                    ? "bg-[#2e2259] text-[#c4b5fd] shadow-sm"
                    : "text-[#9490ad] hover:text-slate-100 hover:bg-[#1b1635]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 ${
                      isActive ? "text-[#a78bfa]" : "text-[#807b9c]"
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          );
        })}

        {/* Collapsible Secondary Intelligence Group */}
        <div className="pt-4 mt-3 border-t border-[#211b3d]">
          {!collapsed && (
            <button
              type="button"
              onClick={() => setIntelOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6f698f] hover:text-slate-300"
            >
              <span>Intelligence & Ops</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${intelOpen ? "" : "-rotate-90"}`}
              />
            </button>
          )}

          {(intelOpen || collapsed) && (
            <div className="mt-1 space-y-1">
              {SECONDARY_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                        isActive
                          ? "bg-[#2e2259] text-[#c4b5fd]"
                          : "text-[#8b86a6] hover:text-slate-100 hover:bg-[#1b1635]"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={`w-[17px] h-[17px] shrink-0 ${
                            isActive ? "text-[#a78bfa]" : "text-[#736e91]"
                          }`}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Bottom User & Sign Out */}
      <div className="p-3 border-t border-[#211b3d] space-y-2">
        {!collapsed && user && (
          <div className="px-2.5 py-2 rounded-lg bg-[#191433] border border-[#28214d]">
            <div className="text-xs font-semibold text-white truncate">{user.full_name}</div>
            <div className="text-[11px] text-[#9490ad] truncate">{user.email}</div>
            <div className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#2e2259] text-[#c4b5fd] uppercase">
              {user.role}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};
