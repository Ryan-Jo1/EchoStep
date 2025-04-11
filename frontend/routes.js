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

// Local storage keys
const ROUTES_STORAGE_KEY = 'travelapp_routes';

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
        center = [48.856614, 2.3522219]; // Default to Paris if no valid center
        console.log('Using default center coordinates:', center);
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
        const response = await fetch(`/api/routes/nearby?lat=${lat}&lng=${lng}`);
        if (!response.ok) {
            throw new Error('Failed to fetch routes');
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
    if (routes.length === 0) {
        routesList.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <p>No routes found in this area.</p>
                <p class="empty-state-info">Routes are created by users like you! Click the "Add Your Route" button below to create the first route.</p>
                <button id="empty-add-route-btn" class="primary-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M8 0a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2H9v6a1 1 0 1 1-2 0V9H1a1 1 0 0 1 0-2h6V1a1 1 0 0 1 1-1z"/>
                    </svg>
                    Add Your Route
                </button>
            </div>
        `;
        
        // Add click event for the empty state add button
        document.getElementById('empty-add-route-btn').addEventListener('click', showAddRouteModal);
        return;
    }
    
    // Sort routes by rating (highest first)
    routes.sort((a, b) => b.rating - a.rating);
    
    let routesHTML = '';
    
    // Get current user for checking if route belongs to user
    const currentUser = getCurrentUser();
    const currentUsername = currentUser ? currentUser.name : null;
    
    routes.forEach(route => {
        // Generate star rating HTML
        const ratingStars = generateStarRating(route.rating);
        
        // Check if this route belongs to the current user
        const isUserRoute = currentUsername && route.author === currentUsername;
        
        // Add user route class and delete button if it's the user's route
        const userRouteClass = isUserRoute ? 'user-route' : '';
        const deleteButton = isUserRoute ? 
            `<button class="delete-route-btn" data-route-id="${route.id}">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                    <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                </svg>
            </button>` : '';
        
        routesHTML += `
            <div class="route-card ${userRouteClass}" data-route-id="${route.id}">
                <div class="route-card-header">
                    <h4>${route.title}</h4>
                    ${deleteButton}
                </div>
                <div class="route-card-stats">
                    <div class="stat">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
                        </svg>
                        ${route.distance} km
                    </div>
                    <div class="stat">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
                            <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
                        </svg>
                        ${route.duration} min
                    </div>
                    <div class="stat">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828l.645-1.937z"/>
                        </svg>
                        ${route.difficulty.charAt(0).toUpperCase() + route.difficulty.slice(1)}
                    </div>
                </div>
                <div class="route-card-rating">
                    ${ratingStars}
                    <span>(${route.reviews ? route.reviews.length : 0})</span>
                </div>
                <div class="route-card-footer">
                    <span>By ${route.author}</span>
                    <span>${formatDate(route.createdAt)}</span>
                </div>
            </div>
        `;
    });
    
    routesList.innerHTML = routesHTML;
    
    // Add click event listeners to the route cards
    document.querySelectorAll('.route-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't open route details if clicking on delete button
            if (e.target.closest('.delete-route-btn')) {
                return;
            }
            
            const routeId = parseInt(card.dataset.routeId);
            const route = routesData.find(r => r.id === routeId);
            if (route) {
                showRouteDetails(route);
            }
        });
    });
    
    // Add delete button event listeners
    document.querySelectorAll('.delete-route-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent route card click
            const routeId = parseInt(button.dataset.routeId);
            deleteRoute(routeId);
        });
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
            Distance: ${route.distance} km<br>
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
    activeRoute = route;
    
    // Set modal title
    document.getElementById('modal-route-title').innerText = route.title;
    
    // Set route stats
    document.getElementById('route-distance').innerText = `${route.distance} km`;
    document.getElementById('route-duration').innerText = `${route.duration} min`;
    document.getElementById('route-difficulty').innerText = route.difficulty.charAt(0).toUpperCase() + route.difficulty.slice(1);
    
    // Set description
    document.getElementById('route-description').innerText = route.description;
    
    // Set author
    document.getElementById('route-author-name').innerText = route.author;
    
    // Set rating stars
    document.getElementById('route-rating').innerHTML = generateStarRating(route.rating);
    
    // Display reviews
    displayReviews(route.reviews);
    
    // Initialize the detail map
    const centerPoint = getCenterPoint(route.path);
    setTimeout(() => {
        const detailMap = initDetailMap(centerPoint, route.path);
        // Clean up when modal closes
        modalCloseButtons[0].addEventListener('click', () => {
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
    // Reset form
    document.getElementById('route-title').value = '';
    document.getElementById('route-desc').value = '';
    document.getElementById('route-difficulty-input').value = 'easy';
    document.getElementById('route-duration-input').value = '';
    
    // Clear any previous drawn route
    newRoutePath = [];
    if (newRouteLayer) {
        newRouteLayer.clearLayers();
    }
    
    // Reset drawing state
    drawingRoute = false;
    document.getElementById('draw-route').innerText = 'Start Drawing';
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
        
        // Clear the drawing status
        document.getElementById('drawing-status').innerHTML = 'Click "Start Drawing" to begin creating your route.';
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
    drawingRoute = true;
    document.getElementById('draw-route').innerText = 'Drawing...';
    document.getElementById('draw-route').disabled = true;
    document.getElementById('finish-drawing').setAttribute('disabled', 'disabled');
    
    // Show instructions to user
    document.getElementById('drawing-status').innerHTML = 
        'Click on the map to add points to your route. Add at least 2 points.';
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
    drawingRoute = false;
    document.getElementById('draw-route').innerText = 'Start Drawing';
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
        `Route created with ${newRoutePath.length} points and ${distance.toFixed(1)} km distance`;
    document.getElementById('drawing-status').className = 'drawing-status success';
    
    // Disable finish button after completion
    document.getElementById('finish-drawing').setAttribute('disabled', 'disabled');
}

// Clear the drawn route
function clearDrawnRoute() {
    newRoutePath = [];
    if (newRouteLayer) {
        newRouteLayer.clearLayers();
    }
    
    drawingRoute = false;
    document.getElementById('draw-route').innerText = 'Start Drawing';
    document.getElementById('draw-route').disabled = false;
    document.getElementById('route-duration-input').value = '';
    document.getElementById('finish-drawing').setAttribute('disabled', 'disabled');
    
    // Reset drawing status
    document.getElementById('drawing-status').innerHTML = 'Route cleared. Click "Start Drawing" to begin again.';
    document.getElementById('drawing-status').className = 'drawing-status';
}

// Submit a new route
function submitNewRoute() {
    const title = document.getElementById('route-title').value.trim();
    const description = document.getElementById('route-desc').value.trim();
    const difficulty = document.getElementById('route-difficulty-input').value;
    const durationInput = document.getElementById('route-duration-input').value.trim();
    
    // Validate inputs
    if (!title) {
        alert('Please enter a title for your route.');
        return;
    }
    
    if (!description) {
        alert('Please enter a description for your route.');
        return;
    }
    
    if (newRoutePath.length < 2) {
        alert('Please draw a route on the map with at least 2 points.');
        return;
    }
    
    if (!durationInput) {
        alert('Please enter an estimated duration for your route.');
        return;
    }
    
    const duration = parseInt(durationInput);
    if (isNaN(duration) || duration <= 0) {
        alert('Please enter a valid duration in minutes.');
        return;
    }
    
    // Calculate distance
    const distance = calculatePathDistance(newRoutePath);
    
    // Create a new route object
    const newRoute = {
        title,
        description,
        path: newRoutePath,
        duration,
        difficulty,
        author: getCurrentUser()?.name || 'Anonymous User'
    };
    
    // Show loading state
    document.getElementById('submit-route').disabled = true;
    document.getElementById('submit-route').textContent = 'Submitting...';
    
    // Get access token if available
    const accessToken = getAccessToken();
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    // Try to submit to the API first
    fetch('/api/routes', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(newRoute)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to submit route');
        }
        return response.json();
    })
    .then(savedRoute => {
        // Use the API response for success path
        handleRouteSubmissionSuccess(savedRoute);
    })
    .catch(error => {
        console.error('Error submitting route to API:', error);
        
        // Client-side fallback: Create a simulated route
        const mockNewRoute = {
            id: Math.floor(Math.random() * 10000) + 1000, // Create a unique ID
            title,
            description,
            path: newRoutePath,
            distance,
            duration,
            difficulty,
            rating: 0,
            author: getCurrentUser()?.name || 'Anonymous User',
            createdAt: new Date(),
            reviews: []
        };
        
        // Process the new route locally
        handleRouteSubmissionSuccess(mockNewRoute);
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
    if (!confirm('Are you sure you want to delete this route?')) {
        return;
    }
    
    // Find the route index
    const routeIndex = routesData.findIndex(r => r.id === routeId);
    
    if (routeIndex === -1) {
        alert('Route not found.');
        return;
    }
    
    // Check if the route belongs to the current user
    const currentUser = getCurrentUser();
    if (!currentUser || routesData[routeIndex].author !== currentUser.name) {
        alert('You can only delete your own routes.');
        return;
    }
    
    // Remove the route from the array
    routesData.splice(routeIndex, 1);
    
    // Save the updated routes to localStorage
    saveRoutesToLocalStorage();
    
    // Refresh the display
    displayRoutes(routesData);
    addRoutesToMap(routesData);
    
    // Show success message
    locationStatus.innerHTML = 'Route deleted successfully.';
    locationStatus.className = 'location-status success';
    
    // Clear the message after a few seconds
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