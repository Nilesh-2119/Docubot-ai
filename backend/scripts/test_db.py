import asyncio
import sys
import os

# Add parent dir to path so we can import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

try:
    from app.database import engine
    from sqlalchemy import text
except Exception as e:
    print(f"Import Error: {e}")
    sys.exit(1)

async def main():
    print("Testing DB connection...")
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        print("DB ok")
    except Exception as e:
        print(f"DB fail: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
