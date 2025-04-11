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

# Friendship management helpers
def send_friend_request(from_user_id, to_user_id):
    """Send a friend request from one user to another"""
    # Check if users exist
    from_user = get_user_by_id(from_user_id)
    to_user = get_user_by_id(to_user_id)
    
    if not from_user or not to_user:
        return False, "User not found"
    
    # Check if this is a self-request
    if from_user_id == to_user_id:
        return False, "Cannot send friend request to yourself"
    
    # Check if request already sent
    pending_requests_key = f"friend_requests:{to_user_id}"
    if redis_client.sismember(pending_requests_key, from_user_id):
        return False, "Friend request already sent"
    
    # Check if they are already friends
    friends_key = f"friends:{from_user_id}"
    if redis_client.sismember(friends_key, to_user_id):
        return False, "Already friends with this user"
    
    # Check if there's a pending request in the opposite direction
    # If so, automatically accept it (become friends)
    opposite_requests_key = f"friend_requests:{from_user_id}"
    if redis_client.sismember(opposite_requests_key, to_user_id):
        # Remove the original request
        redis_client.srem(opposite_requests_key, to_user_id)
        
        # Make them friends in both directions
        redis_client.sadd(f"friends:{from_user_id}", to_user_id)
        redis_client.sadd(f"friends:{to_user_id}", from_user_id)
        
        return True, "Friend request accepted automatically"
    
    # Add to pending requests
    redis_client.sadd(pending_requests_key, from_user_id)
    
    # Add timestamp for request
    request_time_key = f"friend_request_time:{to_user_id}:{from_user_id}"
    redis_client.set(request_time_key, datetime.utcnow().isoformat())
    
    return True, "Friend request sent"

def accept_friend_request(user_id, friend_id):
    """Accept a friend request"""
    # Check if the request exists
    pending_requests_key = f"friend_requests:{user_id}"
    if not redis_client.sismember(pending_requests_key, friend_id):
        return False, "No friend request found"
    
    # Remove from pending requests
    redis_client.srem(pending_requests_key, friend_id)
    
    # Add to friends (both directions)
    redis_client.sadd(f"friends:{user_id}", friend_id)
    redis_client.sadd(f"friends:{friend_id}", user_id)
    
    # Delete the timestamp
    redis_client.delete(f"friend_request_time:{user_id}:{friend_id}")
    
    return True, "Friend request accepted"

def reject_friend_request(user_id, friend_id):
    """Reject a friend request"""
    # Check if the request exists
    pending_requests_key = f"friend_requests:{user_id}"
    if not redis_client.sismember(pending_requests_key, friend_id):
        return False, "No friend request found"
    
    # Remove from pending requests
    redis_client.srem(pending_requests_key, friend_id)
    
    # Delete the timestamp
    redis_client.delete(f"friend_request_time:{user_id}:{friend_id}")
    
    return True, "Friend request rejected"

def remove_friend(user_id, friend_id):
    """Remove a friend connection"""
    # Remove from both users' friend lists
    redis_client.srem(f"friends:{user_id}", friend_id)
    redis_client.srem(f"friends:{friend_id}", user_id)
    
    return True, "Friend removed"

def get_friend_requests(user_id):
    """Get pending friend requests for a user"""
    requests_key = f"friend_requests:{user_id}"
    request_ids = redis_client.smembers(requests_key)
    
    requests = []
    for req_id in request_ids:
        user = get_user_by_id(req_id)
        if user:
            # Create safe user object
            safe_user = {
                'id': user['id'],
                'name': user['name'],
                'email': user['email'],
                'request_time': redis_client.get(f"friend_request_time:{user_id}:{req_id}") or datetime.utcnow().isoformat()
            }
            requests.append(safe_user)
    
    return requests

def get_friends(user_id):
    """Get all friends for a user"""
    friends_key = f"friends:{user_id}"
    friend_ids = redis_client.smembers(friends_key)
    
    friends = []
    for friend_id in friend_ids:
        user = get_user_by_id(friend_id)
        if user:
            # Create safe user object
            safe_user = {
                'id': user['id'],
                'name': user['name'],
                'email': user['email']
            }
            friends.append(safe_user)
    
    return friends

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
    
    # Get friend counts
    user_response['friend_count'] = len(get_friends(current_user_id))
    user_response['pending_requests_count'] = len(get_friend_requests(current_user_id))
    
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

@user_api.route('/api/users/me/email', methods=['PUT'])
@jwt_required()
def update_email():
    """Update user email"""
    current_user_id = get_jwt_identity()
    user = get_user_by_id(current_user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    data = request.json
    if not data or 'email' not in data or 'password' not in data:
        return jsonify({"error": "Email and current password required"}), 400
    
    # Verify password
    password = data['password'].encode('utf-8')
    stored_password = user['password'].encode('utf-8')
    
    if not bcrypt.checkpw(password, stored_password):
        return jsonify({"error": "Incorrect password"}), 401
    
    # Check if new email is different
    if data['email'] == user['email']:
        return jsonify({"error": "New email must be different from current email"}), 400
    
    # Check if email already exists
    if get_user_by_email(data['email']):
        return jsonify({"error": "Email already in use"}), 409
    
    # Remove old email index
    redis_client.delete(f"user:email:{user['email']}")
    
    # Update email
    user['email'] = data['email']
    
    # Save updated user
    save_user(user)
    
    # Create response without password
    user_response = user.copy()
    user_response.pop('password', None)
    
    return jsonify({
        "message": "Email updated successfully",
        "user": user_response
    })

@user_api.route('/api/users/me/password', methods=['PUT'])
@jwt_required()
def update_password():
    """Update user password"""
    current_user_id = get_jwt_identity()
    user = get_user_by_id(current_user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    data = request.json
    if not data or 'current_password' not in data or 'new_password' not in data:
        return jsonify({"error": "Current password and new password required"}), 400
    
    # Verify current password
    current_password = data['current_password'].encode('utf-8')
    stored_password = user['password'].encode('utf-8')
    
    if not bcrypt.checkpw(current_password, stored_password):
        return jsonify({"error": "Current password is incorrect"}), 401
    
    # Update password
    user['password'] = data['new_password']  # Will be hashed in save_user
    
    # Save updated user
    save_user(user)
    
    return jsonify({
        "message": "Password updated successfully"
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

# Friend management endpoints
@user_api.route('/api/users/search', methods=['GET'])
@jwt_required()
def search_users():
    """Search for users by email or name"""
    query = request.args.get('q', '').lower()
    if not query or len(query) < 3:  # Require at least 3 characters
        return jsonify({"error": "Search query must be at least 3 characters"}), 400
    
    current_user_id = get_jwt_identity()
    
    # Get all users and filter
    # Note: In a production system, this would use proper indexing or search
    results = []
    cursor = 0
    while True:
        cursor, keys = redis_client.scan(cursor, match="user:[a-f0-9-]*", count=100)
        
        for key in keys:
            if not key.startswith("user:") or key == f"user:{current_user_id}":
                continue
                
            user_data = redis_client.get(key)
            if user_data:
                user = json.loads(user_data)
                
                # Check if user name or email contains the query
                if (query in user.get('name', '').lower() or 
                    query in user.get('email', '').lower()):
                    
                    # Create a safe user object without sensitive info
                    safe_user = {
                        'id': user['id'],
                        'name': user['name'],
                        'email': user['email']
                    }
                    
                    # Check friendship status
                    if redis_client.sismember(f"friends:{current_user_id}", user['id']):
                        safe_user['status'] = 'friend'
                    elif redis_client.sismember(f"friend_requests:{current_user_id}", user['id']):
                        safe_user['status'] = 'received_request'
                    elif redis_client.sismember(f"friend_requests:{user['id']}", current_user_id):
                        safe_user['status'] = 'sent_request'
                    else:
                        safe_user['status'] = 'none'
                    
                    results.append(safe_user)
        
        if cursor == 0:
            break
            
    # Limit results
    return jsonify(results[:20])  # Limit to 20 results

@user_api.route('/api/users/me/friends', methods=['GET'])
@jwt_required()
def get_user_friends():
    """Get current user's friends"""
    current_user_id = get_jwt_identity()
    friends = get_friends(current_user_id)
    
    return jsonify(friends)

@user_api.route('/api/users/me/friend-requests', methods=['GET'])
@jwt_required()
def get_user_friend_requests():
    """Get current user's pending friend requests"""
    current_user_id = get_jwt_identity()
    requests = get_friend_requests(current_user_id)
    
    return jsonify(requests)

@user_api.route('/api/users/<user_id>/friend-request', methods=['POST'])
@jwt_required()
def send_friend_request_endpoint(user_id):
    """Send a friend request to another user"""
    current_user_id = get_jwt_identity()
    
    success, message = send_friend_request(current_user_id, user_id)
    
    if not success:
        return jsonify({"error": message}), 400
    
    return jsonify({"message": message})

@user_api.route('/api/users/<user_id>/friend-request/accept', methods=['POST'])
@jwt_required()
def accept_friend_request_endpoint(user_id):
    """Accept a friend request"""
    current_user_id = get_jwt_identity()
    
    success, message = accept_friend_request(current_user_id, user_id)
    
    if not success:
        return jsonify({"error": message}), 400
    
    return jsonify({"message": message})

@user_api.route('/api/users/<user_id>/friend-request/reject', methods=['POST'])
@jwt_required()
def reject_friend_request_endpoint(user_id):
    """Reject a friend request"""
    current_user_id = get_jwt_identity()
    
    success, message = reject_friend_request(current_user_id, user_id)
    
    if not success:
        return jsonify({"error": message}), 400
    
    return jsonify({"message": message})

@user_api.route('/api/users/<user_id>/friend', methods=['DELETE'])
@jwt_required()
def remove_friend_endpoint(user_id):
    """Remove a friend"""
    current_user_id = get_jwt_identity()
    
    success, message = remove_friend(current_user_id, user_id)
    
    if not success:
        return jsonify({"error": message}), 400
    
    return jsonify({"message": message})
