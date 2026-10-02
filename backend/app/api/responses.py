"""
Единый формат ответов API. Используйте эти функции во всех эндпоинтах,
чтобы фронтенд всегда получал одинаковую структуру.

Успех:   {"data": <данные>, "error": null}
Ошибка:  {"data": null, "error": {"code": "not_found", "message": "..."}}
"""
from flask import jsonify


def ok(data=None, status: int = 200):
    """Успешный ответ."""
    return jsonify({"data": data, "error": None}), status


def error(code: str, message: str, status: int = 400):
    """Ответ с ошибкой. code — короткое имя для программы, message — текст для человека."""
    return jsonify({"data": None, "error": {"code": code, "message": message}}), status
