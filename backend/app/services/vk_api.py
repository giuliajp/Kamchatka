"""
Запросы к API ВКонтакте с сервисным ключом мини-приложения (VK_SERVICE_TOKEN).

- notifications.sendMessage — push-уведомления пользователям, разрешившим их в приложении.
  За один вызов — до 100 получателей, текст до 254 символов.
- wall.get / photos.get — новости и фото сообщества гонки (публичные данные).

Для тестов транспорт подменяется: vk_api.transport = httpx.MockTransport(...).
"""

from __future__ import annotations

from typing import Any

import httpx

from app.config import get_settings

MAX_RECIPIENTS = 100
MAX_MESSAGE = 254

transport: httpx.AsyncBaseTransport | None = None   # подмена в тестах


class VkApiError(RuntimeError):
    pass


def is_configured() -> bool:
    return bool(get_settings().vk_service_token)


async def call(method: str, **params: Any) -> Any:
    settings = get_settings()
    if not settings.vk_service_token:
        raise VkApiError("Не задан VK_SERVICE_TOKEN в backend/.env")
    data = {k: v for k, v in params.items() if v is not None}
    data.update(access_token=settings.vk_service_token, v=settings.vk_api_version)
    try:
        async with httpx.AsyncClient(transport=transport, timeout=15) as client:
            response = await client.post(f"{settings.vk_api_url}/{method}", data=data)
            response.raise_for_status()
            body = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise VkApiError(f"VK недоступен: {error}") from error
    if "error" in body:
        error = body["error"]
        raise VkApiError(f"VK {method}: {error.get('error_code')} {error.get('error_msg')}")
    return body.get("response")


async def send_notification(user_ids: list[int], message: str, fragment: str | None = None) -> int:
    """Отправить уведомление. Возвращает, скольким пользователям VK его принял."""
    delivered = 0
    unique = list(dict.fromkeys(user_ids))
    for start in range(0, len(unique), MAX_RECIPIENTS):
        batch = unique[start:start + MAX_RECIPIENTS]
        result = await call("notifications.sendMessage", user_ids=",".join(map(str, batch)),
                            message=message[:MAX_MESSAGE], fragment=fragment)
        delivered += sum(1 for item in result or [] if item.get("status"))
    return delivered
