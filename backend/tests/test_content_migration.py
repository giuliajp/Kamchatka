"""Реальная цепочка Alembic: 0005 → 0006 → 0005 → 0006 в отдельной схеме."""

from pathlib import Path

from alembic import command
from alembic.script import ScriptDirectory
from alembic.config import Config
from app.models import OrganizerContact, ProgramEvent
from scripts.seed_content import seed_content
from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import AsyncSession

BACKEND = Path(__file__).resolve().parents[1]


def alembic_config(connection):
    config = Config(str(BACKEND / "alembic.ini"))
    config.attributes["connection"] = connection
    return config


def schema_snapshot(connection):
    inspector = inspect(connection)
    return {
        table: {
            "columns": [
                (
                    column["name"],
                    str(column["type"]),
                    column["nullable"],
                    column["default"],
                )
                for column in inspector.get_columns(table)
            ],
            "foreign_keys": inspector.get_foreign_keys(table),
            "unique": inspector.get_unique_constraints(table),
            "checks": inspector.get_check_constraints(table),
            "indexes": inspector.get_indexes(table),
        }
        for table in inspector.get_table_names()
    }


def verify_roundtrip(connection):
    config = alembic_config(connection)
    command.upgrade(config, "0005")
    old_schema = schema_snapshot(connection)
    connection.execute(
        text("""
        INSERT INTO races (id, name, year, status, is_current,
                           tracking_interval_minutes, stale_after_minutes, created_at, updated_at)
        VALUES (1, 'Migration season', 2027, 'upcoming', true, 20, 45, now(), now())
    """)
    )
    connection.execute(
        text("""
        INSERT INTO faq_items (question, answer, sort_order, is_published, created_at, updated_at)
        VALUES ('Keep FAQ', 'Answer', 0, true, now(), now())
    """)
    )
    connection.execute(
        text("""
        INSERT INTO admin_users (login, full_name, password_hash, is_active, created_at, updated_at)
        VALUES ('migration-admin', 'Keep admin', 'test-hash', true, now(), now())
    """)
    )
    connection.execute(
        text("""
        INSERT INTO spectator_locations
            (id, name, latitude, longitude, sort_order, is_published, created_at, updated_at)
        VALUES (100, 'Old sample', 53, 158, 0, true, now(), now())
    """)
    )
    connection.execute(
        text("""
        INSERT INTO program_events
            (title, start_at, location_id, sort_order, is_published, created_at, updated_at)
        VALUES ('Old sample', now(), 100, 0, true, now(), now())
    """)
    )
    command.upgrade(config, "head")
    assert connection.scalar(text("SELECT version_num FROM alembic_version")) == ScriptDirectory.from_config(config).get_current_head()
    for table in ("program_events", "spectator_locations"):
        assert connection.scalar(text(f"SELECT count(*) FROM {table}")) == 0
    for table in ("races", "faq_items", "admin_users"):
        assert connection.scalar(text(f"SELECT count(*) FROM {table}")) == 1
    command.check(config)
    return old_schema


async def test_content_migration_roundtrip_and_seed(empty_engine):
    async with empty_engine.begin() as connection:
        old_schema = await connection.run_sync(verify_roundtrip)
        # Populate the upgraded schema through the actual seed, including contacts.
        async with AsyncSession(bind=connection, expire_on_commit=False) as session:
            created = await seed_content(session, 1)
            assert created == {"locations": 2, "program": 3, "faq": 3, "contacts": 2}
            assert not any((await seed_content(session, 1)).values())
            assert len((await session.scalars(select(ProgramEvent))).all()) == 3
            assert len((await session.scalars(select(OrganizerContact))).all()) == 2

        def downgrade_and_upgrade(sync_connection):
            config = alembic_config(sync_connection)
            command.downgrade(config, "0005")
            assert schema_snapshot(sync_connection) == old_schema
            # Downgrade retains events and locations in their original 0005 form.
            assert (
                sync_connection.scalar(text("SELECT count(*) FROM program_events")) == 3
            )
            command.upgrade(config, "head")
            command.check(config)
            assert (
                sync_connection.scalar(text("SELECT count(*) FROM program_events")) == 0
            )
            assert sync_connection.scalar(text("SELECT count(*) FROM faq_items")) == 4
            assert sync_connection.scalar(text("SELECT count(*) FROM admin_users")) == 1

        await connection.run_sync(downgrade_and_upgrade)
