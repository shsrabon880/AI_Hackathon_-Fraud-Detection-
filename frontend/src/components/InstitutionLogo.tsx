import React from "react";

const UPLOADED_LOGOS: Record<string, { src: string; bg: string; pad?: string }> = {
  city_bank: { src: "/logos/city_bank.webp", bg: "bg-[#080c17]", pad: "p-1" },
  dbbl: { src: "/logos/dbbl.jpg", bg: "bg-white", pad: "p-1" },
  dhaka_bank: { src: "/logos/dhaka_bank.png", bg: "bg-[#f3f4f6]", pad: "p-1" },
  islami_bank: { src: "/logos/islami_bank.jpg", bg: "bg-white", pad: "p-1" },
  trust_bank: { src: "/logos/trust_bank.png", bg: "bg-white", pad: "p-1" },
  ebl: { src: "/logos/ebl.png", bg: "bg-white", pad: "p-1" },
  brac_bank: { src: "/logos/brac_bank.jpg", bg: "bg-[#004b93]", pad: "p-0.5" },
  bank_asia: { src: "/logos/bank_asia.png", bg: "bg-[#0161ad]", pad: "p-1" },
  prime_bank: { src: "/logos/prime_bank.png", bg: "bg-[#eceef1]", pad: "p-1" },
  scb_bd: { src: "/logos/scb_bd.png", bg: "bg-white", pad: "p-1.5" },
  bkash: { src: "/logos/bkash.jpg", bg: "bg-white", pad: "p-1" },
  nagad: { src: "/logos/nagad.png", bg: "bg-white", pad: "p-1" },
  rocket: { src: "/logos/rocket.webp", bg: "bg-[#0b0e1a]", pad: "p-1" },
  upay: { src: "/logos/upay.png", bg: "bg-white", pad: "p-1" },
};

export const InstitutionLogo: React.FC<{ code: string; name: string }> = ({ code, name }) => {
  const uploaded = UPLOADED_LOGOS[code];

  if (uploaded) {
    return (
      <div
        className={`w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center border border-white/15 shadow-sm shrink-0 ${uploaded.pad || "p-1"} ${uploaded.bg}`}
      >
        <img
          src={uploaded.src}
          alt={`${name} official logo`}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm tracking-tight shadow-inner border border-white/10 shrink-0 bg-slate-700 text-white"
      aria-label={`${name} logo`}
    >
      <span>{name.slice(0, 2).toUpperCase()}</span>
    </div>
  );
};
