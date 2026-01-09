from sqlalchemy import text, create_engine

engine = create_engine("sqlite:///test.db")

def test_db_connection():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ Connected to database")
    except Exception as e:
        print("❌ Connection failed:", e)
