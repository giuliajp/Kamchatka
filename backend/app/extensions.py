"""
Расширения Flask, инициализируемые в app factory (app/__init__.py) через .init_app(app).

Вынесены в отдельный файл, чтобы не создавать циклические импорты между моделями и приложением.
"""

from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()
cors = CORS()
