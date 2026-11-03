"""Upgrade populated 0007 data and verify the database accepts the public content types."""
import pytest
from alembic import command
from sqlalchemy import text
from tests.test_content_migration import alembic_config


def verify(connection):
    config = alembic_config(connection)
    command.upgrade(config, '0007')
    connection.execute(text("""
        INSERT INTO races (id,name,year,status,is_current,tracking_interval_minutes,stale_after_minutes,created_at,updated_at)
        VALUES (1,'Preserved season',2027,'upcoming',true,20,45,now(),now())
    """))
    connection.execute(text("""
        INSERT INTO spectator_locations (id,race_id,location_type,name,latitude,longitude,sort_order,is_published,created_at,updated_at)
        VALUES (1,1,'viewpoint','Preserved venue',53,158,0,true,now(),now())
    """))
    connection.execute(text("""
        INSERT INTO program_events (id,race_id,event_type,title,start_at,location_id,sort_order,is_published,created_at,updated_at)
        VALUES (1,1,'festival','Preserved event',now(),1,0,true,now(),now())
    """))
    command.upgrade(config, 'head')
    assert connection.scalar(text('SELECT image_urls FROM program_events WHERE id=1')) == []
    assert connection.scalar(text('SELECT image_urls FROM spectator_locations WHERE id=1')) == []
    assert connection.scalar(text('SELECT title FROM program_events WHERE id=1')) == 'Preserved event'
    connection.execute(text("UPDATE spectator_locations SET location_type='checkpoint' WHERE id=1"))
    for kind in ('master_class', 'meeting'):
        connection.execute(text('UPDATE program_events SET event_type=:kind WHERE id=1'), {'kind': kind})
    with pytest.raises(RuntimeError, match='Перед откатом 0010'):
        command.downgrade(config, '0009')
    assert connection.scalar(text('SELECT event_type FROM program_events WHERE id=1')) == 'meeting'
    assert connection.scalar(text('SELECT version_num FROM alembic_version')) == '0010'
    connection.execute(text("UPDATE program_events SET event_type='festival' WHERE id=1"))
    connection.execute(text("UPDATE spectator_locations SET location_type='viewpoint' WHERE id=1"))
    command.downgrade(config, '0007')
    assert connection.scalar(text('SELECT count(*) FROM program_events')) == 1
    command.upgrade(config, 'head')
    assert connection.scalar(text('SELECT image_urls FROM program_events WHERE id=1')) == []
    command.check(config)


async def test_populated_design_migration(empty_engine):
    async with empty_engine.begin() as connection:
        await connection.run_sync(verify)
