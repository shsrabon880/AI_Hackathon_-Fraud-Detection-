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
  Menu,
  MonitorSmartphone,
  Network,
  Server,
  Shield,
  ShieldAlert,
  UserCheck,
  UserCog,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { LanguageSelector } from "./LanguageSelector";
import { NotificationCenter } from "./NotificationCenter";

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);
  const [intelOpen, setIntelOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const primaryNav = [
    { label: t("nav_dashboard"), to: "/", icon: LayoutGrid },
    { label: t("nav_lookup"), to: "/recipient-lookup", icon: FileSearch },
    { label: t("nav_users"), to: "/users", icon: UserCog },
    { label: t("nav_devices"), to: "/devices", icon: MonitorSmartphone },
    { label: t("nav_connectors"), to: "/connectors", icon: Link2 },
    { label: t("nav_services"), to: "/services", icon: Server },
    { label: t("nav_policies"), to: "/policies", icon: Shield },
    { label: t("nav_sessions"), to: "/sessions", icon: Activity },
    { label: t("nav_transactions"), to: "/transactions", icon: History },
  ];

  const secondaryNav = [
    { label: t("nav_investigation"), to: "/investigation", icon: ShieldAlert },
    { label: t("nav_graph"), to: "/graph", icon: Network },
    { label: t("nav_alerts"), to: "/alerts", icon: AlertTriangle },
    { label: t("nav_audit"), to: "/audit-logs", icon: FileText },
    { label: t("nav_analytics"), to: "/analytics", icon: BarChart3 },
    { label: t("nav_profile"), to: "/profile", icon: UserCheck },
  ];

  const renderNavLinks = (onNavigate?: () => void) => (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {primaryNav.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors min-h-[40px] ${
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

      <div className="pt-4 mt-3 border-t border-[#211b3d]">
        {!collapsed && (
          <button
            type="button"
            onClick={() => setIntelOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6f698f] hover:text-slate-300"
          >
            <span>Intelligence &amp; Ops</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${intelOpen ? "" : "-rotate-90"}`}
            />
          </button>
        )}

        {(intelOpen || collapsed) && (
          <div className="mt-1 space-y-1">
            {secondaryNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors min-h-[38px] ${
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
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex ${
          collapsed ? "w-[74px]" : "w-[252px]"
        } shrink-0 bg-[#120f24] border-e border-[#231d42] flex-col transition-all duration-200 select-none`}
      >
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

        {renderNavLinks()}

        <div className="p-3 border-t border-[#211b3d] space-y-2">
          {!collapsed && user && (
            <NavLink
              to="/profile"
              className="block px-2.5 py-2 rounded-lg bg-[#191433] border border-[#28214d] hover:border-purple-500/40 transition-colors"
            >
              <div className="text-xs font-semibold text-white truncate">{user.full_name}</div>
              <div className="text-[11px] text-[#9490ad] truncate">{user.email}</div>
              <div className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#2e2259] text-[#c4b5fd] uppercase">
                {user.role}
              </div>
            </NavLink>
          )}
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>{t("sign_out")}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Top Header Bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-[#120f24]/95 backdrop-blur-md border-b border-[#231d42] px-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open Navigation Menu"
            className="p-2 rounded-lg bg-[#1b1635] text-slate-200 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#a78bfa]" />
            <span className="text-sm font-bold text-white">FraudShield</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelector compact />
          <NotificationCenter />
        </div>
      </div>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] bg-[#120f24] border-e border-[#231d42] flex flex-col h-full">
            <div className="h-14 px-4 flex items-center justify-between border-b border-[#211b3d]">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-[#a78bfa]" />
                <span className="text-sm font-bold text-white">FinSphere AI</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderNavLinks(() => setMobileOpen(false))}
            <div className="p-3 border-t border-[#211b3d]">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/25"
              >
                <LogOut className="w-4 h-4" />
                <span>{t("sign_out")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-[#120f24]/95 backdrop-blur-md border-t border-[#231d42] grid grid-cols-5 px-1">
        {[
          { label: t("nav_dashboard"), to: "/", icon: LayoutGrid },
          { label: "Lookup", to: "/recipient-lookup", icon: FileSearch },
          { label: "Tx", to: "/transactions", icon: History },
          { label: "Alerts", to: "/alerts", icon: AlertTriangle },
          { label: "Profile", to: "/profile", icon: UserCheck },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                  isActive ? "text-[#a78bfa]" : "text-slate-400"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-[60px]">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
};
