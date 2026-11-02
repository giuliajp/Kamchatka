"""
Создать организатора для входа в админку или сменить ему пароль.

Из корня проекта, с включённым окружением:
    python backend/scripts/create_admin.py --login ivanov --name "Иван Иванов"

Пароль спросит скрипт (при вводе он не виден на экране). Если логин уже есть —
пароль и имя будут обновлены, а сам организатор снова включён.
Выключить организатора:
    python backend/scripts/create_admin.py --login ivanov --disable
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import sys
from pathlib import Path

MIN_PASSWORD = 10


async def save(login: str, name: str | None, password: str | None, disable: bool) -> str:
    backend_dir = str(Path(__file__).resolve().parents[1])
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    from sqlalchemy import func, select

    from app.db import SessionLocal, engine
    from app.models import AdminUser
    from app.services.admin_auth import hash_password

    try:
        async with SessionLocal.begin() as session:
            admin = (await session.execute(
                select(AdminUser).where(func.lower(AdminUser.login) == login.lower())
            )).scalar_one_or_none()
            if disable:
                if admin is None:
                    raise LookupError(f"Организатор {login} не найден")
                admin.is_active = False
                return f"Организатор {admin.login} выключен"
            if admin is None:
                if not name:
                    raise LookupError("Для нового организатора укажите --name")
                session.add(AdminUser(login=login, full_name=name, password_hash=hash_password(password)))
                return f"Создан организатор {login}"
            admin.password_hash = hash_password(password)
            admin.is_active = True
            if name:
                admin.full_name = name
            return f"Обновлён организатор {admin.login}"
    finally:
        await engine.dispose()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Создать организатора админки или сменить пароль.")
    parser.add_argument("--login", required=True, help="Логин для входа, например ivanov")
    parser.add_argument("--name", help="Имя, как его видят в журнале правок")
    parser.add_argument("--disable", action="store_true", help="Выключить организатора")
    parser.add_argument("--password", help=argparse.SUPPRESS)   # только для тестов
    args = parser.parse_args(argv)

    password = None
    if not args.disable:
        password = args.password or getpass.getpass("Пароль: ")
        if len(password) < MIN_PASSWORD:
            print(f"Ошибка: пароль короче {MIN_PASSWORD} символов", file=sys.stderr)
            return 1
        if args.password is None and getpass.getpass("Повторите пароль: ") != password:
            print("Ошибка: пароли не совпадают", file=sys.stderr)
            return 1
    try:
        print(asyncio.run(save(args.login.strip(), args.name, password, args.disable)))
    except LookupError as error:
        print(f"Ошибка: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
