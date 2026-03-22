# web/utils/upload_validation.py — проверка загружаемых файлов (MIME, размер, magic bytes)
"""Валидация загрузок: whitelist MIME, лимит 10MB, проверка magic bytes (не только Content-Type)."""

import io
from typing import Optional, Tuple

# Разрешённые MIME и соответствующие magic bytes (начало файла)
ALLOWED_UPLOAD_MIME = frozenset({"image/jpeg", "image/png", "application/pdf"})
MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

_MAGIC: list[Tuple[bytes, str]] = [
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"%PDF", "application/pdf"),
]


def get_mime_by_magic(content: bytes) -> Optional[str]:
    """Определяет MIME по magic bytes. Возвращает None если не совпадает с whitelist."""
    for magic, mime in _MAGIC:
        if content.startswith(magic):
            return mime
    return None


def validate_upload(
    content: bytes,
    content_type: Optional[str] = None,
    allowed_mimes: Optional[frozenset] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Проверяет контент файла: размер <= 10MB, MIME в whitelist, magic bytes соответствуют.
    allowed_mimes: если задано, только эти MIME разрешены; иначе ALLOWED_UPLOAD_MIME.
    Возвращает (True, None) при успехе, (False, "причина") при ошибке.
    """
    allowed = allowed_mimes or ALLOWED_UPLOAD_MIME
    if len(content) > MAX_UPLOAD_SIZE_BYTES:
        return False, "file_too_large"
    if not content:
        return False, "empty_file"
    detected_mime = get_mime_by_magic(content)
    if not detected_mime or detected_mime not in allowed:
        return False, "invalid_type"
    if content_type and content_type.lower().strip() not in allowed:
        return False, "invalid_type"
    if content_type and detected_mime and content_type.lower().strip() != detected_mime:
        return False, "invalid_type"
    return True, None


# Только изображения для тикетов поддержки
SUPPORT_IMAGE_MIMES = frozenset({"image/jpeg", "image/png"})
