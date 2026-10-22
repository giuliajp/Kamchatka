"""
Где участник находится на трассе: точку GPS «прикладываем» к треку этапа
и получаем километр от старта и расстояние от трассы.

Нужно для «пройденной дистанции», «позиции по GPS-трекеру» и отрыва от лидера.
Это оценка по трекеру, а НЕ официальные данные (официальное — только протоколы судей).
"""

from __future__ import annotations

from dataclasses import dataclass
from math import cos, radians

from app.services.route_profile import EARTH_RADIUS_KM, extract_lines, haversine_km

# Дальше этого от трассы точку к трассе не прикладываем (явно не на маршруте).
MAX_OFF_ROUTE_KM = 2.0


@dataclass(frozen=True)
class RoutePoint:
    km: float               # километр от старта этапа
    off_route_km: float     # насколько точка в стороне от трассы


class Route:
    """Подготовленный трек этапа: точки и накопленные километры."""

    def __init__(self, geojson: dict | None) -> None:
        self.points: list[tuple[float, float]] = []      # (lon, lat)
        for line in extract_lines(geojson):
            for p in line:
                if len(p) >= 2:
                    self.points.append((float(p[0]), float(p[1])))
        self.cumulative = [0.0]
        for a, b in zip(self.points, self.points[1:]):
            self.cumulative.append(self.cumulative[-1] + haversine_km(a[0], a[1], b[0], b[1]))

    @property
    def length_km(self) -> float:
        return self.cumulative[-1]

    def locate(self, lat: float, lon: float) -> RoutePoint | None:
        """Ближайшее место на трассе. None — трека нет или точка слишком далеко."""
        if len(self.points) < 2:
            return None
        k = cos(radians(lat))    # локально Земля «плоская»: долготу сжимаем на cos(широты)
        best: tuple[float, float] | None = None   # (расстояние, км на трассе)
        for i, (a, b) in enumerate(zip(self.points, self.points[1:])):
            ax, ay = (a[0] - lon) * k, a[1] - lat
            bx, by = (b[0] - lon) * k, b[1] - lat
            dx, dy = bx - ax, by - ay
            length2 = dx * dx + dy * dy
            t = 0.0 if length2 == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / length2))
            px, py = ax + t * dx, ay + t * dy
            distance = radians((px * px + py * py) ** 0.5) * EARTH_RADIUS_KM
            if best is None or distance < best[0]:
                segment = self.cumulative[i + 1] - self.cumulative[i]
                best = (distance, self.cumulative[i] + t * segment)
        if best is None or best[0] > MAX_OFF_ROUTE_KM:
            return None
        return RoutePoint(km=best[1], off_route_km=best[0])


_cache: dict[tuple[int, object], Route] = {}


def route_for_stage(stage) -> Route:
    """
    Трек этапа. Кэшируем по (этап, route_updated_at): при замене трека в админке
    route_updated_at меняется, и трек пересчитывается. Без даты обновления — не кэшируем.
    """
    if stage.route_updated_at is None:
        return Route(stage.route_geojson)
    key = (stage.id, stage.route_updated_at)
    route = _cache.get(key)
    if route is None:
        if len(_cache) > 50:
            _cache.clear()
        route = _cache[key] = Route(stage.route_geojson)
    return route
