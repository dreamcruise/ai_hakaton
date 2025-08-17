release: python3 manage.py migrate
web: gunicorn app.wsgi --log-file -
worker: celery -A app worker --beat --scheduler django --loglevel=info 