# Travel Companion App

A comprehensive travel companion application with the following features:

## Currency Converter
- Convert between multiple currencies
- Real-time exchange rates
- Cached results for better performance
- Animated UI with smooth transitions

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
- APIs: Currency exchange API, Geolocation

## Project Structure
```
├── frontend/              # Frontend files
│   ├── index.html         # Currency converter page
│   ├── routes.html        # Walking routes page
│   ├── styles.css         # Shared styles
│   ├── routes.css         # Routes-specific styles
│   ├── script.js          # Currency converter script
│   └── routes.js          # Walking routes script
├── backend/               # Backend files
│   └── app.py             # Main Flask application
├── routes_api.py          # Routes API endpoints
└── README.md              # This file
```

## Setup and Running

### Prerequisites
- Python 3.7+
- Redis server
- Node.js and npm (for development)

### Environment Variables
- `REDIS_HOST`: Redis server hostname (default: "redis")
- `EXCHANGE_RATES_API_KEY`: API key for currency exchange rates

### Running the Application
1. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Start the backend:
   ```
   python backend/app.py
   ```

3. Open the application in a web browser:
   ```
   http://localhost:5000
   ```

## Features to Add
- User authentication and profiles
- Save favorite routes and currency pairs
- Offline support
- Mobile app version
- Translation services for travelers
- Weather information for routes

## License
MIT 