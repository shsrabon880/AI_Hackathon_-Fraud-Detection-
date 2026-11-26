import React, { useEffect, useState } from "react";
import { Bell, Globe, KeyRound, ShieldAlert, Trash2, UserCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { LangCode, SUPPORTED_LANGUAGES } from "../i18n/translations";
import { api } from "../services/api";

export const ProfilePage: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();
  const { t, lang, setLanguage } = useLanguage();

  const [fullName, setFullName] = useState(user?.full_name || "");
  const [phone, setPhone] = useState(user?.phone_number || "");
  const [country, setCountry] = useState(user?.country || "Bangladesh");
  const [prefLang, setPrefLang] = useState<LangCode>((user?.preferred_language as LangCode) || lang);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [deletePassword, setDeletePassword] = useState("");
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setPhone(user.phone_number || "");
      setCountry(user.country || "Bangladesh");
      setPrefLang((user.preferred_language as LangCode) || lang);
    }
    api
      .request<Record<string, boolean>>("/api/v1/notifications/preferences")
      .then(setPrefs)
      .catch(() => null);
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await api.request("/api/v1/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          full_name: fullName,
          phone_number: phone,
          country,
          preferred_language: prefLang,
        }),
      });
      await setLanguage(prefLang, false);
      await refreshUser();
      setNotice("Profile and language preferences saved.");
    } catch (err: any) {
      setError(err.message || "Failed to update profile.");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (newPassword !== confirmNewPassword) {
      setError("New password and confirm password do not match.");
      return;
    }
    try {
      await api.request("/api/v1/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmNewPassword,
        }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setNotice("Password updated securely.");
    } catch (err: any) {
      setError(err.message || "Password change failed.");
    }
  };

  const togglePref = async (key: string) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      await api.request("/api/v1/notifications/preferences", {
        method: "PUT",
        body: JSON.stringify({ [key]: next[key] }),
      });
      setNotice("Notification preference updated.");
    } catch (err: any) {
      setError(err.message || "Unable to update notification preference.");
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.request("/api/v1/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ password: deletePassword }),
      });
      await logout();
    } catch (err: any) {
      setError(err.message || "Account deletion failed.");
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <UserCheck className="w-6 h-6 text-[#a78bfa]" />
          <span>{t("profile_title")}</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage your private profile, language preference, notifications, and password security.
        </p>
      </div>

      {notice && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
          {notice}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Profile + Language */}
        <form
          onSubmit={handleSaveProfile}
          className="lg:col-span-6 bg-[#0d1322] border border-[#1d2842] rounded-xl p-6 space-y-4 text-xs"
        >
          <div className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Globe className="w-4 h-4 text-purple-400" />
            <span>Account Profile &amp; {t("preferred_language")}</span>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">{t("full_name")}</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-[#080d1a] border border-[#1d2842] text-white"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">{t("email_address")}</label>
            <input
              type="email"
              disabled
              value={user?.email || ""}
              className="w-full px-3 py-2.5 rounded-lg bg-[#080d1a]/60 border border-[#1a2238] text-slate-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">{t("phone_number")}</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+88017XXXXXXXX"
                className="w-full px-3 py-2.5 rounded-lg bg-[#080d1a] border border-[#1d2842] text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">{t("country")}</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[#080d1a] border border-[#1d2842] text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">{t("preferred_language")}</label>
            <select
              value={prefLang}
              onChange={(e) => setPrefLang(e.target.value as LangCode)}
              className="w-full px-3 py-2.5 rounded-lg bg-[#080d1a] border border-[#1d2842] text-white"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeLabel} ({l.englishName})
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#4c3599] hover:bg-[#5e42bd] text-white font-semibold"
          >
            {t("save_profile")}
          </button>
        </form>

        {/* Change Password */}
        <form
          onSubmit={handleChangePassword}
          className="lg:col-span-6 bg-[#0d1322] border border-[#1d2842] rounded-xl p-6 space-y-4 text-xs"
        >
          <div className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-purple-400" />
            <span>{t("change_password")}</span>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-[#080d1a] border border-[#1d2842] text-white"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">New Strong Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Upper, lower, digit, special char"
              className="w-full px-3 py-2.5 rounded-lg bg-[#080d1a] border border-[#1d2842] text-white"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">{t("confirm_password")}</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-[#080d1a] border border-[#1d2842] text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
          >
            {t("change_password")}
          </button>
        </form>
      </div>

      {/* Notification Preferences & Account Deletion */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {prefs && (
          <div className="lg:col-span-7 bg-[#0d1322] border border-[#1d2842] rounded-xl p-6 space-y-3 text-xs">
            <div className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Bell className="w-4 h-4 text-purple-400" />
              <span>Real-Time Notification Preferences</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                ["fraud_alerts", "Fraud Alerts (30–79%)"],
                ["critical_risk", "Critical Risk (80–100%)"],
                ["new_device_login", "New Device Sign-In"],
                ["account_connections", "Bank / MFS Connect & Disconnect"],
                ["suspicious_login", "Suspicious Login Warnings"],
                ["tx_review", "Transaction Review Updates"],
                ["email_notifications", "Security Email Notifications"],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#080d1a] border border-[#1a243d] cursor-pointer"
                >
                  <span className="text-slate-200">{label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(prefs[key])}
                    onChange={() => togglePref(key)}
                    className="accent-purple-500 w-4 h-4"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={handleDeleteAccount}
          className="lg:col-span-5 bg-[#0d1322] border border-red-500/30 rounded-xl p-6 space-y-3 text-xs"
        >
          <div className="font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            <span>{t("delete_account")}</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Permanently remove your private workspace, connected sandbox accounts, and transaction
            ledger. Re-authentication required.
          </p>
          <input
            type="password"
            required
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="Confirm password to delete"
            className="w-full px-3 py-2.5 rounded-lg bg-[#080d1a] border border-red-500/30 text-white"
          />
          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t("delete_account")}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
