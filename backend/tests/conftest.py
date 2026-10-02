"""
Общие заготовки для тестов (pytest находит этот файл сам).

app    — приложение с пустой временной базой в памяти
client — «браузер» для запросов к API в тестах
"""
import pytest

from app import create_app
from app.config import TestingConfig
from app.extensions import db


@pytest.fixture
def app():
    app = create_app(TestingConfig)
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()
