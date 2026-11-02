"""
Вход организаторов (задача 3.2).

- Пароль: scrypt из стандартной библиотеки Python, у каждого пароля своя «соль».
- Токен: «данные.подпись». Данные — id организатора и срок действия, подпись — HMAC-SHA256
  с SECRET_KEY. Подделать токен без SECRET_KEY нельзя. Токен передаётся в заголовке
  Authorization: Bearer <токен>. При каждом запросе проверяем, что организатор ещё активен.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone

from app.config import get_settings

_SCRYPT = {"n": 2**14, "r": 8, "p": 1}
DEFAULT_SECRET = "dev-secret-change-me"


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return f"scrypt${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        actual = hashlib.scrypt(password.encode(), salt=_unb64(salt), **_SCRYPT)
        return hmac.compare_digest(actual, _unb64(digest))
    except (ValueError, TypeError):
        return False


def _secret() -> bytes:
    settings = get_settings()
    if settings.is_production and settings.secret_key == DEFAULT_SECRET:
        raise RuntimeError("В production задайте SECRET_KEY в backend/.env")
    return settings.secret_key.encode()


def _sign(payload: str) -> str:
    return _b64(hmac.new(_secret(), payload.encode(), hashlib.sha256).digest())


def issue_token(admin_id: int, now: datetime | None = None) -> tuple[str, datetime]:
    """Новый токен и время, до которого он действует."""
    now = now or datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=get_settings().admin_token_ttl_hours)
    payload = _b64(json.dumps({"uid": admin_id, "exp": int(expires_at.timestamp())}).encode())
    return f"{payload}.{_sign(payload)}", expires_at


def read_token(token: str, now: datetime | None = None) -> int | None:
    """id организатора из токена; None — токен поддельный, испорчен или истёк."""
    try:
        payload, signature = token.split(".")
    except ValueError:
        return None
    if not hmac.compare_digest(_sign(payload), signature):
        return None
    try:
        data = json.loads(_unb64(payload))
        admin_id, expires = int(data["uid"]), int(data["exp"])
    except (ValueError, KeyError, TypeError):
        return None
    now = now or datetime.now(timezone.utc)
    return admin_id if now.timestamp() < expires else None
