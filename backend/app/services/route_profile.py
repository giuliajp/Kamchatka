"""
Профиль высот из трека этапа (GeoJSON, высота — третья координата).

Трек загружается из KML через админку (задача 3.5) и хранится в Stage.route_geojson.
Если высот в треке нет — профиль пустой.
"""

from math import asin, cos, radians, sin, sqrt
from typing import Any

EARTH_RADIUS_KM = 6371.0088
MAX_POINTS = 500   # больше точек телефону для графика не нужно


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Расстояние между двумя точками на Земле, км."""
    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * asin(sqrt(a))


def extract_lines(geojson: dict[str, Any] | None) -> list[list[list[float]]]:
    """Все линии из Geometry / Feature / FeatureCollection."""
    if not geojson:
        return []
    kind = geojson.get("type")
    if kind == "FeatureCollection":
        return [line for f in geojson.get("features", []) for line in extract_lines(f)]
    if kind == "Feature":
        return extract_lines(geojson.get("geometry"))
    if kind == "LineString":
        return [geojson.get("coordinates", [])]
    if kind == "MultiLineString":
        return list(geojson.get("coordinates", []))
    return []


def elevation_profile(geojson: dict[str, Any] | None) -> list[dict[str, float]]:
    """[{km, elevation_m}, ...] вдоль трека, не больше MAX_POINTS точек."""
    profile: list[dict[str, float]] = []
    distance = 0.0
    previous = None
    for line in extract_lines(geojson):
        for point in line:
            if len(point) < 3 or point[2] is None:
                return []   # высоты нет хотя бы в одной точке — профиль не строим
            if previous is not None:
                distance += haversine_km(previous[0], previous[1], point[0], point[1])
            profile.append({"km": round(distance, 3), "elevation_m": round(float(point[2]), 1)})
            previous = point
    if len(profile) > MAX_POINTS:
        step = (len(profile) - 1) / (MAX_POINTS - 1)
        profile = [profile[round(i * step)] for i in range(MAX_POINTS)]
    return profile
