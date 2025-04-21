# Travel Companion App (EchoStep)

A comprehensive travel companion application with the following features:

## Currency Converter
- Convert between multiple currencies
- Real-time exchange rates
- Cached results for better performance
- Animated UI with smooth transitions
- Currency swap functionality with visual feedback

## Walking Routes
- Discover walking routes near your current location
- View routes on an interactive map
- Filter routes by distance, difficulty, and rating
- Add your own walking routes by drawing on the map
- Review and rate existing routes
- Share your experiences with other travelers

## Technologies Used
- Frontend: HTML, CSS, JavaScript, Leaflet.js for maps
- Backend: Flask (Python), Redis for caching
- APIs: Free Currency API for exchange rates, Geolocation for mapping
- Docker: Containerized deployment with Docker Compose
- Nginx: Reverse proxy for the frontend and API

## Project Structure
```
├── frontend/              # Frontend files
│   ├── index.html         # Currency converter page
│   ├── routes.html        # Walking routes page
│   ├── styles.css         # Shared styles
│   ├── routes.css         # Routes-specific styles
│   ├── script.js          # Currency converter script
│   ├── routes.js          # Walking routes script
│   └── nginx.conf         # Nginx configuration
├── backend/               # Backend files
│   ├── app.py             # Main Flask application
│   ├── requirements.txt   # Python dependencies
│   └── Dockerfile         # Backend container definition
├── routes_api.py          # Routes API endpoints
├── docker-compose.yml     # Docker Compose configuration
└── README.md              # This file
```

## Setup and Running

### Prerequisites
- Docker and Docker Compose
- Free Currency API key (https://freecurrencyapi.com/)

### Environment Variables
- `EXCHANGE_RATES_API_KEY`: API key for currency exchange rates

### Running with Docker (Recommended)
1. Create a `.env` file in the root directory with your API key:
   ```
   EXCHANGE_RATES_API_KEY=your_api_key_here
   ```

2. Build and start the containers:
   ```
   docker-compose up --build
   ```

3. Access the application in a web browser:
   ```
   http://localhost
   ```

### Running Without Docker (Development)
1. Install backend dependencies:
   ```
   cd backend
   pip install -r requirements.txt
   ```

2. Set up Redis locally and start the Flask application:
   ```
   export EXCHANGE_RATES_API_KEY=your_api_key_here
   export REDIS_HOST=localhost
   python app.py
   ```

3. Serve the frontend files using a local web server.

## Features to Add
- User authentication and profiles
- Save favorite routes and currency pairs
- Offline support
- Mobile app version
- Translation services for travelers
- Weather information for routes

## Troubleshooting
- If the frontend shows "Unexpected token '<', "<!DOCTYPE "... is not valid JSON" error, try clearing your browser cache.
- Ensure the correct backend service name is used in nginx.conf (currently "backend:5000").
- Check container logs with `docker-compose logs` if you encounter issues.

## License
MIT 
