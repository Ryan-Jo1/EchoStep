from flask import Blueprint, jsonify, request
import random
import time
from datetime import datetime, timedelta
import math

routes_api = Blueprint('routes_api', __name__)

# Mock data storage
routes_data = []
next_route_id = 1
next_review_id = 1

# Initialize with some sample routes
def initialize_sample_routes():
    global routes_data, next_route_id, next_review_id
    
    # Sample coordinates for major cities
    city_coordinates = {
        "paris": {"lat": 48.856614, "lng": 2.3522219},
        "london": {"lat": 51.507351, "lng": -0.127758},
        "newyork": {"lat": 40.712776, "lng": -74.005974},
        "tokyo": {"lat": 35.689487, "lng": 139.691711},
        "sydney": {"lat": -33.868820, "lng": 151.209296},
    }
    
    for city, coords in city_coordinates.items():
        # Generate 3-5 routes per city
        for i in range(random.randint(3, 5)):
            route = generate_mock_route(coords["lat"], coords["lng"])
            routes_data.append(route)
            next_route_id += 1
            next_review_id += len(route["reviews"])

# Generate a mock route around the given coordinates
def generate_mock_route(base_lat, base_lng):
    # Route path - create a random path around the base coordinates
    path_length = random.randint(5, 15)
    path = []
    
    # Start point (slightly offset from base location)
    start_lat = base_lat + (random.random() * 0.01 - 0.005)
    start_lng = base_lng + (random.random() * 0.01 - 0.005)
    path.append([start_lat, start_lng])
    
    # Generate path points
    for j in range(1, path_length):
        point_lat = path[j - 1][0] + (random.random() * 0.004 - 0.002)
        point_lng = path[j - 1][1] + (random.random() * 0.004 - 0.002)
        path.append([point_lat, point_lng])
    
    # Calculate distance (in km)
    distance = calculate_path_distance(path)
    
    # Generate random reviews
    reviews_count = random.randint(0, 5)
    reviews = []
    for k in range(reviews_count):
        review_id = next_review_id + k
        rating = random.randint(3, 5)
        reviews.append({
            "id": review_id,
            "author": get_random_author_name(),
            "rating": rating,
            "text": get_random_review_text(),
            "date": (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat()
        })
    
    # Calculate average rating
    avg_rating = 0
    if reviews:
        avg_rating = round(sum(r["rating"] for r in reviews) / len(reviews), 1)
    
    return {
        "id": next_route_id,
        "title": get_random_route_name(),
        "description": get_random_description(),
        "path": path,
        "distance": distance,
        "duration": round(distance * 12),  # Approx. walking time
        "difficulty": get_random_difficulty(),
        "rating": avg_rating,
        "author": get_random_author_name(),
        "created_at": (datetime.now() - timedelta(days=random.randint(1, 60))).isoformat(),
        "reviews": reviews
    }

# Calculate the distance of a path in kilometers
def calculate_path_distance(path):
    distance = 0
    
    for i in range(1, len(path)):
        lat1, lng1 = path[i - 1]
        lat2, lng2 = path[i]
        
        distance += get_distance_from_latlon(lat1, lng1, lat2, lng2)
    
    return round(distance * 10) / 10  # Round to 1 decimal place

# Calculate distance between two points using Haversine formula
def get_distance_from_latlon(lat1, lon1, lat2, lon2):
    R = 6371  # Radius of the earth in km
    dlat = deg2rad(lat2 - lat1)
    dlon = deg2rad(lon2 - lon1)
    a = (
        math.sin(dlat / 2) * math.sin(dlat / 2) +
        math.cos(deg2rad(lat1)) * math.cos(deg2rad(lat2)) *
        math.sin(dlon / 2) * math.sin(dlon / 2)
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    d = R * c  # Distance in km
    return d

def deg2rad(deg):
    return deg * (math.pi / 180)

# Helper functions for generating mock data
def get_random_route_name():
    prefixes = ["Scenic", "Historic", "Riverside", "Mountain", "Forest", "City", "Park", "Lake", "Coastal", "Village"]
    types = ["Walk", "Trail", "Route", "Path", "Hike", "Stroll", "Trek", "Journey", "Loop"]
    return f"{random.choice(prefixes)} {random.choice(types)}"

def get_random_description():
    descriptions = [
        "A beautiful walk through nature with stunning views of the surrounding landscape.",
        "This historic route takes you past several landmarks and architectural gems.",
        "A peaceful walk along the river with plenty of spots to rest and enjoy the scenery.",
        "An invigorating trail with some elevation changes and spectacular viewpoints.",
        "A family-friendly route suitable for all ages and fitness levels.",
        "Discover hidden gems and local spots on this charming walk.",
        "A popular route loved by locals and visitors alike for its natural beauty."
    ]
    return random.choice(descriptions)

def get_random_difficulty():
    difficulties = ["easy", "moderate", "hard"]
    weights = [0.5, 0.3, 0.2]  # 50% easy, 30% moderate, 20% hard
    
    rand = random.random()
    cumulative = 0
    
    for i, weight in enumerate(weights):
        cumulative += weight
        if rand <= cumulative:
            return difficulties[i]
    
    return "easy"  # Default fallback

def get_random_author_name():
    first_names = ["Alex", "Jamie", "Jordan", "Casey", "Taylor", "Morgan", "Riley", "Avery", "Quinn", "Skyler"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Garcia", "Rodriguez", "Wilson"]
    return f"{random.choice(first_names)} {random.choice(last_names)}"

def get_random_review_text():
    reviews = [
        "Loved this walk! The views were amazing and the path was easy to follow.",
        "Nice route, but a bit crowded on weekends. Go early if you can.",
        "Great walk for the family. We saw lots of interesting sights along the way.",
        "The directions were spot on and the route was perfect for my fitness level.",
        "Beautiful scenery throughout the entire walk. Highly recommend!",
        "A lovely way to spend an afternoon. The route was well-marked and very scenic.",
        "Perfect length for a morning walk. Some parts were a bit challenging but worth it for the views."
    ]
    return random.choice(reviews)

# Initialize sample data
# initialize_sample_routes()  # Commented out to start with an empty routes list

# API Endpoints
@routes_api.route('/api/routes/nearby', methods=['GET'])
def get_nearby_routes():
    # Get latitude and longitude from query parameters
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    
    # Validate parameters
    if lat is None or lng is None:
        return jsonify({"error": "Latitude and longitude are required"}), 400
    
    # Add a small delay to simulate API call
    time.sleep(0.5)
    
    # Filter routes by distance from the given coordinates
    # In a real app, this would query a database with geospatial capabilities
    nearby_routes = []
    for route in routes_data:
        # Use the first point of the path to calculate distance
        route_lat, route_lng = route["path"][0]
        distance_to_user = get_distance_from_latlon(lat, lng, route_lat, route_lng)
        
        # Consider routes within 10km as "nearby"
        if distance_to_user <= 10:
            # Add a copy of the route with the distance to the user
            route_copy = route.copy()
            route_copy["distance_to_user"] = round(distance_to_user, 1)
            nearby_routes.append(route_copy)
    
    # Sort by distance to user
    nearby_routes.sort(key=lambda x: x["distance_to_user"])
    
    return jsonify(nearby_routes)

@routes_api.route('/api/routes/<int:route_id>', methods=['GET'])
def get_route(route_id):
    # Find the route with the given ID
    route = next((r for r in routes_data if r["id"] == route_id), None)
    
    if route is None:
        return jsonify({"error": "Route not found"}), 404
    
    return jsonify(route)

@routes_api.route('/api/routes', methods=['POST'])
def create_route():
    global next_route_id
    
    # Get route data from request body
    data = request.json
    
    # Get current user from request headers
    current_user = request.headers.get('X-User-Name', 'Anonymous User')
    
    # Validate required fields
    required_fields = ["title", "description", "path", "difficulty", "duration"]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    # Create a new route with proper user information and timestamp
    new_route = {
        "id": next_route_id,
        "title": data["title"],
        "description": data["description"],
        "path": data["path"],
        "distance": calculate_path_distance(data["path"]),
        "duration": data["duration"],
        "difficulty": data["difficulty"],
        "rating": 0,  # New routes start with no rating
        "author": current_user,  # Use the current user's name
        "author_name": current_user,  # Add author_name for consistency
        "created_at": datetime.now().isoformat(),  # Current timestamp
        "reviews": []
    }
    
    # Add the route to the data store
    routes_data.append(new_route)
    next_route_id += 1
    
    return jsonify(new_route), 201

@routes_api.route('/api/routes/<int:route_id>/reviews', methods=['POST'])
def add_review(route_id):
    global next_review_id
    
    # Get current user from request headers
    current_user = request.headers.get('X-User-Name', 'Anonymous User')
    
    # Get review data from request body
    data = request.json
    
    # Validate required fields
    if "rating" not in data or "text" not in data:
        return jsonify({"error": "Missing required fields: rating and text"}), 400
    
    # Find the route
    route = next((r for r in routes_data if r["id"] == route_id), None)
    if not route:
        return jsonify({"error": "Route not found"}), 404
    
    # Create new review
    new_review = {
        "id": next_review_id,
        "author": current_user,  # Use the current user's name
        "rating": data["rating"],
        "text": data["text"],
        "date": datetime.now().isoformat()  # Use current timestamp
    }
    
    # Add review to route
    route["reviews"].append(new_review)
    next_review_id += 1
    
    # Update route rating
    if route["reviews"]:
        route["rating"] = round(sum(r["rating"] for r in route["reviews"]) / len(route["reviews"]), 1)
    
    return jsonify(new_review), 201

@routes_api.route('/api/routes/<int:route_id>', methods=['DELETE'])
def delete_route(route_id):
    # Get current user from request headers
    current_user = request.headers.get('X-User-Name', 'Anonymous User')
    
    # Find the route
    route = next((r for r in routes_data if r["id"] == route_id), None)
    if not route:
        return jsonify({"error": "Route not found"}), 404
    
    # Check if the current user is the author
    if route["author"] != current_user:
        return jsonify({"error": "You can only delete your own routes"}), 403
    
    # Remove the route
    routes_data.remove(route)
    return jsonify({"message": "Route deleted successfully"}), 200

@routes_api.route('/api/routes/filter', methods=['GET'])
def filter_routes():
    # Get filter parameters
    distance = request.args.get('distance')
    min_rating = request.args.get('rating', type=float)
    difficulty = request.args.get('difficulty')
    
    # Copy the original data
    filtered_routes = routes_data.copy()
    
    # Apply distance filter
    if distance:
        if distance == 'short':
            filtered_routes = [r for r in filtered_routes if r["distance"] < 2]
        elif distance == 'medium':
            filtered_routes = [r for r in filtered_routes if 2 <= r["distance"] <= 5]
        elif distance == 'long':
            filtered_routes = [r for r in filtered_routes if r["distance"] > 5]
    
    # Apply rating filter
    if min_rating is not None:
        filtered_routes = [r for r in filtered_routes if r["rating"] >= min_rating]
    
    # Apply difficulty filter
    if difficulty and difficulty != 'all':
        filtered_routes = [r for r in filtered_routes if r["difficulty"] == difficulty]
    
    # Sort by rating
    filtered_routes.sort(key=lambda x: x["rating"], reverse=True)
    
    return jsonify(filtered_routes) 