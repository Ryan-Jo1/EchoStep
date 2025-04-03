from flask import Flask
import psycopg2
import redis

app = Flask(__name__)

# PostgreSQL Connection
db_conn = psycopg2.connect(
    dbname="travel_db",
    user="RyanKJo",
    password="Sontelkulusevski71121",
    host="postgres",  # This matches the service name in docker-compose.yml
    port=5432
)

# Redis Connection
redis_client = redis.Redis(host="redis", port=6379, decode_responses=True)

@app.route('/')
def home():
    return {"message": "Travel API is running!"}

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
