from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings

# DATABASE_URL uses the asyncpg scheme:
#   postgresql+asyncpg://user:password@localhost:5432/database
engine = create_async_engine(settings.database_url)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session():
    async with SessionLocal() as session:
        yield session
