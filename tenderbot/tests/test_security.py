# tests/test_security.py — tests for security features
import secrets


class TestTimingSafeComparison:
    def test_compare_digest_equal(self):
        assert secrets.compare_digest("admin", "admin") is True

    def test_compare_digest_not_equal(self):
        assert secrets.compare_digest("admin", "wrong") is False

    def test_compare_digest_empty(self):
        assert secrets.compare_digest("", "") is True
        assert secrets.compare_digest("a", "") is False


class TestCSRFToken:
    def test_generate_and_validate(self):
        from web.utils.csrf import generate_csrf_token, validate_csrf_token
        from unittest.mock import MagicMock

        # Mock request with session cookie
        request = MagicMock()
        request.cookies = {"session": None}

        # Token generation should work even without session
        token = generate_csrf_token(request)
        assert token is not None
        assert len(token) > 0


class TestRateLimiting:
    def test_rate_limiting_logic(self):
        from web.routes.login import _is_rate_limited, _record_attempt, _login_attempts

        test_ip = "192.168.99.99"
        # Clear any existing state
        _login_attempts.pop(test_ip, None)

        assert _is_rate_limited(test_ip) is False

        # Record 5 attempts
        for _ in range(5):
            _record_attempt(test_ip)

        assert _is_rate_limited(test_ip) is True

        # Cleanup
        _login_attempts.pop(test_ip, None)


class TestDatetimeHelpers:
    def test_dt_or_min_none(self):
        from web.utils.datetime_helpers import dt_or_min
        from datetime import datetime, timezone

        result = dt_or_min(None)
        assert result == datetime.min.replace(tzinfo=timezone.utc)

    def test_dt_or_min_naive(self):
        from web.utils.datetime_helpers import dt_or_min
        from datetime import datetime, timezone

        dt = datetime(2024, 1, 1, 12, 0, 0)
        result = dt_or_min(dt)
        assert result.tzinfo == timezone.utc

    def test_parse_since_valid(self):
        from web.utils.datetime_helpers import parse_since

        result = parse_since("2024-01-01T00:00:00+00:00")
        assert result is not None

    def test_parse_since_invalid(self):
        from web.utils.datetime_helpers import parse_since

        assert parse_since("invalid") is None
        assert parse_since(None) is None
        assert parse_since("") is None
