import React, { useEffect, useState } from "react";
import { Bell, CheckCheck, ShieldAlert, X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../services/api";

interface NotifItem {
  id: number;
  category: string;
  severity: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export const NotificationCenter: React.FC = () => {
  const { t, formatDate } = useLanguage();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotifItem[]>([]);

  const load = async () => {
    try {
      const res = await api.request<{ unread_count: number; items: NotifItem[] }>("/api/v1/notifications");
      setUnread(res.unread_count);
      setItems(res.items);
    } catch {
      // Ignore if unauthenticated or offline
    }
  };

  useEffect(() => {
    load();
    const token = api.getToken();
    if (!token || typeof EventSource === "undefined") {
      const id = window.setInterval(load, 15000);
      return () => window.clearInterval(id);
    }
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, []);

  const markRead = async (nid: number) => {
    await api.request(`/api/v1/notifications/${nid}/read`, { method: "PATCH" });
    await load();
  };

  const markAllRead = async () => {
    await api.request("/api/v1/notifications/read-all", { method: "POST" });
    await load();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        aria-label={t("notifications")}
        className="relative p-2 rounded-lg bg-[#0d1322] border border-[#1d2842] text-slate-300 hover:text-white hover:border-purple-500/50 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute right-3 sm:right-0 top-14 sm:top-11 z-50 w-[92vw] sm:w-96 max-h-[75vh] bg-[#0d1322] border border-[#243252] rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1d2842] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              {t("notifications")} ({unread})
            </span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[11px] text-purple-300 hover:text-white flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>{t("mark_all_read")}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto divide-y divide-[#182238] flex-1">
            {items.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">{t("no_notifications")}</div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  className={`p-3.5 text-xs space-y-1 cursor-pointer transition-colors ${
                    n.is_read ? "bg-[#0d1322] opacity-75" : "bg-[#121930] hover:bg-[#16203d]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <ShieldAlert
                        className={`w-3.5 h-3.5 shrink-0 ${
                          n.severity === "critical"
                            ? "text-red-400"
                            : n.severity === "high" || n.severity === "warning"
                            ? "text-orange-400"
                            : "text-blue-400"
                        }`}
                      />
                      <span>{n.title}</span>
                    </span>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />}
                  </div>
                  <p className="text-slate-300 leading-relaxed">{n.message}</p>
                  <div className="text-[10px] text-slate-500">{formatDate(n.created_at)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
