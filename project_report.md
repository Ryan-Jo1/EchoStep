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
9. [Recent Changes and Improvements](#recent-changes-and-improvements)

## Project Overview

The Travel Currency Converter is a web application that provides real-time currency conversion using the Free Currency API. It features a responsive user interface, caching of exchange rates using Redis, and is containerized with Docker for easy deployment.

**Key Features:**
- Real-time currency conversion between multiple currencies
- Caching mechanism to reduce API calls
- Currency swap functionality with visual animation
- Docker containerization
- Responsive UI with flag icons for currencies

## Architecture

The application follows a three-tier architecture:

1. **Frontend Tier**: HTML, CSS, and JavaScript running in the browser
2. **Backend Tier**: Python Flask application serving API endpoints
3. **Cache Tier**: Redis for storing exchange rates

**Container Structure:**
- `travel-api-nginx-1`: Nginx web server serving the frontend files and proxying API requests
- `travel-api-backend-1`: Python Flask application providing the backend API
- `travel-api-redis-1`: Redis instance for caching exchange rates

## Component Breakdown

### Frontend

The frontend consists of static files served by Nginx:

#### HTML (`frontend/index.html`)
- Main structure of the application
- Currency selection dropdowns with flag emojis
- Amount input field
- Convert and swap buttons
- Results display area
- Loading indicator and error message container

#### CSS (`frontend/styles.css`)
- Styling for all UI components
- Responsive design
- Exchange rate display
- Loading animation
- Swap button effects
- Error message styling

#### JavaScript (`frontend/script.js`)
- API communication with the backend
- User interaction handling
- Currency conversion logic
- Dynamic UI updates
- Error handling
- Swap currency functionality

#### Nginx Configuration (`frontend/nginx.conf`)
- Routes configuration
- Proxy setup to the Flask backend
- Static file serving
- Cache control headers

### Backend

The backend is a Python Flask application:

#### Application Server (`backend/app.py`)
- Flask application setup
- API endpoint definitions:
  - `/api/`: Health check endpoint
  - `/api/exchange-rate`: Get exchange rate between currencies
  - `/api/convert`: Convert amount between currencies
  - `/api/debug`: Diagnostic endpoint for testing
- Redis integration for caching
- Free Currency API integration
- CORS support for cross-origin requests

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
version: '3'

services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    volumes:
      - ./backend:/app
      - ./routes_api.py:/app/routes_api.py
    environment:
      - REDIS_HOST=redis
      - EXCHANGE_RATES_API_KEY=${EXCHANGE_RATES_API_KEY}
    depends_on:
      - redis
    restart: always

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./frontend:/usr/share/nginx/html
      - ./frontend/nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - backend
    restart: always

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    restart: always
```

### Container Details

1. **Redis Container (`travel-api-redis-1`)**
   - Uses the Redis Alpine image
   - Exposes port 6379
   - Connected to the default network

2. **Backend Container (`travel-api-backend-1`)**
   - Built from the Dockerfile in the backend directory
   - Exposes port 5000
   - Mounts the backend directory and routes_api.py file
   - Depends on the Redis container
   - Receives environment variables:
     - `EXCHANGE_RATES_API_KEY`: API key from .env file
     - `REDIS_HOST`: Points to the Redis service
   - Connected to the default network

3. **Nginx Container (`travel-api-nginx-1`)**
   - Uses the Nginx Alpine image
   - Exposes port 80
   - Mounts the frontend directory and Nginx configuration
   - Depends on the Backend container
   - Connected to the default network

### Networking

- All containers are connected to the default network
- The nginx container can access the backend container
- The backend container can access the Redis container
- Users access the application through port 80 (nginx)

## API Integration

### Free Currency API

The application integrates with the Free Currency API (https://freecurrencyapi.com/):

- API key is stored in the `.env` file
- Flask backend makes requests to the API
- Supported endpoints:
  - Latest exchange rates: `https://api.freecurrencyapi.com/v1/latest`

### API Endpoints

The Flask backend exposes these endpoints:

1. **`/api/`**
   - Method: GET
   - Purpose: Health check
   - Response: `{"message": "Travel API is running with currency conversion and walking routes!"}`

2. **`/api/exchange-rate`**
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

3. **`/api/convert`**
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

4. **`/api/debug`**
   - Method: GET
   - Purpose: Testing API functionality
   - Response:
     ```json
     {
       "status": "ok",
       "message": "API is working correctly",
       "timestamp": "2023-04-09T18:35:22.123456"
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
   - Set up persistent volumes
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
   - **Check**: `docker network inspect travel-api_default`

5. **JSON Parsing Errors**
   - **Symptom**: "Unexpected token '<', "<!DOCTYPE "... is not valid JSON"
   - **Solution**: Ensure the API path is correct and routes include the '/api/' prefix
   - **Check**: Nginx configuration and API routes in the Flask application

### Debugging Commands

```bash
# Check container logs
docker logs travel-api-backend-1
docker logs travel-api-redis-1
docker logs travel-api-nginx-1

# Enter container shell
docker exec -it travel-api-backend-1 bash
docker exec -it travel-api-redis-1 redis-cli

# Test Redis connectivity from backend container
docker exec travel-api-backend-1 python -c "import redis; r = redis.Redis(host='redis', port=6379); print(r.ping())"

# Test API endpoint
curl http://localhost/api/exchange-rate?from=USD&to=EUR
curl http://localhost/api/convert?from=USD&to=EUR&amount=100
```

## Recent Changes and Improvements

### Nginx Configuration Update
- Modified the proxy_pass directive to preserve the `/api/` path prefix when forwarding requests to the backend
- Added cache control headers to prevent browser caching issues
- Improved content-type handling for JSON responses

### Backend Service Updates
- Updated route definitions to consistently use the `/api/` prefix
- Added a diagnostic `/api/debug` endpoint for troubleshooting
- Fixed dependency conflicts in requirements.txt (Werkzeug version)
- Added improved error handling and reporting

### Frontend Improvements
- Added a currency swap button with animation effects
- Enhanced error handling with detailed error messages
- Improved loading state indicators
- Fixed JSON parsing issues by ensuring consistent API paths

These improvements have resulted in a more stable and user-friendly application with better error handling and diagnostic capabilities. 