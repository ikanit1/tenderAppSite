# web/utils/datetime_helpers.py — shared datetime utilities
from datetime import datetime, timezone


def dt_or_min(dt: datetime | None) -> datetime:
    """Return datetime or datetime.min with UTC timezone."""
    if dt is None:
        return datetime.min.replace(tzinfo=timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def parse_since(value: str | None) -> datetime | None:
    """Parse an ISO 8601 datetime string, return None on failure."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None
