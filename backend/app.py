from flask import Flask, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy  # Import SQLAlchemy

app = Flask(__name__)
CORS(app)

# --- CONFIGURE DATABASE CONNECTION ---
# IMPORTANT: Replace 'root' and 'your_password' with your MySQL credentials!
# We use the 'pymysql' driver. 'localhost' and '3306' are standard.
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:Scjjanke7#@localhost:3306/hackathon_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- Define a simple Test Model (Database Table) ---
class TestModel(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    message = db.Column(db.String(120), unique=False, nullable=False)

    def __repr__(self):
        return f'<TestModel {self.message}>'


# A test route that returns a simple JSON message
@app.route('/')
def home():
    return jsonify({"message": "API is running! MySQL configured."})

if __name__ == '__main__':
    # You need to manually create the 'hackathon_db' database in your MySQL terminal
    # before running this setup.
    with app.app_context():
        # This command creates the table defined above if it doesn't exist
        db.create_all()
        print("Database structure checked/created.")

    app.run(host='0.0.0.0', port=5000, debug=True)