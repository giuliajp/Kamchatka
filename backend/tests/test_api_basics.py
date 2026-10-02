"""Проверка каркаса API: health, формат ошибок, документация."""


async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["error"] is None
    assert body["data"]["status"] == "ok"
    assert body["data"]["database"] == "ok"


async def test_unknown_address_returns_json_404(client):
    response = await client.get("/api/no-such-page")
    assert response.status_code == 404
    body = response.json()
    assert body["data"] is None
    assert body["error"]["code"] == "not_found"
    assert body["error"]["message"] == "Не найдено"


async def test_wrong_method_returns_json_405(client):
    response = await client.post("/health")
    assert response.status_code == 405
    assert response.json()["error"]["code"] == "method_not_allowed"


async def test_docs_available(client):
    response = await client.get("/openapi.json")
    assert response.status_code == 200
    assert "/health" in response.json()["paths"]


async def test_russian_letters_in_response(client):
    response = await client.get("/api/no-such-page")
    assert "Не найдено" in response.text  # без \u041d...
