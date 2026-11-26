import React, { createContext, useContext, useEffect, useState } from "react";
import { LangCode, SUPPORTED_LANGUAGES, TRANSLATIONS } from "../i18n/translations";
import { api } from "../services/api";
import { useAuth } from "./AuthContext";

interface LanguageContextValue {
  lang: LangCode;
  dir: "ltr" | "rtl";
  setLanguage: (code: LangCode, persistToProfile?: boolean) => Promise<void>;
  t: (key: string) => string;
  formatNumber: (n: number) => string;
  formatDate: (iso: string | Date) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function resolveInitialLang(): LangCode {
  const saved = localStorage.getItem("fs_lang") as LangCode | null;
  if (saved && TRANSLATIONS[saved]) return saved;
  return "en";
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [lang, setLangState] = useState<LangCode>(resolveInitialLang);

  const meta = SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = meta.dir;
    localStorage.setItem("fs_lang", lang);
  }, [lang, meta.dir]);

  useEffect(() => {
    if (user?.preferred_language && TRANSLATIONS[user.preferred_language as LangCode]) {
      setLangState(user.preferred_language as LangCode);
    }
  }, [user?.preferred_language]);

  const setLanguage = async (code: LangCode, persistToProfile = true) => {
    setLangState(code);
    localStorage.setItem("fs_lang", code);
    if (user && persistToProfile) {
      try {
        await api.request("/api/v1/auth/profile", {
          method: "PATCH",
          body: JSON.stringify({ preferred_language: code }),
        });
      } catch {
        // Ignore silent sync error if offline
      }
    }
  };

  const t = (key: string) => TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;

  const formatNumber = (n: number) => {
    try {
      return new Intl.NumberFormat(lang === "bn" ? "bn-BD" : lang).format(n);
    } catch {
      return n.toLocaleString();
    }
  };

  const formatDate = (iso: string | Date) => {
    try {
      return new Intl.DateTimeFormat(lang, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(typeof iso === "string" ? new Date(iso) : iso);
    } catch {
      return String(iso);
    }
  };

  return (
    <LanguageContext.Provider value={{ lang, dir: meta.dir, setLanguage, t, formatNumber, formatDate }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
