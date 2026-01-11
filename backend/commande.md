

# hedhom bech nod5lou lel variable d'envirennment ..

python -m venv venv
venv\Scripts\activate






pip install fastapi uvicorn sqlalchemy pymysql python-dotenv
pip freeze > requirements.txt  



uvicorn app.main:app --reload


# hdhom  teb3in alembic --> packeg hedha yaamel migration lel les tables les database 

pip install alembic

alembic --version



✔️ Better Comments يخدم كان إنت تكتب comment مليح
✔️ ركّز على:

? علاش

! خطر

TODO تطوير

* تنظيم
# ? hedha bech naamlou bih les initialisation lel 

pip install alembic
alembic init migrations
alembic revision --autogenerate -m "msg"
alembic upgrade head
alembic downgrade -1






