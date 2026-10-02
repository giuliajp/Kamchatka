"""
Точка входа для локального запуска.

    python run.py

Сервер перезапускается сам при изменении кода (reload=True).
Документация API: http://127.0.0.1:8000/docs

В продакшене запуск другой, например:
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
"""

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
