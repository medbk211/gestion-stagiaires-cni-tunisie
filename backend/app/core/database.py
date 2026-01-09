# app/core/database.py
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import DATABASE_URL


engine = create_engine(
    DATABASE_URL,
    echo=True,  # prints SQL queries for debugging
)


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# def test_db_connection():
#     try:
#         with engine.connect() as conn:
#             conn.execute(text("SELECT 1"))
#         print("✅ Connected to database")
#     except Exception as e:
#         print("❌ Connection failed:", e)
