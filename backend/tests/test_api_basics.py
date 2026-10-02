"""Проверка каркаса API: health, формат ошибок, русские буквы."""


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.get_json()
    assert body["error"] is None
    assert body["data"]["status"] == "ok"
    assert body["data"]["database"] == "ok"


def test_unknown_address_returns_json_404(client):
    response = client.get("/api/no-such-page")
    assert response.status_code == 404
    body = response.get_json()
    assert body["data"] is None
    assert body["error"]["code"] == "not_found"
    assert body["error"]["message"] == "Не найдено"


def test_wrong_method_returns_json_405(client):
    response = client.post("/health")
    assert response.status_code == 405
    assert response.get_json()["error"]["code"] == "method_not_allowed"


def test_russian_letters_not_escaped(app):
    from app.api.responses import ok
    with app.test_request_context():
        response, _ = ok({"name": "Авача"})
        assert "Авача" in response.get_data(as_text=True)
