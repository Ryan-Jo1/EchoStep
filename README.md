# Travel Currency Converter

A web application that provides real-time currency conversion using the Free Currency API.

## Features

- Real-time currency conversion
- Support for multiple currencies
- Clean and intuitive user interface
- Caching of exchange rates using Redis
- Docker containerization for easy deployment

## Technologies Used

- Backend: Python, Flask
- Frontend: HTML, CSS, JavaScript
- Database: Redis (for caching)
- API: Free Currency API
- Containerization: Docker, Docker Compose

## Prerequisites

- Docker
- Docker Compose
- Free Currency API key

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Ryan-Jo1/travel-api.git
cd travel-api
```

2. Create a `.env` file in the root directory with your Free Currency API key:
```
EXCHANGE_RATES_API_KEY=your_api_key_here
```

3. Build and start the containers:
```bash
docker-compose up --build
```

4. Access the application at:
```
http://localhost
```

## API Endpoints

- `GET /` - Health check endpoint
- `GET /convert` - Convert currency
  - Parameters:
    - `from`: Source currency code (e.g., USD)
    - `to`: Target currency code (e.g., EUR)
    - `amount`: Amount to convert

## Project Structure

```
travel-api/
├── backend/
│   ├── app.py          # Flask application
│   └── Dockerfile      # Backend container configuration
├── frontend/
│   ├── index.html      # Main HTML file
│   ├── styles.css      # CSS styles
│   ├── script.js       # Frontend logic
│   └── nginx.conf      # Nginx configuration
├── docker-compose.yml  # Container orchestration
└── README.md          # Project documentation
```

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is licensed under the MIT License - see the LICENSE file for details. 