import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  Cpu,
  Globe,
  MonitorSmartphone,
  Network,
  RotateCcw,
  Search,
  UserCheck,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useRiskDecision } from "../context/RiskDecisionContext";
import { api } from "../services/api";

interface GraphNode {
  id: string;
  label: string;
  type: "device" | "ip" | "institution" | "recipient" | string;
  risk: number;
  degree: number;
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  amount?: number | null;
  tx_ref?: string | null;
}

interface GraphFinding {
  pattern: string;
  severity: string;
  entity: string;
  detail: string;
}

interface GraphResponse {
  graph_score: number;
  node_count: number;
  edge_count: number;
  findings: GraphFinding[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  architecture_note: string;
}

const TYPE_META: Record<string, { title: string; color: string; bg: string; icon: React.ElementType }> = {
  device: { title: "Device", color: "#a855f7", bg: "bg-purple-500/15 text-purple-300 border-purple-500/30", icon: MonitorSmartphone },
  ip: { title: "IP Endpoint", color: "#f59e0b", bg: "bg-amber-500/15 text-amber-300 border-amber-500/30", icon: Globe },
  institution: { title: "Bank / MFS", color: "#3b82f6", bg: "bg-blue-500/15 text-blue-300 border-blue-500/30", icon: Building2 },
  recipient: { title: "Recipient", color: "#10b981", bg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", icon: UserCheck },
};

export const GraphNetworkView: React.FC = () => {
  const { lastUpdateTick } = useRiskDecision();
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeIdx, setSelectedEdgeIdx] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    api.request<GraphResponse>("/api/v1/intelligence/graph").then((res) => {
      setGraph(res);
      if (!selectedNodeId && res.nodes.length > 0) {
        // Auto-select highest-risk node so inspector is immediately rich
        const top = [...res.nodes].sort((a, b) => b.risk - a.risk)[0];
        setSelectedNodeId(top.id);
      }
    });
  }, [lastUpdateTick]);

  const layout = useMemo(() => {
    if (!graph) return { nodes: [], posMap: {} as Record<string, GraphNode & { x: number; y: number }>, width: 920, height: 480 };

    const cols: Record<string, number> = {
      device: 115,
      ip: 340,
      institution: 575,
      recipient: 810,
    };

    const grouped: Record<string, GraphNode[]> = {
      device: [],
      ip: [],
      institution: [],
      recipient: [],
    };

    graph.nodes.forEach((n) => {
      if (typeFilter === "high" && n.risk < 70) return;
      if (typeFilter !== "all" && typeFilter !== "high" && n.type !== typeFilter) return;
      const bucket = grouped[n.type] ? n.type : "recipient";
      grouped[bucket].push(n);
    });

    const maxRows = Math.max(
      4,
      grouped.device.length,
      grouped.ip.length,
      grouped.institution.length,
      grouped.recipient.length
    );
    const height = Math.max(460, maxRows * 68 + 80);
    const width = 920;

    const positioned: (GraphNode & { x: number; y: number })[] = [];
    Object.entries(grouped).forEach(([typeKey, list]) => {
      const sorted = [...list].sort((a, b) => b.risk - a.risk);
      const stepY = (height - 90) / Math.max(1, sorted.length);
      sorted.forEach((n, idx) => {
        positioned.push({
          ...n,
          x: cols[typeKey] ?? 810,
          y: 66 + idx * stepY + stepY / 2,
        });
      });
    });

    const posMap = Object.fromEntries(positioned.map((p) => [p.id, p]));
    return { nodes: positioned, posMap, width, height };
  }, [graph, typeFilter]);

  const connectedNeighborIds = useMemo(() => {
    if (!graph || !selectedNodeId) return new Set<string>();
    const set = new Set<string>([selectedNodeId]);
    graph.edges.forEach((e) => {
      if (e.source === selectedNodeId) set.add(e.target);
      if (e.target === selectedNodeId) set.add(e.source);
    });
    return set;
  }, [graph, selectedNodeId]);

  if (!graph) {
    return <div className="p-6 text-xs text-slate-400">Analyzing entity relationship graph...</div>;
  }

  const selectedNode = layout.posMap[selectedNodeId || ""] || graph.nodes.find((n) => n.id === selectedNodeId) || null;
  const selectedEdge = selectedEdgeIdx !== null ? graph.edges[selectedEdgeIdx] : null;

  const incomingEdges = selectedNode
    ? graph.edges.filter((e) => e.target === selectedNode.id)
    : [];
  const outgoingEdges = selectedNode
    ? graph.edges.filter((e) => e.source === selectedNode.id)
    : [];

  const selectFindingEntity = (entityText: string) => {
    const match = graph.nodes.find(
      (n) => n.id.includes(entityText) || n.label.toLowerCase().includes(entityText.toLowerCase())
    );
    if (match) {
      setSelectedEdgeIdx(null);
      setSelectedNodeId(match.id);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Network className="w-6 h-6 text-purple-400" />
            <span>Graph Relationship Network</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Interactive multi-entity fraud ring visualizer. Click any node, path, or finding card to inspect details.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="px-3.5 py-2 rounded-lg bg-[#0d1322] border border-[#1d2842] text-xs text-slate-200 flex items-center gap-3">
            <span>
              Graph Score: <strong className="text-orange-400">{graph.graph_score}/100</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span>
              <strong className="text-white">{graph.node_count}</strong> Nodes
            </span>
            <span className="text-slate-600">|</span>
            <span>
              <strong className="text-white">{graph.edge_count}</strong> Links
            </span>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-[#0d1322] border border-[#1d2842] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find IP, bank, device, recipient..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#080c17] border border-[#1d2842] text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {([
              ["all", "All Entities"],
              ["high", "High Risk Only"],
              ["device", "Devices"],
              ["ip", "IPs"],
              ["institution", "Banks/MFS"],
              ["recipient", "Recipients"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTypeFilter(key)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                  typeFilter === key
                    ? "bg-[#2e2259] border-[#6b4ee6] text-white"
                    : "bg-[#080c17] border-[#1d2842] text-slate-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.15).toFixed(2)))}
            className="p-1.5 rounded-lg bg-[#080c17] border border-[#1d2842] text-slate-300 hover:text-white"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono text-slate-400 px-1.5">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.15).toFixed(2)))}
            className="p-1.5 rounded-lg bg-[#080c17] border border-[#1d2842] text-slate-300 hover:text-white"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setTypeFilter("all");
              setSearch("");
            }}
            className="p-1.5 rounded-lg bg-[#080c17] border border-[#1d2842] text-slate-300 hover:text-white"
            title="Reset graph view"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Split: Interactive Flow Canvas (Left) + Click-to-Inspect Panel (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Interactive Canvas */}
        <div className="xl:col-span-8 bg-[#090e1a] border border-[#1d2842] rounded-xl p-4 flex flex-col justify-between overflow-hidden">
          <div className="overflow-auto rounded-lg border border-[#141d33] bg-[#060913]">
            <svg
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              style={{ width: `${Math.round(zoom * 100)}%`, minWidth: "740px" }}
              className="h-[460px] transition-all duration-200 select-none"
            >
              <defs>
                {/* Subtle cybersecurity dot grid */}
                <pattern id="graphGrid" width="28" height="28" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill="#1e293b" opacity="0.55" />
                </pattern>
                <marker
                  id="arrowMuted"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
                </marker>
                <marker
                  id="arrowActive"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="5.5"
                  markerHeight="5.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#a78bfa" />
                </marker>
                <marker
                  id="arrowDanger"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="5.5"
                  markerHeight="5.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
                </marker>
              </defs>

              <rect width={layout.width} height={layout.height} fill="url(#graphGrid)" />

              {/* Column Headers */}
              {[
                { x: 115, title: "DEVICES", color: "#a855f7" },
                { x: 340, title: "IP ENDPOINTS", color: "#f59e0b" },
                { x: 575, title: "BANKS & MFS", color: "#3b82f6" },
                { x: 810, title: "RECIPIENTS", color: "#10b981" },
              ].map((col) => (
                <g key={col.title}>
                  <line
                    x1={col.x}
                    y1={36}
                    x2={col.x}
                    y2={layout.height - 16}
                    stroke="#172036"
                    strokeDasharray="4 4"
                  />
                  <rect
                    x={col.x - 54}
                    y={10}
                    width={108}
                    height={22}
                    rx={6}
                    fill="#0d1322"
                    stroke="#1e293b"
                  />
                  <text
                    x={col.x}
                    y={24}
                    fill={col.color}
                    fontSize="10"
                    fontWeight="700"
                    letterSpacing="0.08em"
                    textAnchor="middle"
                  >
                    {col.title}
                  </text>
                </g>
              ))}

              {/* Curved Bezier Directed Edges */}
              {graph.edges.map((e, i) => {
                const s = layout.posMap[e.source];
                const t = layout.posMap[e.target];
                if (!s || !t) return null;

                const isHighlighted =
                  selectedEdgeIdx === i ||
                  (selectedNodeId && (e.source === selectedNodeId || e.target === selectedNodeId));
                const isDanger = s.risk >= 70 || t.risk >= 70;
                const dimmed = Boolean(selectedNodeId && !isHighlighted);

                const dx = (t.x - s.x) * 0.5;
                const dPath = `M ${s.x} ${s.y} C ${s.x + dx} ${s.y}, ${t.x - dx} ${t.y}, ${t.x - 20} ${t.y}`;

                return (
                  <g
                    key={i}
                    onClick={() => {
                      setSelectedEdgeIdx(i);
                      setSelectedNodeId(null);
                    }}
                    className="cursor-pointer"
                  >
                    {/* Wide invisible hit-target */}
                    <path d={dPath} fill="none" stroke="transparent" strokeWidth="10" />
                    <path
                      d={dPath}
                      fill="none"
                      stroke={
                        selectedEdgeIdx === i
                          ? "#38bdf8"
                          : isDanger && isHighlighted
                          ? "#ef4444"
                          : isHighlighted
                          ? "#a78bfa"
                          : isDanger
                          ? "#7f1d1d"
                          : "#334155"
                      }
                      strokeWidth={isHighlighted ? 2.4 : 1.4}
                      strokeOpacity={dimmed ? 0.16 : isHighlighted ? 0.95 : 0.6}
                      markerEnd={
                        isDanger && isHighlighted
                          ? "url(#arrowDanger)"
                          : isHighlighted
                          ? "url(#arrowActive)"
                          : "url(#arrowMuted)"
                      }
                    />
                  </g>
                );
              })}

              {/* Interactive Nodes */}
              {layout.nodes.map((n) => {
                const meta = TYPE_META[n.type] || TYPE_META.recipient;
                const isDanger = n.risk >= 70;
                const isSelected = selectedNodeId === n.id;
                const isNeighbor = connectedNeighborIds.has(n.id);
                const matchesSearch =
                  search.trim().length > 0 &&
                  n.label.toLowerCase().includes(search.trim().toLowerCase());
                const dimmed =
                  (selectedNodeId && !isNeighbor) ||
                  (search.trim().length > 0 && !matchesSearch);

                const nodeColor = isDanger ? "#ef4444" : meta.color;

                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x}, ${n.y})`}
                    onClick={() => {
                      setSelectedEdgeIdx(null);
                      setSelectedNodeId(n.id);
                    }}
                    className="cursor-pointer"
                    opacity={dimmed ? 0.28 : 1}
                  >
                    {/* Outer halo for selected or high-risk */}
                    {(isSelected || isDanger) && (
                      <circle
                        r={isSelected ? 22 : 18}
                        fill={nodeColor}
                        fillOpacity={isSelected ? 0.24 : 0.12}
                        stroke={isSelected ? "#ffffff" : nodeColor}
                        strokeWidth={isSelected ? 1.5 : 1}
                        strokeOpacity={isSelected ? 0.9 : 0.45}
                      />
                    )}
                    <circle
                      r={13}
                      fill="#0d1322"
                      stroke={nodeColor}
                      strokeWidth={isSelected ? 3 : 2.2}
                    />
                    <circle r={6} fill={nodeColor} />

                    {/* Risk badge pill */}
                    {n.risk > 0 && (
                      <g transform="translate(10, -14)">
                        <rect
                          width="26"
                          height="13"
                          rx="4"
                          fill={isDanger ? "#7f1d1d" : n.risk >= 31 ? "#7c2d12" : "#064e3b"}
                          stroke={nodeColor}
                          strokeWidth="0.8"
                        />
                        <text
                          x="13"
                          y="9.5"
                          fill="#ffffff"
                          fontSize="8"
                          fontWeight="700"
                          textAnchor="middle"
                        >
                          {Math.round(n.risk)}
                        </text>
                      </g>
                    )}

                    {/* Clean readable node label */}
                    <rect
                      x="-64"
                      y="17"
                      width="128"
                      height="16"
                      rx="4"
                      fill="#0b101d"
                      fillOpacity="0.9"
                    />
                    <text
                      y="28"
                      fill={isSelected ? "#ffffff" : "#cbd5e1"}
                      fontSize="9.5"
                      fontWeight={isSelected ? "700" : "500"}
                      textAnchor="middle"
                    >
                      {n.label.length > 21 ? n.label.slice(0, 20) + "…" : n.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-[11px] text-slate-400">
            <div className="flex flex-wrap gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Device
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> IP Endpoint
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Bank / MFS
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Recipient
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> High-Risk (&ge;70)
              </span>
            </div>
            <span className="text-slate-500">Click any node or arrow to inspect relationships</span>
          </div>
        </div>

        {/* Right Side: Interactive Click-to-Inspect Panel */}
        <div className="xl:col-span-4 bg-[#0d1322] border border-[#1d2842] rounded-xl p-5 flex flex-col justify-between space-y-4">
          {selectedEdge ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#182238] pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <Activity className="w-4 h-4" />
                  Relationship Link Inspector
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 text-[10px] font-mono">
                  {selectedEdge.relation}
                </span>
              </div>
              <div className="space-y-3 text-xs bg-[#080c17] p-4 rounded-xl border border-[#182238]">
                <div>
                  <div className="text-slate-400">Source Entity</div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEdgeIdx(null);
                      setSelectedNodeId(selectedEdge.source);
                    }}
                    className="text-white font-semibold hover:text-purple-300 mt-0.5"
                  >
                    {layout.posMap[selectedEdge.source]?.label || selectedEdge.source}
                  </button>
                </div>
                <ArrowRight className="w-4 h-4 text-purple-400" />
                <div>
                  <div className="text-slate-400">Target Entity</div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEdgeIdx(null);
                      setSelectedNodeId(selectedEdge.target);
                    }}
                    className="text-white font-semibold hover:text-purple-300 mt-0.5"
                  >
                    {layout.posMap[selectedEdge.target]?.label || selectedEdge.target}
                  </button>
                </div>
                {selectedEdge.tx_ref && (
                  <div className="pt-2 border-t border-[#182238] flex justify-between">
                    <span className="text-slate-400">Transaction Ref:</span>
                    <span className="font-mono text-blue-300">{selectedEdge.tx_ref}</span>
                  </div>
                )}
                {selectedEdge.amount != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Transfer Amount:</span>
                    <span className="font-bold text-white">
                      BDT {Number(selectedEdge.amount).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : selectedNode ? (
            (() => {
              const meta = TYPE_META[selectedNode.type] || TYPE_META.recipient;
              const Icon = meta.icon;
              const riskColor =
                selectedNode.risk >= 70
                  ? "text-red-400"
                  : selectedNode.risk >= 31
                  ? "text-orange-400"
                  : "text-emerald-400";
              const barColor =
                selectedNode.risk >= 70
                  ? "bg-red-500"
                  : selectedNode.risk >= 31
                  ? "bg-orange-500"
                  : "bg-emerald-500";

              return (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2 border-b border-[#182238] pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${meta.bg}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {meta.title}
                        </div>
                        <h3 className="text-sm font-bold text-white break-all">{selectedNode.label}</h3>
                      </div>
                    </div>
                  </div>

                  {/* Risk & Degree */}
                  <div className="bg-[#080c17] p-3.5 rounded-xl border border-[#182238] space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Entity Risk Score</span>
                      <span className={`font-bold ${riskColor}`}>{selectedNode.risk} / 100</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#151e33] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${Math.min(100, Math.max(4, selectedNode.risk))}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <span className="text-slate-400">Graph Connections (Degree):</span>
                      <span className="font-mono font-semibold text-white">
                        {selectedNode.degree} links
                      </span>
                    </div>
                  </div>

                  {/* Connected Paths */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Connected Paths ({incomingEdges.length + outgoingEdges.length})
                    </div>
                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 text-xs">
                      {outgoingEdges.map((e, idx) => {
                        const targetNode = layout.posMap[e.target] || graph.nodes.find((n) => n.id === e.target);
                        return (
                          <button
                            key={`out-${idx}`}
                            type="button"
                            onClick={() => setSelectedNodeId(e.target)}
                            className="w-full text-left p-2.5 rounded-lg bg-[#080c17] hover:bg-[#131b30] border border-[#182238] flex items-center justify-between gap-2 transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="text-[10px] font-mono text-purple-300">
                                → {e.relation}
                              </div>
                              <div className="text-slate-200 font-medium truncate">
                                {targetNode?.label || e.target}
                              </div>
                            </div>
                            {e.amount != null && (
                              <span className="text-[11px] font-semibold text-white shrink-0">
                                BDT {Number(e.amount).toLocaleString()}
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {incomingEdges.map((e, idx) => {
                        const srcNode = layout.posMap[e.source] || graph.nodes.find((n) => n.id === e.source);
                        return (
                          <button
                            key={`in-${idx}`}
                            type="button"
                            onClick={() => setSelectedNodeId(e.source)}
                            className="w-full text-left p-2.5 rounded-lg bg-[#080c17] hover:bg-[#131b30] border border-[#182238] flex items-center justify-between gap-2 transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="text-[10px] font-mono text-blue-300">
                                ← {e.relation}
                              </div>
                              <div className="text-slate-200 font-medium truncate">
                                {srcNode?.label || e.source}
                              </div>
                            </div>
                            {e.amount != null && (
                              <span className="text-[11px] font-semibold text-white shrink-0">
                                BDT {Number(e.amount).toLocaleString()}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="my-auto text-center text-xs text-slate-400 space-y-2 py-10">
              <Cpu className="w-8 h-8 text-purple-400 mx-auto opacity-80" />
              <div>Click any entity node or arrow in the graph to inspect its connections and risk details.</div>
            </div>
          )}

          <div className="text-[10.5px] text-slate-500 pt-2 border-t border-[#182238]">
            {graph.architecture_note}
          </div>
        </div>
      </div>

      {/* Clickable Graph Pattern Findings */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>Detected Graph Patterns &amp; Fraud Ring Signals (Click to Focus)</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {graph.findings.map((f, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => selectFindingEntity(f.entity)}
              className="text-left bg-[#0d1322] hover:bg-[#131b30] border border-[#1d2842] hover:border-purple-500/50 rounded-xl p-4 text-xs space-y-1 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">{f.pattern}</span>
                <span
                  className={`px-2 py-0.5 rounded uppercase text-[10px] font-semibold ${
                    f.severity === "high"
                      ? "bg-red-500/15 text-red-300"
                      : "bg-orange-500/15 text-orange-300"
                  }`}
                >
                  {f.severity}
                </span>
              </div>
              <div className="font-mono text-blue-300">{f.entity}</div>
              <p className="text-slate-400">{f.detail}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
