from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    user_code = Column(String(32), unique=True, nullable=False, index=True)
    full_name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone_number = Column(String(32), nullable=True, index=True)
    country = Column(String(80), nullable=False, default="Bangladesh")
    preferred_language = Column(String(12), nullable=False, default="en")
    password_hash = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False, default="user")  # user | analyst | admin
    status = Column(String(32), nullable=False, default="active")  # active | suspended | locked | pending_verification
    email_verified = Column(Boolean, nullable=False, default=False)
    mfa_enabled = Column(Boolean, nullable=False, default=False)
    mfa_secret_encrypted = Column(String(512), nullable=True)
    failed_login_attempts = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    devices = relationship("Device", back_populates="user", cascade="all, delete-orphan")
    connectors = relationship("Connector", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    policy = relationship("SecurityPolicy", back_populates="user", uselist=False, cascade="all, delete-orphan")
    signup_otps = relationship("SignupEmailOTP", back_populates="user", cascade="all, delete-orphan")
    password_reset_otps = relationship("PasswordResetOTP", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    notification_pref = relationship("NotificationPreference", back_populates="user", uselist=False, cascade="all, delete-orphan")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_token_jti = Column(String(64), unique=True, nullable=False, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    device_label = Column(String(120), nullable=False, default="Web Browser")
    browser = Column(String(120), nullable=False, default="Unknown")
    os = Column(String(120), nullable=False, default="Unknown")
    ip_address = Column(String(64), nullable=False, default="127.0.0.1")
    approx_location = Column(String(160), nullable=False, default="Local / Unknown")
    status = Column(String(32), nullable=False, default="active")  # active | revoked | expired
    login_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    last_active_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="sessions")


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    device_fingerprint = Column(String(128), nullable=False, index=True)
    device_name = Column(String(120), nullable=False)
    device_model = Column(String(120), nullable=False, default="Browser Client")
    os = Column(String(120), nullable=False)
    browser = Column(String(120), nullable=False)
    ip_address = Column(String(64), nullable=False)
    approx_location = Column(String(160), nullable=False, default="Not Available")
    # Strictly nullable: never fabricated when browser APIs cannot access hardware/SIM data
    battery_pct = Column(Integer, nullable=True)
    sim_operator = Column(String(80), nullable=True)
    phone_masked = Column(String(32), nullable=True)
    trust_status = Column(String(32), nullable=False, default="unverified")  # trusted | unverified | suspicious | blocked
    risk_score = Column(Float, nullable=False, default=15.0)
    unusual_tx_count = Column(Integer, nullable=False, default=0)
    failed_auth_count = Column(Integer, nullable=False, default=0)
    is_new_device = Column(Boolean, nullable=False, default=True)
    anomalies_json = Column(Text, nullable=False, default="[]")
    login_history_json = Column(Text, nullable=False, default="[]")
    last_active_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    user = relationship("User", back_populates="devices")


class Connector(Base):
    __tablename__ = "connectors"
    __table_args__ = (
        UniqueConstraint("user_id", "institution_code", name="uq_user_institution"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    institution_code = Column(String(64), nullable=False, index=True)
    institution_name = Column(String(120), nullable=False)
    category = Column(String(32), nullable=False)  # bank | mfs
    connection_status = Column(String(32), nullable=False, default="Not Connected")  # Connected | Not Connected | Synchronizing | Connection Error
    connection_method = Column(String(80), nullable=False, default="OAuth 2.0 / Statement Upload")
    is_sandbox = Column(Boolean, nullable=False, default=True)
    masked_account = Column(String(32), nullable=True)
    data_sources_json = Column(Text, nullable=False, default='["Transaction History", "Account Statements"]')
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    user = relationship("User", back_populates="connectors")


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        UniqueConstraint("user_id", "tx_ref", name="uq_user_tx_ref"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    connector_id = Column(Integer, ForeignKey("connectors.id", ondelete="SET NULL"), nullable=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    tx_ref = Column(String(80), nullable=False, index=True)
    tx_timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(12), nullable=False, default="BDT")
    tx_type = Column(String(48), nullable=False)  # Transfer | Payment | Cash Out | Deposit | Bill Pay
    sender_name = Column(String(120), nullable=False)
    recipient_name = Column(String(120), nullable=False)
    recipient_account_masked = Column(String(64), nullable=False)
    source_institution = Column(String(120), nullable=False)
    dest_institution = Column(String(120), nullable=True)
    status = Column(String(32), nullable=False, default="Completed")  # Completed | Failed | Flagged | Pending Review
    device_label = Column(String(120), nullable=False, default="Unknown Device")
    ip_address = Column(String(64), nullable=True)
    location_label = Column(String(160), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    risk_score = Column(Float, nullable=False, default=0.0)
    risk_level = Column(String(24), nullable=False, default="Low Risk")  # Low Risk | Medium Risk | High Risk
    is_demo_data = Column(Boolean, nullable=False, default=False)
    source_file_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    user = relationship("User", back_populates="transactions")
    assessment = relationship("RiskAssessment", back_populates="transaction", uselist=False, cascade="all, delete-orphan")


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id", ondelete="CASCADE"), unique=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    ip_address = Column(String(64), nullable=True)
    overall_score = Column(Float, nullable=False)
    risk_level = Column(String(24), nullable=False)
    ml_score = Column(Float, nullable=False)
    graph_score = Column(Float, nullable=False)
    rule_score = Column(Float, nullable=False)
    indicators_json = Column(Text, nullable=False, default="[]")
    feature_explanations_json = Column(Text, nullable=False, default="[]")
    recommended_action = Column(String(120), nullable=False)
    agent_rationale = Column(Text, nullable=False)
    human_decision = Column(String(48), nullable=True)  # Approved | Confirmed Fraud | Escalated
    reviewed_by = Column(String(120), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    transaction = relationship("Transaction", back_populates="assessment")


class IPIntelligence(Base):
    __tablename__ = "ip_intelligence"

    id = Column(Integer, primary_key=True, index=True)
    ip_address = Column(String(64), unique=True, nullable=False, index=True)
    risk_score = Column(Integer, nullable=False, default=0)
    risk_level = Column(String(24), nullable=False, default="Low Risk")
    country = Column(String(80), nullable=False)
    country_code = Column(String(8), nullable=False, default="UN")
    region = Column(String(80), nullable=False)
    city = Column(String(80), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    asn = Column(String(32), nullable=False)
    isp_org = Column(String(160), nullable=False)
    connection_type = Column(String(64), nullable=False)
    usage_type = Column(String(64), nullable=False)
    domain = Column(String(120), nullable=False)
    timezone = Column(String(64), nullable=False)
    local_time_label = Column(String(64), nullable=False)
    ip_age = Column(String(32), nullable=False)
    last_seen = Column(String(48), nullable=False, default="Just now")
    vpn_proxy = Column(Boolean, nullable=False, default=False)
    tor_node = Column(Boolean, nullable=False, default=False)
    hosting_dc = Column(Boolean, nullable=False, default=False)
    known_attacker = Column(Boolean, nullable=False, default=False)
    spam_source = Column(Boolean, nullable=False, default=False)
    abuse_confidence = Column(String(24), nullable=False, default="Low")  # Low | Medium | High
    anonymous_ip_severity = Column(String(24), nullable=False, default="Low")
    recent_abuse_severity = Column(String(24), nullable=False, default="Low")
    bot_activity_severity = Column(String(24), nullable=False, default="Low")
    unusual_traffic_severity = Column(String(24), nullable=False, default="Low")
    velocity_checks_severity = Column(String(24), nullable=False, default="Low")
    blacklist_status = Column(String(24), nullable=False, default="Clean")  # Clean | Listed
    recommendation_summary = Column(Text, nullable=False)
    recommended_action = Column(String(160), nullable=False)
    is_demo_data = Column(Boolean, nullable=False, default=True)
    checked_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class SecurityPolicy(Base):
    __tablename__ = "security_policies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    mfa_required = Column(Boolean, nullable=False, default=False)
    max_login_attempts = Column(Integer, nullable=False, default=5)
    lockout_minutes = Column(Integer, nullable=False, default=15)
    session_timeout_minutes = Column(Integer, nullable=False, default=30)
    login_alerts_enabled = Column(Boolean, nullable=False, default=True)
    new_device_alerts_enabled = Column(Boolean, nullable=False, default=True)
    high_risk_threshold = Column(Integer, nullable=False, default=70)
    csrf_protection_enabled = Column(Boolean, nullable=False, default=True)
    strict_owner_isolation = Column(Boolean, nullable=False, default=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="policy")


class SecurityAlert(Base):
    __tablename__ = "security_alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    severity = Column(String(24), nullable=False, default="medium")  # low | medium | high | critical
    title = Column(String(160), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(32), nullable=False, default="open")  # open | acknowledged | resolved
    is_demo_data = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_email = Column(String(255), nullable=False)
    action = Column(String(80), nullable=False, index=True)
    resource_type = Column(String(64), nullable=False)
    resource_id = Column(String(64), nullable=True)
    ip_address = Column(String(64), nullable=False, default="127.0.0.1")
    status = Column(String(24), nullable=False, default="success")
    details_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, index=True)


class ServiceHealth(Base):
    __tablename__ = "service_health"

    id = Column(Integer, primary_key=True, index=True)
    service_name = Column(String(64), unique=True, nullable=False, index=True)
    display_name = Column(String(120), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(32), nullable=False, default="Healthy")  # Healthy | Degraded | Offline
    latency_ms = Column(Integer, nullable=False, default=18)
    last_run_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    last_error = Column(Text, nullable=True)
    records_processed = Column(Integer, nullable=False, default=0)


class SignupEmailOTP(Base):
    __tablename__ = "signup_email_otps"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    otp_hash = Column(String(128), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    resend_available_at = Column(DateTime(timezone=True), nullable=False)
    attempts_count = Column(Integer, nullable=False, default=0)
    max_attempts = Column(Integer, nullable=False, default=5)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    user = relationship("User", back_populates="signup_otps")


class PasswordResetOTP(Base):
    __tablename__ = "password_reset_otps"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    otp_hash = Column(String(128), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    attempts_count = Column(Integer, nullable=False, default=0)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    user = relationship("User", back_populates="password_reset_otps")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(48), nullable=False, index=True)  # fraud_alert | critical_risk | new_device | connection | security_warning | tx_review
    severity = Column(String(24), nullable=False, default="info")  # info | warning | high | critical
    title = Column(String(160), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, index=True)

    user = relationship("User", back_populates="notifications")


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    fraud_alerts = Column(Boolean, nullable=False, default=True)
    critical_risk = Column(Boolean, nullable=False, default=True)
    new_device_login = Column(Boolean, nullable=False, default=True)
    account_connections = Column(Boolean, nullable=False, default=True)
    suspicious_login = Column(Boolean, nullable=False, default=True)
    tx_review = Column(Boolean, nullable=False, default=True)
    email_notifications = Column(Boolean, nullable=False, default=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="notification_pref")
