from flask import Flask, jsonify, request, session
from flask_cors import CORS
from extensions import db
from models import User, Habit, HabitLog
# NEW: Import necessary classes for the streak calculation and date handling
from datetime import date, timedelta
from sqlalchemy import desc

# --- FLASK APP INITIALIZATION & CONFIGURATION ---
app = Flask(__name__)
app.secret_key = 'a_very_secret_and_long_random_string_for_security'

CORS(app,
     supports_credentials=True, # Sends the required 'Access-Control-Allow-Credentials: true' header
     origins=['http://localhost:63342', 'http://127.0.0.1:63342', 'http://localhost:5000'])
# Added port 63342 to the allowed origins list to prevent the block.
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:Scjjanke7#@localhost:3306/hackathon_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Attach the database object to the app
db.init_app(app)


# --- UTILITY FUNCTIONS ---
def calculate_streak(habit_id):
    """Calculates the current consecutive completion streak for a given habit ID."""

    logs = HabitLog.query.filter_by(habit_id=habit_id, completed=True) \
        .order_by(desc(HabitLog.log_date)) \
        .all()

    if not logs:
        return 0

    current_streak = 0
    expected_date = date.today()

    log_dates = {log.log_date for log in logs}

    was_missed_today = expected_date not in log_dates

    if was_missed_today:
        expected_date -= timedelta(days=1)

    for _ in range(len(logs) + 1):
        if expected_date in log_dates:
            current_streak += 1
            expected_date -= timedelta(days=1)
        elif logs and expected_date < logs[-1].log_date:
            break
        else:
            break

    return current_streak


# --- TEST ROUTES ---
@app.route('/')
def home():
    return jsonify({"message": "API is running! Ready to track habits."})


# --- AUTHENTICATION ROUTES ---
@app.route('/api/register', methods=['POST'])
def register_user():
    # FILLED IN: Logic for registering a user
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"message": "Username and password are required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"message": "User already exists"}), 409

    new_user = User(username=username)
    new_user.hash_password(password)

    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"message": "Registration successful"}), 201
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({"message": "An error occurred during registration"}), 500


@app.route('/api/login', methods=['POST'])
def login_user():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"message": "Missing username or password"}), 400

    user = User.query.filter_by(username=username).first()

    if user and user.verify_password(password):
        session['user_id'] = user.id
        return jsonify({
            "message": "Login successful",
            "username": user.username,
            "id": user.id
        }), 200
    else:
        return jsonify({"message": "Invalid username or password"}), 401


@app.route('/api/status', methods=['GET'])
def get_status():
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user:
            return jsonify({
                "logged_in": True,
                "username": user.username,
                "id": user.id
            }), 200

    return jsonify({"logged_in": False}), 200


# --- HABIT CRUD AND LOGGING ROUTES ---
@app.route('/api/habits', methods=['POST'])
def create_habit():
    if 'user_id' not in session:
        return jsonify({"message": "Unauthorized. Please log in."}), 401

    data = request.get_json()
    habit_name = data.get('name')
    frequency = data.get('frequency', 'daily')
    user_id = session['user_id']

    if not habit_name:
        return jsonify({"message": "Habit name is required"}), 400

    new_habit = Habit(
        user_id=user_id,
        name=habit_name,
        frequency=frequency
    )

    try:
        db.session.add(new_habit)
        db.session.commit()
        return jsonify({
            "message": "Habit created successfully",
            "id": new_habit.id,
            "name": new_habit.name
        }), 201
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({"message": "Failed to create habit"}), 500


@app.route('/api/habits', methods=['GET'])
def get_habits():
    if 'user_id' not in session:
        return jsonify({"message": "Unauthorized. Please log in."}), 401

    user_id = session['user_id']
    habits = Habit.query.filter_by(user_id=user_id).all()

    habits_list = []
    for habit in habits:
        current_streak = calculate_streak(habit.id)

        habits_list.append({
            "id": habit.id,
            "name": habit.name,
            "frequency": habit.frequency,
            "streak": current_streak,
            "logged_today": HabitLog.query.filter_by(habit_id=habit.id, log_date=date.today()).first() is not None
        })

    return jsonify(habits_list), 200


@app.route('/api/habits/<int:habit_id>', methods=['DELETE'])
def delete_habit(habit_id):
    if 'user_id' not in session:
        return jsonify({"message": "Unauthorized. Please log in."}), 401

    user_id = session['user_id']

    habit = Habit.query.filter_by(id=habit_id, user_id=user_id).first()

    if not habit:
        return jsonify({"message": "Habit not found or access denied"}), 404

    # Delete associated logs first
    HabitLog.query.filter_by(habit_id=habit_id).delete()

    try:
        db.session.delete(habit)
        db.session.commit()
        return jsonify({"message": f"Habit '{habit.name}' deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({"message": "Failed to delete habit"}), 500


# In backend/app.py - Find and REPLACE the entire log_habit route:

@app.route('/api/log', methods=['POST'])
def log_habit():
    # 1. Authorization Check
    if 'user_id' not in session:
        return jsonify({"message": "Unauthorized. Please log in."}), 401

    data = request.get_json()
    habit_id = data.get('habit_id')  # CORRECT: Get habit_id from the JSON request data

    if not habit_id:
        return jsonify({"message": "Habit ID is required"}), 400

    user_id = session['user_id']
    user = User.query.get(user_id)

    # 2. Security Check: Find habit and ensure it belongs to the user
    # We need the habit object to access its name later and for security.
    habit = Habit.query.filter_by(id=habit_id, user_id=user_id).first()
    if not habit:
        return jsonify({"message": "Habit not found or access denied"}), 404

    # 3. Check for duplicates (prevent logging the same habit twice on the same day)
    today_log = HabitLog.query.filter_by(habit_id=habit_id, log_date=db.func.current_date()).first()

    if today_log:
        return jsonify({"message": "Habit already logged today"}), 200

    # 4. Create the new log entry and award XP
    if user:
        user.xp += 10  # Award 10 XP

    new_log = HabitLog(habit_id=habit_id, completed=True)

    # 5. Save and commit
    try:
        db.session.add(new_log)
        db.session.commit()
        return jsonify({"message": f"Habit '{habit.name}' logged successfully", "xp_gained": 10}), 201
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({"message": "Failed to log habit"}), 500
@app.route('/api/sleep', methods=['POST'])
def log_sleep():
    if 'user_id' not in session:
        return jsonify({"message": "Unauthorized. Please log in."}), 401

    data = request.get_json()
    bedtime = data.get('bedtime')
    wake_up = data.get('wake-up')
    quality = data.get('quality')

    if not bedtime or not wake_up or not quality:
        return jsonify({"message": "All sleep fields are required"}), 400

    user_id = session['user_id']
    user = User.query.get(user_id)

    # Award XP for logging sleep
    if user:
        user.xp += 5 # Award 5 XP for logging the sleep bonus

    try:
        # NOTE: Since we didn't create a SleepLog table, we only commit the User's XP update.
        db.session.commit()
        return jsonify({
            "message": "Sleep logged successfully. +5 XP!",
            "xp_gained": 5
        }), 201
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({"message": "Failed to log sleep"}), 500
# --- RUN BLOCK ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("Database structure checked/created.")

    app.run(host='0.0.0.0', port=5000, debug=True)