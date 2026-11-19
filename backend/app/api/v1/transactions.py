import csv
import io
import json
import secrets
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from sqlalchemy.orm import Session

from app.agents.orchestrator import run_agentic_decision_workflow
from app.api.deps import get_current_user, verify_csrf_if_cookie_auth, write_audit_log
from app.core.config import get_settings
from app.core.security import mask_account
from app.db.database import get_db
from app.graph.network_analyzer import analyze_transaction_graph
from app.ingestion.statement_parser import (
    parse_csv_statement,
    parse_pdf_statement,
    validate_upload_file,
)
from app.ml.risk_engine import classify_risk, score_transaction
from app.models.models import Device, IPIntelligence, RiskAssessment, SecurityAlert, Transaction, User
from app.schemas.schemas import HumanDecisionRequest, TierDecisionRequest, TransactionCreateRequest

router = APIRouter(prefix="/transactions", tags=["Transaction History"])
settings = get_settings()


def _normalize_dt(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _apply_filters(
    db: Session,
    user: User,
    range_filter: str,
    search: Optional[str],
    institution: Optional[str],
    status_filter: Optional[str],
    risk_level: Optional[str],
    min_amount: Optional[float],
    max_amount: Optional[float],
    sort_by: str,
    sort_dir: str,
) -> List[Transaction]:
    query = db.query(Transaction).filter(Transaction.user_id == user.id)
    now = datetime.now(timezone.utc)

    if range_filter == "7d":
        query = query.filter(Transaction.tx_timestamp >= now - timedelta(days=7))
    elif range_filter == "30d":
        query = query.filter(Transaction.tx_timestamp >= now - timedelta(days=30))

    if institution:
        inst_like = f"%{institution.strip()}%"
        query = query.filter(
            (Transaction.source_institution.ilike(inst_like))
            | (Transaction.dest_institution.ilike(inst_like))
        )
    if status_filter:
        query = query.filter(Transaction.status == status_filter)
    if risk_level:
        query = query.filter(Transaction.risk_level == risk_level)
    if min_amount is not None:
        query = query.filter(Transaction.amount >= min_amount)
    if max_amount is not None:
        query = query.filter(Transaction.amount <= max_amount)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (Transaction.tx_ref.ilike(s))
            | (Transaction.recipient_name.ilike(s))
            | (Transaction.sender_name.ilike(s))
            | (Transaction.source_institution.ilike(s))
            | (Transaction.tx_type.ilike(s))
        )

    sort_col = {
        "amount": Transaction.amount,
        "risk_score": Transaction.risk_score,
        "tx_timestamp": Transaction.tx_timestamp,
        "status": Transaction.status,
    }.get(sort_by, Transaction.tx_timestamp)

    query = query.order_by(sort_col.asc() if sort_dir == "asc" else sort_col.desc())
    return query.all()


def _classify_tier(score: float) -> tuple[str, int, str]:
    """Three-tier automated & interactive risk decision routing."""
    if score <= 30.0:
        return "AUTO_APPROVED", 1, "Completed"
    if score < 80.0:
        return "PENDING_USER_APPROVAL", 2, "Pending Review"
    return "AUTO_REJECTED", 3, "Auto-Rejected"


def _serialize_tx(tx: Transaction, include_assessment: bool = False, device_obj: Optional[Device] = None) -> dict:
    ts = _normalize_dt(tx.tx_timestamp)
    tier_code, tier_num, _ = _classify_tier(tx.risk_score)
    out = {
        "id": tx.id,
        "tx_ref": tx.tx_ref,
        "tx_timestamp": ts.isoformat(),
        "date": ts.strftime("%Y-%m-%d"),
        "time": ts.strftime("%H:%M:%S UTC"),
        "amount": tx.amount,
        "currency": tx.currency,
        "tx_type": tx.tx_type,
        "sender_name": tx.sender_name,
        "recipient_name": tx.recipient_name,
        "recipient_account_masked": tx.recipient_account_masked,
        "source_institution": tx.source_institution,
        "dest_institution": tx.dest_institution or "N/A",
        "status": tx.status,
        "device_label": tx.device_label,
        "ip_address": tx.ip_address or "Not Available",
        "location_label": tx.location_label or "Not Available",
        "latitude": tx.latitude,
        "longitude": tx.longitude,
        "risk_score": tx.risk_score,
        "risk_level": tx.risk_level,
        "tier": tier_code,
        "tier_number": tier_num,
        "is_demo_data": tx.is_demo_data,
        "forensics": {
            "device_model": device_obj.device_model if device_obj else "Web Client",
            "os": device_obj.os if device_obj else "Unknown",
            "browser": device_obj.browser if device_obj else "Unknown",
            "sim_operator": device_obj.sim_operator if (device_obj and device_obj.sim_operator) else "Not Available",
            "phone_masked": device_obj.phone_masked if (device_obj and device_obj.phone_masked) else "Not Available",
            "battery_pct": f"{device_obj.battery_pct}%" if (device_obj and device_obj.battery_pct is not None) else "Not Available",
        },
    }
    if include_assessment and tx.assessment:
        a = tx.assessment
        out["assessment"] = {
            "overall_score": a.overall_score,
            "risk_level": a.risk_level,
            "ml_score": a.ml_score,
            "graph_score": a.graph_score,
            "rule_score": a.rule_score,
            "indicators": json.loads(a.indicators_json or "[]"),
            "feature_explanations": json.loads(a.feature_explanations_json or "[]"),
            "recommended_action": a.recommended_action,
            "agent_rationale": a.agent_rationale,
            "human_decision": a.human_decision,
            "reviewed_by": a.reviewed_by,
        }
    return out


def _compute_analytics(items: List[Transaction]) -> dict:
    total = len(items)
    total_vol = round(sum(t.amount for t in items), 2)
    successful = sum(1 for t in items if t.status == "Completed")
    failed = sum(1 for t in items if t.status == "Failed")
    suspicious = sum(1 for t in items if t.risk_score >= 70 or t.status in ("Flagged", "Pending Review"))
    avg_amt = round(total_vol / total, 2) if total else 0.0

    daily_map = defaultdict(lambda: {"date": "", "count": 0, "volume": 0.0, "suspicious": 0})
    for t in items:
        d = _normalize_dt(t.tx_timestamp).strftime("%Y-%m-%d")
        daily_map[d]["date"] = d
        daily_map[d]["count"] += 1
        daily_map[d]["volume"] = round(daily_map[d]["volume"] + t.amount, 2)
        if t.risk_score >= 70:
            daily_map[d]["suspicious"] += 1

    daily_series = [daily_map[k] for k in sorted(daily_map.keys())]
    return {
        "total_transactions": total,
        "total_volume": total_vol,
        "successful_transactions": successful,
        "failed_transactions": failed,
        "suspicious_transactions": suspicious,
        "average_amount": avg_amt,
        "daily_series": daily_series,
    }


def _evaluate_and_store_tx(
    db: Session,
    *,
    user: User,
    tx_ref: str,
    tx_timestamp: datetime,
    amount: float,
    currency: str,
    tx_type: str,
    sender_name: str,
    recipient_name: str,
    recipient_account_raw: str,
    source_institution: str,
    dest_institution: Optional[str],
    status_val: str,
    ip_address: Optional[str],
    location_label: Optional[str],
    latitude: Optional[float],
    longitude: Optional[float],
    is_demo_data: bool,
    source_file_hash: Optional[str] = None,
    simulated_risk_score: Optional[float] = None,
) -> tuple[Transaction, Optional[Device]]:
    existing_txs = db.query(Transaction).filter(Transaction.user_id == user.id).all()
    devices = db.query(Device).filter(Device.user_id == user.id).all()
    hist_amounts = [t.amount for t in existing_txs]
    hist_recipients = [t.recipient_account_masked for t in existing_txs]

    recent_1h = sum(
        1
        for t in existing_txs
        if abs((_normalize_dt(tx_timestamp) - _normalize_dt(t.tx_timestamp)).total_seconds()) <= 3600
    ) + 1

    ip_intel = db.query(IPIntelligence).filter(IPIntelligence.ip_address == ip_address).first() if ip_address else None
    ip_risk = float(ip_intel.risk_score) if ip_intel else 15.0

    # Pick most relevant device (suspicious for high-risk IP if available, else primary)
    matched_device = None
    if ip_risk >= 70:
        matched_device = next((d for d in devices if d.trust_status in ("suspicious", "blocked")), None)
    if not matched_device and devices:
        matched_device = devices[0]

    dev_trust = matched_device.trust_status if matched_device else "unverified"
    is_new_dev = matched_device.is_new_device if matched_device else True

    rec_masked = mask_account(recipient_account_raw)
    ml_res = score_transaction(
        amount=amount,
        tx_type=tx_type,
        tx_timestamp=tx_timestamp,
        recipient_account_masked=rec_masked,
        historical_amounts=hist_amounts,
        historical_recipients=hist_recipients,
        recent_tx_count_1h=recent_1h,
        device_trust_status=dev_trust,
        is_new_device=is_new_dev,
        ip_risk_score=ip_risk,
        location_label=location_label,
    )

    graph_res = analyze_transaction_graph(existing_txs, devices)
    agent_res = run_agentic_decision_workflow(
        ml_score=ml_res["ml_score"],
        graph_score=graph_res["graph_score"],
        ip_risk_score=ip_risk,
        device_trust_status=dev_trust,
        amount=amount,
        feature_explanations=ml_res["feature_explanations"],
    )

    effective_score = round(float(simulated_risk_score), 1) if simulated_risk_score is not None else agent_res["overall_score"]
    effective_level = classify_risk(effective_score)
    tier_code, _tier_num, tier_status = _classify_tier(effective_score)

    final_status = status_val
    if simulated_risk_score is not None or status_val == "Completed":
        final_status = tier_status

    tx = Transaction(
        user_id=user.id,
        device_id=matched_device.id if matched_device else None,
        tx_ref=tx_ref,
        tx_timestamp=tx_timestamp,
        amount=amount,
        currency=currency,
        tx_type=tx_type,
        sender_name=sender_name,
        recipient_name=recipient_name,
        recipient_account_masked=rec_masked,
        source_institution=source_institution,
        dest_institution=dest_institution,
        status=final_status,
        device_label=matched_device.device_name if matched_device else "Web Browser",
        ip_address=ip_address,
        location_label=location_label,
        latitude=latitude or (ip_intel.latitude if ip_intel else None),
        longitude=longitude or (ip_intel.longitude if ip_intel else None),
        risk_score=effective_score,
        risk_level=effective_level,
        is_demo_data=is_demo_data,
        source_file_hash=source_file_hash,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)

    rec_action = (
        "Auto-Approved (<50ms)"
        if tier_code == "AUTO_APPROVED"
        else ("Await User Approval (Approve / Not Approve)" if tier_code == "PENDING_USER_APPROVAL" else "Auto-Rejected & Session Locked")
    )

    db.add(
        RiskAssessment(
            transaction_id=tx.id,
            user_id=user.id,
            ip_address=ip_address,
            overall_score=effective_score,
            risk_level=effective_level,
            ml_score=agent_res["ml_score"],
            graph_score=agent_res["graph_score"],
            rule_score=agent_res["rule_score"],
            indicators_json=json.dumps([f["label"] for f in ml_res["feature_explanations"] if f["severity"] != "low"]),
            feature_explanations_json=json.dumps(ml_res["feature_explanations"]),
            recommended_action=rec_action,
            agent_rationale=agent_res["agent_rationale"],
        )
    )
    if tier_code == "PENDING_USER_APPROVAL":
        db.add(
            SecurityAlert(
                user_id=user.id,
                transaction_id=tx.id,
                device_id=matched_device.id if matched_device else None,
                severity="high",
                title=f"Suspicious Activity — User Approval Required ({tx.tx_ref})",
                description=f"Transaction of {currency} {amount:,.0f} to {recipient_name} scored {effective_score}%. Waiting for user approval.",
                status="open",
                is_demo_data=is_demo_data,
            )
        )
    elif tier_code == "AUTO_REJECTED":
        if matched_device and matched_device.trust_status != "trusted":
            matched_device.trust_status = "blocked"
            matched_device.unusual_tx_count += 1
        db.add(
            SecurityAlert(
                user_id=user.id,
                transaction_id=tx.id,
                device_id=matched_device.id if matched_device else None,
                severity="critical",
                title=f"CRITICAL FRAUD ALERT — Auto-Rejected ({tx.tx_ref})",
                description=f"Unauthorized high-risk transfer ({effective_score}%) from IP {ip_address or 'Unknown'} blocked automatically.",
                status="open",
                is_demo_data=is_demo_data,
            )
        )
    db.commit()
    db.refresh(tx)
    return tx, matched_device


@router.get("")
def list_transactions(
    range: str = Query(default="all", pattern="^(7d|30d|all)$"),
    search: Optional[str] = Query(default=None),
    institution: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    risk_level: Optional[str] = Query(default=None),
    min_amount: Optional[float] = Query(default=None),
    max_amount: Optional[float] = Query(default=None),
    sort_by: str = Query(default="tx_timestamp"),
    sort_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = _apply_filters(
        db,
        user,
        range,
        search,
        institution,
        status,
        risk_level,
        min_amount,
        max_amount,
        sort_by,
        sort_dir,
    )
    return {
        "range": range,
        "analytics": _compute_analytics(items),
        "items": [_serialize_tx(t) for t in items],
    }


@router.get("/export/csv")
def export_transactions_csv(
    range: str = Query(default="all", pattern="^(7d|30d|all)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = _apply_filters(db, user, range, None, None, None, None, None, None, "tx_timestamp", "desc")
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Transaction ID",
        "Date",
        "Time",
        "Amount",
        "Currency",
        "Type",
        "Sender",
        "Recipient",
        "Recipient Account",
        "Source Institution",
        "Destination Institution",
        "Status",
        "Device",
        "IP Address",
        "Location",
        "Risk Score",
        "Risk Level",
        "Data Origin",
    ])
    for t in items:
        ts = _normalize_dt(t.tx_timestamp)
        writer.writerow([
            t.tx_ref,
            ts.strftime("%Y-%m-%d"),
            ts.strftime("%H:%M:%S UTC"),
            t.amount,
            t.currency,
            t.tx_type,
            t.sender_name,
            t.recipient_name,
            t.recipient_account_masked,
            t.source_institution,
            t.dest_institution or "N/A",
            t.status,
            t.device_label,
            t.ip_address or "Not Available",
            t.location_label or "Not Available",
            t.risk_score,
            t.risk_level,
            "DEMO DATA" if t.is_demo_data else "USER IMPORTED",
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="fraudshield_statement_{range}.csv"'},
    )


def _build_simple_pdf(lines: List[str]) -> bytes:
    """Generate a valid minimal PDF 1.4 statement document without external native binaries."""
    escaped = [
        line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")[:95]
        for line in lines[:45]
    ]
    stream_lines = ["BT", "/F1 10 Tf", "40 770 Td", "14 TL"]
    for idx, line in enumerate(escaped):
        if idx == 0:
            stream_lines.append(f"({line}) Tj")
        else:
            stream_lines.append(f"T* ({line}) Tj")
    stream_lines.append("ET")
    stream_bytes = "\n".join(stream_lines).encode("latin-1", errors="replace")

    objs = [
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n",
        f"4 0 obj << /Length {len(stream_bytes)} >> stream\n".encode("ascii") + stream_bytes + b"\nendstream endobj\n",
        b"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj\n",
    ]
    buf = io.BytesIO()
    buf.write(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objs:
        offsets.append(buf.tell())
        buf.write(obj)
    xref_pos = buf.tell()
    buf.write(f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode("ascii"))
    for off in offsets[1:]:
        buf.write(f"{off:010d} 00000 n \n".encode("ascii"))
    buf.write(f"trailer << /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode("ascii"))
    return buf.getvalue()


@router.get("/export/pdf")
def export_transactions_pdf(
    range: str = Query(default="all", pattern="^(7d|30d|all)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = _apply_filters(db, user, range, None, None, None, None, None, None, "tx_timestamp", "desc")
    analytics = _compute_analytics(items)
    lines = [
        "FinSphere AI - FraudShield Statement Export",
        f"Account Holder: {user.full_name} ({user.user_code}) | Filter: {range.upper()}",
        f"Total Tx: {analytics['total_transactions']} | Volume: BDT {analytics['total_volume']:,.2f} | Flagged: {analytics['suspicious_transactions']}",
        "-" * 90,
        "REF            DATE        AMOUNT (BDT)  SOURCE        RECIPIENT          RISK",
        "-" * 90,
    ]
    for t in items[:38]:
        ts = _normalize_dt(t.tx_timestamp).strftime("%Y-%m-%d")
        lines.append(
            f"{t.tx_ref[:13]:<14} {ts}  {t.amount:>11,.2f}  {t.source_institution[:12]:<13} {t.recipient_name[:17]:<18} {t.risk_score:>4.0f} ({t.risk_level.split()[0]})"
        )
    pdf_bytes = _build_simple_pdf(lines)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="fraudshield_statement_{range}.pdf"'},
    )


@router.get("/{tx_id}")
def get_transaction_detail(
    tx_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tx = db.query(Transaction).filter(Transaction.id == tx_id, Transaction.user_id == user.id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    dev = db.query(Device).filter(Device.id == tx.device_id).first() if tx.device_id else None
    return _serialize_tx(tx, include_assessment=True, device_obj=dev)


@router.post("", status_code=201)
def create_and_score_transaction(
    payload: TransactionCreateRequest,
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    t0 = time.perf_counter()
    tx_ref = f"TX-{secrets.token_hex(4).upper()}"
    tx, dev = _evaluate_and_store_tx(
        db,
        user=user,
        tx_ref=tx_ref,
        tx_timestamp=datetime.now(timezone.utc),
        amount=payload.amount,
        currency=payload.currency,
        tx_type=payload.tx_type,
        sender_name=user.full_name,
        recipient_name=payload.recipient_name,
        recipient_account_raw=payload.recipient_account,
        source_institution=payload.source_institution,
        dest_institution=payload.dest_institution,
        status_val="Completed",
        ip_address=payload.ip_address,
        location_label=payload.location_label,
        latitude=payload.latitude,
        longitude=payload.longitude,
        is_demo_data=payload.simulated_risk_score is not None,
        simulated_risk_score=payload.simulated_risk_score,
    )
    elapsed_ms = max(4, round((time.perf_counter() - t0) * 1000, 1))
    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action="TRANSACTION_EVALUATED",
        resource_type="transaction",
        resource_id=tx.tx_ref,
        details={"risk_score": tx.risk_score, "risk_level": tx.risk_level, "status": tx.status},
    )
    out = _serialize_tx(tx, include_assessment=True, device_obj=dev)
    out["evaluation_ms"] = elapsed_ms
    return out


@router.post("/{tx_id}/tier-decision")
def handle_tier_decision(
    tx_id: int,
    payload: TierDecisionRequest,
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    tx = db.query(Transaction).filter(Transaction.id == tx_id, Transaction.user_id == user.id).first()
    if not tx or not tx.assessment:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    dev = db.query(Device).filter(Device.id == tx.device_id).first() if tx.device_id else None

    if payload.action == "APPROVE":
        tx.status = "Approved by User"
        tx.assessment.human_decision = "Approved by User"
        tx.assessment.reviewed_by = user.email
        audit_action = "TIER2_USER_APPROVED"
    elif payload.action == "NOT_APPROVE":
        tx.status = "Rejected by User"
        tx.assessment.human_decision = "Rejected by User"
        tx.assessment.reviewed_by = user.email
        if dev:
            dev.trust_status = "suspicious"
            dev.unusual_tx_count += 1
        audit_action = "TIER2_USER_REJECTED"
    else:
        tx.assessment.human_decision = "Alert Confirmed by User"
        tx.assessment.reviewed_by = user.email
        audit_action = "TIER3_ALERT_CONFIRMED"

    db.commit()
    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action=audit_action,
        resource_type="transaction",
        resource_id=tx.tx_ref,
        details={"status": tx.status},
    )
    return _serialize_tx(tx, include_assessment=True, device_obj=dev)


@router.post("/{tx_id}/decision")
def submit_human_decision(
    tx_id: int,
    payload: HumanDecisionRequest,
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    tx = db.query(Transaction).filter(Transaction.id == tx_id, Transaction.user_id == user.id).first()
    if not tx or not tx.assessment:
        raise HTTPException(status_code=404, detail="Transaction assessment not found.")
    tx.assessment.human_decision = payload.decision
    tx.assessment.reviewed_by = user.email
    if payload.decision == "Approved":
        tx.status = "Completed"
    elif payload.decision == "Confirmed Fraud":
        tx.status = "Flagged"
    else:
        tx.status = "Pending Review"
    db.commit()
    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action="HUMAN_REVIEW_DECISION",
        resource_type="transaction",
        resource_id=tx.tx_ref,
        details={"decision": payload.decision, "notes": payload.notes},
    )
    return _serialize_tx(tx, include_assessment=True)


@router.post("/upload-statement")
async def upload_statement(
    institution: str = Form(default="Uploaded Statement"),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    content = await file.read()
    try:
        ext, file_hash = validate_upload_file(file.filename or "", content, settings.MAX_UPLOAD_SIZE_BYTES)
        parsed = (
            parse_csv_statement(content, institution, user.full_name)
            if ext == ".csv"
            else parse_pdf_statement(content, institution, user.full_name)
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    imported_count = 0
    skipped_duplicates = 0
    for row in parsed:
        dup = (
            db.query(Transaction)
            .filter(Transaction.user_id == user.id, Transaction.tx_ref == row["tx_ref"])
            .first()
        )
        if dup:
            skipped_duplicates += 1
            continue
        _evaluate_and_store_tx(
            db,
            user=user,
            tx_ref=row["tx_ref"],
            tx_timestamp=row["tx_timestamp"],
            amount=row["amount"],
            currency=row["currency"],
            tx_type=row["tx_type"],
            sender_name=row["sender_name"],
            recipient_name=row["recipient_name"],
            recipient_account_raw=row["recipient_account"],
            source_institution=row["source_institution"],
            dest_institution=row["dest_institution"],
            status_val=row["status"],
            ip_address=row["ip_address"],
            location_label=row["location_label"],
            latitude=None,
            longitude=None,
            is_demo_data=False,
            source_file_hash=file_hash,
        )
        imported_count += 1

    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action="STATEMENT_IMPORTED",
        resource_type="statement",
        resource_id=file_hash[:16],
        details={"filename": file.filename, "imported": imported_count, "duplicates_skipped": skipped_duplicates},
    )
    return {
        "filename": file.filename,
        "file_hash": file_hash[:16],
        "imported_count": imported_count,
        "skipped_duplicates": skipped_duplicates,
    }
