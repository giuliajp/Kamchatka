"""
Модели данных (SQLAlchemy). Каждая сущность — свой файл в этой папке
(participant.py, tracker_position.py, control_point.py, checkpoint_record.py, ...),
здесь для примера — заготовка модели участника.
"""

from app.extensions import db


class Participant(db.Model):
    """
    Участник гонки (каюр).

    TODO: дополнить полями из карточки участника (см. docs/screens.md, экран "Карточка участника"):
    фото, регион, дисциплина, количество собак, биография.
    """

    __tablename__ = "participants"

    id = db.Column(db.Integer, primary_key=True)
    bib_number = db.Column(db.Integer, unique=True, nullable=False)  # стартовый номер
    name = db.Column(db.String(200), nullable=False)
    discipline = db.Column(db.String(100), nullable=True)

    # Привязка трекера — важно для интеграции с Iridium360 (см. app/services/iridium360)
    tracker_imei = db.Column(db.String(50), unique=True, nullable=True)

    supporters_count = db.Column(db.Integer, default=0, nullable=False)  # счётчик "Болею за"

    def __repr__(self) -> str:
        return f"<Participant {self.bib_number} {self.name}>"
