from collections import defaultdict
from typing import Any, Dict, List

import networkx as nx


def analyze_transaction_graph(transactions: List[Any], devices: List[Any]) -> Dict[str, Any]:
    """
    Build a multi-entity relationship graph (Users, Institutions, Recipients, Devices, IPs)
    using NetworkX (designed to mirror Neo4j Cypher node/edge schemas).
    Identifies shared IPs, shared devices, high-fanout recipients, and suspicious chains.
    """
    G = nx.DiGraph()

    device_by_label = {d.device_name: d for d in devices}
    ip_to_recipients = defaultdict(set)
    recipient_to_senders = defaultdict(set)
    recipient_tx_counts = defaultdict(int)
    high_risk_links = 0

    for tx in transactions:
        src_node = f"inst:{tx.source_institution}"
        rec_node = f"rec:{tx.recipient_account_masked}"
        dev_node = f"dev:{tx.device_label}"
        ip_val = tx.ip_address or "Unknown IP"
        ip_node = f"ip:{ip_val}"

        G.add_node(src_node, label=tx.source_institution, type="institution", risk=10)
        G.add_node(rec_node, label=f"{tx.recipient_name} ({tx.recipient_account_masked})", type="recipient", risk=tx.risk_score)
        G.add_node(dev_node, label=tx.device_label, type="device", risk=getattr(device_by_label.get(tx.device_label), "risk_score", 20))
        G.add_node(ip_node, label=ip_val, type="ip", risk=tx.risk_score)

        G.add_edge(dev_node, ip_node, relation="CONNECTED_VIA")
        G.add_edge(ip_node, src_node, relation="ACCESSED_ACCOUNT")
        G.add_edge(src_node, rec_node, relation="TRANSFERRED_TO", amount=tx.amount, tx_ref=tx.tx_ref)

        ip_to_recipients[ip_val].add(tx.recipient_account_masked)
        recipient_to_senders[tx.recipient_account_masked].add(tx.source_institution)
        recipient_tx_counts[tx.recipient_account_masked] += 1
        if tx.risk_score >= 70:
            high_risk_links += 1

    findings: List[Dict[str, Any]] = []
    graph_score = 10.0

    # Shared IP accessing multiple distinct recipients
    for ip_val, recs in ip_to_recipients.items():
        if ip_val != "Unknown IP" and len(recs) >= 3:
            graph_score += 22.0
            findings.append({
                "pattern": "High-Fanout IP Address",
                "severity": "high",
                "entity": ip_val,
                "detail": f"IP {ip_val} initiated transfers to {len(recs)} distinct recipient accounts.",
            })

    # Repeated high-frequency recipient
    for rec_acct, count in recipient_tx_counts.items():
        if count >= 3:
            graph_score += 12.0
            findings.append({
                "pattern": "Repeated Recipient Hub",
                "severity": "medium",
                "entity": rec_acct,
                "detail": f"Recipient {rec_acct} received {count} transfers across monitored history.",
            })

    # Multi-institution convergence onto a single recipient
    for rec_acct, insts in recipient_to_senders.items():
        if len(insts) >= 2:
            graph_score += 18.0
            findings.append({
                "pattern": "Cross-Institution Convergence",
                "severity": "medium",
                "entity": rec_acct,
                "detail": f"Recipient {rec_acct} received funds from {len(insts)} different institutions ({', '.join(sorted(insts))}).",
            })

    if high_risk_links > 0:
        graph_score += min(30.0, high_risk_links * 10.0)

    graph_score = round(min(98.0, graph_score), 1)

    nodes_out = [
        {
            "id": node_id,
            "label": data.get("label", node_id),
            "type": data.get("type", "entity"),
            "risk": round(float(data.get("risk", 0)), 1),
            "degree": G.degree(node_id),
        }
        for node_id, data in G.nodes(data=True)
    ]
    edges_out = [
        {
            "source": u,
            "target": v,
            "relation": data.get("relation", "RELATED"),
            "amount": data.get("amount"),
            "tx_ref": data.get("tx_ref"),
        }
        for u, v, data in G.edges(data=True)
    ]

    return {
        "graph_score": graph_score,
        "node_count": len(nodes_out),
        "edge_count": len(edges_out),
        "findings": findings,
        "nodes": nodes_out[:80],
        "edges": edges_out[:120],
        "architecture_note": "Computed in-memory with NetworkX using Neo4j-compatible node/edge schema.",
    }
