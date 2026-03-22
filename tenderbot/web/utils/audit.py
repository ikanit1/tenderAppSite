# web/utils/audit.py — audit logging for admin actions
import json
import logging
from typing import Optional

from sqlalchemy.orm import Session

from database.models import AuditLog

logger = logging.getLogger(__name__)


def log_action(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    admin_user: str = "admin",
    details: Optional[dict] = None,
) -> None:
    """Record an admin action in the audit log."""
    try:
        entry = AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            admin_user=admin_user,
            details=json.dumps(details, ensure_ascii=False) if details else None,
        )
        db.add(entry)
        # Don't commit here — let the caller's transaction handle it
        logger.info(f"Audit: {action} on {entity_type}#{entity_id} by {admin_user}")
    except Exception as e:
        logger.error(f"Failed to log audit action: {e}")
