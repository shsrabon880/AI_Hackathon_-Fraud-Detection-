import React, { useEffect, useRef, useState } from "react";
import { ExternalLink, Globe, Layers, MapPin, Minus, Plus } from "lucide-react";

interface GoogleGeoMapProps {
  apiKey?: string | null;
  latitude: number;
  longitude: number;
  city: string;
  region: string;
  country: string;
  ipAddress: string;
  riskLevel: string;
}

declare global {
  interface Window {
    google?: any;
  }
}

export const GoogleGeoMap: React.FC<GoogleGeoMapProps> = ({
  apiKey,
  latitude,
  longitude,
  city,
  region,
  country,
  ipAddress,
  riskLevel,
}) => {
  const effectiveKey = apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState(false);
  const [zoom, setZoom] = useState(11);
  const [mapType, setMapType] = useState<"m" | "k">("m"); // m = Map, k = Satellite
  const [useLiveEmbed, setUseLiveEmbed] = useState(false);
  const [showPinCard, setShowPinCard] = useState(false);

  useEffect(() => {
    if (!effectiveKey) {
      setMapsReady(false);
      return;
    }

    if (window.google?.maps) {
      setMapsReady(true);
      return;
    }

    const existingScript = document.getElementById("fs-google-maps-sdk");
    if (existingScript) {
      existingScript.addEventListener("load", () => setMapsReady(true));
      return;
    }

    const script = document.createElement("script");
    script.id = "fs-google-maps-sdk";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(effectiveKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapsReady(true);
    script.onerror = () => setMapsError(true);
    document.head.appendChild(script);
  }, [effectiveKey]);

  useEffect(() => {
    if (!mapsReady || mapsError || !mapContainerRef.current || !window.google?.maps) return;

    try {
      const center = { lat: latitude, lng: longitude };
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center,
        zoom,
        mapTypeId: mapType === "k" ? "hybrid" : "roadmap",
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: true,
        streetViewControl: false,
      });

      const marker = new window.google.maps.Marker({
        position: center,
        map,
        title: `${city}, ${country} (Approximate IP Location)`,
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `<div style="color:#0f172a;font-family:Inter,sans-serif;padding:4px 6px;min-width:185px;">
          <div style="font-weight:700;font-size:13px;">${city}, ${country}</div>
          <div style="font-size:11px;color:#475569;margin-top:2px;">IP: ${ipAddress} · ${riskLevel}</div>
          <div style="font-size:11px;color:#475569;">Lat ${latitude.toFixed(4)}, Lon ${longitude.toFixed(4)}</div>
          <div style="font-size:10px;color:#b91c1c;margin-top:4px;">Approximate IP geolocation only</div>
        </div>`,
      });

      marker.addListener("click", () => infoWindow.open(map, marker));
    } catch {
      setMapsError(true);
    }
  }, [mapsReady, mapsError, latitude, longitude, city, country, ipAddress, riskLevel, zoom, mapType]);

  const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}&z=${zoom}`;
  const embedSrc = `https://maps.google.com/maps?q=${latitude},${longitude}&z=${zoom}&t=${mapType}&hl=en&output=embed`;
  const scaleFactor = 1 + (zoom - 11) * 0.14;

  return (
    <div className="relative w-full h-[210px] rounded-lg overflow-hidden border border-[#243252] bg-[#e5e3df] select-none">
      {effectiveKey && mapsReady && !mapsError ? (
        <div ref={mapContainerRef} className="w-full h-full" />
      ) : useLiveEmbed ? (
        <iframe
          key={`${latitude}-${longitude}-${zoom}-${mapType}`}
          title={`Google Maps - ${city}, ${country}`}
          src={embedSrc}
          className="w-full h-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      ) : (
        /* Google Maps Visual Style Canvas (Road Map & Satellite Modes) */
        <div
          className={`relative w-full h-full overflow-hidden transition-colors duration-300 ${
            mapType === "k" ? "bg-[#1a2e22]" : "bg-[#e8eaed]"
          }`}
        >
          <svg
            viewBox="0 0 600 260"
            preserveAspectRatio="xMidYMid slice"
            className="w-full h-full transition-transform duration-300"
            style={{ transform: `scale(${scaleFactor})` }}
          >
            {mapType === "m" ? (
              <>
                {/* Google Maps Landmass */}
                <rect width="600" height="260" fill="#eef0f2" />
                {/* Urban Blocks */}
                <rect x="30" y="20" width="95" height="65" rx="4" fill="#e2e5e8" />
                <rect x="155" y="25" width="110" height="55" rx="4" fill="#e2e5e8" />
                <rect x="320" y="18" width="130" height="70" rx="4" fill="#e2e5e8" />
                <rect x="480" y="30" width="95" height="80" rx="4" fill="#e2e5e8" />
                <rect x="45" y="150" width="120" height="80" rx="4" fill="#e2e5e8" />
                <rect x="340" y="160" width="110" height="75" rx="4" fill="#e2e5e8" />
                {/* Green Parks (Google Maps Mint Green) */}
                <path d="M180 120 Q220 95 255 130 Q235 165 185 155 Z" fill="#c3ecb2" />
                <path d="M460 155 Q520 135 565 180 L550 230 L450 220 Z" fill="#c3ecb2" />
                <rect x="20" y="105" width="52" height="36" rx="6" fill="#c3ecb2" />
                {/* Winding River (Google Maps Sky Blue) */}
                <path
                  d="M-10 215 Q130 165 245 190 T475 110 T620 65"
                  fill="none"
                  stroke="#9cd3ff"
                  strokeWidth="22"
                  strokeLinecap="round"
                />
                {/* Minor White Streets */}
                <g stroke="#ffffff" strokeWidth="4" fill="none">
                  <path d="M0 70 L600 95" />
                  <path d="M0 140 L600 125" />
                  <path d="M135 0 L115 260" />
                  <path d="M285 0 L300 260" />
                  <path d="M440 0 L420 260" />
                </g>
                {/* Major Arterial Highways (Google Maps Amber/Yellow) */}
                <path
                  d="M-10 40 Q210 95 305 130 T610 195"
                  fill="none"
                  stroke="#fbbc04"
                  strokeWidth="6.5"
                />
                <path
                  d="M-10 40 Q210 95 305 130 T610 195"
                  fill="none"
                  stroke="#fde293"
                  strokeWidth="3.5"
                />
                <path d="M210 0 Q260 125 365 260" fill="none" stroke="#fbbc04" strokeWidth="5.5" />
                <path d="M210 0 Q260 125 365 260" fill="none" stroke="#fde293" strokeWidth="3" />
                {/* Highway Shields */}
                <rect x="192" y="64" width="24" height="14" rx="3" fill="#ffffff" stroke="#cbd5e1" />
                <text x="204" y="74" fontSize="8" fontWeight="700" fill="#334155" textAnchor="middle">
                  E-1
                </text>
                <rect x="415" y="138" width="26" height="14" rx="3" fill="#ffffff" stroke="#cbd5e1" />
                <text x="428" y="148" fontSize="8" fontWeight="700" fill="#334155" textAnchor="middle">
                  M-4
                </text>
              </>
            ) : (
              <>
                {/* Satellite Terrain View */}
                <rect width="600" height="260" fill="#1b3024" />
                <path d="M0 0 L280 0 L220 260 L0 260 Z" fill="#233b2d" />
                <path d="M310 0 L600 0 L600 260 L260 260 Z" fill="#172920" />
                <path
                  d="M-10 215 Q130 165 245 190 T475 110 T620 65"
                  fill="none"
                  stroke="#0d2b45"
                  strokeWidth="22"
                />
                <path
                  d="M-10 40 Q210 95 305 130 T610 195"
                  fill="none"
                  stroke="#eab308"
                  strokeOpacity="0.65"
                  strokeWidth="3.5"
                />
                <path
                  d="M210 0 Q260 125 365 260"
                  fill="none"
                  stroke="#ffffff"
                  strokeOpacity="0.35"
                  strokeWidth="2.5"
                />
              </>
            )}
          </svg>

          {/* Center Red Google Maps Pin Marker */}
          <button
            type="button"
            onClick={() => setShowPinCard((v) => !v)}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[85%] z-10 flex flex-col items-center group cursor-pointer"
            title="Click marker for approximate IP geolocation details"
          >
            <div className="px-2 py-0.5 mb-1 rounded-md bg-white/95 shadow-md border border-slate-300 text-[11px] font-bold text-slate-800 whitespace-nowrap">
              {city}, {country}
            </div>
            <svg viewBox="0 0 36 46" className="w-8 h-10 drop-shadow-[0_4px_6px_rgba(0,0,0,0.45)] group-hover:scale-110 transition-transform">
              <path
                d="M18 2C9.7 2 3 8.7 3 17C3 28.2 18 44 18 44C18 44 33 28.2 33 17C33 8.7 26.3 2 18 2Z"
                fill="#EA4335"
                stroke="#B31412"
                strokeWidth="1.5"
              />
              <circle cx="18" cy="17" r="6" fill="#7F1D1D" />
            </svg>
          </button>

          {/* Subtle Google Maps Watermark Footer */}
          <div className="absolute bottom-1.5 right-2 z-10 px-1.5 py-0.5 rounded bg-white/85 text-[9.5px] font-semibold text-slate-700 shadow-sm">
            Google Maps View · {latitude.toFixed(2)}, {longitude.toFixed(2)}
          </div>
        </div>
      )}

      {/* Top-Left Google Maps-style Map / Satellite Switcher */}
      <div className="absolute top-2.5 left-2.5 z-20 inline-flex rounded-md overflow-hidden shadow-md border border-slate-300/80 bg-white text-[11px] font-semibold">
        <button
          type="button"
          onClick={() => setMapType("m")}
          className={`px-2.5 py-1 transition-colors ${
            mapType === "m" ? "bg-white text-slate-900 font-bold" : "bg-slate-100 text-slate-600 hover:text-slate-900"
          }`}
        >
          Map
        </button>
        <button
          type="button"
          onClick={() => setMapType("k")}
          className={`px-2.5 py-1 flex items-center gap-1 border-l border-slate-300/80 transition-colors ${
            mapType === "k" ? "bg-white text-slate-900 font-bold" : "bg-slate-100 text-slate-600 hover:text-slate-900"
          }`}
        >
          <Layers className="w-3 h-3" />
          Satellite
        </button>
      </div>

      {/* Top-Right Open in Google Maps + Live Embed toggle + Zoom Controls */}
      <div className="absolute top-2.5 right-2.5 z-20 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5">
          {!effectiveKey && (
            <button
              type="button"
              onClick={() => setUseLiveEmbed((v) => !v)}
              className={`px-2 py-1 rounded-md border text-[10.5px] font-semibold shadow-md flex items-center gap-1 transition-colors ${
                useLiveEmbed
                  ? "bg-blue-600 border-blue-700 text-white"
                  : "bg-white/95 hover:bg-white border-slate-300 text-slate-700"
              }`}
              title="Toggle live Google Maps iframe embed"
            >
              <Globe className="w-3 h-3" />
              <span>{useLiveEmbed ? "Styled Map" : "Live Embed"}</span>
            </button>
          )}
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1 rounded-md bg-white/95 hover:bg-white border border-slate-300 text-[10.5px] font-semibold text-blue-600 flex items-center gap-1 shadow-md"
            title="Open exact coordinates in Google Maps"
          >
            <span>Open Google Maps</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="flex flex-col rounded-md overflow-hidden border border-slate-300 bg-white shadow-md">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(16, z + 1))}
            className="w-7 h-6 flex items-center justify-center text-slate-700 hover:bg-slate-100"
            title="Zoom in"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(4, z - 1))}
            className="w-7 h-6 flex items-center justify-center text-slate-700 hover:bg-slate-100 border-t border-slate-200"
            title="Zoom out"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bottom-Left Clickable Location Info Pill */}
      <div className="absolute bottom-2 left-2.5 z-20">
        <button
          type="button"
          onClick={() => setShowPinCard((v) => !v)}
          className="px-2.5 py-1 rounded-md bg-white/95 hover:bg-white border border-slate-300 text-[11px] font-semibold text-slate-800 flex items-center gap-1.5 shadow-md"
        >
          <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <span>
            {city}, {country}
          </span>
          <span className="text-slate-500 font-mono text-[10px]">({riskLevel})</span>
        </button>

        {showPinCard && (
          <div className="mt-1.5 p-2.5 rounded-lg bg-white border border-slate-300 shadow-xl text-[11px] text-slate-800 max-w-[260px]">
            <div className="font-bold text-slate-900">
              {city}, {region}, {country}
            </div>
            <div className="text-slate-600 font-mono mt-0.5">
              IP {ipAddress} · {latitude.toFixed(4)}, {longitude.toFixed(4)}
            </div>
            <div className="text-red-600 mt-1 text-[10px] font-medium">
              Approximate IP geolocation only (never exact street address).
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
