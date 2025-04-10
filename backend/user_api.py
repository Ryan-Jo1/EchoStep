from flask import Blueprint, request, jsonify
import redis
import json
import bcrypt
import os
import uuid
from datetime import datetime, timedelta
from flask_jwt_extended import (
    create_access_token, create_refresh_token, 
    jwt_required, get_jwt_identity, get_jwt
)

user_api = Blueprint('user_api', __name__)

# Redis Connection for user data
REDIS_HOST = os.getenv('REDIS_HOST', 'redis')
redis_client = redis.Redis(host=REDIS_HOST, port=6379, decode_responses=True)

# Helper functions
def get_user_by_email(email):
    """Get user data by email"""
    user_id = redis_client.get(f"user:email:{email}")
    if not user_id:
        return None
    
    user_data = redis_client.get(f"user:{user_id}")
    if not user_data:
        return None
    
    return json.loads(user_data)

def get_user_by_id(user_id):
    """Get user data by ID"""
    user_data = redis_client.get(f"user:{user_id}")
    if not user_data:
        return None
    
    return json.loads(user_data)

def save_user(user_data):
    """Save user data to Redis"""
    # Create a new user ID if not exists
    if 'id' not in user_data:
        user_data['id'] = str(uuid.uuid4())
    
    # Hash the password if it exists and not already hashed
    if 'password' in user_data and not user_data['password'].startswith('$2b$'):
        password = user_data['password'].encode('utf-8')
        salt = bcrypt.gensalt()
        user_data['password'] = bcrypt.hashpw(password, salt).decode('utf-8')
    
    # Add created_at timestamp if not exists
    if 'created_at' not in user_data:
        user_data['created_at'] = datetime.utcnow().isoformat()
    
    # Update last_updated timestamp
    user_data['last_updated'] = datetime.utcnow().isoformat()
    
    # Save the user data
    redis_client.set(f"user:{user_data['id']}", json.dumps(user_data))
    
    # Create email index if email exists
    if 'email' in user_data:
        redis_client.set(f"user:email:{user_data['email']}", user_data['id'])
    
    return user_data['id']

# User Authentication Endpoints
@user_api.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.json
    
    # Validate required fields
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    required_fields = ['email', 'password', 'name']
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    # Check if email already exists
    if get_user_by_email(data['email']):
        return jsonify({"error": "Email already registered"}), 409
    
    # Create user object (excluding sensitive data for response)
    user = {
        'email': data['email'],
        'password': data['password'],  # Will be hashed in save_user
        'name': data['name'],
        'preferences': data.get('preferences', {}),
    }
    
    # Save user to Redis
    user_id = save_user(user)
    
    # Get user without password for response
    user = get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "Failed to create user"}), 500
    
    user_response = user.copy()
    user_response.pop('password', None)
    
    # Create tokens
    access_token = create_access_token(identity=user_id)
    refresh_token = create_refresh_token(identity=user_id)
    
    return jsonify({
        "message": "User registered successfully",
        "user": user_response,
        "access_token": access_token,
        "refresh_token": refresh_token
    }), 201

@user_api.route('/api/auth/login', methods=['POST'])
def login():
    """Login a user"""
    data = request.json
    
    # Validate required fields
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    if 'email' not in data or 'password' not in data:
        return jsonify({"error": "Email and password required"}), 400
    
    # Get user by email
    user = get_user_by_email(data['email'])
    if not user:
        return jsonify({"error": "Invalid email or password"}), 401
    
    # Verify password
    password = data['password'].encode('utf-8')
    stored_password = user['password'].encode('utf-8')
    
    if not bcrypt.checkpw(password, stored_password):
        return jsonify({"error": "Invalid email or password"}), 401
    
    # Create response without password
    user_response = user.copy()
    user_response.pop('password', None)
    
    # Create tokens
    access_token = create_access_token(identity=user['id'])
    refresh_token = create_refresh_token(identity=user['id'])
    
    return jsonify({
        "message": "Login successful",
        "user": user_response,
        "access_token": access_token,
        "refresh_token": refresh_token
    })

@user_api.route('/api/auth/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token"""
    current_user = get_jwt_identity()
    access_token = create_access_token(identity=current_user)
    
    return jsonify({
        "access_token": access_token
    })

@user_api.route('/api/users/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current user profile"""
    current_user_id = get_jwt_identity()
    user = get_user_by_id(current_user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    # Remove sensitive data
    user_response = user.copy()
    user_response.pop('password', None)
    
    return jsonify(user_response)

@user_api.route('/api/users/me', methods=['PUT'])
@jwt_required()
def update_current_user():
    """Update current user profile"""
    current_user_id = get_jwt_identity()
    user = get_user_by_id(current_user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Fields that users are allowed to update
    allowed_fields = ['name', 'preferences']
    
    for field in allowed_fields:
        if field in data:
            user[field] = data[field]
    
    # Save updated user
    save_user(user)
    
    # Remove sensitive data
    user_response = user.copy()
    user_response.pop('password', None)
    
    return jsonify({
        "message": "User updated successfully",
        "user": user_response
    })

@user_api.route('/api/users/me/preferences', methods=['GET'])
@jwt_required()
def get_preferences():
    """Get user preferences"""
    current_user_id = get_jwt_identity()
    user = get_user_by_id(current_user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    return jsonify(user.get('preferences', {}))

@user_api.route('/api/users/me/preferences', methods=['PUT'])
@jwt_required()
def update_preferences():
    """Update user preferences"""
    current_user_id = get_jwt_identity()
    user = get_user_by_id(current_user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Initialize preferences if not exist
    if 'preferences' not in user:
        user['preferences'] = {}
    
    # Update preferences
    for key, value in data.items():
        user['preferences'][key] = value
    
    # Save updated user
    save_user(user)
    
    return jsonify({
        "message": "Preferences updated successfully",
        "preferences": user['preferences']
    })

@user_api.route('/api/users/me/preferences/<key>', methods=['PUT'])
@jwt_required()
def update_specific_preference(key):
    """Update a specific user preference"""
    current_user_id = get_jwt_identity()
    user = get_user_by_id(current_user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    data = request.json
    if not data or 'value' not in data:
        return jsonify({"error": "Preference value required"}), 400
    
    # Initialize preferences if not exist
    if 'preferences' not in user:
        user['preferences'] = {}
    
    # Update the specific preference
    user['preferences'][key] = data['value']
    
    # Save updated user
    save_user(user)
    
    return jsonify({
        "message": f"Preference '{key}' updated successfully",
        "key": key,
        "value": data['value']
    })

@user_api.route('/api/users/me/preferences/<key>', methods=['DELETE'])
@jwt_required()
def delete_preference(key):
    """Delete a specific user preference"""
    current_user_id = get_jwt_identity()
    user = get_user_by_id(current_user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    # Check if preferences and key exist
    if 'preferences' not in user or key not in user['preferences']:
        return jsonify({"error": f"Preference '{key}' not found"}), 404
    
    # Remove the preference
    del user['preferences'][key]
    
    # Save updated user
    save_user(user)
    
    return jsonify({
        "message": f"Preference '{key}' deleted successfully"
    })
