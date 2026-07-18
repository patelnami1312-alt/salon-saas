import asyncio
from sqlalchemy import text
from app.core.database import async_engine

async def main():
    async with async_engine.connect() as conn:
        r = await conn.execute(text(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
        ))
        for row in r:
            print(row[0])

asyncio.run(main())
