"""
Организаторы — пользователи административной панели (задача 3.2).

Пароль храним только в виде хеша (scrypt, см. app/services/admin_auth.py).
Создать организатора: python backend/scripts/create_admin.py --login ivanov --name "Иван Иванов"
"""
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import TimestampMixin


class AdminUser(TimestampMixin, Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    login: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(300), nullable=False)
    # Выключенный организатор не может войти; выданные ему токены перестают работать.
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    def __repr__(self) -> str:
        return f"<AdminUser {self.login}>"
