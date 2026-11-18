import React from "react";
import { Info } from "lucide-react";

interface RiskGaugeProps {
  score: number;
  riskLevel: string;
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({ score, riskLevel }) => {
  const clamped = Math.max(0, Math.min(100, score));
  // Semicircle from -90 deg (left, 0) to +90 deg (right, 100)
  const angleDeg = -90 + (clamped / 100) * 180;
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;

  const cx = 140;
  const cy = 128;
  const needleLen = 78;
  const nx = cx + needleLen * Math.cos(angleRad);
  const ny = cy + needleLen * Math.sin(angleRad);

  const scoreColor =
    clamped >= 70 ? "#ef4444" : clamped >= 31 ? "#f97316" : "#22c55e";

  return (
    <div className="flex flex-col items-center justify-center w-full h-full select-none">
      <svg viewBox="0 0 280 160" className="w-full max-w-[275px] overflow-visible">
        <defs>
          <linearGradient id="fsGaugeGrad" x1="0%" y1="100%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="35%" stopColor="#eab308" />
            <stop offset="68%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <filter id="needleGlow">
            <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor={scoreColor} floodOpacity="0.8" />
          </filter>
        </defs>

        {/* Scale labels */}
        <text x="20" y="144" fill="#94a3b8" fontSize="11" fontWeight="500" textAnchor="middle">
          0
        </text>
        <text x="140" y="16" fill="#94a3b8" fontSize="11" fontWeight="500" textAnchor="middle">
          50
        </text>
        <text x="260" y="144" fill="#94a3b8" fontSize="11" fontWeight="500" textAnchor="middle">
          100
        </text>

        {/* Background muted track */}
        <path
          d="M 42 128 A 98 98 0 0 1 238 128"
          fill="none"
          stroke="#1a243d"
          strokeWidth="16"
          strokeLinecap="round"
        />

        {/* Gradient arc */}
        <path
          d="M 42 128 A 98 98 0 0 1 238 128"
          fill="none"
          stroke="url(#fsGaugeGrad)"
          strokeWidth="16"
          strokeLinecap="round"
        />

        {/* Pointer needle */}
        <line
          x1={cx + 58 * Math.cos(angleRad)}
          y1={cy + 58 * Math.sin(angleRad)}
          x2={nx + 20 * Math.cos(angleRad)}
          y2={ny + 20 * Math.sin(angleRad)}
          stroke={scoreColor}
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#needleGlow)"
        />

        {/* Center score value */}
        <text
          x={cx}
          y="108"
          fill={scoreColor}
          fontSize="42"
          fontWeight="800"
          textAnchor="middle"
        >
          {Math.round(clamped)}
        </text>
        <text
          x={cx}
          y="132"
          fill={scoreColor}
          fontSize="15"
          fontWeight="600"
          textAnchor="middle"
        >
          {riskLevel}
        </text>
      </svg>

      <div
        className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-400"
        title="0–30 Low Risk, 31–69 Medium Risk, 70–100 High Risk"
      >
        <span>Risk Score</span>
        <Info className="w-3.5 h-3.5 text-slate-500" />
      </div>
    </div>
  );
};
