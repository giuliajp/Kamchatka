"""Local contract smoke test. Requires the dedicated avacha_ui_tests database and port 8012.

Creates isolated test seasons through the unchanged backend API. Never use a production URL.
Fixture snapshots contain only the artificial test participants below, not credentials.
"""
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
from urllib.parse import urlencode
import httpx

ROOT = Path(__file__).resolve().parents[1]
client = httpx.Client(base_url="http://127.0.0.1:8012/api", timeout=20)
fixtures = {}
checks = []


def call(method, path, expected=200, capture=False, **kwargs):
    response = client.request(method, path, **kwargs)
    assert response.status_code == expected, (method, path, response.status_code, response.text)
    checks.append(f"{method} {path}: {expected}")
    body = response.json()
    if expected >= 400:
        assert body["error"]["message"]
        return body["error"]
    assert body["error"] is None
    if capture:
        fixtures[path] = body["data"]
    return body["data"]


login = call("POST", "/admin/login", json={"login": "ui-test", "password": os.environ["AVACHA_TEST_PASSWORD"]})
client.headers["Authorization"] = f"Bearer {login['token']}"
call("GET", "/admin/me", capture=True)
assert not call("GET", "/admin/races"), "Smoke test needs an empty dedicated database; it does not reset existing data."
race = call("POST", "/admin/races", 201, json={"name":"Авача · тестовый сезон", "year":2026,"location":"Камчатка"})
rid = race["id"]
call("PATCH", f"/admin/races/{rid}", json={"is_current":True,"status":"live"})
call("POST", "/admin/races", 201, json={"name":"Авача · архивный тест", "year":2025})
disciplines = call("GET", "/admin/disciplines", capture=True)
discipline = next(d for d in disciplines if d["code"] == "sled_8")
stage = call("POST", f"/admin/races/{rid}/stages", 201, json={"number":1,"name":"Тест маршрута","distance_km":40,"start_at":"2026-11-03T09:00:00+12:00","description":"Тестовые данные для проверки интерфейсов."})
sid = stage["id"]
call("PATCH", f"/admin/stages/{sid}", json={"status":"live"})
route = b'<?xml version="1.0"?><gpx version="1.1" creator="ui-test"><trk><trkseg><trkpt lat="53.1" lon="158.4"><ele>100</ele></trkpt><trkpt lat="53.2" lon="158.5"><ele>300</ele></trkpt><trkpt lat="53.3" lon="158.6"><ele>180</ele></trkpt></trkseg></trk></gpx>'
call("PUT",f"/admin/stages/{sid}/route",files={"file":("test.gpx",route,"application/gpx+xml")})
checkpoint = call("POST","/admin/checkpoints",201,json={"name":"Тестовый КП","latitude":53.2,"longitude":158.5})
cp = call("POST",f"/admin/stages/{sid}/checkpoints",201,json={"checkpoint_id":checkpoint["id"],"order_index":1,"label":"КП-1","required_rest_minutes":30,"km_from_start":20})
entries=[]
for number, surname, given in [(14,"Тестова","Алиса"),(22,"Примеров","Иван"),(31,"Проверкина","Анна")]:
    entries.append(call("POST",f"/admin/races/{rid}/participants",201,json={"last_name":surname,"first_name":given,"birth_year":1990,"start_number":number,"discipline_id":discipline["id"],"region":"Камчатский край","dogs_count":8,"bio":"Тестовая карточка участника."}))
eid=entries[0]["id"]
call("POST", "/admin/checkpoint-passes",201,json={"race_participant_id":eid,"stage_checkpoint_id":cp["id"],"arrived_at":"2026-11-03T12:00:00+12:00","departed_at":"2026-11-03T12:30:00+12:00","note":"Проверка ввода по Камчатке"})
tracker=call("POST","/admin/trackers",201,json={"imei":"123456789012345","name":"Тестовый трекер"})
call("POST",f"/admin/trackers/{tracker['id']}/assign",json={"race_participant_id":eid,"stage_id":sid})
call("POST","/admin/trackers/poll",503)
# Sign a local fake VK launch, with the raw leading question mark preserved.
params={"vk_app_id":"12345","vk_user_id":"42","vk_are_notifications_enabled":"0"}
sign=base64.urlsafe_b64encode(hmac.new(b"local-vk-signing-fixture",urlencode(sorted(params.items())).encode(),hashlib.sha256).digest()).decode().rstrip("=")
client.headers["X-VK-Launch-Params"]="?"+urlencode(params)+"&sign="+sign
call("POST","/me/visit",capture=True)
call("PUT",f"/race-participants/{eid}/support",capture=True)
call("GET","/me/supports",capture=True)
call("PUT","/me/notifications",json={"allowed":True},capture=True)
call("PATCH",f"/me/supports/{eid}",json={"notifications_enabled":False})
call("PUT","/me/bookmarks",json={"kind":"news","item_id":"-1_1","title":"Тестовая новость","url":"https://vk.com/wall-1_1","image_url":None})
call("GET","/me/bookmarks",capture=True)
call("GET","/news",503); call("GET","/photos",503)
call("POST","/admin/push",json={"message":"Тест локального журнала, интеграция VK отключена","fragment":"results"})
csv = "Дисциплина;Стартовый номер;ФИО;Субъект РФ;Этап 1;Место;Собак на старте 1;Собак на финише 1\nНарта длинная дистанция 8 собак;14;Тестова Алиса;Камчатский край;27:01:02;1;8;7\n"
files={"file":("protocol.csv",csv.encode(),"text/csv")}
report=call("POST",f"/admin/races/{rid}/protocol-import",files=files,data={"dry_run":"true"})
assert not report["saved"] and not call("GET",f"/admin/races/{rid}/protocols")
call("POST",f"/admin/races/{rid}/protocol-import",files={"file":("bad.csv",csv.replace("27:01:02","не время").encode(),"text/csv")},data={"dry_run":"true"},expected=422)
call("POST",f"/admin/races/{rid}/protocol-import",files=files,data={"dry_run":"false"})
protocol=call("GET",f"/admin/races/{rid}/protocols")[0]; pid=protocol["id"]
fixtures["state:draft"]=protocol
call("POST",f"/admin/protocols/{pid}/finalize",422)
call("POST",f"/admin/protocols/{pid}/publish")
call("POST",f"/admin/protocols/{pid}/publish",409)
fixtures["state:published"]=call("GET",f"/admin/protocols/{pid}")
call("POST",f"/admin/protocols/{pid}/finalize")
result=call("GET",f"/admin/protocols/{pid}")["results"][0]
assert result["time"]=="27:01:02"
call("PATCH",f"/admin/stage-results/{result['id']}",409,json={"time":"27:02:02"})
call("POST",f"/admin/stage-results/{result['id']}/post-final-correction",json={"time":"27:02:02","reason":"Тест исправления","approved_by":"Тестовый судья"})
call("POST",f"/admin/race-participants/{eid}/penalties",201,json={"time":"00:02:00","rule_reference":"Тест","reason":"Тестовое нарушение","change_reason":"Проверка журнала"})
paths=["/admin/races",f"/admin/races/{rid}/stages","/admin/checkpoints",f"/admin/stages/{sid}/checkpoints",f"/admin/races/{rid}/participants","/admin/participants?q=Тест","/admin/trackers",f"/admin/stages/{sid}/monitoring",f"/admin/stages/{sid}/checkpoint-passes/log",f"/admin/races/{rid}/alerts?active=false",f"/admin/races/{rid}/protocols",f"/admin/protocols/{pid}",f"/admin/protocols/{pid}/changes",f"/admin/races/{rid}/changes",f"/admin/race-participants/{eid}/penalties","/admin/push","/races","/races/current",f"/races/{rid}",f"/stages/{sid}",f"/races/{rid}/participants",f"/participants/{entries[0]['participant']['id']}",f"/races/{rid}/positions",f"/races/{rid}/results",f"/stages/{sid}/protocols",f"/races/{rid}/support-rating",f"/race-participants/{eid}/support",f"/race-participants/{eid}/checkpoint-passes",f"/race-participants/{eid}/track",f"/program?race_id={rid}",f"/locations?race_id={rid}","/faq","/contacts"]
for path in paths: call("GET",path,capture=True)
response=client.get(f"/admin/races/{rid}/support-stats.csv?days=2");assert response.status_code==200 and "text/csv" in response.headers["content-type"]
client.headers["Authorization"]="Bearer invalid"
call("GET","/admin/me",401)
client.headers["X-VK-Launch-Params"]="?vk_user_id=999&sign=invalid"
call("GET","/me/supports",401)
(ROOT/"admin-panel/src/stories/api-fixtures.json").write_text(json.dumps(fixtures,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
(ROOT/"docs/ui-api-smoke.txt").write_text("Local dedicated PostgreSQL / unchanged backend ad3f0b8\n"+"\n".join(checks)+"\nExternal VK delivery and incoming SOS NOT verified.\n",encoding="utf-8")
print(f"{len(checks)} HTTP checks passed; fixture snapshots captured without credentials.")
