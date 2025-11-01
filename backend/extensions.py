from flask_sqlalchemy import SQLAlchemy

# Initialize the SQLAlchemy object (the database connector)
# It's not attached to the Flask app yet; that happens in app.py
db = SQLAlchemy()