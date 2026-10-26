import asyncio

from sqlalchemy import delete

from app.database import SessionLocal, engine
from app.models import User


async def main():
    async with SessionLocal() as session:
        await session.execute(delete(User))
        session.add_all(
            [
                User(name="Ada Lovelace", email="ada@example.com"),
                User(name="Grace Hopper", email="grace@example.com"),
            ]
        )
        await session.commit()
    await engine.dispose()
    print("✅ Database seeded with sample users")


asyncio.run(main())
