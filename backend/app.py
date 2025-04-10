from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import redis
from datetime import datetime, timedelta
import os
from routes_api import routes_api
from user_api import user_api
from flask_jwt_extended import JWTManager

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# JWT configuration
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev-secret-key")  # Change in production!
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1)
app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=30)
jwt = JWTManager(app)

# Register the API blueprints
app.register_blueprint(routes_api)
app.register_blueprint(user_api)

# Redis Connection for caching
REDIS_HOST = os.getenv('REDIS_HOST', 'redis')
redis_client = redis.Redis(host=REDIS_HOST, port=6379, decode_responses=True)

# Free Currency API configuration
EXCHANGE_RATES_API_KEY = os.getenv('EXCHANGE_RATES_API_KEY')
BASE_URL = "https://api.freecurrencyapi.com/v1/latest"

def get_exchange_rate(from_currency, to_currency):
    # Check cache first
    cache_key = f"rate:{from_currency}:{to_currency}"
    cached_rate = redis_client.get(cache_key)
    
    if cached_rate:
        return float(cached_rate)
    
    try:
        # Make API request
        response = requests.get(
            BASE_URL,
            params={
                "apikey": EXCHANGE_RATES_API_KEY,
                "base_currency": from_currency,
                "currencies": to_currency
            }
        )
        response.raise_for_status()
        data = response.json()
        
        if "data" not in data:
            raise Exception("Invalid response from API")
        
        rate = data["data"][to_currency]
        
        # Cache the rate for 1 hour
        redis_client.setex(cache_key, 3600, str(rate))
        
        return rate
    except Exception as e:
        app.logger.error(f"Error fetching exchange rate: {str(e)}")
        app.logger.error(f"Response: {response.text if 'response' in locals() else 'No response'}")
        return None

@app.route('/api/exchange-rate', methods=['GET'])
def get_exchange_rate_endpoint():
    from_currency = request.args.get('from', '').upper()
    to_currency = request.args.get('to', '').upper()
    
    if not from_currency or not to_currency:
        return jsonify({"error": "Please provide both 'from' and 'to' currency codes"}), 400
    
    rate = get_exchange_rate(from_currency, to_currency)
    
    if rate is None:
        return jsonify({"error": "Could not fetch exchange rate"}), 500
    
    return jsonify({
        "from_currency": from_currency,
        "to_currency": to_currency,
        "rate": rate,
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route('/api/convert', methods=['GET'])
def convert_currency():
    from_currency = request.args.get('from', '').upper()
    to_currency = request.args.get('to', '').upper()
    amount = request.args.get('amount', type=float)
    
    # Validate input
    if not from_currency or not to_currency:
        return jsonify({"error": "Please provide both 'from' and 'to' currency codes"}), 400
    
    if amount is None or amount <= 0:
        return jsonify({"error": "Please provide a valid amount greater than 0"}), 400
    
    # Get exchange rate
    rate = get_exchange_rate(from_currency, to_currency)
    
    if rate is None:
        return jsonify({"error": "Could not fetch exchange rate"}), 500
    
    # Calculate converted amount
    converted_amount = amount * rate
    
    return jsonify({
        "from_currency": from_currency,
        "to_currency": to_currency,
        "amount": amount,
        "converted_amount": converted_amount,
        "rate": rate,
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route('/api/translate', methods=['GET'])
def translate():
    phrase = request.args.get('phrase')
    lang = request.args.get('lang')

    translations = {
        "hello": {"es": "hola", "fr": "bonjour"},
        "thank you": {"es": "gracias", "fr": "merci"}
    }

    translated_text = translations.get(phrase, {}).get(lang, "Translation not found")
    return jsonify({"translated_text": translated_text})

@app.route('/api/debug', methods=['GET'])
def debug_endpoint():
    """A simple endpoint to test API functionality"""
    return jsonify({
        "status": "ok",
        "message": "API is working correctly",
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route('/api/')
@app.route('/')
def home():
    return {"message": "Travel API is running with currency conversion and walking routes!"}

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

