from pathlib import Path

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings

# SQLite URL looks like sqlite+aiosqlite:///data/app.db — make sure the
# folder exists so the first run can create the database file.
_path = Path(settings.database_url.split("///", 1)[-1])
_path.parent.mkdir(parents=True, exist_ok=True)

engine = create_async_engine(settings.database_url)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session():
    async with SessionLocal() as session:
        yield session
