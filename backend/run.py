"""
Точка входа для локального запуска.

    python run.py

В продакшене приложение запускается через WSGI-сервер (например, gunicorn),
а не через этот файл — см. README.md.
"""

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=8000)
