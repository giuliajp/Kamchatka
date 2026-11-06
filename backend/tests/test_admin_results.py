"""Админка: загрузка CSV судей (3.4), правка, публикация, утверждение, штрафы, журнал (3.3)."""

import httpx
import pytest

from app.config import get_settings
from app.models import (
    AdminUser, Discipline, Equipment, Participant, Race, RaceParticipant, Stage, SupportSubscription,
)
from app.services import vk_api
from app.services.admin_auth import hash_password, issue_token

# Лист судей как в 2026 году: блоки по дисциплинам, шапка в две строки, лишние колонки.
JUDGES_CSV = """\
Протокол результатов;;;;;;;;;;;;
Дисциплина;;Лыжи длинная дистанция 2 собаки;;;;;;;;;;
№ п.п.;Стартовый номер;ФИО;Год рождения;Субъект РФ;Этап 1 длина 33,7 км;;Этап 2 длина 56 км;;Средняя скорость;Общий результат;Место;Примечания
;;;;;Результат;Скорость;Результат;Скорость;;;;
1;4;Филимонова Алиса Александровна;1997;Камчатский край;02:39:55;12,6;04:16:10;13,1;12,8;06:56:05;1;
2;1;Хухлаева Алина Михайловна;1998;Магаданская область;DNF;#ЗНАЧ!;;#ДЕЛ/0!;#ЗНАЧ!;DNF;;
Дисциплина;;Нарта-длинная дистанция более 8 собак;;;;;;;;;;
№ п.п.;Стартовый номер;ФИО;Год рождения;Субъект РФ;Этап 1 длина 33,7 км;;Этап 2 длина 56 км;;Средняя скорость;Общий результат;Место;Примечания
;;;;;Результат;Скорость;Результат;Скорость;;;;
1;18;Шевчук Георгий Геннадьевич;1993;Камчатский край;02:10:02;15,5;03:42:14;15,1;15,3;05:52:16;1;штр.вр. 2 мин. п.П.14.11.14
2;13;Попов Алексей Викторович;1972;Камчатский край;02:22:49;14,2;;;;;;
"""


@pytest.fixture
async def setup(session):
    race = Race(name="Авача 2027", year=2027, is_current=True)
    ski = Discipline(code="ski_2", name="Лыжи — длинная дистанция, 2 собаки", equipment=Equipment.SKI,
                     dogs_min=2, dogs_max=2, sort_order=1)
    big = Discipline(code="sled_8plus", name="Нарта — длинная дистанция, более 8 собак",
                     equipment=Equipment.SLED, dogs_min=9, sort_order=3)
    s1, s2 = Stage(race=race, number=1, distance_km=33.7), Stage(race=race, number=2, distance_km=56)
    admin = AdminUser(login="judge", full_name="Главный секретарь", password_hash=hash_password("пароль-123456"))
    # №13 уже заявлен через админку — импорт должен его найти, а не создать заново.
    popov = RaceParticipant(race=race, discipline=big, start_number=13, region="Камчатский край",
                            participant=Participant(last_name="Попов", first_name="Алексей", birth_year=1972))
    session.add_all([race, ski, big, s1, s2, admin, popov])
    await session.commit()
    token, _ = issue_token(admin.id)
    return {"race": race, "s1": s1, "s2": s2, "popov": popov, "auth": {"Authorization": f"Bearer {token}"}}


async def upload(client, setup, text: str, *, dry_run=False, encoding="utf-8", name="avacha.csv"):
    return await client.post(
        f"/api/admin/races/{setup['race'].id}/protocol-import", headers=setup["auth"],
        files={"file": (name, text.encode(encoding), "text/csv")}, data={"dry_run": str(dry_run).lower()})


async def protocols(client, setup):
    return (await client.get(f"/api/admin/races/{setup['race'].id}/protocols", headers=setup["auth"])).json()["data"]


async def test_import_judges_sheet(client, setup):
    response = await upload(client, setup, JUDGES_CSV, encoding="cp1251")
    assert response.status_code == 200, response.text
    report = response.json()["data"]
    assert report["saved"] is True
    assert (report["rows"], report["participants_created"], report["results_created"]) == (4, 3, 6)
    assert report["penalties_changed"] == 1 and report["protocols_created"] == 4

    items = await protocols(client, setup)
    assert {(p["stage"]["number"], p["discipline"]["code"], p["results_count"]) for p in items} == {
        (1, "ski_2", 2), (2, "ski_2", 1), (1, "sled_8plus", 2), (2, "sled_8plus", 1)}
    assert all(p["published_at"] is None for p in items)            # черновики

    # Черновики в приложении не видны.
    public = await client.get(f"/api/races/{setup['race'].id}/results")
    assert all(not d["stages"] for d in public.json()["data"]["disciplines"])

    penalties = (await client.get(f"/api/admin/race-participants/{setup['popov'].id}/penalties",
                                  headers=setup["auth"])).json()["data"]
    assert penalties == []


async def test_dry_run_saves_nothing(client, setup):
    report = (await upload(client, setup, JUDGES_CSV, dry_run=True)).json()["data"]
    assert report["saved"] is False and report["results_created"] == 6
    assert await protocols(client, setup) == []


async def test_errors_listed_and_nothing_saved(client, setup):
    bad = JUDGES_CSV.replace("02:10:02", "2 часа").replace(";13;Попов Алексей", ";13;Петров Иван")
    response = await upload(client, setup, bad)
    assert response.status_code == 422
    error = response.json()["error"]
    assert "Ничего не сохранено" in error["message"]
    assert any("№18" in d and "ЧЧ:ММ:СС" in d for d in error["details"])
    assert any("№13" in d and "Попов" in d for d in error["details"])
    assert await protocols(client, setup) == []


async def test_missing_stage_and_unknown_discipline(client, setup):
    text = "Стартовый номер;ФИО;Дисциплина;Этап 3\n5;Иванов Иван;Нарта более 8;01:00:00\n6;Петров Пётр;Байдарка;01:00:00\n"
    details = (await upload(client, setup, text)).json()["error"]["details"]
    assert any("этап 3 не создан" in d for d in details)
    assert any("дисциплина" in d for d in details)


async def test_reimport_updates_with_log_after_publish(client, setup):
    await upload(client, setup, JUDGES_CSV)
    ski_stage1 = next(p for p in await protocols(client, setup)
                      if p["stage"]["number"] == 1 and p["discipline"]["code"] == "ski_2")
    published = await client.post(f"/api/admin/protocols/{ski_stage1['id']}/publish", headers=setup["auth"])
    assert published.status_code == 200

    # Повтор того же файла ничего не меняет.
    again = (await upload(client, setup, JUDGES_CSV)).json()["data"]
    assert again["results_updated"] == 0 and again["results_unchanged"] == 6

    fixed = JUDGES_CSV.replace("02:39:55", "02:39:50")
    report = (await upload(client, setup, fixed, name="avacha-v2.csv")).json()["data"]
    assert report["results_updated"] == 1
    assert any("уже опубликован" in w for w in report["warnings"])
    changes = (await client.get(f"/api/admin/protocols/{ski_stage1['id']}/changes",
                                headers=setup["auth"])).json()["data"]
    time_change = next(c for c in changes if c["field"] == "final_time_seconds")
    assert (time_change["old_value"], time_change["new_value"]) == ("9595", "9590")
    assert time_change["reason"] == "Импорт avacha-v2.csv"


async def test_flat_template_with_dogs_and_penalty_columns(client, setup):
    text = ("Дисциплина;Стартовый номер;ФИО;Год рождения;Регион;Этап 1;Собак на старте 1;Собак на финише 1;Штраф;Пункт\n"
            "Нарта — длинная дистанция, более 8 собак;13;Попов Алексей;1972;Камчатский край;02:22:49;10;9;00:03:00;П.14.11.10\n")
    report = (await upload(client, setup, text)).json()["data"]
    assert report["participants_created"] == 0 and report["results_created"] == 1
    item = next(p for p in await protocols(client, setup) if p["discipline"]["code"] == "sled_8plus")
    row = (await client.get(f"/api/admin/protocols/{item['id']}", headers=setup["auth"])).json()["data"]["results"][0]
    assert (row["dogs_at_start"], row["dogs_at_finish"], row["time"]) == (10, 9, "02:22:49")
    penalties = (await client.get(f"/api/admin/race-participants/{setup['popov'].id}/penalties",
                                  headers=setup["auth"])).json()["data"]
    assert [(p["seconds"], p["rule_reference"]) for p in penalties] == [(180, "П.14.11.10")]


async def test_entry_status_follows_protocol(client, session, setup):
    await upload(client, setup, JUDGES_CSV)
    entries = (await client.get(f"/api/admin/races/{setup['race'].id}/participants",
                                headers=setup["auth"])).json()["data"]
    status = {e["start_number"]: e["status"] for e in entries}
    assert status == {1: "dnf", 4: "finished", 13: "active", 18: "finished"}


# ── Правка, публикация, утверждение ────────────────────────────────────

@pytest.fixture
def vk_calls(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        form = dict(httpx.QueryParams(request.content.decode()))
        calls.append((request.url.path.rsplit("/", 1)[-1], form))
        ids = form.get("user_ids", "").split(",")
        return httpx.Response(200, json={"response": [{"user_id": int(i), "status": True} for i in ids if i]})

    monkeypatch.setattr(vk_api, "transport", httpx.MockTransport(handler))
    monkeypatch.setattr(get_settings(), "vk_service_token", "service-token")
    return calls


async def test_edit_publish_finalize_correct(client, session, setup, vk_calls):
    await upload(client, setup, JUDGES_CSV)
    session.add(SupportSubscription(vk_user_id=501, race_participant_id=setup["popov"].id))
    await session.commit()
    big1 = next(p for p in await protocols(client, setup)
                if p["stage"]["number"] == 1 and p["discipline"]["code"] == "sled_8plus")
    auth = setup["auth"]
    detail = (await client.get(f"/api/admin/protocols/{big1['id']}", headers=auth)).json()["data"]
    popov_row = next(r for r in detail["results"] if r["start_number"] == 13)

    edited = await client.patch(f"/api/admin/stage-results/{popov_row['id']}", headers=auth,
                                json={"time": "02:22:40", "dogs_at_start": 12, "reason": "Сверка с судьёй КП"})
    assert edited.status_code == 200 and edited.json()["data"]["time"] == "02:22:40"
    bad = await client.patch(f"/api/admin/stage-results/{popov_row['id']}", headers=auth,
                             json={"status": "dnf", "time": "01:00:00"})
    assert bad.status_code == 422

    assert (await client.post(f"/api/admin/protocols/{big1['id']}/finalize", headers=auth)).status_code == 422
    published = await client.post(f"/api/admin/protocols/{big1['id']}/publish", headers=auth)
    assert published.status_code == 200
    assert (await client.post(f"/api/admin/protocols/{big1['id']}/publish", headers=auth)).status_code == 409
    sent = [form for method, form in vk_calls if method == "notifications.sendMessage"]
    assert any(form["user_ids"] == "501" and "протокол судей опубликован" in form["message"] for form in sent)

    public = (await client.get(f"/api/races/{setup['race'].id}/results?discipline=sled_8plus")).json()["data"]
    assert public["disciplines"][0]["stages"]

    finalized = await client.post(f"/api/admin/protocols/{big1['id']}/finalize", headers=auth)
    assert finalized.json()["data"]["status"] == "final"
    locked = await client.patch(f"/api/admin/stage-results/{popov_row['id']}", headers=auth, json={"time": "02:00:00"})
    assert locked.status_code == 409
    no_basis = await client.post(f"/api/admin/stage-results/{popov_row['id']}/post-final-correction",
                                 headers=auth, json={"time": "02:22:41"})
    assert no_basis.status_code == 422
    corrected = await client.post(f"/api/admin/stage-results/{popov_row['id']}/post-final-correction",
                                  headers=auth, json={"time": "02:22:41", "reason": "Решение ГСК №3",
                                                      "approved_by": "Главный судья Отбеткин П. В."})
    assert corrected.json()["data"]["is_corrected_after_final"] is True
    final_change = (await client.get(f"/api/admin/protocols/{big1['id']}/changes", headers=auth)).json()["data"][0]
    assert final_change["is_post_final"] is True and final_change["approved_by"].startswith("Главный судья")

    # Файл не может переписать утверждённый протокол.
    blocked = await upload(client, setup, JUDGES_CSV)
    assert blocked.status_code == 422
    assert any("утверждён" in d for d in blocked.json()["error"]["details"])


async def test_add_and_delete_rows_and_penalties(client, session, setup):
    await upload(client, setup, JUDGES_CSV)
    auth = setup["auth"]
    big2 = next(p for p in await protocols(client, setup)
                if p["stage"]["number"] == 2 and p["discipline"]["code"] == "sled_8plus")
    detail = (await client.get(f"/api/admin/protocols/{big2['id']}", headers=auth)).json()["data"]
    assert [m["start_number"] for m in detail["without_result"]] == [13]
    created = await client.post(f"/api/admin/protocols/{big2['id']}/results", headers=auth,
                                json={"race_participant_id": setup["popov"].id, "status": "dns"})
    assert created.status_code == 201
    duplicate = await client.post(f"/api/admin/protocols/{big2['id']}/results", headers=auth,
                                  json={"race_participant_id": setup["popov"].id, "status": "dns"})
    assert duplicate.status_code == 409
    row_id = created.json()["data"]["id"]
    assert (await client.delete(f"/api/admin/stage-results/{row_id}", headers=auth)).status_code == 422
    assert (await client.delete(f"/api/admin/stage-results/{row_id}?reason=Ошибка ввода",
                                headers=auth)).status_code == 200

    penalty = await client.post(f"/api/admin/race-participants/{setup['popov'].id}/penalties", headers=auth,
                                json={"time": "00:05:00", "rule_reference": "П.14.11.1", "reason": "Помеха"})
    assert penalty.json()["data"]["seconds"] == 300
    removed = await client.delete(f"/api/admin/penalties/{penalty.json()['data']['id']}?reason=Отменено ГСК",
                                  headers=auth)
    assert removed.status_code == 200
    log = (await client.get(f"/api/admin/races/{setup['race'].id}/changes", headers=auth)).json()["data"]
    assert [c["entity"] for c in log[:4]] == ["penalty", "penalty", "stage_result", "stage_result"]


async def test_penalty_without_time(client, setup):
    auth, entry = setup["auth"], setup["popov"].id
    text = ("Дисциплина;Стартовый номер;ФИО;Этап 1;Примечания\n"
            "Нарта — длинная дистанция, более 8 собак;13;Попов Алексей;02:22:49;Штраф: предупреждение\n")
    report = (await upload(client, setup, text)).json()["data"]
    assert report["penalties_changed"] == 1
    created = await client.post(f"/api/admin/race-participants/{entry}/penalties", headers=auth,
                                json={"reason": "Предупреждение за помеху", "time": "00:00:00"})
    assert created.status_code == 201 and created.json()["data"]["seconds"] == 0
    penalties = (await client.get(f"/api/admin/race-participants/{entry}/penalties", headers=auth)).json()["data"]
    assert [(p["seconds"], p["reason"]) for p in penalties] == [
        (0, "Штраф: предупреждение"), (0, "Предупреждение за помеху")]
