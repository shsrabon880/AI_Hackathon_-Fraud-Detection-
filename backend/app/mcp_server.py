"""FinSphere AI - FraudShield MCP (Model Context Protocol) Server.

Exposes privacy-safe recipient phone intelligence and bank account risk lookup
tools over stdio transport for MCP-compatible AI clients.
"""

from mcp.server.mcpserver import MCPServer

from app.api.v1.recipient_intel import (
    CONSENTED_DEMO_PHONES,
    DEMO_BANK_ACCOUNTS,
    _normalize_bd_phone,
)

mcp = MCPServer("FinSphere-FraudShield-MCP")


@mcp.tool()
def lookup_recipient_phone(phone: str) -> dict:
    """Evaluate a Bangladeshi mobile number (01XXXXXXXXX or +8801XXXXXXXXX) for recipient risk.

    Never fabricates private identity or age for unconsented numbers.
    """
    parsed = _normalize_bd_phone(phone)
    if not parsed.get("is_valid"):
        return {
            "valid_format": False,
            "error": "Invalid Bangladeshi mobile number format. Expected 01XXXXXXXXX or +8801XXXXXXXXX.",
        }

    normalized = parsed["normalized_local"]
    operator = parsed.get("operator", "Unknown")
    demo = CONSENTED_DEMO_PHONES.get(normalized)
    if demo:
        return {
            "valid_format": True,
            "mobile_number": f"+88{normalized}",
            "operator": operator,
            "verified_name": demo.get("verified_name", demo.get("name", "Not Available")),
            "age": f"{demo.get('age', 'N/A')} years (Consented Demo)",
            "verification_status": demo.get("account_verification_status", demo.get("verification_status", "Verified")),
            "risk_score": demo.get("risk_score", 16),
            "risk_classification": demo.get("risk_classification", "Low Risk"),
            "data_source": "DEMO DATA (CONSENTED)",
        }

    return {
        "valid_format": True,
        "mobile_number": f"+88{normalized}",
        "operator": operator,
        "verified_name": "Not Available",
        "age": "Not Available",
        "verification_status": "Verification Unavailable",
        "risk_score": 20,
        "risk_classification": "Low Risk",
        "data_source": "Public Format & Carrier Validation Only",
    }


@mcp.tool()
def lookup_bank_account(bank_name: str, account_number: str) -> dict:
    """Check a Bangladeshi bank account number for verification status and risk indicators."""
    cleaned_acct = "".join(ch for ch in account_number if ch.isalnum())
    if len(cleaned_acct) < 6:
        return {"error": "Account number must contain at least 6 alphanumeric characters."}

    masked = f"{'*' * max(4, len(cleaned_acct) - 4)}{cleaned_acct[-4:]}"
    key = f"{bank_name.strip().lower()}::{cleaned_acct[-4:]}"
    demo = DEMO_BANK_ACCOUNTS.get(key)
    if demo:
        return {
            "bank_name": demo["bank_name"],
            "account_number_masked": masked,
            "verification_status": demo["verification_status"],
            "account_holder_name": demo["account_holder_name"],
            "risk_score": demo["risk_score"],
            "risk_classification": demo["risk_classification"],
            "data_source": "DEMO DATA",
        }

    return {
        "bank_name": bank_name,
        "account_number_masked": masked,
        "verification_status": "Verification Unavailable",
        "account_holder_name": "Not Available (Authorization Required)",
        "risk_score": 25,
        "risk_classification": "Low Risk",
        "data_source": "Format Check Only",
    }


@mcp.tool()
def list_supported_bd_banks() -> list[str]:
    """Return the list of supported Bangladeshi banks in FraudShield."""
    return [
        "City Bank",
        "Dutch-Bangla Bank Limited",
        "Dhaka Bank",
        "Islami Bank Bangladesh",
        "Trust Bank",
        "Eastern Bank Limited (EBL)",
        "BRAC Bank",
        "Bank Asia",
        "Prime Bank",
        "Standard Chartered Bangladesh",
    ]


if __name__ == "__main__":
    mcp.run(transport="stdio")
