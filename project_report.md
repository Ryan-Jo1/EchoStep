# Travel Currency Converter - Detailed Project Report

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Component Breakdown](#component-breakdown)
4. [Docker Configuration](#docker-configuration)
5. [API Integration](#api-integration)
6. [Data Flow](#data-flow)
7. [Deployment Guide](#deployment-guide)
8. [Troubleshooting](#troubleshooting)

## Project Overview

The Travel Currency Converter is a web application that provides real-time currency conversion using the Free Currency API. It features a responsive user interface, caching of exchange rates using Redis, and is containerized with Docker for easy deployment.

**Key Features:**
- Real-time currency conversion between multiple currencies
- Caching mechanism to reduce API calls
- Currency swap functionality
- Docker containerization
- Responsive UI with flag icons for currencies

## Architecture

The application follows a three-tier architecture:

1. **Frontend Tier**: HTML, CSS, and JavaScript running in the browser
2. **Backend Tier**: Python Flask application serving API endpoints
3. **Cache Tier**: Redis for storing exchange rates

**Container Structure:**
- `travel_frontend`: Nginx web server serving the frontend files
- `travel_flask`: Python Flask application providing the backend API
- `travel_redis`: Redis instance for caching exchange rates

## Component Breakdown

### Frontend

The frontend consists of static files served by Nginx:

#### HTML (`frontend/index.html`)
- Main structure of the application
- Currency selection dropdowns
- Amount input field
- Convert and swap buttons
- Results display area

#### CSS (`frontend/styles.css`)
- Styling for all UI components
- Responsive design
- Flag icons integration via flag-icons library
- Loading and error states

#### JavaScript (`frontend/script.js`)
- API communication with the backend
- User interaction handling
- Currency conversion logic
- Dynamic UI updates
- Error handling

#### Nginx Configuration (`frontend/nginx.conf`)
- Routes configuration
- Proxy setup to the Flask backend
- Static file serving

### Backend

The backend is a Python Flask application:

#### Application Server (`backend/app.py`)
- Flask application setup
- API endpoint definitions:
  - `/`: Health check endpoint
  - `/exchange-rate`: Get exchange rate between currencies
  - `/convert`: Convert amount between currencies
- Redis integration for caching
- Free Currency API integration

#### Requirements (`backend/requirements.txt`)
- Python package dependencies
- Version specifications for compatibility

#### Dockerfile (`backend/Dockerfile`)
- Python environment setup
- Application code deployment
- Runtime configuration

### Cache

Redis is used for caching exchange rates:

- Reduces the number of calls to the external API
- Improves response time for frequently used currency pairs
- Cache entries expire after 1 hour

## Docker Configuration

The Docker setup orchestrates three containers that work together:

### Docker Compose (`docker-compose.yml`)

```yaml
services:
  redis:
    image: redis:latest
    container_name: travel_redis
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - app-network

  flask:
    build: 
      context: ./backend
      dockerfile: Dockerfile
    container_name: travel_flask
    restart: always
    ports:
      - "5000:5000"
    depends_on:
      - redis
    environment:
      - EXCHANGE_RATES_API_KEY=${EXCHANGE_RATES_API_KEY}
      - FLASK_ENV=development
      - REDIS_HOST=travel_redis
    networks:
      - app-network

  frontend:
    image: nginx:alpine
    container_name: travel_frontend
    ports:
      - "80:80"
    volumes:
      - ./frontend:/usr/share/nginx/html
      - ./frontend/nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - flask
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  redis_data:
```

### Container Details

1. **Redis Container (`travel_redis`)**
   - Uses the latest Redis image
   - Exposes port 6379
   - Persists data using a Docker volume
   - Connected to the app-network

2. **Flask Container (`travel_flask`)**
   - Built from the Dockerfile in the backend directory
   - Exposes port 5000
   - Depends on the Redis container
   - Receives environment variables:
     - `EXCHANGE_RATES_API_KEY`: API key from .env file
     - `FLASK_ENV`: Development environment
     - `REDIS_HOST`: Points to the Redis container
   - Connected to the app-network

3. **Frontend Container (`travel_frontend`)**
   - Uses the Nginx Alpine image
   - Exposes port 80
   - Mounts the frontend directory and Nginx configuration
   - Depends on the Flask container
   - Connected to the app-network

### Networking

- All containers are connected to the `app-network` bridge network
- The frontend container can access the Flask container
- The Flask container can access the Redis container
- Users access the application through port 80 (frontend)

## API Integration

### Free Currency API

The application integrates with the Free Currency API (https://freecurrencyapi.com/):

- API key is stored in the `.env` file
- Flask backend makes requests to the API
- Supported endpoints:
  - Latest exchange rates: `https://api.freecurrencyapi.com/v1/latest`

### API Endpoints

The Flask backend exposes these endpoints:

1. **`/`**
   - Method: GET
   - Purpose: Health check
   - Response: `{"message": "Travel API is running!"}`

2. **`/exchange-rate`**
   - Method: GET
   - Parameters:
     - `from`: Source currency code (e.g., USD)
     - `to`: Target currency code (e.g., EUR)
   - Response:
     ```json
     {
       "from_currency": "USD",
       "to_currency": "EUR",
       "rate": 0.91,
       "timestamp": "2023-04-09T18:27:30.872560"
     }
     ```

3. **`/convert`**
   - Method: GET
   - Parameters:
     - `from`: Source currency code (e.g., USD)
     - `to`: Target currency code (e.g., EUR)
     - `amount`: Amount to convert (e.g., 100)
   - Response:
     ```json
     {
       "from_currency": "USD",
       "to_currency": "EUR",
       "amount": 100,
       "converted_amount": 91.03,
       "rate": 0.91,
       "timestamp": "2023-04-09T18:30:14.176532"
     }
     ```

## Data Flow

1. **User Interaction**
   - User enters an amount
   - Selects source and target currencies
   - Clicks "Convert" or uses the swap button

2. **Frontend Processing**
   - JavaScript captures the user input
   - Makes a fetch request to the backend API
   - Displays loading state

3. **Backend Processing**
   - Flask receives the request
   - Checks Redis cache for exchange rate
   - If not in cache, calls Free Currency API
   - Stores result in Redis with 1-hour expiration
   - Calculates conversion
   - Returns result to frontend

4. **Result Display**
   - Frontend receives the conversion result
   - Updates the UI with the result
   - Shows flags and formatted numbers
   - Updates the exchange rate information
   - Hides loading state

## Deployment Guide

### Prerequisites
- Docker and Docker Compose installed
- Free Currency API key

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/Ryan-Jo1/travel-api.git
   cd travel-api
   ```

2. **Create environment file**
   Create a `.env` file in the root directory:
   ```
   EXCHANGE_RATES_API_KEY=your_api_key_here
   ```

3. **Build and start containers**
   ```bash
   docker-compose up --build
   ```

4. **Access the application**
   Open your browser and navigate to:
   ```
   http://localhost
   ```

### Production Deployment

For production deployment:

1. Update the `docker-compose.yml` file:
   - Remove port mapping for Redis
   - Set `FLASK_ENV=production`
   - Configure proper volume paths

2. Use HTTPS with a proper domain:
   - Update Nginx configuration with SSL certificates
   - Enable HTTP to HTTPS redirection

3. Implement monitoring and logging:
   - Add logging volumes
   - Set up monitoring tools

## Troubleshooting

### Common Issues

1. **Redis Connection Errors**
   - **Symptom**: Backend fails to connect to Redis
   - **Solution**: Ensure Redis container is running
   - **Check**: `docker-compose ps` to verify container status

2. **API Key Issues**
   - **Symptom**: Currency conversion fails with API errors
   - **Solution**: Verify your API key is correct and has sufficient quota
   - **Check**: `.env` file content and API dashboard

3. **CORS Issues**
   - **Symptom**: Frontend can't connect to backend
   - **Solution**: Ensure CORS is enabled in Flask
   - **Check**: Backend logs and browser console

4. **Docker Network Issues**
   - **Symptom**: Containers can't communicate
   - **Solution**: Check network configuration
   - **Check**: `docker network inspect travel-api_app-network`

5. **Flag Icons Not Showing**
   - **Symptom**: Currency flags don't appear
   - **Solution**: Check internet connectivity for CDN access
   - **Check**: Browser network tab for flag-icons CSS loading

### Debugging Commands

```bash
# Check container logs
docker-compose logs flask
docker-compose logs redis
docker-compose logs frontend

# Enter container shell
docker-compose exec flask bash
docker-compose exec redis redis-cli

# Test Redis connectivity from Flask container
docker-compose exec flask python -c "import redis; r = redis.Redis(host='travel_redis', port=6379); print(r.ping())"

# Test API endpoint
curl http://localhost:5000/exchange-rate?from=USD&to=EUR
``` 