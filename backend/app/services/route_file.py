"""
Трек этапа из файла KML, KMZ или GPX → GeoJSON (задача 3.5).

- KML/KMZ: линии <LineString> (Google Мои карты, Google Earth) и точки <Point> с названиями.
- GPX: треки <trk>/<trkpt>, маршруты <rte>/<rtept>, точки <wpt>.
- Высота — третья координата. Если у всех точек высота 0 (так экспортирует Google Мои карты),
  считаем, что высот нет: профиль высот тогда не строится, а не рисуется ровной линией.
- Точки из файла возвращаем списком: из них удобно создавать КП.
"""

from __future__ import annotations

import io
import re
import zipfile
from typing import Any
from xml.etree import ElementTree

MAX_BYTES = 10 * 1024 * 1024


class RouteFileError(ValueError):
    pass


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _children(element, name: str):
    return [child for child in element.iter() if _local(child.tag) == name]


def _xml(content: bytes) -> ElementTree.Element:
    if content[:2] == b"PK":                      # KMZ — это zip с doc.kml внутри
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                names = [n for n in archive.namelist() if n.lower().endswith(".kml")]
                if not names:
                    raise RouteFileError("В KMZ нет файла .kml")
                info = archive.getinfo("doc.kml" if "doc.kml" in names else names[0])
                if info.file_size > MAX_BYTES:
                    raise RouteFileError("Файл трека больше 10 МБ")
                content = archive.read(info)
        except zipfile.BadZipFile as error:
            raise RouteFileError("Файл повреждён") from error
    head = content[:4096].lower()
    if b"<!doctype" in head or b"<!entity" in content.lower():
        raise RouteFileError("Файл с DOCTYPE/ENTITY не принимается")
    try:
        return ElementTree.fromstring(content)
    except ElementTree.ParseError as error:
        raise RouteFileError(f"Не удалось прочитать файл: {error}") from error


def _kml_coordinates(text: str | None) -> list[list[float]]:
    points = []
    for chunk in (text or "").split():
        values = [float(v) for v in chunk.split(",") if v != ""]
        if len(values) >= 2:
            points.append(values[:3])
    return points


def _drop_zero_heights(lines: list[list[list[float]]]) -> list[list[list[float]]]:
    heights = [p[2] for line in lines for p in line if len(p) > 2]
    if heights and len(heights) == sum(len(line) for line in lines) and any(h != 0 for h in heights):
        return lines
    return [[p[:2] for p in line] for line in lines]


def parse_route(content: bytes) -> dict[str, Any]:
    """{"geojson": ..., "points": [{name, latitude, longitude, elevation_m}], "has_elevation": bool}"""
    if len(content) > MAX_BYTES:
        raise RouteFileError("Файл трека больше 10 МБ")
    root = _xml(content)
    kind = _local(root.tag).lower()
    lines: list[list[list[float]]] = []
    points: list[dict] = []
    if kind == "kml":
        for line in _children(root, "LineString"):
            coords = next((c.text for c in _children(line, "coordinates")), None)
            if len(found := _kml_coordinates(coords)) >= 2:
                lines.append(found)
        for mark in _children(root, "Placemark"):
            for point in _children(mark, "Point"):
                coords = _kml_coordinates(next((c.text for c in _children(point, "coordinates")), None))
                if coords:
                    name = next((n.text for n in mark if _local(n.tag) == "name"), None)
                    lon, lat, *rest = coords[0]
                    points.append({"name": (name or "").strip() or None, "latitude": lat, "longitude": lon,
                                   "elevation_m": rest[0] if rest and rest[0] else None})
    elif kind == "gpx":
        for container, item in (("trkseg", "trkpt"), ("rte", "rtept")):
            for segment in _children(root, container):
                found = []
                for p in _children(segment, item):
                    ele = next((e.text for e in p if _local(e.tag) == "ele"), None)
                    point = [float(p.get("lon")), float(p.get("lat"))]
                    if ele is not None:
                        point.append(float(ele))
                    found.append(point)
                if len(found) >= 2:
                    lines.append(found)
        for p in _children(root, "wpt"):
            name = next((n.text for n in p if _local(n.tag) == "name"), None)
            ele = next((e.text for e in p if _local(e.tag) == "ele"), None)
            points.append({"name": (name or "").strip() or None, "latitude": float(p.get("lat")),
                           "longitude": float(p.get("lon")), "elevation_m": float(ele) if ele else None})
    else:
        raise RouteFileError("Нужен файл KML, KMZ или GPX")
    if not lines:
        raise RouteFileError("В файле нет линии трека (LineString / trk)")
    for line in lines:
        for lon, lat, *_ in line:
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                raise RouteFileError("Координаты вне допустимого диапазона")
    lines = _drop_zero_heights(lines)
    geometry = ({"type": "LineString", "coordinates": lines[0]} if len(lines) == 1
                else {"type": "MultiLineString", "coordinates": lines})
    return {"geojson": geometry, "points": points, "has_elevation": len(lines[0][0]) > 2}


def safe_filename(name: str | None, default: str) -> str:
    name = (name or default).replace("\\", "/").rsplit("/", 1)[-1]
    return re.sub(r"[^\w.\- ]", "_", name)[:255] or default
