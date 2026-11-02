"""
Проверка параметров запуска VK Mini App: кто открыл приложение.

VK добавляет к адресу мини-приложения параметры vk_user_id, vk_app_id, vk_ts и т. п.
и подпись sign. Фронтенд передаёт строку параметров как есть в заголовке
X-VK-Launch-Params (window.location.search без «?» или с ним).

Подпись по документации VK: берём параметры, начинающиеся с «vk_», сортируем по имени,
собираем строку запроса, считаем HMAC-SHA256 с «Защищённым ключом» приложения,
кодируем в base64 (url-safe, без «=» в конце). Совпало с sign — параметрам можно верить.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
from urllib.parse import parse_qsl, urlencode


def launch_params_user(raw: str, secret: str, app_id: str = "") -> int | None:
    """vk_user_id, если подпись верна; иначе None."""
    if not raw or not secret:
        return None
    params = dict(parse_qsl(raw.lstrip("?"), keep_blank_values=True))
    sign = params.get("sign")
    if not sign:
        return None
    vk_params = sorted((k, v) for k, v in params.items() if k.startswith("vk_"))
    digest = hmac.new(secret.encode(), urlencode(vk_params, doseq=True).encode(), hashlib.sha256).digest()
    expected = base64.urlsafe_b64encode(digest).decode().rstrip("=")
    if not hmac.compare_digest(expected, sign):
        return None
    if app_id and params.get("vk_app_id") != str(app_id):
        return None
    try:
        user_id = int(params.get("vk_user_id", ""))
    except ValueError:
        return None
    return user_id if user_id > 0 else None


def sign_launch_params(params: dict[str, str], secret: str) -> str:
    """Подписать параметры так же, как VK. Нужно для тестов и локальной отладки."""
    vk_params = sorted((k, v) for k, v in params.items() if k.startswith("vk_"))
    digest = hmac.new(secret.encode(), urlencode(vk_params).encode(), hashlib.sha256).digest()
    sign = base64.urlsafe_b64encode(digest).decode().rstrip("=")
    return urlencode({**params, "sign": sign})
