import React from "react";

const BRAND_STYLES: Record<string, { bg: string; fg: string; abbr: string }> = {
  bkash: { bg: "#E2136E", fg: "#FFFFFF", abbr: "bK" },
  nagad: { bg: "#F26522", fg: "#FFFFFF", abbr: "Ng" },
  upay: { bg: "#0054A6", fg: "#FFD100", abbr: "up" },
  city_bank: { bg: "#B91C1C", fg: "#FFFFFF", abbr: "CB" },
  dbbl: { bg: "#006837", fg: "#FFFFFF", abbr: "DB" },
  dhaka_bank: { bg: "#00529B", fg: "#FFFFFF", abbr: "DK" },
  islami_bank: { bg: "#007A3D", fg: "#FFFFFF", abbr: "IB" },
  trust_bank: { bg: "#1E3A8A", fg: "#FFFFFF", abbr: "TB" },
  ebl: { bg: "#0033A0", fg: "#FBBF24", abbr: "EB" },
  brac_bank: { bg: "#0054A6", fg: "#FFFFFF", abbr: "BR" },
  bank_asia: { bg: "#0284C7", fg: "#FFFFFF", abbr: "BA" },
  prime_bank: { bg: "#15803D", fg: "#FFFFFF", abbr: "PB" },
  scb_bd: { bg: "#0F766E", fg: "#A7F3D0", abbr: "SC" },
};

export const InstitutionLogo: React.FC<{ code: string; name: string }> = ({ code, name }) => {
  const style = BRAND_STYLES[code] || { bg: "#334155", fg: "#FFFFFF", abbr: name.slice(0, 2).toUpperCase() };

  return (
    <div
      className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm tracking-tight shadow-inner border border-white/10 shrink-0"
      style={{ backgroundColor: style.bg, color: style.fg }}
      aria-label={`${name} logo`}
    >
      {code === "bkash" ? (
        <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none">
          <path d="M7 10L17 6L25 14L15 26L11 19L7 10Z" fill="white" fillOpacity="0.95" />
          <path d="M17 6L21 15L15 26" stroke="#E2136E" strokeWidth="1.6" />
        </svg>
      ) : code === "nagad" ? (
        <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none">
          <circle cx="16" cy="16" r="10" stroke="white" strokeWidth="2.2" />
          <path d="M12 20C13.5 13 18.5 11 21 12.5C18 14 17 17.5 17.5 21" stroke="#FFF7ED" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      ) : code === "upay" ? (
        <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none">
          <path d="M9 10V17C9 21 12 23.5 16 23.5C20 23.5 23 21 23 17V10" stroke="#FFD100" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : (
        <span>{style.abbr}</span>
      )}
    </div>
  );
};
