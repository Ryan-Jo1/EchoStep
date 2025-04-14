// Global variables
let map;
let userLocation = null;
let routesData = [];
let activeRoute = null;
let routeLayer = null;
let drawingRoute = false;
let newRoutePath = [];
let newRouteLayer = null;
let createRouteMap = null; // Variable to track the create route map instance

// User preferences
let userDistanceUnit = 'km'; // Default to kilometers
let userCurrency = 'USD'; // Default currency

// Local storage keys
const ROUTES_STORAGE_KEY = 'travelapp_routes';

// Load user preferences from localStorage
function loadUserPreferences() {
    const storedPrefs = localStorage.getItem('userPreferences');
    if (storedPrefs) {
        const prefs = JSON.parse(storedPrefs);
        
        const previousUnit = userDistanceUnit;
        
        if (prefs.distanceUnit) {
            userDistanceUnit = prefs.distanceUnit;
            console.log('Using distance unit from preferences:', userDistanceUnit);
            
            // If the unit has changed, update all displayed routes
            if (previousUnit !== userDistanceUnit && routesData.length > 0) {
                // Update all displayed routes with the new unit
                displayRoutes(routesData);
                
                // Update map popups if the map and routeLayer exist
                if (map && routeLayer) {
                    // Remove existing route layer
                    map.removeLayer(routeLayer);
                    // Add routes back with updated distance units
                    addRoutesToMap(routesData);
                }
                
                // If detail modal is open, update the displayed distance
                if (activeRoute && document.getElementById('route-detail-modal').classList.contains('show')) {
                    document.getElementById('route-distance').innerText = formatDistance(activeRoute.distance);
                }
            }
        }
        
        if (prefs.currency) {
            userCurrency = prefs.currency;
            console.log('Using currency from preferences:', userCurrency);
        }
    }
}

// Functions for route persistence
function saveRoutesToLocalStorage() {
    localStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(routesData));
    console.log('Routes saved to localStorage:', routesData.length);
}

function loadRoutesFromLocalStorage() {
    const savedRoutes = localStorage.getItem(ROUTES_STORAGE_KEY);
    if (savedRoutes) {
        try {
            routesData = JSON.parse(savedRoutes);
            console.log('Routes loaded from localStorage:', routesData.length);
            return true;
        } catch (error) {
            console.error('Error parsing saved routes:', error);
            return false;
        }
    }
    return false;
}

// Convert distance based on user preference and format for display
// This function both converts between km and miles and formats with the appropriate unit label
// Used throughout the app to display distances consistently based on user preferences
function formatDistance(distanceKm) {
    if (userDistanceUnit === 'mi') {
        // Convert km to miles (1 km = 0.621371 miles)
        const miles = distanceKm * 0.621371;
        return `${miles.toFixed(1)} mi`;
    } else {
        return `${distanceKm.toFixed(1)} km`;
    }
}

// Convert distance for calculations (returns numeric value only)
function convertDistance(distanceKm) {
    if (userDistanceUnit === 'mi') {
        return distanceKm * 0.621371; // Convert to miles
    } else {
        return distanceKm; // Keep as km
    }
}

// Get distance with unit label
function getDistanceWithUnit(distanceKm) {
    const convertedValue = convertDistance(distanceKm);
    return `${convertedValue.toFixed(1)} ${userDistanceUnit === 'mi' ? 'mi' : 'km'}`;
}

// DOM Elements
const locateBtn = document.getElementById('locate-me');
const locationStatus = document.getElementById('location-status');
const routesList = document.getElementById('routes-list');
const mapOverlay = document.getElementById('map-overlay');
const routesLoading = document.getElementById('routes-loading');
const addRouteBtn = document.getElementById('add-route-btn');
const routeDetailModal = document.getElementById('route-detail-modal');
const addRouteModal = document.getElementById('add-route-modal');
const modalCloseButtons = document.querySelectorAll('.close-modal');

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Load user preferences first
    loadUserPreferences();
    
    // Initialize map with a default location
    initMap();
    
    // Manually trigger a window resize event to ensure the map renders correctly
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        if (map) {
            map.invalidateSize();
        }
    }, 500);
    
    // Event listeners
    locateBtn.addEventListener('click', getUserLocation);
    addRouteBtn.addEventListener('click', showAddRouteModal);
    
    // Close modal buttons
    modalCloseButtons.forEach(button => {
        button.addEventListener('click', () => {
            routeDetailModal.classList.remove('show');
            addRouteModal.classList.remove('show');
        });
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', event => {
        if (event.target === routeDetailModal) {
            routeDetailModal.classList.remove('show');
        }
        if (event.target === addRouteModal) {
            addRouteModal.classList.remove('show');
        }
    });
    
    // Filter event listeners
    document.getElementById('distance-filter').addEventListener('change', applyFilters);
    document.getElementById('rating-filter').addEventListener('change', applyFilters);
    document.getElementById('difficulty-filter').addEventListener('change', applyFilters);
    
    // Route type filter (all/user routes)
    document.getElementById('route-type-filter').addEventListener('change', applyFilters);
    
    // Add route form controls
    document.getElementById('draw-route').addEventListener('click', startDrawingRoute);
    document.getElementById('finish-drawing').addEventListener('click', finishDrawingRoute);
    document.getElementById('clear-route').addEventListener('click', clearDrawnRoute);
    document.getElementById('submit-route').addEventListener('click', submitNewRoute);
    
    // Review submission
    document.getElementById('submit-review').addEventListener('click', submitReview);
    
    // Rating selection
    const ratingStars = document.querySelectorAll('#rating-select span');
    ratingStars.forEach(star => {
        star.addEventListener('click', () => {
            const rating = parseInt(star.dataset.rating);
            highlightStars(rating);
        });
        
        // Add hover effects for better UX
        star.addEventListener('mouseenter', () => {
            const rating = parseInt(star.dataset.rating);
            const stars = document.querySelectorAll('#rating-select span');
            stars.forEach((s, index) => {
                if (index < rating) {
                    s.classList.add('hover');
                } else {
                    s.classList.remove('hover');
                }
            });
        });
        
        star.addEventListener('mouseleave', () => {
            document.querySelectorAll('#rating-select span').forEach(s => {
                s.classList.remove('hover');
            });
        });
    });
    
    // Listen for preference changes event
    window.addEventListener('userPreferencesChanged', () => {
        loadUserPreferences();
    });
    
    // Load routes from localStorage when the app starts
    loadRoutesFromLocalStorage();
    
    // Initially display all routes if we have some loaded
    if (routesData.length > 0) {
        displayRoutes(routesData);
        addRoutesToMap(routesData);
    }
});

// Map initialization
function initMap(center = [48.856614, 2.3522219]) {  // Default to Paris
    map = L.map('map').setView(center, 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Hide the loading overlay once the map is loaded
    mapOverlay.style.display = 'none';
}

// Initialize detail map for route viewing
function initDetailMap(center, pathCoordinates) {
    const detailMap = L.map('detail-map').setView(center, 14);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(detailMap);
    
    // Add route path
    L.polyline(pathCoordinates, {
        color: '#3498db',
        weight: 5,
        opacity: 0.7
    }).addTo(detailMap);
    
    // Add start and end markers
    const startIcon = L.divIcon({
        html: '<div style="background-color:#10b981;width:12px;height:12px;border-radius:50%;border:2px solid white;"></div>',
        className: 'start-marker',
        iconSize: [16, 16]
    });
    
    const endIcon = L.divIcon({
        html: '<div style="background-color:#e74c3c;width:12px;height:12px;border-radius:50%;border:2px solid white;"></div>',
        className: 'end-marker',
        iconSize: [16, 16]
    });
    
    L.marker(pathCoordinates[0], { icon: startIcon }).addTo(detailMap);
    L.marker(pathCoordinates[pathCoordinates.length - 1], { icon: endIcon }).addTo(detailMap);
    
    return detailMap;
}

// Initialize map for creating a new route
function initCreateRouteMap(center) {
    // Ensure we have valid coordinates
    if (!center || !Array.isArray(center) || center.length !== 2) {
        // Try to use stored user location from localStorage
        const storedLocation = localStorage.getItem('userLocation');
        if (storedLocation) {
            try {
                center = JSON.parse(storedLocation);
                console.log('Using stored user location:', center);
            } catch (e) {
                console.error('Failed to parse stored location:', e);
                center = [48.856614, 2.3522219]; // Default to Paris if parsing fails
            }
        } else {
            center = [48.856614, 2.3522219]; // Default to Paris if no valid center
            console.log('Using default center coordinates:', center);
        }
    }
    
    // Create the map
    const createMap = L.map('create-route-map', {
        center: center,
        zoom: 14,
        // Add sleep option to allow proper initialization in modal
        sleep: false,
        sleepTime: 750,
        wakeTime: 750,
        sleepNote: false,
        // Make the map more responsive
        preferCanvas: true
    });
    
    // Add the tile layer to make the map visible
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(createMap);
    
    // Add click event handler for route drawing
    createMap.on('click', function(e) {
        if (drawingRoute) {
            const coords = [e.latlng.lat, e.latlng.lng];
            addPointToRoute(coords, createMap);
            
            // Show real-time feedback to user
            const pointCount = newRoutePath.length;
            document.getElementById('drawing-status').innerHTML = 
                `<span class="badge">${pointCount}</span> points added. Click to add more points.`;
            
            // Enable finish button after adding at least 2 points
            if (pointCount >= 2) {
                document.getElementById('finish-drawing').removeAttribute('disabled');
            }
        }
    });
    
    // Force map to update its size and display
    setTimeout(function() {
        createMap.invalidateSize(true);
    }, 100);
    
    return createMap;
}

// Get user's location and find nearby routes
function getUserLocation() {
    // Update status
    locationStatus.innerHTML = 'Finding your location...';
    locationStatus.className = 'location-status warning';
    
    // Show map loading state
    mapOverlay.style.display = 'flex';
    
    // Get user-created routes to preserve them
    const currentUser = getCurrentUser();
    const userCreatedRoutes = currentUser ? 
        routesData.filter(route => route.author === currentUser.name) : [];
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            // Success callback
            (position) => {
                const { latitude, longitude } = position.coords;
                userLocation = [latitude, longitude];
                
                // Store the location in localStorage for persistence
                localStorage.setItem('userLocation', JSON.stringify(userLocation));
                
                // Update map
                map.setView(userLocation, 14);
                L.marker(userLocation).addTo(map)
                    .bindPopup('You are here')
                    .openPopup();
                
                // Remove map loading overlay
                mapOverlay.style.display = 'none';
                
                // Update status
                locationStatus.innerHTML = 'Location found! Finding routes near you...';
                locationStatus.className = 'location-status info';
                
                // Fetch nearby routes
                fetchNearbyRoutes(latitude, longitude)
                    .then(() => {
                        // Once routes are fetched, add back user-created routes if they aren't already included
                        if (userCreatedRoutes.length > 0) {
                            // Add user routes that aren't already in the data
                            userCreatedRoutes.forEach(userRoute => {
                                if (!routesData.some(r => r.id === userRoute.id)) {
                                    routesData.push(userRoute);
                                }
                            });
                            
                            // Save the combined routes
                            saveRoutesToLocalStorage();
                            
                            // Update display
                            displayRoutes(routesData);
                            addRoutesToMap(routesData);
                        }
                    });
            },
            // Error callback
            (error) => {
                console.error('Error getting location:', error);
                
                mapOverlay.style.display = 'none';
                
                // Handle errors
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        locationStatus.innerHTML = 'Location access denied. Please enable location services and refresh the page.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        locationStatus.innerHTML = 'Location information is unavailable. Using a default location.';
                        break;
                    case error.TIMEOUT:
                        locationStatus.innerHTML = 'Location request timed out. Using a default location.';
                        break;
                    default:
                        locationStatus.innerHTML = 'An unknown error occurred. Using a default location.';
                }
                locationStatus.className = 'location-status error';
                
                // Use a default location (e.g., center of the city)
                userLocation = [48.856614, 2.3522219]; // Paris as default
                map.setView(userLocation, 14);
                
                // Try to load routes from localStorage first
                const routesLoaded = loadRoutesFromLocalStorage();
                
                if (routesLoaded && routesData.length > 0) {
                    // Filter by a larger radius since this is a fallback
                    const nearbyRoutes = filterRoutesByLocation(routesData, userLocation[0], userLocation[1], 20); // 20km radius
                    displayRoutes(nearbyRoutes);
                    addRoutesToMap(nearbyRoutes);
                } else {
                    // Generate mock routes
                    const mockRoutes = generateMockRoutes(userLocation[0], userLocation[1]);
                    routesData = mockRoutes;
                    displayRoutes(routesData);
                    addRoutesToMap(routesData);
                    
                    // Save generated routes
                    saveRoutesToLocalStorage();
                }
            }
        );
    } else {
        locationStatus.innerHTML = 'Geolocation is not supported by your browser. Using a default location.';
        locationStatus.className = 'location-status error';
        
        mapOverlay.style.display = 'none';
        
        // Use a default location
        userLocation = [48.856614, 2.3522219]; // Paris as default
        map.setView(userLocation, 14);
        
        // Try to load or generate routes
        const routesLoaded = loadRoutesFromLocalStorage();
        
        if (routesLoaded && routesData.length > 0) {
            displayRoutes(routesData);
            addRoutesToMap(routesData);
        } else {
            const mockRoutes = generateMockRoutes(userLocation[0], userLocation[1]);
            routesData = mockRoutes;
            displayRoutes(routesData);
            addRoutesToMap(routesData);
            
            // Save generated routes
            saveRoutesToLocalStorage();
        }
    }
}

// Fetch routes near the user
async function fetchNearbyRoutes(lat, lng) {
    routesLoading.style.display = 'flex';
    
    try {
        // Use localhost URL with correct port
        const response = await fetch(`http://localhost:5000/api/routes/nearby?lat=${lat}&lng=${lng}`);
        
        // Check for non-JSON responses or server errors
        const contentType = response.headers.get('content-type');
        if (!response.ok || !contentType || !contentType.includes('application/json')) {
            throw new Error('Failed to fetch routes or invalid response format');
        }
        
        const data = await response.json();
        
        // Store existing routes data to preserve reviews
        const existingRoutes = [...routesData];
        
        // Update routes with new data, but preserve existing reviews
        routesData = data.map(newRoute => {
            // Check if we already have this route in our existing data
            const existingRoute = existingRoutes.find(r => r.id === newRoute.id);
            if (existingRoute && existingRoute.reviews && existingRoute.reviews.length > 0) {
                // Preserve the existing reviews and rating
                newRoute.reviews = existingRoute.reviews;
                
                // Recalculate the average rating based on reviews
                if (newRoute.reviews.length > 0) {
                    const avgRating = (newRoute.reviews.reduce((sum, r) => sum + r.rating, 0) / newRoute.reviews.length).toFixed(1);
                    newRoute.rating = parseFloat(avgRating);
                }
            }
            return newRoute;
        });
        
        displayRoutes(routesData);
        addRoutesToMap(routesData);
        
        // Update status if no routes are found
        if (routesData.length === 0) {
            locationStatus.innerHTML = 'No routes found in this area. Why not add one?';
            locationStatus.className = 'location-status info';
        } else {
            locationStatus.innerHTML = `Found ${routesData.length} routes near your location.`;
            locationStatus.className = 'location-status success';
        }
        
        // Save to localStorage for persistence
        saveRoutesToLocalStorage();
        
        routesLoading.style.display = 'none';
    } catch (error) {
        console.error('Error fetching routes:', error);
        
        // Try to load routes from localStorage first
        const routesLoaded = loadRoutesFromLocalStorage();
        
        if (routesLoaded && routesData.length > 0) {
            // Filter routes by proximity to current location if we have routes
            const nearbyRoutes = filterRoutesByLocation(routesData, lat, lng, 10); // 10km radius
            displayRoutes(nearbyRoutes);
            addRoutesToMap(nearbyRoutes);
            
            locationStatus.innerHTML = `Found ${nearbyRoutes.length} saved routes near your location.`;
            locationStatus.className = 'location-status success';
        } else {
            // If no saved routes or API fails completely, generate mock routes
            routesData = generateMockRoutes(lat, lng);
            displayRoutes(routesData);
            addRoutesToMap(routesData);
            
            locationStatus.innerHTML = 'Using sample routes. You can add your own routes!';
            locationStatus.className = 'location-status info';
            
            // Save generated routes to localStorage
            saveRoutesToLocalStorage();
        }
        
        routesLoading.style.display = 'none';
    }
}

// Filter routes by proximity to a location
function filterRoutesByLocation(routes, lat, lng, radiusKm) {
    // Create a new array with cloned routes to avoid reference issues
    const filteredRoutes = routes.filter(route => {
        // Use first point of route path for distance calculation
        if (route.path && route.path.length > 0) {
            const routeLat = route.path[0][0];
            const routeLng = route.path[0][1];
            const distance = getDistanceFromLatLonInKm(lat, lng, routeLat, routeLng);
            return distance <= radiusKm;
        }
        return false;
    });
    
    return filteredRoutes;
}

// Function to calculate distance between two points in km using the Haversine formula
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance;
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}

// Generate mock routes for demo purposes
function generateMockRoutes(lat, lng) {
    const routes = [];
    const routeCount = Math.floor(Math.random() * 5) + 8; // 8-12 routes
    
    for (let i = 1; i <= routeCount; i++) {
        // Generate a random path around the user's location
        const pathLength = Math.floor(Math.random() * 10) + 5; // 5-15 points
        const path = [];
        
        // Start point (slightly offset from user location)
        const startLat = lat + (Math.random() * 0.01 - 0.005);
        const startLng = lng + (Math.random() * 0.01 - 0.005);
        path.push([startLat, startLng]);
        
        // Generate path points
        for (let j = 1; j < pathLength; j++) {
            const pointLat = path[j - 1][0] + (Math.random() * 0.004 - 0.002);
            const pointLng = path[j - 1][1] + (Math.random() * 0.004 - 0.002);
            path.push([pointLat, pointLng]);
        }
        
        // Calculate distance (in km)
        const distance = calculatePathDistance(path);
        
        // Create the route object
        routes.push({
            id: i,
            title: getRandomRouteName(),
            description: getRandomDescription(),
            path: path,
            distance: distance,
            duration: Math.round(distance * 12), // Roughly 5km/h walking speed
            difficulty: getRandomDifficulty(),
            rating: (Math.random() * 3 + 2).toFixed(1), // 2.0-5.0 rating
            author: getRandomAuthorName(),
            createdAt: getRandomDate(),
            reviews: generateRandomReviews(Math.floor(Math.random() * 5) + 1) // 1-5 reviews
        });
    }
    
    return routes;
}

// Calculate the distance of a path in kilometers
function calculatePathDistance(path) {
    let distance = 0;
    
    for (let i = 1; i < path.length; i++) {
        const [lat1, lng1] = path[i - 1];
        const [lat2, lng2] = path[i];
        
        distance += getDistanceFromLatLonInKm(lat1, lng1, lat2, lng2);
    }
    
    return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

// Helper functions for generating mock data
function getRandomRouteName() {
    const prefixes = ["Scenic", "Historic", "Riverside", "Mountain", "Forest", "City", "Park", "Lake", "Coastal", "Village"];
    const types = ["Walk", "Trail", "Route", "Path", "Hike", "Stroll", "Trek", "Journey", "Loop"];
    return `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${types[Math.floor(Math.random() * types.length)]}`;
}

function getRandomDescription() {
    const descriptions = [
        "A beautiful walk through nature with stunning views of the surrounding landscape.",
        "This historic route takes you past several landmarks and architectural gems.",
        "A peaceful walk along the river with plenty of spots to rest and enjoy the scenery.",
        "An invigorating trail with some elevation changes and spectacular viewpoints.",
        "A family-friendly route suitable for all ages and fitness levels.",
        "Discover hidden gems and local spots on this charming walk.",
        "A popular route loved by locals and visitors alike for its natural beauty."
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
}

function getRandomDifficulty() {
    const difficulties = ["easy", "moderate", "hard"];
    const weights = [0.5, 0.3, 0.2]; // 50% easy, 30% moderate, 20% hard
    
    const rand = Math.random();
    let sum = 0;
    
    for (let i = 0; i < difficulties.length; i++) {
        sum += weights[i];
        if (rand <= sum) return difficulties[i];
    }
    
    return "easy"; // Default fallback
}

function getRandomAuthorName() {
    const firstNames = ["Alex", "Jamie", "Jordan", "Casey", "Taylor", "Morgan", "Riley", "Avery", "Quinn", "Skyler"];
    const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Garcia", "Rodriguez", "Wilson"];
    return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

function getRandomDate() {
    const now = new Date();
    const pastDays = Math.floor(Math.random() * 60); // Random date in the last 60 days
    const date = new Date(now);
    date.setDate(date.getDate() - pastDays);
    return date;
}

function generateRandomReviews(count) {
    const reviews = [];
    
    for (let i = 0; i < count; i++) {
        reviews.push({
            id: i + 1,
            author: getRandomAuthorName(),
            rating: Math.floor(Math.random() * 3) + 3, // 3-5 stars
            text: getRandomReviewText(),
            date: getRandomDate()
        });
    }
    
    return reviews;
}

function getRandomReviewText() {
    const reviews = [
        "Loved this walk! The views were amazing and the path was easy to follow.",
        "Nice route, but a bit crowded on weekends. Go early if you can.",
        "Great walk for the family. We saw lots of interesting sights along the way.",
        "The directions were spot on and the route was perfect for my fitness level.",
        "Beautiful scenery throughout the entire walk. Highly recommend!",
        "A lovely way to spend an afternoon. The route was well-marked and very scenic.",
        "Perfect length for a morning walk. Some parts were a bit challenging but worth it for the views."
    ];
    return reviews[Math.floor(Math.random() * reviews.length)];
}

// Display routes in the sidebar
function displayRoutes(routes) {
    // Clear the current routes list
    routesList.innerHTML = '';
    routesLoading.style.display = 'none';
    
    // Get stored preferences
    const storedPrefs = localStorage.getItem('userPreferences');
    const prefs = storedPrefs ? JSON.parse(storedPrefs) : {};
    
    // Fetch translations
    const translationKeys = getTranslationKeys();
    const translations = prefs.language && translationKeys[prefs.language] ? 
        translationKeys[prefs.language] : translationKeys['en'];
    
    // If no routes, show message
    if (routes.length === 0) {
        routesList.innerHTML = `<div class="no-routes">${translations.noRoutes}</div>`;
        return;
    }
    
    // Get current user
    const currentUser = getCurrentUser();
    
    // Create a route card for each route
    routes.forEach(route => {
        // Check if this is the user's own route
        const isUserRoute = (route.user_id === 'current-user') || 
                            (currentUser && route.author === currentUser.name) ||
                            (currentUser && route.author_name === currentUser.name);
        
        const formattedDistance = formatDistance(route.distance);
        const formattedDate = formatDate(new Date(route.created_at));
        const stars = generateStarRating(route.rating);
        
        const routeCard = document.createElement('div');
        routeCard.className = 'route-card';
        routeCard.setAttribute('data-route-id', route.id);
        
        // Format distance to user if available
        let distanceToUserText = '';
        if (route.distance_to_user !== undefined) {
            distanceToUserText = `<span class="distance-badge">${formatDistance(route.distance_to_user)} from you</span>`;
        }
        
        // Set the route card HTML
        routeCard.innerHTML = `
            <div class="route-info">
                <h3>${route.title}</h3>
                <div class="route-meta">
                    <span class="route-distance">${formattedDistance}</span>
                    <span class="route-difficulty ${route.difficulty?.toLowerCase()}">${route.difficulty}</span>
                    ${distanceToUserText}
                </div>
                <div class="route-rating">${stars}</div>
                <p class="route-description">${route.description}</p>
                <div class="route-footer">
                    <span class="route-author">${translations.author}: ${route.author_name || route.author}</span>
                    <span class="route-date">${formattedDate}</span>
                </div>
            </div>
            ${isUserRoute ? `<div class="route-actions">
                <button class="delete-route-btn" data-route-id="${route.id}">${translations.delete}</button>
            </div>` : ''}
        `;
        
        // Add the route card to the list
        routesList.appendChild(routeCard);
        
        // Make the entire card clickable to show route details
        routeCard.addEventListener('click', (e) => {
            // Don't trigger if clicking the delete button
            if (!e.target.classList.contains('delete-route-btn')) {
                showRouteDetails(route);
            }
        });
        
        // Add event listener for delete button if it exists
        const deleteBtn = routeCard.querySelector('.delete-route-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(translations.confirmDelete)) {
                    deleteRoute(route.id);
                }
            });
        }
    });
}

// Generate HTML for star rating
function generateStarRating(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    
    let starsHTML = '';
    
    // Full stars
    for (let i = 0; i < fullStars; i++) {
        starsHTML += '<span>&#9733;</span>'; // Filled star
    }
    
    // Half star
    if (halfStar) {
        starsHTML += '<span>&#9733;&#xFE0E;</span>'; // Half star
    }
    
    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
        starsHTML += '<span style="color: #cbd5e0;">&#9733;</span>'; // Empty star
    }
    
    return starsHTML;
}

// Format date for display
function formatDate(date) {
    // Convert string date to Date object if needed
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Handle invalid dates
    if (!(dateObj instanceof Date) || isNaN(dateObj)) {
        return 'Unknown date';
    }
    
    const now = new Date();
    const diff = Math.floor((now - dateObj) / (1000 * 60 * 60 * 24)); // Difference in days
    
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    
    // Format the date using toLocaleDateString
    return dateObj.toLocaleDateString();
}

// Add routes to the map
function addRoutesToMap(routes) {
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    
    const routeFeatures = [];
    
    routes.forEach(route => {
        // Create a polyline for each route
        const polyline = L.polyline(route.path, {
            color: getDifficultyColor(route.difficulty),
            weight: 4,
            opacity: 0.7
        });
        
        // Add popup with basic info
        polyline.bindPopup(`
            <strong>${route.title}</strong><br>
            Distance: ${formatDistance(route.distance)}<br>
            Duration: ${route.duration} min<br>
            Difficulty: ${route.difficulty.charAt(0).toUpperCase() + route.difficulty.slice(1)}
        `);
        
        // Add click event to show route details
        polyline.on('click', () => {
            showRouteDetails(route);
        });
        
        routeFeatures.push(polyline);
    });
    
    // Add all routes to a layer group
    routeLayer = L.layerGroup(routeFeatures).addTo(map);
    
    // Fit map bounds to show all routes if there are any
    if (routeFeatures.length > 0) {
        const bounds = L.featureGroup(routeFeatures).getBounds();
        map.fitBounds(bounds, { padding: [50, 50] });
    } else if (userLocation) {
        // If no routes but we have user location, center on that
        map.setView(userLocation, 14);
    }
    
    // Force a map update to ensure all elements render correctly
    setTimeout(() => {
        map.invalidateSize();
    }, 200);
}

// Get color based on difficulty
function getDifficultyColor(difficulty) {
    switch (difficulty) {
        case 'easy': return '#10b981'; // Green
        case 'moderate': return '#f59e0b'; // Yellow/Orange
        case 'hard': return '#ef4444'; // Red
        default: return '#3498db'; // Blue (default)
    }
}

// Show route details in modal
function showRouteDetails(route) {
    // Load user preferences before showing details
    loadUserPreferences();
    
    activeRoute = route;
    
    // Get current user and translations
    const currentUser = getCurrentUser();
    const storedPrefs = localStorage.getItem('userPreferences');
    const prefs = storedPrefs ? JSON.parse(storedPrefs) : {};
    const translationKeys = getTranslationKeys();
    const translations = prefs.language && translationKeys[prefs.language] ? 
        translationKeys[prefs.language] : translationKeys['en'];
    
    // Check if this is the user's own route
    const isUserRoute = (route.user_id === 'current-user') || 
                        (currentUser && route.author === currentUser.name) ||
                        (currentUser && route.author_name === currentUser.name);
    
    // Set modal title with delete button for user's own routes
    const modalHeader = document.querySelector('#route-detail-modal .modal-header');
    modalHeader.innerHTML = `
        <h2 id="modal-route-title">${route.title}</h2>
        ${isUserRoute ? 
            `<button class="delete-detail-btn" data-route-id="${route.id}">${translations.delete}</button>` : 
            ''}
        <button class="close-modal">&times;</button>
    `;
    
    // Add event listener to delete button if it exists
    const deleteDetailBtn = modalHeader.querySelector('.delete-detail-btn');
    if (deleteDetailBtn) {
        deleteDetailBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(translations.confirmDelete)) {
                deleteRoute(route.id);
                routeDetailModal.classList.remove('show');
            }
        });
    }
    
    // Re-add event listener for close button
    modalHeader.querySelector('.close-modal').addEventListener('click', () => {
        routeDetailModal.classList.remove('show');
    });
    
    // Set route stats with formatted distance
    document.getElementById('route-distance').innerText = formatDistance(route.distance);
    document.getElementById('route-duration').innerText = `${route.duration} min`;
    document.getElementById('route-difficulty').innerText = route.difficulty.charAt(0).toUpperCase() + route.difficulty.slice(1);
    
    // Set description
    document.getElementById('route-description').innerText = route.description;
    
    // Set author
    document.getElementById('route-author-name').innerText = route.author_name || route.author;
    
    // Set rating stars
    document.getElementById('route-rating').innerHTML = generateStarRating(route.rating);
    
    // Display reviews
    displayReviews(route.reviews);
    
    // Initialize the detail map
    const centerPoint = getCenterPoint(route.path);
    setTimeout(() => {
        const detailMap = initDetailMap(centerPoint, route.path);
        // Clean up when modal closes
        modalHeader.querySelector('.close-modal').addEventListener('click', () => {
            detailMap.remove();
        });
    }, 100);
    
    // Show the modal
    routeDetailModal.classList.add('show');
}

// Get center point of a path
function getCenterPoint(path) {
    if (path.length === 0) return [0, 0];
    
    let latSum = 0;
    let lngSum = 0;
    
    path.forEach(point => {
        latSum += point[0];
        lngSum += point[1];
    });
    
    return [latSum / path.length, lngSum / path.length];
}

// Display reviews for a route
function displayReviews(reviews) {
    const reviewsList = document.getElementById('reviews-list');
    
    if (!reviews || reviews.length === 0) {
        reviewsList.innerHTML = '<p class="empty-reviews">No reviews yet. Be the first to review this route!</p>';
        return;
    }
    
    let reviewsHTML = '';
    
    reviews.forEach(review => {
        // Ensure review has all required fields with defaults
        const reviewData = {
            author: review.author || 'Anonymous',
            rating: review.rating || 0,
            text: review.text || 'No comments provided',
            date: review.date || new Date()
        };
        
        // Format the date safely
        const formattedDate = formatDate(reviewData.date);
        
        reviewsHTML += `
            <div class="review-item">
                <div class="review-header">
                    <span class="review-author">${reviewData.author}</span>
                    <span class="review-rating">${'★'.repeat(reviewData.rating)}</span>
                </div>
                <p class="review-text">${reviewData.text}</p>
                <div class="review-date">${formattedDate}</div>
            </div>
        `;
    });
    
    reviewsList.innerHTML = reviewsHTML;
}

// Highlight stars for rating selection
function highlightStars(rating) {
    const stars = document.querySelectorAll('#rating-select span');
    
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

// Show add route modal
function showAddRouteModal() {
    // Get translations
    const storedPrefs = localStorage.getItem('userPreferences');
    const prefs = storedPrefs ? JSON.parse(storedPrefs) : {};
    const translationKeys = getTranslationKeys();
    const translations = prefs.language && translationKeys[prefs.language] ? 
        translationKeys[prefs.language] : translationKeys['en'];

    // Reset form
    document.getElementById('route-title').value = '';
    document.getElementById('route-desc').value = '';
    document.getElementById('route-difficulty-input').value = 'easy';
    document.getElementById('route-duration-input').value = '';
    
    // Update button and form labels with translations
    document.querySelector('#add-route-modal .modal-header h2').textContent = translations.addRouteBtn;
    document.querySelector('label[for="route-title"]').textContent = translations.routeTitle;
    document.querySelector('label[for="route-desc"]').textContent = translations.routeDescription;
    document.querySelector('label[for="route-difficulty-input"]').textContent = translations.difficulty;
    document.querySelector('label[for="route-duration-input"]').textContent = translations.duration;
    document.getElementById('route-title').placeholder = translations.routeTitle;
    document.getElementById('route-desc').placeholder = translations.routeDescription;
    document.getElementById('draw-route').textContent = translations.startDrawing;
    document.getElementById('finish-drawing').textContent = translations.finishDrawing;
    document.getElementById('clear-route').textContent = translations.clearRoute;
    document.getElementById('submit-route').textContent = translations.submitRoute;
    
    // Update difficulty options with translations
    const difficultySelect = document.getElementById('route-difficulty-input');
    const easyOption = difficultySelect.querySelector('option[value="easy"]');
    const moderateOption = difficultySelect.querySelector('option[value="moderate"]');
    const hardOption = difficultySelect.querySelector('option[value="hard"]');
    
    if (easyOption) easyOption.textContent = translations.easy;
    if (moderateOption) moderateOption.textContent = translations.moderate;
    if (hardOption) hardOption.textContent = translations.hard;
    
    // Clear any previous drawn route
    newRoutePath = [];
    if (newRouteLayer) {
        newRouteLayer.clearLayers();
    }
    
    // Reset drawing state
    drawingRoute = false;
    document.getElementById('draw-route').innerText = translations.startDrawing;
    document.getElementById('draw-route').disabled = false;
    
    // Show the modal first so the map container is visible
    addRouteModal.classList.add('show');
    
    // Force the browser to recognize the layout change
    document.body.offsetHeight;
    
    // Initialize map for route creation AFTER the modal is visible
    const center = userLocation || (map ? map.getCenter() : [48.856614, 2.3522219]);
    
    // Make sure the map container has explicit dimensions
    const mapContainer = document.getElementById('create-route-map');
    mapContainer.style.height = '300px';
    mapContainer.style.width = '100%';
    
    // Use a slightly longer timeout to ensure DOM is ready
    setTimeout(() => {
        console.log('Initializing map in modal');
        
        // Check if map container is visible and has dimensions
        console.log('Map container dimensions:', mapContainer.offsetWidth, mapContainer.offsetHeight);
        
        // Check if there's already a map in this container and remove it
        if (createRouteMap && createRouteMap._container) {
            console.log('Removing existing map before creating a new one');
            createRouteMap.remove();
            createRouteMap = null;
        }
        
        // Create new map
        createRouteMap = initCreateRouteMap(center);
        
        // Create a layer group for the new route
        newRouteLayer = L.layerGroup().addTo(createRouteMap);
        
        // Force a redraw of the map
        createRouteMap.invalidateSize(true);
        
        // Clear the drawing status with translated text
        document.getElementById('drawing-status').innerHTML = `${translations.startDrawing} ${translations.routeDescription}`;
        document.getElementById('finish-drawing').setAttribute('disabled', 'disabled');
        
        // Clean up when modal closes
        document.querySelectorAll('.close-modal')[1].addEventListener('click', () => {
            console.log('Closing modal and removing map');
            if (createRouteMap) {
                createRouteMap.remove();
                createRouteMap = null;
            }
            drawingRoute = false;
        });
        
        // Add a second invalidateSize after a bit more time
        setTimeout(() => {
            if (createRouteMap) {
                createRouteMap.invalidateSize(true);
            }
        }, 300);
    }, 500);  // Increased timeout for better reliability
}

// Start drawing a route
function startDrawingRoute() {
    // Get translations
    const storedPrefs = localStorage.getItem('userPreferences');
    const prefs = storedPrefs ? JSON.parse(storedPrefs) : {};
    const translationKeys = getTranslationKeys();
    const translations = prefs.language && translationKeys[prefs.language] ? 
        translationKeys[prefs.language] : translationKeys['en'];
    
    drawingRoute = true;
    document.getElementById('draw-route').innerText = translations.loading;
    document.getElementById('draw-route').disabled = true;
    document.getElementById('finish-drawing').setAttribute('disabled', 'disabled');
    
    // Show instructions to user
    document.getElementById('drawing-status').innerHTML = 
        translations.startDrawing;
    document.getElementById('drawing-status').className = 'drawing-status active';
}

// Add a point to the route being drawn
function addPointToRoute(point, mapInstance) {
    newRoutePath.push(point);
    
    // Clear the current layer and redraw
    newRouteLayer.clearLayers();
    
    // Draw the polyline
    if (newRoutePath.length > 1) {
        L.polyline(newRoutePath, {
            color: '#3498db',
            weight: 4,
            opacity: 0.7
        }).addTo(newRouteLayer);
    }
    
    // Add markers for start and points
    if (newRoutePath.length === 1) {
        // Start marker
        const startIcon = L.divIcon({
            html: '<div style="background-color:#10b981;width:12px;height:12px;border-radius:50%;border:2px solid white;"></div>',
            className: 'start-marker',
            iconSize: [16, 16]
        });
        
        L.marker(newRoutePath[0], { icon: startIcon }).addTo(newRouteLayer);
    }
    
    // Add marker for each point
    const pointIcon = L.divIcon({
        html: '<div style="background-color:#3498db;width:8px;height:8px;border-radius:50%;border:2px solid white;"></div>',
        className: 'point-marker',
        iconSize: [12, 12]
    });
    
    L.marker(point, { icon: pointIcon }).addTo(newRouteLayer);
    
    // If this is the second or later point, calculate and display the current distance
    if (newRoutePath.length > 1) {
        const distance = calculatePathDistance(newRoutePath);
        document.getElementById('route-duration-input').value = Math.round(distance * 12); // Estimate duration
    }
}

// Finish drawing a route
function finishDrawingRoute() {
    // Get translations
    const storedPrefs = localStorage.getItem('userPreferences');
    const prefs = storedPrefs ? JSON.parse(storedPrefs) : {};
    const translationKeys = getTranslationKeys();
    const translations = prefs.language && translationKeys[prefs.language] ? 
        translationKeys[prefs.language] : translationKeys['en'];
    
    drawingRoute = false;
    document.getElementById('draw-route').innerText = translations.startDrawing;
    document.getElementById('draw-route').disabled = false;
    
    if (newRoutePath.length < 2) {
        alert('Please draw a route with at least 2 points.');
        return;
    }
    
    // Add end marker
    const endIcon = L.divIcon({
        html: '<div style="background-color:#e74c3c;width:12px;height:12px;border-radius:50%;border:2px solid white;"></div>',
        className: 'end-marker',
        iconSize: [16, 16]
    });
    
    L.marker(newRoutePath[newRoutePath.length - 1], { icon: endIcon }).addTo(newRouteLayer);
    
    // Calculate and display distance and estimated duration
    const distance = calculatePathDistance(newRoutePath);
    document.getElementById('route-duration-input').value = Math.round(distance * 12);
    
    // Update status
    document.getElementById('drawing-status').innerHTML = 
        `${translations.finishDrawing}: ${newRoutePath.length} ${translations.distance}: ${distance.toFixed(1)} ${userDistanceUnit}`;
    document.getElementById('drawing-status').className = 'drawing-status success';
    
    // Disable finish button after completion
    document.getElementById('finish-drawing').setAttribute('disabled', 'disabled');
}

// Clear the drawn route
function clearDrawnRoute() {
    // Get translations
    const storedPrefs = localStorage.getItem('userPreferences');
    const prefs = storedPrefs ? JSON.parse(storedPrefs) : {};
    const translationKeys = getTranslationKeys();
    const translations = prefs.language && translationKeys[prefs.language] ? 
        translationKeys[prefs.language] : translationKeys['en'];
    
    newRoutePath = [];
    if (newRouteLayer) {
        newRouteLayer.clearLayers();
    }
    
    drawingRoute = false;
    document.getElementById('draw-route').innerText = translations.startDrawing;
    document.getElementById('draw-route').disabled = false;
    document.getElementById('route-duration-input').value = '';
    document.getElementById('finish-drawing').setAttribute('disabled', 'disabled');
    
    // Reset drawing status
    document.getElementById('drawing-status').innerHTML = `${translations.clearRoute}. ${translations.startDrawing}.`;
    document.getElementById('drawing-status').className = 'drawing-status';
}

// Submit a new route
function submitNewRoute() {
    // Get translations
    const storedPrefs = localStorage.getItem('userPreferences');
    const prefs = storedPrefs ? JSON.parse(storedPrefs) : {};
    const translationKeys = getTranslationKeys();
    const translations = prefs.language && translationKeys[prefs.language] ? 
        translationKeys[prefs.language] : translationKeys['en'];
    
    // Get form values
    const title = document.getElementById('route-title').value.trim();
    const description = document.getElementById('route-desc').value.trim();
    const difficulty = document.getElementById('route-difficulty-input').value;
    const duration = parseInt(document.getElementById('route-duration-input').value);
    
    // Validate form
    if (!title) {
        alert(`${translations.routeTitle} ${translations.required}`);
        return;
    }
    
    if (!description) {
        alert(`${translations.routeDescription} ${translations.required}`);
        return;
    }
    
    if (isNaN(duration) || duration <= 0) {
        alert(`${translations.duration} ${translations.required}`);
        return;
    }
    
    if (newRoutePath.length < 2) {
        alert(`${translations.routeDescription} ${translations.required}`);
        return;
    }
    
    // Disable submit button to prevent multiple submissions
    const submitButton = document.getElementById('submit-route');
    submitButton.disabled = true;
    submitButton.textContent = translations.loading;
    
    // Calculate route distance
    const distance = calculatePathDistance(newRoutePath);
    
    // Create route object
    const newRoute = {
        id: 'route_' + Date.now(),
        title: title,
        description: description,
        path: newRoutePath,
        distance: distance,
        duration: duration,
        difficulty: difficulty,
        author_name: 'You',
        rating: 0,
        reviews: [],
        created_at: new Date().toISOString(),
        user_id: 'current-user' // Mark as created by current user
    };
    
    // First try the API call
    const API_BASE_URL = 'http://localhost:5000/api';
    
    fetch(`${API_BASE_URL}/routes`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(newRoute)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log('Route successfully submitted to API:', data);
        handleRouteSubmissionSuccess(data);
    })
    .catch(error => {
        console.warn('Failed to submit route to API, falling back to local storage:', error);
        
        // Fallback to local storage
        handleRouteSubmissionSuccess(newRoute);
    });
}

// Handle successful route submission (whether from API or local)
function handleRouteSubmissionSuccess(newRoute) {
    // Close the modal first
    addRouteModal.classList.remove('show');
    
    // Add the new route to the data
    routesData.push(newRoute);
    
    // Save to localStorage
    saveRoutesToLocalStorage();
    
    // Update the display
    displayRoutes(routesData);
    
    // Clear the map and add routes
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    
    // Add route to map with animation
    setTimeout(() => {
        addRoutesToMap(routesData);
        
        // Zoom to the new route
        const newRouteBounds = L.polyline(newRoute.path).getBounds();
        map.fitBounds(newRouteBounds, { padding: [50, 50] });
        
        // Show a success message
        locationStatus.innerHTML = 'Your route has been added successfully!';
        locationStatus.className = 'location-status success';
        
        // Clear the status after a few seconds
        setTimeout(() => {
            locationStatus.innerHTML = '';
            locationStatus.className = 'location-status';
        }, 3000);
    }, 500);
    
    // Reset form states
    document.getElementById('submit-route').disabled = false;
    document.getElementById('submit-route').textContent = 'Submit Route';
}

// Submit a review for a route
function submitReview() {
    if (!activeRoute) return;
    
    const reviewText = document.getElementById('review-text').value.trim();
    const ratingStars = document.querySelectorAll('#rating-select span.active');
    const rating = ratingStars.length;
    
    // Validate inputs
    if (!reviewText) {
        alert('Please enter your review text.');
        return;
    }
    
    if (rating === 0) {
        alert('Please select a rating.');
        return;
    }
    
    // Check if user is logged in
    const currentUser = getCurrentUser();
    const authorName = currentUser ? currentUser.name : 'Anonymous User';
    
    // Create a new review object with current date and user information
    const newReview = {
        id: Math.floor(Math.random() * 10000) + 1000, // Generate random ID
        rating,
        text: reviewText,
        author: authorName,
        date: new Date().toISOString()
    };
    
    // Disable submit button
    document.getElementById('submit-review').disabled = true;
    document.getElementById('submit-review').textContent = 'Submitting...';
    
    // Client-side approach: Add the review directly to the active route
    // Find the route in the routesData array
    const routeIndex = routesData.findIndex(r => r.id === activeRoute.id);
    
    if (routeIndex !== -1) {
        // Add the new review to the route's reviews array
        routesData[routeIndex].reviews.push(newReview);
        
        // Recalculate the route's average rating
        const reviews = routesData[routeIndex].reviews;
        const avgRating = reviews.length > 0 
            ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
            : 0;
        
        routesData[routeIndex].rating = parseFloat(avgRating);
        
        // Update active route reference
        activeRoute = routesData[routeIndex];
        
        // Update the reviews display
        displayReviews(activeRoute.reviews);
        
        // Update the route rating display
        document.getElementById('route-rating').innerHTML = generateStarRating(activeRoute.rating);
        
        // Clear the review form
        document.getElementById('review-text').value = '';
        highlightStars(0);
        
        // Display success message
        const successMsg = document.createElement('div');
        successMsg.className = 'review-success-message';
        successMsg.textContent = 'Your review has been added successfully!';
        
        const reviewForm = document.querySelector('.add-review');
        reviewForm.insertBefore(successMsg, document.getElementById('submit-review'));
        
        // Remove the success message after 3 seconds
        setTimeout(() => {
            if (successMsg.parentNode) {
                successMsg.parentNode.removeChild(successMsg);
            }
        }, 3000);
        
        // Save changes to localStorage
        saveRoutesToLocalStorage();
        
        // Update the list of routes to reflect the new rating
        displayRoutes(routesData);
    }
    
    // Re-enable the submit button
    document.getElementById('submit-review').disabled = false;
    document.getElementById('submit-review').textContent = 'Submit Review';
}

// Delete a route
function deleteRoute(routeId) {
    // Get translations
    const storedPrefs = localStorage.getItem('userPreferences');
    const prefs = storedPrefs ? JSON.parse(storedPrefs) : {};
    const translationKeys = getTranslationKeys();
    const translations = prefs.language && translationKeys[prefs.language] ? 
        translationKeys[prefs.language] : translationKeys['en'];
    
    const index = routesData.findIndex(route => route.id === routeId);
    if (index === -1) return;
    
    const routeToDelete = routesData[index];
    
    // Remove route from array
    routesData.splice(index, 1);
    
    // Update localStorage
    saveRoutesToLocalStorage();
    
    // Update display
    displayRoutes(routesData);
    
    // Remove from map
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    
    // Add routes back to map (except the deleted one)
    addRoutesToMap(routesData);
    
    // Show a success message
    locationStatus.innerHTML = `Route "${routeToDelete.title}" has been deleted.`;
    locationStatus.className = 'location-status success';
    
    // Clear the status after a few seconds
    setTimeout(() => {
        locationStatus.innerHTML = '';
        locationStatus.className = 'location-status';
    }, 3000);
}

// Apply filters to the routes
function applyFilters() {
    const distanceFilter = document.getElementById('distance-filter').value;
    const ratingFilter = document.getElementById('rating-filter').value;
    const difficultyFilter = document.getElementById('difficulty-filter').value;
    const routeTypeFilter = document.getElementById('route-type-filter').value;
    
    // Show loading state
    routesLoading.style.display = 'flex';
    
    // Build query string
    let query = '/api/routes/filter?';
    if (distanceFilter !== 'all') {
        query += `distance=${distanceFilter}&`;
    }
    if (ratingFilter !== 'all') {
        query += `rating=${ratingFilter}&`;
    }
    if (difficultyFilter !== 'all') {
        query += `difficulty=${difficultyFilter}&`;
    }
    
    // Remove trailing &
    if (query.endsWith('&')) {
        query = query.slice(0, -1);
    }
    
    // Try to use the API first, but have local fallback ready
    let useLocalFiltering = true;
    
    if (useLocalFiltering) {
        // Apply filters locally
        let filteredRoutes = [...routesData];
        
        // Filter by distance
        if (distanceFilter !== 'all') {
            switch (distanceFilter) {
                case 'short':
                    filteredRoutes = filteredRoutes.filter(route => route.distance < 2);
                    break;
                case 'medium':
                    filteredRoutes = filteredRoutes.filter(route => route.distance >= 2 && route.distance <= 5);
                    break;
                case 'long':
                    filteredRoutes = filteredRoutes.filter(route => route.distance > 5);
                    break;
            }
        }
        
        // Filter by rating
        if (ratingFilter !== 'all') {
            const minRating = parseInt(ratingFilter);
            filteredRoutes = filteredRoutes.filter(route => route.rating >= minRating);
        }
        
        // Filter by difficulty
        if (difficultyFilter !== 'all') {
            filteredRoutes = filteredRoutes.filter(route => route.difficulty === difficultyFilter);
        }
        
        // Filter by route type (all/user routes)
        if (routeTypeFilter === 'user') {
            const currentUser = getCurrentUser();
            if (currentUser) {
                filteredRoutes = filteredRoutes.filter(route => route.author === currentUser.name);
            } else {
                // If not logged in but "my routes" selected, show nothing
                filteredRoutes = [];
            }
        }
        
        displayRoutes(filteredRoutes);
        addRoutesToMap(filteredRoutes);
        
        routesLoading.style.display = 'none';
    }
    else {
        // Fetch filtered routes from API
        fetch(query)
            .then(response => {
                if (!response.ok) throw new Error('Filter request failed');
                return response.json();
            })
            .then(data => {
                // Apply the route type filter (user routes) since API might not support it
                if (routeTypeFilter === 'user') {
                    const currentUser = getCurrentUser();
                    if (currentUser) {
                        data = data.filter(route => route.author === currentUser.name);
                    } else {
                        data = [];
                    }
                }
                
                displayRoutes(data);
                addRoutesToMap(data);
            })
            .catch(error => {
                console.error('Error applying filters:', error);
                
                // If the API call fails, apply filters locally as fallback
                let filteredRoutes = [...routesData];
                
                // Apply filters locally (same logic as in our backend)
                if (distanceFilter !== 'all') {
                    switch (distanceFilter) {
                        case 'short':
                            filteredRoutes = filteredRoutes.filter(route => route.distance < 2);
                            break;
                        case 'medium':
                            filteredRoutes = filteredRoutes.filter(route => route.distance >= 2 && route.distance <= 5);
                            break;
                        case 'long':
                            filteredRoutes = filteredRoutes.filter(route => route.distance > 5);
                            break;
                    }
                }
                
                if (ratingFilter !== 'all') {
                    const minRating = parseInt(ratingFilter);
                    filteredRoutes = filteredRoutes.filter(route => route.rating >= minRating);
                }
                
                if (difficultyFilter !== 'all') {
                    filteredRoutes = filteredRoutes.filter(route => route.difficulty === difficultyFilter);
                }
                
                // Apply route type filter
                if (routeTypeFilter === 'user') {
                    const currentUser = getCurrentUser();
                    if (currentUser) {
                        filteredRoutes = filteredRoutes.filter(route => route.author === currentUser.name);
                    } else {
                        filteredRoutes = [];
                    }
                }
                
                displayRoutes(filteredRoutes);
                addRoutesToMap(filteredRoutes);
            })
            .finally(() => {
                routesLoading.style.display = 'none';
            });
    }
}

// Helper function to get translation keys
function getTranslationKeys() {
    return {
        'en': {
            'routesTitle': 'Discover Local Walking Routes',
            'routesSubtitle': 'Find popular walks near you or share your own adventures',
            'locateMe': 'Find Routes Near Me',
            'filterRoutesHeading': 'Filter Routes',
            'distanceLabel': 'Distance:',
            'ratingLabel': 'Rating:',
            'difficultyLabel': 'Difficulty:',
            'showLabel': 'Show:',
            'addYourRoute': 'Add Your Route',
            'findingRoutes': 'Finding nearby routes...',
            'loadingMap': 'Loading map...',
            'allDistances': 'All Distances',
            'short': 'Short (< 2km)',
            'medium': 'Medium (2-5km)',
            'long': 'Long (> 5km)',
            'allRatings': 'All Ratings',
            'allDifficulties': 'All Difficulties',
            'easy': 'Easy',
            'moderate': 'Moderate',
            'challenging': 'Challenging',
            'allRoutes': 'All Routes',
            'myRoutes': 'My Routes',
            'createdBy': 'Created by:',
            'reviews': 'Reviews',
            'addReview': 'Add Your Review',
            'reviewPlaceholder': 'Share your experience...',
            'submitReview': 'Submit Review',
            'addNewRoute': 'Add New Walking Route',
            'routeTitle': 'Route Title',
            'routeTitlePlaceholder': 'Enter a descriptive title',
            'description': 'Description',
            'routeDescPlaceholder': 'Describe the walking route, points of interest, etc.',
            'difficultyInput': 'Difficulty',
            'durationInput': 'Estimated Duration (minutes)',
            'durationPlaceholder': 'Duration in minutes',
            'drawRoute': 'Draw Route on Map',
            'startDrawing': 'Start Drawing',
            'finishDrawing': 'Finish Drawing',
            'clearRoute': 'Clear',
            'drawingStatus': 'Click "Start Drawing" to begin creating your route.',
            'drawingHint': 'Click on the map to add points. Use "Finish Drawing" when you\'re done.',
            'submitRoute': 'Submit Route',
            'noRoutesFound': 'No routes found in this area.',
            'tryDifferentLocation': 'Try a different location or add your own route.',
            'locationError': 'Error getting your location. Please try again.',
            'permissionDenied': 'Location permission denied. Please enable location access.',
            'locationUnavailable': 'Location information is unavailable.',
            'locationTimeout': 'Request for location timed out.',
            'locationUnknownError': 'An unknown error occurred while getting your location.',
            'routeAddSuccess': 'Your route has been added successfully!',
            'routeAddError': 'Error adding route. Please try again.',
            'reviewAddSuccess': 'Your review has been added.',
            'reviewAddError': 'Error adding review. Please try again.',
            'invalidRouteData': 'Please fill in all required fields.',
            'routeTooShort': 'Route is too short. Please add more points.',
            'confirmDeleteRoute': 'Are you sure you want to delete this route?',
            'noReviewText': 'Please enter your review text.',
            'noRatingSelected': 'Please select a rating.',
            'startDrawingFirst': 'Please start drawing first.',
            'clickMapToAddPoints': 'Click on the map to add points to your route.',
            'finishDrawingFirst': 'Please finish drawing before submitting.'
        },
        'es': {
            'routesTitle': 'Descubre Rutas de Caminata Locales',
            'routesSubtitle': 'Encuentra caminatas populares cerca de ti o comparte tus propias aventuras',
            'nearMeBtn': 'Encontrar Rutas Cercanas',
            'filterRoutes': 'Filtrar Rutas',
            'addRouteBtn': 'Agregar Tu Ruta',
            'viewDetails': 'Ver Detalles',
            'delete': 'Eliminar',
            'distance': 'Distancia',
            'difficulty': 'Dificultad',
            'duration': 'Duración',
            'rating': 'Calificación',
            'author': 'Autor',
            'reviews': 'Reseñas',
            'all': 'Todas',
            'easy': 'Fácil',
            'moderate': 'Moderada',
            'hard': 'Difícil',
            'short': 'Corta',
            'medium': 'Media',
            'long': 'Larga',
            'closeModal': 'Cerrar',
            'startDrawing': 'Comenzar a Dibujar',
            'finishDrawing': 'Finalizar Dibujo',
            'clearRoute': 'Borrar Ruta',
            'submitRoute': 'Enviar Ruta',
            'routeTitle': 'Título de la Ruta',
            'routeDescription': 'Descripción de la Ruta',
            'writeReview': 'Escribir una Reseña',
            'submitReview': 'Enviar Reseña',
            'loading': 'Cargando...',
            'noRoutes': 'No se encontraron rutas. Intenta ajustar tus filtros o crear una nueva ruta.',
            'confirmDelete': '¿Estás seguro de que quieres eliminar esta ruta?',
            'required': 'es requerido'
        },
        'fr': {
            'routesTitle': 'Découvrez des Itinéraires de Marche Locaux',
            'routesSubtitle': 'Trouvez des promenades populaires près de chez vous ou partagez vos propres aventures',
            'nearMeBtn': 'Trouver des Itinéraires à Proximité',
            'filterRoutes': 'Filtrer les Itinéraires',
            'addRouteBtn': 'Ajouter Votre Itinéraire',
            'viewDetails': 'Voir les Détails',
            'delete': 'Supprimer',
            'distance': 'Distance',
            'difficulty': 'Difficulté',
            'duration': 'Durée',
            'rating': 'Évaluation',
            'author': 'Auteur',
            'reviews': 'Avis',
            'all': 'Tous',
            'easy': 'Facile',
            'moderate': 'Modérée',
            'hard': 'Difficile',
            'short': 'Courte',
            'medium': 'Moyenne',
            'long': 'Longue',
            'closeModal': 'Fermer',
            'startDrawing': 'Commencer à Dessiner',
            'finishDrawing': 'Terminer le Dessin',
            'clearRoute': 'Effacer l\'Itinéraire',
            'submitRoute': 'Soumettre l\'Itinéraire',
            'routeTitle': 'Titre de l\'Itinéraire',
            'routeDescription': 'Description de l\'Itinéraire',
            'writeReview': 'Écrire un Avis',
            'submitReview': 'Soumettre l\'Avis',
            'loading': 'Chargement...',
            'noRoutes': 'Aucun itinéraire trouvé. Essayez d\'ajuster vos filtres ou de créer un nouvel itinéraire.',
            'confirmDelete': 'Êtes-vous sûr de vouloir supprimer cet itinéraire?',
            'required': 'est requis'
        },
        'de': {
            'routesTitle': 'Entdecken Sie lokale Wanderrouten',
            'routesSubtitle': 'Finden Sie beliebte Spaziergänge in Ihrer Nähe oder teilen Sie Ihre eigenen Abenteuer',
            'nearMeBtn': 'Routen in meiner Nähe finden',
            'filterRoutes': 'Routen filtern',
            'addRouteBtn': 'Ihre Route hinzufügen',
            'viewDetails': 'Details anzeigen',
            'delete': 'Löschen',
            'distance': 'Entfernung',
            'difficulty': 'Schwierigkeit',
            'duration': 'Dauer',
            'rating': 'Bewertung',
            'author': 'Autor',
            'reviews': 'Bewertungen',
            'all': 'Alle',
            'easy': 'Leicht',
            'moderate': 'Mittel',
            'hard': 'Schwer',
            'short': 'Kurz',
            'medium': 'Mittel',
            'long': 'Lang',
            'closeModal': 'Schließen',
            'startDrawing': 'Zeichnen beginnen',
            'finishDrawing': 'Zeichnen beenden',
            'clearRoute': 'Route löschen',
            'submitRoute': 'Route einreichen',
            'routeTitle': 'Routentitel',
            'routeDescription': 'Routenbeschreibung',
            'writeReview': 'Bewertung schreiben',
            'submitReview': 'Bewertung abschicken',
            'loading': 'Wird geladen...',
            'noRoutes': 'Keine Routen gefunden. Versuchen Sie, Ihre Filter anzupassen oder eine neue Route zu erstellen.',
            'confirmDelete': 'Sind Sie sicher, dass Sie diese Route löschen möchten?',
            'required': 'ist erforderlich'
        },
        'it': {
            'routesTitle': 'Scopri Percorsi di Passeggiata Locali',
            'routesSubtitle': 'Trova passeggiate popolari vicino a te o condividi le tue avventure',
            'nearMeBtn': 'Trova Percorsi Vicini',
            'filterRoutes': 'Filtra Percorsi',
            'addRouteBtn': 'Aggiungi il Tuo Percorso',
            'viewDetails': 'Vedi Dettagli',
            'delete': 'Elimina',
            'distance': 'Distanza',
            'difficulty': 'Difficoltà',
            'duration': 'Durata',
            'rating': 'Valutazione',
            'author': 'Autore',
            'reviews': 'Recensioni',
            'all': 'Tutti',
            'easy': 'Facile',
            'moderate': 'Moderata',
            'hard': 'Difficile',
            'short': 'Breve',
            'medium': 'Media',
            'long': 'Lunga',
            'closeModal': 'Chiudi',
            'startDrawing': 'Inizia a Disegnare',
            'finishDrawing': 'Termina Disegno',
            'clearRoute': 'Cancella Percorso',
            'submitRoute': 'Invia Percorso',
            'routeTitle': 'Titolo del Percorso',
            'routeDescription': 'Descrizione del Percorso',
            'writeReview': 'Scrivi una Recensione',
            'submitReview': 'Invia Recensione',
            'loading': 'Caricamento...',
            'noRoutes': 'Nessun percorso trovato. Prova a modificare i filtri o a creare un nuovo percorso.',
            'confirmDelete': 'Sei sicuro di voler eliminare questo percorso?',
            'required': 'è richiesto'
        },
        'pt': {
            'routesTitle': 'Descubra Rotas de Caminhada Locais',
            'routesSubtitle': 'Encontre caminhadas populares perto de você ou compartilhe suas próprias aventuras',
            'nearMeBtn': 'Encontrar Rotas Próximas',
            'filterRoutes': 'Filtrar Rotas',
            'addRouteBtn': 'Adicionar Sua Rota',
            'viewDetails': 'Ver Detalhes',
            'delete': 'Excluir',
            'distance': 'Distância',
            'difficulty': 'Dificuldade',
            'duration': 'Duração',
            'rating': 'Avaliação',
            'author': 'Autor',
            'reviews': 'Avaliações',
            'all': 'Todas',
            'easy': 'Fácil',
            'moderate': 'Moderada',
            'hard': 'Difícil',
            'short': 'Curta',
            'medium': 'Média',
            'long': 'Longa',
            'closeModal': 'Fechar',
            'startDrawing': 'Começar a Desenhar',
            'finishDrawing': 'Finalizar Desenho',
            'clearRoute': 'Limpar Rota',
            'submitRoute': 'Enviar Rota',
            'routeTitle': 'Título da Rota',
            'routeDescription': 'Descrição da Rota',
            'writeReview': 'Escrever uma Avaliação',
            'submitReview': 'Enviar Avaliação',
            'loading': 'Carregando...',
            'noRoutes': 'Nenhuma rota encontrada. Tente ajustar seus filtros ou criar uma nova rota.',
            'confirmDelete': 'Tem certeza que deseja excluir esta rota?',
            'required': 'é obrigatório'
        },
        'ja': {
            'routesTitle': '地元のウォーキングルートを発見',
            'routesSubtitle': '人気のウォーキングコースを見つけたり、自分の冒険を共有しましょう',
            'nearMeBtn': '近くのルートを探す',
            'filterRoutes': 'ルートをフィルタリング',
            'addRouteBtn': 'ルートを追加',
            'viewDetails': '詳細を見る',
            'delete': '削除',
            'distance': '距離',
            'difficulty': '難易度',
            'duration': '時間',
            'rating': '評価',
            'author': '作成者',
            'reviews': 'レビュー',
            'all': 'すべて',
            'easy': '簡単',
            'moderate': '普通',
            'hard': '難しい',
            'short': '短い',
            'medium': '中程度',
            'long': '長い',
            'closeModal': '閉じる',
            'startDrawing': '描画開始',
            'finishDrawing': '描画完了',
            'clearRoute': 'ルートをクリア',
            'submitRoute': 'ルートを送信',
            'routeTitle': 'ルートのタイトル',
            'routeDescription': 'ルートの説明',
            'writeReview': 'レビューを書く',
            'submitReview': 'レビューを送信',
            'loading': '読み込み中...',
            'noRoutes': 'ルートが見つかりません。フィルターを調整するか、新しいルートを作成してみてください。',
            'confirmDelete': 'このルートを削除してもよろしいですか？',
            'required': 'は必須です'
        },
        'zh': {
            'routesTitle': '发现当地步行路线',
            'routesSubtitle': '找到您附近的热门步行路线或分享您自己的冒险',
            'nearMeBtn': '查找附近的路线',
            'filterRoutes': '筛选路线',
            'addRouteBtn': '添加您的路线',
            'viewDetails': '查看详情',
            'delete': '删除',
            'distance': '距离',
            'difficulty': '难度',
            'duration': '时长',
            'rating': '评分',
            'author': '作者',
            'reviews': '评论',
            'all': '全部',
            'easy': '简单',
            'moderate': '中等',
            'hard': '困难',
            'short': '短程',
            'medium': '中程',
            'long': '长程',
            'closeModal': '关闭',
            'startDrawing': '开始绘制',
            'finishDrawing': '完成绘制',
            'clearRoute': '清除路线',
            'submitRoute': '提交路线',
            'routeTitle': '路线标题',
            'routeDescription': '路线描述',
            'writeReview': '写评论',
            'submitReview': '提交评论',
            'loading': '加载中...',
            'noRoutes': '未找到路线。尝试调整筛选条件或创建新路线。',
            'confirmDelete': '您确定要删除此路线吗？',
            'required': '是必需的'
        },
        'ko': {
            'routesTitle': '주변 경로 탐색',
            'routesSubtitle': '주변의 인기 있는 산책로를 찾거나 직접 경험을 공유하세요',
            'locateMe': '내 주변 경로 찾기',
            'filterRoutesHeading': '경로 필터링',
            'distanceLabel': '거리:',
            'ratingLabel': '평점:',
            'difficultyLabel': '난이도:',
            'showLabel': '표시:',
            'addYourRoute': '내 경로 추가',
            'findingRoutes': '주변 경로 찾는 중...',
            'loadingMap': '지도 로딩 중...',
            'allDistances': '모든 거리',
            'short': '짧은 거리 (< 2km)',
            'medium': '중간 거리 (2-5km)',
            'long': '긴 거리 (> 5km)',
            'allRatings': '모든 평점',
            'allDifficulties': '모든 난이도',
            'easy': '쉬움',
            'moderate': '보통',
            'challenging': '도전적',
            'allRoutes': '모든 경로',
            'myRoutes': '내 경로',
            'createdBy': '작성자:',
            'reviews': '리뷰',
            'addReview': '리뷰 추가',
            'reviewPlaceholder': '경험을 공유하세요...',
            'submitReview': '리뷰 제출',
            'addNewRoute': '새 경로 추가',
            'routeTitle': '경로 제목',
            'routeTitlePlaceholder': '설명적인 제목을 입력하세요',
            'description': '설명',
            'routeDescPlaceholder': '산책로, 관심 지점 등을 설명하세요',
            'difficultyInput': '난이도',
            'durationInput': '예상 소요 시간 (분)',
            'durationPlaceholder': '소요 시간(분)',
            'drawRoute': '지도에 경로 그리기',
            'startDrawing': '그리기 시작',
            'finishDrawing': '그리기 완료',
            'clearRoute': '지우기',
            'drawingStatus': '"그리기 시작"을 클릭하여 경로 생성을 시작하세요.',
            'drawingHint': '지도를 클릭하여 포인트를 추가하세요. 완료되면 "그리기 완료"를 사용하세요.',
            'submitRoute': '경로 제출',
            'noRoutesFound': '이 지역에서 경로를 찾을 수 없습니다.',
            'tryDifferentLocation': '다른 위치를 시도하거나 자신의 경로를 추가하세요.',
            'locationError': '위치를 가져오는 중 오류가 발생했습니다. 다시 시도하세요.',
            'permissionDenied': '위치 권한이 거부되었습니다. 위치 액세스를 활성화하세요.',
            'locationUnavailable': '위치 정보를 사용할 수 없습니다.',
            'locationTimeout': '위치 요청 시간이 초과되었습니다.',
            'locationUnknownError': '위치를 가져오는 중 알 수 없는 오류가 발생했습니다.',
            'routeAddSuccess': '경로가 성공적으로 추가되었습니다!',
            'routeAddError': '경로 추가 중 오류가 발생했습니다. 다시 시도하세요.',
            'reviewAddSuccess': '리뷰가 추가되었습니다.',
            'reviewAddError': '리뷰 추가 중 오류가 발생했습니다. 다시 시도하세요.',
            'invalidRouteData': '모든 필수 필드를 작성하세요.',
            'routeTooShort': '경로가 너무 짧습니다. 더 많은 포인트를 추가하세요.',
            'confirmDeleteRoute': '이 경로를 삭제하시겠습니까?',
            'noReviewText': '리뷰 텍스트를 입력하세요.',
            'noRatingSelected': '평점을 선택하세요.',
            'startDrawingFirst': '먼저 그리기를 시작하세요.',
            'clickMapToAddPoints': '지도를 클릭하여 경로에 포인트를 추가하세요.',
            'finishDrawingFirst': '제출하기 전에 그리기를 완료하세요.'
        }
    };
} 