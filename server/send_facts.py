import requests

# Send a new fact check
requests.post(
    "http://localhost:8000/send-fact-check",
    json={
        "statement": "Python is a programming language.",
        "result": "True",
        "explanation": "Python is indeed a widely-used programming language created by Guido van Rossum."
    }
)
