import csv
import hashlib
import io
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

from pypdf import PdfReader


ALLOWED_EXTENSIONS = {".csv", ".pdf"}


def validate_upload_file(filename: str, content: bytes, max_bytes: int) -> Tuple[str, str]:
    """Validate file extension, size, basic magic bytes, and compute SHA-256 lineage hash."""
    lower = (filename or "").lower().strip()
    ext = ""
    for candidate in ALLOWED_EXTENSIONS:
        if lower.endswith(candidate):
            ext = candidate
            break
    if not ext:
        raise ValueError("Unsupported file type. Only .csv and .pdf bank/MFS statements are allowed.")

    if len(content) == 0:
        raise ValueError("Uploaded file is empty.")
    if len(content) > max_bytes:
        raise ValueError(f"File exceeds maximum allowed size of {max_bytes // (1024 * 1024)} MB.")

    if ext == ".pdf" and not content.startswith(b"%PDF-"):
        raise ValueError("Invalid PDF file signature.")

    file_hash = hashlib.sha256(content).hexdigest()
    return ext, file_hash


def _parse_timestamp(raw: str) -> datetime:
    cleaned = (raw or "").strip()
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d",
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y",
        "%d-%m-%Y",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(cleaned[:19], fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return datetime.now(timezone.utc)


def _clean_amount(raw: str) -> float:
    cleaned = re.sub(r"[^\d.\-]", "", str(raw or "0"))
    try:
        val = abs(float(cleaned))
        return round(val, 2)
    except ValueError:
        return 0.0


def parse_csv_statement(content: bytes, default_institution: str, sender_name: str) -> List[Dict[str, Any]]:
    """Parse, clean, and schema-normalize a CSV bank/MFS statement."""
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ValueError("CSV file has no header row.")

    records: List[Dict[str, Any]] = []
    for idx, row in enumerate(reader, start=1):
        norm = {str(k).strip().lower(): (v or "").strip() for k, v in row.items() if k}
        amount = _clean_amount(
            norm.get("amount") or norm.get("debit") or norm.get("credit") or norm.get("tx_amount") or "0"
        )
        if amount <= 0:
            continue

        tx_ref = (
            norm.get("tx_ref")
            or norm.get("transaction_id")
            or norm.get("reference")
            or norm.get("trx_id")
            or f"CSV-{hashlib.md5(f'{idx}-{norm}'.encode()).hexdigest()[:10].upper()}"
        )
        raw_date = norm.get("date") or norm.get("tx_timestamp") or norm.get("timestamp") or norm.get("time") or ""
        tx_type = norm.get("type") or norm.get("tx_type") or norm.get("description") or "Transfer"
        recipient = norm.get("recipient") or norm.get("recipient_name") or norm.get("to") or "Imported Beneficiary"
        rec_acct = norm.get("recipient_account") or norm.get("account") or norm.get("to_account") or "****0000"
        source_inst = norm.get("source_institution") or norm.get("bank") or default_institution
        dest_inst = norm.get("dest_institution") or norm.get("destination_bank") or None
        status = norm.get("status") or "Completed"

        records.append({
            "tx_ref": tx_ref[:80],
            "tx_timestamp": _parse_timestamp(raw_date),
            "amount": amount,
            "currency": norm.get("currency") or "BDT",
            "tx_type": tx_type[:48],
            "sender_name": norm.get("sender") or sender_name,
            "recipient_name": recipient[:120],
            "recipient_account": rec_acct[:64],
            "source_institution": source_inst[:120],
            "dest_institution": dest_inst[:120] if dest_inst else None,
            "status": status[:32],
            "ip_address": norm.get("ip_address") or None,
            "location_label": norm.get("location") or "Dhaka, Bangladesh",
        })

    if not records:
        raise ValueError("No valid transaction rows found in the CSV statement.")
    return records


def parse_pdf_statement(content: bytes, default_institution: str, sender_name: str) -> List[Dict[str, Any]]:
    """Extract structured transactions from text-based PDF bank/MFS statements."""
    reader = PdfReader(io.BytesIO(content))
    full_text = "\n".join(page.extract_text() or "" for page in reader.pages)
    if not full_text.strip():
        raise ValueError("PDF contains no extractable text (scanned image PDFs require OCR).")

    records: List[Dict[str, Any]] = []
    # Match lines containing a date (YYYY-MM-DD or DD/MM/YYYY) and a monetary amount
    pattern = re.compile(
        r"(?P<date>\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4})\s+(?P<desc>[A-Za-z0-9\s\-_./*]+?)\s+(?P<amt>[\d,]+\.\d{2})"
    )
    for idx, match in enumerate(pattern.finditer(full_text), start=1):
        amount = _clean_amount(match.group("amt"))
        if amount <= 0:
            continue
        desc = match.group("desc").strip()
        tx_ref = f"PDF-{hashlib.md5(f'{idx}-{match.group(0)}'.encode()).hexdigest()[:10].upper()}"
        records.append({
            "tx_ref": tx_ref,
            "tx_timestamp": _parse_timestamp(match.group("date")),
            "amount": amount,
            "currency": "BDT",
            "tx_type": "Statement Transfer",
            "sender_name": sender_name,
            "recipient_name": desc[:80],
            "recipient_account": "****PDF",
            "source_institution": default_institution,
            "dest_institution": None,
            "status": "Completed",
            "ip_address": None,
            "location_label": "Statement Import",
        })

    if not records:
        raise ValueError("Could not detect standard date + amount transaction lines in this PDF statement.")
    return records
