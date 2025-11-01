# In backend/models.py
from extensions import db  # Imports the db object from extensions.py
from passlib.hash import pbkdf2_sha256 as pwd_context  # Security tool for hashing
from sqlalchemy.orm import relationship
from sqlalchemy import Column, Integer, String, Date, Boolean, ForeignKey
from sqlalchemy.sql import func


# --- 1. The User Model (Table: user) ---
# In backend/models.py - Corrected User Class

# --- 1. The User Model (Table: user) ---
class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(Integer, primary_key=True)
    username = db.Column(String(80), unique=True, nullable=False)
    password_hash = db.Column(String(128), nullable=False)

    # --- CRITICAL MISSING FIELDS (Gamification) ---
    xp = db.Column(Integer, default=0)
    level = db.Column(Integer, default=1)
    # ---------------------------------------------

    # Link to habits (THIS IS THE CORRECT AND ONLY PLACEMENT)
    habits = relationship('Habit', backref='owner', lazy=True)

    # Methods for Hashing & Verification
    def hash_password(self, password):
        self.password_hash = pwd_context.hash(password)

    def verify_password(self, password):
        return pwd_context.verify(password, self.password_hash)


# ... (rest of the file is correct) ...
# --- 2. The Habit Model (Table: habit) ---
class Habit(db.Model):
    __tablename__ = 'habit'
    id = db.Column(Integer, primary_key=True)
    user_id = db.Column(Integer, db.ForeignKey('user.id'), nullable=False)  # FK to user
    name = db.Column(String(100), nullable=False)
    frequency = db.Column(String(20), default='daily', nullable=False)  # e.g., 'daily'

    # Link to logs (allows getting all log entries for a habit: habit.logs)
    logs = relationship('HabitLog', backref='habit', lazy=True)


# --- 3. The HabitLog Model (Table: habit_log) ---
class HabitLog(db.Model):
    __tablename__ = 'habit_log'
    id = db.Column(Integer, primary_key=True)
    habit_id = db.Column(Integer, db.ForeignKey('habit.id'), nullable=False)  # FK to habit
    log_date = db.Column(Date, nullable=False, default=func.current_date())
    completed = db.Column(Boolean, default=True, nullable=False)