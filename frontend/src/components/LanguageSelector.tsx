import React from "react";
import { Globe } from "lucide-react";
import { LangCode, SUPPORTED_LANGUAGES } from "../i18n/translations";
import { useLanguage } from "../context/LanguageContext";

export const LanguageSelector: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { lang, setLanguage } = useLanguage();

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0d1322] border border-[#1d2842] text-xs text-slate-200">
      <Globe className="w-3.5 h-3.5 text-[#a78bfa] shrink-0" />
      <select
        aria-label="Select Language"
        value={lang}
        onChange={(e) => setLanguage(e.target.value as LangCode)}
        className="bg-transparent text-xs text-slate-100 focus:outline-none cursor-pointer"
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} className="bg-[#0d1322] text-white">
            {compact ? l.nativeLabel : `${l.nativeLabel} (${l.englishName})`}
          </option>
        ))}
      </select>
    </div>
  );
};
