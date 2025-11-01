// Function to test the connection to the Python backend API
function checkApiStatus() {
    const statusDiv = document.getElementById('api-status');
    statusDiv.textContent = "API Check: Connecting...";

    // Attempt to fetch from the Flask API endpoint (http://localhost:5000/)
    fetch('http://localhost:5000/')
        .then(response => {
            // Check for a successful status code (200-299)
            if (response.ok) {
                return response.json();
            }
            // If the server responded with an error (like 404 or 500)
            throw new Error('Network response was not ok, status: ' + response.status);
        })
        .then(data => {
            // Success: Update the status div with the message from the backend
            statusDiv.textContent = `API Check: SUCCESS! Message: "${data.message}"`;
            statusDiv.style.color = 'green';
        })
        .catch(error => {
            // Failure: Update the status div with an error message
            console.error('There has been a problem with your fetch operation:', error);
            statusDiv.textContent = 'API Check: FAILED. Ensure Flask is running.';
            statusDiv.style.color = 'red';
        });
}

// Run the check when the entire page is loaded
document.addEventListener('DOMContentLoaded', checkApiStatus);